// ============================================================
// CardLand Explore & Gather Engine
// Pure functions for exploration, gathering, food decomposition
// Integrates: P1.1 Clock, P1.2 Attributes, P1.3 Items,
//             P1.4 Inventory, P1.5 Map reserves
// ============================================================

import type { ItemId, WeatherId } from '@data/types';
import type { Attributes } from './attributes';
import type { Inventory } from './inventory';
import type { ResourceReserve } from '@data/map';
import { getPointById, depleteReserve } from '@data/map';
import { addItem, getItemDef } from './inventory';

// ============================================================
// Types
// ============================================================

/** Tool tier for food decomposition */
export type ToolType = 'bare' | 'stone' | 'iron' | 'obsidian';

/**
 * Raw food categories for decomposition.
 * '鱼' and '兽肉' are conceptual — not ItemIds.
 * They decompose into actual ItemIds (生肉, 食物, 水).
 */
export type RawFoodCategory = '蟹贝' | '鱼' | '椰子' | '蛋' | '兽肉';

/** Attribute cost of an explore action */
export interface ExploreCost {
  stamina: number;   // negative = stamina loss
  energy: number;    // negative = energy loss
  dirt: number;      // positive = dirt increase (negative = wash)
}

/** Result of decomposing a raw food item */
export interface FoodDecomposition {
  outputs: { itemId: ItemId; quantity: number }[];
}

/** Result of gathering at a map point */
export interface GatherResult {
  /** Raw outputs before decomposition (for UI display) */
  rawItems: { itemId: ItemId; quantity: number }[];
  /** Actual items after food decomposition (goes into inventory) */
  decomposedItems: { itemId: ItemId; quantity: number }[];
  /** Items that couldn't fit in inventory */
  overflow: number;
  /** Blueprint name if dropped, else null */
  blueprintDrop: string | null;
  /** Which reserves were consumed */
  reservesDepleted: { pointId: string; itemId: ItemId; amount: number }[];
}

/** Full state needed for an explore action */
export interface ExploreState {
  attributes: Attributes;
  inventory: Inventory;
  reserves: ResourceReserve[];
  weather: WeatherId;
  isNight: boolean;
  toolType: ToolType;
}

/** Full result of an explore action */
export interface ExploreResult {
  timeCost: number;
  cost: ExploreCost;
  gatherResult: GatherResult;
  newInventory: Inventory;
  newReserves: ResourceReserve[];
  canExplore: boolean;
  failReason?: string;
}

// ============================================================
// Constants
// ============================================================

const BASE_EXPLORE_TIME = 30;
const BASE_STAMINA_COST = -5;
const BASE_ENERGY_COST = 0;
const BASE_DIRT_INCREASE = 2;

/** Zone → default food category for generic '食物' outputs */
const ZONE_FOOD_CATEGORY: Record<string, RawFoodCategory> = {
  A: '蟹贝',
  B: '兽肉',
  C: '蛋',
  D: '鱼',
  E: '鱼',
  F: '兽肉',
};

/** Sub-zone overrides for food category */
const SUBZONE_FOOD_CATEGORY: Record<string, RawFoodCategory> = {
  A3: '椰子',
};

/** Blueprint drops: pointId → blueprint name (33% chance) */
const BLUEPRINT_DROPS: Record<string, string> = {
  'A4-North': '工作台蓝图',
};

// ============================================================
// Helpers
// ============================================================

/** Swamp terrain: zone D (红树林/沼泽) */
function isSwampTerrain(zone: string): boolean {
  return zone === 'D';
}

/** Cave terrain: zone F (遗迹/洞穴) or C2 (矿洞) */
function isCaveTerrain(zone: string, subZone: string): boolean {
  return zone === 'F' || (zone === 'C' && subZone === 'C2');
}

/** Get the food category for a point's '食物' outputs */
function getFoodCategoryForPoint(pointId: string): RawFoodCategory {
  const parts = pointId.split('-');
  const subZone = parts[0];
  const zone = subZone.charAt(0);

  if (SUBZONE_FOOD_CATEGORY[subZone]) {
    return SUBZONE_FOOD_CATEGORY[subZone];
  }
  return ZONE_FOOD_CATEGORY[zone] ?? '兽肉';
}

// ============================================================
// 1. calculateExploreTime — Minutes for explore action
// ============================================================

