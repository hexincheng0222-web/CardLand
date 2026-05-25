// ============================================================
// CardLand Rest System — Short Rest / Long Rest / Sleep / Spring
// Pure functions for rest mechanics
// Integrates: P1.1 Clock, P1.2 Attributes, P1.5 Map
// ============================================================

import type { WeatherId, StatusEffectId } from '@data/types';
import type { Attributes } from './attributes';
import { clampAttributes, BASE_DECAY_RATES } from './attributes';

// ============================================================
// Types
// ============================================================

export type RestType = '短休' | '长休' | '睡眠' | '温泉';

/** Shelter level: 0=露天, 1=简易营地, 2=加固营地, 3=木屋 */
export type ShelterLevel = 0 | 1 | 2 | 3;

export interface RestContext {
  /** Current map point ID (used for温泉 check: C4-South) */
  pointId: string;
  /** Weather at time of rest */
  weather: WeatherId;
  /** Environment temperature for body temp convergence */
  environmentTemperature: number;
  /** Whether a campfire is active at this location */
  hasCampfire: boolean;
  /** Shelter level at current location (0=露天) */
  shelterLevel: ShelterLevel;
  /** Whether the location is a designated rest point (type: '休息点') */
  isRestPoint: boolean;
  /** Whether the location has a warm spring (温泉) */
  isWarmSpring: boolean;
}

/** Attribute deltas from a single rest action */
export interface RestRecovery {
  stamina: number;      // 体力值 delta (% of max → flat: +30 means +30)
  energy: number;       // 精力值 delta
  satiety: number;      // 饱食度 delta (usually negative from decay)
  thirst: number;       // 口渴度 delta (usually negative from decay)
  dirt: number;         // 污垢 delta (positive = dirtier)
  mood: number;         // 心情 delta
  health: number;       // 健康值 delta
  temperature: number;  // 体温 delta
}

export interface RestResult {
  /** Whether the rest was allowed */
  success: boolean;
  /** Failure reason if not allowed */
  failReason?: string;
  /** Time cost in minutes */
  timeCost: number;
  /** Rest type used */
  restType: RestType;
  /** Net attribute deltas applied */
  recovery: RestRecovery;
  /** New attributes after rest (clamped) */
  newAttributes: Attributes;
  /** Status effects gained from this rest */
  statusEffectsGained: StatusEffectId[];
  /** Whether a beast attack was triggered (睡眠 wilderness only) */
  beastAttack: boolean;
  /** Whether wet status was triggered (睡眠 wilderness + rainstorm) */
  wetTriggered: boolean;
}

// ============================================================
// Constants
// ============================================================

const REST_DURATIONS: Record<RestType, number> = {
  '短休': 60,
  '长休': 120,
  '睡眠': 480,
  '温泉': 60,
};

// Stamina recovery is a % of max (100), so +30 means +30 points
const STAMINA_RECOVERY: Record<RestType, number> = {
  '短休': 30,
  '长休': 60,
  '睡眠': 100,
  '温泉': 80,
};

const ENERGY_RECOVERY: Record<RestType, number> = {
  '短休': 20,
  '长休': 50,
  '睡眠': 80,
  '温泉': 70,
};

const HEALTH_RECOVERY: Record<RestType, number> = {
  '短休': 0,
  '长休': 5,   // 轻伤
  '睡眠': 10,  // 中伤
  '温泉': 15,
};

const MOOD_RECOVERY: Record<RestType, number> = {
  '短休': 0,
  '长休': 0,
  '睡眠': 0,
  '温泉': 20,
};

// ============================================================
// 1. canRest — Check if rest type is allowed
// ============================================================

/**
 * Check whether a rest type is allowed at the current location.
 *
 * Rules:
 * - 短休: always allowed (any safe location)
 * - 长休: requires Lv1+ shelter OR rest point
 * - 睡眠: requires Lv2+ shelter
 * - 温泉: only at warm spring locations (C4)
 */
export function canRest(
  restType: RestType,
  context: RestContext,
): { allowed: boolean; reason?: string } {
  switch (restType) {
    case '短休':
      return { allowed: true };

    case '长休':
      if (context.shelterLevel >= 1 || context.isRestPoint) {
        return { allowed: true };
      }
      return { allowed: false, reason: '长休需要Lv1+营地或休息点' };

    case '睡眠':
      if (context.shelterLevel >= 2) {
        return { allowed: true };
      }
      if (context.shelterLevel === 0) {
        return { allowed: true }; // wilderness sleep allowed but risky
      }
      return { allowed: false, reason: '睡眠需要Lv2+营地（露天睡眠风险极高）' };

    case '温泉':
      if (context.isWarmSpring) {
        return { allowed: true };
      }
      return { allowed: false, reason: '温泉休息仅限温泉池（C4）' };
  }
}

