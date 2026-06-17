import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  timestamp: string;
  path: string;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  private readonly logger = new Logger(ResponseInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest();
    const path = request.url;
    const method = request.method;
    const now = Date.now();

    return next.handle().pipe(
      map((data) => {
        const duration = Date.now() - now;
        this.logger.log(
          `${method} ${path} ${context.switchToHttp().getResponse().statusCode} - ${duration}ms`,
        );
        return {
          code: 0,
          message: 'success',
          data,
          timestamp: new Date().toISOString(),
          path,
        };
      }),
    );
  }
}
