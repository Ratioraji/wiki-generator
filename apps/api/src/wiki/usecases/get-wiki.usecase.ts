import { Injectable, NotFoundException } from '@nestjs/common';
import { BaseUseCase } from '../../common/base/base-use-case.abstract';
import type { UseCaseResponse } from '../../common/responses/use-case-response.interface';
import { WikiPersistenceService } from '../services/wiki-persistence.service';
import { WikiCacheService } from '../services/wiki-cache.service';
import { WikiResponseDto } from '../dto/wiki-response.dto';
import type { Wiki } from '../entities/wiki.entity';

@Injectable()
export class GetWikiUseCase extends BaseUseCase<string, WikiResponseDto> {
  constructor(
    private readonly wikiPersistenceService: WikiPersistenceService,
    private readonly wikiCacheService: WikiCacheService,
  ) {
    super();
  }

  async execute(wikiId: string, userId?: string): Promise<UseCaseResponse<WikiResponseDto>> {
    // 1. Check Redis first
    if (userId) {
      const cached = await this.wikiCacheService.getWiki(wikiId, userId);
      if (cached) {
        return this.ok(cached);
      }
    }

    // 2. Cache miss — fetch from DB (scoped by userId if provided)
    const wiki = await this.wikiPersistenceService.getFullWiki(wikiId, userId);
    if (!wiki) {
      throw new NotFoundException(`Wiki with id "${wikiId}" not found`);
    }

    // 3. Repopulate cache for subsequent reads
    const dto = this.transform(wiki);
    await this.wikiCacheService.cacheWiki(wikiId, wiki.repoUrl, wiki.branch, dto, wiki.userId);

    return this.ok(dto);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  protected transform(wiki: Wiki): WikiResponseDto {
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
}