// ============================================================
// 2. calculateRestRecovery — Compute attribute deltas
// ============================================================

/**
 * Calculate the net attribute recovery for a rest action.
 *
 * This computes:
 * 1. Base recovery (stamina %, energy, health, mood)
 * 2. Natural decay over rest duration
 * 3. Conditional modifiers (campfire, shelter, thresholds)
 *
 * All values are deltas (positive = gain, negative = loss).
 */
export function calculateRestRecovery(
  restType: RestType,
  attributes: Attributes,
  context: RestContext,
): RestRecovery {
  const dt = REST_DURATIONS[restType] / 60; // duration in hours
  const satiety = attributes['饱食度'] ?? 60;
  const health = attributes['健康值'] ?? 100;
  const energy = attributes['精力值'] ?? 80;
  const isHot = context.weather === '酷热';

  // ── Stamina ──
  let stamina = STAMINA_RECOVERY[restType];

  // Short rest: rest point bonus
  if (restType === '短休' && context.isRestPoint) {
    stamina += 10; // 30% → 40% at rest point
  }

  // Campfire/shelter bonuses for short rest
  if (restType === '短休' && context.hasCampfire) {
    // No explicit stamina bonus from campfire alone for short rest
    // (campfire primarily affects mood/temperature)
  }
  if (restType === '短休' && context.shelterLevel >= 1) {
    stamina += 10; // 营地: 额外+10%
  }

  // 饱食>80 bonus
  if (satiety > 80) {
    if (restType === '短休') stamina += 10;
    if (restType === '长休') stamina += 15;
  }

  // 健康≤60: recovery -50% (short rest only per doc)
  if (restType === '短休' && health <= 60) {
    stamina = Math.floor(stamina * 0.5);
  }

  // Sleep wilderness penalty
  if (restType === '睡眠' && context.shelterLevel === 0) {
    stamina = 30; // only +30% in wilderness
  }

  // ── Energy ──
  let energyDelta = ENERGY_RECOVERY[restType];

  // Short rest: campfire/shelter energy bonus
  if (restType === '短休') {
    if (context.shelterLevel >= 1) {
      energyDelta += 5; // 营地: 额外+5
    }
    // 精力≤50: recovery -50%
    if (energy <= 50) {
      energyDelta = Math.floor(energyDelta * 0.5);
    }
  }

  // Natural energy decay during rest
  const energyDecay = BASE_DECAY_RATES['精力值'] * dt; // -0.5/h
  energyDelta += energyDecay;

  // ── Satiety (natural decay only) ──
  let satietyDecay = BASE_DECAY_RATES['饱食度'] * dt; // -1/h
  // 饱食≤30: extra -0.5/h
  if (satiety <= 30) {
    satietyDecay += -0.5 * dt;
  }

  // ── Thirst (natural decay + weather) ──
  let thirstDecay = BASE_DECAY_RATES['口渴度'] * dt; // -1.5/h
  if (isHot) {
    // 炎热环境: extra decay (flat values per rest type from design doc)
    if (restType === '短休') thirstDecay += -1;
    if (restType === '长休') thirstDecay += -2;
    if (restType === '睡眠') thirstDecay += -8;
  }
  // 温泉: enhanced thirst (出汗)
  if (restType === '温泉') {
    thirstDecay = -2 * dt; // -2/h instead of -1.5/h
  }

  // ── Dirt (natural accumulation) ──
  let dirtDelta = BASE_DECAY_RATES['污垢'] * dt; // +1/h
  if (restType === '温泉') {
    dirtDelta = -40 + 1 * dt; // -40 cleaning + natural +1/h
  }

  // ── Mood ──
  // Design doc: mood decay and bonuses are flat totals per rest type
  const moodDecayTotals: Record<RestType, number> = {
    '短休': -0.5,
    '长休': -1,
    '睡眠': -4,
    '温泉': -0.5,
  };
  const campfireMoodTotals: Record<RestType, number> = {
    '短休': 0.5,
    '长休': 1,
    '睡眠': 4,
    '温泉': 0,
  };
  let moodDelta = MOOD_RECOVERY[restType] + moodDecayTotals[restType];

  if (context.hasCampfire) {
    moodDelta += campfireMoodTotals[restType];
  }
  if (context.shelterLevel >= 1) {
    if (restType === '短休') moodDelta += 0.5;
    if (restType === '睡眠') moodDelta += 4;
  }

  // ── Health ──
  let healthDelta = HEALTH_RECOVERY[restType];

  // ── Temperature ──
  let tempDelta = 0;
  const currentTemp = attributes['体温'] ?? 60;
  const envTemp = context.environmentTemperature;

  if (restType === '温泉') {
    tempDelta = 15 * dt;
  } else {
    // Design doc: ±0.5/h (短休), ±1 (长休), ±4 (睡眠) — flat totals
    const convergenceRates: Record<RestType, number> = {
      '短休': 0.5,
      '长休': 1,
      '睡眠': 4,
      '温泉': 0,
    };
    const totalConvergence = convergenceRates[restType];
    if (currentTemp > envTemp) {
      tempDelta = -totalConvergence;
    } else if (currentTemp < envTemp) {
      tempDelta = totalConvergence;
    }

    if (context.hasCampfire) {
      tempDelta += 10 * dt;
    }
    if (context.shelterLevel >= 1 && tempDelta < 0) {
      tempDelta = 0;
    }
  }

  return {
    stamina,
    energy: Math.round(energyDelta * 100) / 100,
    satiety: Math.round(satietyDecay * 100) / 100,
    thirst: Math.round(thirstDecay * 100) / 100,
    dirt: Math.round(dirtDelta * 100) / 100,
    mood: Math.round(moodDelta * 100) / 100,
    health: healthDelta,
    temperature: Math.round(tempDelta * 100) / 100,
  };
}

