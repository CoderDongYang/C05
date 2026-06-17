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
import { UsersService, CreateUserDto, UpdateUserDto } from './users.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RoleName } from '../../common/enums/role.enum';

@Controller('api/users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(RoleName.ADMIN)
  findAll(
    @Query('page', ParseIntPipe) page = 1,
    @Query('pageSize', ParseIntPipe) pageSize = 20,
  ) {
    return this.usersService.findAll(page, pageSize);
  }

  @Get(':id')
  @Roles(RoleName.ADMIN)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Post()
  @Roles(RoleName.ADMIN)
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Put(':id')
  @Roles(RoleName.ADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(RoleName.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
