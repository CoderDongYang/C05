import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    const errorDetails =
      exception instanceof HttpException
        ? (exception.getResponse() as { message?: string[] | string; error?: string })
        : null;

    const errorMessage = Array.isArray(errorDetails?.message)
      ? errorDetails!.message!.join(', ')
      : errorDetails?.message || message;

    this.logger.error(
      `${request.method} ${request.url} ${status} - ${errorMessage}`,
      exception instanceof Error ? exception.stack : '',
    );

    response.status(status).json({
      code: status,
      message: errorMessage,
      data: null,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
