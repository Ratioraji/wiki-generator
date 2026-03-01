import { Injectable } from '@nestjs/common';

@Injectable()
export class LlmConfigService {
  get model(): string {
    return process.env.LLM_MODEL ?? 'gpt-4o-mini';
  }

  get maxRetries(): number {
    return 3;
  }

  get retryDelayMs(): number {
    return 1000;
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
