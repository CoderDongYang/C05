import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  username: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  roleId: number;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  roleId?: number;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: pageSize,
        select: {
          id: true,
          username: true,
          email: true,
          roleId: true,
          role: { select: { id: true, name: true, description: true } },
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);
    return { users, total, page, pageSize };
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        roleId: true,
        role: { select: { id: true, name: true, description: true, permissions: true } },
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    return user;
  }

  async create(createUserDto: CreateUserDto) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: createUserDto.username }, { email: createUserDto.email }],
      },
    });
    if (existing) {
      throw new ConflictException('用户名或邮箱已存在');
    }

    const passwordHash = await bcrypt.hash(createUserDto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        username: createUserDto.username,
        email: createUserDto.email,
        passwordHash,
        roleId: createUserDto.roleId,
      },
      select: {
        id: true,
        username: true,
        email: true,
        roleId: true,
        role: { select: { id: true, name: true, description: true } },
        createdAt: true,
        updatedAt: true,
      },
    });
    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const data: Record<string, unknown> = {};
    if (updateUserDto.username !== undefined) data.username = updateUserDto.username;
    if (updateUserDto.email !== undefined) data.email = updateUserDto.email;
    if (updateUserDto.roleId !== undefined) data.roleId = updateUserDto.roleId;
    if (updateUserDto.password !== undefined) {
      data.passwordHash = await bcrypt.hash(updateUserDto.password, 10);
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        username: true,
        email: true,
        roleId: true,
        role: { select: { id: true, name: true, description: true } },
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    await this.prisma.user.delete({ where: { id } });
    return { success: true };
  }
}
