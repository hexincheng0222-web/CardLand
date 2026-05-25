// ============================================================
// CardLand Attribute System — Per-Hour Decay + 9 Attributes
// Pure functions for attribute management
// ============================================================

import type { AttributeId, WeatherId, StatusEffectId } from '@data/types';
import { ATTRIBUTES, ATTRIBUTE_THRESHOLDS, STATUS_EFFECTS, WEATHER_TYPES } from '@data/v1-spec';

// ============================================================
// Types
// ============================================================

export type Attributes = Record<AttributeId, number>;

export interface ActiveStatusEffect {
  id: StatusEffectId;
  remainingDuration: number | null;
}

export interface ThresholdResult {
  effectId: string;
  description: string;
  efficiencyModifier: number;
  recoveryModifier: number;
}

export interface LinkageEntry {
  triggerAttribute: AttributeId;
  triggerCondition: string;
  triggerValue: number;
  affectedAttribute: AttributeId;
  modifier: number;
  modifierType: string;
}

export interface LinkageResult {
  activeLinkages: LinkageEntry[];
  directChanges: Partial<Record<AttributeId, number>>;
}

export interface DecayContext {
  gathering?: boolean;
  fighting?: boolean;
  crafting?: boolean;
  isNight?: boolean;
  terrain?: string;
  environmentTemperature?: number;
  nearFire?: boolean;
}

export interface DeathCheckResult {
  isDead: boolean;
  reason: string | null;
}

// ============================================================
// Per-Hour Base Decay Rates (9 attributes)
// ============================================================

export const BASE_DECAY_RATES: Record<AttributeId, number> = {
  '饱食度': -1,
  '口渴度': -1.5,
  '体力值': 0,
  '健康值': 0,
  '精力值': -0.5,
  '污垢': 1,
  '心情': -0.5,
  '负重': 0,
  '体温': 0,
};

export const DEFAULT_ATTRIBUTES: Attributes = {
  '饱食度': 60,
  '口渴度': 60,
  '体力值': 80,
  '健康值': 100,
  '精力值': 80,
  '污垢': 20,
  '心情': 70,
  '负重': 0,
  '体温': 60,
};

// ============================================================
// All 30 Linkages from Design Doc (CardLand-人物属性.md)
// ============================================================

