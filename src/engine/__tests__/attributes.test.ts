import { describe, it, expect } from 'vitest';
import {
  applyNaturalDecay,
  applyThresholdEffects,
  applyLinkageEffects,
  applyStatusEffects,
  applyWeatherEffects,
  clampAttributes,
  checkDeathConditions,
  createSeededRNG,
  evaluateCondition,
} from '../attributes';
import type { Attributes, ActiveStatusEffect } from '../attributes';
import type { WeatherId, StatusEffectId } from '@data/types';

// ============================================================
// Helpers
// ============================================================

/** Initial attribute values matching CardLand V1 spec defaults */
const defaultAttributes = (): Attributes => ({
  '饱食度': 60,
  '口渴度': 60,
  '体力值': 80,
  '健康值': 100,
  '精力值': 80,
  '污垢': 20,
  '心情': 70,
});

/** Clone attributes snapshot */
const clone = (a: Attributes): Attributes => ({ ...a });

// ============================================================
// createSeededRNG
// ============================================================

describe('createSeededRNG', () => {
  it('produces deterministic sequence from same seed', () => {
    const rng1 = createSeededRNG(42);
    const rng2 = createSeededRNG(42);
    const seq1 = Array.from({ length: 10 }, () => rng1());
    const seq2 = Array.from({ length: 10 }, () => rng2());
    expect(seq1).toEqual(seq2);
  });

  it('different seeds produce different sequences', () => {
    const rng1 = createSeededRNG(1);
    const rng2 = createSeededRNG(2);
    const v1 = rng1();
    const v2 = rng2();
    expect(v1).not.toEqual(v2);
  });

  it('values are in [0, 1) range', () => {
    const rng = createSeededRNG(99);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

// ============================================================
// evaluateCondition
// ============================================================

describe('evaluateCondition', () => {
  it('leq: value <= threshold is true', () => {
    expect(evaluateCondition(30, 'leq', 30)).toBe(true);
    expect(evaluateCondition(29, 'leq', 30)).toBe(true);
    expect(evaluateCondition(31, 'leq', 30)).toBe(false);
  });

  it('geq: value >= threshold is true', () => {
    expect(evaluateCondition(80, 'geq', 80)).toBe(true);
    expect(evaluateCondition(81, 'geq', 80)).toBe(true);
    expect(evaluateCondition(79, 'geq', 80)).toBe(false);
  });

  it('lt: value < threshold is true (strict)', () => {
    expect(evaluateCondition(29, 'lt', 30)).toBe(true);
    expect(evaluateCondition(30, 'lt', 30)).toBe(false);
    expect(evaluateCondition(31, 'lt', 30)).toBe(false);
  });

  it('gt: value > threshold is true (strict)', () => {
    expect(evaluateCondition(81, 'gt', 80)).toBe(true);
    expect(evaluateCondition(80, 'gt', 80)).toBe(false);
    expect(evaluateCondition(79, 'gt', 80)).toBe(false);
  });

  it('eq: value === threshold is true', () => {
    expect(evaluateCondition(50, 'eq', 50)).toBe(true);
    expect(evaluateCondition(51, 'eq', 50)).toBe(false);
  });

  it('unknown operator returns false', () => {
    expect(evaluateCondition(50, 'unknown', 50)).toBe(false);
  });
});

// ============================================================
// applyNaturalDecay
// ============================================================

describe('applyNaturalDecay', () => {
  it('does not mutate input', () => {
    const input = defaultAttributes();
    const snap = clone(input);
    applyNaturalDecay(input);
    expect(input).toEqual(snap);
  });

  it('applies correct decay to 饱食度 (-3)', () => {
    const result = applyNaturalDecay(defaultAttributes());
    expect(result['饱食度']).toBe(57);
  });

  it('applies correct decay to 口渴度 (-5)', () => {
    const result = applyNaturalDecay(defaultAttributes());
    expect(result['口渴度']).toBe(55);
  });

  it('体力值 has no natural decay (0)', () => {
    const result = applyNaturalDecay(defaultAttributes());
    expect(result['体力值']).toBe(80);
  });

  it('健康值 has no natural decay (0)', () => {
    const result = applyNaturalDecay(defaultAttributes());
    expect(result['健康值']).toBe(100);
  });

  it('applies correct decay to 精力值 (-2)', () => {
    const result = applyNaturalDecay(defaultAttributes());
    expect(result['精力值']).toBe(78);
  });

  it('污垢 increases (+3, negative-when-high)', () => {
    const result = applyNaturalDecay(defaultAttributes());
    expect(result['污垢']).toBe(23);
  });

  it('applies correct decay to 心情 (-2)', () => {
    const result = applyNaturalDecay(defaultAttributes());
    expect(result['心情']).toBe(68);
  });

  it('handles edge values (0 and 100)', () => {
    const attrs: Attributes = {
      '饱食度': 0, '口渴度': 100, '体力值': 0,
      '健康值': 100, '精力值': 0, '污垢': 100, '心情': 0,
    };
    const result = applyNaturalDecay(attrs);
    expect(result['饱食度']).toBe(-3);
    expect(result['口渴度']).toBe(95);
    expect(result['污垢']).toBe(103);
    expect(result['心情']).toBe(-2);
    expect(result['精力值']).toBe(-2);
  });
});

// ============================================================
// applyThresholdEffects
// ============================================================

describe('applyThresholdEffects', () => {
  const testThreshold = (
    attrId: keyof Attributes,
    value: number,
    expectedEffectId: string,
  ) => {
    const attrs = { ...defaultAttributes(), [attrId]: value };
    const result = applyThresholdEffects(attrs);
    expect(result[attrId]?.effectId).toBe(expectedEffectId);
  };

  // ── 饱食度 ──
  describe('饱食度 thresholds', () => {
    it('0-30 → 饱食度_极低', () => {
      testThreshold('饱食度', 0, '饱食度_极低');
      testThreshold('饱食度', 15, '饱食度_极低');
      testThreshold('饱食度', 30, '饱食度_极低');
    });
    it('31-60 → 饱食度_低', () => {
      testThreshold('饱食度', 31, '饱食度_低');
      testThreshold('饱食度', 45, '饱食度_低');
      testThreshold('饱食度', 60, '饱食度_低');
    });
    it('61-80 → 饱食度_正常', () => {
      testThreshold('饱食度', 61, '饱食度_正常');
      testThreshold('饱食度', 70, '饱食度_正常');
      testThreshold('饱食度', 80, '饱食度_正常');
    });
    it('81-100 → 饱食度_饱足', () => {
      testThreshold('饱食度', 81, '饱食度_饱足');
      testThreshold('饱食度', 90, '饱食度_饱足');
      testThreshold('饱食度', 100, '饱食度_饱足');
    });
  });

  // ── 口渴度 ──
  describe('口渴度 thresholds', () => {
    it('0-30 → 口渴度_极低', () => {
      testThreshold('口渴度', 0, '口渴度_极低');
      testThreshold('口渴度', 30, '口渴度_极低');
    });
    it('31-60 → 口渴度_低', () => {
      testThreshold('口渴度', 31, '口渴度_低');
      testThreshold('口渴度', 60, '口渴度_低');
    });
    it('61-80 → 口渴度_正常', () => {
      testThreshold('口渴度', 61, '口渴度_正常');
      testThreshold('口渴度', 80, '口渴度_正常');
    });
    it('81-100 → 口渴度_充足', () => {
      testThreshold('口渴度', 81, '口渴度_充足');
      testThreshold('口渴度', 100, '口渴度_充足');
    });
  });

  // ── 体力值 ──
  describe('体力值 thresholds', () => {
    it('0-20 → 体力值_极低', () => {
      testThreshold('体力值', 0, '体力值_极低');
      testThreshold('体力值', 20, '体力值_极低');
    });
    it('21-50 → 体力值_低', () => {
      testThreshold('体力值', 21, '体力值_低');
      testThreshold('体力值', 50, '体力值_低');
    });
    it('51-80 → 体力值_正常', () => {
      testThreshold('体力值', 51, '体力值_正常');
      testThreshold('体力值', 80, '体力值_正常');
    });
    it('81-100 → 体力值_充沛', () => {
      testThreshold('体力值', 81, '体力值_充沛');
      testThreshold('体力值', 100, '体力值_充沛');
    });
  });

  // ── 健康值 ──
  describe('健康值 thresholds', () => {
    it('0-30 → 健康值_濒死', () => {
      testThreshold('健康值', 0, '健康值_濒死');
      testThreshold('健康值', 30, '健康值_濒死');
    });
    it('31-60 → 健康值_受伤', () => {
      testThreshold('健康值', 31, '健康值_受伤');
      testThreshold('健康值', 60, '健康值_受伤');
    });
    it('61-80 → 健康值_正常', () => {
      testThreshold('健康值', 61, '健康值_正常');
      testThreshold('健康值', 80, '健康值_正常');
    });
    it('81-100 → 健康值_强壮', () => {
      testThreshold('健康值', 81, '健康值_强壮');
      testThreshold('健康值', 100, '健康值_强壮');
    });
  });

  // ── 精力值 ──
  describe('精力值 thresholds', () => {
    it('0-30 → 精力值_枯竭', () => {
      testThreshold('精力值', 0, '精力值_枯竭');
      testThreshold('精力值', 30, '精力值_枯竭');
    });
    it('31-50 → 精力值_不足', () => {
      testThreshold('精力值', 31, '精力值_不足');
      testThreshold('精力值', 50, '精力值_不足');
    });
    it('51-80 → 精力值_正常', () => {
      testThreshold('精力值', 51, '精力值_正常');
      testThreshold('精力值', 80, '精力值_正常');
    });
    it('81-100 → 精力值_专注', () => {
      testThreshold('精力值', 81, '精力值_专注');
      testThreshold('精力值', 100, '精力值_专注');
    });
  });

  // ── 污垢 ──
  describe('污垢 thresholds', () => {
    it('0-20 → 污垢_清爽', () => {
      testThreshold('污垢', 0, '污垢_清爽');
      testThreshold('污垢', 20, '污垢_清爽');
    });
    it('21-50 → 污垢_正常', () => {
      testThreshold('污垢', 21, '污垢_正常');
      testThreshold('污垢', 50, '污垢_正常');
    });
    it('51-80 → 污垢_肮脏', () => {
      testThreshold('污垢', 51, '污垢_肮脏');
      testThreshold('污垢', 80, '污垢_肮脏');
    });
    it('81-100 → 污垢_极脏', () => {
      testThreshold('污垢', 81, '污垢_极脏');
      testThreshold('污垢', 100, '污垢_极脏');
    });
  });

  // ── 心情 ──
  describe('心情 thresholds', () => {
    it('0-30 → 心情_沮丧', () => {
      testThreshold('心情', 0, '心情_沮丧');
      testThreshold('心情', 30, '心情_沮丧');
    });
    it('31-50 → 心情_低落', () => {
      testThreshold('心情', 31, '心情_低落');
      testThreshold('心情', 50, '心情_低落');
    });
    it('51-80 → 心情_正常', () => {
      testThreshold('心情', 51, '心情_正常');
      testThreshold('心情', 80, '心情_正常');
    });
    it('81-100 → 心情_愉悦', () => {
      testThreshold('心情', 81, '心情_愉悦');
      testThreshold('心情', 100, '心情_愉悦');
    });
  });

  it('returns correct efficiencyModifier for 饱食度_极低 (0.5)', () => {
    const attrs = { ...defaultAttributes(), '饱食度': 10 };
    const result = applyThresholdEffects(attrs);
    expect(result['饱食度'].efficiencyModifier).toBe(0.5);
  });

  it('returns correct recoveryModifier for 饱食度_饱足 (2)', () => {
    const attrs = { ...defaultAttributes(), '饱食度': 90 };
    const result = applyThresholdEffects(attrs);
    expect(result['饱食度'].recoveryModifier).toBe(2);
  });

  it('returns correct descriptions', () => {
    const attrs = { ...defaultAttributes(), '体力值': 5 };
    const result = applyThresholdEffects(attrs);
    expect(result['体力值'].description).toContain('无法战斗');
  });
});

// ============================================================
// applyLinkageEffects
// ============================================================

describe('applyLinkageEffects', () => {
  it('does not mutate input', () => {
    const input = defaultAttributes();
    const snap = clone(input);
    applyLinkageEffects(input);
    expect(input).toEqual(snap);
  });

  it('no linkages active at default attributes', () => {
    const result = applyLinkageEffects(defaultAttributes());
    expect(result.activeLinkages).toHaveLength(0);
    expect(Object.keys(result.directChanges)).toHaveLength(0);
  });

  // ── 饱食度 ≤ 30 ──
  describe('饱食度 ≤ 30 linkages', () => {
    it('activates 体力值 recovery -50%', () => {
      const attrs = { ...defaultAttributes(), '饱食度': 30 };
      const result = applyLinkageEffects(attrs);
      const link = result.activeLinkages.find(
        l => l.triggerAttribute === '饱食度' && l.affectedAttribute === '体力值' && l.modifierType === 'recovery'
      );
      expect(link).toBeDefined();
      expect(link!.modifier).toBe(-0.5);
    });

    it('直接修改精力值 (-3/turn, rate type)', () => {
      const attrs = { ...defaultAttributes(), '饱食度': 30 };
      const result = applyLinkageEffects(attrs);
      expect(result.directChanges['精力值']).toBe(-3);
    });

    it('直接修改心情 (-3/turn, rate type)', () => {
      const attrs = { ...defaultAttributes(), '饱食度': 30 };
      const result = applyLinkageEffects(attrs);
      expect(result.directChanges['心情']).toBe(-3);
    });

    it('饱食度 = 29 activates (≤ 30)', () => {
      const attrs = { ...defaultAttributes(), '饱食度': 29 };
      const result = applyLinkageEffects(attrs);
      const linkageCount = result.activeLinkages.filter(l => l.triggerAttribute === '饱食度').length;
      expect(linkageCount).toBe(3);
    });

    it('饱食度 = 31 does NOT activate', () => {
      const attrs = { ...defaultAttributes(), '饱食度': 31 };
      const result = applyLinkageEffects(attrs);
      const linkageCount = result.activeLinkages.filter(l => l.triggerAttribute === '饱食度').length;
      expect(linkageCount).toBe(0);
    });
  });

  // ── 口渴度 ≤ 30 ──
  describe('口渴度 ≤ 30 linkages', () => {
    it('activates 体力值 consumption +30%', () => {
      const attrs = { ...defaultAttributes(), '口渴度': 30 };
      const result = applyLinkageEffects(attrs);
      const link = result.activeLinkages.find(
        l => l.triggerAttribute === '口渴度' && l.affectedAttribute === '体力值' && l.modifierType === 'consumption'
      );
      expect(link).toBeDefined();
      expect(link!.modifier).toBe(0.3);
    });

    it('activates 健康值 recovery -50%', () => {
      const attrs = { ...defaultAttributes(), '口渴度': 30 };
      const result = applyLinkageEffects(attrs);
      const link = result.activeLinkages.find(
        l => l.triggerAttribute === '口渴度' && l.affectedAttribute === '健康值' && l.modifierType === 'recovery'
      );
      expect(link).toBeDefined();
      expect(link!.modifier).toBe(-0.5);
    });
  });

  // ── 体力值 ≤ 30 ──
  describe('体力值 ≤ 30 linkages', () => {
    it('activates 精力值 consumption +30%', () => {
      const attrs = { ...defaultAttributes(), '体力值': 30 };
      const result = applyLinkageEffects(attrs);
      const link = result.activeLinkages.find(
        l => l.triggerAttribute === '体力值' && l.affectedAttribute === '精力值' && l.modifierType === 'consumption'
      );
      expect(link).toBeDefined();
      expect(link!.modifier).toBe(0.3);
    });

    it('直接修改心情 (-2/turn, rate type)', () => {
      const attrs = { ...defaultAttributes(), '体力值': 30 };
      const result = applyLinkageEffects(attrs);
      expect(result.directChanges['心情']).toBe(-2);
    });
  });

  // ── 健康值 ≤ 40 ──
  describe('健康值 ≤ 40 linkages', () => {
    it('activates 体力值 consumption modifier', () => {
      const attrs = { ...defaultAttributes(), '健康值': 40 };
      const result = applyLinkageEffects(attrs);
      const link = result.activeLinkages.find(
        l => l.triggerAttribute === '健康值' && l.affectedAttribute === '体力值' && l.modifierType === 'consumption'
      );
      expect(link).toBeDefined();
      expect(link!.modifier).toBe(-20);
    });

    it('直接修改心情 (-3/turn, rate type)', () => {
      const attrs = { ...defaultAttributes(), '健康值': 40 };
      const result = applyLinkageEffects(attrs);
      expect(result.directChanges['心情']).toBe(-3);
    });

    it('健康值 = 41 does NOT activate', () => {
      const attrs = { ...defaultAttributes(), '健康值': 41 };
      const result = applyLinkageEffects(attrs);
      const count = result.activeLinkages.filter(l => l.triggerAttribute === '健康值').length;
      expect(count).toBe(0);
    });
  });

  // ── 精力值 ≤ 50 ──
  describe('精力值 ≤ 50 linkages', () => {
    it('activates 体力值 efficiency -15%', () => {
      const attrs = { ...defaultAttributes(), '精力值': 50 };
      const result = applyLinkageEffects(attrs);
      const link = result.activeLinkages.find(
        l => l.triggerAttribute === '精力值' && l.affectedAttribute === '体力值' && l.modifierType === 'efficiency'
      );
      expect(link).toBeDefined();
      expect(link!.modifier).toBe(-0.15);
    });
  });

  // ── 精力值 > 80 ──
  describe('精力值 > 80 linkages', () => {
    it('activates 精力值 consumption -20% (buff)', () => {
      const attrs = { ...defaultAttributes(), '精力值': 81 };
      const result = applyLinkageEffects(attrs);
      const link = result.activeLinkages.find(
        l => l.triggerAttribute === '精力值' && l.triggerCondition === 'gt' && l.affectedAttribute === '精力值'
      );
      expect(link).toBeDefined();
      expect(link!.modifier).toBe(-0.2);
    });

    it('精力值 = 80 does NOT activate (strict gt)', () => {
      const attrs = { ...defaultAttributes(), '精力值': 80 };
      const result = applyLinkageEffects(attrs);
      const link = result.activeLinkages.find(
        l => l.triggerAttribute === '精力值' && l.triggerCondition === 'gt'
      );
      expect(link).toBeUndefined();
    });
  });

  // ── 污垢 > 60 ──
  describe('污垢 > 60 linkages', () => {
    it('activates 健康值 recovery -30%', () => {
      const attrs = { ...defaultAttributes(), '污垢': 61 };
      const result = applyLinkageEffects(attrs);
      const link = result.activeLinkages.find(
        l => l.triggerAttribute === '污垢' && l.affectedAttribute === '健康值'
      );
      expect(link).toBeDefined();
      expect(link!.modifier).toBe(-0.3);
    });

    it('污垢 = 60 does NOT activate', () => {
      const attrs = { ...defaultAttributes(), '污垢': 60 };
      const result = applyLinkageEffects(attrs);
      const count = result.activeLinkages.filter(l => l.triggerAttribute === '污垢').length;
      expect(count).toBe(0);
    });
  });

  // ── 污垢 > 80 ──
  describe('污垢 > 80 linkages', () => {
    it('activates 体力值 consumption +15%', () => {
      const attrs = { ...defaultAttributes(), '污垢': 81 };
      const result = applyLinkageEffects(attrs);
      const link = result.activeLinkages.find(
        l => l.triggerAttribute === '污垢' && l.affectedAttribute === '体力值'
      );
      expect(link).toBeDefined();
      expect(link!.modifier).toBe(0.15);
    });
  });

  // ── 心情 ≤ 30 ──
  describe('心情 ≤ 30 linkages', () => {
    it('activates 体力值 consumption +20%', () => {
      const attrs = { ...defaultAttributes(), '心情': 30 };
      const result = applyLinkageEffects(attrs);
      const link = result.activeLinkages.find(
        l => l.triggerAttribute === '心情' && l.triggerCondition === 'leq' && l.affectedAttribute === '体力值'
      );
      expect(link).toBeDefined();
      expect(link!.modifier).toBe(0.2);
    });
  });

  // ── 心情 > 80 ──
  describe('心情 > 80 linkages', () => {
    it('activates 体力值 recovery +3', () => {
      const attrs = { ...defaultAttributes(), '心情': 81 };
      const result = applyLinkageEffects(attrs);
      const link = result.activeLinkages.find(
        l => l.triggerAttribute === '心情' && l.triggerCondition === 'gt' && l.affectedAttribute === '体力值'
      );
      expect(link).toBeDefined();
      expect(link!.modifier).toBe(3);
    });

    it('activates 精力值 recovery +2', () => {
      const attrs = { ...defaultAttributes(), '心情': 81 };
      const result = applyLinkageEffects(attrs);
      const link = result.activeLinkages.find(
        l => l.triggerAttribute === '心情' && l.triggerCondition === 'gt' && l.affectedAttribute === '精力值'
      );
      expect(link).toBeDefined();
      expect(link!.modifier).toBe(2);
    });

    it('心情 = 80 does NOT activate', () => {
      const attrs = { ...defaultAttributes(), '心情': 80 };
      const result = applyLinkageEffects(attrs);
      const count = result.activeLinkages.filter(l => l.triggerAttribute === '心情' && l.triggerCondition === 'gt').length;
      expect(count).toBe(0);
    });
  });

  // ── 叠加场景 ──
  describe('multiple linkages stacking (direct changes)', () => {
    it('饱食度≤30 + 体力值≤30 → 心情 rate effects stack', () => {
      const attrs: Attributes = {
        ...defaultAttributes(),
        '饱食度': 30,
        '体力值': 30,
      };
      const result = applyLinkageEffects(attrs);
      // 饱食度≤30 → 心情 -3; 体力值≤30 → 心情 -2 = combined -5
      expect(result.directChanges['心情']).toBe(-5);
    });

    it('饱食度≤30 + 健康值≤40 → 心情 rate effects stack', () => {
      const attrs: Attributes = {
        ...defaultAttributes(),
        '饱食度': 30,
        '健康值': 40,
      };
      const result = applyLinkageEffects(attrs);
      // 饱食度≤30 → 心情 -3; 健康值≤40 → 心情 -3 = combined -6
      expect(result.directChanges['心情']).toBe(-6);
    });

    it('饱食度≤30 + 体力值≤30 + 健康值≤40 → full 心情 stack', () => {
      const attrs: Attributes = {
        ...defaultAttributes(),
        '饱食度': 30,
        '体力值': 30,
        '健康值': 40,
      };
      const result = applyLinkageEffects(attrs);
      expect(result.directChanges['心情']).toBe(-8);
    });
  });
});

// ============================================================
// applyStatusEffects
// ============================================================

describe('applyStatusEffects', () => {
  it('does not mutate input attributes', () => {
    const input = defaultAttributes();
    const snap = clone(input);
    applyStatusEffects(input, []);
    expect(input).toEqual(snap);
  });

  // ── 中毒 ──
  describe('中毒 (damage -10/turn, 3 turns)', () => {
    it('applies -10 health per turn', () => {
      const attrs = defaultAttributes();
      const statuses: ActiveStatusEffect[] = [{ id: '中毒', remainingDuration: 3 }];
      const result = applyStatusEffects(attrs, statuses);
      expect(result.attributes['健康值']).toBe(90);
    });

    it('decrements remaining duration', () => {
      const attrs = defaultAttributes();
      const statuses: ActiveStatusEffect[] = [{ id: '中毒', remainingDuration: 3 }];
      const result = applyStatusEffects(attrs, statuses);
      expect(result.statusEffects).toHaveLength(1);
      expect(result.statusEffects[0].remainingDuration).toBe(2);
    });

    it('expires when remaining duration reaches 0', () => {
      const attrs = defaultAttributes();
      const statuses: ActiveStatusEffect[] = [{ id: '中毒', remainingDuration: 1 }];
      const result = applyStatusEffects(attrs, statuses);
      expect(result.statusEffects).toHaveLength(0);
    });
  });

  // ── 感染 ──
  describe('感染 (damage -5/turn, 5 turns)', () => {
    it('applies -5 health per turn', () => {
      const attrs = defaultAttributes();
      const statuses: ActiveStatusEffect[] = [{ id: '感染', remainingDuration: 5 }];
      const result = applyStatusEffects(attrs, statuses);
      expect(result.attributes['健康值']).toBe(95);
    });

    it('decrements duration correctly', () => {
      const attrs = defaultAttributes();
      const statuses: ActiveStatusEffect[] = [{ id: '感染', remainingDuration: 5 }];
      const result = applyStatusEffects(attrs, statuses);
      expect(result.statusEffects[0].remainingDuration).toBe(4);
    });

    it('expires after 5 turns', () => {
      const attrs = defaultAttributes();
      const statuses: ActiveStatusEffect[] = [{ id: '感染', remainingDuration: 1 }];
      const result = applyStatusEffects(attrs, statuses);
      expect(result.statusEffects).toHaveLength(0);
    });
  });

  // ── 灼伤 ──
  describe('灼伤 (damage -8/turn, 2 turns)', () => {
    it('applies -8 health per turn', () => {
      const attrs = defaultAttributes();
      const statuses: ActiveStatusEffect[] = [{ id: '灼伤', remainingDuration: 2 }];
      const result = applyStatusEffects(attrs, statuses);
      expect(result.attributes['健康值']).toBe(92);
    });

    it('expires after 2 turns', () => {
      const attrs = defaultAttributes();
      const statuses: ActiveStatusEffect[] = [{ id: '灼伤', remainingDuration: 1 }];
      const result = applyStatusEffects(attrs, statuses);
      expect(result.statusEffects).toHaveLength(0);
    });
  });

  // ── 迷路 ──
  describe('迷路 (damage -10/turn, 1 turn)', () => {
    it('applies -10 health per turn', () => {
      const attrs = defaultAttributes();
      const statuses: ActiveStatusEffect[] = [{ id: '迷路', remainingDuration: 1 }];
      const result = applyStatusEffects(attrs, statuses);
      expect(result.attributes['健康值']).toBe(90);
    });

    it('expires after 1 turn', () => {
      const attrs = defaultAttributes();
      const statuses: ActiveStatusEffect[] = [{ id: '迷路', remainingDuration: 1 }];
      const result = applyStatusEffects(attrs, statuses);
      expect(result.statusEffects).toHaveLength(0);
    });
  });

  // ── Status Stacking ──
  describe('status stacking', () => {
    it('中毒 + 感染 = combined -15 health/turn', () => {
      const attrs = defaultAttributes();
      const statuses: ActiveStatusEffect[] = [
        { id: '中毒', remainingDuration: 3 },
        { id: '感染', remainingDuration: 5 },
      ];
      const result = applyStatusEffects(attrs, statuses);
      expect(result.attributes['健康值']).toBe(85);
    });

    it('中毒 + 感染 + 灼伤 = combined -23 health/turn', () => {
      const attrs = defaultAttributes();
      const statuses: ActiveStatusEffect[] = [
        { id: '中毒', remainingDuration: 3 },
        { id: '感染', remainingDuration: 5 },
        { id: '灼伤', remainingDuration: 2 },
      ];
      const result = applyStatusEffects(attrs, statuses);
      expect(result.attributes['健康值']).toBe(77);
    });

    it('all statuses decrement independently', () => {
      const attrs = defaultAttributes();
      const statuses: ActiveStatusEffect[] = [
        { id: '中毒', remainingDuration: 3 },
        { id: '感染', remainingDuration: 5 },
      ];
      const result = applyStatusEffects(attrs, statuses);
      expect(result.statusEffects).toHaveLength(2);
      expect(result.statusEffects.find(s => s.id === '中毒')!.remainingDuration).toBe(2);
      expect(result.statusEffects.find(s => s.id === '感染')!.remainingDuration).toBe(4);
    });

    it('expires only the one reaching 0', () => {
      const attrs = defaultAttributes();
      const statuses: ActiveStatusEffect[] = [
        { id: '迷路', remainingDuration: 1 },
        { id: '感染', remainingDuration: 5 },
      ];
      const result = applyStatusEffects(attrs, statuses);
      expect(result.statusEffects).toHaveLength(1);
      expect(result.statusEffects[0].id).toBe('感染');
    });
  });

  // ── Conditional (null duration) statuses ──
  describe('conditional statuses (null duration)', () => {
    it('疲惫 persists (does not expire by turn count)', () => {
      const attrs = defaultAttributes();
      const statuses: ActiveStatusEffect[] = [{ id: '疲惫', remainingDuration: null }];
      const result = applyStatusEffects(attrs, statuses);
      expect(result.statusEffects).toHaveLength(1);
      expect(result.statusEffects[0].id).toBe('疲惫');
      expect(result.statusEffects[0].remainingDuration).toBeNull();
    });

    it('沮丧 does not expire by turn count', () => {
      const attrs = defaultAttributes();
      const statuses: ActiveStatusEffect[] = [{ id: '沮丧', remainingDuration: null }];
      const result = applyStatusEffects(attrs, statuses);
      expect(result.statusEffects).toHaveLength(1);
    });

    it('防护 has no damage per turn', () => {
      const attrs = defaultAttributes();
      const statuses: ActiveStatusEffect[] = [{ id: '防护', remainingDuration: null }];
      const result = applyStatusEffects(attrs, statuses);
      expect(result.attributes['健康值']).toBe(100); // unchanged
    });

    it('饱腹 has no damage per turn', () => {
      const attrs = defaultAttributes();
      const statuses: ActiveStatusEffect[] = [{ id: '饱腹', remainingDuration: null }];
      const result = applyStatusEffects(attrs, statuses);
      expect(result.attributes['健康值']).toBe(100);
    });

    it('精神饱满 has no damage (positive status, 0 damage)', () => {
      const attrs = defaultAttributes();
      const statuses: ActiveStatusEffect[] = [{ id: '精神饱满', remainingDuration: 1 }];
      const result = applyStatusEffects(attrs, statuses);
      expect(result.attributes['健康值']).toBe(100);
      // It expires after its numeric duration
      expect(result.statusEffects).toHaveLength(0);
    });
  });
});

// ============================================================
// applyWeatherEffects
// ============================================================

describe('applyWeatherEffects', () => {
  it('does not mutate input', () => {
    const input = defaultAttributes();
    const snap = clone(input);
    applyWeatherEffects(input, '晴');
    expect(input).toEqual(snap);
  });

  it('晴 → 口渴度 -3 (increased thirst)', () => {
    const result = applyWeatherEffects(defaultAttributes(), '晴');
    expect(result['口渴度']).toBe(57);
  });

  it('阴 → 心情 -1', () => {
    const result = applyWeatherEffects(defaultAttributes(), '阴');
    expect(result['心情']).toBe(69);
  });

  it('雨 → 饱食度 -1, 污垢 -5', () => {
    const result = applyWeatherEffects(defaultAttributes(), '雨');
    expect(result['饱食度']).toBe(59);
    expect(result['污垢']).toBe(15);
  });

  it('暴雨 → 体力值 -10, 心情 -3', () => {
    const result = applyWeatherEffects(defaultAttributes(), '暴雨');
    expect(result['体力值']).toBe(70);
    expect(result['心情']).toBe(67);
  });

  it('weather effects do not affect non-targeted attributes', () => {
    const result = applyWeatherEffects(defaultAttributes(), '晴');
    expect(result['健康值']).toBe(100);
    expect(result['体力值']).toBe(80);
    expect(result['精力值']).toBe(80);
    expect(result['饱食度']).toBe(60);
  });

  it('unknown weather ID returns unchanged attributes', () => {
    const result = applyWeatherEffects(defaultAttributes(), '大雾' as WeatherId);
    expect(result).toEqual(defaultAttributes());
  });
});

// ============================================================
// clampAttributes
// ============================================================

describe('clampAttributes', () => {
  it('does not mutate input', () => {
    const input: Attributes = { '饱食度': -10, '口渴度': 60, '体力值': 80, '健康值': 100, '精力值': 80, '污垢': 20, '心情': 70 };
    const snap = clone(input);
    clampAttributes(input);
    expect(input).toEqual(snap);
  });

  it('clamps below-minimum values to 0', () => {
    const attrs: Attributes = {
      '饱食度': -10, '口渴度': -5, '体力值': -3,
      '健康值': -1, '精力值': -20, '污垢': -2, '心情': -15,
    };
    const result = clampAttributes(attrs);
    for (const key of Object.keys(result) as (keyof Attributes)[]) {
      expect(result[key]).toBeGreaterThanOrEqual(0);
    }
    expect(result['饱食度']).toBe(0);
    expect(result['精力值']).toBe(0);
    expect(result['心情']).toBe(0);
  });

  it('clamps above-maximum values to 100', () => {
    const attrs: Attributes = {
      '饱食度': 120, '口渴度': 110, '体力值': 150,
      '健康值': 200, '精力值': 130, '污垢': 120, '心情': 140,
    };
    const result = clampAttributes(attrs);
    for (const key of Object.keys(result) as (keyof Attributes)[]) {
      expect(result[key]).toBeLessThanOrEqual(100);
    }
    expect(result['健康值']).toBe(100);
    expect(result['污垢']).toBe(100);
  });

  it('values in range are unchanged', () => {
    const attrs = defaultAttributes();
    const result = clampAttributes(attrs);
    expect(result).toEqual(attrs);
  });

  it('exactly at boundaries (0 and 100)', () => {
    const attrs: Attributes = {
      '饱食度': 0, '口渴度': 100, '体力值': 0,
      '健康值': 100, '精力值': 0, '污垢': 100, '心情': 50,
    };
    const result = clampAttributes(attrs);
    expect(result['饱食度']).toBe(0);
    expect(result['口渴度']).toBe(100);
    expect(result['体力值']).toBe(0);
    expect(result['健康值']).toBe(100);
    expect(result['精力值']).toBe(0);
    expect(result['污垢']).toBe(100);
    expect(result['心情']).toBe(50);
  });
});

// ============================================================
// checkDeathConditions
// ============================================================

describe('checkDeathConditions', () => {
  it('health = 100 → not dead', () => {
    const attrs = defaultAttributes();
    const result = checkDeathConditions(attrs);
    expect(result.isDead).toBe(false);
    expect(result.reason).toBeNull();
  });

  it('health = 1 → not dead', () => {
    const attrs = { ...defaultAttributes(), '健康值': 1 };
    const result = checkDeathConditions(attrs);
    expect(result.isDead).toBe(false);
  });

  it('health = 0 → dead', () => {
    const attrs = { ...defaultAttributes(), '健康值': 0 };
    const result = checkDeathConditions(attrs);
    expect(result.isDead).toBe(true);
    expect(result.reason).toBe('健康值归零');
  });

  it('health < 0 → dead', () => {
    const attrs = { ...defaultAttributes(), '健康值': -10 };
    const result = checkDeathConditions(attrs);
    expect(result.isDead).toBe(true);
    expect(result.reason).toBe('健康值归零');
  });

  it('other attributes at 0 do NOT trigger death', () => {
    const attrs: Attributes = {
      '饱食度': 0, '口渴度': 0, '体力值': 0,
      '健康值': 50, '精力值': 0, '污垢': 100, '心情': 0,
    };
    const result = checkDeathConditions(attrs);
    expect(result.isDead).toBe(false);
  });
});

// ============================================================
// Full pipeline simulation (sanity check)
// ============================================================

describe('full pipeline simulation', () => {
  it('single turn with no active statuses or weather', () => {
    let attrs = defaultAttributes();
    attrs = applyNaturalDecay(attrs);
    attrs = clampAttributes(attrs);
    expect(attrs['饱食度']).toBe(57);
    expect(attrs['口渴度']).toBe(55);
    expect(attrs['污垢']).toBe(23);
  });

  it('single turn with decay + status effects + clamp', () => {
    let attrs = defaultAttributes();
    const statuses: ActiveStatusEffect[] = [{ id: '中毒', remainingDuration: 3 }];
    attrs = applyNaturalDecay(attrs);
    const statusResult = applyStatusEffects(attrs, statuses);
    attrs = statusResult.attributes;
    attrs = clampAttributes(attrs);
    expect(attrs['健康值']).toBe(90);
  });

  it('single turn with decay + weather + clamp', () => {
    let attrs = defaultAttributes();
    attrs = applyNaturalDecay(attrs);
    attrs = applyWeatherEffects(attrs, '晴');
    attrs = clampAttributes(attrs);
    expect(attrs['口渴度']).toBe(52); // 60 - 5 (decay) - 3 (sunny)
  });

  it('worst case: decay + 中毒+感染 + 暴雨 → still clamp to valid range', () => {
    let attrs = defaultAttributes();
    const statuses: ActiveStatusEffect[] = [
      { id: '中毒', remainingDuration: 3 },
      { id: '感染', remainingDuration: 5 },
    ];
    attrs = applyNaturalDecay(attrs);
    attrs = applyWeatherEffects(attrs, '暴雨');
    const statusResult = applyStatusEffects(attrs, statuses);
    attrs = statusResult.attributes;
    attrs = clampAttributes(attrs);
    // All should be in [0, 100]
    for (const key of Object.keys(attrs) as (keyof Attributes)[]) {
      expect(attrs[key]).toBeGreaterThanOrEqual(0);
      expect(attrs[key]).toBeLessThanOrEqual(100);
    }
    // 健康值: 100 - 10 (中毒) - 5 (感染) = 85
    expect(attrs['健康值']).toBe(85);
  });
});

// ============================================================
// Edge cases: partial attributes (coverage for ?? fallbacks)
// ============================================================

describe('edge cases — partial/missing attributes', () => {
  /** An object missing some attribute keys (simulates corrupt data) */
  const sparseAttrs = (): Attributes => ({ '饱食度': 50, '健康值': 60 } as Attributes);

  it('applyNaturalDecay uses initialValue fallback for missing attributes', () => {
    const result = applyNaturalDecay(sparseAttrs());
    // Existing keys get decay applied
    expect(result['饱食度']).toBe(47); // 50 - 3
    expect(result['健康值']).toBe(60); // no decay
    // Missing keys fall back to ATTRIBUTES initialValue + decay
    expect(result['口渴度']).toBe(55); // 60 - 5
    expect(result['体力值']).toBe(80);
    expect(result['精力值']).toBe(78);
    expect(result['污垢']).toBe(23); // 20 + 3
    expect(result['心情']).toBe(68);
  });

  it('applyThresholdEffects uses initialValue fallback for missing attributes', () => {
    const result = applyThresholdEffects(sparseAttrs());
    expect(result['饱食度'].effectId).toBe('饱食度_低');
    expect(result['健康值'].effectId).toBe('健康值_受伤');
    // Missing attributes fall back to initial values
    expect(result['口渴度'].effectId).toBe('口渴度_低'); // initial=60
    expect(result['体力值'].effectId).toBe('体力值_正常'); // initial=80
    expect(result['精力值'].effectId).toBe('精力值_正常'); // initial=80
  });

  it('applyLinkageEffects uses 0 fallback for missing trigger attributes', () => {
    const result = applyLinkageEffects(sparseAttrs());
    // 饱食度=50 → no linkages. 健康值=60 → no linkages.
    // Missing attributes like 口渴度 fall back to 0, which triggers 口渴度≤30 linkages
    const thirstLinks = result.activeLinkages.filter(l => l.triggerAttribute === '口渴度');
    expect(thirstLinks.length).toBeGreaterThan(0);
  });

  it('checkDeathConditions uses 0 fallback for missing 健康值', () => {
    // 健康值 missing → defaults to 0 → dead
    const attrs = { '饱食度': 50 } as Attributes;
    const result = checkDeathConditions(attrs);
    expect(result.isDead).toBe(true);
    expect(result.reason).toBe('健康值归零');
  });

  it('clampAttributes uses initialValue fallback for missing keys', () => {
    const result = clampAttributes(sparseAttrs());
    expect(result['饱食度']).toBe(50);
    expect(result['健康值']).toBe(60);
    expect(result['口渴度']).toBe(60); // initialValue
    expect(result['体力值']).toBe(80);
  });
});

describe('edge cases — unknown status IDs', () => {
  it('unknown status ID is silently skipped (no crash)', () => {
    const attrs = defaultAttributes();
    const statuses: ActiveStatusEffect[] = [
      { id: '不存在的状态' as StatusEffectId, remainingDuration: 5 },
      { id: '中毒', remainingDuration: 3 },
    ];
    const result = applyStatusEffects(attrs, statuses);
    // Only 中毒 should apply
    expect(result.attributes['健康值']).toBe(90); // 100 - 10 = 90
    expect(result.statusEffects).toHaveLength(1);
    expect(result.statusEffects[0].id).toBe('中毒');
  });

  it('all unknown status IDs produce empty result', () => {
    const attrs = defaultAttributes();
    const statuses: ActiveStatusEffect[] = [
      { id: 'unknown' as StatusEffectId, remainingDuration: 5 },
    ];
    const result = applyStatusEffects(attrs, statuses);
    expect(result.attributes['健康值']).toBe(100);
    expect(result.statusEffects).toHaveLength(0);
  });
});

describe('edge cases — remainingDuration null in numeric-duration status', () => {
  it('null remainingDuration treated as def.duration for decrement', () => {
    const attrs = defaultAttributes();
    // 感染 has def.duration = 5. Pass remainingDuration: null.
    const statuses: ActiveStatusEffect[] = [{ id: '感染', remainingDuration: null }];
    const result = applyStatusEffects(attrs, statuses);
    // Should use def.duration (5) as starting point, decrement to 4
    expect(result.attributes['健康值']).toBe(95);
    expect(result.statusEffects).toHaveLength(1);
    expect(result.statusEffects[0].remainingDuration).toBe(4);
  });
});

describe('edge cases — empty status list', () => {
  it('empty status list returns unchanged attributes and no statuses', () => {
    const attrs = defaultAttributes();
    const result = applyStatusEffects(attrs, []);
    expect(result.attributes).toEqual(attrs);
    expect(result.statusEffects).toHaveLength(0);
  });
});

describe('edge cases — sparse attributes through status effects', () => {
  it('missing 健康值 uses 0 fallback in applyStatusEffects', () => {
    const attrs = { '饱食度': 50 } as Attributes;
    const statuses: ActiveStatusEffect[] = [{ id: '中毒', remainingDuration: 3 }];
    const result = applyStatusEffects(attrs, statuses);
    expect(result.attributes['健康值']).toBe(-10); // 0 (fallback) - 10
  });
});

describe('edge cases — sparse attributes through weather effects', () => {
  it('missing attribute uses 0 fallback in applyWeatherEffects', () => {
    const attrs = { '饱食度': 50 } as Attributes;
    const result = applyWeatherEffects(attrs, '晴');
    // 晴 affects 口渴度, which is missing → falls back to 0
    expect(result['口渴度']).toBe(-3); // 0 (fallback) - 3
    expect(result['饱食度']).toBe(50);
  });
});
