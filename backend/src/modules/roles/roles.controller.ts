import {
  Controller,
  Get,
  Param,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesService } from './roles.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RoleName } from '../../common/enums/role.enum';

@Controller('api/roles')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Roles(RoleName.ADMIN)
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @Roles(RoleName.ADMIN)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.findOne(id);
  }
}
