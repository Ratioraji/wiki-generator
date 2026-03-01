import { Injectable, Inject, Logger } from '@nestjs/common';
// APIError is a class (value), so not import type — needed for instanceof checks.
// OpenAI is imported as type only: the constructor param is injected via token,
// so emitDecoratorMetadata never needs OpenAI as a runtime reference.
import type OpenAI from 'openai';
import { APIError, APIConnectionTimeoutError } from 'openai';
import { OPENAI_CLIENT } from '../providers/openai.provider';
import { LlmConfigService } from './llm-config.service';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LlmCallOptions {
  temperature?: number;
  maxTokens?: number;
}

// Status codes that should NOT be retried
const NO_RETRY_STATUSES = new Set([400, 401, 404]);

// Status codes that should be retried
const RETRY_STATUSES = new Set([429, 500, 502, 503, 529]);

// Minimum wait when TPM (tokens-per-minute) is exhausted — the whole
// 60-second window needs to drain before the budget is replenished.
const TPM_MIN_WAIT_MS = 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof APIConnectionTimeoutError) return true;
  if (error instanceof APIError) {
    if (NO_RETRY_STATUSES.has(error.status)) return false;
    return RETRY_STATUSES.has(error.status);
  }
  return false;
}

/**
 * Read the Retry-After header from a 429 APIError.
 * OpenAI sends either a float seconds value (e.g. "0.494") or an integer.
 * Returns 0 when the header is absent.
 */
function retryAfterMs(error: APIError): number {
  const raw =
    typeof error.headers?.['retry-after'] === 'string'
      ? error.headers['retry-after']
      : null;
  if (!raw) return 0;
  const secs = parseFloat(raw);
  return Number.isFinite(secs) ? Math.ceil(secs * 1000) : 0;
}

/**
 * True when the 429 is a tokens-per-minute exhaustion (not requests-per-minute).
 * TPM exhaustion requires waiting for the full rolling window to drain;
 * RPM exhaustion resets much faster and the normal backoff is sufficient.
 */
function isTpmExhausted(error: APIError): boolean {
  return typeof error.message === 'string' && error.message.includes('tokens per min');
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    @Inject(OPENAI_CLIENT) private readonly openai: OpenAI,
    private readonly config: LlmConfigService,
  ) {}

  /**
   * Call the LLM and parse the response as structured JSON matching type T.
   *
   * - Uses response_format: { type: 'json_object' }
   * - Retries up to config.maxRetries times with exponential backoff
   * - Logs model + token usage + latency (never logs prompt content)
   */
  async generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    options?: LlmCallOptions,
  ): Promise<T> {
    const totalAttempts = this.config.maxRetries + 1; // 1 initial + 3 retries = 4

    let lastError: unknown;

    for (let attempt = 1; attempt <= totalAttempts; attempt++) {
      const start = Date.now();
      try {
        const completion = await this.openai.chat.completions.create({
          model: this.config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: options?.temperature ?? this.config.temperature,
          ...(options?.maxTokens ? { max_tokens: options.maxTokens } : {}),
        });

        const latencyMs = Date.now() - start;
        const usage = completion.usage;

        this.logger.log(
          `LLM [structured] model=${this.config.model}` +
            ` input=${usage?.prompt_tokens ?? '?'}` +
            ` output=${usage?.completion_tokens ?? '?'}` +
            ` latency=${latencyMs}ms` +
            (attempt > 1 ? ` attempt=${attempt}` : ''),
        );

        // Detect truncated output before attempting to parse.
        // finish_reason === 'length' means the model ran out of max_tokens
        // and the JSON is cut mid-string — parsing would always fail.
        const choice = completion.choices[0];
        if (choice?.finish_reason === 'length') {
          throw new Error(
            `LLM output truncated (finish_reason=length): increase TOKEN_BUDGETS for this call`,
          );
        }

        const content = choice?.message?.content;
        if (!content) {
          throw new Error('LLM returned empty content');
        }

        return JSON.parse(content) as T;
      } catch (error) {
        lastError = error;
        const latencyMs = Date.now() - start;

        if (!isRetryableError(error)) {
          this.logger.error(
            `LLM [structured] non-retryable error after ${latencyMs}ms: ${(error as Error).message}`,
          );
          throw error;
        }

        if (attempt === totalAttempts) break;

        // For 429s: honour the Retry-After header when present, and use
        // a full-minute minimum wait when TPM (not RPM) is exhausted.
        let delayMs = this.config.retryDelayMs * Math.pow(2, attempt - 1);
        if (error instanceof APIError && error.status === 429) {
          const suggested = retryAfterMs(error);
          const tpmFloor = isTpmExhausted(error) ? TPM_MIN_WAIT_MS : 0;
          delayMs = Math.max(delayMs, suggested, tpmFloor);
        }

        this.logger.warn(
          `LLM [structured] attempt ${attempt}/${totalAttempts} failed` +
            ` (${(error as APIError).status ?? 'timeout'})` +
            ` — retrying in ${delayMs}ms`,
        );
        await sleep(delayMs);
      }
    }

    this.logger.error(
      `LLM [structured] all ${totalAttempts} attempts exhausted`,
    );
    throw lastError;
  }

  /**
   * Call the LLM and return the plain-text response string.
   * Same retry + logging behaviour as generateStructured.
   */
  async generateText(
    systemPrompt: string,
    userPrompt: string,
    options?: LlmCallOptions,
  ): Promise<string> {
    const totalAttempts = this.config.maxRetries + 1;

    let lastError: unknown;

    for (let attempt = 1; attempt <= totalAttempts; attempt++) {
      const start = Date.now();
      try {
        const completion = await this.openai.chat.completions.create({
          model: this.config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: options?.temperature ?? this.config.temperature,
          ...(options?.maxTokens ? { max_tokens: options.maxTokens } : {}),
        });

        const latencyMs = Date.now() - start;
        const usage = completion.usage;

        this.logger.log(
          `LLM [text] model=${this.config.model}` +
            ` input=${usage?.prompt_tokens ?? '?'}` +
            ` output=${usage?.completion_tokens ?? '?'}` +
            ` latency=${latencyMs}ms` +
            (attempt > 1 ? ` attempt=${attempt}` : ''),
        );

        return completion.choices[0]?.message?.content ?? '';
      } catch (error) {
        lastError = error;
        const latencyMs = Date.now() - start;

        if (!isRetryableError(error)) {
          this.logger.error(
            `LLM [text] non-retryable error after ${latencyMs}ms: ${(error as Error).message}`,
          );
          throw error;
        }

        if (attempt === totalAttempts) break;

        let delayMs = this.config.retryDelayMs * Math.pow(2, attempt - 1);
        if (error instanceof APIError && error.status === 429) {
          const suggested = retryAfterMs(error);
          const tpmFloor = isTpmExhausted(error) ? TPM_MIN_WAIT_MS : 0;
          delayMs = Math.max(delayMs, suggested, tpmFloor);
        }

        this.logger.warn(
          `LLM [text] attempt ${attempt}/${totalAttempts} failed` +
            ` (${(error as APIError).status ?? 'timeout'})` +
            ` — retrying in ${delayMs}ms`,
        );
        await sleep(delayMs);
      }
    }

    this.logger.error(`LLM [text] all ${totalAttempts} attempts exhausted`);
    throw lastError;
  }
}
