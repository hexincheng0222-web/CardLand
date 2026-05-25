import { describe, it, expect } from 'vitest';
import {
  createCombatContext,
  getAvailableStrategies,
  calculateDodgeRate,
  calculateDodgeRateWithContext,
  calculateHitRate,
  calculateHitRateWithContext,
  calculateDamage,
  calculateDamageWithContext,
  calculateStaminaCost,
  resolveCombatRound,
  resolveCombatRoundEnemy,
  checkCombatEndWithContext,
  generateLoot,
  createSeededRNG,
  calculateNoiseLevel,
  calculateEncounterChance,
  resolvePlayerAction,
  resolveEnemyAction,
  initiateCombat,
  TERRAIN_DODGE_MODIFIERS,
  TERRAIN_HIT_MODIFIERS,
  TERRAIN_DEFENSE_BONUS,
  TERRAIN_BLOCK_BONUS,
} from '../combat';
import type {
  CombatContext,
  CombatState,
  PlayerCombatState,
  EnemyCombatState,
  Terrain,
} from '../combat';
import type { EnemyDef } from '@data/types';
import { ENEMIES } from '@data/v1-spec';
import { createInventory } from '../inventory';

// ============================================================
// Helpers
// ============================================================

function makePlayer(overrides?: Partial<PlayerCombatState>): PlayerCombatState {
  const inv = createInventory();
  inv.slots.push({ itemId: '食物', quantity: 3 });
  inv.slots.push({ itemId: '水', quantity: 2 });
  inv.slots.push({ itemId: '草药', quantity: 1 });
  return {
    stamina: 80,
    attackPower: 5,
    defense: 0,
    health: 100,
    inventory: inv,
    ...overrides,
  };
}

function makeEnemy(overrides?: Partial<EnemyCombatState>): EnemyCombatState {
  return {
    tier: 'Small',
    name: '小野猪',
    icon: '🐗',
    hp: 10,
    maxHp: 10,
    atk: 3,
    def: 1,
    dodgeRate: 0.2,
    ...overrides,
  };
}

function makeState(overrides?: Partial<CombatState>): CombatState {
  return {
    player: makePlayer(),
    enemy: makeEnemy(),
    turn: 1,
    combatCount: 1,
    status: 'active',
    terrain: '海滩',
    currentDodgeBonus: 0,
    currentBlockReduction: 0,
    log: [],
    ...overrides,
  };
}

function makeContext(overrides?: Partial<CombatContext>): CombatContext {
  const inv = createInventory();
  inv.slots.push({ itemId: '食物', quantity: 3 });
  inv.slots.push({ itemId: '水', quantity: 2 });
  inv.slots.push({ itemId: '草药', quantity: 1 });
  return {
    player: {
      stamina: 80,
      health: 100,
      energy: 80,
      attackPower: 5,
      defense: 0,
      weightRatio: 0.3,
      inventory: inv,
    },
    enemy: {
      tier: 'Small',
      name: '小野猪',
      icon: '🐗',
      hp: 10,
      maxHp: 10,
      atk: 3,
      def: 1,
      dodgeRate: 0.2,
      isBeast: true,
    },
    terrain: '海滩',
    weather: '晴',
    isNight: false,
    turn: 1,
    combatCount: 1,
    status: 'active',
    currentDodgeBonus: 0,
    currentBlockReduction: 0,
    log: [],
    ...overrides,
  };
}

const smallEnemyDef: EnemyDef = ENEMIES[0];
const mediumEnemyDef: EnemyDef = ENEMIES[2];
const largeEnemyDef: EnemyDef = ENEMIES[3];

const successRoll = 0.0;
const failRoll = 0.999;

// ============================================================
// createSeededRNG
// ============================================================

