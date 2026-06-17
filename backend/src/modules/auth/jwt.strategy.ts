import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../../common/decorators/get-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'default-secret-key-change-in-prod',
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在或已被删除');
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
}
