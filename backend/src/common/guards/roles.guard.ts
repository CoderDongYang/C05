import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, PERMISSIONS_KEY } from '../decorators/roles.decorator';
import { Permission, RoleName } from '../enums/role.enum';
import { JwtPayload } from '../decorators/get-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RoleName[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles && !requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload;

    if (!user) {
      throw new ForbiddenException('用户未登录');
    }

    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = requiredRoles.includes(user.roleName as RoleName);
      if (!hasRole) {
        throw new ForbiddenException('角色权限不足');
      }
    }

    if (requiredPermissions && requiredPermissions.length > 0) {
      const userPermissions = user.permissions || [];
      const hasPermission = requiredPermissions.every((p) =>
        userPermissions.includes(Permission.ALL) || userPermissions.includes(p),
      );
      if (!hasPermission) {
        throw new ForbiddenException('操作权限不足');
      }
    }

    return true;
  }
}
