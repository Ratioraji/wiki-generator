import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';

interface ValidationErrorBody {
  statusCode: number;
  message: string;
  errors?: string[];
}

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const body = exception.getResponse() as ValidationErrorBody | string;

    const isValidationBody =
      typeof body === 'object' && Array.isArray((body as ValidationErrorBody).errors);

    if (isValidationBody) {
      const validationBody = body as ValidationErrorBody;
      response.status(status).json({
        success: false,
        statusCode: status,
        message: validationBody.message ?? 'Validation failed',
        errors: validationBody.errors,
      });
    } else {
      // Not a validation error — let it fall through to HttpExceptionFilter
      const message =
        typeof body === 'string' ? body : (body as ValidationErrorBody).message;
      response.status(status).json({
        success: false,
        statusCode: status,
        message,
      });
    }
  }
}
