import type {
  EnemyTier,
  EnemyDef,
  CombatStrategyId,
  CombatStrategyDef,
  ItemId,
  NoiseLevel,
  NoiseAction,
} from '@data/types';
import { COMBAT_STRATEGIES } from '@data/v1-spec';
import type { Inventory } from './inventory';
import { removeItem, createInventory } from './inventory';

// ============================================================
// Types
// ============================================================

export type Terrain = '海滩' | '丛林' | '山地' | '沼泽' | '浅海' | '遗迹';
export type Weather = '晴' | '阴' | '雨' | '暴雨' | '大雾' | '酷热';

export const TERRAIN_DODGE_MODIFIERS: Record<Terrain, number> = {
  '海滩': 0,
  '丛林': 0.1,
  '山地': -0.1,
  '沼泽': -0.15,
  '浅海': -0.2,
  '遗迹': -0.1,
};

export const TERRAIN_HIT_MODIFIERS: Record<Terrain, number> = {
  '海滩': 0,
  '丛林': -0.1,
  '山地': 0,
  '沼泽': 0,
  '浅海': 0,
  '遗迹': 0,
};

export const TERRAIN_DEFENSE_BONUS: Record<Terrain, number> = {
  '海滩': 0,
  '丛林': 0,
  '山地': 5,
  '沼泽': 0,
  '浅海': 0,
  '遗迹': 0,
};

export const TERRAIN_BLOCK_BONUS: Record<Terrain, number> = {
  '海滩': 0,
  '丛林': 0,
  '山地': 0,
  '沼泽': 0,
  '浅海': 0,
  '遗迹': 0.2,
};

export const WEATHER_HIT_MODIFIERS: Partial<Record<Weather, number>> = {
  '大雾': -0.1,
};

export const NOISE_LEVEL_MAP: Record<NoiseAction, NoiseLevel> = {
  '普通移动': 'none',
  '采集': 'small',
  '采矿': 'large',
  '砍伐': 'large',
  '战斗': 'medium',
  '潜行移动': 'none',
};

export const ENCOUNTER_CHANCE_BY_NOISE: Record<NoiseLevel, number> = {
  'none': 0,
  'small': 0.1,
  'medium': 0.3,
  'large': 0.6,
};

export interface PlayerCombatState {
  stamina: number;
  attackPower: number;
  defense: number;
  health: number;
  inventory: Inventory;
}

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

export type CombatStatus = 'active' | 'victory' | 'defeat' | 'retreated';

export interface CombatState {
  player: PlayerCombatState;
  enemy: EnemyCombatState;
  turn: number;
  combatCount: number;
  status: CombatStatus;
  terrain: Terrain;
  currentDodgeBonus: number;
  currentBlockReduction: number;
  log: string[];
}

export interface PlayerActionRolls {
  enemyDodge: number;
  playerHit: number;
}

export interface EnemyActionRolls {
  playerDodge: number;
  enemyHit: number;
}

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

export interface InitiateCombatParams {
  playerStamina: number;
  playerAttackPower: number;
  playerDefense: number;
  playerHealth: number;
  inventory: Inventory;
  enemyDef: EnemyDef;
  combatCount: number;
  terrain: Terrain;
}

export interface LootResult {
  items: { itemId: ItemId; quantity: number }[];
  moodBonus: number;
}

// ============================================================
// Extended Types (P2.4)
// ============================================================

export interface CombatContext {
  player: {
    stamina: number;
    health: number;
    energy: number;
    attackPower: number;
    defense: number;
    weightRatio: number;
    inventory: Inventory;
  };
  enemy: {
    tier: EnemyTier;
    name: string;
    icon: string;
    hp: number;
    maxHp: number;
    atk: number;
    def: number;
    dodgeRate: number;
    isBeast: boolean;
  };
  terrain: Terrain;
  weather: Weather;
  isNight: boolean;
  turn: number;
  combatCount: number;
  status: CombatStatus;
  currentDodgeBonus: number;
  currentBlockReduction: number;
  log: string[];
}

