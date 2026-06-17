import { Module } from '@nestjs/common';
import { FeatureTogglesService } from './feature-toggles.service';
import { FeatureTogglesController } from './feature-toggles.controller';
import { RolloutUtil } from '../../common/utils/rollout.util';

@Module({
  controllers: [FeatureTogglesController],
  providers: [FeatureTogglesService, RolloutUtil],
  exports: [FeatureTogglesService],
})
export class FeatureTogglesModule {}
