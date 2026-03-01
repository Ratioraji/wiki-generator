import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntityManager } from 'typeorm';
import { Not } from 'typeorm';
import { BaseService } from '../../common/base/base.service';
import { Wiki } from '../entities/wiki.entity';
import { WikiSubsystem } from '../entities/wiki-subsystem.entity';
import { WikiFileMap } from '../entities/wiki-file-map.entity';
import { WikiStatus } from '../enums/wiki-status.enum';
import type { InterfaceDoc, Citation } from '../interfaces/wiki-content.interface';
import type { FunctionSummary } from '../entities/wiki-file-map.entity';

// ── Input shapes for completeWiki ─────────────────────────────────────────────

export interface WikiSubsystemData {
  groupId: string;
  name: string;
  description?: string | null;
  overview: string;
  howItWorks?: string | null;
  publicInterfaces?: InterfaceDoc[] | null;
  citations?: Citation[] | null;
  dependencies?: string[] | null;
  keyFiles?: string[] | null;
  displayOrder: number;
}

export interface WikiFileMapData {
  filePath: string;
  groupId: string;
  summary?: string | null;
  functionSummaries?: FunctionSummary[] | null;
}

export interface CompleteWikiData {
  repoSummary: string;
  totalFiles: number;
  totalSubsystems: number;
  subsystems: WikiSubsystemData[];
  fileMaps: WikiFileMapData[];
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class WikiPersistenceService extends BaseService<Wiki> {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(dataSource, Wiki);
  }

  // ── Create ──────────────────────────────────────────────────────────────────

  async createWiki(
    repoUrl: string,
    repoName: string,
    branch: string,
    manager?: EntityManager,
  ): Promise<Wiki> {
    const repo = this.getRepo(manager);
    const wiki = repo.create({
      repoUrl,
      repoName,
      branch,
      status: WikiStatus.PROCESSING,
    });
    return repo.save(wiki);
  }

  // ── Read ────────────────────────────────────────────────────────────────────

  async findActiveByRepoAndBranch(
    repoUrl: string,
    branch: string,
    manager?: EntityManager,
  ): Promise<Wiki | null> {
    // TypeORM @DeleteDateColumn automatically excludes soft-deleted rows.
    // Also exclude failed wikis so callers treat them as non-existent and
    // allow a fresh generation without requiring forceRegenerate.
    return this.getRepo(manager).findOne({
      where: { repoUrl, branch, status: Not(WikiStatus.FAILED) },
    });
  }

  async getFullWiki(wikiId: string): Promise<Wiki | null> {
    return this.getRepo().findOne({
      where: { id: wikiId },
      relations: { subsystems: true, fileMaps: true },
      order: { subsystems: { displayOrder: 'ASC' } },
    });
  }

  async listWikis(
    page: number,
    limit: number,
    search?: string,
  ): Promise<{ data: Wiki[]; total: number }> {
    const qb = this.getRepo()
      .createQueryBuilder('wiki')
      .orderBy('wiki.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (search?.trim()) {
      qb.andWhere('wiki.repoName ILIKE :search', {
        search: `%${search.trim()}%`,
      });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  // ── Complete (owns its own transaction) ──────────────────────────────────────
  //
  // This is the ONE self-contained atomic operation in the service layer:
  // update wiki + bulk-insert subsystems + bulk-insert file maps must either
  // all succeed or all roll back. It is NOT called from within a use-case
  // transaction — it manages its own.

  async completeWiki(wikiId: string, data: CompleteWikiData): Promise<Wiki> {
    await this.dataSource.transaction(async (manager) => {
      // 1. Update wiki record
      await this.getRepo(manager).update(wikiId, {
        status: WikiStatus.COMPLETE,
        repoSummary: data.repoSummary,
        totalFiles: data.totalFiles,
        totalSubsystems: data.totalSubsystems,
        completedAt: new Date(),
      });

      // 2. Bulk-insert subsystems
      if (data.subsystems.length > 0) {
        await manager
          .createQueryBuilder()
          .insert()
          .into(WikiSubsystem)
          .values(
            data.subsystems.map((s) => ({
              wikiId,
              groupId: s.groupId,
              name: s.name,
              description: s.description ?? null,
              overview: s.overview,
              howItWorks: s.howItWorks ?? null,
              publicInterfaces: s.publicInterfaces ?? null,
              citations: s.citations ?? null,
              dependencies: s.dependencies ?? null,
              keyFiles: s.keyFiles ?? null,
              displayOrder: s.displayOrder,
            })),
          )
          .execute();
      }

      // 3. Bulk-insert file maps
      if (data.fileMaps.length > 0) {
        await manager
          .createQueryBuilder()
          .insert()
          .into(WikiFileMap)
          .values(
            data.fileMaps.map((f) => ({
              wikiId,
              filePath: f.filePath,
              groupId: f.groupId,
              summary: f.summary ?? null,
              functionSummaries: f.functionSummaries ?? null,
            })),
          )
          .execute();
      }
    });

    // Load and return the completed wiki with relations
    const wiki = await this.getFullWiki(wikiId);
    if (!wiki) {
      throw new Error(`Wiki ${wikiId} not found after completeWiki transaction`);
    }
    return wiki;
  }

  // ── Status mutations ────────────────────────────────────────────────────────

  async softDelete(wikiId: string, manager?: EntityManager): Promise<void> {
    await this.getRepo(manager).softDelete(wikiId);
  }

  async markFailed(wikiId: string, manager?: EntityManager): Promise<void> {
    await this.getRepo(manager).update(wikiId, {
      status: WikiStatus.FAILED,
    });
  }
}
