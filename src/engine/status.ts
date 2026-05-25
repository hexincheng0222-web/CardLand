// ============================================================
// CardLand Status Effect System — 13 Negative + 8 Positive
// Pure functions for status effect management, stacking, and application
// ============================================================

import type { AttributeId } from '@data/types';

// ============================================================
// Types
// ============================================================

export type StatusEffectId =
  // Negative (13)
  | '中毒' | '感染' | '灼伤' | '迷路' | '溺水' | '蛇毒' | '疾病'
  | '疲惫' | '沮丧' | '失温症' | '中暑' | '湿身' | '饮食单调'
  // Positive (8)
  | '饱腹' | '精神饱满' | '专注' | '清爽' | '愉悦' | '防护' | '探索者之眼' | '暖身';

export interface StatusEffect {
  id: StatusEffectId;
  startedAt: number;
  expiresAt: number | null;
}

export interface StatusEffectDefinition {
  id: StatusEffectId;
  name: string;
  icon: string;
  isNegative: boolean;
  durationHours: number | null;
  healthPerHour: number;
  staminaPerHour: number;
  energyPerHour: number;
  moodPerHour: number;
  temperaturePerHour: number;
  preventsMoving: boolean;
  preventsAction: boolean;
  preventsCombat: boolean;
  staminaMaxReduction: number;
  energyConsumptionMultiplier: number;
  actionPowerReduction: number;
  productionReduction: number;
  moodRecoveryBlocked: boolean;
  staminaConsumptionReduction: number;
  craftingEnergyReduction: number;
  consumptionReduction: number;
  infectionResistance: number;
  dangerReduction: number;
  coldImmunity: boolean;
  hiddenResourceDiscovery: boolean;
  statusEffectHalved: boolean;
  uses: number | null;
  removalMethods: string[];
}

export interface StatusApplication {
  attributeChanges: Partial<Record<AttributeId, number>>;
  removedEffects: StatusEffectId[];
  activeEffects: StatusEffect[];
}

export interface StatusModifiers {
  healthPerHour: number;
  staminaPerHour: number;
  energyPerHour: number;
  moodPerHour: number;
  temperaturePerHour: number;
  staminaMaxReduction: number;
  energyConsumptionMultiplier: number;
  actionPowerReduction: number;
  productionReduction: number;
  consumptionReduction: number;
  infectionResistance: number;
  dangerReduction: number;
  moodRecoveryBlocked: boolean;
  preventsMoving: boolean;
  preventsAction: boolean;
  preventsCombat: boolean;
  coldImmunity: boolean;
  hiddenResourceDiscovery: boolean;
  craftingEnergyReduction: number;
  staminaConsumptionReduction: number;
}

export interface StackingResult {
  removedEffects: StatusEffectId[];
  addedEffects: StatusEffectId[];
  durationBonuses: Map<StatusEffectId, number>;
  comboEffects: string[];
}

// ============================================================
// All 21 Status Effect Definitions
// ============================================================

function makeDef(
  id: StatusEffectId,
  name: string,
  icon: string,
  isNegative: boolean,
  durationHours: number | null,
  overrides: Partial<StatusEffectDefinition> = {},
): StatusEffectDefinition {
  return {
    id, name, icon, isNegative, durationHours,
    healthPerHour: 0,
    staminaPerHour: 0,
    energyPerHour: 0,
    moodPerHour: 0,
    temperaturePerHour: 0,
    preventsMoving: false,
    preventsAction: false,
    preventsCombat: false,
    staminaMaxReduction: 0,
    energyConsumptionMultiplier: 1,
    actionPowerReduction: 0,
    productionReduction: 0,
    moodRecoveryBlocked: false,
    staminaConsumptionReduction: 0,
    craftingEnergyReduction: 0,
    consumptionReduction: 0,
    infectionResistance: 0,
    dangerReduction: 0,
    coldImmunity: false,
    hiddenResourceDiscovery: false,
    statusEffectHalved: false,
    uses: null,
    removalMethods: [],
    ...overrides,
  };
}