/**
 * Calculate time cost (in minutes) for exploring a point.
 *
 * Base: 30 minutes
 * Status modifiers (additive to multiplier):
 *   饱食度 ≤ 30: +50%
 *   体力值 ≤ 50: +30%
 *   健康值 ≤ 30: +50%
 * Weather modifier (multiplicative):
 *   暴雨: +50% (×1.5)
 */
export function calculateExploreTime(
  _pointId: string,
  attributes: Attributes,
  weather: WeatherId,
): number {
  const satiety = attributes['饱食度'] ?? 60;
  const stamina = attributes['体力值'] ?? 80;
  const health = attributes['健康值'] ?? 100;

  let timeMultiplier = 1.0;

  // Status modifiers (additive)
  if (satiety <= 30) timeMultiplier += 0.5;
  if (stamina <= 50) timeMultiplier += 0.3;
  if (health <= 30) timeMultiplier += 0.5;

  // Weather modifier (multiplicative)
  if (weather === '暴雨') timeMultiplier *= 1.5;

  return Math.ceil(BASE_EXPLORE_TIME * timeMultiplier);
}

// ============================================================
// 2. calculateExploreCost — Stamina, energy, dirt changes
// ============================================================

/**
 * Calculate attribute costs for exploring a point.
 *
 * Stamina base: -5
 *   饱食度 ≤ 60: additional -2
 *   口渴度 ≤ 60: additional -2
 *   负重 > 50:   additional -3
 *   健康值 ≤ 60: additional -2
 *
 * Energy base: 0
 *   精力值 ≤ 50: -3
 *   饱食度 ≤ 30: -3
 *
 * Dirt base: +2
 *   沼泽 (zone D): +2
 *   洞穴 (zone F / C2): +2
 */
export function calculateExploreCost(
  pointId: string,
  attributes: Attributes,
): ExploreCost {
  const point = getPointById(pointId);
  const satiety = attributes['饱食度'] ?? 60;
  const thirst = attributes['口渴度'] ?? 60;
  const weight = attributes['负重'] ?? 0;
  const health = attributes['健康值'] ?? 100;
  const energy = attributes['精力值'] ?? 80;

  // Stamina cost
  let staminaCost = BASE_STAMINA_COST;
  if (satiety <= 60) staminaCost -= 2;
  if (thirst <= 60) staminaCost -= 2;
  if (weight > 50) staminaCost -= 3;
  if (health <= 60) staminaCost -= 2;

  // Energy cost
  let energyCost = BASE_ENERGY_COST;
  if (energy <= 50) energyCost -= 3;
  if (satiety <= 30) energyCost -= 3;

  // Dirt increase
  let dirtIncrease = BASE_DIRT_INCREASE;
  if (point) {
    if (isSwampTerrain(point.zone) || isCaveTerrain(point.zone, point.subZone)) {
      dirtIncrease += 2;
    }
  }

  return { stamina: staminaCost, energy: energyCost, dirt: dirtIncrease };
}

// ============================================================
// 3. decomposeFood — Transform raw food into processed items
// ============================================================

/**
 * Decompose a raw food category into processed items by tool tier.
 *
 * 🦀 蟹贝: bare→💧×1, stone→🥩×1+💧×1, iron→🥩×1+💧×2, obsidian→🥩×2+💧×2
 * 🐟 鱼:   bare→🥩×1, stone→🥩×2, iron→🥩×2, obsidian→🥩×3
 * 🥥 椰子: bare→🍖|💧, stone→🍖+💧, iron→🍖×2+💧, obsidian→🍖×2+💧×2
 * 🥚 蛋:   bare/stone/iron→🍖×1, obsidian→🍖×2
 * 🐗 兽肉: bare→🥩×2, stone→🥩×3, iron→🥩×4, obsidian→🥩×5
 *
 * 🥩 = 生肉, 🍖 = 食物, 💧 = 水
 */
