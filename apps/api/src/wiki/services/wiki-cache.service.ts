import { Injectable, Inject } from '@nestjs/common';
import { createHash } from 'crypto';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../providers/redis.provider';
import type { WikiResponseDto } from '../dto/wiki-response.dto';

const TTL_SECONDS = 86_400; // 24 hours

@Injectable()
export class WikiCacheService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  // ── Write ───────────────────────────────────────────────────────────────────

  /**
   * Atomically set both cache keys using a Redis pipeline.
   *   wiki:{wikiId}            → full wiki JSON
   *   wiki:lookup:{repoHash}   → wikiId string
   */
  async cacheWiki(
    wikiId: string,
    repoUrl: string,
    branch: string,
    data: WikiResponseDto,
  ): Promise<void> {
    const json = JSON.stringify(data);
    const repoHash = this.hashRepoKey(repoUrl, branch);

    await this.redis
      .pipeline()
      .set(`wiki:${wikiId}`, json, 'EX', TTL_SECONDS)
      .set(`wiki:lookup:${repoHash}`, wikiId, 'EX', TTL_SECONDS)
      .exec();
  }

  // ── Read ────────────────────────────────────────────────────────────────────

  /** Returns the full cached wiki or null on miss. */
  async getWiki(wikiId: string): Promise<WikiResponseDto | null> {
    const raw = await this.redis.get(`wiki:${wikiId}`);
    if (!raw) return null;
    return JSON.parse(raw) as WikiResponseDto;
  }

  /** Fast lookup: returns wikiId for a repo+branch pair, or null on miss. */
  async findExistingWikiId(
    repoUrl: string,
    branch: string,
  ): Promise<string | null> {
    const repoHash = this.hashRepoKey(repoUrl, branch);
    return this.redis.get(`wiki:lookup:${repoHash}`);
  }

  // ── Invalidate ──────────────────────────────────────────────────────────────

  /** Delete both keys — used during force-regenerate. */
  async invalidate(
    wikiId: string,
    repoUrl: string,
    branch: string,
  ): Promise<void> {
    const repoHash = this.hashRepoKey(repoUrl, branch);
    await this.redis.del(`wiki:${wikiId}`, `wiki:lookup:${repoHash}`);
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  /**
   * SHA-256(normalise(repoUrl) + ":" + branch), first 16 hex chars.
   * Normalisation: lowercase, strip protocol, strip trailing .git / slashes.
   */
  private hashRepoKey(repoUrl: string, branch: string): string {
    const normalised = repoUrl
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\.git$/, '')
      .replace(/\/+$/, '');

    return createHash('sha256')
      .update(`${normalised}:${branch}`)
      .digest('hex')
      .slice(0, 16);
  }
}
