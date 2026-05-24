import { describe, it, expect } from 'vitest';
import {
  initiateCombat,
  resolvePlayerAction,
  resolveEnemyAction,
  calculateDamage,
  checkCombatEnd,
  generateLoot,
  calculateDodgeRate,
  calculateHitRate,
  calculateStaminaCost,
  getAvailableStrategies,
  createSeededRNG,
} from '../combat';
import type {
  CombatState,
  PlayerCombatState,
  EnemyCombatState,
  Terrain,
} from '../combat';
import type { EnemyDef, ItemId } from '@data/types';
import { ENEMIES } from '@data/v1-spec';

// ============================================================
// Helpers
// ============================================================

function makePlayer(overrides?: Partial<PlayerCombatState>): PlayerCombatState {
  return {
    stamina: 80,
    attackPower: 5,
    defense: 0,
    health: 100,
    inventory: [
      { itemId: '食物', quantity: 3 },
      { itemId: '水', quantity: 2 },
      { itemId: '草药', quantity: 1 },
    ],
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

/** Enemy def matching 小野猪 (Small tier) */
const smallEnemyDef: EnemyDef = ENEMIES[0];
/** Enemy def matching 野猪 (Medium tier) */
const mediumEnemyDef: EnemyDef = ENEMIES[2];
/** Enemy def matching 蛇王 (Large tier) */
const largeEnemyDef: EnemyDef = ENEMIES[3];

/** Roll that guarantees success (dodge/hit) — value <= rate threshold */
const successRoll = 0.0;
/** Roll that guarantees failure — value > rate threshold (use 0.999) */
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
    expect(calculateDamage(5, 1, 2)).toBe(8);   // (5-1)*2
    expect(calculateDamage(5, 1, 1.3)).toBe(5); // floor(4*1.3) = 5
  });

  it('floors fractional damage', () => {
    expect(calculateDamage(6, 1, 1.3)).toBe(6);   // floor(5*1.3) = 6
    expect(calculateDamage(7, 2, 0.5)).toBe(2);   // floor(5*0.5) = 2
  });

  it('returns minimum 1 when def >= atk', () => {
    expect(calculateDamage(1, 5, 1)).toBe(1);
    expect(calculateDamage(0, 10, 1)).toBe(1);
  });

  it('applies block damage reduction', () => {
    // (5-1)*1 = 4, block 50% → 2
    expect(calculateDamage(5, 1, 1, 0.5)).toBe(2);
    // minimum 1 still applies after block
    expect(calculateDamage(3, 1, 1, 0.5)).toBe(1); // (2*0.5) = 1
  });

  it('handles zero multiplier (non-attack strategies)', () => {
    expect(calculateDamage(5, 1, 0)).toBe(0);
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

  it('applies weight modifier: heavy (0.51-0.75) → -10%', () => {
    expect(calculateDodgeRate(baseRate, normalStamina, 0.6, 0, noTerrain)).toBeCloseTo(0.2, 10);
  });

  it('applies weight modifier: overloaded (>0.75) → -15%', () => {
    expect(calculateDodgeRate(baseRate, normalStamina, 0.85, 0, noTerrain)).toBe(0.15);
  });

  it('applies terrain modifier', () => {
    // 丛林: +10% dodge
    expect(calculateDodgeRate(baseRate, normalStamina, normalWeight, 0, '丛林')).toBe(0.4);
    // 沼泽: -15% dodge
    expect(calculateDodgeRate(baseRate, normalStamina, normalWeight, 0, '沼泽')).toBe(0.15);
  });

  it('clamps to [0, 1]', () => {
    // Very negative case
    expect(calculateDodgeRate(baseRate, 35, 0.9, 0, '沼泽')).toBe(0);
    // Very positive case  
    expect(calculateDodgeRate(baseRate, 90, 0.2, 0.25, '丛林')).toBe(0.8);
  });

  it('stamina <= 20 overrides all other modifiers', () => {
    // Even with dodge bonus and terrain bonus, stamina <= 20 fixes at 10%
    expect(calculateDodgeRate(baseRate, 10, 0.2, 0.25, '丛林')).toBe(0.1);
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
    expect(calculateHitRate(baseRate, 0.2, 70)).toBe(1.0);  // +20% → capped at 1
    expect(calculateHitRate(baseRate, -0.2, 70)).toBe(0.7); // -20%
  });

  it('applies stamina threshold: <= 20 → cannot attack', () => {
    // Stamina 20 or below means hit rate is 0 (cannot fight effectively)
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
    // Base 10, low stamina ×1.5, 2nd combat ×1.2
    expect(calculateStaminaCost(10, 2, 35)).toBe(18); // floor(10 * 1.5 * 1.2)
  });

  it('returns minimum 1', () => {
    expect(calculateStaminaCost(1, 1, 90)).toBe(1);
  });

  it('returns Infinity when stamina <= 20', () => {
    // Cannot fight — but still report the nominal cost as Infinity
    expect(calculateStaminaCost(10, 1, 10)).toBe(Infinity);
  });
});

