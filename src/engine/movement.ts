// ============================================================
// CardLand Movement Engine
// Pure functions for movement cost calculation and execution
// ============================================================

import type { WeatherId } from '@data/types';
import type { Attributes } from './attributes';
import type { Inventory } from './inventory';
import { getItemQuantity } from './inventory';
import { MOVEMENT_COSTS_TABLE, getMovementCost as lookupMovementCost } from '@data/map';
import type { MovementCostEntry } from '@data/map';

// ============================================================
// Re-export MovementCostEntry for consumers
// ============================================================

export type { MovementCostEntry } from '@data/map';

// ============================================================
// Types
// ============================================================

/** Describes a single modifier to movement cost */
export interface MovementModifier {
  attributeId: string;
  description: string;
  timeMultiplier: number;
  staminaMultiplier: number;
}

/** Result of getMovementCost — base path data or null if no path */
export type MovementCostLookup = MovementCostEntry | null;

/** Result of executing a full movement */
export interface MoveResult {
  success: boolean;
  timeCost: number;       // minutes consumed
  staminaCost: number;    // stamina consumed (negative = loss)
  newPosition: string;    // destination point ID
  modifiers: MovementModifier[];
  fogEvent?: {
    triggered: true;
    extraTime: 30;         // always 30 minutes
    message: '在大雾中迷路了，额外消耗30分钟';
  };
  message: string;
}

// ============================================================
// Helpers
// ============================================================

/**
 * Extract the zone (single letter A-F) or subzone (e.g. "A1") from a point ID.
 * "A1-North" → "A1", "A" → "A"
 */
export function getPointZone(pointId: string): string {
  const dash = pointId.indexOf('-');
  return dash >= 0 ? pointId.substring(0, dash) : pointId;
}

// ============================================================
// Status Modifier Calculations (7 checks)
// ============================================================

/** 负重 ≤25（轻装）: time -20%, stamina -20% */
function calcWeightLightModifier(weight: number): MovementModifier | null {
  if (weight <= 25) {
    return {
      attributeId: '负重',
      description: '轻装出行',
      timeMultiplier: 0.8,
      staminaMultiplier: 0.8,
    };
  }
  return null;
}

/** 负重 >50（负重）: time +30%, stamina +30% */
function calcWeightHeavyModifier(weight: number): MovementModifier | null {
  if (weight > 50) {
    return {
      attributeId: '负重',
      description: '负重前行',
      timeMultiplier: 1.3,
      staminaMultiplier: 1.3,
    };
  }
  return null;
}

/** 负重 >80（超载）: time +50%, stamina +50% */
function calcWeightOverloadModifier(weight: number): MovementModifier | null {
  if (weight > 80) {
    return {
      attributeId: '负重',
      description: '超载移动',
      timeMultiplier: 1.5,
      staminaMultiplier: 1.5,
    };
  }
  return null;
}

/** 体力 ≤30: time +50% */
function calcStaminaLowModifier(stamina: number): MovementModifier | null {
  if (stamina <= 30) {
    return {
      attributeId: '体力值',
      description: '体力不足',
      timeMultiplier: 1.5,
      staminaMultiplier: 1.0,
    };
  }
  return null;
}

/** 健康 ≤40: time +30% */
function calcHealthLowModifier(health: number): MovementModifier | null {
  if (health <= 40) {
    return {
      attributeId: '健康值',
      description: '健康不佳',
      timeMultiplier: 1.3,
      staminaMultiplier: 1.0,
    };
  }
  return null;
}

/** 心情 ≤30: stamina +20% */
function calcMoodLowModifier(mood: number): MovementModifier | null {
  if (mood <= 30) {
    return {
      attributeId: '心情',
      description: '心情低落',
      timeMultiplier: 1.0,
      staminaMultiplier: 1.2,
    };
  }
  return null;
}

/** 精力 ≤30: time +30% */
function calcEnergyLowModifier(energy: number): MovementModifier | null {
  if (energy <= 30) {
    return {
      attributeId: '精力值',
      description: '精力不足',
      timeMultiplier: 1.3,
      staminaMultiplier: 1.0,
    };
  }
  return null;
}

/** 暴雨: time +50% */
function calcStormModifier(weather: WeatherId): MovementModifier | null {
  if (weather === '暴雨') {
    return {
      attributeId: '天气',
      description: '暴雨天气',
      timeMultiplier: 1.5,
      staminaMultiplier: 1.0,
    };
  }
  return null;
}

/** 大雾: time +25% (base fog modifier) */
function calcFogModifier(weather: WeatherId): MovementModifier | null {
  if (weather === '大雾') {
    return {
      attributeId: '天气',
      description: '大雾天气',
      timeMultiplier: 1.25,
      staminaMultiplier: 1.0,
    };
  }
  return null;
}

