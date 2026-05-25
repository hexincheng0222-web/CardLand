// ============================================================
// CardLand Rest System Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  canRest,
  calculateRestRecovery,
  executeRest,
} from '../rest';
import type { RestContext } from '../rest';
import type { Attributes } from '../attributes';
import { DEFAULT_ATTRIBUTES, createSeededRNG } from '../attributes';

// ============================================================
// Helpers
// ============================================================

const defaultAttributes = (): Attributes => ({ ...DEFAULT_ATTRIBUTES });

const makeContext = (overrides: Partial<RestContext> = {}): RestContext => ({
  pointId: 'A1-North',
  weather: '晴',
  environmentTemperature: 60,
  hasCampfire: false,
  shelterLevel: 0,
  isRestPoint: false,
  isWarmSpring: false,
  ...overrides,
});

const seededRng = (seed: number) => createSeededRNG(seed);

// ============================================================
// canRest
// ============================================================

describe('canRest', () => {
  describe('短休', () => {
    it('allowed anywhere', () => {
      const result = canRest('短休', makeContext());
      expect(result.allowed).toBe(true);
    });

    it('allowed without shelter', () => {
      const result = canRest('短休', makeContext({ shelterLevel: 0 }));
      expect(result.allowed).toBe(true);
    });
  });

  describe('长休', () => {
    it('requires Lv1+ shelter or rest point', () => {
      const result = canRest('长休', makeContext({ shelterLevel: 0, isRestPoint: false }));
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Lv1');
    });

    it('allowed with Lv1 shelter', () => {
      const result = canRest('长休', makeContext({ shelterLevel: 1 }));
      expect(result.allowed).toBe(true);
    });

    it('allowed at rest point without shelter', () => {
      const result = canRest('长休', makeContext({ shelterLevel: 0, isRestPoint: true }));
      expect(result.allowed).toBe(true);
    });

    it('allowed with Lv2 shelter', () => {
      const result = canRest('长休', makeContext({ shelterLevel: 2 }));
      expect(result.allowed).toBe(true);
    });
  });

  describe('睡眠', () => {
    it('allowed with Lv2+ shelter', () => {
      const result = canRest('睡眠', makeContext({ shelterLevel: 2 }));
      expect(result.allowed).toBe(true);
    });

    it('allowed with Lv3 shelter', () => {
      const result = canRest('睡眠', makeContext({ shelterLevel: 3 }));
      expect(result.allowed).toBe(true);
    });

    it('wilderness sleep (Lv0) is allowed but risky', () => {
      const result = canRest('睡眠', makeContext({ shelterLevel: 0 }));
      expect(result.allowed).toBe(true);
    });

    it('not allowed with Lv1 shelter', () => {
      const result = canRest('睡眠', makeContext({ shelterLevel: 1 }));
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Lv2');
    });
  });

  describe('温泉', () => {
    it('allowed at warm spring', () => {
      const result = canRest('温泉', makeContext({ isWarmSpring: true }));
      expect(result.allowed).toBe(true);
    });

    it('not allowed elsewhere', () => {
      const result = canRest('温泉', makeContext({ isWarmSpring: false }));
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('温泉');
    });
  });
});

// ============================================================
// calculateRestRecovery
// ============================================================

