import {
  Controller,
  Get,
  Query,
  Post,
  Body,
  Logger,
} from '@nestjs/common';
import { SdkService } from './sdk.service';
import { GetConfigDto } from './dto/sdk.dto';
import { Environment } from '../../common/enums/role.enum';

@Controller('api/sdk')
export class SdkController {
  private readonly logger = new Logger(SdkController.name);

  constructor(private readonly sdkService: SdkService) {}

  @Get('config')
  async getConfig(
    @Query('env') env: Environment,
    @Query('userId') userId?: string,
    @Query('tags') tags?: string,
  ) {
    let parsedTags: Record<string, unknown> | undefined;
    if (tags) {
      try {
        parsedTags = JSON.parse(tags) as Record<string, unknown>;
      } catch (e) {
        this.logger.warn(`Failed to parse tags query param: ${tags}`);
      }
    }
    return this.sdkService.getConfig(env, userId, parsedTags);
  }

  @Post('config')
  async getConfigPost(@Body() dto: GetConfigDto) {
    return this.sdkService.getConfig(dto.env, dto.userId, dto.tags);
  }
}
