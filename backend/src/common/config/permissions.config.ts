import { Permission } from '../enums/role.enum';
import { RoleName } from '@prisma/client';

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  [RoleName.ADMIN]: [Permission.ALL],
  [RoleName.DEVELOPER]: [
    Permission.FEATURE_READ,
    Permission.FEATURE_WRITE_DEV,
    Permission.FEATURE_WRITE_STAGING,
    Permission.CHANGELOG_READ,
    Permission.CHANGELOG_ROLLBACK,
  ],
  [RoleName.TESTER]: [
    Permission.FEATURE_READ,
    Permission.FEATURE_WRITE_WHITELIST,
    Permission.CHANGELOG_READ,
  ],
  [RoleName.PRODUCT_MANAGER]: [
    Permission.FEATURE_READ,
    Permission.FEATURE_WRITE_PROD,
    Permission.CHANGELOG_READ,
    Permission.CHANGELOG_ROLLBACK,
  ],
};