describe('calculateRestRecovery', () => {
  describe('短休', () => {
    it('base stamina recovery +30', () => {
      const recovery = calculateRestRecovery('短休', defaultAttributes(), makeContext());
      expect(recovery.stamina).toBe(30);
    });

    it('rest point gives +10% stamina bonus (30→40)', () => {
      const recovery = calculateRestRecovery(
        '短休', defaultAttributes(), makeContext({ isRestPoint: true }),
      );
      expect(recovery.stamina).toBe(40);
    });

    it('shelter Lv1 gives +10% stamina bonus', () => {
      const recovery = calculateRestRecovery(
        '短休', defaultAttributes(), makeContext({ shelterLevel: 1 }),
      );
      expect(recovery.stamina).toBe(40);
    });

    it('satiety > 80 gives +10% stamina bonus', () => {
      const attrs = { ...defaultAttributes(), '饱食度': 85 };
      const recovery = calculateRestRecovery('短休', attrs, makeContext());
      expect(recovery.stamina).toBe(40);
    });

    it('health ≤ 60 halves stamina recovery', () => {
      const attrs = { ...defaultAttributes(), '健康值': 60 };
      const recovery = calculateRestRecovery('短休', attrs, makeContext());
      expect(recovery.stamina).toBe(15); // 30 * 0.5
    });

    it('health ≤ 60 + rest point + shelter stack correctly', () => {
      const attrs = { ...defaultAttributes(), '健康值': 60 };
      const recovery = calculateRestRecovery(
        '短休', attrs, makeContext({ isRestPoint: true, shelterLevel: 1 }),
      );
      // base 30 + rest point 10 + shelter 10 = 50, then *0.5 = 25
      expect(recovery.stamina).toBe(25);
    });

    it('energy recovery +20 minus natural decay', () => {
      const recovery = calculateRestRecovery('短休', defaultAttributes(), makeContext());
      // +20 base + (-0.5 * 1h) = +19.5
      expect(recovery.energy).toBe(19.5);
    });

    it('energy ≤ 50 halves recovery', () => {
      const attrs = { ...defaultAttributes(), '精力值': 50 };
      const recovery = calculateRestRecovery('短休', attrs, makeContext());
      // 20 * 0.5 = 10, + (-0.5) = 9.5
      expect(recovery.energy).toBe(9.5);
    });

    it('shelter Lv1 gives +5 energy bonus', () => {
      const recovery = calculateRestRecovery(
        '短休', defaultAttributes(), makeContext({ shelterLevel: 1 }),
      );
      // 20 + 5 + (-0.5) = 24.5
      expect(recovery.energy).toBe(24.5);
    });

    it('satiety decays -1/h', () => {
      const recovery = calculateRestRecovery('短休', defaultAttributes(), makeContext());
      expect(recovery.satiety).toBe(-1);
    });

    it('satiety ≤ 30 extra -0.5/h', () => {
      const attrs = { ...defaultAttributes(), '饱食度': 30 };
      const recovery = calculateRestRecovery('短休', attrs, makeContext());
      expect(recovery.satiety).toBe(-1.5);
    });

    it('thirst decays -1.5/h', () => {
      const recovery = calculateRestRecovery('短休', defaultAttributes(), makeContext());
      expect(recovery.thirst).toBe(-1.5);
    });

    it('hot weather adds -1/h to thirst', () => {
      const recovery = calculateRestRecovery(
        '短休', defaultAttributes(), makeContext({ weather: '酷热' }),
      );
      expect(recovery.thirst).toBe(-2.5);
    });

    it('dirt accumulates +1/h', () => {
      const recovery = calculateRestRecovery('短休', defaultAttributes(), makeContext());
      expect(recovery.dirt).toBe(1);
    });

    it('mood decays -0.5 total', () => {
      const recovery = calculateRestRecovery('短休', defaultAttributes(), makeContext());
      expect(recovery.mood).toBe(-0.5);
    });

    it('campfire gives +0.5 mood (抵消 natural decay)', () => {
      const recovery = calculateRestRecovery(
        '短休', defaultAttributes(), makeContext({ hasCampfire: true }),
      );
      expect(recovery.mood).toBe(0);
    });

    it('shelter gives +0.5 mood for short rest', () => {
      const recovery = calculateRestRecovery(
        '短休', defaultAttributes(), makeContext({ shelterLevel: 1 }),
      );
      expect(recovery.mood).toBe(0);
    });

    it('campfire + shelter mood stacks (+1 net +0.5)', () => {
      const recovery = calculateRestRecovery(
        '短休', defaultAttributes(), makeContext({ hasCampfire: true, shelterLevel: 1 }),
      );
      expect(recovery.mood).toBe(0.5);
    });

    it('temperature converges toward environment at 0.5/h', () => {
      const attrs = { ...defaultAttributes(), '体温': 50 };
      const recovery = calculateRestRecovery(
        '短休', attrs, makeContext({ environmentTemperature: 60 }),
      );
      expect(recovery.temperature).toBe(0.5);
    });

    it('temperature cools when above environment', () => {
      const attrs = { ...defaultAttributes(), '体温': 70 };
      const recovery = calculateRestRecovery(
        '短休', attrs, makeContext({ environmentTemperature: 60 }),
      );
      expect(recovery.temperature).toBe(-0.5);
    });

    it('campfire adds +10/h to temperature', () => {
      const attrs = { ...defaultAttributes(), '体温': 50 };
      const recovery = calculateRestRecovery(
        '短休', attrs, makeContext({ hasCampfire: true, environmentTemperature: 40 }),
      );
      // cooling: -0.5 (flat) + campfire +10 = +9.5
      expect(recovery.temperature).toBe(9.5);
    });

    it('shelter prevents temperature from dropping', () => {
      const attrs = { ...defaultAttributes(), '体温': 70 };
      const recovery = calculateRestRecovery(
        '短休', attrs, makeContext({ shelterLevel: 1, environmentTemperature: 50 }),
      );
      // would be -0.5 but shelter blocks negative
      expect(recovery.temperature).toBe(0);
    });

    it('health has no base recovery for short rest', () => {
      const recovery = calculateRestRecovery('短休', defaultAttributes(), makeContext());
      expect(recovery.health).toBe(0);
    });
  });

  describe('长休', () => {
    it('base stamina recovery +60', () => {
      const recovery = calculateRestRecovery('长休', defaultAttributes(), makeContext({ shelterLevel: 1 }));
      expect(recovery.stamina).toBe(60);
    });

    it('satiety > 80 gives +15% stamina bonus', () => {
      const attrs = { ...defaultAttributes(), '饱食度': 85 };
      const recovery = calculateRestRecovery('长休', attrs, makeContext({ shelterLevel: 1 }));
      expect(recovery.stamina).toBe(75);
    });

    it('energy recovery +50 minus natural decay -1/h', () => {
      const recovery = calculateRestRecovery('长休', defaultAttributes(), makeContext({ shelterLevel: 1 }));
      // +50 + (-0.5 * 2h) = +49
      expect(recovery.energy).toBe(49);
    });

    it('satiety decays -2/h (2h total)', () => {
      const recovery = calculateRestRecovery('长休', defaultAttributes(), makeContext({ shelterLevel: 1 }));
      expect(recovery.satiety).toBe(-2);
    });

    it('thirst decays -3/h (2h total)', () => {
      const recovery = calculateRestRecovery('长休', defaultAttributes(), makeContext({ shelterLevel: 1 }));
      expect(recovery.thirst).toBe(-3);
    });

    it('hot weather adds -2 flat to thirst', () => {
      const recovery = calculateRestRecovery(
        '长休', defaultAttributes(), makeContext({ shelterLevel: 1, weather: '酷热' }),
      );
      expect(recovery.thirst).toBe(-5); // -3 base + -2 hot
    });

    it('dirt accumulates +2/h (2h total)', () => {
      const recovery = calculateRestRecovery('长休', defaultAttributes(), makeContext({ shelterLevel: 1 }));
      expect(recovery.dirt).toBe(2);
    });

    it('mood decays -1 total', () => {
      const recovery = calculateRestRecovery('长休', defaultAttributes(), makeContext({ shelterLevel: 1 }));
      expect(recovery.mood).toBe(-1);
    });

    it('campfire gives +1 mood (抵消)', () => {
      const recovery = calculateRestRecovery(
        '长休', defaultAttributes(), makeContext({ shelterLevel: 1, hasCampfire: true }),
      );
      expect(recovery.mood).toBe(0);
    });

    it('health recovery +5 (轻伤)', () => {
      const recovery = calculateRestRecovery('长休', defaultAttributes(), makeContext({ shelterLevel: 1 }));
      expect(recovery.health).toBe(5);
    });

    it('temperature converges ±1 total', () => {
      const attrs = { ...defaultAttributes(), '体温': 50 };
      const recovery = calculateRestRecovery(
        '长休', attrs, makeContext({ shelterLevel: 1, environmentTemperature: 60 }),
      );
      expect(recovery.temperature).toBe(1);
    });
  });

  describe('睡眠', () => {
    it('base stamina recovery +100', () => {
      const recovery = calculateRestRecovery('睡眠', defaultAttributes(), makeContext({ shelterLevel: 2 }));
      expect(recovery.stamina).toBe(100);
    });

    it('wilderness sleep limits stamina to +30', () => {
      const recovery = calculateRestRecovery('睡眠', defaultAttributes(), makeContext({ shelterLevel: 0 }));
      expect(recovery.stamina).toBe(30);
    });

    it('energy recovery +80 minus natural decay -4/h', () => {
      const recovery = calculateRestRecovery('睡眠', defaultAttributes(), makeContext({ shelterLevel: 2 }));
      // +80 + (-0.5 * 8h) = +76
      expect(recovery.energy).toBe(76);
    });

    it('satiety decays -8/h (8h total)', () => {
      const recovery = calculateRestRecovery('睡眠', defaultAttributes(), makeContext({ shelterLevel: 2 }));
      expect(recovery.satiety).toBe(-8);
    });

    it('thirst decays -12/h (8h total)', () => {
      const recovery = calculateRestRecovery('睡眠', defaultAttributes(), makeContext({ shelterLevel: 2 }));
      expect(recovery.thirst).toBe(-12);
    });

    it('hot weather adds -8 flat to thirst during sleep', () => {
      const recovery = calculateRestRecovery(
        '睡眠', defaultAttributes(), makeContext({ shelterLevel: 2, weather: '酷热' }),
      );
      expect(recovery.thirst).toBe(-20);
    });

    it('dirt accumulates +8/h (8h total)', () => {
      const recovery = calculateRestRecovery('睡眠', defaultAttributes(), makeContext({ shelterLevel: 2 }));
      expect(recovery.dirt).toBe(8);
    });

    it('mood decays -4 total (no shelter/campfire)', () => {
      const recovery = calculateRestRecovery('睡眠', defaultAttributes(), makeContext({ shelterLevel: 0 }));
      expect(recovery.mood).toBe(-4);
    });

    it('campfire +4 mood + shelter +4 mood offsets -4 decay → net +4', () => {
      const recovery = calculateRestRecovery(
        '睡眠', defaultAttributes(), makeContext({ shelterLevel: 2, hasCampfire: true }),
      );
      expect(recovery.mood).toBe(4);
    });

    it('health recovery +10 (中伤)', () => {
      const recovery = calculateRestRecovery('睡眠', defaultAttributes(), makeContext({ shelterLevel: 2 }));
      expect(recovery.health).toBe(10);
    });

    it('temperature converges ±4 total', () => {
      const attrs = { ...defaultAttributes(), '体温': 40 };
      const recovery = calculateRestRecovery(
        '睡眠', attrs, makeContext({ shelterLevel: 2, environmentTemperature: 60 }),
      );
      expect(recovery.temperature).toBe(4);
    });
  });

  describe('温泉', () => {
    const springContext = makeContext({ isWarmSpring: true, pointId: 'C4-South' });

    it('base stamina recovery +80', () => {
      const recovery = calculateRestRecovery('温泉', defaultAttributes(), springContext);
      expect(recovery.stamina).toBe(80);
    });

    it('energy recovery +70 minus natural decay -0.5/h', () => {
      const recovery = calculateRestRecovery('温泉', defaultAttributes(), springContext);
      // +70 + (-0.5 * 1h) = +69.5
      expect(recovery.energy).toBe(69.5);
    });

    it('satiety decays -1/h', () => {
      const recovery = calculateRestRecovery('温泉', defaultAttributes(), springContext);
      expect(recovery.satiety).toBe(-1);
    });

    it('thirst decays -2/h (温泉出汗)', () => {
      const recovery = calculateRestRecovery('温泉', defaultAttributes(), springContext);
      expect(recovery.thirst).toBe(-2);
    });

    it('dirt -40 cleaning + 1/h natural = net -39', () => {
      const recovery = calculateRestRecovery('温泉', defaultAttributes(), springContext);
      expect(recovery.dirt).toBe(-39);
    });

    it('mood +20 base - 0.5/h natural = +19.5', () => {
      const recovery = calculateRestRecovery('温泉', defaultAttributes(), springContext);
      expect(recovery.mood).toBe(19.5);
    });

    it('health recovery +15', () => {
      const recovery = calculateRestRecovery('温泉', defaultAttributes(), springContext);
      expect(recovery.health).toBe(15);
    });

    it('temperature +15/h', () => {
      const recovery = calculateRestRecovery('温泉', defaultAttributes(), springContext);
      expect(recovery.temperature).toBe(15);
    });
  });
});