export const STATUS_DEFINITIONS: Record<StatusEffectId, StatusEffectDefinition> = {
  // ── Negative (13) ──
  '中毒':     makeDef('中毒', '中毒', '☠️', true, 3, { healthPerHour: -1.5, removalMethods: ['解毒草×1'] }),
  '感染':     makeDef('感染', '感染', '🩹', true, 5, { healthPerHour: -0.8, removalMethods: ['草药×1'] }),
  '灼伤':     makeDef('灼伤', '灼伤', '🔥', true, 2, { healthPerHour: -1.2, staminaMaxReduction: 20, removalMethods: ['草药×1', '温泉'] }),
  '迷路':     makeDef('迷路', '迷路', '🌫️', true, 1, { preventsMoving: true, staminaPerHour: -10, removalMethods: ['指南针', '藏宝图'] }),
  '溺水':     makeDef('溺水', '溺水', '🌊', true, 1, { staminaPerHour: -30, healthPerHour: -20, removalMethods: ['绳索(减半)'] }),
  '蛇毒':     makeDef('蛇毒', '蛇毒(高级)', '🐍', true, 3, { healthPerHour: -2, preventsAction: true, removalMethods: ['蛇胆×1'] }),
  '疾病':     makeDef('疾病', '疾病', '🦠', true, 5, { staminaPerHour: -1.5, removalMethods: ['草药×2'] }),
  '疲惫':     makeDef('疲惫', '疲惫', '😫', true, null, { energyConsumptionMultiplier: 2, actionPowerReduction: 0.3, removalMethods: ['休息1h'] }),
  '沮丧':     makeDef('沮丧', '沮丧', '😞', true, null, { moodRecoveryBlocked: true, productionReduction: 0.2, removalMethods: ['稀有发现', '休息+美食'] }),
  '失温症':   makeDef('失温症', '失温症', '🥶', true, null, { healthPerHour: -1.2, actionPowerReduction: 0.5, preventsCombat: true, removalMethods: ['庇护所+篝火'] }),
  '中暑':     makeDef('中暑', '中暑', '🥵', true, null, { healthPerHour: -0.8, actionPowerReduction: 0.5, preventsCombat: true, removalMethods: ['阴凉处', '水中'] }),
  '湿身':     makeDef('湿身', '湿身', '💦', true, 2, { temperaturePerHour: -0.5, removalMethods: ['靠近火源', '自然风干'] }),
  '饮食单调': makeDef('饮食单调', '饮食单调', '🥱', true, null, { moodRecoveryBlocked: true, actionPowerReduction: 0.1, removalMethods: ['吃2种不同食物'] }),

  // ── Positive (8) ──
  '饱腹':       makeDef('饱腹', '饱腹', '😋', false, null, { staminaPerHour: 0.8, removalMethods: ['饱食度≤80'] }),
  '精神饱满':   makeDef('精神饱满', '精神饱满', '✨', false, 3, { staminaConsumptionReduction: 0.5, removalMethods: ['3h后自动解除'] }),
  '专注':       makeDef('专注', '专注', '🎯', false, null, { craftingEnergyReduction: 0.5, removalMethods: ['精力≤80'] }),
  '清爽':       makeDef('清爽', '清爽', '🫧', false, null, { infectionResistance: 0.2, moodPerHour: 0.5, removalMethods: ['污垢≥20'] }),
  '愉悦':       makeDef('愉悦', '愉悦', '🎉', false, null, { consumptionReduction: 0.2, dangerReduction: 0.05, removalMethods: ['心情≤80'] }),
  '防护':       makeDef('防护', '防护', '🛡️', false, null, { statusEffectHalved: true, uses: 1, removalMethods: ['1次触发后消失'] }),
  '探索者之眼': makeDef('探索者之眼', '探索者之眼', '👁️', false, null, { hiddenResourceDiscovery: true, removalMethods: ['当前探索结束'] }),
  '暖身':       makeDef('暖身', '暖身', '🔥', false, null, { temperaturePerHour: 0.5, coldImmunity: true, removalMethods: ['离开火源'] }),
};

export const ALL_STATUS_IDS: StatusEffectId[] = Object.keys(STATUS_DEFINITIONS) as StatusEffectId[];

// ============================================================
// 1. createStatusEffect — Create active effect instance
// ============================================================

export function createStatusEffect(id: StatusEffectId, currentTime: number): StatusEffect {
  const def = STATUS_DEFINITIONS[id];
  if (!def) throw new Error(`Unknown status effect: ${id}`);
  return {
    id,
    startedAt: currentTime,
    expiresAt: def.durationHours !== null ? currentTime + def.durationHours * 60 : null,
  };
}

// ============================================================
// 2. isEffectActive — Check if effect is still active
// ============================================================

export function isEffectActive(effect: StatusEffect, currentTime: number): boolean {
  if (effect.expiresAt === null) return true;
  return currentTime < effect.expiresAt;
}