// ============================================================
// getAvailableStrategies
// ============================================================

describe('getAvailableStrategies', () => {
  it('returns all 6 strategies under normal conditions', () => {
    const strategies = getAvailableStrategies(0.3, 70);
    expect(strategies).toEqual([
      '普通攻击', '猛击', '闪避姿态', '格挡', '精准攻击', '撤退',
    ]);
  });

  it('restricts 猛击 when weight > 50%', () => {
    const strategies = getAvailableStrategies(0.6, 70);
    expect(strategies).not.toContain('猛击');
    expect(strategies).toContain('普通攻击');
  });

  it('restricts to only 普通攻击 and 格挡 when weight > 75%', () => {
    const strategies = getAvailableStrategies(0.85, 70);
    expect(strategies).toEqual(['普通攻击', '格挡']);
  });

  it('restricts strategies when stamina is critically low', () => {
    // stamina <= 20: cannot fight → only 闪避姿态, 格挡, 撤退
    const strategies = getAvailableStrategies(0.3, 15);
    expect(strategies).not.toContain('普通攻击');
    expect(strategies).not.toContain('猛击');
    expect(strategies).not.toContain('精准攻击');
    expect(strategies).toContain('闪避姿态');
    expect(strategies).toContain('格挡');
    expect(strategies).toContain('撤退');
  });
});

// ============================================================
// initiateCombat
// ============================================================

describe('initiateCombat', () => {
  it('creates initial combat state from player and enemy def', () => {
    const state = initiateCombat({
      playerStamina: 80,
      playerAttackPower: 5,
      playerDefense: 0,
      playerHealth: 100,
      inventory: [],
      enemyDef: smallEnemyDef,
      combatCount: 1,
      terrain: '海滩',
    });

    expect(state.status).toBe('active');
    expect(state.turn).toBe(1);
    expect(state.combatCount).toBe(1);
    expect(state.player.stamina).toBe(80);
    expect(state.player.attackPower).toBe(5);
    expect(state.player.defense).toBe(0);
    expect(state.player.health).toBe(100);
    expect(state.enemy.tier).toBe('Small');
    expect(state.enemy.hp).toBe(smallEnemyDef.hp);
    expect(state.enemy.maxHp).toBe(smallEnemyDef.hp);
    expect(state.enemy.atk).toBe(smallEnemyDef.atk);
    expect(state.enemy.def).toBe(smallEnemyDef.def);
    expect(state.enemy.dodgeRate).toBe(smallEnemyDef.dodgeRate);
    expect(state.terrain).toBe('海滩');
    expect(state.currentDodgeBonus).toBe(0);
    expect(state.currentBlockReduction).toBe(0);
  });

  it('accepts different enemy tiers', () => {
    for (const def of [smallEnemyDef, mediumEnemyDef, largeEnemyDef]) {
      const state = initiateCombat({
        playerStamina: 80, playerAttackPower: 5, playerDefense: 0,
        playerHealth: 100, inventory: [],
        enemyDef: def, combatCount: 1, terrain: '海滩',
      });
      expect(state.enemy.tier).toBe(def.tier);
      expect(state.enemy.hp).toBe(def.hp);
    }
  });
});

