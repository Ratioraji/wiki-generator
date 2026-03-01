import { Injectable } from '@nestjs/common';

@Injectable()
export class LlmConfigService {
  get model(): string {
    return process.env.LLM_MODEL ?? 'gpt-4o-mini';
  }

  // 5 retries with 2 s base → delays of 2, 4, 8, 16, 32 s (total ~62 s window).
  // For TPM exhaustion the window needs to cover ~60 s; this just fits.
  get maxRetries(): number {
    return 5;
  }

  get retryDelayMs(): number {
    return 2000;
  }

  /** Low temperature — deterministic structured output */
  get temperature(): number {
    return 0.3;
  }

  /** Slightly higher — conversational Q&A */
  get qaTemperature(): number {
    return 0.5;
  }
}
