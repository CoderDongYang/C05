import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  App as AntdApp,
  Avatar,
  Button,
  Dropdown,
  Input,
  Layout,
  Popconfirm,
  Progress,
  Space,
  Switch,
  Tabs,
  Tag,
  Tooltip,
  TreeSelect,
  Typography,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  HistoryOutlined,
  LogoutOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { ProTable } from '@ant-design/pro-components';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { ActionType, ProColumns } from '@ant-design/pro-components';

import { useUserStore } from '@/store/userStore';
import { useDebugStore } from '@/store/debugStore';
import { ENVIRONMENT_LABELS, MOCK_OWNER_TREE, ROLE_LABELS } from '@/utils';
import type { Environment, FeatureToggle } from '@/types';
import {
  deleteFeatureToggle,
  listFeatureToggles,
  updateFeatureToggle,
} from '@/api';
import { usePermission } from '@/hooks/usePermission';
import { useSse } from '@/hooks/useSse';
import { DebugPanel } from '@/components/DebugPanel';
import { ConfigStrategyModal } from '@/components/ConfigStrategyModal';
import { ChangeLogDrawer } from '@/components/ChangeLogDrawer';

const { Header, Content } = Layout;
const { Text, Title } = Typography;

const ENVIRONMENTS: Environment[] = ['DEV', 'STAGING', 'PROD'];