/** 酷热: stamina +30% */
function calcHeatModifier(weather: WeatherId): MovementModifier | null {
  if (weather === '酷热') {
    return {
      attributeId: '天气',
      description: '酷热天气',
      timeMultiplier: 1.0,
      staminaMultiplier: 1.3,
    };
  }
  return null;
}

// ============================================================
// Aggregate helpers
// ============================================================

/** Collect all applicable status + weather modifiers */
function collectModifiers(
  attributes: Attributes,
  weather: WeatherId,
): MovementModifier[] {
  const weight = attributes['负重'] ?? 0;
  const stamina = attributes['体力值'] ?? 0;
  const health = attributes['健康值'] ?? 0;
  const mood = attributes['心情'] ?? 0;
  const energy = attributes['精力值'] ?? 0;

  const modifiers: MovementModifier[] = [];

  // Weight tiers are mutually exclusive (highest matching tier wins)
  if (weight > 80) {
    const m = calcWeightOverloadModifier(weight);
    if (m) modifiers.push(m);
  } else if (weight > 50) {
    const m = calcWeightHeavyModifier(weight);
    if (m) modifiers.push(m);
  } else if (weight <= 25) {
    const m = calcWeightLightModifier(weight);
    if (m) modifiers.push(m);
  }

  // Other modifiers are independent and can stack
  const checks = [
    calcStaminaLowModifier(stamina),
    calcHealthLowModifier(health),
    calcMoodLowModifier(mood),
    calcEnergyLowModifier(energy),
    calcStormModifier(weather),
    calcFogModifier(weather),
    calcHeatModifier(weather),
  ];

  for (const m of checks) {
    if (m !== null) modifiers.push(m);
  }

  return modifiers;
}

/** Multiply all time multipliers together */
function aggregateTimeMultiplier(modifiers: MovementModifier[]): number {
  let result = 1;
  for (const m of modifiers) {
    result *= m.timeMultiplier;
  }
  return result;
}

/** Multiply all stamina multipliers together */
function aggregateStaminaMultiplier(modifiers: MovementModifier[]): number {
  let result = 1;
  for (const m of modifiers) {
    result *= m.staminaMultiplier;
  }
  return result;
}

/** Apply a multiplier and round to nearest integer (min 1 for time) */
function applyMultiplier(base: number, multiplier: number, min: number): number {
  return Math.max(min, Math.round(base * multiplier));
}

// ============================================================
// 1. getMovementCost — Base cost lookup
// ============================================================

/**
 * Look up the base movement cost between two locations.
 * Checks direct path (e.g. "A1"↔"B1") and cross-zone path (e.g. "A"↔"C").
 * Returns null if no valid path exists.
 *
 * @param from - Starting location ID (e.g. "A1-North" or "A1" or "A")
 * @param to - Destination location ID
 * @returns MovementCostEntry or null if path doesn't exist
 */
export function getMovementCost(
  from: string,
  to: string,
): MovementCostLookup {
  const fromZone = getPointZone(from);
  const toZone = getPointZone(to);

  // Same zone → use sub-zone or zone lookup
  if (fromZone === toZone) {
    // Direct match in table
    const direct = MOVEMENT_COSTS_TABLE.find(
      (m) =>
        (m.from === fromZone && m.to === toZone) ||
        (m.from === toZone && m.to === fromZone),
    );
    if (direct) return direct;

    // If same zone but no sub-zone entry, treat as intra-zone (15min/-10)
    if (fromZone.charAt(0) === toZone.charAt(0)) {
      return {
        from: fromZone,
        to: toZone,
        timeMinutes: 15,
        staminaCost: -10,
        requirements: [],
      };
    }

    return null;
  }

  // Cross-zone: check table for sub-zone pair, then zone pair
  const cost = lookupMovementCost(fromZone, toZone);
  return cost ?? null;
}

// ============================================================
// 2. calculateMovementTime — Minutes with all modifiers
// ============================================================

/**
 * Calculate the final movement time in minutes, applying all
 * status and weather modifiers to the base cost.
 *
 * @param baseCost - Base movement cost entry
 * @param attributes - Current player attributes
 * @param weather - Current weather
 * @returns Final time in minutes (minimum 1)
 */
export function calculateMovementTime(
  baseCost: MovementCostEntry,
  attributes: Attributes,
  weather: WeatherId,
): number {
  const modifiers = collectModifiers(attributes, weather);
  const multiplier = aggregateTimeMultiplier(modifiers);
  return applyMultiplier(baseCost.timeMinutes, multiplier, 1);
}

// ============================================================
// 3. calculateMovementStamina — Stamina with all modifiers
// ============================================================

/**
 * Calculate the final stamina cost (as positive number = amount consumed),
 * applying all status and weather modifiers.
 *
 * @param baseCost - Base movement cost entry
 * @param attributes - Current player attributes
 * @param weather - Current weather
 * @returns Stamina consumed (positive number, minimum 1)
 */
