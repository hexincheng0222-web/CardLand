import { ATTRIBUTES, ATTRIBUTE_THRESHOLDS, ATTRIBUTE_LINKAGES, STATUS_EFFECTS, WEATHER_TYPES } from '@data/v1-spec';
import type { AttributeId, StatusEffectId, WeatherId } from '@data/types';

// ============================================================
// Types
// ============================================================

export type Attributes = Record<AttributeId, number>;

export interface ActiveStatusEffect {
  id: StatusEffectId;
  remainingDuration: number | null; // null = indefinite (conditional)
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
  /** Direct per-turn attribute changes from 'rate' modifier type linkages */
  directChanges: Partial<Record<AttributeId, number>>;
}

export interface DeathCheckResult {
  isDead: boolean;
  reason: string | null;
}

// ============================================================
// Seeded PRNG (deterministic testing)
// ============================================================

export function createSeededRNG(seed: number): () => number {
  let s = seed | 0;
  return function mulberry32(): number {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================
// Pure Functions
// ============================================================

/**
 * Evaluate a condition expression: compares a value against a threshold
 * using the specified operator. Exported for direct testing.
 */
export function evaluateCondition(value: number, op: string, threshold: number): boolean {
  const evaluator = CONDITION_EVALUATORS[op];
  return evaluator ? evaluator(value, threshold) : false;
}

const CONDITION_EVALUATORS: Record<string, (v: number, t: number) => boolean> = {
  leq: (v, t) => v <= t,
  geq: (v, t) => v >= t,
  lt: (v, t) => v < t,
  gt: (v, t) => v > t,
  eq: (v, t) => v === t,
};

/**
 * Apply natural decay to all attributes per turn.
 * Returns a NEW attributes object — does not mutate input.
 */
export function applyNaturalDecay(attributes: Attributes): Attributes {
  const result = { ...attributes };
  for (const attr of ATTRIBUTES) {
    const current = result[attr.id] ?? attr.initialValue;
    result[attr.id] = current + attr.naturalDecayPerTurn;
  }
  return result;
}

/**
 * Determine which threshold range each attribute falls into.
 * Returns threshold effect details for every attribute.
 */
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

/**
 * Evaluate all attribute linkages and compute active effects.
 * 'rate' modifier type linkages produce direct per-turn attribute changes.
 * Other modifier types are recorded in activeLinkages for downstream consumption.
 */
export function applyLinkageEffects(attributes: Attributes): LinkageResult {
  const activeLinkages: LinkageEntry[] = [];
  const directChanges: Partial<Record<AttributeId, number>> = {};

  for (const linkage of ATTRIBUTE_LINKAGES) {
    const triggerValue = attributes[linkage.triggerAttribute] ?? 0;
    const isActive = evaluateCondition(triggerValue, linkage.triggerCondition, linkage.triggerValue);

    if (isActive) {
      activeLinkages.push({
        triggerAttribute: linkage.triggerAttribute,
        triggerCondition: linkage.triggerCondition,
        triggerValue: linkage.triggerValue,
        affectedAttribute: linkage.affectedAttribute,
        modifier: linkage.modifier,
        modifierType: linkage.modifierType,
      });

      // Direct attribute changes for 'rate' type
      if (linkage.modifierType === 'rate') {
        const prev = directChanges[linkage.affectedAttribute] ?? 0;
        directChanges[linkage.affectedAttribute] = prev + linkage.modifier;
      }
    }
  }

  return { activeLinkages, directChanges };
}

/**
 * Apply active status effects: health damage per turn, duration decrement, expiry.
 * Null-duration (conditional) statuses persist indefinitely and are not affected
 * by turn-based duration tracking here.
 */
export function applyStatusEffects(
  attributes: Attributes,
  activeStatuses: ActiveStatusEffect[],
): { attributes: Attributes; statusEffects: ActiveStatusEffect[] } {
  const newAttributes = { ...attributes };

  // Accumulate health damage from all active statuses
  let totalHealthChange = 0;
  for (const status of activeStatuses) {
    const def = STATUS_EFFECTS.find(s => s.id === status.id);
    if (!def || def.damagePerTurn === 0) continue;
    totalHealthChange += def.damagePerTurn;
  }
  newAttributes['健康值'] = (newAttributes['健康值'] ?? 0) + totalHealthChange;

  // Decrement durations and remove expired
  const updatedStatuses: ActiveStatusEffect[] = [];
  for (const s of activeStatuses) {
    const def = STATUS_EFFECTS.find(d => d.id === s.id);
    if (!def) continue;

    // Conditional status (null duration) — persists indefinitely
    if (def.duration === null) {
      updatedStatuses.push({ ...s });
      continue;
    }

    // Numeric duration — decrement
    const currentRemaining = s.remainingDuration ?? def.duration;
    const newRemaining = currentRemaining - 1;
    if (newRemaining > 0) {
      updatedStatuses.push({ ...s, remainingDuration: newRemaining });
    }
    // expired → removed
  }

  return { attributes: newAttributes, statusEffects: updatedStatuses };
}

/**
 * Apply weather attribute effects to current attributes.
 * Returns a NEW attributes object — does not mutate input.
 */
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

/**
 * Clamp all attributes to their defined [minValue, maxValue] range.
 * Returns a NEW attributes object — does not mutate input.
 */
export function clampAttributes(attributes: Attributes): Attributes {
  const result = {} as Attributes;
  for (const attr of ATTRIBUTES) {
    const value = attributes[attr.id] ?? attr.initialValue;
    result[attr.id] = Math.max(attr.minValue, Math.min(attr.maxValue, value));
  }
  return result;
}

/**
 * Check if death conditions are met.
 * V1: health ≤ 0 triggers game over.
 */
export function checkDeathConditions(attributes: Attributes): DeathCheckResult {
  const health = attributes['健康值'] ?? 0;
  if (health <= 0) {
    return { isDead: true, reason: '健康值归零' };
  }
  return { isDead: false, reason: null };
}
