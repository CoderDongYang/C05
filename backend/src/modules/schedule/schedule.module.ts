import { Module } from '@nestjs/common';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';
import { ScheduleTasksService } from './schedule.service';

@Module({
  imports: [NestScheduleModule.forRoot()],
  providers: [ScheduleTasksService],
  exports: [ScheduleTasksService],
})
export class ScheduleModule {}
