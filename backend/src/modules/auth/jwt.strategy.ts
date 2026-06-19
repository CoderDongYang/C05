import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../../common/decorators/get-user.decorator';
import { RoleName } from '../../common/enums/role.enum';
import { ROLE_PERMISSIONS } from '../../common/config/permissions.config';
import { Request } from 'express';

const extractJwtFromRequest = (req: Request): string | null => {
  const headerToken = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
  if (headerToken) {
    return headerToken;
  }
  if (req.query && typeof req.query.token === 'string') {
    return req.query.token;
  }
  return null;
};

const MOCK_USERS = [
  { id: 1, username: 'admin', email: 'admin@example.com', roleId: 1, roleName: RoleName.ADMIN, permissions: ROLE_PERMISSIONS[RoleName.ADMIN] },
  { id: 2, username: 'dev', email: 'dev@example.com', roleId: 2, roleName: RoleName.DEVELOPER, permissions: ROLE_PERMISSIONS[RoleName.DEVELOPER] },
  { id: 3, username: 'tester', email: 'tester@example.com', roleId: 3, roleName: RoleName.TESTER, permissions: ROLE_PERMISSIONS[RoleName.TESTER] },
  { id: 4, username: 'pm', email: 'pm@example.com', roleId: 4, roleName: RoleName.PRODUCT_MANAGER, permissions: ROLE_PERMISSIONS[RoleName.PRODUCT_MANAGER] },
];

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: extractJwtFromRequest,
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'default-secret-key-change-in-prod',
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (!this.prisma.getIsConnected()) {
      this.logger.warn('DB not connected, using mock user from JWT payload');
      return {
        userId: payload.userId,
        username: payload.username,
        email: payload.email,
        roleId: payload.roleId,
        roleName: payload.roleName,
        permissions: payload.permissions,
      };
    }

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        include: {
          role: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException('用户不存在或已被删除');
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
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      this.logger.warn(`DB query failed in JWT validate, using JWT payload: ${e}`);
      return {
        userId: payload.userId,
        username: payload.username,
        email: payload.email,
        roleId: payload.roleId,
        roleName: payload.roleName,
        permissions: payload.permissions,
      };
    }
  }
}
