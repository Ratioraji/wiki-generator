import type { Provider } from '@nestjs/common';

export const VECTOR_STORE_CLIENT = 'VECTOR_STORE_CLIENT';

// ── Swappable interface ───────────────────────────────────────────────────────
// VectorStoreService depends only on this interface. Swap the provider to
// point at Pinecone (or any other backend) without changing the service.

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface VectorStore {
  upsert(
    namespace: string,
    id: string,
    vector: number[],
    metadata: Record<string, unknown>,
  ): Promise<void>;

  search(
    namespace: string,
    vector: number[],
    topK: number,
  ): Promise<VectorSearchResult[]>;

  deleteNamespace(namespace: string): Promise<void>;
}

// ── In-memory MVP implementation ──────────────────────────────────────────────

interface StoredVector {
  vector: number[];
  metadata: Record<string, unknown>;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

class InMemoryVectorStore implements VectorStore {
  // namespace (wikiId) → id → stored vector + metadata
  private readonly store = new Map<string, Map<string, StoredVector>>();

  async upsert(
    namespace: string,
    id: string,
    vector: number[],
    metadata: Record<string, unknown>,
  ): Promise<void> {
    if (!this.store.has(namespace)) {
      this.store.set(namespace, new Map());
    }
    this.store.get(namespace)!.set(id, { vector, metadata });
  }

  async search(
    namespace: string,
    vector: number[],
    topK: number,
  ): Promise<VectorSearchResult[]> {
    const ns = this.store.get(namespace);
    if (!ns || ns.size === 0) return [];

    return Array.from(ns.entries())
      .map(([id, stored]) => ({
        id,
        score: cosineSimilarity(vector, stored.vector),
        metadata: stored.metadata,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async deleteNamespace(namespace: string): Promise<void> {
    this.store.delete(namespace);
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────
// To swap to Pinecone: replace `new InMemoryVectorStore()` with a Pinecone
// adapter that implements VectorStore. VectorStoreService requires no changes.

export const VectorStoreProvider: Provider = {
  provide: VECTOR_STORE_CLIENT,
  useFactory: (): VectorStore => {
    return new InMemoryVectorStore();
  },
};
