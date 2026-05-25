// ============================================================
// CardLand V1 Turn Resolution Engine
// Pure functions orchestrating the 10-step turn pipeline
// ============================================================

import type { Attributes, ActiveStatusEffect } from './attributes';
import {
  applyNaturalDecay,
  applyThresholdEffects,
  applyLinkageEffects,
  applyStatusEffects,
  clampAttributes,
  checkDeathConditions,
} from './attributes';
import type { Inventory } from './inventory';
import { addItem, getItemDef, createInventory } from './inventory';
import { canCraft, executeCraft, createRecipeBook } from './crafting';
import type { CombatState } from './combat';
import { initiateCombat, checkCombatEnd, generateLoot, resolvePlayerAction, resolveEnemyAction } from './combat';
import type { PlayerState } from './events';
import { SeededRNG, triggerRandomEvent, resolveChoiceEvent } from './events';
import type {
  WeatherId,
  CombatStrategyId,
  SubZoneId,
  ZoneId,
  ItemId,
  EnemyDef,
  HandType,
} from '@data/types';
import {
  WEATHER_TYPES,
  ENEMIES,
  INITIAL_HANDS,
  ATTRIBUTES,
} from '@data/v1-spec';
import {
  MAP_POINTS,
  getMapPointById,
  getMovementCost,
} from '@data/map';

// ============================================================
// Types
// ============================================================

/** Unique identifier for a map point (e.g., "A1-North") */
export type PointId = string;

/** Current weather state */
export interface WeatherState {
  current: WeatherId;
  turnsRemaining: number;
}

/** Overall game state — all pure, all immutable */
export interface GameState {
  attributes: Attributes;
  inventory: Inventory;
  currentPosition: PointId;
  weather: WeatherState;
  turnNumber: number;
  statusEffects: ActiveStatusEffect[];
  gameOver: { isOver: boolean; reason: string | null };
}

/** Player action types */
export type PlayerAction =
  | MoveAction
  | GatherAction
  | CraftAction
  | RestAction
  | CombatAction;

export interface MoveAction {
  type: 'move';
  targetSubZone: SubZoneId;
}

export interface GatherAction {
  type: 'gather';
}

export interface CraftAction {
  type: 'craft';
  recipeId: string;
}

export interface RestAction {
  type: 'rest';
}

export interface CombatAction {
  type: 'combat';
  strategyId: CombatStrategyId;
}

/** Result of processing one full turn */
export interface TurnResult {
  state: GameState;
  logs: string[];
}

/** Result of the action phase */
export interface ActionPhaseResult {
  state: GameState;
  actionLogs: string[];
  combatState?: CombatState;
}

// ============================================================
// Seeded PRNG (for deterministic tests)
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
// Default attribute values
// ============================================================

export function defaultAttributes(): Attributes {
  const attrs = {} as Attributes;
  for (const attr of ATTRIBUTES) {
    attrs[attr.id] = attr.initialValue;
  }
  return attrs;
}

// ============================================================
// generateWeather — deterministic weather generation via RNG
// ============================================================

/**
 * Generate a weather type weighted by its probability using the provided RNG.
 * Uses cumulative probability distribution for deterministic testing.
 */
export function generateWeather(rng: () => number): WeatherId {
  const roll = rng();
  let cumulative = 0;
  for (const w of WEATHER_TYPES) {
    cumulative += w.probability;
    if (roll < cumulative) {
      return w.id;
    }
  }
  // Fallback (shouldn't reach here if probabilities sum to 1)
  return WEATHER_TYPES[0].id;
}

// ============================================================
// processWeatherTurn — weather tick (step 1 of pipeline)
// ============================================================

/**
 * Process weather for one turn. Every 3 turns, the weather may change.
 * Returns updated weather state and any weather-related attribute changes.
 */
