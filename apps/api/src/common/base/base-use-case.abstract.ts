import type { UseCaseResponse } from '../responses/use-case-response.interface';

/**
 * Base class for all read/write use cases.
 *
 * Each subclass implements:
 *   - `execute(input)` — the main entry point with business logic.
 *   - A protected `transform(data)` method that maps raw data (entity or DTO)
 *     to the typed output shape. The signature is use-case specific.
 *
 * GenerateWikiUseCase is exempt — it returns Observable<SSEEvent> and does
 * not extend this class.
 */
export abstract class BaseUseCase<TInput, TOutput> {
  abstract execute(input: TInput): Promise<UseCaseResponse<TOutput>>;

  protected ok(data: TOutput, message = 'Success'): UseCaseResponse<TOutput> {
    return { data, statusCode: 200, message };
  }
}