export function decomposeFood(
  rawFoodItem: RawFoodCategory,
  toolType: ToolType,
  rng: () => number = Math.random,
): FoodDecomposition {
  switch (rawFoodItem) {
    case '蟹贝':
      if (toolType === 'obsidian') {
        return { outputs: [{ itemId: '生肉', quantity: 2 }, { itemId: '水', quantity: 2 }] };
      }
      if (toolType === 'iron') {
        return { outputs: [{ itemId: '生肉', quantity: 1 }, { itemId: '水', quantity: 2 }] };
      }
      if (toolType === 'stone') {
        return { outputs: [{ itemId: '生肉', quantity: 1 }, { itemId: '水', quantity: 1 }] };
      }
      return { outputs: [{ itemId: '水', quantity: 1 }] };

    case '鱼':
      if (toolType === 'obsidian') {
        return { outputs: [{ itemId: '生肉', quantity: 3 }] };
      }
      if (toolType === 'bare') {
        return { outputs: [{ itemId: '生肉', quantity: 1 }] };
      }
      return { outputs: [{ itemId: '生肉', quantity: 2 }] };

    case '椰子':
      if (toolType === 'obsidian') {
        return { outputs: [{ itemId: '食物', quantity: 2 }, { itemId: '水', quantity: 2 }] };
      }
      if (toolType === 'iron') {
        return { outputs: [{ itemId: '食物', quantity: 2 }, { itemId: '水', quantity: 1 }] };
      }
      if (toolType === 'stone') {
        return { outputs: [{ itemId: '食物', quantity: 1 }, { itemId: '水', quantity: 1 }] };
      }
      // bare: random 食物 or 水
      return rng() < 0.5
        ? { outputs: [{ itemId: '食物', quantity: 1 }] }
        : { outputs: [{ itemId: '水', quantity: 1 }] };

    case '蛋':
      if (toolType === 'obsidian') {
        return { outputs: [{ itemId: '食物', quantity: 2 }] };
      }
      return { outputs: [{ itemId: '食物', quantity: 1 }] };

    case '兽肉':
      if (toolType === 'obsidian') return { outputs: [{ itemId: '生肉', quantity: 5 }] };
      if (toolType === 'iron') return { outputs: [{ itemId: '生肉', quantity: 4 }] };
      if (toolType === 'stone') return { outputs: [{ itemId: '生肉', quantity: 3 }] };
      return { outputs: [{ itemId: '生肉', quantity: 2 }] };

    default:
      return { outputs: [{ itemId: '食物', quantity: 1 }] };
  }
}

// ============================================================
// 4. rollBlueprintDrop — 33% chance from specific points
// ============================================================

/**
 * Roll for a blueprint drop from a specific point.
 * Returns the blueprint name or null.
 * Only mapped points have drops; 33% probability.
 */
export function rollBlueprintDrop(
  pointId: string,
  rng: () => number = Math.random,
): string | null {
  const blueprint = BLUEPRINT_DROPS[pointId];
  if (!blueprint) return null;
  return rng() < 0.33 ? blueprint : null;
}

// ============================================================
// 5. calculateGatherOutput — Full gather calculation
// ============================================================

/**
 * Calculate the full gather output from exploring a point.
 *
 * Output multiplier (multiplicative):
 *   饱食度 ≤ 30: ×0.5  (-50%)
 *   精力值 ≤ 30: ×0.7  (-30%)
 *   心情   ≤ 30: ×0.7  (-30%)
 *   雨天:        ×0.8  (-20%)
 *   暴雨:        ×0.5  (-50%)
 *   夜晚:        ×0.5  (-50%)
 *
 * Actual output = min(⌊rawAmount × multiplier⌋, currentReserve)
 * Food items are decomposed immediately based on tool type.
 */
