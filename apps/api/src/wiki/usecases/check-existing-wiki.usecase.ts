import { Injectable } from '@nestjs/common';
import { BaseUseCase } from '../../common/base/base-use-case.abstract';
import type { UseCaseResponse } from '../../common/responses/use-case-response.interface';
import { WikiPersistenceService } from '../services/wiki-persistence.service';
import { WikiCacheService } from '../services/wiki-cache.service';
import { CheckExistingWikiDto } from '../dto/check-existing-wiki.dto';
import { CheckExistingResponseDto } from '../dto/check-existing-response.dto';
import { normaliseRepoUrl } from '../utils/normalise-repo-url';

@Injectable()
export class CheckExistingWikiUseCase extends BaseUseCase<
  CheckExistingWikiDto,
  CheckExistingResponseDto
> {
  constructor(
    private readonly wikiPersistenceService: WikiPersistenceService,
    private readonly wikiCacheService: WikiCacheService,
  ) {
    super();
  }

  async execute(
    dto: CheckExistingWikiDto,
  ): Promise<UseCaseResponse<CheckExistingResponseDto>> {
    const normalisedUrl = normaliseRepoUrl(dto.repoUrl);

    // 1. Fast path: check Redis lookup key
    const cachedId = await this.wikiCacheService.findExistingWikiId(
      normalisedUrl,
      dto.branch,
    );
    if (cachedId) {
      return this.ok(this.transform({ exists: true, wikiId: cachedId }));
    }

    // 2. Cache miss — check DB
    const wiki = await this.wikiPersistenceService.findActiveByRepoAndBranch(
      normalisedUrl,
      dto.branch,
    );

    if (!wiki) {
      return this.ok(this.transform({ exists: false }));
    }

    return this.ok(
      this.transform({ exists: true, wikiId: wiki.id, createdAt: wiki.createdAt }),
    );
  }

  // ── Private ────────────────────────────────────────────────────────────────

  protected transform(data: CheckExistingResponseDto): CheckExistingResponseDto {
    return data;
  }
}
