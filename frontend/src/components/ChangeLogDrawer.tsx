import { useQuery } from '@tanstack/react-query';
import { Button, Drawer, Empty, List, Popconfirm, Space, Tag, Typography, message } from 'antd';
import { HistoryOutlined, RollbackOutlined } from '@ant-design/icons';
import type { ChangeLog, FeatureToggle } from '@/types';
import { mockListChangeLogs, mockRollbackChangeLog } from '@/api';
import { ENVIRONMENT_LABELS } from '@/utils';
import { usePermission } from '@/hooks/usePermission';

const { Text, Title } = Typography;

interface ChangeLogDrawerProps {
  open: boolean;
  toggle: FeatureToggle | null;
  onClose: () => void;
  onRollback?: (t: FeatureToggle) => void;
}

const fieldLabels: Record<string, string> = {
  isGloballyEnabled: '全量开关',
  rolloutPercentage: '灰度比例',
  whitelist: '白名单',
  attributeRules: '属性规则',
  description: '描述',
  ownerId: '负责人',
};

const formatValue = (key: string, v: unknown): string => {
  if (v === undefined || v === null) return '空';
  if (key === 'isGloballyEnabled') return v ? '开启' : '关闭';
  if (key === 'rolloutPercentage') return `${v}%`;
  if (key === 'whitelist') {
    const arr = v as string[];
    return arr.length > 0 ? arr.join(', ') : '[]';
  }
  if (key === 'attributeRules') return v ? '已配置规则' : '无规则';
  return String(v);
};

export const ChangeLogDrawer = ({ open, toggle, onClose, onRollback }: ChangeLogDrawerProps) => {
  const { canRollback } = usePermission();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['changeLogs', toggle?.id],
    enabled: open && !!toggle?.id,
    queryFn: async () => {
      if (!toggle?.id) return [];
      return mockListChangeLogs(toggle.id);
    },
  });

  const handleRollback = async (log: ChangeLog) => {
    if (!toggle) return;
    try {
      const t = await mockRollbackChangeLog(toggle.id, log.id);
      message.success('已回滚到该版本');
      onRollback?.(t);
      refetch();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '回滚失败';
      message.error(msg);
    }
  };

  const renderDiff = (log: ChangeLog) => {
    const oldKeys = Object.keys(log.oldValue || {});
    const newKeys = Object.keys(log.newValue || {});
    const allKeys = [...new Set([...oldKeys, ...newKeys])];
    if (allKeys.length === 0) {
      return <Text type="secondary">无字段变更</Text>;
    }
    return (
      <div style={{ marginTop: 8 }}>
        {allKeys.map((k) => {
          const label = fieldLabels[k] || k;
          const oldV = (log.oldValue as Record<string, unknown>)?.[k];
          const newV = (log.newValue as Record<string, unknown>)?.[k];
          return (
            <div
              key={k}
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                padding: '4px 0',
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              <Text type="secondary" style={{ minWidth: 80, flexShrink: 0 }}>
                {label}:
              </Text>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {oldV !== undefined && (
                  <Tag color="red" style={{ margin: 0 }}>
                    - {formatValue(k, oldV)}
                  </Tag>
                )}
                <span style={{ color: '#999' }}>→</span>
                {newV !== undefined && (
                  <Tag color="green" style={{ margin: 0 }}>
                    + {formatValue(k, newV)}
                  </Tag>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Drawer
      title={
        <Space>
          <HistoryOutlined />
          <Title level={4} style={{ margin: 0 }}>
            变更记录
          </Title>
          {toggle && (
            <>
              <Tag color="blue">{ENVIRONMENT_LABELS[toggle.environment]}</Tag>
              <Text code>{toggle.key}</Text>
            </>
          )}
        </Space>
      }
      width={640}
      open={open}
      onClose={onClose}
      destroyOnClose
      loading={isLoading}
      extra={
        toggle ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            共 {data?.length || 0} 条记录
          </Text>
        ) : null
      }
    >
      {!data || data.length === 0 ? (
        <Empty description="暂无变更记录" style={{ marginTop: 80 }} />
      ) : (
        <List
          itemLayout="vertical"
          dataSource={data}
          renderItem={(log) => (
            <List.Item
              style={{
                padding: '16px 0',
                borderBottom: '1px solid #f0f0f0',
              }}
              key={log.id}
              actions={
                canRollback(toggle?.environment)
                  ? [
                      <Popconfirm
                        key="rollback"
                        title="确认回滚到此版本？"
                        description="会将开关配置恢复为变更前的状态"
                        okText="确认回滚"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => handleRollback(log)}
                      >
                        <Button
                          type="link"
                          size="small"
                          icon={<RollbackOutlined />}
                          danger
                        >
                          回滚到此版本
                        </Button>
                      </Popconfirm>,
                    ]
                  : []
              }
            >
              <List.Item.Meta
                avatar={
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    {(log.userName || 'U').charAt(0).toUpperCase()}
                  </div>
                }
                title={
                  <Space>
                    <Text strong>{log.userName || log.userId}</Text>
                    <Tag color="default" style={{ margin: 0 }}>
                      {log.changeType}
                    </Tag>
                  </Space>
                }
                description={
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {new Date(log.createdAt).toLocaleString('zh-CN')}
                  </Text>
                }
              />
              {renderDiff(log)}
            </List.Item>
          )}
        />
      )}
    </Drawer>
  );
};

export default ChangeLogDrawer;
