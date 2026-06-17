import { useUserStore } from '@/store/userStore';
import type { Environment, Role } from '@/types';

interface UsePermissionReturn {
  canEdit: (env?: Environment) => boolean;
  canDelete: (env?: Environment) => boolean;
  canConfigure: (env?: Environment) => boolean;
  canRollback: (env?: Environment) => boolean;
  hasRole: (...roles: Role[]) => boolean;
}

export const usePermission = (): UsePermissionReturn => {
  const user = useUserStore((s) => s.user);
  const role = user?.role;

  const isDevRestricted = (env?: Environment): boolean => {
    return role === 'DEVELOPER' && env === 'PROD';
  };

  const canEdit = (env?: Environment): boolean => {
    if (!role) return false;
    if (isDevRestricted(env)) return false;
    return ['ADMIN', 'DEVELOPER', 'TESTER', 'PRODUCT_MANAGER'].includes(role);
  };

  const canDelete = (env?: Environment): boolean => {
    if (!role) return false;
    if (isDevRestricted(env)) return false;
    return role === 'ADMIN';
  };

  const canConfigure = (env?: Environment): boolean => {
    if (!role) return false;
    if (isDevRestricted(env)) return false;
    return ['ADMIN', 'DEVELOPER', 'TESTER'].includes(role);
  };

  const canRollback = (env?: Environment): boolean => {
    if (!role) return false;
    if (isDevRestricted(env)) return false;
    return role === 'ADMIN' || role === 'DEVELOPER';
  };

  const hasRole = (...roles: Role[]): boolean => {
    if (!role) return false;
    return roles.includes(role);
  };

  return { canEdit, canDelete, canConfigure, canRollback, hasRole };
};
