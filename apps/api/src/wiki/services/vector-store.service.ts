import { Injectable, Inject, Logger } from '@nestjs/common';
import { VECTOR_STORE_CLIENT } from '../providers/vector-store.provider';
import type { VectorStore, VectorSearchResult } from '../providers/vector-store.provider';
import { EmbeddingService } from './embedding.service';
import type { SubsystemWikiContent, InterfaceDoc } from '../interfaces/wiki-content.interface';

// ── Metadata shape stored with every chunk ────────────────────────────────────

type ContentType = 'overview' | 'how_it_works' | 'interface';

interface ChunkMetadata {
  wikiId: string;
  groupId: string;
  subsystemName: string;
  contentType: ContentType;
  text: string;
}

// ── Public search result returned to callers ──────────────────────────────────

export interface WikiSearchResult {
  text: string;
  subsystemName: string;
  contentType: ContentType;
  score: number;
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class VectorStoreService {
  private readonly logger = new Logger(VectorStoreService.name);

  constructor(
    @Inject(VECTOR_STORE_CLIENT) private readonly store: VectorStore,
    private readonly embeddingService: EmbeddingService,
  ) {}

  /**
   * Chunk a subsystem, embed all chunks in one batch call, and upsert into
   * the store namespaced by wikiId.
   *
   * Chunk strategy (from agent spec):
   *   overview      → 1 chunk  (contentType: 'overview')
   *   howItWorks    → 1 chunk  (contentType: 'how_it_works')
   *   publicInterfaces[i] → 1 chunk each (contentType: 'interface')
   */
  async embedSubsystem(
    wikiId: string,
    content: SubsystemWikiContent,
  ): Promise<void> {
    const chunks = this.buildChunks(wikiId, content);
    if (chunks.length === 0) return;

    const vectors = await this.embeddingService.embedBatch(
      chunks.map((c) => c.text),
    );

    await Promise.all(
      chunks.map((chunk, i) =>
        this.store.upsert(wikiId, chunk.id, vectors[i], chunk.metadata as unknown as Record<string, unknown>),
      ),
    );

    this.logger.log(
      `Embedded subsystem "${content.name}" — ${chunks.length} chunk(s) stored for wiki ${wikiId}`,
    );
  }

  /**
   * Return the top-K most similar chunks within this wiki.
   * Always filtered to wikiId — never leaks chunks across wikis.
   */
  async search(
    wikiId: string,
    queryVector: number[],
    topK: number,
  ): Promise<WikiSearchResult[]> {
    const raw: VectorSearchResult[] = await this.store.search(
      wikiId,
      queryVector,
      topK,
    );

    return raw.map((r) => {
      const meta = r.metadata as unknown as ChunkMetadata;
      return {
        text: meta.text,
        subsystemName: meta.subsystemName,
        contentType: meta.contentType,
        score: r.score,
      };
    });
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private buildChunks(
    wikiId: string,
    content: SubsystemWikiContent,
  ): Array<{ id: string; text: string; metadata: ChunkMetadata }> {
    const chunks: Array<{ id: string; text: string; metadata: ChunkMetadata }> =
      [];
    let idx = 0;

    const push = (text: string, contentType: ContentType) => {
      if (!text?.trim()) return;
      chunks.push({
        id: `${wikiId}-${content.groupId}-${idx++}`,
        text,
        metadata: {
          wikiId,
          groupId: content.groupId,
          subsystemName: content.name,
          contentType,
          text,
        },
      });
    };

    push(content.overview, 'overview');
    push(content.howItWorks, 'how_it_works');

    for (const iface of content.publicInterfaces ?? []) {
      push(buildInterfaceText(iface), 'interface');
    }

    return chunks;
  }
}

// ── Module-level helper ───────────────────────────────────────────────────────

function buildInterfaceText(iface: InterfaceDoc): string {
  return [`${iface.name} (${iface.type}): ${iface.signature}`, iface.description]
    .filter(Boolean)
    .join('\n');
}
