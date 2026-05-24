import type {
  EnemyTier,
  EnemyDef,
  CombatStrategyId,
  CombatStrategyDef,
  ItemId,
} from '@data/types';
import { COMBAT_STRATEGIES } from '@data/v1-spec';
import type { InventorySlot } from './inventory';
import { removeItem } from './inventory';

// ============================================================
// Types
// ============================================================

/** Terrain types affecting dodge and hit rates */
export type Terrain = '海滩' | '丛林' | '山地' | '沼泽' | '浅海' | '遗迹';

/** Dodge rate modifiers per terrain (from 地图环境影响 design doc) */
export const TERRAIN_DODGE_MODIFIERS: Record<Terrain, number> = {
  '海滩': 0,
  '丛林': 0.1,
  '山地': -0.1,
  '沼泽': -0.15,
  '浅海': -0.2,
  '遗迹': -0.1,
};

/** Player state during combat */
export interface PlayerCombatState {
  stamina: number;
  attackPower: number;
  defense: number;
  health: number;
  inventory: InventorySlot[];
}

/** Enemy state during combat */
export interface EnemyCombatState {
  tier: EnemyTier;
  name: string;
  icon: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  dodgeRate: number;
}

/** Possible combat end states */
export type CombatStatus = 'active' | 'victory' | 'defeat' | 'retreated';

/** Full combat state — all fields immutable by consumers */
export interface CombatState {
  player: PlayerCombatState;
  enemy: EnemyCombatState;
  turn: number;
  combatCount: number;
  status: CombatStatus;
  terrain: Terrain;
  /** Per-turn dodge bonus (set by 闪避姿态 strategy) */
  currentDodgeBonus: number;
  /** Per-turn block damage reduction (set by 格挡 strategy) */
  currentBlockReduction: number;
  log: string[];
}

/** Dice rolls for player action resolution */
export interface PlayerActionRolls {
  /** 0-1 roll to check enemy dodge (retreat: repurposed as item selection roll) */
  enemyDodge: number;
  /** 0-1 roll to check player hit */
  playerHit: number;
}

/** Dice rolls for enemy action resolution */
export interface EnemyActionRolls {
  /** 0-1 roll to check player dodge */
  playerDodge: number;
  /** 0-1 roll to check enemy hit */
  enemyHit: number;
}

/** Result of resolving a player or enemy action */
export interface CombatActionResult {
  state: CombatState;
  damageDealt: number;
  damageReceived: number;
  staminaCost: number;
  playerDodged: boolean;
  enemyDodged: boolean;
  playerHit: boolean;
  enemyHit: boolean;
}

/** Parameters for initiating combat */
export interface InitiateCombatParams {
  playerStamina: number;
  playerAttackPower: number;
  playerDefense: number;
  playerHealth: number;
  inventory: InventorySlot[];
  enemyDef: EnemyDef;
  combatCount: number;
  terrain: Terrain;
}

/** Loot generated from defeating an enemy */
export interface LootResult {
  items: { itemId: ItemId; quantity: number }[];
  moodBonus: number;
}

// ============================================================
// Constants
// ============================================================

export const BASE_DODGE_RATE = 0.3;
export const BASE_HIT_RATE = 0.9;
export const MIN_DAMAGE = 1;

/** Enemy tier → base accuracy when attacking the player */
const ENEMY_HIT_RATES: Record<EnemyTier, number> = {
  Small: 0.85,
  Medium: 0.9,
  Large: 0.95,
};

// ============================================================
// Strategy Lookup (cached map for O(1) access)
// ============================================================

const strategyMap: Record<string, CombatStrategyDef> = {};
for (const s of COMBAT_STRATEGIES) {
  strategyMap[s.id] = s;
}

