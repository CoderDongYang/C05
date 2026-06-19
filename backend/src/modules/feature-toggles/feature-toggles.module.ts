import { Module } from '@nestjs/common';
import { FeatureTogglesService } from './feature-toggles.service';
import { FeatureTogglesController } from './feature-toggles.controller';
import { RolloutUtil } from '../../common/utils/rollout.util';
import { SseModule } from '../sse/sse.module';

@Module({
  imports: [SseModule],
  controllers: [FeatureTogglesController],
  providers: [FeatureTogglesService, RolloutUtil],
  exports: [FeatureTogglesService],
})
export class FeatureTogglesModule {}