describe('createSeededRNG', () => {
  it('produces deterministic sequence from same seed', () => {
    const rng1 = createSeededRNG(42);
    const rng2 = createSeededRNG(42);
    expect(Array.from({ length: 5 }, () => rng1())).toEqual(
      Array.from({ length: 5 }, () => rng2()),
    );
  });

  it('different seeds give different sequences', () => {
    const rng1 = createSeededRNG(1);
    const rng2 = createSeededRNG(2);
    expect(rng1()).not.toEqual(rng2());
  });

  it('all values are in [0, 1)', () => {
    const rng = createSeededRNG(123);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

// ============================================================
// calculateDamage
// ============================================================

describe('calculateDamage', () => {
  it('computes playerATK - enemyDEF with minimum 1', () => {
    expect(calculateDamage(5, 1, 1)).toBe(4);
    expect(calculateDamage(10, 3, 1)).toBe(7);
  });

  it('applies damageMultiplier correctly', () => {
    expect(calculateDamage(5, 1, 1.5)).toBe(6);
    expect(calculateDamage(5, 1, 1.3)).toBe(5);
  });

  it('floors fractional damage', () => {
    expect(calculateDamage(6, 1, 1.3)).toBe(6);
    expect(calculateDamage(7, 2, 0.5)).toBe(2);
  });

  it('returns minimum 1 when def >= atk', () => {
    expect(calculateDamage(1, 5, 1)).toBe(1);
    expect(calculateDamage(0, 10, 1)).toBe(1);
  });

  it('applies block damage reduction', () => {
    expect(calculateDamage(5, 1, 1, 0.5)).toBe(2);
    expect(calculateDamage(3, 1, 1, 0.5)).toBe(1);
  });

  it('handles zero multiplier (non-attack strategies)', () => {
    expect(calculateDamage(5, 1, 0)).toBe(0);
  });
});

// ============================================================
// calculateDamageWithContext
// ============================================================

describe('calculateDamageWithContext', () => {
  it('uses player attackPower and enemy def', () => {
    const ctx = makeContext();
    const strat = { damageMultiplier: 1 } as any;
    expect(calculateDamageWithContext(ctx, strat)).toBe(4);
  });

  it('applies 1.5x multiplier for 猛击', () => {
    const ctx = makeContext();
    const strat = { damageMultiplier: 1.5 } as any;
    expect(calculateDamageWithContext(ctx, strat)).toBe(6);
  });

  it('reduces attack by 30% when health <= 60', () => {
    const ctx = makeContext({ player: { ...makeContext().player, health: 50 } });
    const strat = { damageMultiplier: 1 } as any;
    expect(calculateDamageWithContext(ctx, strat)).toBe(2);
  });

  it('adds terrain defense bonus in mountains', () => {
    const ctx = makeContext({ terrain: '山地' });
    const strat = { damageMultiplier: 1 } as any;
    expect(calculateDamageWithContext(ctx, strat)).toBe(1);
  });

  it('adds terrain block bonus in ruins', () => {
    const ctx = makeContext({ terrain: '遗迹', currentBlockReduction: 0.5 });
    const strat = { damageMultiplier: 1 } as any;
    expect(calculateDamageWithContext(ctx, strat)).toBe(1);
  });

  it('returns 0 for non-attack strategies', () => {
    const ctx = makeContext();
    const strat = { damageMultiplier: 0 } as any;
    expect(calculateDamageWithContext(ctx, strat)).toBe(0);
  });
});

// ============================================================
// calculateDodgeRate
// ============================================================

describe('calculateDodgeRate', () => {
  const baseRate = 0.3;
  const normalStamina = 70;
  const normalWeight = 0.3;
  const noTerrain: Terrain = '海滩';

  it('returns base rate with normal conditions', () => {
    expect(calculateDodgeRate(baseRate, normalStamina, normalWeight, 0, noTerrain)).toBe(0.3);
  });

  it('adds strategy dodge bonus', () => {
    expect(calculateDodgeRate(baseRate, normalStamina, normalWeight, 0.25, noTerrain)).toBe(0.55);
  });

  it('applies stamina threshold: <= 20 fixed at 10%', () => {
    expect(calculateDodgeRate(baseRate, 15, 0.3, 0, noTerrain)).toBe(0.1);
  });

  it('applies stamina threshold: 21-50 → -15%', () => {
    expect(calculateDodgeRate(baseRate, 35, 0.3, 0, noTerrain)).toBe(0.15);
  });

  it('applies stamina threshold: 81-100 → +10%', () => {
    expect(calculateDodgeRate(baseRate, 90, 0.3, 0, noTerrain)).toBe(0.4);
  });

  it('applies weight modifier: light (<=0.25) → +5%', () => {
    expect(calculateDodgeRate(baseRate, normalStamina, 0.2, 0, noTerrain)).toBe(0.35);
  });

  it('applies weight modifier: heavy (0.51-0.8) → -10%', () => {
    expect(calculateDodgeRate(baseRate, normalStamina, 0.6, 0, noTerrain)).toBeCloseTo(0.2, 10);
  });

  it('applies weight modifier: overloaded (>0.8) → -15%', () => {
    expect(calculateDodgeRate(baseRate, normalStamina, 0.85, 0, noTerrain)).toBe(0.15);
  });

  it('applies terrain modifier: 丛林 +10%', () => {
    expect(calculateDodgeRate(baseRate, normalStamina, normalWeight, 0, '丛林')).toBe(0.4);
  });

  it('applies terrain modifier: 沼泽 -15%', () => {
    expect(calculateDodgeRate(baseRate, normalStamina, normalWeight, 0, '沼泽')).toBe(0.15);
  });

  it('clamps to [0, 1]', () => {
    expect(calculateDodgeRate(baseRate, 35, 0.9, 0, '沼泽')).toBe(0);
    expect(calculateDodgeRate(baseRate, 90, 0.2, 0.25, '丛林')).toBe(0.8);
  });

  it('stamina <= 20 overrides all other modifiers', () => {
    expect(calculateDodgeRate(baseRate, 10, 0.2, 0.25, '丛林')).toBe(0.1);
  });
});

// ============================================================
// calculateDodgeRateWithContext
// ============================================================

describe('calculateDodgeRateWithContext', () => {
  it('uses context fields correctly', () => {
    const ctx = makeContext();
    expect(calculateDodgeRateWithContext(ctx)).toBe(0.3);
  });

  it('applies dodge bonus from context', () => {
    const ctx = makeContext({ currentDodgeBonus: 0.25 });
    expect(calculateDodgeRateWithContext(ctx)).toBe(0.55);
  });
});

// ============================================================
// calculateHitRate
// ============================================================

describe('calculateHitRate', () => {
  const baseRate = 0.9;

  it('returns base rate with normal conditions', () => {
    expect(calculateHitRate(baseRate, 0, 70)).toBe(0.9);
  });

  it('applies strategy hit modifier', () => {
    expect(calculateHitRate(baseRate, 0.2, 70)).toBe(1.0);
    expect(calculateHitRate(baseRate, -0.2, 70)).toBe(0.7);
  });

  it('applies stamina threshold: <= 20 → cannot attack', () => {
    expect(calculateHitRate(baseRate, 0, 15)).toBe(0);
  });

  it('applies stamina threshold: 21-50 → -10%', () => {
    expect(calculateHitRate(baseRate, 0, 35)).toBe(0.8);
  });

  it('applies stamina threshold: 81-100 → +5%', () => {
    expect(calculateHitRate(baseRate, 0, 90)).toBeCloseTo(0.95, 10);
  });

  it('clamps to [0, 1]', () => {
    expect(calculateHitRate(baseRate, 0.3, 90)).toBe(1.0);
    expect(calculateHitRate(baseRate, -2.0, 35)).toBe(0);
  });
});

// ============================================================
// calculateHitRateWithContext
// ============================================================

describe('calculateHitRateWithContext', () => {
  const normalStrat = { hitRateModifier: 0 } as any;

  it('applies night modifier: -10%', () => {
    const ctx = makeContext({ isNight: true });
    expect(calculateHitRateWithContext(ctx, normalStrat)).toBeCloseTo(0.8, 10);
  });

  it('applies fog weather modifier: -10%', () => {
    const ctx = makeContext({ weather: '大雾' });
    expect(calculateHitRateWithContext(ctx, normalStrat)).toBeCloseTo(0.8, 10);
  });

  it('applies jungle terrain modifier: -10%', () => {
    const ctx = makeContext({ terrain: '丛林' });
    expect(calculateHitRateWithContext(ctx, normalStrat)).toBeCloseTo(0.8, 10);
  });

  it('stacks jungle + night + fog', () => {
    const ctx = makeContext({ terrain: '丛林', isNight: true, weather: '大雾' });
    expect(calculateHitRateWithContext(ctx, normalStrat)).toBeCloseTo(0.6, 10);
  });
});

// ============================================================
// calculateStaminaCost
// ============================================================

describe('calculateStaminaCost', () => {
  it('returns base cost for first combat', () => {
    expect(calculateStaminaCost(10, 1, 70)).toBe(10);
  });

  it('applies +20% penalty for second combat', () => {
    expect(calculateStaminaCost(10, 2, 70)).toBe(12);
  });

  it('applies +50% penalty for third+ combat', () => {
    expect(calculateStaminaCost(10, 3, 70)).toBe(15);
    expect(calculateStaminaCost(20, 5, 70)).toBe(30);
  });

  it('applies stamina threshold: 21-50 → +50%', () => {
    expect(calculateStaminaCost(10, 1, 35)).toBe(15);
  });

  it('applies stamina threshold: 81-100 → -20%', () => {
    expect(calculateStaminaCost(10, 1, 90)).toBe(8);
  });

  it('stacks consecutive penalty with stamina threshold', () => {
    expect(calculateStaminaCost(10, 2, 35)).toBe(18);
  });

  it('returns minimum 1', () => {
    expect(calculateStaminaCost(1, 1, 90)).toBe(1);
  });

  it('returns Infinity when stamina <= 20', () => {
    expect(calculateStaminaCost(10, 1, 10)).toBe(Infinity);
  });
});

// ============================================================
// getAvailableStrategies
// ============================================================

describe('getAvailableStrategies', () => {
  it('returns all 8 strategies under normal conditions', () => {
    const strategies = getAvailableStrategies(0.3, 70);
    expect(strategies).toEqual([
      '普通攻击', '猛击', '闪避姿态', '格挡', '精准攻击', '恐吓', '撤退', '潜行击',
    ]);
  });

  it('removes 猛击 and 潜行击 when weight > 50%', () => {
    const strategies = getAvailableStrategies(0.6, 70);
    expect(strategies).not.toContain('猛击');
    expect(strategies).not.toContain('潜行击');
    expect(strategies).toContain('恐吓');
  });

  it('restricts to only 普通攻击 and 格挡 when weight > 80%', () => {
    const strategies = getAvailableStrategies(0.85, 70);
    expect(strategies).toEqual(['普通攻击', '格挡']);
  });

  it('restricts to only 普通攻击 and 格挡 when stamina <= 20', () => {
    const strategies = getAvailableStrategies(0.3, 15);
    expect(strategies).toEqual(['普通攻击', '格挡']);
  });
});

// ============================================================
// createCombatContext
// ============================================================

describe('createCombatContext', () => {
  it('creates context from player stats and enemy def', () => {
    const inv = createInventory();
    const ctx = createCombatContext(
      { stamina: 80, health: 100, energy: 80, attackPower: 5, defense: 0, weightRatio: 0.3, inventory: inv },
      smallEnemyDef,
      '海滩',
      '晴',
      false,
      1,
    );

    expect(ctx.status).toBe('active');
    expect(ctx.turn).toBe(1);
    expect(ctx.combatCount).toBe(1);
    expect(ctx.player.stamina).toBe(80);
    expect(ctx.enemy.tier).toBe('Small');
    expect(ctx.enemy.hp).toBe(10);
    expect(ctx.enemy.isBeast).toBe(true);
    expect(ctx.terrain).toBe('海滩');
    expect(ctx.weather).toBe('晴');
    expect(ctx.isNight).toBe(false);
  });

  it('marks Small/Medium/Large tier enemies as beasts', () => {
    for (const def of [smallEnemyDef, mediumEnemyDef, largeEnemyDef]) {
      const inv = createInventory();
      const ctx = createCombatContext(
        { stamina: 80, health: 100, energy: 80, attackPower: 5, defense: 0, weightRatio: 0.3, inventory: inv },
        def, '海滩', '晴', false,
      );
      expect(ctx.enemy.isBeast).toBe(true);
    }
  });
});

// ============================================================
// resolveCombatRound — All 8 strategies
// ============================================================

describe('resolveCombatRound', () => {
  describe('普通攻击', () => {
    it('deals damage on hit', () => {
      const ctx = makeContext();
      const rng = createSeededRNG(1);
      const result = resolveCombatRound(ctx, '普通攻击', rng);
      expect(result.staminaCost).toBe(10);
      expect(result.context.player.stamina).toBe(70);
    });
  });

  describe('猛击 (×1.5 damage)', () => {
    it('deals 1.5x damage', () => {
      const ctx = makeContext();
      const rng = createSeededRNG(1);
      const result = resolveCombatRound(ctx, '猛击', rng);
      expect(result.staminaCost).toBe(20);
      expect(result.context.player.stamina).toBe(60);
    });
  });

  describe('闪避姿态 (dodge +25%, no attack)', () => {
    it('sets dodge bonus and deals no damage', () => {
      const ctx = makeContext();
      const rng = createSeededRNG(1);
      const result = resolveCombatRound(ctx, '闪避姿态', rng);
      expect(result.context.currentDodgeBonus).toBe(0.25);
      expect(result.playerDamageDealt).toBe(0);
      expect(result.staminaCost).toBe(15);
    });
  });

  describe('格挡 (block 50%, no attack)', () => {
    it('sets block reduction and deals no damage', () => {
      const ctx = makeContext();
      const rng = createSeededRNG(1);
      const result = resolveCombatRound(ctx, '格挡', rng);
      expect(result.context.currentBlockReduction).toBe(0.5);
      expect(result.playerDamageDealt).toBe(0);
      expect(result.staminaCost).toBe(8);
    });
  });

  describe('精准攻击 (+20% hit, ×1.3 damage)', () => {
    it('uses 1.3x damage multiplier', () => {
      const ctx = makeContext();
      const rng = createSeededRNG(1);
      const result = resolveCombatRound(ctx, '精准攻击', rng);
      expect(result.staminaCost).toBe(12);
      expect(result.energyCost).toBe(10);
    });
  });

  describe('恐吓 (50% scare beasts)', () => {
    it('scares beast with roll < 0.5', () => {
      const ctx = makeContext();
      let callCount = 0;
      const mockRng = () => {
        callCount++;
        return 0.1;
      };
      const result = resolveCombatRound(ctx, '恐吓', mockRng);
      expect(result.intimidateSuccess).toBe(true);
      expect(result.retreated).toBe(true);
      expect(result.context.status).toBe('retreated');
      expect(result.staminaCost).toBe(5);
    });

    it('fails to scare with roll >= 0.5', () => {
      const ctx = makeContext();
      let callCount = 0;
      const mockRng = () => {
        callCount++;
        return 0.8;
      };
      const result = resolveCombatRound(ctx, '恐吓', mockRng);
      expect(result.intimidateSuccess).toBe(false);
      expect(result.retreated).toBe(false);
      expect(result.context.status).toBe('active');
    });

    it('does not scare non-beast enemies', () => {
      const ctx = makeContext({
        enemy: { ...makeContext().enemy, isBeast: false },
      });
      let callCount = 0;
      const mockRng = () => {
        callCount++;
        return 0.1;
      };
      const result = resolveCombatRound(ctx, '恐吓', mockRng);
      expect(result.intimidateSuccess).toBe(false);
    });
  });

  describe('撤退', () => {
    it('sets status to retreated', () => {
      const ctx = makeContext();
      const rng = createSeededRNG(1);
      const result = resolveCombatRound(ctx, '撤退', rng);
      expect(result.context.status).toBe('retreated');
      expect(result.retreated).toBe(true);
      expect(result.staminaCost).toBe(20);
    });

    it('removes one random item from inventory', () => {
      const inv = createInventory();
      inv.slots.push({ itemId: '食物', quantity: 3 });
      inv.slots.push({ itemId: '水', quantity: 2 });
      const ctx = makeContext({
        player: { ...makeContext().player },
      });
      ctx.player = { ...ctx.player };
      const rng = createSeededRNG(1);
      const result = resolveCombatRound(ctx, '撤退', rng);
      expect(result.retreated).toBe(true);
    });
  });

  describe('潜行击 (first strike, dodge +20%)', () => {
    it('sets first strike flag and dodge bonus', () => {
      const ctx = makeContext();
      const rng = createSeededRNG(1);
      const result = resolveCombatRound(ctx, '潜行击', rng);
      expect(result.firstStrike).toBe(true);
      expect(result.context.currentDodgeBonus).toBe(0.2);
      expect(result.staminaCost).toBe(8);
    });
  });

  describe('strategy validation', () => {
    it('returns empty result when strategy unavailable due to weight', () => {
      const ctx = makeContext({ player: { ...makeContext().player, weightRatio: 0.6 } });
      const rng = createSeededRNG(1);
      const result = resolveCombatRound(ctx, '猛击', rng);
      expect(result.staminaCost).toBe(0);
      expect(result.playerDamageDealt).toBe(0);
    });

    it('returns empty result when health <= 30', () => {
      const ctx = makeContext({ player: { ...makeContext().player, health: 20 } });
      const rng = createSeededRNG(1);
      const result = resolveCombatRound(ctx, '普通攻击', rng);
      expect(result.staminaCost).toBe(0);
    });

    it('returns empty result when stamina insufficient', () => {
      const ctx = makeContext({ player: { ...makeContext().player, stamina: 5 } });
      const rng = createSeededRNG(1);
      const result = resolveCombatRound(ctx, '猛击', rng);
      expect(result.staminaCost).toBe(0);
    });
  });
});

// ============================================================
// resolveCombatRoundEnemy
// ============================================================

describe('resolveCombatRoundEnemy', () => {
  it('enemy hits player when player does not dodge and enemy hits', () => {
    const ctx = makeContext();
    const mockRng = () => 0.5;
    const result = resolveCombatRoundEnemy(ctx, mockRng);
    expect(result.playerDodged).toBe(false);
    expect(result.enemyHit).toBe(true);
    expect(result.enemyDamageDealt).toBe(3);
    expect(result.context.player.health).toBe(97);
  });

  it('enemy deals zero damage when player dodges', () => {
    const ctx = makeContext();
    const mockRng = () => 0.0;
    const result = resolveCombatRoundEnemy(ctx, mockRng);
    expect(result.playerDodged).toBe(true);
    expect(result.enemyDamageDealt).toBe(0);
  });

  it('block reduction from 格挡 applies', () => {
    const ctx = makeContext({ currentBlockReduction: 0.5 });
    const mockRng = () => 0.5;
    const result = resolveCombatRoundEnemy(ctx, mockRng);
    expect(result.enemyDamageDealt).toBe(1);
    expect(result.context.player.health).toBe(99);
  });
});

// ============================================================
// checkCombatEndWithContext
// ============================================================

describe('checkCombatEndWithContext', () => {
  it('returns victory when enemy HP is 0', () => {
    const ctx = makeContext({ enemy: { ...makeContext().enemy, hp: 0 } });
    const result = checkCombatEndWithContext(ctx);
    expect(result.status).toBe('victory');
  });

  it('returns defeat when player stamina is 0', () => {
    const ctx = makeContext({ player: { ...makeContext().player, stamina: 0 } });
    const result = checkCombatEndWithContext(ctx);
    expect(result.status).toBe('defeat');
  });

  it('returns active when combat continues', () => {
    const ctx = makeContext();
    const result = checkCombatEndWithContext(ctx);
    expect(result.status).toBe('active');
  });

  it('does not change terminal status', () => {
    const ctx = makeContext({ status: 'victory' });
    const result = checkCombatEndWithContext(ctx);
    expect(result.status).toBe('victory');
  });
});

// ============================================================
// Terrain/weather/night modifiers
// ============================================================

describe('terrain modifiers', () => {
  it('丛林: dodge +10%, hit -10%', () => {
    expect(TERRAIN_DODGE_MODIFIERS['丛林']).toBe(0.1);
    expect(TERRAIN_HIT_MODIFIERS['丛林']).toBe(-0.1);
  });

  it('山地: defense +5, dodge -10%', () => {
    expect(TERRAIN_DEFENSE_BONUS['山地']).toBe(5);
    expect(TERRAIN_DODGE_MODIFIERS['山地']).toBe(-0.1);
  });

  it('沼泽: dodge -15%', () => {
    expect(TERRAIN_DODGE_MODIFIERS['沼泽']).toBe(-0.15);
  });

  it('浅海: dodge -20%', () => {
    expect(TERRAIN_DODGE_MODIFIERS['浅海']).toBe(-0.2);
  });

  it('遗迹: dodge -10%, block +20%', () => {
    expect(TERRAIN_DODGE_MODIFIERS['遗迹']).toBe(-0.1);
    expect(TERRAIN_BLOCK_BONUS['遗迹']).toBe(0.2);
  });
});

describe('weather modifiers', () => {
  it('大雾: hit -10%', () => {
    const ctx = makeContext({ weather: '大雾' });
    const strat = { hitRateModifier: 0 } as any;
    const rate = calculateHitRateWithContext(ctx, strat);
    expect(rate).toBeCloseTo(0.8, 10);
  });
});

describe('night modifier', () => {
  it('夜晚: hit -10%', () => {
    const ctx = makeContext({ isNight: true });
    const strat = { hitRateModifier: 0 } as any;
    const rate = calculateHitRateWithContext(ctx, strat);
    expect(rate).toBeCloseTo(0.8, 10);
  });
});

// ============================================================
// Noise system
// ============================================================

describe('calculateNoiseLevel', () => {
  it('普通移动 → none', () => {
    expect(calculateNoiseLevel('普通移动')).toBe('none');
  });

  it('采集 → small', () => {
    expect(calculateNoiseLevel('采集')).toBe('small');
  });

  it('采矿 → large', () => {
    expect(calculateNoiseLevel('采矿')).toBe('large');
  });

  it('砍伐 → large', () => {
    expect(calculateNoiseLevel('砍伐')).toBe('large');
  });

  it('战斗 → medium', () => {
    expect(calculateNoiseLevel('战斗')).toBe('medium');
  });

  it('潜行移动 → none', () => {
    expect(calculateNoiseLevel('潜行移动')).toBe('none');
  });
});

describe('calculateEncounterChance', () => {
  it('silent noise → 0% encounter', () => {
    expect(calculateEncounterChance('none', 0.5)).toBe(0);
  });

  it('scales with zone danger rate', () => {
    const lowDanger = calculateEncounterChance('medium', 0.1);
    const highDanger = calculateEncounterChance('medium', 0.5);
    expect(highDanger).toBeGreaterThan(lowDanger);
  });

  it('caps at 1.0', () => {
    const chance = calculateEncounterChance('large', 1.0);
    expect(chance).toBeLessThanOrEqual(1);
  });

  it('large noise in dangerous zone is significant', () => {
    const chance = calculateEncounterChance('large', 0.5);
    expect(chance).toBeGreaterThan(0.5);
  });
});

// ============================================================
// Full combat flow integration
// ============================================================

describe('full combat flow', () => {
  it('player can defeat enemy with multiple attacks', () => {
    const inv = createInventory();
    let ctx = createCombatContext(
      { stamina: 80, health: 100, energy: 80, attackPower: 10, defense: 0, weightRatio: 0.3, inventory: inv },
      { ...smallEnemyDef, hp: 20 },
      '海滩', '晴', false, 1,
    );

    let turns = 0;
    while (ctx.status === 'active' && turns < 20) {
      turns++;
      const rng = createSeededRNG(turns * 100);
      const result = resolveCombatRound(ctx, '普通攻击', rng);
      ctx = result.context;
      ctx = checkCombatEndWithContext(ctx);
      if (ctx.status !== 'active') break;

      const enemyResult = resolveCombatRoundEnemy(ctx, () => 0.999);
      ctx = enemyResult.context;
      ctx = checkCombatEndWithContext(ctx);
    }

    expect(ctx.status).toBe('victory');
  });

  it('player can retreat and lose an item', () => {
    const ctx = makeContext();
    const rng = createSeededRNG(1);
    const result = resolveCombatRound(ctx, '撤退', rng);
    expect(result.context.status).toBe('retreated');
    expect(result.retreated).toBe(true);
  });
});

// ============================================================
// Weight penalties
// ============================================================

describe('weight penalties', () => {
  it('all strategies available at weight <= 50%', () => {
    expect(getAvailableStrategies(0.0, 70).length).toBe(8);
    expect(getAvailableStrategies(0.25, 70).length).toBe(8);
    expect(getAvailableStrategies(0.5, 70).length).toBe(8);
  });

  it('猛击 and 潜行击 restricted at weight > 50%', () => {
    const strategies = getAvailableStrategies(0.51, 70);
    expect(strategies).not.toContain('猛击');
    expect(strategies).not.toContain('潜行击');
    expect(strategies.length).toBe(6);
  });

  it('only 普通攻击 and 格挡 at weight > 80%', () => {
    const strategies = getAvailableStrategies(0.81, 70);
    expect(strategies.sort()).toEqual(['普通攻击', '格挡']);
    expect(strategies.length).toBe(2);
  });
});

// ============================================================
// Pure function verification
// ============================================================

describe('pure functions', () => {
  it('createCombatContext does not mutate input', () => {
    const inv = createInventory();
    const player = { stamina: 80, health: 100, energy: 80, attackPower: 5, defense: 0, weightRatio: 0.3, inventory: inv };
    const playerCopy = JSON.parse(JSON.stringify(player));
    createCombatContext(player, smallEnemyDef, '海滩', '晴', false, 1);
    expect(player).toEqual(playerCopy);
  });

  it('resolveCombatRound does not mutate input context', () => {
    const ctx = makeContext();
    const ctxCopy = JSON.parse(JSON.stringify(ctx));
    resolveCombatRound(ctx, '普通攻击', createSeededRNG(1));
    expect(ctx).toEqual(ctxCopy);
  });

  it('resolveCombatRoundEnemy does not mutate input context', () => {
    const ctx = makeContext();
    const ctxCopy = JSON.parse(JSON.stringify(ctx));
    resolveCombatRoundEnemy(ctx, createSeededRNG(1));
    expect(ctx).toEqual(ctxCopy);
  });
});

// ============================================================
// Backward compatibility: resolvePlayerAction / resolveEnemyAction
// ============================================================

describe('backward-compatible resolvePlayerAction', () => {
  it('普通攻击 works correctly', () => {
    const state = makeState();
    const result = resolvePlayerAction(state, '普通攻击', { enemyDodge: failRoll, playerHit: successRoll }, 0.3);
    expect(result.state.player.stamina).toBe(70);
    expect(result.damageDealt).toBe(4);
  });

  it('撤退 sets retreated status', () => {
    const state = makeState();
    const result = resolvePlayerAction(state, '撤退', { enemyDodge: failRoll, playerHit: failRoll }, 0.3);
    expect(result.state.status).toBe('retreated');
  });

  it('恐吓 with 50% chance', () => {
    const state = makeState();
    const result = resolvePlayerAction(state, '恐吓', { enemyDodge: 0.1, playerHit: failRoll }, 0.3);
    expect(result.state.status).toBe('retreated');
  });

  it('恐吓 fails with high roll', () => {
    const state = makeState();
    const result = resolvePlayerAction(state, '恐吓', { enemyDodge: 0.8, playerHit: failRoll }, 0.3);
    expect(result.state.status).toBe('active');
  });
});

describe('backward-compatible resolveEnemyAction', () => {
  it('enemy hits player', () => {
    const state = makeState();
    const result = resolveEnemyAction(state, { playerDodge: failRoll, enemyHit: successRoll });
    expect(result.enemyHit).toBe(true);
    expect(result.damageReceived).toBe(3);
  });

  it('player dodges enemy', () => {
    const state = makeState();
    const result = resolveEnemyAction(state, { playerDodge: successRoll, enemyHit: successRoll });
    expect(result.playerDodged).toBe(true);
    expect(result.damageReceived).toBe(0);
  });
});

// ============================================================
// initiateCombat (backward-compatible)
// ============================================================

describe('initiateCombat', () => {
  it('creates combat state from params', () => {
    const state = initiateCombat({
      playerStamina: 80,
      playerAttackPower: 5,
      playerDefense: 0,
      playerHealth: 100,
      inventory: createInventory(),
      enemyDef: smallEnemyDef,
      combatCount: 1,
      terrain: '海滩',
    });

    expect(state.status).toBe('active');
    expect(state.turn).toBe(1);
    expect(state.player.stamina).toBe(80);
    expect(state.enemy.tier).toBe('Small');
  });
});

// ============================================================
// generateLoot
// ============================================================

describe('generateLoot', () => {
  it('generates loot based on enemy drop table with seeded RNG', () => {
    const rng = createSeededRNG(42);
    const loot = generateLoot(smallEnemyDef, rng);
    expect(loot.items.length).toBeGreaterThanOrEqual(0);
    expect(loot.moodBonus).toBe(smallEnemyDef.moodBonus);
  });

  it('produces deterministic results with same seed', () => {
    const rng1 = createSeededRNG(99);
    const rng2 = createSeededRNG(99);
    const loot1 = generateLoot(smallEnemyDef, rng1);
    const loot2 = generateLoot(smallEnemyDef, rng2);
    expect(loot1).toEqual(loot2);
  });
});
