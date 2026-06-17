import {
  App as AntdApp,
  Button,
  Card,
  Divider,
  Drawer,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { ClearOutlined, DeleteOutlined, PlusOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useDebugStore } from '@/store/debugStore';
import { DEBUG_PRESETS, ENVIRONMENT_LABELS } from '@/utils';
import type { ColumnsType } from 'antd/es/table';
import type { DebugPreviewItem } from '@/types';

const { Text, Title } = Typography;

interface DebugPanelProps {
  currentEnv: string;
}

export const DebugPanel = ({ currentEnv }: DebugPanelProps) => {
  const { message } = AntdApp.useApp();
  const {
    visible,
    userId,
    tags,
    loading,
    result,
    environment,
    setVisible,
    setUserId,
    setEnvironment,
    addTag,
    updateTag,
    removeTag,
    applyPreset,
    clearAll,
    runPreview,
  } = useDebugStore();

  const onRun = async () => {
    try {
      await runPreview();
      message.success('预览完成');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '预览失败';
      message.error(msg);
    }
  };

  const resultColumns: ColumnsType<DebugPreviewItem> = [
    {
      title: '开关 Key',
      dataIndex: 'toggleKey',
      key: 'toggleKey',
      width: 220,
      ellipsis: true,
    },
    {
      title: '命中结果',
      dataIndex: 'isMatched',
      key: 'isMatched',
      width: 100,
      render: (v: boolean) =>
        v ? (
          <Tag color="green">✓ 命中</Tag>
        ) : (
          <Tag color="default">✗ 未命中</Tag>
        ),
    },
    {
      title: '原因',
      dataIndex: 'matchReason',
      key: 'matchReason',
      ellipsis: true,
    },
  ];

  return (
    <Drawer
      title={
        <Space>
          <ThunderboltOutlined />
          <span>模拟调试</span>
        </Space>
      }
      width={720}
      open={visible}
      onClose={() => setVisible(false)}
      extra={
        <Space>
          <Button onClick={clearAll} icon={<ClearOutlined />}>
            清空
          </Button>
          <Button type="primary" loading={loading} onClick={onRun} icon={<ThunderboltOutlined />}>
            预览命中结果
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Card size="small" title="调试环境">
          <Select
            style={{ width: 260 }}
            value={environment}
            onChange={(v) => setEnvironment(v)}
            options={Object.entries(ENVIRONMENT_LABELS).map(([k, v]) => ({
              label: `${v}${k === currentEnv ? ' (当前)' : ''}`,
              value: k,
            }))}
          />
        </Card>

        <Card
          size="small"
          title="预设身份"
          extra={<Text type="secondary" style={{ fontSize: 12 }}>点击快速填充</Text>}
        >
          <Space wrap>
            {DEBUG_PRESETS.map((p) => (
              <Tag
                key={p.name}
                color="blue"
                style={{ cursor: 'pointer', padding: '4px 12px', fontSize: 13 }}
                onClick={() => applyPreset(p)}
              >
                {p.name}
              </Tag>
            ))}
          </Space>
        </Card>

        <Card
          size="small"
          title={
            <Space>
              <span>调试上下文</span>
              <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                模拟请求 SDK 时传入的用户信息
              </Text>
            </Space>
          }
        >
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>
                UserId <Text type="danger">*</Text>
              </Text>
              <Input
                placeholder="请输入用户 ID，例如 user-001"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                style={{ maxWidth: 400 }}
                prefix={<span style={{ color: '#999' }}>uid:</span>}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text strong>自定义 Tags (key-value)</Text>
                <Button
                  type="dashed"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={addTag}
                >
                  添加 tag
                </Button>
              </div>
              {tags.length === 0 ? (
                <div
                  style={{
                    padding: 16,
                    border: '1px dashed #e0e0e0',
                    borderRadius: 6,
                    textAlign: 'center',
                    color: '#999',
                    fontSize: 12,
                  }}
                >
                  暂无自定义 Tags
                </div>
              ) : (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {tags.map((t) => (
                    <div
                      key={t.id}
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'center',
                      }}
                    >
                      <Input
                        placeholder="key"
                        value={t.key}
                        onChange={(e) => updateTag(t.id, 'key', e.target.value)}
                        style={{ width: 180 }}
                      />
                      <span style={{ color: '#999' }}>=</span>
                      <Input
                        placeholder="value"
                        value={t.value}
                        onChange={(e) => updateTag(t.id, 'value', e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => removeTag(t.id)}
                      />
                    </div>
                  ))}
                </Space>
              )}
            </div>
          </Space>
        </Card>

        {result.length > 0 && (
          <>
            <Divider orientation="left" style={{ marginTop: 0 }}>
              <Title level={5} style={{ margin: 0 }}>
                命中结果预览 ({result.length} 个开关)
              </Title>
            </Divider>
            <Table
              size="small"
              rowKey="toggleId"
              columns={resultColumns}
              dataSource={result}
              pagination={false}
              scroll={{ y: 360 }}
            />
          </>
        )}
      </Space>
    </Drawer>
  );
};

export default DebugPanel;
