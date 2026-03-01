import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type {
  UseCaseResponse,
  ApiResponse,
} from '../responses/use-case-response.interface';

function isUseCaseResponse<T>(value: unknown): value is UseCaseResponse<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    'statusCode' in value &&
    'message' in value
  );
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<UseCaseResponse<T>, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((response) => {
        if (!isUseCaseResponse<T>(response)) {
          return response as unknown as ApiResponse<T>;
        }

        const httpResponse = context.switchToHttp().getResponse<{
          status: (code: number) => void;
        }>();
        httpResponse.status(response.statusCode);

        const apiResponse: ApiResponse<T> = {
          success: response.statusCode < 400,
          data: response.data,
          statusCode: response.statusCode,
          message: response.message,
        };

        if (response.meta !== undefined) {
          apiResponse.meta = response.meta;
        }

        return apiResponse;
      }),
    );
  }
}