// ============================================================
// 3. getActiveEffects — Filter to only active effects
// ============================================================

export function getActiveEffects(effects: StatusEffect[], currentTime: number): StatusEffect[] {
  return effects.filter(e => isEffectActive(e, currentTime));
}

// ============================================================
// 4. applyStatusEffects — Apply all effects, return changes
// ============================================================

export function applyStatusEffects(
  effects: StatusEffect[],
  _attributes: Record<AttributeId, number>,
  currentTime: number,
): StatusApplication {
  let active = getActiveEffects(effects, currentTime);
  const activeIds = new Set(active.map(e => e.id));
  const removedEffects: StatusEffectId[] = [];

  // ── Positive counters ──
  if (activeIds.has('精神饱满') && activeIds.has('疲惫')) {
    removedEffects.push('疲惫');
  }
  if (activeIds.has('愉悦') && activeIds.has('沮丧')) {
    removedEffects.push('沮丧');
  }
  if (activeIds.has('暖身') && activeIds.has('失温症')) {
    removedEffects.push('失温症');
  }

  active = active.filter(e => !removedEffects.includes(e.id));
  const finalIds = new Set(active.map(e => e.id));

  // ── 防护 halving ──
  const hasProtection = finalIds.has('防护');
  let protectionUsed = false;

  const changes: Partial<Record<AttributeId, number>> = {};
  const add = (attr: AttributeId, val: number) => {
    changes[attr] = (changes[attr] ?? 0) + val;
  };

  for (const effect of active) {
    const def = STATUS_DEFINITIONS[effect.id];
    if (!def) continue;

    let mult = 1;
    if (hasProtection && def.isNegative && !protectionUsed) {
      mult = 0.5;
      protectionUsed = true;
    }

    if (def.healthPerHour)      add('健康值', def.healthPerHour * mult);
    if (def.staminaPerHour)     add('体力值', def.staminaPerHour * mult);
    if (def.energyPerHour)      add('精力值', def.energyPerHour * mult);
    if (def.moodPerHour)        add('心情', def.moodPerHour * mult);
    if (def.temperaturePerHour) add('体温', def.temperaturePerHour * mult);
  }

  // ── Combo: 中毒+疾病 → extra -0.8/h health + stamina ──
  if (finalIds.has('中毒') && finalIds.has('疾病')) {
    const comboMult = hasProtection && !protectionUsed ? 0.5 : 1;
    add('健康值', -0.8 * comboMult);
    add('体力值', -0.8 * comboMult);
    if (hasProtection && !protectionUsed) protectionUsed = true;
  }

  // ── Consume 防护 ──
  if (protectionUsed) {
    removedEffects.push('防护');
    active = active.filter(e => e.id !== '防护');
  }

  return { attributeChanges: changes, removedEffects, activeEffects: active };
}

// ============================================================
// 5. addStatusEffect — Add new effect (handle stacking)
// ============================================================

export function addStatusEffect(
  effects: StatusEffect[],
  id: StatusEffectId,
  currentTime: number,
): StatusEffect[] {
  if (effects.some(e => e.id === id && isEffectActive(e, currentTime))) {
    return [...effects];
  }

  const newEffect = createStatusEffect(id, currentTime);
  let updated = [...effects, newEffect];

  const negativeCount = updated.filter(e => {
    const def = STATUS_DEFINITIONS[e.id];
    return def?.isNegative && isEffectActive(e, currentTime);
  }).length;

  if (negativeCount >= 3) {
    updated = updated.map(e => {
      const def = STATUS_DEFINITIONS[e.id];
      if (def?.isNegative && e.expiresAt !== null) {
        return { ...e, expiresAt: e.expiresAt + 60 };
      }
      return e;
    });
  }

  return updated;
}

// ============================================================
// 6. removeStatusEffect — Remove effect by ID
// ============================================================

export function removeStatusEffect(
  effects: StatusEffect[],
  id: StatusEffectId,
): StatusEffect[] {
  return effects.filter(e => e.id !== id);
}

// ============================================================
// 7. checkPositiveNegatives — Check combo/counter rules
// ============================================================

