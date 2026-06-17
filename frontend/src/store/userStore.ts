import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { User } from '@/types';
import { getUser, setUser, logout as clearAuth } from '@/utils';
import { mockLogin } from '@/api';
import { setToken } from '@/utils';

interface UserState {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
  initFromStorage: () => void;
}

export const useUserStore = create<UserState>()(
  immer((set) => ({
    user: null,
    loading: false,
    setUser: (user) => {
      set((state) => {
        state.user = user;
      });
    },
    login: async (username, password) => {
      set((state) => {
        state.loading = true;
      });
      try {
        const user = await mockLogin(username, password);
        setToken(user.token);
        setUser(user);
        set((state) => {
          state.user = user;
          state.loading = false;
        });
        return user;
      } catch (e) {
        set((state) => {
          state.loading = false;
        });
        throw e;
      }
    },
    logout: () => {
      clearAuth();
      set((state) => {
        state.user = null;
      });
    },
    initFromStorage: () => {
      const user = getUser();
      if (user) {
        set((state) => {
          state.user = user;
        });
      }
    },
  })),
);
