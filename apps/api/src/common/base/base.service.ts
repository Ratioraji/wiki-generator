import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type {
  DataSource,
  EntityManager,
  EntityTarget,
  ObjectLiteral,
  Repository,
} from 'typeorm';

/**
 * Base class for all wiki-module services.
 *
 * - Subclasses call `super(dataSource, EntityClass)` in their constructor.
 * - All methods receive an optional `EntityManager` for transaction propagation.
 * - `this.getRepo(manager)` returns the correct repository:
 *   - inside a transaction → manager.getRepository(T)  (participates in the tx)
 *   - outside a transaction → dataSource.getRepository(T) (auto-managed connection)
 *
 * Transactions are NEVER created here — only use cases or self-contained
 * service methods (like WikiPersistenceService.completeWiki) may open them.
 */
@Injectable()
export abstract class BaseService<T extends ObjectLiteral> {
  constructor(
    @InjectDataSource() protected readonly dataSource: DataSource,
    private readonly entityTarget: EntityTarget<T>,
  ) {}

  protected getRepo(manager?: EntityManager): Repository<T> {
    if (manager) {
      return manager.getRepository(this.entityTarget);
    }
    return this.dataSource.getRepository(this.entityTarget);
  }
}
