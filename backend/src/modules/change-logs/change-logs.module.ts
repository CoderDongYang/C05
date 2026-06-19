import { Module } from '@nestjs/common';
import { ChangeLogsService } from './change-logs.service';
import { ChangeLogsController } from './change-logs.controller';
import { SseModule } from '../sse/sse.module';

@Module({
  imports: [SseModule],
  controllers: [ChangeLogsController],
  providers: [ChangeLogsService],
  exports: [ChangeLogsService],
})
export class ChangeLogsModule {}