// ============================================================
// executeRest
// ============================================================

describe('executeRest', () => {
  describe('basic execution', () => {
    it('returns success for valid rest', () => {
      const result = executeRest(defaultAttributes(), '短休', makeContext());
      expect(result.success).toBe(true);
      expect(result.timeCost).toBe(60);
    });

    it('returns failure for invalid rest', () => {
      const result = executeRest(defaultAttributes(), '长休', makeContext({ shelterLevel: 0, isRestPoint: false }));
      expect(result.success).toBe(false);
      expect(result.failReason).toBeDefined();
      expect(result.timeCost).toBe(0);
    });

    it('does not mutate input attributes', () => {
      const attrs = defaultAttributes();
      const snap = { ...attrs };
      executeRest(attrs, '短休', makeContext());
      expect(attrs).toEqual(snap);
    });
  });

  describe('短休 attribute changes', () => {
    it('recovers stamina at rest point', () => {
      const attrs = { ...defaultAttributes(), '体力值': 50 };
      const result = executeRest(attrs, '短休', makeContext({ isRestPoint: true }));
      expect(result.newAttributes['体力值']).toBe(90); // 50 + 40
    });

    it('campfire gives mood bonus (no net loss)', () => {
      const attrs = { ...defaultAttributes(), '心情': 70 };
      const result = executeRest(attrs, '短休', makeContext({ hasCampfire: true }));
      // -0.5 + 0.5 = 0 net
      expect(result.newAttributes['心情']).toBe(70);
    });

    it('satiety decreases during rest', () => {
      const attrs = { ...defaultAttributes(), '饱食度': 60 };
      const result = executeRest(attrs, '短休', makeContext());
      expect(result.newAttributes['饱食度']).toBe(59); // 60 - 1
    });

    it('thirst decreases during rest', () => {
      const attrs = { ...defaultAttributes(), '口渴度': 60 };
      const result = executeRest(attrs, '短休', makeContext());
      expect(result.newAttributes['口渴度']).toBe(58.5); // 60 - 1.5
    });

    it('dirt increases during rest', () => {
      const attrs = { ...defaultAttributes(), '污垢': 20 };
      const result = executeRest(attrs, '短休', makeContext());
      expect(result.newAttributes['污垢']).toBe(21); // 20 + 1
    });
  });

  describe('长休 requirements', () => {
    it('fails without Lv1+ shelter or rest point', () => {
      const result = executeRest(defaultAttributes(), '长休', makeContext());
      expect(result.success).toBe(false);
    });

    it('succeeds with Lv1 shelter', () => {
      const result = executeRest(defaultAttributes(), '长休', makeContext({ shelterLevel: 1 }));
      expect(result.success).toBe(true);
    });

    it('succeeds at rest point', () => {
      const result = executeRest(defaultAttributes(), '长休', makeContext({ isRestPoint: true }));
      expect(result.success).toBe(true);
    });

    it('recovers health +5', () => {
      const attrs = { ...defaultAttributes(), '健康值': 80 };
      const result = executeRest(attrs, '长休', makeContext({ shelterLevel: 1 }));
      expect(result.newAttributes['健康值']).toBe(85);
    });
  });

  describe('睡眠 requirements and effects', () => {
    it('fails with Lv1 shelter', () => {
      const result = executeRest(defaultAttributes(), '睡眠', makeContext({ shelterLevel: 1 }));
      expect(result.success).toBe(false);
    });

    it('succeeds with Lv2 shelter', () => {
      const result = executeRest(defaultAttributes(), '睡眠', makeContext({ shelterLevel: 2 }));
      expect(result.success).toBe(true);
      expect(result.timeCost).toBe(480);
    });

    it('wilderness sleep is allowed (Lv0)', () => {
      const result = executeRest(defaultAttributes(), '睡眠', makeContext({ shelterLevel: 0 }));
      expect(result.success).toBe(true);
    });

    it('grants 精神饱满 status effect', () => {
      const result = executeRest(defaultAttributes(), '睡眠', makeContext({ shelterLevel: 2 }));
      expect(result.statusEffectsGained).toContain('精神饱满');
    });

    it('wilderness sleep limits stamina to +30', () => {
      const attrs = { ...defaultAttributes(), '体力值': 20 };
      const result = executeRest(attrs, '睡眠', makeContext({ shelterLevel: 0 }));
      expect(result.newAttributes['体力值']).toBe(50); // 20 + 30
    });

    it('shelter sleep gives full stamina +100', () => {
      const attrs = { ...defaultAttributes(), '体力值': 0 };
      const result = executeRest(attrs, '睡眠', makeContext({ shelterLevel: 2 }));
      expect(result.newAttributes['体力值']).toBe(100); // 0 + 100, clamped to 100
    });
  });

  describe('wilderness sleep risks', () => {
    it('33% beast attack in wilderness', () => {
      const rng = () => 0.2; // below 0.33 threshold
      const result = executeRest(
        defaultAttributes(), '睡眠', makeContext({ shelterLevel: 0 }), rng,
      );
      expect(result.beastAttack).toBe(true);
    });

    it('no beast attack with Lv2 shelter', () => {
      const rng = seededRng(1); // same seed, but shelter protects
      const result = executeRest(
        defaultAttributes(), '睡眠', makeContext({ shelterLevel: 2 }), rng,
      );
      expect(result.beastAttack).toBe(false);
    });

    it('beast attack probability is approximately 33%', () => {
      let attacks = 0;
      const trials = 1000;
      for (let i = 0; i < trials; i++) {
        const rng = seededRng(i * 7 + 42);
        const result = executeRest(
          defaultAttributes(), '睡眠', makeContext({ shelterLevel: 0 }), rng,
        );
        if (result.beastAttack) attacks++;
      }
      // Should be approximately 33% (allow 28-38% range)
      const rate = attacks / trials;
      expect(rate).toBeGreaterThan(0.28);
      expect(rate).toBeLessThan(0.38);
    });

    it('rainstorm + wilderness triggers wet', () => {
      const rng = seededRng(100); // seed where beast attack doesn't happen
      const result = executeRest(
        defaultAttributes(), '睡眠',
        makeContext({ shelterLevel: 0, weather: '暴雨' }),
        rng,
      );
      expect(result.wetTriggered).toBe(true);
    });

    it('rainstorm + shelter does NOT trigger wet', () => {
      const rng = seededRng(100);
      const result = executeRest(
        defaultAttributes(), '睡眠',
        makeContext({ shelterLevel: 2, weather: '暴雨' }),
        rng,
      );
      expect(result.wetTriggered).toBe(false);
    });
  });

  describe('温泉 special bonuses', () => {
    const springCtx = makeContext({ isWarmSpring: true, pointId: 'C4-South' });

    it('only available at warm spring', () => {
      const result = executeRest(defaultAttributes(), '温泉', makeContext({ isWarmSpring: false }));
      expect(result.success).toBe(false);
    });

    it('recovers +80 stamina', () => {
      const attrs = { ...defaultAttributes(), '体力值': 20 };
      const result = executeRest(attrs, '温泉', springCtx);
      expect(result.newAttributes['体力值']).toBe(100); // 20 + 80
    });

    it('recovers +69.5 energy', () => {
      const attrs = { ...defaultAttributes(), '精力值': 30 };
      const result = executeRest(attrs, '温泉', springCtx);
      expect(result.newAttributes['精力值']).toBe(99.5); // 30 + 69.5
    });

    it('cleans dirt significantly (-39 net)', () => {
      const attrs = { ...defaultAttributes(), '污垢': 80 };
      const result = executeRest(attrs, '温泉', springCtx);
      expect(result.newAttributes['污垢']).toBe(41); // 80 - 39
    });

    it('recovers mood +19.5', () => {
      const attrs = { ...defaultAttributes(), '心情': 50 };
      const result = executeRest(attrs, '温泉', springCtx);
      expect(result.newAttributes['心情']).toBe(69.5); // 50 + 19.5
    });

    it('recovers health +15', () => {
      const attrs = { ...defaultAttributes(), '健康值': 70 };
      const result = executeRest(attrs, '温泉', springCtx);
      expect(result.newAttributes['健康值']).toBe(85); // 70 + 15
    });

    it('warms temperature +15/h', () => {
      const attrs = { ...defaultAttributes(), '体温': 50 };
      const result = executeRest(attrs, '温泉', springCtx);
      expect(result.newAttributes['体温']).toBe(65); // 50 + 15
    });

    it('grants 清爽 status effect', () => {
      const result = executeRest(defaultAttributes(), '温泉', springCtx);
      expect(result.statusEffectsGained).toContain('清爽');
    });

    it('increases thirst more than normal (-2/h)', () => {
      const attrs = { ...defaultAttributes(), '口渴度': 60 };
      const result = executeRest(attrs, '温泉', springCtx);
      expect(result.newAttributes['口渴度']).toBe(58); // 60 - 2
    });
  });

  describe('clamping', () => {
    it('clamps stamina to 100 max', () => {
      const attrs = { ...defaultAttributes(), '体力值': 90 };
      const result = executeRest(attrs, '短休', makeContext({ isRestPoint: true, shelterLevel: 1 }));
      // 90 + 30 + 10 (rest point) + 10 (shelter) = 140 → clamped to 100
      expect(result.newAttributes['体力值']).toBe(100);
    });

    it('clamps attributes to 0 minimum', () => {
      const attrs = { ...defaultAttributes(), '饱食度': 0.5, '口渴度': 0.5, '心情': 0.1 };
      const result = executeRest(attrs, '短休', makeContext());
      expect(result.newAttributes['饱食度']).toBeGreaterThanOrEqual(0);
      expect(result.newAttributes['口渴度']).toBeGreaterThanOrEqual(0);
      expect(result.newAttributes['心情']).toBeGreaterThanOrEqual(0);
    });

    it('clamps all attributes to valid range after full rest', () => {
      const result = executeRest(defaultAttributes(), '睡眠', makeContext({ shelterLevel: 2 }));
      for (const value of Object.values(result.newAttributes)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('natural decay continues during rest', () => {
    it('short rest: satiety -1, thirst -1.5, dirt +1, mood -0.5', () => {
      const attrs = defaultAttributes();
      const result = executeRest(attrs, '短休', makeContext());
      expect(result.recovery.satiety).toBe(-1);
      expect(result.recovery.thirst).toBe(-1.5);
      expect(result.recovery.dirt).toBe(1);
      expect(result.recovery.mood).toBe(-0.5);
    });

    it('long rest: all decay doubles (2h)', () => {
      const attrs = defaultAttributes();
      const result = executeRest(attrs, '长休', makeContext({ shelterLevel: 1 }));
      expect(result.recovery.satiety).toBe(-2);
      expect(result.recovery.thirst).toBe(-3);
      expect(result.recovery.dirt).toBe(2);
      expect(result.recovery.mood).toBe(-1);
    });

    it('sleep: all decay values correct', () => {
      const attrs = defaultAttributes();
      const result = executeRest(attrs, '睡眠', makeContext({ shelterLevel: 0 }));
      expect(result.recovery.satiety).toBe(-8);
      expect(result.recovery.thirst).toBe(-12);
      expect(result.recovery.dirt).toBe(8);
      expect(result.recovery.mood).toBe(-4);
    });
  });

  describe('recovery details', () => {
    it('短休 returns correct timeCost', () => {
      const result = executeRest(defaultAttributes(), '短休', makeContext());
      expect(result.timeCost).toBe(60);
    });

    it('长休 returns correct timeCost', () => {
      const result = executeRest(defaultAttributes(), '长休', makeContext({ shelterLevel: 1 }));
      expect(result.timeCost).toBe(120);
    });

    it('睡眠 returns correct timeCost', () => {
      const result = executeRest(defaultAttributes(), '睡眠', makeContext({ shelterLevel: 2 }));
      expect(result.timeCost).toBe(480);
    });

    it('温泉 returns correct timeCost', () => {
      const result = executeRest(defaultAttributes(), '温泉', makeContext({ isWarmSpring: true }));
      expect(result.timeCost).toBe(60);
    });
  });
});
