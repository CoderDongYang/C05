import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { JwtPayload } from '../../common/decorators/get-user.decorator';
import { RoleName } from '../../common/enums/role.enum';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<JwtPayload | null> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { role: true },
    });

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return null;
    }

    const permissions = user.role.permissions as string[];

    return {
      userId: user.id,
      username: user.username,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role.name,
      permissions,
    };
  }

  async login(loginDto: LoginDto): Promise<{ accessToken: string; user: JwtPayload }> {
    const user = await this.validateUser(loginDto.username, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const payload: JwtPayload = {
      userId: user.userId,
      username: user.username,
      email: user.email,
      roleId: user.roleId,
      roleName: user.roleName,
      permissions: user.permissions,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: payload,
    };
  }

  async register(registerDto: RegisterDto): Promise<{ accessToken: string; user: JwtPayload }> {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: registerDto.username },
          { email: registerDto.email },
        ],
      },
    });

    if (existingUser) {
      throw new ConflictException('用户名或邮箱已存在');
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(registerDto.password, saltRounds);

    let roleId = registerDto.roleId;
    if (!roleId) {
      const defaultRole = await this.prisma.role.findUnique({
        where: { name: RoleName.DEVELOPER },
      });
      if (!defaultRole) {
        throw new ConflictException('默认角色不存在，请先初始化数据');
      }
      roleId = defaultRole.id;
    }

    const createdUser = await this.prisma.user.create({
      data: {
        username: registerDto.username,
        email: registerDto.email,
        passwordHash,
        roleId,
      },
      include: { role: true },
    });

    const permissions = createdUser.role.permissions as string[];
    const payload: JwtPayload = {
      userId: createdUser.id,
      username: createdUser.username,
      email: createdUser.email,
      roleId: createdUser.roleId,
      roleName: createdUser.role.name,
      permissions,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: payload,
    };
  }
}
