import { Module } from '@nestjs/common';
import { SdkService } from './sdk.service';
import { SdkController } from './sdk.controller';
import { RolloutUtil } from '../../common/utils/rollout.util';

@Module({
  controllers: [SdkController],
  providers: [SdkService, RolloutUtil],
  exports: [SdkService],
})
export class SdkModule {}