export function processWeatherTurn(
  weather: WeatherState,
  _turnNumber: number,
  rng: () => number,
): { weather: WeatherState; attributeChanges: Partial<Record<string, number>>; log: string | null } {
  let newWeather = { ...weather };
  let logMessage: string | null = null;
  const attributeChanges: Partial<Record<string, number>> = {};

  // Decrement turns remaining
  newWeather.turnsRemaining -= 1;

  // Check if weather should change (every 3 turns)
  if (newWeather.turnsRemaining <= 0) {
    const oldWeather = newWeather.current;
    newWeather.current = generateWeather(rng);
    const weatherDef = WEATHER_TYPES.find((w) => w.id === newWeather.current);
    newWeather.turnsRemaining = weatherDef?.duration ?? 3;
    logMessage = `天气变化：${oldWeather} → ${newWeather.current}`;
  }

  // Apply current weather effects
  const currentWeatherDef = WEATHER_TYPES.find((w) => w.id === newWeather.current);
  if (currentWeatherDef) {
    for (const effect of currentWeatherDef.effects.attributeEffects) {
      attributeChanges[effect.attributeId] =
        (attributeChanges[effect.attributeId] ?? 0) + effect.amount;
    }
  }

  return { weather: newWeather, attributeChanges, log: logMessage };
}

// ============================================================
// processActionPhase — resolve player action (step 6)
// ============================================================

/**
 * Resolve a player's chosen action for the turn.
 */
export function processActionPhase(
  state: GameState,
  action: PlayerAction,
  rng: () => number,
): ActionPhaseResult {
  switch (action.type) {
    case 'move':
      return resolveMoveAction(state, action, rng);
    case 'gather':
      return resolveGatherAction(state, rng);
    case 'craft':
      return resolveCraftAction(state, action);
    case 'rest':
      return resolveRestAction(state);
    case 'combat':
      return resolveCombatAction(state, action, rng);
    default:
      return { state, actionLogs: [] };
  }
}

// ============================================================
// resolveMoveAction
// ============================================================

function resolveMoveAction(
  state: GameState,
  action: MoveAction,
  _rng: () => number,
): ActionPhaseResult {
  const currentSubZone = pointIdToSubZone(state.currentPosition);
  const cost = getMovementCost(currentSubZone, action.targetSubZone);

  if (cost === undefined) {
    return {
      state,
      actionLogs: [`无法从 ${currentSubZone} 移动到 ${action.targetSubZone}`],
    };
  }

  const stamina = state.attributes['体力值'] ?? 0;
  if (stamina < cost.staminaCost) {
    return {
      state,
      actionLogs: [`体力不足 (${stamina} < ${cost.staminaCost})，无法移动`],
    };
  }

  // Find the first map point in the target subzone
  const targetPoint = MAP_POINTS.find(
    (p) => p.subZone === action.targetSubZone,
  );
  const newPosition = targetPoint?.id ?? state.currentPosition;

  const newAttributes = {
    ...state.attributes,
    '体力值': stamina - cost.staminaCost,
  };

  return {
    state: {
      ...state,
      attributes: newAttributes,
      currentPosition: newPosition,
    },
    actionLogs: [`移动到 ${action.targetSubZone} (消耗体力 ${cost})`],
  };
}

// ============================================================
// resolveGatherAction
// ============================================================

function resolveGatherAction(
  state: GameState,
  rng: () => number,
): ActionPhaseResult {
  const point = getMapPointById(state.currentPosition);
  if (!point) {
    return {
      state,
      actionLogs: ['当前位置没有资源可采集'],
    };
  }

  const logs: string[] = [];
  let newInventory: Inventory = { ...state.inventory, slots: state.inventory.slots.map(s => ({ ...s })) };
  let newAttributes = { ...state.attributes };

  // Gather resources from outputs
  for (const output of point.outputs) {
    const quantity = output.min + Math.floor(rng() * (output.max - output.min + 1));
    if (quantity > 0) {
      const def = getItemDef(output.itemId)!;
      const result = addItem(newInventory, output.itemId, quantity, def.weight, def.stackLimit);
      newInventory = result.inventory;
      logs.push(`采集到 ${output.itemId}×${quantity}`);
    }
  }

  // Stamina cost of gathering
  const staminaCost = 5;
  newAttributes['体力值'] = (newAttributes['体力值'] ?? 0) - staminaCost;
  logs.push(`消耗体力 ${staminaCost}`);

  // Trigger random events at the map point
  const seededRng = makeSeededRngFromFn(rng);
  const eventTrigger = triggerRandomEvent(point, seededRng);

  if (eventTrigger && eventTrigger.triggered) {
    const event = point.choiceEvents.find((e) => e.id === eventTrigger.eventId);
    if (event) {
      logs.push(`触发事件：${eventTrigger.eventName}`);
      // Auto-resolve the first option (deterministic for testing)
      if (event.options.length > 0) {
        const firstOption = event.options[0];
        const playerState: PlayerState = {
          attributes: newAttributes as Record<string, number>,
          inventory: inventoryToRecord(newInventory),
        };
        const outcome = resolveChoiceEvent(event, firstOption.id, seededRng, playerState);
        if (outcome.requirementsMet) {
          // Apply item changes
          for (const change of outcome.itemChanges) {
            if (change.quantity > 0) {
              const def = getItemDef(change.itemId)!;
              const result = addItem(newInventory, change.itemId, change.quantity, def.weight, def.stackLimit);
              newInventory = result.inventory;
            } else {
              // Negative quantity — consume items (simplified)
              // This is a simplification; full removal would need removeItem
              logs.push(`消耗 ${change.itemId}×${Math.abs(change.quantity)} (事件)`);
            }
          }
          // Apply attribute changes
          for (const change of outcome.attributeChanges) {
            const attrId = change.attributeId as keyof typeof newAttributes;
            newAttributes[attrId] = (newAttributes[attrId] ?? 0) + change.amount;
            logs.push(`${attrId} ${change.amount >= 0 ? '+' : ''}${change.amount}`);
          }
          logs.push(outcome.message);
        } else {
          logs.push(`事件未满足条件：${outcome.message}`);
        }
      }
    }
  }

  return {
    state: {
      ...state,
      inventory: newInventory,
      attributes: newAttributes,
    },
    actionLogs: logs,
  };
}

