import { Injectable, Logger } from '@nestjs/common';
import {
  AttributeCondition,
  AttributeRuleGroup,
  AttributeRules,
  Operator,
} from '../types/attribute-rule.type';

@Injectable()
export class RolloutUtil {
  private readonly logger = new Logger(RolloutUtil.name);

  hashUserId(userId: string | number): number {
    const str = String(userId);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  isInWhitelist(userId: string | number | undefined, whitelist: string[]): boolean {
    if (!userId || !whitelist || whitelist.length === 0) {
      return false;
    }
    return whitelist.includes(String(userId));
  }

  checkPercentage(userId: string | number | undefined, percentage: number): boolean {
    if (!userId) {
      return false;
    }
    if (percentage <= 0) {
      return false;
    }
    if (percentage >= 100) {
      return true;
    }
    const hash = this.hashUserId(userId);
    return hash % 100 < percentage;
  }

  evaluateCondition(
    condition: AttributeCondition,
    tags?: Record<string, unknown>,
  ): boolean {
    const { field, operator, value } = condition;
    const fieldValue = tags?.[field];

    if (fieldValue === undefined || fieldValue === null) {
      return false;
    }

    switch (operator as Operator) {
      case 'eq':
        return String(fieldValue) === String(value);
      case 'ne':
        return String(fieldValue) !== String(value);
      case 'in':
        if (Array.isArray(value)) {
          return value.some((v) => String(v) === String(fieldValue));
        }
        return false;
      case 'gt':
        return Number(fieldValue) > Number(value);
      case 'lt':
        return Number(fieldValue) < Number(value);
      case 'gte':
        return Number(fieldValue) >= Number(value);
      case 'lte':
        return Number(fieldValue) <= Number(value);
      case 'contains':
        if (typeof fieldValue === 'string' && typeof value === 'string') {
          return fieldValue.includes(value);
        }
        return false;
      default:
        return false;
    }
  }

  evaluateRuleGroup(
    group: AttributeRuleGroup,
    tags?: Record<string, unknown>,
  ): boolean {
    if (!group?.conditions || group.conditions.length === 0) {
      return true;
    }

    const results = group.conditions.map((item) => {
      if ('logic' in item) {
        return this.evaluateRuleGroup(item as AttributeRuleGroup, tags);
      }
      return this.evaluateCondition(item as AttributeCondition, tags);
    });

    if (group.logic === 'AND') {
      return results.every(Boolean);
    }
    return results.some(Boolean);
  }

  evaluateAttributeRules(
    rules: AttributeRules,
    tags?: Record<string, unknown>,
  ): boolean {
    if (!rules || Object.keys(rules).length === 0) {
      return true;
    }
    return this.evaluateRuleGroup(rules as AttributeRuleGroup, tags);
  }

  evaluateToggle(
    toggle: {
      isGloballyEnabled: boolean;
      rolloutPercentage: number;
      whitelist: string[];
      attributeRules: AttributeRules;
    },
    userId?: string | number,
    tags?: Record<string, unknown>,
  ): boolean {
    if (!toggle.isGloballyEnabled) {
      return false;
    }

    if (this.isInWhitelist(userId, toggle.whitelist)) {
      return true;
    }

    const hasRules =
      toggle.attributeRules && Object.keys(toggle.attributeRules).length > 0;

    if (hasRules && !this.evaluateAttributeRules(toggle.attributeRules, tags)) {
      return false;
    }

    return this.checkPercentage(userId, toggle.rolloutPercentage);
  }
}
