import { Injectable, Logger } from '@nestjs/common';
import type { ParsedFile, FileClassification } from '../interfaces/file-classification.interface';
import type { GroupingPlan, SubsystemGroup } from '../interfaces/subsystem-plan.interface';
import { LlmService } from '../services/llm.service';
import { FILE_CLASSIFIER_SYSTEM_PROMPT } from '../prompts/file-classifier.prompt';
import { TOKEN_BUDGETS } from '../constants/token-budgets';

const CHARS_PER_TOKEN = 3;
const INPUT_CHAR_BUDGET = TOKEN_BUDGETS.FILE_CLASSIFIER_INPUT * CHARS_PER_TOKEN;

// Files per LLM call. Larger batches mean fewer total calls and less
// parallel scheduling overhead. 8 files × ~375 tokens/file ≈ 3 000 output
// tokens — comfortably within the raised FILE_CLASSIFIER_OUTPUT budget.
const BATCH_SIZE = 8;

// Maximum number of classifier batches running at the same time.
// Keeping this low prevents a large repo from exhausting the TPM limit in
// one burst — batches naturally pace themselves via LLM call latency.
const MAX_CONCURRENT_BATCHES = 5;

@Injectable()
export class FileClassifierAgent {
  private readonly logger = new Logger(FileClassifierAgent.name);

  constructor(private readonly llmService: LlmService) {}

  /**
   * Pass 2 — classify every parsed file into a subsystem and annotate its structures.
   *
   * Internally groups files by their pre-assigned subsystem from the grouping plan,
   * then dispatches batches of up to BATCH_SIZE files per LLM call.
   * The orchestrator calls this once and receives the full flattened result.
   */
  async execute(
    parsedFiles: ParsedFile[],
    groupingPlan: GroupingPlan,
  ): Promise<FileClassification[]> {
    const batches = this.buildBatches(parsedFiles, groupingPlan);
    this.logger.log(
      `FileClassifierAgent: ${parsedFiles.length} files → ${batches.length} batches`,
    );

    const results = await runWithConcurrency(
      batches.map((batch, i) => () => this.classifyBatch(batch, groupingPlan, i)),
      MAX_CONCURRENT_BATCHES,
    );

    return results.flat();
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  /**
   * Group files by their assigned subsystem from the plan, then slice into
   * fixed-size batches. Files not found in any subsystem's assignedFiles are
   * collected into a single overflow batch so they are never silently dropped.
   */
  private buildBatches(
    parsedFiles: ParsedFile[],
    groupingPlan: GroupingPlan,
  ): ParsedFile[][] {
    // Build a lookup: filePath → SubsystemGroup
    const fileToGroup = new Map<string, SubsystemGroup>();
    for (const group of groupingPlan.subsystems) {
      for (const filePath of group.assignedFiles) {
        fileToGroup.set(filePath, group);
      }
    }

    // Bucket files by groupId (preserves subsystem locality within batches)
    const grouped = new Map<string, ParsedFile[]>();
    const unassigned: ParsedFile[] = [];

    for (const file of parsedFiles) {
      const group = fileToGroup.get(file.path);
      if (group) {
        const bucket = grouped.get(group.groupId) ?? [];
        bucket.push(file);
        grouped.set(group.groupId, bucket);
      } else {
        unassigned.push(file);
      }
    }

    // Slice each bucket into BATCH_SIZE chunks
    const batches: ParsedFile[][] = [];
    for (const bucket of [...grouped.values(), unassigned]) {
      if (bucket.length === 0) continue;
      for (let i = 0; i < bucket.length; i += BATCH_SIZE) {
        batches.push(bucket.slice(i, i + BATCH_SIZE));
      }
    }

    return batches;
  }

  /** Classify one batch; returns FileClassification[] for that batch. */
  private async classifyBatch(
    batch: ParsedFile[],
    groupingPlan: GroupingPlan,
    batchIndex: number,
  ): Promise<FileClassification[]> {
    const userPrompt = this.buildUserPrompt(batch, groupingPlan);

    try {
      const result = await this.llmService.generateStructured<FileClassification[]>(
        FILE_CLASSIFIER_SYSTEM_PROMPT,
        userPrompt,
        { maxTokens: TOKEN_BUDGETS.FILE_CLASSIFIER_OUTPUT },
      );

      // Normalise: LLM sometimes wraps the array in an object
      const classifications = Array.isArray(result)
        ? result
        : ((result as { classifications?: FileClassification[] }).classifications ?? []);

      return classifications;
    } catch (error) {
      this.logger.error(
        `Batch ${batchIndex} classification failed: ${(error as Error).message}`,
      );
      // Return minimal stubs so the pipeline continues without this batch
      return batch.map((f) => ({
        filePath: f.path,
        groupId: 'unclassified',
        summary: 'Classification failed for this file.',
        functionSummaries: f.structures.map((s) => ({
          name: s.name,
          lineStart: s.lineStart,
          lineEnd: s.lineEnd,
          description: '',
          isPublicInterface: false,
        })),
      }));
    }
  }

  private buildUserPrompt(batch: ParsedFile[], groupingPlan: GroupingPlan): string {
    const parts: string[] = [];
    let remaining = INPUT_CHAR_BUDGET;

    // ── Subsystem plan summary (compact — LLM needs group ids + names) ────────
    const planSection = this.renderPlan(groupingPlan);
    parts.push(planSection);
    remaining -= planSection.length;

    // ── Files ─────────────────────────────────────────────────────────────────
    parts.push('## Files to Classify\n');

    for (const file of batch) {
      if (remaining <= 0) break;

      const fileSection = this.renderFile(file, remaining);
      parts.push(fileSection);
      remaining -= fileSection.length;
    }

    return parts.join('\n');
  }

  private renderPlan(groupingPlan: GroupingPlan): string {
    const subsystemLines = groupingPlan.subsystems
      .map((g) => `- ${g.groupId}: ${g.name} — ${g.description}`)
      .join('\n');

    return `## Subsystem Plan\n\n${subsystemLines}\n`;
  }

  private renderFile(file: ParsedFile, charBudget: number): string {
    // Structures JSON (line numbers must be preserved exactly)
    const structuresJson = JSON.stringify(file.structures, null, 2);

    // Snippet truncated to fit within remaining budget
    const headerOverhead = file.path.length + structuresJson.length + 200;
    const snippetBudget = Math.max(0, charBudget - headerOverhead);
    const snippet =
      file.snippet.length > snippetBudget
        ? `${file.snippet.slice(0, snippetBudget)}\n... (truncated)`
        : file.snippet;

    return [
      `### ${file.path}`,
      `**Structures (line numbers are accurate — copy verbatim):**`,
      '```json',
      structuresJson,
      '```',
      `**Snippet:**`,
      '```',
      snippet,
      '```',
      '',
    ].join('\n');
  }
}

// ── Concurrency helper ────────────────────────────────────────────────────────

/**
 * Run an array of async task factories with a bounded number of simultaneous
 * executions. Results are returned in the same order as the input tasks.
 *
 * Unlike Promise.all, this never starts more than `maxConcurrent` tasks at
 * once — preventing large repos from bursting all LLM calls simultaneously
 * and exhausting the OpenAI TPM limit.
 */
async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  maxConcurrent: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  const queue = tasks.map((task, i) => ({ task, i }));

  async function worker(): Promise<void> {
    while (true) {
      const item = queue.shift();
      if (!item) break;
      results[item.i] = await item.task();
    }
  }

  await Promise.all(Array.from({ length: maxConcurrent }, () => worker()));
  return results;
}
