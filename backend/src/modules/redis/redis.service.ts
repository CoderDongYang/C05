import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis, { Redis as RedisType } from 'ioredis';
import { Environment } from '../../common/enums/role.enum';
import { PrismaService } from '../prisma/prisma.service';

export const REDIS_TOGGLES_PREFIX = 'feature-toggles:';
export const REDIS_UPDATE_CHANNEL = 'feature-toggles:update';

export type ToggleChangeAction = 'enable' | 'disable' | 'create' | 'update' | 'delete';

export interface ToggleChangePayload {
  toggleId: number;
  toggleKey: string;
  environment: Environment;
  action: ToggleChangeAction;
  operatorId: number;
  operatorName: string;
  oldEnabled?: boolean;
  newEnabled?: boolean;
  timestamp: string;
}

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
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        connectTimeout: 2000,
        commandTimeout: 2000,
        lazyConnect: true,
      });
      this.subscriber = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        connectTimeout: 2000,
        commandTimeout: 2000,
        lazyConnect: true,
      });

      this.client.on('error', (err) => {
        this.logger.warn(`Redis client error: ${err.message}`);
      });

      this.subscriber.on('error', (err) => {
        this.logger.warn(`Redis subscriber error: ${err.message}`);
      });

      this.subscriber.on('message', (channel, message) => {
        if (channel === REDIS_UPDATE_CHANNEL) {
          try {
            const parsed = JSON.parse(message) as ToggleChangePayload;
            this.logger.log(`Received cache update signal for env: ${parsed.environment}`);
            this.refreshLocalCache(parsed.environment);
          } catch (e) {
            this.logger.error(`Failed to parse update message: ${e}`);
          }
        }
      });

      try {
        await Promise.race([
          this.client.connect(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Redis client connect timeout')), 2000)),
        ]);
        await Promise.race([
          this.subscriber.connect(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Redis subscriber connect timeout')), 2000)),
        ]);
        await this.subscriber.subscribe(REDIS_UPDATE_CHANNEL);
        this.logger.log('Redis service initialized');
      } catch (connectErr) {
        this.logger.warn(`Redis connection failed, running in local-only mode: ${connectErr}`);
        this.client = null;
        this.subscriber = null;
      }
    } catch (e) {
      this.logger.warn(`Redis initialization failed, running in local-only mode: ${e}`);
      this.client = null;
      this.subscriber = null;
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
      if (!this.prisma.getIsConnected()) {
        const emptySnapshot: EnvTogglesSnapshot = {};
        this.localCache.set(environment, emptySnapshot);
        this.logger.warn(`DB not connected, using empty snapshot for ${environment}`);
        return;
      }

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
        try {
          await this.client.set(
            this.getTogglesKey(environment),
            JSON.stringify(snapshot),
          );
        } catch (redisErr) {
          this.logger.warn(`Failed to set Redis cache for ${environment}: ${redisErr}`);
        }
      }

      this.localCache.set(environment, snapshot);
      this.logger.log(`Cache refreshed for ${environment}: ${toggles.length} toggles`);
    } catch (e) {
      this.logger.warn(`Failed to refresh cache for ${environment}, using empty snapshot: ${e}`);
      const emptySnapshot: EnvTogglesSnapshot = {};
      this.localCache.set(environment, emptySnapshot);
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

  async publishUpdate(payload: ToggleChangePayload): Promise<void> {
    try {
      await this.refreshCacheForEnvironment(payload.environment);
      if (this.client) {
        await this.client.publish(
          REDIS_UPDATE_CHANNEL,
          JSON.stringify(payload),
        );
      }
      this.logger.log(`Published update notification for ${payload.environment}: ${payload.toggleKey} ${payload.action} by ${payload.operatorName}`);
    } catch (e) {
      this.logger.error(`Failed to publish update: ${e}`);
    }
  }
}