// ============================================================
// resolvePlayerAction
// ============================================================

describe('resolvePlayerAction', () => {
  describe('普通攻击 (stamina cost 10)', () => {
    it('deducts 10 stamina', () => {
      const state = makeState();
      const result = resolvePlayerAction(state, '普通攻击', { enemyDodge: failRoll, playerHit: successRoll }, 0.3);
      expect(result.state.player.stamina).toBe(70);
      expect(result.staminaCost).toBe(10);
    });

    it('deals damage when enemy does not dodge and player hits', () => {
      const state = makeState();
      // Enemy dodge rate = 0.2, failRoll = 0.999 → enemy does NOT dodge
      // Player base hit rate = 0.9, successRoll = 0 → player HITS
      const result = resolvePlayerAction(state, '普通攻击', { enemyDodge: failRoll, playerHit: successRoll }, 0.3);
      expect(result.enemyDodged).toBe(false);
      expect(result.playerHit).toBe(true);
      // damage = (5 - 1) * 1 = 4
      expect(result.damageDealt).toBe(4);
      expect(result.state.enemy.hp).toBe(6);
    });

    it('deals zero damage when enemy dodges', () => {
      const state = makeState();
      // Enemy dodge rate = 0.2, successRoll = 0 → enemy DODGES
      const result = resolvePlayerAction(state, '普通攻击', { enemyDodge: successRoll, playerHit: successRoll }, 0.3);
      expect(result.enemyDodged).toBe(true);
      expect(result.damageDealt).toBe(0);
      expect(result.state.enemy.hp).toBe(10);
    });

    it('deals zero damage when player misses', () => {
      const state = makeState();
      // failRoll = 0.999 > hitRate(0.9) → MISS
      const result = resolvePlayerAction(state, '普通攻击', { enemyDodge: failRoll, playerHit: failRoll }, 0.3);
      expect(result.playerHit).toBe(false);
      expect(result.damageDealt).toBe(0);
    });
  });

  describe('猛击 (stamina cost 20, damage ×2, hit -20%)', () => {
    it('deducts 20 stamina', () => {
      const state = makeState();
      const result = resolvePlayerAction(state, '猛击', { enemyDodge: failRoll, playerHit: successRoll }, 0.3);
      expect(result.state.player.stamina).toBe(60);
      expect(result.staminaCost).toBe(20);
    });

    it('deals double damage on hit', () => {
      const state = makeState();
      const result = resolvePlayerAction(state, '猛击', { enemyDodge: failRoll, playerHit: successRoll }, 0.3);
      // damage = (5 - 1) * 2 = 8
      expect(result.damageDealt).toBe(8);
      expect(result.state.enemy.hp).toBe(2);
    });

    it('has reduced hit rate (-20%)', () => {
      // hitRate = 0.9 - 0.2 = 0.7
      // successRoll 0.6 <= 0.7 → HIT
      // successRoll 0.8 > 0.7 → MISS
      const state = makeState();
      const hitResult = resolvePlayerAction(state, '猛击', { enemyDodge: failRoll, playerHit: 0.6 }, 0.3);
      expect(hitResult.playerHit).toBe(true);

      const state2 = makeState();
      const missResult = resolvePlayerAction(state2, '猛击', { enemyDodge: failRoll, playerHit: 0.8 }, 0.3);
      expect(missResult.playerHit).toBe(false);
    });
  });

  describe('闪避姿态 (stamina cost 15, dodge +25%, no attack)', () => {
    it('deducts 15 stamina', () => {
      const state = makeState();
      const result = resolvePlayerAction(state, '闪避姿态', { enemyDodge: failRoll, playerHit: failRoll }, 0.3);
      expect(result.state.player.stamina).toBe(65);
      expect(result.staminaCost).toBe(15);
    });

    it('sets dodge bonus on state and deals no damage', () => {
      const state = makeState();
      const result = resolvePlayerAction(state, '闪避姿态', { enemyDodge: failRoll, playerHit: failRoll }, 0.3);
      expect(result.state.currentDodgeBonus).toBe(0.25);
      expect(result.damageDealt).toBe(0);
      expect(result.state.enemy.hp).toBe(10);
    });
  });

  describe('格挡 (stamina cost 8, block 50%, no attack)', () => {
    it('deducts 8 stamina', () => {
      const state = makeState();
      const result = resolvePlayerAction(state, '格挡', { enemyDodge: failRoll, playerHit: failRoll }, 0.3);
      expect(result.state.player.stamina).toBe(72);
      expect(result.staminaCost).toBe(8);
    });

    it('sets block reduction on state and deals no damage', () => {
      const state = makeState();
      const result = resolvePlayerAction(state, '格挡', { enemyDodge: failRoll, playerHit: failRoll }, 0.3);
      expect(result.state.currentBlockReduction).toBe(0.5);
      expect(result.damageDealt).toBe(0);
    });
  });

  describe('精准攻击 (stamina cost 12, hit +20%, damage ×1.3)', () => {
    it('deducts 12 stamina', () => {
      const state = makeState();
      const result = resolvePlayerAction(state, '精准攻击', { enemyDodge: failRoll, playerHit: successRoll }, 0.3);
      expect(result.state.player.stamina).toBe(68);
      expect(result.staminaCost).toBe(12);
    });

    it('deals 1.3x damage on hit', () => {
      const state = makeState();
      const result = resolvePlayerAction(state, '精准攻击', { enemyDodge: failRoll, playerHit: successRoll }, 0.3);
      // damage = floor((5 - 1) * 1.3) = floor(5.2) = 5
      expect(result.damageDealt).toBe(5);
    });

    it('has increased hit rate (+20%)', () => {
      // hitRate = 0.9 + 0.2 = 1.0 → always hits (unless dodged)
      const state = makeState();
      const result = resolvePlayerAction(state, '精准攻击', { enemyDodge: failRoll, playerHit: 0.95 }, 0.3);
      expect(result.playerHit).toBe(true);
    });
  });

  describe('撤退 (stamina cost 20, lose 1 item)', () => {
    it('sets status to retreated', () => {
      const state = makeState();
      const result = resolvePlayerAction(state, '撤退', { enemyDodge: failRoll, playerHit: failRoll }, 0.3);
      expect(result.state.status).toBe('retreated');
      expect(result.staminaCost).toBe(20);
    });

    it('removes one random item from inventory', () => {
      const state = makeState({ player: makePlayer({ inventory: [
        { itemId: '食物', quantity: 3 },
        { itemId: '水', quantity: 2 },
      ]})});
      const result = resolvePlayerAction(state, '撤退', { enemyDodge: failRoll, playerHit: failRoll }, 0.3);
      // One item should be removed (either 食物 reduced to 2, or 水 reduced to 1)
      const totalItems = result.state.player.inventory.reduce((sum, s) => sum + s.quantity, 0);
      expect(totalItems).toBe(4); // was 5, now 4
    });
  });

  describe('strategy validation', () => {
    it('returns error when player lacks stamina', () => {
      const state = makeState({ player: makePlayer({ stamina: 5 }) });
      const result = resolvePlayerAction(state, '猛击', { enemyDodge: failRoll, playerHit: successRoll }, 0.3);
      // Stamina 5 < 猛击 cost 20 → strategy fails
      expect(result.state.player.stamina).toBe(5); // unchanged
      expect(result.staminaCost).toBe(0);
    });

    it('returns error when strategy is unavailable due to weight', () => {
      const state = makeState();
      const result = resolvePlayerAction(state, '猛击', { enemyDodge: failRoll, playerHit: successRoll }, 0.6);
      // Weight > 50% → 猛击 unavailable
      expect(result.state.player.stamina).toBe(80); // unchanged
      expect(result.staminaCost).toBe(0);
    });

    it('returns error when strategy is unavailable due to low stamina', () => {
      const state = makeState({ player: makePlayer({ stamina: 15 }) });
      const result = resolvePlayerAction(state, '普通攻击', { enemyDodge: failRoll, playerHit: successRoll }, 0.3);
      // Stamina 15 → offensive strategies unavailable
      expect(result.state.player.stamina).toBe(15);
      expect(result.staminaCost).toBe(0);
    });
  });

  describe('consecutive combat penalties', () => {
    it('applies +20% stamina cost for 2nd combat', () => {
      const state = makeState({ combatCount: 2 });
      const result = resolvePlayerAction(state, '普通攻击', { enemyDodge: failRoll, playerHit: failRoll }, 0.3);
      expect(result.staminaCost).toBe(12); // 10 * 1.2 = 12
    });

    it('applies +50% stamina cost for 3rd combat', () => {
      const state = makeState({ combatCount: 3 });
      const result = resolvePlayerAction(state, '普通攻击', { enemyDodge: failRoll, playerHit: failRoll }, 0.3);
      expect(result.staminaCost).toBe(15); // 10 * 1.5 = 15
    });
  });

  describe('killing blow', () => {
    it('reduces enemy HP to 0 on killing blow', () => {
      const state = makeState({ enemy: makeEnemy({ hp: 2, maxHp: 10, dodgeRate: 0.1 }) });
      const result = resolvePlayerAction(state, '猛击', { enemyDodge: failRoll, playerHit: successRoll }, 0.3);
      // damage = (5-1)*2 = 8, enemy HP was 2 → goes to -6, clamped to 0
      expect(result.state.enemy.hp).toBe(0);
    });
  });
});