// ============================================================
// resolveCraftAction
// ============================================================

function resolveCraftAction(
  state: GameState,
  action: CraftAction,
): ActionPhaseResult {
  const recipeBook = createRecipeBook();
  const hasWorkstation = state.inventory.slots.some(
    (s) => s.itemId === '工作台',
  );
  const playerEnergy = state.attributes['精力值'] ?? 80;

  const check = canCraft(recipeBook, state.inventory, action.recipeId, hasWorkstation);

  if (!check.canCraft) {
    return {
      state,
      actionLogs: [`无法制作 ${action.recipeId}：${check.detail ?? check.reason}`],
    };
  }

  try {
    const result = executeCraft(
      recipeBook,
      state.inventory,
      action.recipeId,
      hasWorkstation,
      playerEnergy,
    );
    return {
      state: {
        ...state,
        inventory: result.inventory,
      },
      actionLogs: [result.message],
    };
  } catch (e: unknown) {
    return {
      state,
      actionLogs: [`制作失败：${e instanceof Error ? e.message : String(e)}`],
    };
  }
}

// ============================================================
// resolveRestAction
// ============================================================

function resolveRestAction(state: GameState): ActionPhaseResult {
  const point = getMapPointById(state.currentPosition);
  const logs: string[] = [];
  const newAttributes = { ...state.attributes };

  let staminaRestore = 5;
  let healthRestore = 0;
  let energyRestore = 0;

  if (point) {
    switch (point.type) {
      case '休息点':
        staminaRestore = 30;
        healthRestore = 10;
        energyRestore = 20;
        logs.push(`在 ${point.name} 充分休息`);
        break;
      case '资源点':
        staminaRestore = 10;
        energyRestore = 5;
        logs.push(`在资源点附近休息`);
        break;
      default:
        staminaRestore = 5;
        logs.push('当前位置不适合充分休息');
        break;
    }
  }

  newAttributes['体力值'] = (newAttributes['体力值'] ?? 0) + staminaRestore;
  if (healthRestore > 0) {
    newAttributes['健康值'] = (newAttributes['健康值'] ?? 0) + healthRestore;
  }
  if (energyRestore > 0) {
    newAttributes['精力值'] = (newAttributes['精力值'] ?? 0) + energyRestore;
  }
  logs.push(`体力 +${staminaRestore}${healthRestore ? `, 健康 +${healthRestore}` : ''}${energyRestore ? `, 精力 +${energyRestore}` : ''}`);

  return {
    state: {
      ...state,
      attributes: newAttributes,
    },
    actionLogs: logs,
  };
}

// ============================================================
// resolveCombatAction
// ============================================================

