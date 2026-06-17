import { Button, Card, Input, InputNumber, Radio, Select, Space, Switch, Typography } from 'antd';
import { MinusOutlined, PlusOutlined } from '@ant-design/icons';
import { useToggleConfigStore } from '@/store/toggleStore';
import { FIELD_OPTIONS, OPERATOR_OPTIONS } from '@/utils';
import type { Condition, ConditionGroup, ConditionNode, Operator } from '@/types';
import { isConditionGroup } from '@/types';

const { Text } = Typography;

interface ConditionItemProps {
  condition: Condition;
  isRootGroup: boolean;
  onRemove?: () => void;
}

const ConditionItem = ({ condition, onRemove }: ConditionItemProps) => {
  const updateCondition = useToggleConfigStore((s) => s.updateCondition);
  const isInOperator = condition.operator === 'in';

  const renderValueInput = () => {
    if (isInOperator) {
      return (
        <Select
          mode="tags"
          style={{ width: '100%', minWidth: 180 }}
          placeholder="输入值后按回车"
          value={Array.isArray(condition.value) ? (condition.value as string[]) : []}
          onChange={(v) => updateCondition(condition.id, 'value', v)}
          tokenSeparators={[',', ' ']}
        />
      );
    }
    const isNumeric = condition.operator === 'gt' || condition.operator === 'lt';
    if (isNumeric) {
      return (
        <InputNumber
          style={{ width: '100%', minWidth: 180 }}
          placeholder="输入数字"
          value={typeof condition.value === 'number' ? condition.value : undefined}
          onChange={(v) => updateCondition(condition.id, 'value', v ?? 0)}
        />
      );
    }
    return (
      <Input
        style={{ minWidth: 180 }}
        placeholder="输入值"
        value={typeof condition.value === 'string' ? condition.value : String(condition.value ?? '')}
        onChange={(e) => updateCondition(condition.id, 'value', e.target.value)}
      />
    );
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', background: '#fafafa', borderRadius: 6 }}>
      <Select
        style={{ width: 170 }}
        value={condition.field}
        options={FIELD_OPTIONS}
        onChange={(v) => updateCondition(condition.id, 'field', v)}
        showSearch
        optionFilterProp="label"
      />
      <Select
        style={{ width: 160 }}
        value={condition.operator}
        options={OPERATOR_OPTIONS}
        onChange={(v) => {
          const op = v as Operator;
          updateCondition(condition.id, 'operator', op);
          if (op === 'in') {
            updateCondition(condition.id, 'value', []);
          } else if (op === 'gt' || op === 'lt') {
            updateCondition(condition.id, 'value', 0);
          } else {
            updateCondition(condition.id, 'value', '');
          }
        }}
      />
      <div style={{ flex: 1, minWidth: 180 }}>{renderValueInput()}</div>
      {onRemove && (
        <Button
          type="text"
          danger
          icon={<MinusOutlined />}
          onClick={onRemove}
          size="small"
          title="删除条件"
        />
      )}
    </div>
  );
};

interface ConditionGroupBlockProps {
  group: ConditionGroup;
  isRoot: boolean;
  parentId?: string;
}

const ConditionGroupBlock = ({ group, isRoot }: ConditionGroupBlockProps) => {
  const updateGroupLogic = useToggleConfigStore((s) => s.updateGroupLogic);
  const addCondition = useToggleConfigStore((s) => s.addCondition);
  const addConditionGroup = useToggleConfigStore((s) => s.addConditionGroup);
  const removeNode = useToggleConfigStore((s) => s.removeNode);

  return (
    <Card
      size="small"
      style={{
        background: isRoot ? '#fff' : '#f5f5f5',
        border: isRoot ? '1px solid #d9d9d9' : '1px dashed #bfbfbf',
      }}
      styles={{ body: { padding: 12 } }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <Space>
          <Radio.Group
            size="small"
            value={group.logic}
            onChange={(e) => updateGroupLogic(group.id, e.target.value)}
          >
            <Radio.Button value="AND">AND</Radio.Button>
            <Radio.Button value="OR">OR</Radio.Button>
          </Radio.Group>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {group.logic === 'AND' ? '所有条件都满足' : '满足任一条件即可'}
          </Text>
        </Space>
        {!isRoot && (
          <Button
            type="text"
            danger
            size="small"
            icon={<MinusOutlined />}
            onClick={() => removeNode(group.id)}
            title="删除条件组"
          />
        )}
      </div>

      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {group.children.length === 0 ? (
          <div
            style={{
              padding: 16,
              border: '1px dashed #d9d9d9',
              borderRadius: 6,
              textAlign: 'center',
              color: '#999',
              fontSize: 13,
            }}
          >
            暂无条件，点击下方按钮添加
          </div>
        ) : (
          group.children.map((child: ConditionNode) => {
            if (isConditionGroup(child)) {
              return (
                <ConditionGroupBlock
                  key={child.id}
                  group={child}
                  isRoot={false}
                  parentId={group.id}
                />
              );
            }
            return (
              <ConditionItem
                key={child.id}
                condition={child as Condition}
                isRootGroup={isRoot}
                onRemove={() => removeNode(child.id)}
              />
            );
          })
        )}
      </Space>

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <Button
          size="small"
          type="dashed"
          icon={<PlusOutlined />}
          onClick={() => addCondition(group.id)}
        >
          添加条件
        </Button>
        <Button
          size="small"
          type="dashed"
          icon={<PlusOutlined />}
          onClick={() => addConditionGroup(group.id)}
        >
          添加条件组
        </Button>
      </div>
    </Card>
  );
};

export const ConditionBuilder = () => {
  const attributeRules = useToggleConfigStore((s) => s.attributeRules);
  const toggleAttributeRules = useToggleConfigStore((s) => s.toggleAttributeRules);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, gap: 12 }}>
        <Switch
          checked={attributeRules !== null}
          onChange={toggleAttributeRules}
        />
        <Text strong>启用多维属性规则</Text>
        {attributeRules !== null && (
          <Button
            type="text"
            danger
            size="small"
            onClick={() => {
              toggleAttributeRules(false);
            }}
          >
            清空所有规则
          </Button>
        )}
        <div style={{ flex: 1 }} />
        <Text type="secondary" style={{ fontSize: 12 }}>
          属性规则与白名单、灰度比例是 OR 关系，任一命中即生效
        </Text>
      </div>
      {attributeRules && (
        <ConditionGroupBlock group={attributeRules.root} isRoot={true} />
      )}
      {!attributeRules && (
        <div
          style={{
            padding: 24,
            border: '1px dashed #e0e0e0',
            borderRadius: 8,
            background: '#fafafa',
            textAlign: 'center',
            color: '#999',
          }}
        >
          未启用属性规则
          <div style={{ fontSize: 12, marginTop: 4 }}>
            如需针对用户属性、设备信息等做精细过滤，请开启上方开关
          </div>
        </div>
      )}
    </div>
  );
};

export default ConditionBuilder;
