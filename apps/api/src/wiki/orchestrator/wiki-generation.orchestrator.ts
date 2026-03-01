import { Injectable, Logger } from '@nestjs/common';
import { Subject } from 'rxjs';
import type { AgentContext } from '../interfaces/agent-context.interface';
import type { SSEEvent } from '../interfaces/sse-event.interface';
import type { GroupingPlan } from '../interfaces/subsystem-plan.interface';
import type { ParsedFile, FileClassification } from '../interfaces/file-classification.interface';
import type { SubsystemWikiContent } from '../interfaces/wiki-content.interface';
import type { RepoStructure } from '../services/file-parser.service';
import type {
  CompleteWikiData,
  WikiSubsystemData,
  WikiFileMapData,
} from '../services/wiki-persistence.service';
import type { RepoContext } from '../agents/deep-analysis.agent';
import type { Wiki } from '../entities/wiki.entity';
import type { WikiResponseDto } from '../dto/wiki-response.dto';
import { RepoIngestionService } from '../services/repo-ingestion.service';
import { FileParserService } from '../services/file-parser.service';
import { GroupingPlanAgent } from '../agents/grouping-plan.agent';
import { FileClassifierAgent } from '../agents/file-classifier.agent';
import { DeepAnalysisAgent } from '../agents/deep-analysis.agent';
import { WikiPersistenceService } from '../services/wiki-persistence.service';
import { WikiCacheService } from '../services/wiki-cache.service';
import { VectorStoreService } from '../services/vector-store.service';

@Injectable()
export class WikiGenerationOrchestrator {
  private readonly logger = new Logger(WikiGenerationOrchestrator.name);

  constructor(
    private readonly repoIngestionService: RepoIngestionService,
    private readonly fileParserService: FileParserService,
    private readonly groupingPlanAgent: GroupingPlanAgent,
    private readonly fileClassifierAgent: FileClassifierAgent,
    private readonly deepAnalysisAgent: DeepAnalysisAgent,
    private readonly wikiPersistenceService: WikiPersistenceService,
    private readonly wikiCacheService: WikiCacheService,
    private readonly vectorStoreService: VectorStoreService,
  ) {}

  /**
   * Coordinate the full 3-pass wiki generation pipeline.
   * SSE events are pushed to sseSubject at each significant step.
   * Cleanup of the temp clone directory always runs in the finally block.
   */
  async generate(
    context: AgentContext,
    sseSubject: Subject<SSEEvent>,
  ): Promise<void> {
    const { wikiId, repoUrl, branch } = context;

    try {
      // Step 1: Clone the repo and collect files
      const repoStructure = await this.stepIngest(repoUrl, branch, wikiId, sseSubject);

      // Step 2: Static-parse files into structured representations
      const parsedFiles = this.stepParse(repoStructure, sseSubject);

      // Step 3: Pass 1 — LLM identifies user-facing subsystems
      const groupingPlan = await this.stepGroupingPlan(
        repoStructure.tree,
        parsedFiles,
        repoStructure.readme,
        sseSubject,
      );

      // Step 4: Pass 2 — LLM classifies every file into a subsystem
      const classifications = await this.stepClassify(parsedFiles, groupingPlan, sseSubject);

      // Step 5: Pass 3 — LLM deep-analyses each subsystem in parallel
      const repoContext: RepoContext = {
        repoSummary: groupingPlan.repoSummary,
        readme: repoStructure.readme,
        repoUrl,
        branch,
      };
      const analysisResults = await this.stepDeepAnalysis(
        groupingPlan,
        classifications,
        parsedFiles,
        repoContext,
        wikiId,
        sseSubject,
      );

      // Step 6: Assemble the wiki record, persist to DB, and cache in Redis
      await this.stepAssemble(
        wikiId,
        repoUrl,
        branch,
        groupingPlan,
        classifications,
        analysisResults,
        repoStructure.totalFiles,
        sseSubject,
      );

      sseSubject.next({ type: 'complete', wikiId });
    } finally {
      // Always remove the temp clone directory — never throws
      await this.repoIngestionService.cleanup(wikiId);
    }
  }

  // ── Step 1: Repo ingestion ────────────────────────────────────────────────────

