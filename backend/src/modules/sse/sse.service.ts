import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { Redis } from 'ioredis';
import { REDIS_UPDATE_CHANNEL } from '../redis/redis.service';

export interface SseMessage {
  type: 'refresh' | 'ping';
  data: Record<string, unknown>;
  timestamp: string;
}

@Injectable()
export class SseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SseService.name);
  private readonly subjects = new Set<Subject<SseMessage>>();
  private subscriber: Redis | null = null;
  private pingInterval: NodeJS.Timeout | null = null;

  async onModuleInit() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      this.subscriber = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        connectTimeout: 2000,
        commandTimeout: 2000,
        lazyConnect: true,
      });

      this.subscriber.on('error', (err) => {
        this.logger.warn(`SSE Redis subscriber error: ${err.message}`);
      });

      this.subscriber.on('message', (channel, message) => {
        if (channel === REDIS_UPDATE_CHANNEL) {
          try {
            const parsed = JSON.parse(message) as { environment: string };
            this.broadcast({
              type: 'refresh',
              data: { environment: parsed.environment },
              timestamp: new Date().toISOString(),
            });
          } catch (e) {
            this.logger.error(`Failed to parse SSE message: ${e}`);
          }
        }
      });

      try {
        await Promise.race([
          this.subscriber.connect(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('SSE Redis connect timeout')), 2000)),
        ]);
        await this.subscriber.subscribe(REDIS_UPDATE_CHANNEL);
        this.logger.log('SSE service initialized with Redis');
      } catch (connectErr) {
        this.logger.warn(`SSE Redis connection failed, running without Redis: ${connectErr}`);
        if (this.subscriber) {
          this.subscriber.disconnect();
        }
        this.subscriber = null;
      }
    } catch (e) {
      this.logger.warn(`SSE Redis initialization failed, running without Redis: ${e}`);
      if (this.subscriber) {
        this.subscriber.disconnect();
      }
      this.subscriber = null;
    }

    this.pingInterval = setInterval(() => {
      this.broadcast({
        type: 'ping',
        data: {},
        timestamp: new Date().toISOString(),
      });
    }, 30000);
  }

  async onModuleDestroy() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    await this.subscriber?.quit();
    this.subjects.forEach((s) => s.complete());
    this.subjects.clear();
  }

  subscribe(): Observable<SseMessage> {
    const subject = new Subject<SseMessage>();
    this.subjects.add(subject);

    subject.subscribe({
      complete: () => {
        this.subjects.delete(subject);
      },
      error: () => {
        this.subjects.delete(subject);
      },
    });

    return subject.asObservable();
  }

  broadcast(message: SseMessage): void {
    this.subjects.forEach((subject) => {
      try {
        subject.next(message);
      } catch (e) {
        this.logger.error(`Failed to broadcast to SSE client: ${e}`);
      }
    });
  }
}
