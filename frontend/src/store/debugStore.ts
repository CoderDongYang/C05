import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { DebugContext, DebugPreset, DebugPreviewItem, Environment } from '@/types';
import { generateId } from '@/utils';
import { previewDebugConfig } from '@/api';

interface TagItem {
  id: string;
  key: string;
  value: string;
}

interface DebugState {
  visible: boolean;
  userId: string;
  tags: TagItem[];
  loading: boolean;
  result: DebugPreviewItem[];
  environment: Environment;

  setVisible: (v: boolean) => void;
  setUserId: (v: string) => void;
  setEnvironment: (env: Environment) => void;
  addTag: () => void;
  updateTag: (id: string, field: 'key' | 'value', value: string) => void;
  removeTag: (id: string) => void;
  applyPreset: (preset: DebugPreset) => void;
  clearAll: () => void;
  runPreview: () => Promise<void>;
  getContext: () => DebugContext;
}

export const useDebugStore = create<DebugState>()(
  immer((set, get) => ({
    visible: false,
    userId: '',
    tags: [],
    loading: false,
    result: [],
    environment: 'DEV',

    setVisible: (v) =>
      set((state) => {
        state.visible = v;
      }),

    setUserId: (v) =>
      set((state) => {
        state.userId = v;
      }),

    setEnvironment: (env) =>
      set((state) => {
        state.environment = env;
      }),

    addTag: () =>
      set((state) => {
        state.tags.push({
          id: generateId(),
          key: '',
          value: '',
        });
      }),

    updateTag: (id, field, value) =>
      set((state) => {
        const tag = state.tags.find((t) => t.id === id);
        if (tag) tag[field] = value;
      }),

    removeTag: (id) =>
      set((state) => {
        state.tags = state.tags.filter((t) => t.id !== id);
      }),

    applyPreset: (preset) =>
      set((state) => {
        state.userId = preset.userId;
        state.tags = Object.entries(preset.tags).map(([k, v]) => ({
          id: generateId(),
          key: k,
          value: v,
        }));
      }),

    clearAll: () =>
      set((state) => {
        state.userId = '';
        state.tags = [];
        state.result = [];
      }),

    runPreview: async () => {
      const s = get();
      if (!s.userId) {
        throw new Error('请输入 userId');
      }
      set((state) => {
        state.loading = true;
      });
      try {
        const ctx = s.getContext();
        const res = await previewDebugConfig(s.environment, ctx);
        set((state) => {
          state.result = res.items;
          state.loading = false;
        });
      } catch (e) {
        set((state) => {
          state.loading = false;
        });
        throw e;
      }
    },

    getContext: () => {
      const s = get();
      const tags: Record<string, string> = {};
      s.tags.forEach((t) => {
        if (t.key.trim()) tags[t.key.trim()] = t.value;
      });
      return {
        userId: s.userId,
        tags,
      };
    },
  })),
);