export interface CombatRoundResult {
  context: CombatContext;
  playerDamageDealt: number;
  enemyDamageDealt: number;
  staminaCost: number;
  energyCost: number;
  playerDodged: boolean;
  enemyDodged: boolean;
  playerHit: boolean;
  enemyHit: boolean;
  intimidateSuccess: boolean;
  retreated: boolean;
  firstStrike: boolean;
}

// ============================================================
// Constants
// ============================================================

export const BASE_DODGE_RATE = 0.3;
export const BASE_HIT_RATE = 0.9;
export const MIN_DAMAGE = 1;

const ENEMY_HIT_RATES: Record<EnemyTier, number> = {
  Small: 0.85,
  Medium: 0.9,
  Large: 0.95,
};

const BEAST_TIERS: EnemyTier[] = ['Small', 'Medium', 'Large'];

// ============================================================
// Strategy Lookup
// ============================================================

const strategyMap: Record<string, CombatStrategyDef> = {};
for (const s of COMBAT_STRATEGIES) {
  strategyMap[s.id] = s;
}

function getStrategyDef(id: CombatStrategyId): CombatStrategyDef {
  return strategyMap[id];
}

// ============================================================
// Seeded PRNG
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
// createCombatContext (P2.4 main entry point)
// ============================================================

export function createCombatContext(
  player: CombatContext['player'],
  enemyDef: EnemyDef,
  terrain: Terrain,
  weather: Weather,
  isNight: boolean,
  combatCount: number = 0,
): CombatContext {
  return {
    player: {
      stamina: player.stamina,
      health: player.health,
      energy: player.energy,
      attackPower: player.attackPower,
      defense: player.defense,
      weightRatio: player.weightRatio,
      inventory: player.inventory
        ? { ...player.inventory, slots: player.inventory.slots.map(s => ({ ...s })) }
        : createInventory(),
    },
    enemy: {
      tier: enemyDef.tier,
      name: enemyDef.name,
      icon: enemyDef.icon,
      hp: enemyDef.hp,
      maxHp: enemyDef.hp,
      atk: enemyDef.atk,
      def: enemyDef.def,
      dodgeRate: enemyDef.dodgeRate,
      isBeast: BEAST_TIERS.includes(enemyDef.tier),
    },
    terrain,
    weather,
    isNight,
    turn: 1,
    combatCount,
    status: 'active',
    currentDodgeBonus: 0,
    currentBlockReduction: 0,
    log: [],
  };
}

// ============================================================
// getAvailableStrategies
// ============================================================

export function getAvailableStrategies(
  weightRatio: number,
  stamina: number,
): CombatStrategyId[] {
  if (stamina <= 20 || weightRatio > 0.8) {
    return ['普通攻击', '格挡'];
  }

  if (weightRatio > 0.5) {
    return ['普通攻击', '闪避姿态', '格挡', '精准攻击', '恐吓', '撤退'];
  }

  return ['普通攻击', '猛击', '闪避姿态', '格挡', '精准攻击', '恐吓', '撤退', '潜行击'];
}

// ============================================================
// calculateDodgeRate
// ============================================================

export function calculateDodgeRate(
  baseRate: number,
  stamina: number,
  weightRatio: number,
  dodgeBonus: number,
  terrain: Terrain,
): number {
  if (stamina <= 20) return 0.1;

  let rate = baseRate + dodgeBonus;

  if (stamina <= 50) {
    rate -= 0.15;
  } else if (stamina >= 81) {
    rate += 0.1;
  }

  if (weightRatio <= 0.25) {
    rate += 0.05;
  } else if (weightRatio > 0.8) {
    rate -= 0.15;
  } else if (weightRatio > 0.5) {
    rate -= 0.1;
  }

  rate += TERRAIN_DODGE_MODIFIERS[terrain] ?? 0;

  return Math.max(0, Math.min(1, rate));
}

export function calculateDodgeRateWithContext(ctx: CombatContext): number {
  return calculateDodgeRate(
    BASE_DODGE_RATE,
    ctx.player.stamina,
    ctx.player.weightRatio,
    ctx.currentDodgeBonus,
    ctx.terrain,
  );
}

// ============================================================
// calculateHitRate
// ============================================================

