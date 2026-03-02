import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { BaseUseCase } from '../../common/base/base-use-case.abstract';
import type { UseCaseResponse } from '../../common/responses/use-case-response.interface';
import { WikiPersistenceService } from '../services/wiki-persistence.service';
import { WikiCacheService } from '../services/wiki-cache.service';
import { EmbeddingService } from '../services/embedding.service';
import { VectorStoreService } from '../services/vector-store.service';
import { LlmService } from '../services/llm.service';
import { LlmConfigService } from '../services/llm-config.service';
import { QaResponseDto, QaSourceDto } from '../dto/qa-response.dto';
import { QA_ANSWER_SYSTEM_PROMPT } from '../prompts/qa-answer.prompt';
import { WikiStatus } from '../enums/wiki-status.enum';
import type { WikiSearchResult } from '../services/vector-store.service';

// ── LLM output shape ─────────────────────────────────────────────────────────

interface QaResult {
  answer: string;
  sources: Array<{ subsystem: string; filePath: string; lines: string | null }>;
}

// ── Input shape ───────────────────────────────────────────────────────────────

type AskQuestionInput = { wikiId: string; question: string; userId?: string };

const TOP_K = 5;

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class AskQuestionUseCase extends BaseUseCase<AskQuestionInput, QaResponseDto> {
  constructor(
    private readonly wikiPersistenceService: WikiPersistenceService,
    private readonly wikiCacheService: WikiCacheService,
    private readonly embeddingService: EmbeddingService,
    private readonly vectorStoreService: VectorStoreService,
    private readonly llmService: LlmService,
    private readonly llmConfig: LlmConfigService,
  ) {
    super();
  }

  async execute({
    wikiId,
    question,
    userId,
  }: AskQuestionInput): Promise<UseCaseResponse<QaResponseDto>> {
    // 1. Ensure the wiki exists, belongs to the user, and its pipeline has completed
    await this.validateWiki(wikiId, userId);

    // 2. Embed the question into a query vector
    const queryVector = await this.embeddingService.embed(question);

    // 3. Retrieve the most relevant wiki chunks
    const chunks = await this.vectorStoreService.search(wikiId, queryVector, TOP_K);

    // 4. Build the RAG user prompt
    const userPrompt = this.buildUserPrompt(question, chunks);

    // 5. Ask the LLM — higher temperature than structured generation for conversational output
    const result = await this.llmService.generateStructured<QaResult>(
      QA_ANSWER_SYSTEM_PROMPT,
      userPrompt,
      { temperature: this.llmConfig.qaTemperature },
    );

    // 6. Map to response DTO
    return this.ok(this.transform(result));
  }

  // ── Private ────────────────────────────────────────────────────────────────

  /**
   * Check Redis first (cheap), fall back to DB on miss.
   * Throws NotFoundException if the wiki doesn't exist.
   * Throws BadRequestException if the wiki hasn't finished processing.
   */
  private async validateWiki(wikiId: string, userId?: string): Promise<void> {
    if (userId) {
      const cached = await this.wikiCacheService.getWiki(wikiId, userId);
      if (cached) {
        if (cached.status !== WikiStatus.COMPLETE) {
          throw new BadRequestException(
            `Wiki "${wikiId}" is not ready for Q&A (status: ${cached.status})`,
          );
        }
        return;
      }
    }

    // Cache miss — check DB (scoped by userId)
    const wiki = await this.wikiPersistenceService.getFullWiki(wikiId, userId);
    if (!wiki) {
      throw new NotFoundException(`Wiki with id "${wikiId}" not found`);
    }
    if (wiki.status !== WikiStatus.COMPLETE) {
      throw new BadRequestException(
        `Wiki "${wikiId}" is not ready for Q&A (status: ${wiki.status})`,
      );
    }
  }

  /**
   * Combine the question with retrieved context chunks for the LLM.
   * Each chunk includes its subsystem name so the LLM can cite sources.
   */
  private buildUserPrompt(question: string, chunks: WikiSearchResult[]): string {
    const contextSection = chunks.length
      ? chunks
          .map(
            (c, i) =>
              `[Context ${i + 1}] Subsystem: ${c.subsystemName} (${c.contentType})\n${c.text}`,
          )
          .join('\n\n')
      : '_(No relevant context found in this wiki)_';

    return [
      `## Question\n\n${question}`,
      `## Wiki Context\n\n${contextSection}`,
    ].join('\n\n');
  }

  protected transform(result: QaResult): QaResponseDto {
    const sources: QaSourceDto[] = result.sources
      .filter((s) => s.subsystem && s.filePath && s.filePath !== 'null')
      .map((s) => ({
        subsystem: s.subsystem,
        filePath: s.filePath,
        lines: s.lines === 'null' ? null : s.lines,
      }));

    return { answer: result.answer, sources };
  }
}