// ============================================================
// 3. executeRest — Full rest execution
// ============================================================

/**
 * Execute a rest action. Returns full result with new state.
 *
 * Pipeline:
 * 1. Validate rest is allowed (canRest)
 * 2. Calculate recovery deltas
 * 3. Apply recovery to attributes
 * 4. Clamp attributes
 * 5. Roll for wilderness sleep events (beast attack, wet)
 * 6. Grant status effects (精神饱满 from sleep)
 *
 * Pure function — returns all new state without mutation.
 */
export function executeRest(
  attributes: Attributes,
  restType: RestType,
  context: RestContext,
  rng: () => number = Math.random,
): RestResult {
  // 1. Validate
  const check = canRest(restType, context);
  if (!check.allowed) {
    return {
      success: false,
      failReason: check.reason,
      timeCost: 0,
      restType,
      recovery: { stamina: 0, energy: 0, satiety: 0, thirst: 0, dirt: 0, mood: 0, health: 0, temperature: 0 },
      newAttributes: { ...attributes },
      statusEffectsGained: [],
      beastAttack: false,
      wetTriggered: false,
    };
  }

  // 2. Calculate recovery
  const recovery = calculateRestRecovery(restType, attributes, context);

  // 3. Apply recovery
  const newAttrs: Attributes = { ...attributes };
  newAttrs['体力值'] = (newAttrs['体力值'] ?? 80) + recovery.stamina;
  newAttrs['精力值'] = (newAttrs['精力值'] ?? 80) + recovery.energy;
  newAttrs['饱食度'] = (newAttrs['饱食度'] ?? 60) + recovery.satiety;
  newAttrs['口渴度'] = (newAttrs['口渴度'] ?? 60) + recovery.thirst;
  newAttrs['污垢'] = (newAttrs['污垢'] ?? 20) + recovery.dirt;
  newAttrs['心情'] = (newAttrs['心情'] ?? 70) + recovery.mood;
  newAttrs['健康值'] = (newAttrs['健康值'] ?? 100) + recovery.health;
  newAttrs['体温'] = (newAttrs['体温'] ?? 60) + recovery.temperature;

  // 4. Clamp
  const clampedAttrs = clampAttributes(newAttrs);

  // 5. Wilderness sleep events
  let beastAttack = false;
  let wetTriggered = false;

  if (restType === '睡眠' && context.shelterLevel === 0) {
    // 33% beast attack
    if (rng() < 0.33) {
      beastAttack = true;
    }
    // 暴雨×露天 → wet
    if (context.weather === '暴雨') {
      wetTriggered = true;
    }
  }

  // 6. Status effects
  const statusEffectsGained: StatusEffectId[] = [];
  if (restType === '睡眠') {
    statusEffectsGained.push('精神饱满');
  }
  // 温泉解除灼伤
  if (restType === '温泉') {
    statusEffectsGained.push('清爽'); // 温泉后清爽
  }

  return {
    success: true,
    timeCost: REST_DURATIONS[restType],
    restType,
    recovery,
    newAttributes: clampedAttrs,
    statusEffectsGained,
    beastAttack,
    wetTriggered,
  };
}