function getStrategyDef(id: CombatStrategyId): CombatStrategyDef {
  return strategyMap[id];
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
// calculateDamage
// ============================================================

/**
 * Calculate combat damage: attacker ATK minus defender DEF, multiplied by
 * damage multiplier, reduced by block reduction if applicable.
 * Minimum damage is clamped to MIN_DAMAGE (1), unless multiplier is 0
 * (non-attack strategies like dodge/block/retreat).
 */
export function calculateDamage(
  atk: number,
  def: number,
  damageMultiplier: number,
  blockReduction: number = 0,
): number {
  if (damageMultiplier <= 0) return 0;
  const baseDamage = Math.max(MIN_DAMAGE, atk - def);
  const reduced = baseDamage * damageMultiplier * (1 - blockReduction);
  return Math.max(0, Math.floor(reduced));
}

// ============================================================
// calculateDodgeRate
// ============================================================

/**
 * Calculate effective dodge rate from base rate, stamina, weight, dodge
 * bonus (from strategy like 闪避姿态), and terrain modifier.
 * Stamina ≤ 20 overrides all other modifiers: fixed at 10%.
 */
export function calculateDodgeRate(
  baseRate: number,
  stamina: number,
  weightRatio: number,
  dodgeBonus: number,
  terrain: Terrain,
): number {
  // Stamina ≤ 20: fixed 10% dodge, cannot fight
  if (stamina <= 20) return 0.1;

  let rate = baseRate + dodgeBonus;

  // Stamina threshold modifiers
  if (stamina <= 50) {
    rate -= 0.15;
  } else if (stamina >= 81) {
    rate += 0.1;
  }

  // Weight modifiers (exclusive tiers)
  if (weightRatio <= 0.25) {
    rate += 0.05;
  } else if (weightRatio > 0.75) {
    rate -= 0.15;
  } else if (weightRatio > 0.5) {
    rate -= 0.1;
  }

  // Terrain modifier
  rate += TERRAIN_DODGE_MODIFIERS[terrain] ?? 0;

  return Math.max(0, Math.min(1, rate));
}

// ============================================================
// calculateHitRate
// ============================================================

/**
 * Calculate effective hit rate from base rate, strategy modifier,
 * and stamina thresholds.
 * Stamina ≤ 20: cannot attack (hit rate = 0).
 */
export function calculateHitRate(
  baseRate: number,
  strategyModifier: number,
  stamina: number,
): number {
  // Stamina ≤ 20: cannot fight effectively
  if (stamina <= 20) return 0;

  let rate = baseRate + strategyModifier;

  // Stamina threshold modifiers
  if (stamina <= 50) {
    rate -= 0.1;
  } else if (stamina >= 81) {
    rate += 0.05;
  }

  return Math.max(0, Math.min(1, rate));
}

// ============================================================
// calculateStaminaCost
// ============================================================

/**
 * Calculate effective stamina cost for a strategy considering
 * consecutive combat penalties and stamina thresholds.
 * Stamina ≤ 20 returns Infinity (cannot fight).
 * Minimum cost is 1.
 */
export function calculateStaminaCost(
  baseCost: number,
  combatCount: number,
  stamina: number,
): number {
  // Stamina ≤ 20: cannot fight at all
  if (stamina <= 20) return Infinity;

  let multiplier = 1;

  // Stamina threshold modifiers
  if (stamina <= 50) {
    multiplier *= 1.5;
  } else if (stamina >= 81) {
    multiplier *= 0.8;
  }

  // Consecutive combat penalties
  if (combatCount >= 3) {
    multiplier *= 1.5;
  } else if (combatCount >= 2) {
    multiplier *= 1.2;
  }

  return Math.max(1, Math.floor(baseCost * multiplier));
}

// ============================================================
// getAvailableStrategies
// ============================================================

/**
 * Determine which combat strategies are currently available based on
 * weight ratio and stamina.
 *
 * Weight restrictions:
 *   - ≤ 50%: all strategies available
 *   - 51-75%: 猛击 unavailable
 *   - > 75%: only 普通攻击 and 格挡
 *
 * Stamina restrictions:
 *   - ≤ 20: offensive strategies (普通攻击, 猛击, 精准攻击) unavailable
 */
export function getAvailableStrategies(
  weightRatio: number,
  stamina: number,
): CombatStrategyId[] {
  let available: CombatStrategyId[] = [
    '普通攻击', '猛击', '闪避姿态', '格挡', '精准攻击', '撤退',
  ];

  // Weight-based restrictions
  if (weightRatio > 0.75) {
    return ['普通攻击', '格挡'];
  }
  if (weightRatio > 0.5) {
    available = available.filter(s => s !== '猛击');
  }

  // Stamina-based restrictions
  if (stamina <= 20) {
    available = available.filter(
      s => s !== '普通攻击' && s !== '猛击' && s !== '精准攻击',
    );
  }

  return available;
}

// ============================================================
// initiateCombat
// ============================================================

/**
 * Create an initial combat state from player parameters and enemy definition.
 * Pure function — does not mutate any inputs.
 */
export function initiateCombat(params: InitiateCombatParams): CombatState {
  return {
    player: {
      stamina: params.playerStamina,
      attackPower: params.playerAttackPower,
      defense: params.playerDefense,
      health: params.playerHealth,
      inventory: params.inventory.map(s => ({ ...s })),
    },
    enemy: {
      tier: params.enemyDef.tier,
      name: params.enemyDef.name,
      icon: params.enemyDef.icon,
      hp: params.enemyDef.hp,
      maxHp: params.enemyDef.hp,
      atk: params.enemyDef.atk,
      def: params.enemyDef.def,
      dodgeRate: params.enemyDef.dodgeRate,
    },
    turn: 1,
    combatCount: params.combatCount,
    status: 'active',
    terrain: params.terrain,
    currentDodgeBonus: 0,
    currentBlockReduction: 0,
    log: [],
  };
}

// ============================================================
// resolvePlayerAction
// ============================================================

/**
 * Resolve the player's chosen combat strategy. Returns a new CombatState
 * and result metadata. Does not mutate the input state.
 *
 * Strategy effects:
 *   - 普通攻击: standard damage, standard hit rate
 *   - 猛击: 2× damage, -20% hit rate
 *   - 闪避姿态: +25% dodge for this turn, no attack
 *   - 格挡: 50% damage reduction for this turn, no attack
 *   - 精准攻击: +20% hit rate, 1.3× damage
 *   - 撤退: exit combat, lose 1 random item
 */
export function resolvePlayerAction(
  state: CombatState,
  strategyId: CombatStrategyId,
  rolls: PlayerActionRolls,
  weightRatio: number,
): CombatActionResult {
  const strategy = getStrategyDef(strategyId);
  if (!strategy) {
    return noOpResult(state);
  }

  // Validate strategy availability
  const available = getAvailableStrategies(weightRatio, state.player.stamina);
  if (!available.includes(strategyId)) {
    return noOpResult(state);
  }

  // Calculate and validate stamina cost
  const staminaCost = calculateStaminaCost(
    strategy.staminaCost,
    state.combatCount,
    state.player.stamina,
  );
  if (staminaCost === Infinity || state.player.stamina < staminaCost) {
    return noOpResult(state);
  }

  // Deduct stamina
  let newState = cloneState(state);
  newState.player.stamina -= staminaCost;
  newState.turn += 1;
  newState.currentDodgeBonus = 0;
  newState.currentBlockReduction = 0;

  let damageDealt = 0;
  let enemyDodged = false;
  let playerHit = false;

  // --- Retreat ---
  if (strategyId === '撤退') {
    newState = applyRetreatItemLoss(newState, rolls.enemyDodge);
    newState.status = 'retreated';
    return makeResult(newState, damageDealt, 0, staminaCost, false, enemyDodged, playerHit, false);
  }

  // --- 闪避姿态 ---
  if (strategyId === '闪避姿态') {
    newState.currentDodgeBonus = strategy.dodgeRateBonus;
    return makeResult(newState, damageDealt, 0, staminaCost, false, enemyDodged, playerHit, false);
  }

  // --- 格挡 ---
  if (strategyId === '格挡') {
    newState.currentBlockReduction = strategy.blockDamageReduction;
    return makeResult(newState, damageDealt, 0, staminaCost, false, enemyDodged, playerHit, false);
  }

  // --- Offensive strategies (普通攻击, 猛击, 精准攻击) ---
  // Check enemy dodge
  if (rolls.enemyDodge <= newState.enemy.dodgeRate) {
    enemyDodged = true;
    return makeResult(newState, damageDealt, 0, staminaCost, false, enemyDodged, playerHit, false);
  }

  // Check player hit
  const hitRate = calculateHitRate(
    BASE_HIT_RATE,
    strategy.hitRateModifier,
    newState.player.stamina + staminaCost, // use pre-deduction stamina for consistency
  );
  if (rolls.playerHit > hitRate) {
    playerHit = false;
    return makeResult(newState, damageDealt, 0, staminaCost, false, enemyDodged, playerHit, false);
  }
  playerHit = true;

  // Calculate and apply damage
  damageDealt = calculateDamage(
    state.player.attackPower,
    newState.enemy.def,
    strategy.damageMultiplier,
  );
  newState.enemy = {
    ...newState.enemy,
    hp: Math.max(0, newState.enemy.hp - damageDealt),
  };

  return makeResult(newState, damageDealt, 0, staminaCost, false, enemyDodged, playerHit, false);
}

// ============================================================
// resolveEnemyAction
// ============================================================

/**
 * Resolve the enemy's attack against the player for this turn.
 * Enemy always uses a simple attack (no special AI in V1).
 * Returns a new CombatState and result metadata. Does not mutate input.
 */
export function resolveEnemyAction(
  state: CombatState,
  rolls: EnemyActionRolls,
): CombatActionResult {
  let newState = cloneState(state);
  let playerDodged = false;
  let enemyHit = false;
  let damageReceived = 0;

  // Calculate player dodge rate with current turn modifiers
  const playerDodgeRate = calculateDodgeRate(
    BASE_DODGE_RATE,
    newState.player.stamina,
    0.3, // default weight ratio — consumer overrides via state setup
    newState.currentDodgeBonus,
    newState.terrain,
  );

  // Check player dodge
  if (rolls.playerDodge <= playerDodgeRate) {
    playerDodged = true;
    return makeResult(newState, 0, damageReceived, 0, playerDodged, false, false, enemyHit);
  }

  // Check enemy hit
  const enemyHitRate = ENEMY_HIT_RATES[newState.enemy.tier] ?? BASE_HIT_RATE;
  if (rolls.enemyHit > enemyHitRate) {
    enemyHit = false;
    return makeResult(newState, 0, damageReceived, 0, playerDodged, false, false, enemyHit);
  }
  enemyHit = true;

  // Calculate and apply damage (with player block reduction)
  damageReceived = calculateDamage(
    newState.enemy.atk,
    newState.player.defense,
    1,
    newState.currentBlockReduction,
  );
  newState.player = {
    ...newState.player,
    health: Math.max(0, newState.player.health - damageReceived),
  };

  return makeResult(newState, 0, damageReceived, 0, playerDodged, false, false, enemyHit);
}

// ============================================================
// checkCombatEnd
// ============================================================

/**
 * Check combat end conditions and update status accordingly.
 * End conditions:
 *   - Enemy HP ≤ 0 → victory
 *   - Player stamina ≤ 0 → defeat
 *   - Status already 'retreated' → stays retreated
 *   - If status is already terminal, returns unchanged.
 */
export function checkCombatEnd(state: CombatState): CombatState {
  // Already terminal — return unchanged
  if (state.status !== 'active') {
    return state;
  }

  if (state.enemy.hp <= 0) {
    return { ...state, status: 'victory' };
  }

  if (state.player.stamina <= 0) {
    return { ...state, status: 'defeat' };
  }

  return state;
}

// ============================================================
// generateLoot
// ============================================================

/**
 * Generate loot from an enemy's drop table using seeded RNG.
 * Pure function — deterministic when given the same RNG sequence.
 */
export function generateLoot(
  enemyDef: EnemyDef,
  rng: () => number,
): LootResult {
  const items: { itemId: ItemId; quantity: number }[] = [];

  for (const drop of enemyDef.dropTable) {
    if (rng() <= drop.probability) {
      const quantity = drop.min + Math.floor(rng() * (drop.max - drop.min + 1));
      items.push({ itemId: drop.itemId, quantity });
    }
  }

  return { items, moodBonus: enemyDef.moodBonus };
}

// ============================================================
// Internal Helpers
// ============================================================

/** Deep-clone a CombatState to ensure immutability */
function cloneState(state: CombatState): CombatState {
  return {
    player: { ...state.player, inventory: state.player.inventory.map(s => ({ ...s })) },
    enemy: { ...state.enemy },
    turn: state.turn,
    combatCount: state.combatCount,
    status: state.status,
    terrain: state.terrain,
    currentDodgeBonus: state.currentDodgeBonus,
    currentBlockReduction: state.currentBlockReduction,
    log: [...state.log],
  };
}

/** Build a result with all fields filled */
function makeResult(
  state: CombatState,
  damageDealt: number,
  damageReceived: number,
  staminaCost: number,
  playerDodged: boolean,
  enemyDodged: boolean,
  playerHit: boolean,
  enemyHit: boolean,
): CombatActionResult {
  return {
    state,
    damageDealt,
    damageReceived,
    staminaCost,
    playerDodged,
    enemyDodged,
    playerHit,
    enemyHit,
  };
}

/** Return a no-op result when strategy validation fails */
function noOpResult(state: CombatState): CombatActionResult {
  return makeResult(state, 0, 0, 0, false, false, false, false);
}

/**
 * Remove one random item from the player's inventory for retreat.
 * Uses the provided roll (0-1) to select which item index to remove.
 */
function applyRetreatItemLoss(state: CombatState, roll: number): CombatState {
  const inventory = state.player.inventory;
  if (inventory.length === 0) return state;

  // Count total items across all slots
  const totalItems = inventory.reduce((sum, s) => sum + s.quantity, 0);
  if (totalItems === 0) return state;

  // Select a specific item by cumulative index
  const targetIndex = Math.floor(roll * totalItems);
  let cumulative = 0;
  let slotIndex = 0;

  for (let i = 0; i < inventory.length; i++) {
    cumulative += inventory[i].quantity;
    if (targetIndex < cumulative) {
      slotIndex = i;
      break;
    }
  }

  // Remove 1 from the selected slot
  try {
    const newInventory = removeItem(inventory, inventory[slotIndex].itemId, 1);
    return {
      ...state,
      player: { ...state.player, inventory: newInventory },
    };
  } catch {
    // Should never happen, but guard against edge cases
    return state;
  }
}
