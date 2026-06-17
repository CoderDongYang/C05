import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis, { Redis as RedisType } from 'ioredis';
import { Environment } from '../../common/enums/role.enum';
import { PrismaService } from '../prisma/prisma.service';

export const REDIS_TOGGLES_PREFIX = 'feature-toggles:';
export const REDIS_UPDATE_CHANNEL = 'feature-toggles:update';

export interface ToggleSnapshot {
  id: number;
  key: string;
  description: string | null;
  isGloballyEnabled: boolean;
  rolloutPercentage: number;
  whitelist: string[];
  attributeRules: Record<string, unknown>;
}

interface EnvTogglesSnapshot {
  [key: string]: ToggleSnapshot;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisType | null = null;
  private subscriber: RedisType | null = null;
  private localCache = new Map<Environment, EnvTogglesSnapshot>();

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
      this.subscriber = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });

      this.client.on('error', (err) => {
        this.logger.error(`Redis client error: ${err.message}`);
      });

      this.subscriber.on('error', (err) => {
        this.logger.error(`Redis subscriber error: ${err.message}`);
      });

      this.subscriber.on('message', (channel, message) => {
        if (channel === REDIS_UPDATE_CHANNEL) {
          try {
            const { environment } = JSON.parse(message) as { environment: Environment };
            this.logger.log(`Received cache update signal for env: ${environment}`);
            this.refreshLocalCache(environment);
          } catch (e) {
            this.logger.error(`Failed to parse update message: ${e}`);
          }
        }
      });

      await this.subscriber.subscribe(REDIS_UPDATE_CHANNEL);
      this.logger.log('Redis service initialized');
    } catch (e) {
      this.logger.error(`Failed to initialize Redis: ${e}`);
    }
  }

  async onModuleDestroy() {
    await this.client?.quit();
    await this.subscriber?.quit();
  }

  getClient(): RedisType | null {
    return this.client;
  }

  private getTogglesKey(env: Environment): string {
    return `${REDIS_TOGGLES_PREFIX}${env}`;
  }

  async refreshCacheFromDb(): Promise<void> {
    try {
      const environments = [Environment.DEV, Environment.STAGING, Environment.PROD];
      for (const env of environments) {
        await this.refreshCacheForEnvironment(env);
      }
      this.logger.log('All environment caches refreshed from DB');
    } catch (e) {
      this.logger.error(`Failed to refresh cache from DB: ${e}`);
    }
  }

  async refreshCacheForEnvironment(environment: Environment): Promise<void> {
    try {
      const toggles = await this.prisma.featureToggle.findMany({
        where: { environment },
        select: {
          id: true,
          key: true,
          description: true,
          isGloballyEnabled: true,
          rolloutPercentage: true,
          whitelist: true,
          attributeRules: true,
        },
      });

      const snapshot: EnvTogglesSnapshot = {};
      for (const toggle of toggles) {
        snapshot[toggle.key] = {
          id: toggle.id,
          key: toggle.key,
          description: toggle.description,
          isGloballyEnabled: toggle.isGloballyEnabled,
          rolloutPercentage: toggle.rolloutPercentage,
          whitelist: (toggle.whitelist as string[]) || [],
          attributeRules: (toggle.attributeRules as Record<string, unknown>) || {},
        };
      }

      if (this.client) {
        await this.client.set(
          this.getTogglesKey(environment),
          JSON.stringify(snapshot),
        );
      }

      this.localCache.set(environment, snapshot);
      this.logger.log(`Cache refreshed for ${environment}: ${toggles.length} toggles`);
    } catch (e) {
      this.logger.error(`Failed to refresh cache for ${environment}: ${e}`);
      throw e;
    }
  }

  async refreshLocalCache(environment: Environment): Promise<void> {
    try {
      if (this.client) {
        const data = await this.client.get(this.getTogglesKey(environment));
        if (data) {
          this.localCache.set(environment, JSON.parse(data));
          this.logger.log(`Local cache refreshed for ${environment}`);
        }
      }
    } catch (e) {
      this.logger.error(`Failed to refresh local cache: ${e}`);
    }
  }

  async getTogglesSnapshot(environment: Environment): Promise<EnvTogglesSnapshot> {
    try {
      const local = this.localCache.get(environment);
      if (local) {
        return local;
      }

      if (this.client) {
        const data = await this.client.get(this.getTogglesKey(environment));
        if (data) {
          const parsed = JSON.parse(data) as EnvTogglesSnapshot;
          this.localCache.set(environment, parsed);
          return parsed;
        }
      }

      return {};
    } catch (e) {
      this.logger.error(`Redis error in getTogglesSnapshot: ${e}`);
      return this.localCache.get(environment) || {};
    }
  }

  getTogglesSnapshotSync(environment: Environment): EnvTogglesSnapshot {
    return this.localCache.get(environment) || {};
  }

  async publishUpdate(environment: Environment): Promise<void> {
    try {
      await this.refreshCacheForEnvironment(environment);
      if (this.client) {
        await this.client.publish(
          REDIS_UPDATE_CHANNEL,
          JSON.stringify({ environment }),
        );
      }
      this.logger.log(`Published update notification for ${environment}`);
    } catch (e) {
      this.logger.error(`Failed to publish update: ${e}`);
    }
  }
}