  private async stepIngest(
    repoUrl: string,
    branch: string,
    wikiId: string,
    sseSubject: Subject<SSEEvent>,
  ): Promise<RepoStructure> {
    sseSubject.next({ type: 'status', message: 'Cloning repository...', phase: 'ingestion' });

    const repoStructure = await this.repoIngestionService.ingest(repoUrl, branch, wikiId);

    sseSubject.next({
      type: 'progress',
      progress: 10,
      phase: 'ingestion',
      message: `Ingested ${repoStructure.totalFiles} files`,
    });

    return repoStructure;
  }

  // ── Step 2: File parsing ──────────────────────────────────────────────────────

  private stepParse(
    repoStructure: RepoStructure,
    sseSubject: Subject<SSEEvent>,
  ): ParsedFile[] {
    const parsed = this.fileParserService.parse(repoStructure.files);

    sseSubject.next({
      type: 'progress',
      progress: 20,
      phase: 'ingestion',
      message: `Parsed ${parsed.length} files`,
    });

    return parsed;
  }

  // ── Step 3: Pass 1 — Grouping plan ───────────────────────────────────────────

  private async stepGroupingPlan(
    fileTree: string,
    parsedFiles: ParsedFile[],
    readme: string | null,
    sseSubject: Subject<SSEEvent>,
  ): Promise<GroupingPlan> {
    sseSubject.next({ type: 'status', message: 'Identifying subsystems...', phase: 'grouping' });

    const snippets = buildSnippetMap(parsedFiles);
    const plan = await this.groupingPlanAgent.execute(fileTree, snippets, readme);

    sseSubject.next({
      type: 'progress',
      progress: 35,
      phase: 'grouping',
      message: `Identified ${plan.subsystems.length} subsystems`,
    });

    return plan;
  }

  // ── Step 4: Pass 2 — File classification ─────────────────────────────────────

  private async stepClassify(
    parsedFiles: ParsedFile[],
    groupingPlan: GroupingPlan,
    sseSubject: Subject<SSEEvent>,
  ): Promise<FileClassification[]> {
    sseSubject.next({ type: 'status', message: 'Classifying files...', phase: 'classification' });

    const classifications = await this.fileClassifierAgent.execute(parsedFiles, groupingPlan);

    sseSubject.next({
      type: 'progress',
      progress: 55,
      phase: 'classification',
      message: 'Files classified',
    });

    return classifications;
  }

  // ── Step 5: Pass 3 — Deep analysis (parallel) ────────────────────────────────

  private async stepDeepAnalysis(
    groupingPlan: GroupingPlan,
    classifications: FileClassification[],
    parsedFiles: ParsedFile[],
    repoContext: RepoContext,
    wikiId: string,
    sseSubject: Subject<SSEEvent>,
  ): Promise<Array<SubsystemWikiContent | null>> {
    sseSubject.next({ type: 'status', message: 'Analysing subsystems...', phase: 'analysis' });

    const sourceFiles = buildSourceMap(parsedFiles);

    const results = await Promise.all(
      groupingPlan.subsystems.map((group) =>
        this.safeDispatch(
          group.name,
          async () => {
            const result = await this.deepAnalysisAgent.analyze(
              group,
              classifications,
              sourceFiles,
              repoContext,
            );

            // Fire-and-forget: embed immediately so search works as each subsystem finishes
            this.vectorStoreService.embedSubsystem(wikiId, result).catch((err) => {
              this.logger.warn(
                `Vector embed failed for "${group.name}": ${(err as Error).message}`,
              );
            });

            sseSubject.next({
              type: 'progress',
              phase: 'analysis',
              subsystem: group.name,
              message: `Analysed "${group.name}"`,
            });

            return result;
          },
          sseSubject,
        ),
      ),
    );

    sseSubject.next({ type: 'progress', progress: 90, phase: 'analysis', message: 'Analysis complete' });

    return results;
  }

  // ── Step 6: Assembly + persistence + cache ────────────────────────────────────

