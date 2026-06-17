import { Module } from '@nestjs/common';
import { ChangeLogsService } from './change-logs.service';
import { ChangeLogsController } from './change-logs.controller';

@Module({
  controllers: [ChangeLogsController],
  providers: [ChangeLogsService],
  exports: [ChangeLogsService],
})
export class ChangeLogsModule {}
