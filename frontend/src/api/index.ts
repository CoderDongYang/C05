import client from './client';
import type {
  ChangeLog,
  CreateFeatureToggleRequest,
  DebugContext,
  DebugPreviewResponse,
  Environment,
  FeatureToggle,
  ListFeatureTogglesQuery,
  LoginRequest,
  PaginatedResponse,
  UpdateFeatureToggleRequest,
  User,
} from '@/types';

const adaptToggle = (raw: Record<string, unknown>): FeatureToggle => {
  const owner = (raw.owner as Record<string, unknown>) || {};
  const rawRules = raw.attributeRules as Record<string, unknown> | null | undefined;
  const attributeRules =
    rawRules && typeof rawRules === 'object' && Object.keys(rawRules).length > 0
      ? (rawRules as FeatureToggle['attributeRules'])
      : null;
  return {
    id: String(raw.id),
    key: raw.key as string,
    description: (raw.description as string) || '',
    ownerId: String(raw.ownerId),
    ownerName: (owner.username as string) || (raw.ownerId as string),
    environment: raw.environment as Environment,
    isGloballyEnabled: raw.isGloballyEnabled as boolean,
    rolloutPercentage: (raw.rolloutPercentage as number) || 0,
    whitelist: (raw.whitelist as string[]) || [],
    attributeRules,
    createdAt: new Date(raw.createdAt as string).toISOString(),
    updatedAt: new Date(raw.updatedAt as string).toISOString(),
  };
};

const adaptChangeLog = (raw: Record<string, unknown>): ChangeLog => {
  const user = (raw.user as Record<string, unknown>) || {};
  return {
    id: String(raw.id),
    featureToggleId: String(raw.featureToggleId),
    userId: String(raw.userId),
    userName: (user.username as string) || (raw.userId as string),
    environment: raw.environment as Environment,
    oldValue: (raw.oldValue as Partial<FeatureToggle>) || {},
    newValue: (raw.newValue as Partial<FeatureToggle>) || {},
    changeType: raw.changeType as string,
    createdAt: new Date(raw.createdAt as string).toISOString(),
  };
};

const adaptUser = (
  raw: Record<string, unknown>,
  token: string,
): User => {
  return {
    id: String(raw.userId),
    username: raw.username as string,
    name: (raw.username as string) || (raw.email as string) || '',
    role: raw.roleName as User['role'],
    token,
  };
};

export const login = async (data: LoginRequest): Promise<User> => {
  const res = (await client.post('/auth/login', data)) as {
    code: number;
    data: {
      accessToken: string;
      user: Record<string, unknown>;
    };
  };
  return adaptUser(res.data.user, res.data.accessToken);
};

export const getCurrentUser = async (): Promise<User> => {
  const res = (await client.get('/auth/me')) as {
    code: number;
    data: Record<string, unknown>;
  };
  const token = (() => {
    try {
      const rawToken = localStorage.getItem('feature-toggle-token');
      return rawToken || '';
    } catch {
      return '';
    }
  })();
  return adaptUser(res.data, token);
};

export const listFeatureToggles = async (
  params: ListFeatureTogglesQuery,
): Promise<PaginatedResponse<FeatureToggle>> => {
  const res = (await client.get('/feature-toggles', { params })) as {
    code: number;
    data: {
      toggles: Record<string, unknown>[];
      total: number;
      page: number;
      pageSize: number;
    };
  };
  return {
    items: (res.data.toggles || []).map(adaptToggle),
    total: res.data.total,
    page: res.data.page,
    pageSize: res.data.pageSize,
  };
};

export const getFeatureToggle = async (id: string): Promise<FeatureToggle> => {
  const res = (await client.get(`/feature-toggles/${id}`)) as {
    code: number;
    data: Record<string, unknown>;
  };
  return adaptToggle(res.data);
};

export const createFeatureToggle = async (
  data: CreateFeatureToggleRequest,
): Promise<FeatureToggle> => {
  const res = (await client.post('/feature-toggles', data)) as {
    code: number;
    data: Record<string, unknown>;
  };
  return adaptToggle(res.data);
};

export const updateFeatureToggle = async (
  id: string,
  data: UpdateFeatureToggleRequest,
): Promise<FeatureToggle> => {
  const res = (await client.put(`/feature-toggles/${id}`, data)) as {
    code: number;
    data: Record<string, unknown>;
  };
  return adaptToggle(res.data);
};

export const deleteFeatureToggle = (id: string): Promise<void> => {
  return client.delete(`/feature-toggles/${id}`);
};

export const listChangeLogs = async (toggleId: string): Promise<ChangeLog[]> => {
  const res = (await client.get(`/change-logs/toggle/${toggleId}`, {
    params: { page: 1, pageSize: 50 },
  })) as {
    code: number;
    data: {
      logs: Record<string, unknown>[];
    };
  };
  return (res.data.logs || []).map(adaptChangeLog);
};