export function calculateGatherOutput(
  pointId: string,
  attributes: Attributes,
  weather: WeatherId,
  isNight: boolean,
  toolType: ToolType,
  reserves: ResourceReserve[],
  rng: () => number = Math.random,
): GatherResult {
  const point = getPointById(pointId);
  if (!point || point.outputs.length === 0) {
    return {
      rawItems: [],
      decomposedItems: [],
      overflow: 0,
      blueprintDrop: null,
      reservesDepleted: [],
    };
  }

  const satiety = attributes['饱食度'] ?? 60;
  const energy = attributes['精力值'] ?? 80;
  const mood = attributes['心情'] ?? 70;

  // Output multiplier (multiplicative stacking)
  let outputMultiplier = 1.0;
  if (satiety <= 30) outputMultiplier *= 0.5;
  if (energy <= 30) outputMultiplier *= 0.7;
  if (mood <= 30) outputMultiplier *= 0.7;

  // Weather modifier
  if (weather === '雨') outputMultiplier *= 0.8;
  if (weather === '暴雨') outputMultiplier *= 0.5;

  // Night modifier
  if (isNight) outputMultiplier *= 0.5;

  const rawItems: { itemId: ItemId; quantity: number }[] = [];
  const decomposedItems: { itemId: ItemId; quantity: number }[] = [];
  const reservesDepleted: { pointId: string; itemId: ItemId; amount: number }[] = [];

  for (const output of point.outputs) {
    // Find current reserve for this point + item
    const reserve = reserves.find(
      (r) => r.pointId === pointId && r.itemId === output.itemId,
    );
    const currentStock = reserve?.currentStock ?? Infinity;

    // Skip if reserves depleted
    if (currentStock <= 0) continue;

    // Random amount between min and max
    const rawAmount = output.min + Math.floor(rng() * (output.max - output.min + 1));

    // Apply multiplier, cap by reserves
    const multiplied = Math.max(0, Math.floor(rawAmount * outputMultiplier));
    const actualAmount = Math.min(multiplied, Math.floor(currentStock));

    if (actualAmount <= 0) continue;

    rawItems.push({ itemId: output.itemId, quantity: actualAmount });
    reservesDepleted.push({ pointId, itemId: output.itemId, amount: actualAmount });

    // Decompose food items immediately
    if (output.itemId === '食物') {
      const foodCategory = getFoodCategoryForPoint(pointId);
      const decomposition = decomposeFood(foodCategory, toolType, rng);
      for (const item of decomposition.outputs) {
        decomposedItems.push({
          itemId: item.itemId,
          quantity: item.quantity * actualAmount,
        });
      }
    } else {
      // Non-food items pass through directly
      decomposedItems.push({ itemId: output.itemId, quantity: actualAmount });
    }
  }

  // Roll for blueprint drop
  const blueprintDrop = rollBlueprintDrop(pointId, rng);

  return {
    rawItems,
    decomposedItems,
    overflow: 0,
    blueprintDrop,
    reservesDepleted,
  };
}

// ============================================================
// 6. executeExplore — Full explore execution
// ============================================================

/**
 * Execute a full explore action at a point.
 *
 * Pipeline:
 * 1. Validate point exists
 * 2. Calculate time cost
 * 3. Calculate attribute costs
 * 4. Calculate gather output (with food decomposition)
 * 5. Add decomposed items to inventory (with overflow)
 * 6. Deplete reserves
 * 7. Roll for blueprint drops
 *
 * Pure function — returns all new state without mutation.
 */
export function executeExplore(
  state: ExploreState,
  pointId: string,
  rng: () => number = Math.random,
): ExploreResult {
  const point = getPointById(pointId);
  if (!point) {
    return {
      timeCost: 0,
      cost: { stamina: 0, energy: 0, dirt: 0 },
      gatherResult: {
        rawItems: [],
        decomposedItems: [],
        overflow: 0,
        blueprintDrop: null,
        reservesDepleted: [],
      },
      newInventory: { ...state.inventory, slots: state.inventory.slots.map((s) => ({ ...s })) },
      newReserves: state.reserves,
      canExplore: false,
      failReason: '未知点位',
    };
  }

  // Calculate time and costs
  const timeCost = calculateExploreTime(pointId, state.attributes, state.weather);
  const cost = calculateExploreCost(pointId, state.attributes);

  // Calculate gather output
  const gatherResult = calculateGatherOutput(
    pointId,
    state.attributes,
    state.weather,
    state.isNight,
    state.toolType,
    state.reserves,
    rng,
  );

  // Add decomposed items to inventory (handle overflow)
  let currentInventory: Inventory = {
    ...state.inventory,
    slots: state.inventory.slots.map((s) => ({ ...s })),
  };
  let totalOverflow = 0;

  for (const item of gatherResult.decomposedItems) {
    const itemDef = getItemDef(item.itemId as ItemId);
    if (!itemDef) continue;

    const result = addItem(
      currentInventory,
      item.itemId,
      item.quantity,
      itemDef.weight,
      itemDef.stackLimit,
    );
    currentInventory = result.inventory;
    totalOverflow += result.overflow;
  }

  // Deplete reserves
  let currentReserves = state.reserves;
  for (const depletion of gatherResult.reservesDepleted) {
    currentReserves = depleteReserve(
      currentReserves,
      depletion.pointId,
      depletion.itemId,
      depletion.amount,
    );
  }

  return {
    timeCost,
    cost,
    gatherResult: {
      ...gatherResult,
      overflow: totalOverflow,
    },
    newInventory: currentInventory,
    newReserves: currentReserves,
    canExplore: true,
  };
}
