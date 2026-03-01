import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import type { SSEEvent } from '../interfaces/sse-event.interface';
import type { AgentContext } from '../interfaces/agent-context.interface';
import { GenerateWikiDto } from '../dto/generate-wiki.dto';
import { WikiPersistenceService } from '../services/wiki-persistence.service';
import { WikiCacheService } from '../services/wiki-cache.service';
import { WikiGenerationOrchestrator } from '../orchestrator/wiki-generation.orchestrator';
import { normaliseRepoUrl, extractRepoName } from '../utils/normalise-repo-url';

@Injectable()
export class GenerateWikiUseCase {
  private readonly logger = new Logger(GenerateWikiUseCase.name);

  constructor(
    private readonly wikiPersistenceService: WikiPersistenceService,
    private readonly wikiCacheService: WikiCacheService,
    private readonly orchestrator: WikiGenerationOrchestrator,
  ) {}

  /**
   * Kick off wiki generation and return an Observable that streams SSE events.
   *
   * The method returns immediately with the observable — it does NOT wait for
   * the pipeline to complete. All async work (dedup check, DB writes, LLM
   * pipeline) runs inside `runPipeline()` which is fired asynchronously after
   * the observable is returned to the caller.
   */
  execute(dto: GenerateWikiDto): Observable<SSEEvent> {
    const subject = new Subject<SSEEvent>();

    const normalisedUrl = normaliseRepoUrl(dto.repoUrl);
    const repoName = extractRepoName(normalisedUrl);

    // Defer async work so the observable is returned before anything runs
    void Promise.resolve().then(() =>
      this.runPipeline(dto, normalisedUrl, repoName, subject),
    );

    return subject.asObservable();
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private async runPipeline(
    dto: GenerateWikiDto,
    normalisedUrl: string,
    repoName: string,
    subject: Subject<SSEEvent>,
  ): Promise<void> {
    // 1. Dedup check
    const existing = await this.wikiPersistenceService.findActiveByRepoAndBranch(
      normalisedUrl,
      dto.branch,
    );

    if (existing) {
      if (!dto.forceRegenerate) {
        // Wiki already exists — tell the client which one to load
        subject.next({ type: 'existing', wikiId: existing.id });
        subject.complete();
        return;
      }

      // Force regenerate: soft-delete the old record and invalidate Redis cache
      await this.wikiPersistenceService.softDelete(existing.id);
      await this.wikiCacheService.invalidate(existing.id, normalisedUrl, dto.branch);
    }

    // 2. Create a new wiki record in PROCESSING status
    const wiki = await this.wikiPersistenceService.createWiki(
      normalisedUrl,
      repoName,
      dto.branch,
    );

    const context: AgentContext = {
      wikiId: wiki.id,
      repoUrl: normalisedUrl,
      branch: dto.branch,
      repoName,
    };

    // 3. Run the full pipeline — this is the long-running work
    try {
      await this.orchestrator.generate(context, subject);
      subject.complete();
    } catch (error) {
      this.logger.error(
        `Wiki generation failed for ${normalisedUrl}@${dto.branch}: ${(error as Error).message}`,
      );
      await this.wikiPersistenceService.markFailed(wiki.id);
      subject.next({ type: 'error', error: (error as Error).message });
      subject.complete();
    }
  }
}
