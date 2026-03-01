import { Injectable } from '@nestjs/common';
import type { GroupingPlan } from '../interfaces/subsystem-plan.interface';
import { LlmService } from '../services/llm.service';
import { GROUPING_PLAN_SYSTEM_PROMPT } from '../prompts/grouping-plan.prompt';
import { TOKEN_BUDGETS } from '../constants/token-budgets';

// Approximate chars-per-token ratio used for budget enforcement.
// Erring on the conservative side (3 chars/token) avoids silent truncation by the API.
const CHARS_PER_TOKEN = 3;
const INPUT_CHAR_BUDGET = TOKEN_BUDGETS.GROUPING_PLAN_INPUT * CHARS_PER_TOKEN;

// Cap per-snippet to prevent one large file from consuming the whole budget.
const MAX_SNIPPET_CHARS = 1_500;

@Injectable()
export class GroupingPlanAgent {
  constructor(private readonly llmService: LlmService) {}

  /**
   * Pass 1 — identify user-facing subsystems from file tree + snippets + README.
   * Single LLM call; retry logic lives in LlmService.
   */
  async execute(
    fileTree: string,
    snippets: Map<string, string>,
    readme: string | null,
  ): Promise<GroupingPlan> {
    const userPrompt = this.buildUserPrompt(fileTree, snippets, readme);
    return this.llmService.generateStructured<GroupingPlan>(
      GROUPING_PLAN_SYSTEM_PROMPT,
      userPrompt,
      { maxTokens: TOKEN_BUDGETS.GROUPING_PLAN_OUTPUT },
    );
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private buildUserPrompt(
    fileTree: string,
    snippets: Map<string, string>,
    readme: string | null,
  ): string {
    const parts: string[] = [];
    let remainingBudget = INPUT_CHAR_BUDGET;

    // ── README (highest signal — include first) ──────────────────────────────
    if (readme) {
      const section = `## README\n\n${readme}\n`;
      parts.push(section);
      remainingBudget -= section.length;
    }

    // ── File tree ────────────────────────────────────────────────────────────
    const treeSection = `## File Tree\n\n${fileTree}\n`;
    parts.push(treeSection);
    remainingBudget -= treeSection.length;

    // ── File snippets ────────────────────────────────────────────────────────
    const snippetLines: string[] = ['## File Snippets\n'];

    for (const [path, raw] of snippets) {
      if (remainingBudget <= 0) break;

      const snippet =
        raw.length > MAX_SNIPPET_CHARS
          ? `${raw.slice(0, MAX_SNIPPET_CHARS)}\n... (truncated)`
          : raw;

      const entry = `### ${path}\n\`\`\`\n${snippet}\n\`\`\`\n`;

      if (entry.length > remainingBudget) break;

      snippetLines.push(entry);
      remainingBudget -= entry.length;
    }

    parts.push(snippetLines.join('\n'));

    return parts.join('\n');
  }
}