export function calculateHitRate(
  baseRate: number,
  strategyModifier: number,
  stamina: number,
): number {
  if (stamina <= 20) return 0;

  let rate = baseRate + strategyModifier;

  if (stamina <= 50) {
    rate -= 0.1;
  } else if (stamina >= 81) {
    rate += 0.05;
  }

  return Math.max(0, Math.min(1, rate));
}

export function calculateHitRateWithContext(
  ctx: CombatContext,
  strategy: CombatStrategyDef,
): number {
  const base = calculateHitRate(BASE_HIT_RATE, strategy.hitRateModifier, ctx.player.stamina);
  let rate = base;

  rate += TERRAIN_HIT_MODIFIERS[ctx.terrain] ?? 0;
  if (ctx.isNight) rate -= 0.1;
  const weatherMod = WEATHER_HIT_MODIFIERS[ctx.weather];
  if (weatherMod) rate += weatherMod;

  return Math.max(0, Math.min(1, rate));
}

// ============================================================
// calculateStaminaCost
// ============================================================

export function calculateStaminaCost(
  baseCost: number,
  combatCount: number,
  stamina: number,
): number {
  if (stamina <= 20) return Infinity;

  let multiplier = 1;

  if (stamina <= 50) {
    multiplier *= 1.5;
  } else if (stamina >= 81) {
    multiplier *= 0.8;
  }

  if (combatCount >= 3) {
    multiplier *= 1.5;
  } else if (combatCount >= 2) {
    multiplier *= 1.2;
  }

  return Math.max(1, Math.floor(baseCost * multiplier));
}

// ============================================================
// calculateDamage
// ============================================================

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

export function calculateDamageWithContext(
  ctx: CombatContext,
  strategy: CombatStrategyDef,
): number {
  if (strategy.damageMultiplier <= 0) return 0;

  let attackPower = ctx.player.attackPower;
  if (ctx.player.health <= 60) {
    attackPower = Math.floor(attackPower * 0.7);
  }

  const defense = ctx.enemy.def + TERRAIN_DEFENSE_BONUS[ctx.terrain];
  let blockReduction = ctx.currentBlockReduction;
  blockReduction += TERRAIN_BLOCK_BONUS[ctx.terrain];
  blockReduction = Math.min(1, blockReduction);

  const baseDamage = Math.max(MIN_DAMAGE, attackPower - defense);
  return Math.max(0, Math.floor(baseDamage * strategy.damageMultiplier * (1 - blockReduction)));
}

// ============================================================
// Noise system
// ============================================================

export function calculateNoiseLevel(actionType: NoiseAction): NoiseLevel {
  return NOISE_LEVEL_MAP[actionType];
}

export function calculateEncounterChance(
  noiseLevel: NoiseLevel,
  zoneDangerRate: number,
): number {
  const base = ENCOUNTER_CHANCE_BY_NOISE[noiseLevel];
  return Math.min(1, base * zoneDangerRate * 3);
}

// ============================================================
// initiateCombat (backward-compatible)
// ============================================================

