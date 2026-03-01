import { Injectable, Logger } from '@nestjs/common';
import type { SubsystemWikiContent } from '../interfaces/wiki-content.interface';
import type { SubsystemGroup } from '../interfaces/subsystem-plan.interface';
import type { FileClassification } from '../interfaces/file-classification.interface';
import { LlmService } from '../services/llm.service';
import { DEEP_ANALYSIS_SYSTEM_PROMPT } from '../prompts/deep-analysis.prompt';
import { TOKEN_BUDGETS } from '../constants/token-budgets';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RepoContext {
  repoSummary: string;
  readme: string | null;
  repoUrl: string;
  branch: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CHARS_PER_TOKEN = 3;
const INPUT_CHAR_BUDGET = TOKEN_BUDGETS.DEEP_ANALYSIS_INPUT * CHARS_PER_TOKEN;

// Cap per raw source file — prevents one large file from consuming the budget.
const MAX_SOURCE_FILE_CHARS = 3_000;

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class DeepAnalysisAgent {
  private readonly logger = new Logger(DeepAnalysisAgent.name);

  constructor(private readonly llmService: LlmService) {}

  /**
   * Pass 3 — generate comprehensive wiki content for ONE subsystem.
   * The orchestrator calls this in parallel for every subsystem group.
   * Retry logic lives entirely in LlmService.
   */
  async analyze(
    group: SubsystemGroup,
    classifications: FileClassification[],
    sourceFiles: Map<string, string>,
    repoContext: RepoContext,
  ): Promise<SubsystemWikiContent> {
    // Filter to only this group's classified files
    const groupClassifications = classifications.filter(
      (c) => c.groupId === group.groupId,
    );

    const repoName = extractRepoName(repoContext.repoUrl);

    this.logger.log(
      `DeepAnalysisAgent: analyzing "${group.name}" ` +
        `(${groupClassifications.length} classified files, ` +
        `${sourceFiles.size} source files available)`,
    );

    const userPrompt = this.buildUserPrompt(
      group,
      groupClassifications,
      sourceFiles,
      repoContext,
      repoName,
    );

    return this.llmService.generateStructured<SubsystemWikiContent>(
      DEEP_ANALYSIS_SYSTEM_PROMPT,
      userPrompt,
      { maxTokens: TOKEN_BUDGETS.DEEP_ANALYSIS_OUTPUT },
    );
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private buildUserPrompt(
    group: SubsystemGroup,
    classifications: FileClassification[],
    sourceFiles: Map<string, string>,
    repoContext: RepoContext,
    repoName: string,
  ): string {
    const parts: string[] = [];
    let remaining = INPUT_CHAR_BUDGET;

    // 1 — Repo context (always include; small and high-signal)
    const repoSection = renderRepoContext(repoContext, repoName);
    parts.push(repoSection);
    remaining -= repoSection.length;

    // 2 — Subsystem description
    const subsystemSection = renderSubsystem(group);
    parts.push(subsystemSection);
    remaining -= subsystemSection.length;

    // 3 — File classifications with parser-accurate line numbers
    const classSection = renderClassifications(classifications);
    parts.push(classSection);
    remaining -= classSection.length;

    // 4 — Raw source of key files (budget-constrained, ranked by public interface count)
    const sourceSection = this.renderSourceFiles(classifications, sourceFiles, remaining);
    if (sourceSection) parts.push(sourceSection);

    return parts.join('\n');
  }

  /**
   * Include raw source for the most important files in this subsystem.
   * Ranked by public interface count descending so the LLM sees entry points first.
   */
  private renderSourceFiles(
    classifications: FileClassification[],
    sourceFiles: Map<string, string>,
    charBudget: number,
  ): string {
    if (charBudget <= 200 || sourceFiles.size === 0) return '';

    const ranked = [...classifications]
      .filter((c) => sourceFiles.has(c.filePath))
      .sort((a, b) => {
        const aCount = a.functionSummaries.filter((f) => f.isPublicInterface).length;
        const bCount = b.functionSummaries.filter((f) => f.isPublicInterface).length;
        return bCount - aCount;
      });

    const lines: string[] = ['## Key Source Files\n'];
    let remaining = charBudget - 22; // account for the header line

    for (const c of ranked) {
      if (remaining <= 0) break;

      const raw = sourceFiles.get(c.filePath) ?? '';
      const body =
        raw.length > MAX_SOURCE_FILE_CHARS
          ? `${raw.slice(0, MAX_SOURCE_FILE_CHARS)}\n... (truncated)`
          : raw;

      const entry = `### ${c.filePath}\n\`\`\`\n${body}\n\`\`\`\n`;
      if (entry.length > remaining) break;

      lines.push(entry);
      remaining -= entry.length;
    }

    return lines.length > 1 ? lines.join('\n') : '';
  }
}

// ── Module-level helpers (pure functions, no class state needed) ──────────────

/**
 * Extract "owner/repo" from any URL form:
 *   https://github.com/owner/repo.git  → owner/repo
 *   github.com/owner/repo              → owner/repo
 */
function extractRepoName(repoUrl: string): string {
  return repoUrl
    .replace(/^https?:\/\//, '')
    .replace(/^github\.com\//, '')
    .replace(/\.git$/, '')
    .replace(/\/$/, '');
}

function renderRepoContext(repoContext: RepoContext, repoName: string): string {
  const readmePart = repoContext.readme
    ? `\n### README\n\n${repoContext.readme}\n`
    : '';

  return [
    '## Repository Context',
    '',
    `**Repo:** ${repoName}`,
    `**Branch:** ${repoContext.branch}`,
    `**Summary:** ${repoContext.repoSummary}`,
    `**GitHub citation URL format:** https://github.com/${repoName}/blob/${repoContext.branch}/{filePath}#L{lineStart}-L{lineEnd}`,
    readmePart,
  ].join('\n');
}

function renderSubsystem(group: SubsystemGroup): string {
  return [
    '## Subsystem to Document',
    '',
    `**groupId:** ${group.groupId}`,
    `**Name:** ${group.name}`,
    `**Description:** ${group.description}`,
    `**Assigned files:** ${group.assignedFiles.join(', ')}`,
    '',
  ].join('\n');
}

function renderClassifications(classifications: FileClassification[]): string {
  if (classifications.length === 0) return '';

  const lines = [
    '## File Classifications',
    '_(line numbers are pre-computed and accurate — copy them verbatim into citations)_\n',
  ];

  for (const c of classifications) {
    lines.push(`### ${c.filePath}`);
    lines.push(`**Summary:** ${c.summary}`);

    if (c.functionSummaries.length > 0) {
      lines.push('**Structures:**');
      lines.push('```json');
      lines.push(JSON.stringify(c.functionSummaries, null, 2));
      lines.push('```');
    }

    lines.push('');
  }

  return lines.join('\n');
}
