import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Subject, Observable } from 'rxjs';
import type { DataSource } from 'typeorm';
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
    @InjectDataSource() private readonly dataSource: DataSource,
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
  execute(dto: GenerateWikiDto, userId: string): Observable<SSEEvent> {
    const subject = new Subject<SSEEvent>();

    const normalisedUrl = normaliseRepoUrl(dto.repoUrl);
    const repoName = extractRepoName(normalisedUrl);

    // Defer async work so the observable is returned before anything runs
    void Promise.resolve().then(() =>
      this.runPipeline(dto, normalisedUrl, repoName, userId, subject),
    );

    return subject.asObservable();
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private async runPipeline(
    dto: GenerateWikiDto,
    normalisedUrl: string,
    repoName: string,
    userId: string,
    subject: Subject<SSEEvent>,
  ): Promise<void> {
    let wikiId: string | undefined;

    try {
      // 1. Dedup check + soft-delete + create inside a single transaction
      //    so if the create fails, the soft-delete is rolled back.
      let existingId: string | null = null;

      const wiki = await this.dataSource.transaction(async (manager) => {
        // Use the non-filtered query to catch ALL non-deleted wikis (including
        // FAILED ones) that would otherwise violate the unique constraint
        // `idx_wikis_repo_branch_active`.
        const existing = await this.wikiPersistenceService.findNonDeletedByRepoAndBranch(
          normalisedUrl,
          dto.branch,
          userId,
          manager,
        );

        if (existing) {
          const isFailed = existing.status === 'failed';

          if (!isFailed && !dto.forceRegenerate) {
            // Active (complete/processing) wiki exists — signal the caller
            return existing;
          }

          // Failed wiki or force regenerate: soft-delete the old record
          await this.wikiPersistenceService.softDelete(existing.id, manager);
          existingId = existing.id;
        }

        // Create a new wiki record in PROCESSING status
        return this.wikiPersistenceService.createWiki(
          normalisedUrl,
          repoName,
          dto.branch,
          userId,
          manager,
        );
      });

      // If an existing wiki was returned without force-regenerate, emit and exit
      if (wiki.status !== 'processing') {
        subject.next({ type: 'existing', wikiId: wiki.id });
        subject.complete();
        return;
      }

      wikiId = wiki.id;

      // Invalidate Redis cache AFTER the DB transaction has committed
      if (existingId) {
        await this.wikiCacheService.invalidate(existingId, normalisedUrl, dto.branch, userId);
      }

      const context: AgentContext = {
        wikiId: wiki.id,
        repoUrl: normalisedUrl,
        branch: dto.branch,
        repoName,
        userId,
      };

      // 2. Run the full pipeline — this is the long-running work
      await this.orchestrator.generate(context, subject);
      subject.complete();
    } catch (error) {
      this.logger.error(
        `Wiki generation failed for ${normalisedUrl}@${dto.branch}: ${(error as Error).message}`,
      );
      if (wikiId) {
        await this.wikiPersistenceService.markFailed(wikiId).catch(() => {});
      }
      subject.next({ type: 'error', error: (error as Error).message });
      subject.complete();
    }
  }
}