export const rollbackChangeLog = async (changeLogId: string): Promise<FeatureToggle> => {
  const res = (await client.post(`/change-logs/${changeLogId}/rollback`)) as {
    code: number;
    data: {
      success: boolean;
      toggle: Record<string, unknown>;
    };
  };
  return adaptToggle(res.data.toggle);
};

export const previewDebugConfig = (
  env: Environment,
  context: DebugContext,
): Promise<DebugPreviewResponse> => {
  return client.get('/sdk/config', {
    params: {
      env,
      userId: context.userId,
      tags: JSON.stringify(context.tags),
    },
  });
};

export const mockLogin = (username: string, password: string): Promise<User> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!username || !password) {
        reject(new Error('用户名和密码不能为空'));
        return;
      }
      const roleMap: Record<string, User> = {
        admin: {
          id: 'user-001',
          username: 'admin',
          name: '系统管理员',
          role: 'ADMIN',
          token: 'mock-token-admin-' + Date.now(),
        },
        dev: {
          id: 'user-002',
          username: 'dev',
          name: '张开发',
          role: 'DEVELOPER',
          token: 'mock-token-dev-' + Date.now(),
        },
        tester: {
          id: 'user-003',
          username: 'tester',
          name: '李测试',
          role: 'TESTER',
          token: 'mock-token-tester-' + Date.now(),
        },
        pm: {
          id: 'user-004',
          username: 'pm',
          name: '王产品',
          role: 'PRODUCT_MANAGER',
          token: 'mock-token-pm-' + Date.now(),
        },
      };
      const user = roleMap[username.toLowerCase()] || {
        id: 'user-005',
        username,
        name: username,
        role: 'DEVELOPER',
        token: 'mock-token-' + Date.now(),
      } as User;
      resolve(user);
    }, 300);
  });
};

const createMockToggle = (env: Environment, idx: number): FeatureToggle => {
  const keys = [
    'new_homepage',
    'dark_mode',
    'ai_chat',
    'vip_discount',
    'new_payment_flow',
    'search_v2',
    'recommend_algo_v3',
    'user_profile_redesign',
    'push_notification_v2',
    'live_stream',
  ];
  const descs = [
    '新版首页UI',
    '暗黑模式支持',
    'AI智能对话',
    'VIP专属折扣',
    '新支付流程',
    '新版搜索',
    '推荐算法v3版',
    '用户中心改版',
    '推送通知v2',
    '直播功能',
  ];
  const owners = [
    'user-zhangsan',
    'user-lisi',
    'user-wangwu',
    'user-zhaoliu',
    'user-qianqi',
    'user-sunba',
    'user-zhoujiu',
  ];
  const ownerNames = ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九'];
  const ownerIdx = idx % owners.length;
  return {
    id: `toggle-${env}-${idx}`,
    key: keys[idx % keys.length] + (idx >= keys.length ? `_${Math.floor(idx / keys.length) + 1}` : ''),
    description: descs[idx % descs.length],
    ownerId: owners[ownerIdx],
    ownerName: ownerNames[ownerIdx],
    environment: env,
    isGloballyEnabled: idx % 3 !== 0,
    rolloutPercentage: [0, 10, 25, 50, 75, 100][idx % 6],
    whitelist: idx % 2 === 0 ? ['user-test-001', 'user-test-002', 'user-admin'] : [],
    attributeRules:
      idx % 3 === 0
        ? {
            root: {
              id: 'root-' + idx,
              logic: 'AND',
              children: [
                {
                  id: 'c1-' + idx,
                  field: 'userType',
                  operator: 'eq',
                  value: 'vip',
                },
                {
                  id: 'cg-' + idx,
                  logic: 'OR',
                  children: [
                    {
                      id: 'c2-' + idx,
                      field: 'level',
                      operator: 'gt',
                      value: 2,
                    },
                    {
                      id: 'c3-' + idx,
                      field: 'country',
                      operator: 'in',
                      value: ['CN', 'US', 'JP'],
                    },
                  ],
                },
              ],
            },
          }
        : null,
    createdAt: new Date(Date.now() - idx * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - Math.floor(idx / 2) * 3600000).toISOString(),
  };
};

const MOCK_TOGGLES_BY_ENV: Record<Environment, FeatureToggle[]> = {
  DEV: Array.from({ length: 8 }, (_, i) => createMockToggle('DEV', i)),
  STAGING: Array.from({ length: 6 }, (_, i) => createMockToggle('STAGING', i)),
  PROD: Array.from({ length: 5 }, (_, i) => createMockToggle('PROD', i)),
};

const MOCK_CHANGE_LOGS: Record<string, ChangeLog[]> = {};