// ============================================================
// resolveEnemyAction
// ============================================================

describe('resolveEnemyAction', () => {
  it('enemy hits player when player does not dodge and enemy hits', () => {
    const state = makeState();
    // Player dodge rate with normal stamina/weight/terrain = 0.3
    // failRoll 0.999 > 0.3 → player does NOT dodge
    // Enemy base hit rate = 0.9, successRoll 0 → enemy HITS
    const result = resolveEnemyAction(state, { playerDodge: failRoll, enemyHit: successRoll });
    expect(result.playerDodged).toBe(false);
    expect(result.enemyHit).toBe(true);
    // damage = max(1, 3 - 0) = 3
    expect(result.damageReceived).toBe(3);
    expect(result.state.player.health).toBe(97);
  });

  it('enemy deals zero damage when player dodges', () => {
    const state = makeState();
    // successRoll 0 <= 0.3 → player DODGES
    const result = resolveEnemyAction(state, { playerDodge: successRoll, enemyHit: successRoll });
    expect(result.playerDodged).toBe(true);
    expect(result.damageReceived).toBe(0);
    expect(result.state.player.health).toBe(100);
  });

  it('enemy deals zero damage when enemy misses', () => {
    const state = makeState();
    // failRoll 0.999 > 0.9 → enemy MISSES
    const result = resolveEnemyAction(state, { playerDodge: failRoll, enemyHit: failRoll });
    expect(result.enemyHit).toBe(false);
    expect(result.damageReceived).toBe(0);
  });

  it('dodge bonus from 闪避姿态 applies', () => {
    const state = makeState({ currentDodgeBonus: 0.25 });
    // Dodge rate = 0.3 + 0.25 = 0.55
    // Roll 0.5 <= 0.55 → player DODGES
    const result = resolveEnemyAction(state, { playerDodge: 0.5, enemyHit: successRoll });
    expect(result.playerDodged).toBe(true);
    expect(result.damageReceived).toBe(0);
  });

  it('block reduction from 格挡 applies', () => {
    const state = makeState({ currentBlockReduction: 0.5 });
    // Player doesn't dodge, enemy hits → damage = max(1, 3-0) * (1-0.5) = floor(1.5) = 1
    const result = resolveEnemyAction(state, { playerDodge: failRoll, enemyHit: successRoll });
    expect(result.playerDodged).toBe(false);
    expect(result.enemyHit).toBe(true);
    expect(result.damageReceived).toBe(1);
    expect(result.state.player.health).toBe(99);
  });

  it('enemy damage scales with enemy tier', () => {
    // Small enemy: atk=3, player def=0 → damage = 3
    const smallState = makeState({ enemy: makeEnemy({ atk: 3, def: 1 }) });
    const smallResult = resolveEnemyAction(smallState, { playerDodge: failRoll, enemyHit: successRoll });
    expect(smallResult.damageReceived).toBe(3);

    // Medium enemy: atk=7, player def=0 → damage = 7
    const mediumState = makeState({ enemy: makeEnemy({ tier: 'Medium', name: '野猪', icon: '🐗', hp: 20, maxHp: 20, atk: 7, def: 3, dodgeRate: 0.15 }) });
    const mediumResult = resolveEnemyAction(mediumState, { playerDodge: failRoll, enemyHit: successRoll });
    expect(mediumResult.damageReceived).toBe(7);

    // Large enemy: atk=12, player def=0 → damage = 12
    const largeState = makeState({ enemy: makeEnemy({ tier: 'Large', name: '蛇王', icon: '🐍', hp: 35, maxHp: 35, atk: 12, def: 5, dodgeRate: 0.2 }) });
    const largeResult = resolveEnemyAction(largeState, { playerDodge: failRoll, enemyHit: successRoll });
    expect(largeResult.damageReceived).toBe(12);
  });

  it('player defense reduces enemy damage', () => {
    const state = makeState({ player: makePlayer({ defense: 3 }) });
    // damage = max(1, 3 - 3) = 1
    const result = resolveEnemyAction(state, { playerDodge: failRoll, enemyHit: successRoll });
    expect(result.damageReceived).toBe(1);
  });
});