export const ALL_LINKAGES: readonly LinkageEntry[] = [
  // 饱食度 ≤ 30
  { triggerAttribute: '饱食度', triggerCondition: 'leq', triggerValue: 30, affectedAttribute: '体力值', modifier: -0.5, modifierType: 'recovery' },
  { triggerAttribute: '饱食度', triggerCondition: 'leq', triggerValue: 30, affectedAttribute: '精力值', modifier: -1, modifierType: 'rate' },
  { triggerAttribute: '饱食度', triggerCondition: 'leq', triggerValue: 30, affectedAttribute: '心情', modifier: -1, modifierType: 'rate' },
  { triggerAttribute: '饱食度', triggerCondition: 'leq', triggerValue: 30, affectedAttribute: '体温', modifier: -1, modifierType: 'rate' },
  // 口渴度 ≤ 30
  { triggerAttribute: '口渴度', triggerCondition: 'leq', triggerValue: 30, affectedAttribute: '体力值', modifier: 0.3, modifierType: 'consumption' },
  { triggerAttribute: '口渴度', triggerCondition: 'leq', triggerValue: 30, affectedAttribute: '健康值', modifier: -0.5, modifierType: 'recovery' },
  // 体力值 ≤ 30
  { triggerAttribute: '体力值', triggerCondition: 'leq', triggerValue: 30, affectedAttribute: '精力值', modifier: 0.3, modifierType: 'consumption' },
  { triggerAttribute: '体力值', triggerCondition: 'leq', triggerValue: 30, affectedAttribute: '心情', modifier: -0.7, modifierType: 'rate' },
  { triggerAttribute: '体力值', triggerCondition: 'leq', triggerValue: 30, affectedAttribute: '负重', modifier: -20, modifierType: 'consumption' },
  // 健康值 ≤ 40
  { triggerAttribute: '健康值', triggerCondition: 'leq', triggerValue: 40, affectedAttribute: '体力值', modifier: -20, modifierType: 'consumption' },
  { triggerAttribute: '健康值', triggerCondition: 'leq', triggerValue: 40, affectedAttribute: '心情', modifier: -1, modifierType: 'rate' },
  // 精力值 ≤ 50
  { triggerAttribute: '精力值', triggerCondition: 'leq', triggerValue: 50, affectedAttribute: '体力值', modifier: -0.15, modifierType: 'efficiency' },
  // 精力值 ≤ 30
  { triggerAttribute: '精力值', triggerCondition: 'leq', triggerValue: 30, affectedAttribute: '体力值', modifier: -0.2, modifierType: 'efficiency' },
  // 精力值 > 80
  { triggerAttribute: '精力值', triggerCondition: 'gt', triggerValue: 80, affectedAttribute: '精力值', modifier: -0.2, modifierType: 'consumption' },
  // 污垢 > 60
  { triggerAttribute: '污垢', triggerCondition: 'gt', triggerValue: 60, affectedAttribute: '健康值', modifier: -0.3, modifierType: 'recovery' },
  // 污垢 > 80
  { triggerAttribute: '污垢', triggerCondition: 'gt', triggerValue: 80, affectedAttribute: '体力值', modifier: 0.15, modifierType: 'consumption' },
  { triggerAttribute: '污垢', triggerCondition: 'gt', triggerValue: 80, affectedAttribute: '心情', modifier: 0, modifierType: 'blockRecovery' },
  // 心情 ≤ 30
  { triggerAttribute: '心情', triggerCondition: 'leq', triggerValue: 30, affectedAttribute: '体力值', modifier: 0.2, modifierType: 'consumption' },
  { triggerAttribute: '心情', triggerCondition: 'leq', triggerValue: 30, affectedAttribute: '精力值', modifier: 0.2, modifierType: 'consumption' },
  { triggerAttribute: '心情', triggerCondition: 'leq', triggerValue: 30, affectedAttribute: '体力值', modifier: -0.2, modifierType: 'efficiency' },
  // 心情 > 80
  { triggerAttribute: '心情', triggerCondition: 'gt', triggerValue: 80, affectedAttribute: '体力值', modifier: 3, modifierType: 'recovery' },
  { triggerAttribute: '心情', triggerCondition: 'gt', triggerValue: 80, affectedAttribute: '精力值', modifier: 2, modifierType: 'recovery' },
  // 负重 > 50
  { triggerAttribute: '负重', triggerCondition: 'gt', triggerValue: 50, affectedAttribute: '体力值', modifier: 0.2, modifierType: 'consumption' },
  // 负重 > 75
  { triggerAttribute: '负重', triggerCondition: 'gt', triggerValue: 75, affectedAttribute: '体力值', modifier: 0.4, modifierType: 'consumption' },
  { triggerAttribute: '负重', triggerCondition: 'gt', triggerValue: 75, affectedAttribute: '心情', modifier: -2, modifierType: 'rate' },
  // 体温 ≤ 40
  { triggerAttribute: '体温', triggerCondition: 'leq', triggerValue: 40, affectedAttribute: '体力值', modifier: 0.3, modifierType: 'consumption' },
  { triggerAttribute: '体温', triggerCondition: 'leq', triggerValue: 40, affectedAttribute: '精力值', modifier: -0.5, modifierType: 'recovery' },
  // 体温 ≤ 20
  { triggerAttribute: '体温', triggerCondition: 'leq', triggerValue: 20, affectedAttribute: '健康值', modifier: -3, modifierType: 'rate' },
  // 体温 ≥ 81
  { triggerAttribute: '体温', triggerCondition: 'geq', triggerValue: 81, affectedAttribute: '口渴度', modifier: 0.5, modifierType: 'consumption' },
  // 体温 ≥ 91
  { triggerAttribute: '体温', triggerCondition: 'geq', triggerValue: 91, affectedAttribute: '健康值', modifier: -2, modifierType: 'rate' },
];