function resolveCombatAction(
  state: GameState,
  action: CombatAction,
  rng: () => number,
): ActionPhaseResult {
  const point = getMapPointById(state.currentPosition);
  if (!point) {
    return {
      state,
      actionLogs: ['当前位置无法战斗'],
    };
  }

  // Check if there's an enemy at this location
  const enemy = findEnemyAtLocation(point.subZone);
  if (!enemy) {
    return {
      state,
      actionLogs: ['当前位置没有敌人'],
    };
  }

  const terrain = terrainFromPoint(point);
  const combatState = initiateCombat({
    playerStamina: state.attributes['体力值'] ?? 0,
    playerAttackPower: 5, // base attack
    playerDefense: 1, // base defense
    playerHealth: state.attributes['健康值'] ?? 0,
    inventory: state.inventory,
    enemyDef: enemy,
    combatCount: 0,
    terrain,
  });

  // Resolve a single combat round with the chosen strategy
  const playerRolls = { enemyDodge: rng(), playerHit: rng() };
  const weightRatio = 0.3; // default

  const playerResult = resolvePlayerAction(combatState, action.strategyId, playerRolls, weightRatio);
  const enemyRolls = { playerDodge: rng(), enemyHit: rng() };
  const enemyResult = resolveEnemyAction(playerResult.state, enemyRolls);

  const afterCheck = checkCombatEnd(enemyResult.state);

  const logs: string[] = [];
  let finalState = { ...state };

  if (playerResult.damageDealt > 0) {
    logs.push(`造成 ${playerResult.damageDealt} 点伤害`);
  }
  if (enemyResult.damageReceived > 0) {
    logs.push(`受到 ${enemyResult.damageReceived} 点伤害`);
  }
  logs.push(`消耗体力 ${playerResult.staminaCost + enemyResult.staminaCost}`);

  finalState = {
    ...finalState,
    attributes: {
      ...finalState.attributes,
      '体力值': afterCheck.player.stamina,
      '健康值': afterCheck.player.health,
    },
    inventory: afterCheck.player.inventory,
  };

  if (afterCheck.status === 'victory') {
    logs.push(`击败 ${enemy.name}！`);
    const loot = generateLoot(enemy, rng);
    let newInventory: Inventory = { ...finalState.inventory, slots: finalState.inventory.slots.map(s => ({ ...s })) };
    for (const item of loot.items) {
      const def = getItemDef(item.itemId)!;
      const result = addItem(newInventory, item.itemId, item.quantity, def.weight, def.stackLimit);
      newInventory = result.inventory;
      logs.push(`获得 ${item.itemId}×${item.quantity}`);
    }
    if (loot.moodBonus > 0) {
      const newAttrs = { ...finalState.attributes };
      newAttrs['心情'] = (newAttrs['心情'] ?? 0) + loot.moodBonus;
      finalState = { ...finalState, attributes: newAttrs };
      logs.push(`心情 +${loot.moodBonus}`);
    }
    finalState = { ...finalState, inventory: newInventory };
  } else if (afterCheck.status === 'defeat') {
    logs.push('战斗失败...');
  } else if (afterCheck.status === 'retreated') {
    logs.push('撤退成功');
  }

  return {
    state: finalState,
    actionLogs: logs,
    combatState: afterCheck,
  };
}

// ============================================================
// processTurn — the complete 10-step turn pipeline
// ============================================================

/**
 * Execute one complete game turn. Returns the new game state and logs.
 * This is a pure function — pass the state and action, get back the result.
 */
