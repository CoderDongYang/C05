import {
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ChangeLogsService } from './change-logs.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Permissions } from '../../common/decorators/roles.decorator';
import { Permission } from '../../common/enums/role.enum';
import { GetUser, JwtPayload } from '../../common/decorators/get-user.decorator';

@Controller('api/change-logs')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ChangeLogsController {
  constructor(private readonly changeLogsService: ChangeLogsService) {}

  @Get()
  @Permissions(Permission.CHANGELOG_READ)
  findAll(
    @Query('page', ParseIntPipe) page = 1,
    @Query('pageSize', ParseIntPipe) pageSize = 20,
  ) {
    return this.changeLogsService.findAll(page, pageSize);
  }

  @Get('toggle/:toggleId')
  @Permissions(Permission.CHANGELOG_READ)
  findByToggleId(
    @Param('toggleId', ParseIntPipe) toggleId: number,
    @Query('page', ParseIntPipe) page = 1,
    @Query('pageSize', ParseIntPipe) pageSize = 20,
  ) {
    return this.changeLogsService.findByToggleId(toggleId, page, pageSize);
  }

  @Post(':id/rollback')
  @Permissions(Permission.CHANGELOG_ROLLBACK)
  rollback(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: JwtPayload,
  ) {
    return this.changeLogsService.rollback(id, user);
  }
}
