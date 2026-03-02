import { Injectable } from '@nestjs/common';
import { BaseUseCase } from '../../common/base/base-use-case.abstract';
import {
  PaginatedResponseDto,
  buildPaginationMeta,
} from '../../common/dto/paginated-response.dto';
import type { UseCaseResponse } from '../../common/responses/use-case-response.interface';
import { WikiPersistenceService } from '../services/wiki-persistence.service';
import { ListWikisDto } from '../dto/list-wikis.dto';
import { WikiListItemDto } from '../dto/wiki-list-item.dto';
import type { Wiki } from '../entities/wiki.entity';

const SUMMARY_TRUNCATE_LENGTH = 150;

@Injectable()
export class ListWikisUseCase extends BaseUseCase<
  ListWikisDto,
  PaginatedResponseDto<WikiListItemDto>
> {
  constructor(private readonly wikiPersistenceService: WikiPersistenceService) {
    super();
  }

  async execute(
    dto: ListWikisDto,
    userId?: string,
  ): Promise<UseCaseResponse<PaginatedResponseDto<WikiListItemDto>>> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const { data, total } = await this.wikiPersistenceService.listWikis(
      page,
      limit,
      dto.search,
      userId,
    );

    const items = data.map((wiki) => this.transform(wiki));
    const paginated = buildPaginationMeta(items, total, page, limit);

    return this.ok(paginated);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  protected transform(wiki: Wiki): WikiListItemDto {
    return {
      id: wiki.id,
      repoUrl: wiki.repoUrl,
      repoName: wiki.repoName,
      branch: wiki.branch,
      status: wiki.status,
      totalSubsystems: wiki.totalSubsystems,
      totalFiles: wiki.totalFiles,
      repoSummary:
        wiki.repoSummary != null
          ? wiki.repoSummary.slice(0, SUMMARY_TRUNCATE_LENGTH)
          : null,
      completedAt: wiki.completedAt,
      createdAt: wiki.createdAt,
    };
  }
}