  private async stepAssemble(
    wikiId: string,
    repoUrl: string,
    branch: string,
    groupingPlan: GroupingPlan,
    classifications: FileClassification[],
    analysisResults: Array<SubsystemWikiContent | null>,
    totalFiles: number,
    sseSubject: Subject<SSEEvent>,
  ): Promise<void> {
    sseSubject.next({ type: 'status', message: 'Saving wiki...', phase: 'assembly' });

    const subsystems: WikiSubsystemData[] = analysisResults.flatMap(
      (result, idx): WikiSubsystemData[] => {
        if (!result) return [];
        return [
          {
            groupId: result.groupId,
            name: result.name,
            description: groupingPlan.subsystems[idx]?.description ?? null,
            overview: result.overview,
            howItWorks: result.howItWorks ?? null,
            publicInterfaces: result.publicInterfaces ?? null,
            citations: result.citations ?? null,
            dependencies: result.dependencies ?? null,
            keyFiles: result.keyFiles ?? null,
            displayOrder: idx,
          },
        ];
      },
    );

    // c.functionSummaries (classifier shape) is stored as-is in the JSONB column.
    // The entity FunctionSummary type differs from the interface FunctionSummary type
    // (different fields for the two purposes), so we cast through unknown.
    const fileMaps: WikiFileMapData[] = classifications.map((c) => ({
      filePath: c.filePath,
      groupId: c.groupId,
      summary: c.summary ?? null,
      functionSummaries: (c.functionSummaries as unknown) as WikiFileMapData['functionSummaries'],
    }));

    const completeData: CompleteWikiData = {
      repoSummary: groupingPlan.repoSummary,
      totalFiles,
      totalSubsystems: subsystems.length,
      subsystems,
      fileMaps,
    };

    const completedWiki = await this.wikiPersistenceService.completeWiki(wikiId, completeData);
    const responseDto = mapWikiToResponseDto(completedWiki);
    await this.wikiCacheService.cacheWiki(wikiId, repoUrl, branch, responseDto);
  }

  // ── safeDispatch ──────────────────────────────────────────────────────────────

  /**
   * Wrap a single deep-analysis call in a try/catch.
   * On failure: log the error, emit a warning SSE event, and return null.
   * Null results are filtered out during assembly — one bad subsystem
   * does not abort the entire pipeline.
   */
  private async safeDispatch<T>(
    name: string,
    fn: () => Promise<T>,
    sseSubject: Subject<SSEEvent>,
  ): Promise<T | null> {
    try {
      return await fn();
    } catch (error) {
      this.logger.error(`Agent "${name}" failed: ${(error as Error).message}`);
      sseSubject.next({
        type: 'status',
        message: `Warning: Analysis of "${name}" encountered an issue. Continuing...`,
      });
      return null;
    }
  }
}

// ── Module-level helpers (pure functions, no class state) ─────────────────────

/** Build path → snippet map passed to GroupingPlanAgent (Pass 1). */
function buildSnippetMap(parsedFiles: ParsedFile[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const f of parsedFiles) {
    map.set(f.path, f.snippet);
  }
  return map;
}

/** Build path → full content map passed to DeepAnalysisAgent (Pass 3). */
function buildSourceMap(parsedFiles: ParsedFile[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const f of parsedFiles) {
    map.set(f.path, f.content);
  }
  return map;
}

/**
 * Map the completed Wiki entity (with loaded relations) to WikiResponseDto
 * shape. This plain-object cast is used only for Redis caching — the value
 * is immediately JSON-serialised, so no class instance is required.
 */
function mapWikiToResponseDto(wiki: Wiki): WikiResponseDto {
  return {
    id: wiki.id,
    repoUrl: wiki.repoUrl,
    repoName: wiki.repoName,
    branch: wiki.branch,
    repoSummary: wiki.repoSummary,
    status: wiki.status,
    totalFiles: wiki.totalFiles,
    totalSubsystems: wiki.totalSubsystems,
    subsystems: (wiki.subsystems ?? []).map((s) => ({
      id: s.id,
      groupId: s.groupId,
      name: s.name,
      description: s.description,
      overview: s.overview,
      howItWorks: s.howItWorks,
      publicInterfaces: s.publicInterfaces,
      citations: s.citations,
      dependencies: s.dependencies,
      keyFiles: s.keyFiles,
      displayOrder: s.displayOrder,
      createdAt: s.createdAt,
    })),
    fileMaps: (wiki.fileMaps ?? []).map((f) => ({
      id: f.id,
      filePath: f.filePath,
      groupId: f.groupId,
      summary: f.summary,
      functionSummaries: f.functionSummaries,
      createdAt: f.createdAt,
    })),
    completedAt: wiki.completedAt,
    createdAt: wiki.createdAt,
  } as WikiResponseDto;
}
