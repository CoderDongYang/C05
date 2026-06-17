import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RedisModule } from './modules/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { FeatureTogglesModule } from './modules/feature-toggles/feature-toggles.module';
import { ChangeLogsModule } from './modules/change-logs/change-logs.module';
import { SdkModule } from './modules/sdk/sdk.module';
import { SseModule } from './modules/sse/sse.module';
import { ScheduleModule } from './modules/schedule/schedule.module';
import { RedisService } from './modules/redis/redis.service';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    RolesModule,
    FeatureTogglesModule,
    ChangeLogsModule,
    SdkModule,
    SseModule,
    ScheduleModule,
  ],
})
export class AppModule implements OnModuleInit {
  private readonly logger = new Logger(AppModule.name);

  constructor(private redisService: RedisService) {}

  async onModuleInit() {
    try {
      await this.redisService.refreshCacheFromDb();
      this.logger.log('Initial Redis cache loaded from DB');
    } catch (e) {
      this.logger.error(`Failed to load initial cache: ${e}`);
    }
  }
}
