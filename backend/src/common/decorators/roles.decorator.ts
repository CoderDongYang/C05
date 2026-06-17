import { SetMetadata } from '@nestjs/common';
import { Permission, RoleName } from '../enums/role.enum';

export const ROLES_KEY = 'roles';
export const PERMISSIONS_KEY = 'permissions';

export const Roles = (...roles: RoleName[]) => SetMetadata(ROLES_KEY, roles);

export const Permissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
