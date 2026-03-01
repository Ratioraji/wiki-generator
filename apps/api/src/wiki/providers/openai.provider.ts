import type { Provider } from '@nestjs/common';
import OpenAI from 'openai';

export const OPENAI_CLIENT = 'OPENAI_CLIENT';

export const OpenAIProvider: Provider = {
  provide: OPENAI_CLIENT,
  useFactory: (): OpenAI => {
    return new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      // Disable the SDK's built-in retry so LlmService has full control
      // over backoff strategy (including TPM-aware delays).
      maxRetries: 0,
    });
  },
};
