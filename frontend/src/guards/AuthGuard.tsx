import { Navigate, useLocation } from 'react-router-dom';
import { useUserStore } from '@/store/userStore';
import type { ReactNode } from 'react';
import { getToken } from '@/utils';

interface AuthGuardProps {
  children: ReactNode;
}

export const AuthGuard = ({ children }: AuthGuardProps) => {
  const user = useUserStore((s) => s.user);
  const location = useLocation();
  const token = getToken();

  if (!user && !token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