export const mockListFeatureToggles = (
  params: ListFeatureTogglesQuery,
): Promise<PaginatedResponse<FeatureToggle>> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const page = params.page || 1;
      const pageSize = params.pageSize || 20;
      let data = [...MOCK_TOGGLES_BY_ENV[params.environment]];
      if (params.searchKey) {
        data = data.filter((t) =>
          t.key.toLowerCase().includes(params.searchKey!.toLowerCase()),
        );
      }
      if (params.ownerIds && params.ownerIds.length > 0) {
        const leafOwners = params.ownerIds.filter((id) => id.startsWith('user-'));
        if (leafOwners.length > 0) {
          data = data.filter((t) => leafOwners.includes(t.ownerId));
        }
      }
      const total = data.length;
      const items = data.slice((page - 1) * pageSize, page * pageSize);
      resolve({ items, total, page, pageSize });
    }, 300);
  });
};

export const mockUpdateFeatureToggle = (
  id: string,
  data: UpdateFeatureToggleRequest,
): Promise<FeatureToggle> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      let found: FeatureToggle | null = null;
      (Object.keys(MOCK_TOGGLES_BY_ENV) as Environment[]).forEach((env) => {
        const list = MOCK_TOGGLES_BY_ENV[env];
        const idx = list.findIndex((t) => t.id === id);
        if (idx >= 0) {
          list[idx] = {
            ...list[idx],
            ...data,
            updatedAt: new Date().toISOString(),
          };
          found = list[idx];
          if (!MOCK_CHANGE_LOGS[id]) MOCK_CHANGE_LOGS[id] = [];
          MOCK_CHANGE_LOGS[id].unshift({
            id: `cl-${Date.now()}`,
            featureToggleId: id,
            userId: 'user-001',
            userName: '当前用户',
            environment: list[idx].environment,
            oldValue: {},
            newValue: data,
            changeType: 'UPDATE',
            createdAt: new Date().toISOString(),
          });
        }
      });
      resolve(found!);
    }, 300);
  });
};

export const mockDeleteFeatureToggle = (id: string): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      (Object.keys(MOCK_TOGGLES_BY_ENV) as Environment[]).forEach((env) => {
        const list = MOCK_TOGGLES_BY_ENV[env];
        const idx = list.findIndex((t) => t.id === id);
        if (idx >= 0) list.splice(idx, 1);
      });
      resolve();
    }, 300);
  });
};

export const mockListChangeLogs = (toggleId: string): Promise<ChangeLog[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (!MOCK_CHANGE_LOGS[toggleId]) {
        MOCK_CHANGE_LOGS[toggleId] = Array.from({ length: 5 }, (_, i) => ({
          id: `cl-${toggleId}-${i}`,
          featureToggleId: toggleId,
          userId: 'user-' + (100 + i),
          userName: ['张三', '李四', '王五', '赵六', '钱七'][i],
          environment: 'DEV',
          oldValue: { rolloutPercentage: i * 10 },
          newValue: { rolloutPercentage: (i + 1) * 10 },
          changeType: 'UPDATE',
          createdAt: new Date(Date.now() - i * 3600000).toISOString(),
        }));
      }
      resolve(MOCK_CHANGE_LOGS[toggleId]);
    }, 300);
  });
};

export const mockRollbackChangeLog = (
  toggleId: string,
  changeLogId: string,
): Promise<FeatureToggle> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const logs = MOCK_CHANGE_LOGS[toggleId];
      const log = logs?.find((l) => l.id === changeLogId);
      if (!log) {
        reject(new Error('变更记录不存在'));
        return;
      }
      let found: FeatureToggle | null = null;
      (Object.keys(MOCK_TOGGLES_BY_ENV) as Environment[]).forEach((env) => {
        const list = MOCK_TOGGLES_BY_ENV[env];
        const idx = list.findIndex((t) => t.id === toggleId);
        if (idx >= 0) {
          list[idx] = {
            ...list[idx],
            ...log.oldValue,
            updatedAt: new Date().toISOString(),
          };
          found = list[idx];
        }
      });
      resolve(found!);
    }, 300);
  });
};

export const mockPreviewDebugConfig = (
  env: Environment,
  context: DebugContext,
): Promise<DebugPreviewResponse> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const toggles = MOCK_TOGGLES_BY_ENV[env];
      const items = toggles.map((t) => {
        const reasons: string[] = [];
        let matched = t.isGloballyEnabled;
        if (matched) reasons.push('全量开关开启');
        if (t.whitelist.includes(context.userId)) {
          matched = true;
          reasons.push(`用户 ${context.userId} 在白名单中`);
        }
        if (matched && t.rolloutPercentage < 100 && !t.whitelist.includes(context.userId)) {
          const hash = context.userId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
          if (hash % 100 >= t.rolloutPercentage) {
            matched = false;
            reasons.push(`灰度比例 ${t.rolloutPercentage}% 未命中`);
          } else {
            reasons.push(`灰度比例 ${t.rolloutPercentage}% 命中`);
          }
        }
        return {
          toggleId: t.id,
          toggleKey: t.key,
          isMatched: matched,
          matchReason: reasons.length > 0 ? reasons.join('; ') : '未命中任何规则',
        };
      });
      resolve({ items });
    }, 400);
  });
};
