import { RoleName as PrismaRoleName, Environment as PrismaEnvironment, ChangeType as PrismaChangeType } from '@prisma/client';

export type RoleName = PrismaRoleName;
export const RoleName = {
  DEVELOPER: 'DEVELOPER' as PrismaRoleName,
  TESTER: 'TESTER' as PrismaRoleName,
  PRODUCT_MANAGER: 'PRODUCT_MANAGER' as PrismaRoleName,
  ADMIN: 'ADMIN' as PrismaRoleName,
};

export type Environment = PrismaEnvironment;
export const Environment = {
  DEV: 'DEV' as PrismaEnvironment,
  STAGING: 'STAGING' as PrismaEnvironment,
  PROD: 'PROD' as PrismaEnvironment,
};

export type ChangeType = PrismaChangeType;
export const ChangeType = {
  CREATE: 'CREATE' as PrismaChangeType,
  UPDATE: 'UPDATE' as PrismaChangeType,
  DELETE: 'DELETE' as PrismaChangeType,
  ROLLBACK: 'ROLLBACK' as PrismaChangeType,
};

export enum Permission {
  ALL = '*',
  FEATURE_READ = 'feature:read',
  FEATURE_WRITE_DEV = 'feature:write:dev',
  FEATURE_WRITE_STAGING = 'feature:write:staging',
  FEATURE_WRITE_PROD = 'feature:write:prod',
  FEATURE_WRITE_WHITELIST = 'feature:write:whitelist',
  USER_READ = 'user:read',
  USER_WRITE = 'user:write',
  ROLE_READ = 'role:read',
  ROLE_WRITE = 'role:write',
  CHANGELOG_READ = 'changelog:read',
  CHANGELOG_ROLLBACK = 'changelog:rollback',
}
