import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { AttributeRules, Condition, ConditionGroup, Operator, LogicOperator } from '@/types';
import { isConditionGroup } from '@/types';
import { createEmptyConditionGroup, findNodeInGroup, generateId, removeNodeFromGroup } from '@/utils';

interface ToggleConfigState {
  isGloballyEnabled: boolean;
  rolloutPercentage: number;
  whitelist: string[];
  attributeRules: AttributeRules | null;
  editing: boolean;

  setIsGloballyEnabled: (v: boolean) => void;
  setRolloutPercentage: (v: number) => void;
  setWhitelist: (v: string[]) => void;
  addWhitelistItem: (item: string) => void;
  removeWhitelistItem: (item: string) => void;
  toggleAttributeRules: (enabled: boolean) => void;
  updateGroupLogic: (groupId: string, logic: LogicOperator) => void;
  addCondition: (groupId: string) => void;
  addConditionGroup: (groupId: string) => void;
  removeNode: (nodeId: string) => void;
  updateCondition: (
    conditionId: string,
    field: keyof Condition,
    value: Condition[keyof Condition],
  ) => void;
  resetFromToggle: (toggle: {
    isGloballyEnabled: boolean;
    rolloutPercentage: number;
    whitelist: string[];
    attributeRules: AttributeRules | null;
  }) => void;
  reset: () => void;
  getConfigPayload: () => {
    isGloballyEnabled: boolean;
    rolloutPercentage: number;
    whitelist: string[];
    attributeRules: AttributeRules | null;
  };
}

const cloneRules = (rules: AttributeRules | null): AttributeRules | null => {
  if (!rules) return null;
  return JSON.parse(JSON.stringify(rules));
};

export const useToggleConfigStore = create<ToggleConfigState>()(
  immer((set, get) => ({
    isGloballyEnabled: false,
    rolloutPercentage: 0,
    whitelist: [],
    attributeRules: null,
    editing: false,

    setIsGloballyEnabled: (v) =>
      set((state) => {
        state.isGloballyEnabled = v;
      }),

    setRolloutPercentage: (v) =>
      set((state) => {
        state.rolloutPercentage = Math.max(0, Math.min(100, v));
      }),

    setWhitelist: (v) =>
      set((state) => {
        state.whitelist = v;
      }),

    addWhitelistItem: (item) =>
      set((state) => {
        if (!state.whitelist.includes(item)) {
          state.whitelist.push(item);
        }
      }),

    removeWhitelistItem: (item) =>
      set((state) => {
        state.whitelist = state.whitelist.filter((x) => x !== item);
      }),

    toggleAttributeRules: (enabled) =>
      set((state) => {
        if (enabled) {
          if (!state.attributeRules) {
            state.attributeRules = { root: createEmptyConditionGroup() };
          }
        } else {
          state.attributeRules = null;
        }
      }),

    updateGroupLogic: (groupId, logic) =>
      set((state) => {
        if (!state.attributeRules) return;
        const group = findNodeInGroup(state.attributeRules.root, groupId) as ConditionGroup | null;
        if (group && isConditionGroup(group)) {
          group.logic = logic;
        }
      }),

    addCondition: (groupId) =>
      set((state) => {
        if (!state.attributeRules) return;
        const group = findNodeInGroup(state.attributeRules.root, groupId) as ConditionGroup | null;
        if (group && isConditionGroup(group)) {
          group.children.push({
            id: generateId(),
            field: 'userId',
            operator: 'eq' as Operator,
            value: '',
          });
        }
      }),

    addConditionGroup: (groupId) =>
      set((state) => {
        if (!state.attributeRules) return;
        const group = findNodeInGroup(state.attributeRules.root, groupId) as ConditionGroup | null;
        if (group && isConditionGroup(group)) {
          group.children.push(createEmptyConditionGroup());
        }
      }),

    removeNode: (nodeId) =>
      set((state) => {
        if (!state.attributeRules) return;
        if (state.attributeRules.root.id === nodeId) return;
        removeNodeFromGroup(state.attributeRules.root, nodeId);
      }),

    updateCondition: (conditionId, field, value) =>
      set((state) => {
        if (!state.attributeRules) return;
        const cond = findNodeInGroup(state.attributeRules.root, conditionId) as Condition | null;
        if (cond && !isConditionGroup(cond)) {
          (cond as unknown as Record<string, unknown>)[field] = value;
        }
      }),

    resetFromToggle: (toggle) =>
      set((state) => {
        state.isGloballyEnabled = toggle.isGloballyEnabled;
        state.rolloutPercentage = toggle.rolloutPercentage;
        state.whitelist = [...toggle.whitelist];
        state.attributeRules = cloneRules(toggle.attributeRules);
        state.editing = true;
      }),

    reset: () =>
      set((state) => {
        state.isGloballyEnabled = false;
        state.rolloutPercentage = 0;
        state.whitelist = [];
        state.attributeRules = null;
        state.editing = false;
      }),

    getConfigPayload: () => {
      const s = get();
      return {
        isGloballyEnabled: s.isGloballyEnabled,
        rolloutPercentage: s.rolloutPercentage,
        whitelist: s.whitelist,
        attributeRules: cloneRules(s.attributeRules),
      };
    },
  })),
);
