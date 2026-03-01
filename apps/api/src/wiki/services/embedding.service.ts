import { Injectable, Inject, Logger } from '@nestjs/common';
import type OpenAI from 'openai';
import { OPENAI_CLIENT } from '../providers/openai.provider';

const EMBEDDING_MODEL = 'text-embedding-3-small';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  // Shares the same OPENAI_CLIENT instance as LlmService — never a second client.
  constructor(@Inject(OPENAI_CLIENT) private readonly openai: OpenAI) {}

  /**
   * Embed a single text string.
   * Returns a 1536-dimensional vector (text-embedding-3-small).
   */
  async embed(text: string): Promise<number[]> {
    const start = Date.now();
    try {
      const response = await this.openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text,
      });

      const latencyMs = Date.now() - start;
      this.logger.log(
        `Embedding: model=${EMBEDDING_MODEL} chars=${text.length} latency=${latencyMs}ms`,
      );

      return response.data[0].embedding;
    } catch (error) {
      this.logger.error(
        `Embedding failed after ${Date.now() - start}ms: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Embed multiple texts in a single API call.
   * Preserves input order in the returned vectors.
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const start = Date.now();
    try {
      const response = await this.openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: texts,
      });

      const latencyMs = Date.now() - start;
      const totalChars = texts.reduce((sum, t) => sum + t.length, 0);
      this.logger.log(
        `Embedding batch: model=${EMBEDDING_MODEL} count=${texts.length}` +
          ` totalChars=${totalChars} latency=${latencyMs}ms`,
      );

      // OpenAI returns embeddings in the same order as input
      return response.data
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding);
    } catch (error) {
      this.logger.error(
        `Embedding batch (${texts.length} texts) failed after ${Date.now() - start}ms:` +
          ` ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
