import { Injectable, Logger } from '@nestjs/common';
import { RedisService, ToggleSnapshot } from '../redis/redis.service';
import { RolloutUtil } from '../../common/utils/rollout.util';
import { Environment } from '../../common/enums/role.enum';
import { AttributeRules } from '../../common/types/attribute-rule.type';

@Injectable()
export class SdkService {
  private readonly logger = new Logger(SdkService.name);

  constructor(
    private redisService: RedisService,
    private rolloutUtil: RolloutUtil,
  ) {}

  async getConfig(
    env: Environment,
    userId?: string,
    tags?: Record<string, unknown>,
  ): Promise<Record<string, boolean>> {
    const result: Record<string, boolean> = {};

    try {
      const snapshot = await this.redisService.getTogglesSnapshot(env);
      const keys = Object.keys(snapshot);

      for (const key of keys) {
        const toggle = snapshot[key] as ToggleSnapshot;
        result[key] = this.rolloutUtil.evaluateToggle(
          {
            isGloballyEnabled: toggle.isGloballyEnabled,
            rolloutPercentage: toggle.rolloutPercentage,
            whitelist: toggle.whitelist,
            attributeRules: toggle.attributeRules as AttributeRules,
          },
          userId,
          tags,
        );
      }
    } catch (e) {
      this.logger.error(`SDK config error: ${e}`);
      return {};
    }

    return result;
  }

  getConfigSync(
    env: Environment,
    userId?: string,
    tags?: Record<string, unknown>,
  ): Record<string, boolean> {
    const result: Record<string, boolean> = {};

    try {
      const snapshot = this.redisService.getTogglesSnapshotSync(env);
      const keys = Object.keys(snapshot);

      for (const key of keys) {
        const toggle = snapshot[key] as ToggleSnapshot;
        result[key] = this.rolloutUtil.evaluateToggle(
          {
            isGloballyEnabled: toggle.isGloballyEnabled,
            rolloutPercentage: toggle.rolloutPercentage,
            whitelist: toggle.whitelist,
            attributeRules: toggle.attributeRules as AttributeRules,
          },
          userId,
          tags,
        );
      }
    } catch (e) {
      this.logger.error(`SDK config sync error: ${e}`);
      return {};
    }

    return result;
  }
}
