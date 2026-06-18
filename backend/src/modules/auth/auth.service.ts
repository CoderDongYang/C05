import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { JwtPayload } from '../../common/decorators/get-user.decorator';
import { RoleName } from '../../common/enums/role.enum';
import { ROLE_PERMISSIONS } from '../../common/config/permissions.config';

const MOCK_USERS = [
  {
    id: 1,
    username: 'admin',
    email: 'admin@example.com',
    roleId: 1,
    roleName: RoleName.ADMIN,
    permissions: ROLE_PERMISSIONS[RoleName.ADMIN],
    password: 'admin123',
  },
  {
    id: 2,
    username: 'dev',
    email: 'dev@example.com',
    roleId: 2,
    roleName: RoleName.DEVELOPER,
    permissions: ROLE_PERMISSIONS[RoleName.DEVELOPER],
    password: 'dev123',
  },
  {
    id: 3,
    username: 'tester',
    email: 'tester@example.com',
    roleId: 3,
    roleName: RoleName.TESTER,
    permissions: ROLE_PERMISSIONS[RoleName.TESTER],
    password: 'test123',
  },
  {
    id: 4,
    username: 'pm',
    email: 'pm@example.com',
    roleId: 4,
    roleName: RoleName.PRODUCT_MANAGER,
    permissions: ROLE_PERMISSIONS[RoleName.PRODUCT_MANAGER],
    password: 'pm123',
  },
];

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<JwtPayload | null> {
    if (!this.prisma.getIsConnected()) {
      this.logger.warn('DB not connected, using mock users for validation');
      const mockUser = MOCK_USERS.find(
        (u) => u.username === username && u.password === password,
      );
      if (mockUser) {
        return {
          userId: mockUser.id,
          username: mockUser.username,
          email: mockUser.email,
          roleId: mockUser.roleId,
          roleName: mockUser.roleName,
          permissions: mockUser.permissions,
        };
      }
      return null;
    }

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

    const permissions = ROLE_PERMISSIONS[user.role.name as RoleName] || [];

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
