import type { Provider } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { Pinecone } from '@pinecone-database/pinecone';
import type { RecordMetadata } from '@pinecone-database/pinecone';

export const VECTOR_STORE_CLIENT = 'VECTOR_STORE_CLIENT';

// ── Swappable interface ───────────────────────────────────────────────────────
// VectorStoreService depends only on this interface. Swap the provider to
// point at a different backend without changing the service.

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

// ── Pinecone implementation ──────────────────────────────────────────────────

const EMBEDDING_DIMENSION = 1536; // text-embedding-3-small

class PineconeVectorStore implements VectorStore {
  private readonly logger = new Logger('PineconeVectorStore');
  private readonly index: ReturnType<Pinecone['index']>;

  constructor(client: Pinecone, indexName: string) {
    this.index = client.index(indexName);
    this.logger.log(`Connected to Pinecone index "${indexName}"`);
  }

  async upsert(
    namespace: string,
    id: string,
    vector: number[],
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.index.namespace(namespace).upsert({
      records: [{ id, values: vector, metadata: metadata as RecordMetadata }],
    });
  }

  async search(
    namespace: string,
    vector: number[],
    topK: number,
  ): Promise<VectorSearchResult[]> {
    const result = await this.index.namespace(namespace).query({
      vector,
      topK,
      includeMetadata: true,
    });

    return (result.matches ?? []).map((match) => ({
      id: match.id,
      score: match.score ?? 0,
      metadata: (match.metadata as Record<string, unknown>) ?? {},
    }));
  }

  async deleteNamespace(namespace: string): Promise<void> {
    await this.index.namespace(namespace).deleteAll();
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export const VectorStoreProvider: Provider = {
  provide: VECTOR_STORE_CLIENT,
  useFactory: async (): Promise<VectorStore> => {
    const logger = new Logger('VectorStoreProvider');
    const apiKey = process.env.PINECONE_API_KEY;
    const indexName = process.env.PINECONE_INDEX ?? 'wiki-embeddings';

    if (!apiKey) {
      throw new Error('PINECONE_API_KEY environment variable is required');
    }

    const client = new Pinecone({ apiKey });

    // Create the index if it doesn't exist yet
    const existing = await client.listIndexes();
    const exists = existing.indexes?.some((i) => i.name === indexName);

    if (!exists) {
      logger.log(`Index "${indexName}" not found — creating serverless index…`);
      await client.createIndex({
        name: indexName,
        dimension: EMBEDDING_DIMENSION,
        metric: 'cosine',
        spec: { serverless: { cloud: 'aws', region: 'us-east-1' } },
      });
      logger.log(`Index "${indexName}" created`);
    }

    return new PineconeVectorStore(client, indexName);
  },
};
