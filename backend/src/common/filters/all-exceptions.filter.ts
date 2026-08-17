import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponseBody {
  statusCode: number;
  message: string;
  errors?: string[];
  path: string;
  timestamp: string;
  requestId: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message, errors } = this.resolveException(exception);

    if (statusCode === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorResponseBody = {
      statusCode,
      message,
      ...(errors ? { errors } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
      requestId: request.requestId,
    };

    response.status(statusCode).json(body);
  }

  private resolveException(exception: unknown): {
    statusCode: number;
    message: string;
    errors?: string[];
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === 'string') {
        return { statusCode: status, message: payload };
      }

      const payloadObj = payload as { message?: unknown; error?: unknown };

      if (Array.isArray(payloadObj.message)) {
        return {
          statusCode: status,
          message:
            typeof payloadObj.error === 'string'
              ? payloadObj.error
              : exception.message,
          errors: payloadObj.message as string[],
        };
      }

      return {
        statusCode: status,
        message:
          typeof payloadObj.message === 'string'
            ? payloadObj.message
            : exception.message,
      };
    }

    // Unknown error: never leak internal detail to the client.
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };
  }
}