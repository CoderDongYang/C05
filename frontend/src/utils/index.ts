import type { ConditionGroup, ConditionNode, DebugPreset, OwnerTreeNode, User } from '@/types';
import { isConditionGroup } from '@/types';

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
};

export const createEmptyConditionGroup = (): ConditionGroup => ({
  id: generateId(),
  logic: 'AND',
  children: [],
});

export const parseWhitelist = (text: string): string[] => {
  if (!text.trim()) return [];
  return text
    .split(/[\n,，]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
};

export const formatWhitelist = (list: string[]): string => {
  return list.join('\n');
};

export const removeNodeFromGroup = (
  group: ConditionGroup,
  nodeId: string,
): boolean => {
  for (let i = 0; i < group.children.length; i++) {
    const child = group.children[i];
    if (child.id === nodeId) {
      group.children.splice(i, 1);
      return true;
    }
    if (isConditionGroup(child)) {
      if (removeNodeFromGroup(child, nodeId)) {
        return true;
      }
    }
  }
  return false;
};

export const findNodeInGroup = (
  group: ConditionGroup,
  nodeId: string,
): ConditionNode | null => {
  if (group.id === nodeId) return group;
  for (const child of group.children) {
    if (child.id === nodeId) return child;
    if (isConditionGroup(child)) {
      const found = findNodeInGroup(child, nodeId);
      if (found) return found;
    }
  }
  return null;
};

export const TOKEN_KEY = 'feature-toggle-token';

export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const removeToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

export const USER_KEY = 'feature-toggle-user';

export const getUser = (): User | null => {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
};

export const setUser = (user: User): void => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const removeUser = (): void => {
  localStorage.removeItem(USER_KEY);
};

export const logout = (): void => {
  removeToken();
  removeUser();
};

export const DEBUG_PRESETS: DebugPreset[] = [
  {
    name: '内部测试用户',
    userId: 'internal-001',
    tags: { userType: 'internal', department: 'tech', level: 'L5' },
  },
  {
    name: '普通用户',
    userId: 'user-001',
    tags: { userType: 'normal', level: 'L1' },
  },
  {
    name: 'VIP 用户',
    userId: 'vip-001',
    tags: { userType: 'vip', vipLevel: 'gold', level: 'L3' },
  },
  {
    name: '新注册用户',
    userId: 'new-001',
    tags: { userType: 'new', registerDays: '1' },
  },
  {
    name: '流失风险用户',
    userId: 'churn-001',
    tags: { userType: 'churn_risk', inactiveDays: '30' },
  },
];

export const MOCK_OWNER_TREE: OwnerTreeNode[] = [
  {
    title: '技术部',
    value: 'dept-tech',
    key: 'dept-tech',
    children: [
      {
        title: '系统组',
        value: 'group-admin',
        key: 'group-admin',
        children: [
          { title: '系统管理员 (admin)', value: '1', key: '1' },
        ],
      },
      {
        title: '开发组',
        value: 'group-dev',
        key: 'group-dev',
        children: [
          { title: '张开发 (dev)', value: '2', key: '2' },
        ],
      },
      {
        title: '测试组',
        value: 'group-qa',
        key: 'group-qa',
        children: [
          { title: '李测试 (tester)', value: '3', key: '3' },
        ],
      },
    ],
  },
  {
    title: '产品部',
    value: 'dept-product',
    key: 'dept-product',
    children: [
      { title: '王产品 (pm)', value: '4', key: '4' },
    ],
  },
];

export const OPERATOR_OPTIONS = [
  { label: '等于 (eq)', value: 'eq' },
  { label: '不等于 (ne)', value: 'ne' },
  { label: '包含 (contains)', value: 'contains' },
  { label: '大于 (gt)', value: 'gt' },
  { label: '小于 (lt)', value: 'lt' },
  { label: '属于 (in)', value: 'in' },
];

export const FIELD_OPTIONS = [
  { label: '用户ID (userId)', value: 'userId' },
  { label: '用户类型 (userType)', value: 'userType' },
  { label: '等级 (level)', value: 'level' },
  { label: '国家 (country)', value: 'country' },
  { label: '城市 (city)', value: 'city' },
  { label: '设备类型 (deviceType)', value: 'deviceType' },
  { label: 'App版本 (appVersion)', value: 'appVersion' },
  { label: '注册天数 (registerDays)', value: 'registerDays' },
];

export const ENVIRONMENT_LABELS: Record<string, string> = {
  DEV: '开发环境',
  STAGING: '预发环境',
  PROD: '生产环境',
};

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: '管理员',
  DEVELOPER: '开发者',
  TESTER: '测试',
  PRODUCT_MANAGER: '产品经理',
};