// ============================================================
// Condition Evaluator
// ============================================================

const CONDITION_EVALUATORS: Record<string, (v: number, t: number) => boolean> = {
  leq: (v, t) => v <= t,
  geq: (v, t) => v >= t,
  lt: (v, t) => v < t,
  gt: (v, t) => v > t,
  eq: (v, t) => v === t,
};

export function evaluateCondition(value: number, op: string, threshold: number): boolean {
  const evaluator = CONDITION_EVALUATORS[op];
  return evaluator ? evaluator(value, threshold) : false;
}

// ============================================================
// 1. decayAttribute — Per-hour decay for deltaMinutes
// ============================================================

export function decayAttribute(current: number, rate: number, deltaMinutes: number): number {
  return current + rate * (deltaMinutes / 60);
}

// ============================================================
// 2. applyThresholdEffects — Threshold modifiers for all attrs
// ============================================================

export function applyThresholdEffects(attributes: Attributes): Record<AttributeId, ThresholdResult> {
  const result = {} as Record<AttributeId, ThresholdResult>;
  for (const attr of ATTRIBUTES) {
    const value = attributes[attr.id] ?? attr.initialValue;
    const thresholds = ATTRIBUTE_THRESHOLDS[attr.id];
    if (!thresholds) continue;
    const match = thresholds.find(t => value >= t.minValue && value <= t.maxValue);
    if (match) {
      result[attr.id] = {
        effectId: match.effectId,
        description: match.effectDescription,
        efficiencyModifier: match.efficiencyModifier,
        recoveryModifier: match.recoveryModifier,
      };
    }
  }
  return result;
}

// ============================================================
// 3. applyLinkageEffects — Cross-attribute effects (30 linkages)
// ============================================================

export function applyLinkageEffects(attributes: Attributes): LinkageResult {
  const activeLinkages: LinkageEntry[] = [];
  const directChanges: Partial<Record<AttributeId, number>> = {};

  for (const linkage of ALL_LINKAGES) {
    const triggerValue = attributes[linkage.triggerAttribute] ?? 0;
    const isActive = evaluateCondition(triggerValue, linkage.triggerCondition, linkage.triggerValue);

    if (isActive) {
      activeLinkages.push({ ...linkage });
      if (linkage.modifierType === 'rate') {
        const prev = directChanges[linkage.affectedAttribute] ?? 0;
        directChanges[linkage.affectedAttribute] = prev + linkage.modifier;
      }
    }
  }

  return { activeLinkages, directChanges };
}

// ============================================================
// 4. clampAttributes — Clamp to [minValue, maxValue]
// ============================================================

export function clampAttributes(attributes: Attributes): Attributes {
  const result = {} as Attributes;
  for (const attr of ATTRIBUTES) {
    const value = attributes[attr.id] ?? attr.initialValue;
    result[attr.id] = Math.max(attr.minValue, Math.min(attr.maxValue, value));
  }
  return result;
}

// ============================================================
// 5. processNaturalDecay — Full per-hour decay pipeline
// ============================================================

