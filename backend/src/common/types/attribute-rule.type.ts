export type Operator = 'eq' | 'ne' | 'in' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains';

export interface AttributeCondition {
  field: string;
  operator: Operator;
  value: unknown;
}

export interface AttributeRuleGroup {
  logic: 'AND' | 'OR';
  conditions: (AttributeCondition | AttributeRuleGroup)[];
}

export type AttributeRules = AttributeRuleGroup | Record<string, never>;

export interface AttributeRuleEvaluatorInput {
  userId?: string;
  tags?: Record<string, unknown>;
}