export function processTurn(
  state: GameState,
  action: PlayerAction,
  rng: () => number,
): TurnResult {
  const logs: string[] = [];
  let current = { ...state, attributes: { ...state.attributes } };

  // Step 1: Weather tick
  const weatherResult = processWeatherTurn(current.weather, current.turnNumber, rng);
  current.weather = weatherResult.weather;
  if (weatherResult.log) logs.push(weatherResult.log);
  // Apply weather attribute effects
  for (const [attrId, amount] of Object.entries(weatherResult.attributeChanges)) {
    const key = attrId as keyof typeof current.attributes;
    current.attributes[key] = (current.attributes[key] ?? 0) + (amount as number);
  }

  // Step 2: Natural attribute decay
  current.attributes = applyNaturalDecay(current.attributes);

  // Step 3: Threshold effects — computed but no direct attribute changes in V1
  applyThresholdEffects(current.attributes);

  // Step 4: Linkage effects
  const linkageResult = applyLinkageEffects(current.attributes);
  // Apply direct rate changes
  for (const [attrId, amount] of Object.entries(linkageResult.directChanges)) {
    const key = attrId as keyof typeof current.attributes;
    current.attributes[key] = (current.attributes[key] ?? 0) + (amount as number);
  }

  // Step 5: Status effects
  const statusResult = applyStatusEffects(current.attributes, current.statusEffects);
  current.attributes = statusResult.attributes;
  current.statusEffects = statusResult.statusEffects;

  // Step 6: Player action phase
  const actionResult = processActionPhase(current, action, rng);
  current = actionResult.state;
  logs.push(...actionResult.actionLogs);

  // Step 7: Event resolution — random events already handled in gather action
  // For non-gather turns, we could trigger events here, but the spec has events
  // tied to specific actions and locations

  // Step 8: Item durability check — V1 simplified: no explicit durability tracking
  // Durability is baked into item definitions; tools degrade through crafting

  // Step 9: Attribute clamping
  current.attributes = clampAttributes(current.attributes);

  // Step 10: Death check
  const deathResult = checkDeathConditions(current.attributes);
  if (deathResult.isDead) {
    current.gameOver = { isOver: true, reason: deathResult.reason };
    logs.push(`游戏结束：${deathResult.reason}`);
  }

  // Advance turn counter
  current.turnNumber += 1;

  return { state: current, logs };
}

// ============================================================
// startNewGame — initialize a new game state
// ============================================================

/**
 * Create a new game state with the chosen hand type and seed.
 * Player always starts at A1-North (沙滩遮阳岩洞).
 */
export function startNewGame(handType: HandType, seed: number): GameState {
  const hand = INITIAL_HANDS.find((h) => h.type === handType);
  if (!hand) {
    throw new Error(`无效的开局类型：${handType}`);
  }

  const rng = createSeededRNG(seed);

  let inventory: Inventory = createInventory();
  for (const item of hand.items) {
    const def = getItemDef(item.itemId)!;
    const result = addItem(inventory, item.itemId, item.quantity, def.weight, def.stackLimit);
    inventory = result.inventory;
  }

  const currentWeather = generateWeather(rng);
  const weatherDef = WEATHER_TYPES.find((w) => w.id === currentWeather);

  return {
    attributes: defaultAttributes(),
    inventory,
    currentPosition: 'A1-North',
    weather: {
      current: currentWeather,
      turnsRemaining: weatherDef?.duration ?? 3,
    },
    turnNumber: 1,
    statusEffects: [],
    gameOver: { isOver: false, reason: null },
  };
}

// ============================================================
// Helpers
// ============================================================

/** Extract subzone ID from a point ID like "A1-North" → "A1" */
function pointIdToSubZone(pointId: PointId): SubZoneId {
  const match = pointId.match(/^([A-F]\d)-/);
  return (match?.[1] ?? 'A1') as SubZoneId;
}

/** Find an enemy that can appear at a given subzone */
function findEnemyAtLocation(subZone: SubZoneId): EnemyDef | null {
  const candidates = ENEMIES.filter((e) => e.habitats.includes(subZone));
  if (candidates.length === 0) return null;
  return candidates[0]; // First matching enemy (deterministic for testing)
}

/** Convert point type to terrain */
function terrainFromPoint(point: { subZone: SubZoneId; type: string }): '海滩' | '丛林' | '山地' | '沼泽' | '浅海' | '遗迹' {
  const zone = point.subZone.charAt(0) as ZoneId;
  if (zone === 'A') return '海滩';
  if (zone === 'C') return '山地';
  if (zone === 'D') return '沼泽';
  if (zone === 'E') return '浅海';
  if (zone === 'F') return '遗迹';
  if (point.subZone === 'B1') return '沼泽';
  if (point.subZone === 'B3') return '沼泽';
  return '丛林';
}

/** Convert Inventory to Record<string, number> for event system */
function inventoryToRecord(inventory: Inventory): Record<ItemId, number> {
  const record: Record<string, number> = {};
  for (const slot of inventory.slots) {
    record[slot.itemId] = (record[slot.itemId] ?? 0) + slot.quantity;
  }
  return record;
}

/** Create a SeededRNG from a function-based RNG */
function makeSeededRngFromFn(rng: () => number): SeededRNG {
  const seed = Math.floor(rng() * 2147483647);
  return new SeededRNG(seed);
}

/** Re-export for tests */
export { checkDeathConditions };
