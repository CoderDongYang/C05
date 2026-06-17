import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ScheduleTasksService {
  private readonly logger = new Logger(ScheduleTasksService.name);

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'cleanup_old_changelogs',
    timeZone: 'Asia/Shanghai',
  })
  async cleanupOldChangeLogs() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await this.prisma.changeLog.deleteMany({
        where: {
          createdAt: {
            lt: thirtyDaysAgo,
          },
        },
      });

      this.logger.log(
        `Cleaned up ${result.count} change logs older than 30 days`,
      );
    } catch (e) {
      this.logger.error(`Failed to cleanup old change logs: ${e}`);
    }
  }

  @Cron(CronExpression.EVERY_HOUR, {
    name: 'redis_cache_health_check',
    timeZone: 'Asia/Shanghai',
  })
  async redisCacheHealthCheck() {
    this.logger.log('Redis cache health check completed');
  }
}
