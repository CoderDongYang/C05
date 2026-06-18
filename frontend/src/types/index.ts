export type Environment = 'DEV' | 'STAGING' | 'PROD';

export type Role = 'ADMIN' | 'DEVELOPER' | 'TESTER' | 'PRODUCT_MANAGER';

export type Operator = 'eq' | 'ne' | 'in' | 'gt' | 'lt' | 'contains';

export type LogicOperator = 'AND' | 'OR';

export interface Condition {
  id: string;
  field: string;
  operator: Operator;
  value: string | number | boolean | string[];
}

export interface ConditionGroup {
  id: string;
  logic: LogicOperator;
  children: (Condition | ConditionGroup)[];
}

export type ConditionNode = Condition | ConditionGroup;

export const isConditionGroup = (node: ConditionNode): node is ConditionGroup => {
  return 'logic' in node && 'children' in node;
};

export interface AttributeRules {
  root: ConditionGroup;
}

export interface FeatureToggle {
  id: string;
  key: string;
  description: string;
  ownerId: string;
  ownerName?: string;
  environment: Environment;
  isGloballyEnabled: boolean;
  rolloutPercentage: number;
  whitelist: string[];
  attributeRules: AttributeRules | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFeatureToggleRequest {
  key: string;
  description: string;
  ownerId: string;
  environment: Environment;
}

export interface UpdateFeatureToggleRequest {
  description?: string;
  ownerId?: string;
  isGloballyEnabled?: boolean;
  rolloutPercentage?: number;
  whitelist?: string[];
  attributeRules?: AttributeRules | null;
}

export interface ChangeLog {
  id: string;
  featureToggleId: string;
  userId: string;
  userName?: string;
  environment: Environment;
  oldValue: Partial<FeatureToggle>;
  newValue: Partial<FeatureToggle>;
  changeType: string;
  createdAt: string;
}

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  token: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListFeatureTogglesQuery {
  environment: Environment;
  ownerIds?: string[];
  searchKey?: string;
  key?: string;
  ownerId?: number;
  page?: number;
  pageSize?: number;
}

export interface DebugPreviewItem {
  toggleId: string;
  toggleKey: string;
  isMatched: boolean;
  matchReason: string;
}

export interface DebugPreviewResponse {
  items: DebugPreviewItem[];
}

export interface DebugContext {
  userId: string;
  tags: Record<string, string>;
}

export interface DebugPreset {
  name: string;
  userId: string;
  tags: Record<string, string>;
}

export interface OwnerTreeNode {
  title: string;
  value: string;
  key: string;
  children?: OwnerTreeNode[];
}