// ============================================================
// checkCombatEnd
// ============================================================

describe('checkCombatEnd', () => {
  it('returns victory when enemy HP is 0', () => {
    const state = makeState({ enemy: makeEnemy({ hp: 0, maxHp: 10 }) });
    const result = checkCombatEnd(state);
    expect(result.status).toBe('victory');
  });

  it('returns victory when enemy HP is negative', () => {
    const state = makeState({ enemy: makeEnemy({ hp: -5, maxHp: 10 }) });
    const result = checkCombatEnd(state);
    expect(result.status).toBe('victory');
  });

  it('returns retreated when status was set to retreated', () => {
    const state = makeState({ status: 'retreated' });
    const result = checkCombatEnd(state);
    expect(result.status).toBe('retreated');
  });

  it('returns defeat when player stamina is 0', () => {
    const state = makeState({ player: makePlayer({ stamina: 0 }) });
    const result = checkCombatEnd(state);
    expect(result.status).toBe('defeat');
  });

  it('returns defeat when player stamina is negative', () => {
    const state = makeState({ player: makePlayer({ stamina: -1 }) });
    const result = checkCombatEnd(state);
    expect(result.status).toBe('defeat');
  });

  it('returns active when combat continues', () => {
    const state = makeState();
    const result = checkCombatEnd(state);
    expect(result.status).toBe('active');
  });

  it('does not change status that is already terminal', () => {
    const state = makeState({ status: 'victory' });
    const result = checkCombatEnd(state);
    expect(result.status).toBe('victory');
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

  it('returns mood bonus from enemy def', () => {
    const rng = createSeededRNG(1);
    const loot = generateLoot(smallEnemyDef, rng);
    expect(loot.moodBonus).toBe(5);

    const loot2 = generateLoot(mediumEnemyDef, createSeededRNG(1));
    expect(loot2.moodBonus).toBe(8);

    const loot3 = generateLoot(largeEnemyDef, createSeededRNG(1));
    expect(loot3.moodBonus).toBe(15);
  });

  it('produces deterministic results with same seed', () => {
    const rng1 = createSeededRNG(99);
    const rng2 = createSeededRNG(99);
    const loot1 = generateLoot(smallEnemyDef, rng1);
    const loot2 = generateLoot(smallEnemyDef, rng2);
    expect(loot1).toEqual(loot2);
  });

  it('respects drop table quantity ranges', () => {
    const rng = createSeededRNG(7);
    const loot = generateLoot(smallEnemyDef, rng);
    for (const item of loot.items) {
      const dropEntry = smallEnemyDef.dropTable.find(d => d.itemId === item.itemId);
      expect(dropEntry).toBeDefined();
      if (dropEntry) {
        expect(item.quantity).toBeGreaterThanOrEqual(dropEntry.min);
        expect(item.quantity).toBeLessThanOrEqual(dropEntry.max);
      }
    }
  });

  it('large enemy generates better loot', () => {
    // Large enemy has 100%蛇胆 drop and 50%高级材料 drop
    const rng = createSeededRNG(42);
    const loot = generateLoot(largeEnemyDef, rng);
    // At minimum should get 蛇胆 (100% drop rate)
    const snakeGall = loot.items.find((i: { itemId: ItemId; quantity: number }) => i.itemId === '蛇胆');
    expect(snakeGall).toBeDefined();
  });
});

// ============================================================
// Integration: Full combat flow
// ============================================================

describe('full combat flow', () => {
  it('player can defeat small enemy in one turn with 猛击', () => {
    const state = initiateCombat({
      playerStamina: 80, playerAttackPower: 10, playerDefense: 0,
      playerHealth: 100, inventory: [],
      enemyDef: smallEnemyDef, combatCount: 1, terrain: '海滩',
    });

    const result = resolvePlayerAction(state, '猛击', { enemyDodge: failRoll, playerHit: successRoll }, 0.3);
    // Attack 10, enemy def 1, ×2 multiplier → (10-1)*2 = 18, enemy HP was 10
    expect(result.state.enemy.hp).toBe(0);

    const endState = checkCombatEnd(result.state);
    expect(endState.status).toBe('victory');
  });

  it('multi-turn combat: player wins after several normal attacks', () => {
    let state = initiateCombat({
      playerStamina: 80, playerAttackPower: 10, playerDefense: 0,
      playerHealth: 100, inventory: [],
      enemyDef: {
        ...mediumEnemyDef,
        hp: 24,
      },
      combatCount: 1,
      terrain: '海滩',
    });
    // Enemy: HP 24, DEF 3. Player ATK 10 → damage per hit = (10-3)*1 = 7
    // Need ~4 hits, 4 turns. Stamina cost: 10, 10, 10, 15 = 45 total.

    let turns = 0;
    while (state.status === 'active' && turns < 20) {
      turns++;
      const playerResult = resolvePlayerAction(state, '普通攻击',
        { enemyDodge: failRoll, playerHit: successRoll }, 0.3);
      state = playerResult.state;

      state = checkCombatEnd(state);
      if (state.status !== 'active') break;

      const enemyResult = resolveEnemyAction(state,
        { playerDodge: failRoll, enemyHit: failRoll }); // enemy misses every time
      state = enemyResult.state;
      state = checkCombatEnd(state);
    }

    expect(state.status).toBe('victory');
    expect(turns).toBe(4);
  });

  it('player loses when stamina depletes to 0 after action', () => {
    const state = makeState({
      player: makePlayer({ stamina: 22 }),
      combatCount: 3, // +50% consecutive penalty
    });
    // 普通攻击 base cost 10, stamina 22 (≤50: ×1.5), combatCount 3 (×1.5)
    // → cost = floor(10 * 1.5 * 1.5) = 22, stamina → 0
    const result = resolvePlayerAction(state, '普通攻击',
      { enemyDodge: failRoll, playerHit: failRoll }, 0.3);
    expect(result.state.player.stamina).toBe(0);
    expect(result.staminaCost).toBe(22);

    const endState = checkCombatEnd(result.state);
    expect(endState.status).toBe('defeat');
  });

  it('player can retreat and lose an item', () => {
    const state = makeState({
      player: makePlayer({ inventory: [
        { itemId: '食物', quantity: 3 },
        { itemId: '草药', quantity: 2 },
      ]}),
    });
    const result = resolvePlayerAction(state, '撤退', { enemyDodge: failRoll, playerHit: failRoll }, 0.3);
    expect(result.state.status).toBe('retreated');

    const totalItems = result.state.player.inventory.reduce((sum, s) => sum + s.quantity, 0);
    expect(totalItems).toBe(4); // was 5, lost 1

    const endState = checkCombatEnd(result.state);
    expect(endState.status).toBe('retreated');
  });

  it('dodge and block mechanics work together in a turn', () => {
    const state = makeState({ currentDodgeBonus: 0.25, currentBlockReduction: 0.5 });
    // Player has dodge bonus + block reduction from previous turn's strategy
    // Enemy attacks: player dodge rate = 0.3 + 0.25 = 0.55
    // If roll 0.6 > 0.55 → not dodged → enemy hits → damage halved by block
    const result = resolveEnemyAction(state, { playerDodge: 0.6, enemyHit: successRoll });
    expect(result.playerDodged).toBe(false);
    expect(result.enemyHit).toBe(true);
    // damage = max(1, 3-0) * (1-0.5) = floor(1.5) = 1
    expect(result.damageReceived).toBe(1);
  });
});

// ============================================================
// Weight penalties on combat
// ============================================================

describe('weight penalties', () => {
  it('all strategies available at weight <= 50%', () => {
    expect(getAvailableStrategies(0.0, 70).length).toBe(6);
    expect(getAvailableStrategies(0.25, 70).length).toBe(6);
    expect(getAvailableStrategies(0.5, 70).length).toBe(6);
  });

  it('猛击 restricted at weight > 50%', () => {
    const strategies = getAvailableStrategies(0.51, 70);
    expect(strategies).not.toContain('猛击');
    expect(strategies.length).toBe(5);
  });

  it('only 普通攻击 and 格挡 at weight > 75%', () => {
    const strategies = getAvailableStrategies(0.76, 70);
    expect(strategies.sort()).toEqual(['普通攻击', '格挡']);
    expect(strategies.length).toBe(2);
  });
});

// ============================================================
// Pure function verification
// ============================================================

describe('pure functions', () => {
  it('initiateCombat does not mutate input params', () => {
    const inventory = [{ itemId: '食物' as ItemId, quantity: 1 }];
    const inventoryCopy = [...inventory];
    initiateCombat({
      playerStamina: 80, playerAttackPower: 5, playerDefense: 0,
      playerHealth: 100, inventory,
      enemyDef: smallEnemyDef, combatCount: 1, terrain: '海滩',
    });
    expect(inventory).toEqual(inventoryCopy);
  });

  it('resolvePlayerAction does not mutate input state', () => {
    const state = makeState();
    const stateCopy = JSON.parse(JSON.stringify(state));
    resolvePlayerAction(state, '普通攻击', { enemyDodge: failRoll, playerHit: successRoll }, 0.3);
    expect(state).toEqual(stateCopy);
  });

  it('resolveEnemyAction does not mutate input state', () => {
    const state = makeState();
    const stateCopy = JSON.parse(JSON.stringify(state));
    resolveEnemyAction(state, { playerDodge: failRoll, enemyHit: successRoll });
    expect(state).toEqual(stateCopy);
  });

  it('checkCombatEnd does not mutate input state', () => {
    const state = makeState();
    const stateCopy = JSON.parse(JSON.stringify(state));
    checkCombatEnd(state);
    expect(state).toEqual(stateCopy);
  });
});