export function initiateCombat(params: InitiateCombatParams): CombatState {
  return {
    player: {
      stamina: params.playerStamina,
      attackPower: params.playerAttackPower,
      defense: params.playerDefense,
      health: params.playerHealth,
      inventory: { ...params.inventory, slots: params.inventory.slots.map(s => ({ ...s })) },
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
// resolveCombatRound (P2.4 main combat function)
// ============================================================

export function resolveCombatRound(
  ctx: CombatContext,
  strategyId: CombatStrategyId,
  rng: () => number,
): CombatRoundResult {
  const strategy = getStrategyDef(strategyId);
  if (!strategy) {
    return emptyRoundResult(ctx);
  }

  const available = getAvailableStrategies(ctx.player.weightRatio, ctx.player.stamina);
  if (!available.includes(strategyId)) {
    return emptyRoundResult(ctx);
  }

  const staminaCost = calculateStaminaCost(strategy.staminaCost, ctx.combatCount, ctx.player.stamina);
  if (staminaCost === Infinity || ctx.player.stamina < staminaCost) {
    return emptyRoundResult(ctx);
  }

  if (ctx.player.health <= 30) {
    return emptyRoundResult(ctx);
  }

  let newCtx = cloneContext(ctx);
  newCtx.player.stamina -= staminaCost;
  newCtx.player.energy -= strategy.energyCost;
  newCtx.turn += 1;
  newCtx.currentDodgeBonus = 0;
  newCtx.currentBlockReduction = 0;

  const result: CombatRoundResult = {
    context: newCtx,
    playerDamageDealt: 0,
    enemyDamageDealt: 0,
    staminaCost,
    energyCost: strategy.energyCost,
    playerDodged: false,
    enemyDodged: false,
    playerHit: false,
    enemyHit: false,
    intimidateSuccess: false,
    retreated: false,
    firstStrike: false,
  };

  // --- Retreat ---
  if (strategyId === '撤退') {
    newCtx = applyRetreatItemLoss(newCtx, rng());
    newCtx.status = 'retreated';
    newCtx.log.push('撤退成功，损失1件物资');
    result.context = newCtx;
    result.retreated = true;
    return result;
  }

  // --- 恐吓 ---
  if (strategyId === '恐吓') {
    if (newCtx.enemy.isBeast && rng() < 0.5) {
      newCtx.status = 'retreated';
      newCtx.log.push('恐吓成功，野兽逃跑了（无战利品）');
      result.context = newCtx;
      result.intimidateSuccess = true;
      result.retreated = true;
    } else {
      newCtx.log.push('恐吓失败');
    }
    return result;
  }

  // --- 闪避姿态 ---
  if (strategyId === '闪避姿态') {
    newCtx.currentDodgeBonus = strategy.dodgeRateBonus;
    newCtx.log.push('进入闪避姿态，闪避率+25%');
    result.context = newCtx;
    return result;
  }

  // --- 格挡 ---
  if (strategyId === '格挡') {
    newCtx.currentBlockReduction = strategy.blockDamageReduction;
    newCtx.log.push('进入格挡姿态，减伤50%');
    result.context = newCtx;
    return result;
  }

  // --- 潜行击 (first strike) ---
  if (strategyId === '潜行击') {
    newCtx.currentDodgeBonus = strategy.dodgeRateBonus;
    result.firstStrike = true;
  }

  // --- Offensive strategies ---
  if (rng() <= newCtx.enemy.dodgeRate) {
    result.enemyDodged = true;
    newCtx.log.push('敌人闪避了攻击');
    result.context = newCtx;
    return result;
  }

  const hitRate = calculateHitRateWithContext(newCtx, strategy);
  if (rng() > hitRate) {
    result.playerHit = false;
    newCtx.log.push('攻击未命中');
    result.context = newCtx;
    return result;
  }
  result.playerHit = true;

  const damage = calculateDamageWithContext(newCtx, strategy);
  result.playerDamageDealt = damage;
  newCtx.enemy = { ...newCtx.enemy, hp: Math.max(0, newCtx.enemy.hp - damage) };
  newCtx.log.push(`造成 ${damage} 点伤害`);
  result.context = newCtx;

  return result;
}

// ============================================================
// resolveCombatRoundEnemy (enemy attacks player)
// ============================================================

export function resolveCombatRoundEnemy(
  ctx: CombatContext,
  rng: () => number,
): CombatRoundResult {
  const result: CombatRoundResult = {
    context: ctx,
    playerDamageDealt: 0,
    enemyDamageDealt: 0,
    staminaCost: 0,
    energyCost: 0,
    playerDodged: false,
    enemyDodged: false,
    playerHit: false,
    enemyHit: false,
    intimidateSuccess: false,
    retreated: false,
    firstStrike: false,
  };

  const playerDodgeRate = calculateDodgeRateWithContext(ctx);
  if (rng() <= playerDodgeRate) {
    result.playerDodged = true;
    const newCtx = cloneContext(ctx);
    newCtx.log.push('成功闪避敌人攻击');
    result.context = newCtx;
    return result;
  }

  const enemyHitRate = ENEMY_HIT_RATES[ctx.enemy.tier] ?? BASE_HIT_RATE;
  if (rng() > enemyHitRate) {
    result.enemyHit = false;
    return result;
  }
  result.enemyHit = true;

  let blockReduction = ctx.currentBlockReduction;
  blockReduction += TERRAIN_BLOCK_BONUS[ctx.terrain];
  blockReduction = Math.min(1, blockReduction);

  const damage = calculateDamage(
    ctx.enemy.atk,
    ctx.player.defense,
    1,
    blockReduction,
  );

  const newCtx = cloneContext(ctx);
  newCtx.player = { ...newCtx.player, health: Math.max(0, newCtx.player.health - damage) };
  newCtx.log.push(`受到 ${damage} 点伤害`);
  result.enemyDamageDealt = damage;
  result.context = newCtx;

  return result;
}

// ============================================================
// checkCombatEnd
// ============================================================

export function checkCombatEnd(state: CombatState): CombatState {
  if (state.status !== 'active') return state;
  if (state.enemy.hp <= 0) return { ...state, status: 'victory' };
  if (state.player.stamina <= 0) return { ...state, status: 'defeat' };
  return state;
}

export function checkCombatEndWithContext(ctx: CombatContext): CombatContext {
  if (ctx.status !== 'active') return ctx;
  if (ctx.enemy.hp <= 0) return { ...ctx, status: 'victory' };
  if (ctx.player.stamina <= 0) return { ...ctx, status: 'defeat' };
  return ctx;
}

// ============================================================
// generateLoot
// ============================================================

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
// resolvePlayerAction (backward-compatible)
// ============================================================

export function resolvePlayerAction(
  state: CombatState,
  strategyId: CombatStrategyId,
  rolls: PlayerActionRolls,
  weightRatio: number,
): CombatActionResult {
  const strategy = getStrategyDef(strategyId);
  if (!strategy) return noOpResult(state);

  const available = getAvailableStrategies(weightRatio, state.player.stamina);
  if (!available.includes(strategyId)) return noOpResult(state);

  const staminaCost = calculateStaminaCost(
    strategy.staminaCost,
    state.combatCount,
    state.player.stamina,
  );
  if (staminaCost === Infinity || state.player.stamina < staminaCost) {
    return noOpResult(state);
  }

  let newState = cloneState(state);
  newState.player.stamina -= staminaCost;
  newState.turn += 1;
  newState.currentDodgeBonus = 0;
  newState.currentBlockReduction = 0;

  let damageDealt = 0;
  let enemyDodged = false;
  let playerHit = false;

  if (strategyId === '撤退') {
    newState = applyRetreatItemLossLegacy(newState, rolls.enemyDodge);
    newState.status = 'retreated';
    return makeResult(newState, damageDealt, 0, staminaCost, false, enemyDodged, playerHit, false);
  }

  if (strategyId === '恐吓') {
    if (rolls.enemyDodge < 0.5) {
      newState.status = 'retreated';
    }
    return makeResult(newState, damageDealt, 0, staminaCost, false, enemyDodged, playerHit, false);
  }

  if (strategyId === '闪避姿态') {
    newState.currentDodgeBonus = strategy.dodgeRateBonus;
    return makeResult(newState, damageDealt, 0, staminaCost, false, enemyDodged, playerHit, false);
  }

  if (strategyId === '格挡') {
    newState.currentBlockReduction = strategy.blockDamageReduction;
    return makeResult(newState, damageDealt, 0, staminaCost, false, enemyDodged, playerHit, false);
  }

  if (rolls.enemyDodge <= newState.enemy.dodgeRate) {
    enemyDodged = true;
    return makeResult(newState, damageDealt, 0, staminaCost, false, enemyDodged, playerHit, false);
  }

  const hitRate = calculateHitRate(
    BASE_HIT_RATE,
    strategy.hitRateModifier,
    newState.player.stamina + staminaCost,
  );
  if (rolls.playerHit > hitRate) {
    playerHit = false;
    return makeResult(newState, damageDealt, 0, staminaCost, false, enemyDodged, playerHit, false);
  }
  playerHit = true;

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
// resolveEnemyAction (backward-compatible)
// ============================================================

export function resolveEnemyAction(
  state: CombatState,
  rolls: EnemyActionRolls,
): CombatActionResult {
  let newState = cloneState(state);
  let playerDodged = false;
  let enemyHit = false;
  let damageReceived = 0;

  const playerDodgeRate = calculateDodgeRate(
    BASE_DODGE_RATE,
    newState.player.stamina,
    0.3,
    newState.currentDodgeBonus,
    newState.terrain,
  );

  if (rolls.playerDodge <= playerDodgeRate) {
    playerDodged = true;
    return makeResult(newState, 0, damageReceived, 0, playerDodged, false, false, enemyHit);
  }

  const enemyHitRate = ENEMY_HIT_RATES[newState.enemy.tier] ?? BASE_HIT_RATE;
  if (rolls.enemyHit > enemyHitRate) {
    enemyHit = false;
    return makeResult(newState, 0, damageReceived, 0, playerDodged, false, false, enemyHit);
  }
  enemyHit = true;

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
// Helpers
// ============================================================

function cloneContext(ctx: CombatContext): CombatContext {
  return {
    player: {
      ...ctx.player,
      inventory: { ...ctx.player.inventory, slots: ctx.player.inventory.slots.map(s => ({ ...s })) },
    },
    enemy: { ...ctx.enemy },
    terrain: ctx.terrain,
    weather: ctx.weather,
    isNight: ctx.isNight,
    turn: ctx.turn,
    combatCount: ctx.combatCount,
    status: ctx.status,
    currentDodgeBonus: ctx.currentDodgeBonus,
    currentBlockReduction: ctx.currentBlockReduction,
    log: [...ctx.log],
  };
}

function cloneState(state: CombatState): CombatState {
  return {
    player: { ...state.player, inventory: { ...state.player.inventory, slots: state.player.inventory.slots.map(s => ({ ...s })) } },
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

function applyRetreatItemLoss(ctx: CombatContext, roll: number): CombatContext {
  const inv = ctx.player.inventory;
  if (inv.slots.length === 0) return ctx;

  const totalItems = inv.slots.reduce((sum, s) => sum + s.quantity, 0);
  if (totalItems === 0) return ctx;

  const targetIndex = Math.floor(roll * totalItems);
  let cumulative = 0;
  let slotIndex = 0;

  for (let i = 0; i < inv.slots.length; i++) {
    cumulative += inv.slots[i].quantity;
    if (targetIndex < cumulative) {
      slotIndex = i;
      break;
    }
  }

  try {
    const newInventory = removeItem(inv, inv.slots[slotIndex].itemId, 1);
    return {
      ...ctx,
      player: { ...ctx.player, inventory: newInventory },
    };
  } catch {
    return ctx;
  }
}

function applyRetreatItemLossLegacy(state: CombatState, roll: number): CombatState {
  const inventory = state.player.inventory;
  if (inventory.slots.length === 0) return state;

  const totalItems = inventory.slots.reduce((sum, s) => sum + s.quantity, 0);
  if (totalItems === 0) return state;

  const targetIndex = Math.floor(roll * totalItems);
  let cumulative = 0;
  let slotIndex = 0;

  for (let i = 0; i < inventory.slots.length; i++) {
    cumulative += inventory.slots[i].quantity;
    if (targetIndex < cumulative) {
      slotIndex = i;
      break;
    }
  }

  try {
    const newInventory = removeItem(inventory, inventory.slots[slotIndex].itemId, 1);
    return {
      ...state,
      player: { ...state.player, inventory: newInventory },
    };
  } catch {
    return state;
  }
}

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

function noOpResult(state: CombatState): CombatActionResult {
  return makeResult(state, 0, 0, 0, false, false, false, false);
}

function emptyRoundResult(ctx: CombatContext): CombatRoundResult {
  return {
    context: ctx,
    playerDamageDealt: 0,
    enemyDamageDealt: 0,
    staminaCost: 0,
    energyCost: 0,
    playerDodged: false,
    enemyDodged: false,
    playerHit: false,
    enemyHit: false,
    intimidateSuccess: false,
    retreated: false,
    firstStrike: false,
  };
}