export function processNaturalDecay(
  attributes: Attributes,
  deltaMinutes: number,
  weather?: WeatherId,
  context?: DecayContext,
): Attributes {
  const result = { ...attributes };
  const dt = deltaMinutes / 60;

  const isHungry = (attributes['饱食度'] ?? 0) <= 0;
  const isThirsty = (attributes['口渴度'] ?? 0) <= 0;

  const rates: Record<string, number> = { ...BASE_DECAY_RATES };

  if (context?.gathering || context?.fighting) {
    rates['饱食度'] += -0.5;
  }

  if (weather === '晴') {
    rates['口渴度'] += -0.5;
  }
  if (context?.terrain === '山地' || context?.terrain === '火山') {
    rates['口渴度'] += -0.3;
  }

  if (isHungry || isThirsty) {
    rates['体力值'] += -0.8;
  }

  if (isHungry || isThirsty) {
    rates['健康值'] += -1.5;
  }

  if (context?.crafting) {
    rates['精力值'] += -1;
  }
  if (context?.fighting) {
    rates['精力值'] += -0.5;
  }
  if (isHungry) {
    rates['精力值'] += -0.5;
  }

  if (context?.gathering) {
    rates['污垢'] += 0.3;
  }
  if (context?.fighting) {
    rates['污垢'] += 0.5;
  }
  if (weather === '暴雨') {
    rates['污垢'] += -1.5;
  }

  if ((attributes['污垢'] ?? 0) > 60) {
    rates['心情'] += -0.5;
  }

  const envTemp = context?.environmentTemperature ?? 60;
  const currentTemp = attributes['体温'] ?? 60;
  if (currentTemp > envTemp) {
    rates['体温'] = -0.5;
  } else if (currentTemp < envTemp) {
    rates['体温'] = 0.5;
  } else {
    rates['体温'] = 0;
  }
  if (context?.nearFire) {
    rates['体温'] += 10;
  }

  for (const [attrId, rate] of Object.entries(rates)) {
    const id = attrId as AttributeId;
    result[id] = (result[id] ?? 0) + rate * dt;
  }

  return clampAttributes(result);
}

// ============================================================
// 6. checkDeathConditions — Health ≤ 0 → death
// ============================================================

export function checkDeathConditions(attributes: Attributes): DeathCheckResult {
  const health = attributes['健康值'] ?? 0;
  if (health <= 0) {
    return { isDead: true, reason: '健康值归零' };
  }
  return { isDead: false, reason: null };
}

// ============================================================
// Backward-compatible exports
// ============================================================

export function applyNaturalDecay(attributes: Attributes): Attributes {
  return processNaturalDecay(attributes, 60);
}

export function applyStatusEffects(
  attributes: Attributes,
  activeStatuses: ActiveStatusEffect[],
): { attributes: Attributes; statusEffects: ActiveStatusEffect[] } {
  const newAttributes = { ...attributes };
  let totalHealthChange = 0;
  for (const status of activeStatuses) {
    const def = STATUS_EFFECTS.find(s => s.id === status.id);
    if (!def || def.damagePerTurn === 0) continue;
    totalHealthChange += def.damagePerTurn;
  }
  newAttributes['健康值'] = (newAttributes['健康值'] ?? 0) + totalHealthChange;

  const updatedStatuses: ActiveStatusEffect[] = [];
  for (const s of activeStatuses) {
    const def = STATUS_EFFECTS.find(d => d.id === s.id);
    if (!def) continue;
    if (def.duration === null) {
      updatedStatuses.push({ ...s });
      continue;
    }
    const currentRemaining = s.remainingDuration ?? def.duration;
    const newRemaining = currentRemaining - 1;
    if (newRemaining > 0) {
      updatedStatuses.push({ ...s, remainingDuration: newRemaining });
    }
  }

  return { attributes: newAttributes, statusEffects: updatedStatuses };
}

export function applyWeatherEffects(attributes: Attributes, weatherId: WeatherId): Attributes {
  const weather = WEATHER_TYPES.find(w => w.id === weatherId);
  if (!weather) return { ...attributes };
  const result = { ...attributes };
  for (const effect of weather.effects.attributeEffects) {
    const prev = result[effect.attributeId] ?? 0;
    result[effect.attributeId] = prev + effect.amount;
  }
  return result;
}

export function createSeededRNG(seed: number): () => number {
  let s = seed | 0;
  return function mulberry32(): number {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
