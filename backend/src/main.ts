import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const port = parseInt(process.env.PORT || '3000', 10);

  const app = await NestFactory.create(AppModule, {
    cors: true,
  });

  app.setGlobalPrefix('');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(port);
  logger.log(`🚀 Feature Toggle Backend is running on http://localhost:${port}`);
  logger.log(`📚 API Docs prefix: /api/*`);
}

bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