export const ToggleList = () => {
  const { message } = AntdApp.useApp();
  const user = useUserStore((s) => s.user);
  const logout = useUserStore((s) => s.logout);
  const initFromStorage = useUserStore((s) => s.initFromStorage);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canEdit, canDelete, canConfigure } = usePermission();

  const [activeEnv, setActiveEnv] = useState<Environment>('DEV');
  const [searchKey, setSearchKey] = useState('');
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const actionRef = useRef<ActionType>();
  const setDebugVisible = useDebugStore((s) => s.setVisible);
  const setDebugEnvironment = useDebugStore((s) => s.setEnvironment);

  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [currentToggle, setCurrentToggle] = useState<FeatureToggle | null>(null);
  const [changelogOpen, setChangelogOpen] = useState(false);

  useEffect(() => {
    initFromStorage();
  }, [initFromStorage]);

  const onRefresh = useCallback(
    (env?: string) => {
      if (!env || env === activeEnv) {
        actionRef.current?.reload?.();
      }
      queryClient.invalidateQueries({ queryKey: ['featureToggles'] });
    },
    [activeEnv, queryClient],
  );

  const onSseRefresh = useCallback(
    (env?: string) => {
      onRefresh(env);
      message.info('收到实时更新，已刷新列表');
    },
    [onRefresh, message],
  );

  useSse({
    onRefresh: onSseRefresh,
  });

  useEffect(() => {
    setDebugEnvironment(activeEnv);
  }, [activeEnv, setDebugEnvironment]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => deleteFeatureToggle(id),
    onSuccess: () => {
      message.success('删除成功');
      actionRef.current?.reload?.();
    },
    onError: (e) => {
      message.error(e instanceof Error ? e.message : '删除失败');
    },
  });

  const toggleGlobalMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) =>
      updateFeatureToggle(id, { isGloballyEnabled: enabled }),
    onSuccess: () => {
      actionRef.current?.reload?.();
    },
    onError: (e) => {
      message.error(e instanceof Error ? e.message : '操作失败');
      actionRef.current?.reload?.();
    },
  });

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
    message.success('已退出登录');
  };

  const openConfig = (toggle: FeatureToggle) => {
    setCurrentToggle(toggle);
    setConfigModalOpen(true);
  };

  const openChangelog = (toggle: FeatureToggle) => {
    setCurrentToggle(toggle);
    setChangelogOpen(true);
  };

  const columns: ProColumns<FeatureToggle>[] = [
    {
      title: '开关 Key',
      dataIndex: 'key',
      width: 220,
      fixed: 'left',
      search: false,
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text code strong style={{ fontSize: 13 }}>
            {row.key}
          </Text>
          {row.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {row.description}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '负责人',
      dataIndex: 'ownerName',
      width: 110,
      search: false,
      render: (_, row) => (
        <Space>
          <Avatar size={24} style={{ backgroundColor: '#667eea' }}>
            {(row.ownerName || '?').charAt(0)}
          </Avatar>
          <span style={{ fontSize: 13 }}>{row.ownerName || row.ownerId}</span>
        </Space>
      ),
    },
    {
      title: '全量开关',
      dataIndex: 'isGloballyEnabled',
      width: 110,
      search: false,
      render: (_, row) => (
        <Space>
          <Switch
            size="small"
            checked={row.isGloballyEnabled}
            disabled={!canConfigure(row.environment)}
            loading={toggleGlobalMutation.isPending}
            onChange={(v) => toggleGlobalMutation.mutate({ id: row.id, enabled: v })}
          />
          <Tag color={row.isGloballyEnabled ? 'green' : 'default'} style={{ margin: 0 }}>
            {row.isGloballyEnabled ? '开启' : '关闭'}
          </Tag>
        </Space>
      ),
    },
    {
      title: '灰度比例',
      dataIndex: 'rolloutPercentage',
      width: 180,
      search: false,
      render: (v) => {
        const value = Number(v);
        const color = value === 0 ? '#d9d9d9' : value <= 25 ? '#52c41a' : value <= 50 ? '#faad14' : value <= 75 ? '#fa8c16' : '#f5222d';
        return (
          <Space style={{ width: '100%' }}>
            <Progress
              percent={value}
              size="small"
              style={{ width: 120, margin: 0 }}
              strokeColor={color}
              showInfo={false}
            />
            <Text strong style={{ fontSize: 13, minWidth: 48 }}>
              {value}%
            </Text>
          </Space>
        );
      },
    },
    {
      title: '白名单',
      dataIndex: 'whitelist',
      width: 120,
      search: false,
      render: (_, row) => {
        const v = row.whitelist;
        if (!v || v.length === 0) return <Text type="secondary" style={{ fontSize: 12 }}>无</Text>;
        return (
          <Tooltip placement="top" title={v.join(', ')}>
            <Tag color="geekblue" style={{ margin: 0 }}>
              {v.length} 个用户
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: '属性规则',
      dataIndex: 'attributeRules',
      width: 100,
      search: false,
      render: (_, row) => (
        row.attributeRules ? <Tag color="purple">已配置</Tag> : <Text type="secondary" style={{ fontSize: 12 }}>无</Text>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 170,
      search: false,
      render: (_, row) => (
        <Text style={{ fontSize: 12 }}>
          {new Date(row.createdAt).toLocaleString('zh-CN')}
        </Text>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 170,
      search: false,
      render: (_, row) => (
        <Text style={{ fontSize: 12 }}>
          {new Date(row.updatedAt).toLocaleString('zh-CN')}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 260,
      render: (_, row) => (
        <Space size={4} wrap>
          <Button
            type="link"
            size="small"
            icon={<SettingOutlined />}
            onClick={() => openConfig(row)}
            disabled={!canConfigure(row.environment)}
          >
            配置策略
          </Button>
          <Button
            type="link"
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => openChangelog(row)}
          >
            变更记录
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openConfig(row)}
            disabled={!canEdit(row.environment)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除该开关？"
            description="删除后不可恢复"
            okText="确认删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            disabled={!canDelete(row.environment)}
            onConfirm={() => deleteMutation.mutate(row.id)}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={!canDelete(row.environment)}
              loading={deleteMutation.isPending}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const headerUserMenu = useMemo(
    () => ({
      items: [
        {
          key: 'logout',
          icon: <LogoutOutlined />,
          label: '退出登录',
          danger: true,
        },
      ],
      onClick: ({ key }: { key: string }) => {
        if (key === 'logout') handleLogout();
      },
    }),
    [],
  );

  const envTabItems = useMemo(
    () =>
      ENVIRONMENTS.map((env) => ({
        key: env,
        label: (
          <Space>
            <span>{ENVIRONMENT_LABELS[env]}</span>
            <Tag
              color={env === 'PROD' ? 'red' : env === 'STAGING' ? 'orange' : 'green'}
              style={{ marginLeft: 0 }}
            >
              {env}
            </Tag>
          </Space>
        ),
      })),
    [],
  );

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f7fa' }}>
        <Header
          style={{
            background: '#fff',
            borderBottom: '1px solid #e8e8e8',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 64,
            boxShadow: '0 1px 4px rgba(0,21,41,0.08)',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          <Space size={12}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 700,
                fontSize: 16,
                boxShadow: '0 4px 12px rgba(102,126,234,0.35)',
              }}
            >
              FT
            </div>
            <Title level={4} style={{ margin: 0, color: '#1f1f1f' }}>
              功能开关控制台
            </Title>
            <Tag color="blue">v1.0.0</Tag>
          </Space>

          <Space size={16}>
            <Button
              icon={<ThunderboltOutlined />}
              onClick={() => setDebugVisible(true)}
              type="primary"
              ghost
            >
              模拟调试
            </Button>

            <Dropdown menu={headerUserMenu} placement="bottomRight" arrow>
              <Space style={{ cursor: 'pointer', padding: '4px 12px', borderRadius: 8 }}>
                <Avatar size={32} icon={<UserOutlined />} style={{ backgroundColor: '#667eea' }}>
                  {(user?.name || 'U').charAt(0)}
                </Avatar>
                <Space direction="vertical" size={0} style={{ lineHeight: 1.2 }}>
                  <Text strong style={{ fontSize: 13 }}>
                    {user?.name || user?.username}
                  </Text>
                  <Tag color="blue" style={{ margin: 0, fontSize: 11, padding: '0 6px', lineHeight: 1.6 }}>
                    {ROLE_LABELS[user?.role || '']}
                  </Tag>
                </Space>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{ padding: 24, maxWidth: 1600, margin: '0 auto', width: '100%' }}>
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: '20px 24px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              marginBottom: 16,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <Space size="middle" wrap>
                <Input
                  style={{ width: 280 }}
                  placeholder="按 Key 模糊搜索..."
                  prefix={<SearchOutlined style={{ color: '#bbb' }} />}
                  value={searchKey}
                  onChange={(e) => setSearchKey(e.target.value)}
                  allowClear
                  onPressEnter={() => actionRef.current?.reload?.()}
                />
                <TreeSelect
                  style={{ width: 280 }}
                  placeholder="按负责人筛选"
                  treeData={MOCK_OWNER_TREE}
                  value={ownerIds}
                  onChange={setOwnerIds}
                  treeCheckable
                  showSearch
                  treeDefaultExpandAll
                  treeNodeFilterProp="title"
                  maxTagCount="responsive"
                  allowClear
                />
                <Button icon={<ReloadOutlined />} onClick={() => actionRef.current?.reload?.()}>
                  刷新
                </Button>
              </Space>
              <Space>
                <Button type="primary" icon={<PlusOutlined />}>
                  新建开关
                </Button>
              </Space>
            </div>

            <Tabs
              activeKey={activeEnv}
              onChange={(k) => {
                setActiveEnv(k as Environment);
              }}
              items={envTabItems}
              size="large"
              style={{ marginBottom: 0 }}
            />
          </div>

          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: '16px 20px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
            }}
          >
            <ProTable<FeatureToggle>
              columns={columns}
              actionRef={actionRef}
              rowKey="id"
              search={false}
              options={false}
              pagination={{
                defaultPageSize: 10,
                showSizeChanger: true,
                pageSizeOptions: [10, 20, 50],
                showQuickJumper: true,
                showTotal: (t) => `共 ${t} 个开关`,
              }}
              scroll={{ x: 1400 }}
              request={async (params) => {
                const ownerId =
                  ownerIds && ownerIds.length > 0 && ownerIds[0].startsWith('user-')
                    ? parseInt(ownerIds[0].replace('user-', ''), 10)
                    : undefined;
                const res = await listFeatureToggles({
                  environment: activeEnv,
                  ownerIds: ownerId ? [String(ownerId)] : undefined,
                  searchKey: searchKey.trim() || undefined,
                  key: searchKey.trim() || undefined,
                  ownerId,
                  page: params.current,
                  pageSize: params.pageSize,
                });
                return {
                  data: res.items,
                  success: true,
                  total: res.total,
                };
              }}
              tableStyle={{ paddingInline: 0 }}
              toolBarRender={false}
            />
          </div>
        </Content>

        <ConfigStrategyModal
          open={configModalOpen}
          toggle={currentToggle}
          onClose={() => {
            setConfigModalOpen(false);
            setCurrentToggle(null);
          }}
          onSaved={() => {
            actionRef.current?.reload?.();
          }}
        />

        <ChangeLogDrawer
          open={changelogOpen}
          toggle={currentToggle}
          onClose={() => {
            setChangelogOpen(false);
            setCurrentToggle(null);
          }}
          onRollback={() => {
            actionRef.current?.reload?.();
          }}
        />

        <DebugPanel currentEnv={activeEnv} />
      </Layout>
  );
};

export default ToggleList;