export function checkPositiveNegatives(
  effects: StatusEffect[],
  currentTime: number,
): StackingResult {
  const active = getActiveEffects(effects, currentTime);
  const activeIds = new Set(active.map(e => e.id));
  const removedEffects: StatusEffectId[] = [];
  const durationBonuses = new Map<StatusEffectId, number>();
  const comboEffects: string[] = [];

  if (activeIds.has('精神饱满') && activeIds.has('疲惫')) {
    removedEffects.push('疲惫');
    comboEffects.push('精神饱满→疲惫自动解除');
  }
  if (activeIds.has('愉悦') && activeIds.has('沮丧')) {
    removedEffects.push('沮丧');
    comboEffects.push('愉悦→沮丧自动解除');
  }
  if (activeIds.has('暖身') && activeIds.has('失温症')) {
    removedEffects.push('失温症');
    comboEffects.push('暖身→失温症解除');
  }

  const negativeCount = active.filter(e => {
    const def = STATUS_DEFINITIONS[e.id];
    return def?.isNegative && !removedEffects.includes(e.id);
  }).length;

  if (negativeCount >= 3) {
    for (const effect of active) {
      const def = STATUS_DEFINITIONS[effect.id];
      if (def?.isNegative && effect.expiresAt !== null && !removedEffects.includes(effect.id)) {
        durationBonuses.set(effect.id, 60);
      }
    }
    comboEffects.push('3+负面状态:所有持续时间+1h');
  }

  if (activeIds.has('中毒') && activeIds.has('感染')) {
    comboEffects.push('中毒+感染:健康-2.3/h');
  }
  if (activeIds.has('中毒') && activeIds.has('疾病')) {
    comboEffects.push('中毒+疾病:健康-2.3/h,体力额外-0.8/h');
  }
  if (activeIds.has('疲惫') && activeIds.has('沮丧')) {
    comboEffects.push('疲惫+沮丧:行动力-50%');
  }

  return { removedEffects, addedEffects: [], durationBonuses, comboEffects };
}

// ============================================================
// 8. getStatusModifiers — Get all active modifiers
// ============================================================

export function getStatusModifiers(
  effects: StatusEffect[],
  currentTime: number,
): StatusModifiers {
  const active = getActiveEffects(effects, currentTime);

  const mods: StatusModifiers = {
    healthPerHour: 0,
    staminaPerHour: 0,
    energyPerHour: 0,
    moodPerHour: 0,
    temperaturePerHour: 0,
    staminaMaxReduction: 0,
    energyConsumptionMultiplier: 1,
    actionPowerReduction: 0,
    productionReduction: 0,
    consumptionReduction: 0,
    infectionResistance: 0,
    dangerReduction: 0,
    moodRecoveryBlocked: false,
    preventsMoving: false,
    preventsAction: false,
    preventsCombat: false,
    coldImmunity: false,
    hiddenResourceDiscovery: false,
    craftingEnergyReduction: 0,
    staminaConsumptionReduction: 0,
  };

  for (const effect of active) {
    const def = STATUS_DEFINITIONS[effect.id];
    if (!def) continue;

    mods.healthPerHour += def.healthPerHour;
    mods.staminaPerHour += def.staminaPerHour;
    mods.energyPerHour += def.energyPerHour;
    mods.moodPerHour += def.moodPerHour;
    mods.temperaturePerHour += def.temperaturePerHour;
    mods.staminaMaxReduction += def.staminaMaxReduction;
    mods.energyConsumptionMultiplier *= def.energyConsumptionMultiplier;
    mods.actionPowerReduction += def.actionPowerReduction;
    mods.productionReduction += def.productionReduction;
    mods.consumptionReduction += def.consumptionReduction;
    mods.infectionResistance += def.infectionResistance;
    mods.dangerReduction += def.dangerReduction;
    if (def.moodRecoveryBlocked) mods.moodRecoveryBlocked = true;
    if (def.preventsMoving) mods.preventsMoving = true;
    if (def.preventsAction) mods.preventsAction = true;
    if (def.preventsCombat) mods.preventsCombat = true;
    if (def.coldImmunity) mods.coldImmunity = true;
    if (def.hiddenResourceDiscovery) mods.hiddenResourceDiscovery = true;
    mods.craftingEnergyReduction += def.craftingEnergyReduction;
    mods.staminaConsumptionReduction += def.staminaConsumptionReduction;
  }

  const activeIds = new Set(active.map(e => e.id));

  if (activeIds.has('疲惫') && activeIds.has('沮丧')) {
    mods.actionPowerReduction = 0.5;
  }

  if (activeIds.has('中毒') && activeIds.has('疾病')) {
    mods.healthPerHour -= 0.8;
    mods.staminaPerHour -= 0.8;
  }

  return mods;
}
