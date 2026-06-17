import { Modal, Progress, Slider, Input, InputNumber, Switch, Space, Tag, Divider, Row, Col, Typography, Form, TreeSelect, message } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { useToggleConfigStore } from '@/store/toggleStore';
import { ConditionBuilder } from './ConditionBuilder';
import { MOCK_OWNER_TREE, ENVIRONMENT_LABELS, formatWhitelist, parseWhitelist } from '@/utils';
import type { FeatureToggle, UpdateFeatureToggleRequest } from '@/types';
import { mockUpdateFeatureToggle } from '@/api';

const { Text, Title } = Typography;

interface ConfigStrategyModalProps {
  open: boolean;
  toggle: FeatureToggle | null;
  onClose: () => void;
  onSaved?: (t: FeatureToggle) => void;
}

export const ConfigStrategyModal = ({ open, toggle, onClose, onSaved }: ConfigStrategyModalProps) => {
  const resetFromToggle = useToggleConfigStore((s) => s.resetFromToggle);
  const reset = useToggleConfigStore((s) => s.reset);
  const isGloballyEnabled = useToggleConfigStore((s) => s.isGloballyEnabled);
  const rolloutPercentage = useToggleConfigStore((s) => s.rolloutPercentage);
  const whitelist = useToggleConfigStore((s) => s.whitelist);
  const setIsGloballyEnabled = useToggleConfigStore((s) => s.setIsGloballyEnabled);
  const setRolloutPercentage = useToggleConfigStore((s) => s.setRolloutPercentage);
  const setWhitelist = useToggleConfigStore((s) => s.setWhitelist);
  const getConfigPayload = useToggleConfigStore((s) => s.getConfigPayload);

  const [whitelistText, setWhitelistText] = useState('');
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [form] = Form.useForm();

  useEffect(() => {
    if (open && toggle) {
      resetFromToggle(toggle);
      setWhitelistText(formatWhitelist(toggle.whitelist));
      setDescription(toggle.description);
      setOwnerId(toggle.ownerId);
      form.setFieldsValue({
        description: toggle.description,
        ownerId: toggle.ownerId,
      });
    }
    return () => {
      if (!open) reset();
    };
  }, [open, toggle, resetFromToggle, reset, form]);

  useEffect(() => {
    if (open) setWhitelistText(formatWhitelist(whitelist));
  }, [whitelist, open]);

  const progressColor = useMemo(() => {
    if (rolloutPercentage === 0) return '#d9d9d9';
    if (rolloutPercentage <= 25) return '#52c41a';
    if (rolloutPercentage <= 50) return '#faad14';
    if (rolloutPercentage <= 75) return '#fa8c16';
    return '#f5222d';
  }, [rolloutPercentage]);

  const onWhitelistBlur = () => {
    setWhitelist(parseWhitelist(whitelistText));
  };

  const onSave = async () => {
    if (!toggle) return;
    try {
      await form.validateFields();
      setSaving(true);
      onWhitelistBlur();
      const payload: UpdateFeatureToggleRequest = {
        ...getConfigPayload(),
        description: description || toggle.description,
        ownerId: ownerId || toggle.ownerId,
      };
      const updated = await mockUpdateFeatureToggle(toggle.id, payload);
      message.success('配置保存成功');
      onSaved?.(updated);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '保存失败';
      if (!msg.includes('validate')) message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const onCloseInternal = () => {
    reset();
    onClose();
  };

  if (!toggle) return null;

  return (
    <Modal
      title={
        <Space>
          <Title level={4} style={{ margin: 0 }}>
            配置策略
          </Title>
          <Tag color="blue">{ENVIRONMENT_LABELS[toggle.environment]}</Tag>
          <Text code>{toggle.key}</Text>
        </Space>
      }
      open={open}
      onCancel={onCloseInternal}
      onOk={onSave}
      okText="保存配置"
      cancelText="取消"
      confirmLoading={saving}
      width={860}
      destroyOnClose
      maskClosable={false}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
        <Row gutter={16}>
          <Col span={14}>
            <Form.Item
              label="开关描述"
              name="description"
              rules={[{ required: true, message: '请输入描述' }]}
            >
              <Input
                placeholder="描述该开关用途"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Form.Item>
          </Col>
          <Col span={10}>
            <Form.Item
              label="负责人"
              name="ownerId"
              rules={[{ required: true, message: '请选择负责人' }]}
            >
              <TreeSelect
                placeholder="选择负责人"
                treeData={MOCK_OWNER_TREE}
                value={ownerId}
                onChange={(v) => setOwnerId(v)}
                treeDefaultExpandAll
                showSearch
                treeNodeFilterProp="title"
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>

      <Divider orientation="left" style={{ margin: '16px 0 20px' }}>
        <Text strong style={{ fontSize: 15 }}>
          1. 全量开关
        </Text>
      </Divider>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: 16,
          background: isGloballyEnabled ? '#f6ffed' : '#fafafa',
          borderRadius: 8,
          border: `1px solid ${isGloballyEnabled ? '#b7eb8f' : '#e8e8e8'}`,
          marginBottom: 16,
        }}
      >
        <Switch
          checked={isGloballyEnabled}
          onChange={setIsGloballyEnabled}
          checkedChildren="开启"
          unCheckedChildren="关闭"
        />
        <div style={{ flex: 1 }}>
          <Text strong style={{ fontSize: 14 }}>
            {isGloballyEnabled ? '已开启' : '已关闭'}
          </Text>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
            {isGloballyEnabled
              ? '全局生效（结合下面的灰度比例、白名单、属性规则再过滤）'
              : '关闭后所有用户都不会命中此开关（白名单用户除外）'}
          </div>
        </div>
        <Tag color={isGloballyEnabled ? 'green' : 'default'}>
          isGloballyEnabled = {String(isGloballyEnabled)}
        </Tag>
      </div>

      <Divider orientation="left" style={{ margin: '0 0 20px' }}>
        <Text strong style={{ fontSize: 15 }}>
          2. 百分比灰度
        </Text>
      </Divider>
      <div
        style={{
          padding: 16,
          background: '#fafafa',
          borderRadius: 8,
          border: '1px solid #e8e8e8',
          marginBottom: 16,
        }}
      >
        <Row align="middle" gutter={24}>
          <Col span={16}>
            <Slider
              min={0}
              max={100}
              step={1}
              value={rolloutPercentage}
              onChange={setRolloutPercentage}
              marks={{
                0: '0%',
                25: '25%',
                50: '50%',
                75: '75%',
                100: '100%',
              }}
              tooltip={{ formatter: (v) => `${v}% 用户` }}
            />
          </Col>
          <Col span={8} style={{ textAlign: 'center' }}>
            <Space direction="vertical" align="center">
              <Progress
                type="dashboard"
                percent={rolloutPercentage}
                size={120}
                strokeColor={progressColor}
                format={(p) => <span style={{ fontSize: 22, fontWeight: 600 }}>{p}%</span>}
              />
              <Space>
                <InputNumber
                  min={0}
                  max={100}
                  value={rolloutPercentage}
                  onChange={(v) => setRolloutPercentage(Number(v) || 0)}
                  style={{ width: 100 }}
                  formatter={(v) => `${v}%`}
                  parser={(v) => Number(v?.replace('%', ''))}
                />
              </Space>
            </Space>
          </Col>
        </Row>
        <div style={{ marginTop: 12, fontSize: 12, color: '#888' }}>
          基于 userId 哈希稳定灰度，同一用户始终命中同一结果
        </div>
      </div>

      <Divider orientation="left" style={{ margin: '0 0 20px' }}>
        <Text strong style={{ fontSize: 15 }}>
          3. 白名单（优先级最高）
        </Text>
      </Divider>
      <div
        style={{
          padding: 16,
          background: '#fafafa',
          borderRadius: 8,
          border: '1px solid #e8e8e8',
          marginBottom: 16,
        }}
      >
        <Input.TextArea
          rows={3}
          placeholder="支持输入多个 ID，用逗号或换行分隔，例如：&#10;user-001,user-002&#10;user-test-003"
          value={whitelistText}
          onChange={(e) => setWhitelistText(e.target.value)}
          onBlur={onWhitelistBlur}
          style={{ marginBottom: 12 }}
        />
        <div>
          {whitelist.length === 0 ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              白名单为空，无豁免用户
            </Text>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {whitelist.map((item) => (
                <Tag
                  key={item}
                  color="geekblue"
                  closable
                  closeIcon={<CloseOutlined />}
                  onClose={() => {
                    const newList = whitelist.filter((x) => x !== item);
                    setWhitelist(newList);
                    setWhitelistText(formatWhitelist(newList));
                  }}
                  style={{ padding: '2px 8px', fontSize: 13 }}
                >
                  {item}
                </Tag>
              ))}
              <Text type="secondary" style={{ fontSize: 12, alignSelf: 'center' }}>
                共 {whitelist.length} 个用户
              </Text>
            </div>
          )}
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
          白名单用户直接命中（即使全量关闭或灰度未命中）
        </div>
      </div>

      <Divider orientation="left" style={{ margin: '0 0 20px' }}>
        <Text strong style={{ fontSize: 15 }}>
          4. 多维属性规则
        </Text>
      </Divider>
      <ConditionBuilder />
    </Modal>
  );
};

export default ConfigStrategyModal;