export function calculateMovementStamina(
  baseCost: MovementCostEntry,
  attributes: Attributes,
  weather: WeatherId,
): number {
  const modifiers = collectModifiers(attributes, weather);
  const multiplier = aggregateStaminaMultiplier(modifiers);
  // baseCost.staminaCost is negative (e.g. -20), so abs for calculation
  const baseAbs = Math.abs(baseCost.staminaCost);
  return applyMultiplier(baseAbs, multiplier, 1);
}

// ============================================================
// 4. checkMovementRequirements — Item-based path gating
// ============================================================

/**
 * Check whether the player has all required items for a movement path.
 * Returns whether movement is possible and which items are missing.
 *
 * @param from - Starting location
 * @param to - Destination location
 * @param inventory - Player's inventory
 * @returns { canMove, missingItems }
 */
export function checkMovementRequirements(
  from: string,
  to: string,
  inventory: Inventory,
): { canMove: boolean; missingItems: string[] } {
  const fromZone = getPointZone(from);
  const toZone = getPointZone(to);

  const cost = lookupMovementCost(fromZone, toZone);
  if (!cost) {
    return { canMove: false, missingItems: [] };
  }

  const missingItems: string[] = [];
  for (const req of cost.requirements) {
    const qty = getItemQuantity(inventory, req);
    if (qty <= 0) {
      missingItems.push(req);
    }
  }

  return {
    canMove: missingItems.length === 0,
    missingItems,
  };
}

// ============================================================
// 5. executeMovement — Full move execution
// ============================================================

/**
 * Execute a complete movement from one location to another.
 *
 * Pipeline:
 * 1. Validate path exists
 * 2. Check requirements (items)
 * 3. Calculate base + modified time/stamina
 * 4. Check stamina sufficiency
 * 5. Apply stamina cost
 * 6. Advance game clock
 * 7. Roll for fog event (大雾: 15% chance, +30 min)
 *
 * @param state - Current game state snapshot
 * @param from - Starting location
 * @param to - Destination location
 * @param weather - Current weather
 * @param rng - Seeded random number generator (0-1 float)
 * @returns MoveResult with success/failure details
 */
export function executeMovement(
  state: {
    attributes: Attributes;
    inventory: Inventory;
    currentPosition: string;
  },
  from: string,
  to: string,
  weather: WeatherId,
  rng: () => number,
): MoveResult {
  // Default failure result
  const failResult = (message: string): MoveResult => ({
    success: false,
    timeCost: 0,
    staminaCost: 0,
    newPosition: from,
    modifiers: [],
    message,
  });

  // 1. Check path exists
  const fromZone = getPointZone(from);
  const toZone = getPointZone(to);
  const baseCost = lookupMovementCost(fromZone, toZone);
  if (!baseCost) {
    return failResult(`无法从 ${from} 移动到 ${to}：路径不存在`);
  }

  // 2. Check requirements
  const reqCheck = checkMovementRequirements(from, to, state.inventory);
  if (!reqCheck.canMove) {
    const missing = reqCheck.missingItems.join('、');
    return failResult(`无法移动：缺少 ${missing}`);
  }

  // 3. Calculate modifiers and final costs
  const modifiers = collectModifiers(state.attributes, weather);
  const finalTime = calculateMovementTime(baseCost, state.attributes, weather);
  const finalStamina = calculateMovementStamina(baseCost, state.attributes, weather);

  // 4. Check stamina sufficiency
  const currentStamina = state.attributes['体力值'] ?? 0;
  if (currentStamina < finalStamina) {
    return failResult(
      `体力不足：需要 ${finalStamina}，当前 ${Math.floor(currentStamina)}`,
    );
  }

  // 5. Apply stamina cost
  const newStamina = currentStamina - finalStamina;
  void newStamina; // calculated for future use

  // 6. Calculate total time (base + fog extra)
  let totalTime = finalTime;
  let fogEvent: MoveResult['fogEvent'];

  // 7. Roll for fog event (大雾: 15% chance → +30 min)
  if (weather === '大雾') {
    const fogRoll = rng();
    if (fogRoll < 0.15) {
      totalTime += 30;
      fogEvent = {
        triggered: true,
        extraTime: 30,
        message: '在大雾中迷路了，额外消耗30分钟',
      };
    }
  }

  // 8. Build success result
  return {
    success: true,
    timeCost: totalTime,
    staminaCost: finalStamina,
    newPosition: to,
    modifiers,
    fogEvent,
    message: fogEvent
      ? `从 ${from} 移动到 ${to}（${totalTime}分钟），${fogEvent.message}`
      : `从 ${from} 移动到 ${to}（${totalTime}分钟，体力-${finalStamina}）`,
  };
}
