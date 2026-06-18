import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FeatureTogglesService } from './feature-toggles.service';
import {
  CreateFeatureToggleDto,
  UpdateFeatureToggleDto,
  QueryFeatureToggleDto,
  DebugPreviewDto,
} from './dto/feature-toggle.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Permissions } from '../../common/decorators/roles.decorator';
import { Permission } from '../../common/enums/role.enum';
import { GetUser, JwtPayload } from '../../common/decorators/get-user.decorator';

@Controller('api/feature-toggles')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class FeatureTogglesController {
  constructor(private readonly featureTogglesService: FeatureTogglesService) {}

  @Get()
  @Permissions(Permission.FEATURE_READ)
  findAll(@Query() query: QueryFeatureToggleDto) {
    return this.featureTogglesService.findAll(query);
  }

  @Get(':id')
  @Permissions(Permission.FEATURE_READ)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.featureTogglesService.findOne(id);
  }

  @Post()
  @Permissions(Permission.FEATURE_WRITE_DEV)
  create(
    @GetUser() user: JwtPayload,
    @Body() createFeatureToggleDto: CreateFeatureToggleDto,
  ) {
    return this.featureTogglesService.create(user, createFeatureToggleDto);
  }

  @Put(':id')
  @Permissions(Permission.FEATURE_READ)
  update(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: JwtPayload,
    @Body() updateFeatureToggleDto: UpdateFeatureToggleDto,
  ) {
    return this.featureTogglesService.update(id, user, updateFeatureToggleDto);
  }

  @Delete(':id')
  @Permissions(Permission.FEATURE_WRITE_DEV)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: JwtPayload,
  ) {
    return this.featureTogglesService.remove(id, user);
  }

  @Post('debug-preview')
  @Permissions(Permission.FEATURE_READ)
  debugPreview(@Body() dto: DebugPreviewDto) {
    return this.featureTogglesService.debugPreview(dto);
  }
}
