import { describe, it, expect } from 'vitest';
import {
  decayAttribute,
  evaluateCondition,
  applyThresholdEffects,
  applyLinkageEffects,
  clampAttributes,
  processNaturalDecay,
  checkDeathConditions,
  applyNaturalDecay,
  applyStatusEffects,
  applyWeatherEffects,
  createSeededRNG,
  DEFAULT_ATTRIBUTES,
  ALL_LINKAGES,
} from '../attributes';
import type { Attributes, ActiveStatusEffect } from '../attributes';
import type { WeatherId, StatusEffectId } from '@data/types';

// ============================================================
// Helpers
// ============================================================

const defaultAttributes = (): Attributes => ({ ...DEFAULT_ATTRIBUTES });

const clone = (a: Attributes): Attributes => ({ ...a });

// ============================================================
// decayAttribute
// ============================================================

describe('decayAttribute', () => {
  it('-1/h for 30min = -0.5', () => {
    expect(decayAttribute(60, -1, 30)).toBe(59.5);
  });

  it('-1/h for 60min = -1', () => {
    expect(decayAttribute(60, -1, 60)).toBe(59);
  });

  it('-1.5/h for 30min = -0.75', () => {
    expect(decayAttribute(60, -1.5, 30)).toBe(59.25);
  });

  it('+1/h for 60min = +1', () => {
    expect(decayAttribute(20, 1, 60)).toBe(21);
  });

  it('0 rate produces no change', () => {
    expect(decayAttribute(50, 0, 120)).toBe(50);
  });

  it('fractional minutes work correctly', () => {
    expect(decayAttribute(100, -6, 10)).toBe(99);
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

  it('gt: value > threshold is strict', () => {
    expect(evaluateCondition(81, 'gt', 80)).toBe(true);
    expect(evaluateCondition(80, 'gt', 80)).toBe(false);
  });

  it('lt: value < threshold is strict', () => {
    expect(evaluateCondition(29, 'lt', 30)).toBe(true);
    expect(evaluateCondition(30, 'lt', 30)).toBe(false);
  });

  it('eq: exact match', () => {
    expect(evaluateCondition(50, 'eq', 50)).toBe(true);
    expect(evaluateCondition(51, 'eq', 50)).toBe(false);
  });

  it('unknown operator returns false', () => {
    expect(evaluateCondition(50, 'unknown', 50)).toBe(false);
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

  describe('饱食度 thresholds', () => {
    it('0-30 triggers 0-30 range effects', () => {
      testThreshold('饱食度', 0, '饱食度_极低');
      testThreshold('饱食度', 15, '饱食度_极低');
      testThreshold('饱食度', 30, '饱食度_极低');
    });

    it('31 does NOT trigger 0-30 range', () => {
      testThreshold('饱食度', 31, '饱食度_低');
    });

    it('31-60 → 饱食度_低', () => {
      testThreshold('饱食度', 31, '饱食度_低');
      testThreshold('饱食度', 60, '饱食度_低');
    });

    it('61-80 → 饱食度_正常', () => {
      testThreshold('饱食度', 61, '饱食度_正常');
      testThreshold('饱食度', 80, '饱食度_正常');
    });

    it('81-100 → 饱食度_饱足', () => {
      testThreshold('饱食度', 81, '饱食度_饱足');
      testThreshold('饱食度', 100, '饱食度_饱足');
    });
  });

  describe('口渴度 thresholds', () => {
    it('0-30 → 口渴度_极低', () => {
      testThreshold('口渴度', 0, '口渴度_极低');
      testThreshold('口渴度', 30, '口渴度_极低');
    });

    it('31 → 口渴度_低 (not 极低)', () => {
      testThreshold('口渴度', 31, '口渴度_低');
    });

    it('61-80 → 口渴度_正常', () => {
      testThreshold('口渴度', 61, '口渴度_正常');
    });

    it('81-100 → 口渴度_充足', () => {
      testThreshold('口渴度', 81, '口渴度_充足');
    });
  });

  describe('体力值 thresholds', () => {
    it('0-20 → 体力值_极低', () => {
      testThreshold('体力值', 0, '体力值_极低');
      testThreshold('体力值', 20, '体力值_极低');
    });

    it('21-50 → 体力值_低', () => {
      testThreshold('体力值', 21, '体力值_低');
    });

    it('51-80 → 体力值_正常', () => {
      testThreshold('体力值', 51, '体力值_正常');
    });

    it('81-100 → 体力值_充沛', () => {
      testThreshold('体力值', 81, '体力值_充沛');
    });
  });

  describe('健康值 thresholds', () => {
    it('0-30 → 健康值_濒死', () => {
      testThreshold('健康值', 0, '健康值_濒死');
      testThreshold('健康值', 30, '健康值_濒死');
    });

    it('31-60 → 健康值_受伤', () => {
      testThreshold('健康值', 31, '健康值_受伤');
    });

    it('61-80 → 健康值_正常', () => {
      testThreshold('健康值', 61, '健康值_正常');
    });

    it('81-100 → 健康值_强壮', () => {
      testThreshold('健康值', 81, '健康值_强壮');
      testThreshold('健康值', 100, '健康值_强壮');
    });
  });

  describe('精力值 thresholds', () => {
    it('0-30 → 精力值_枯竭', () => {
      testThreshold('精力值', 0, '精力值_枯竭');
      testThreshold('精力值', 30, '精力值_枯竭');
    });

    it('31-50 → 精力值_不足', () => {
      testThreshold('精力值', 31, '精力值_不足');
    });

    it('51-80 → 精力值_正常', () => {
      testThreshold('精力值', 51, '精力值_正常');
    });

    it('81-100 → 精力值_专注', () => {
      testThreshold('精力值', 81, '精力值_专注');
    });
  });

  describe('污垢 thresholds', () => {
    it('0-20 → 污垢_清爽', () => {
      testThreshold('污垢', 0, '污垢_清爽');
      testThreshold('污垢', 20, '污垢_清爽');
    });

    it('21-50 → 污垢_正常', () => {
      testThreshold('污垢', 21, '污垢_正常');
    });

    it('51-80 → 污垢_肮脏', () => {
      testThreshold('污垢', 51, '污垢_肮脏');
    });

    it('81-100 → 污垢_极脏', () => {
      testThreshold('污垢', 81, '污垢_极脏');
    });
  });

  describe('心情 thresholds', () => {
    it('0-30 → 心情_沮丧', () => {
      testThreshold('心情', 0, '心情_沮丧');
      testThreshold('心情', 30, '心情_沮丧');
    });

    it('31-50 → 心情_低落', () => {
      testThreshold('心情', 31, '心情_低落');
    });

    it('51-80 → 心情_正常', () => {
      testThreshold('心情', 51, '心情_正常');
    });

    it('81-100 → 心情_愉悦', () => {
      testThreshold('心情', 81, '心情_愉悦');
    });
  });

  describe('负重 thresholds', () => {
    it('0-50 → 负重_轻装', () => {
      testThreshold('负重', 0, '负重_轻装');
      testThreshold('负重', 50, '负重_轻装');
    });

    it('51-80 → 负重_负重', () => {
      testThreshold('负重', 51, '负重_负重');
      testThreshold('负重', 80, '负重_负重');
    });

    it('81-100 → 负重_超载', () => {
      testThreshold('负重', 81, '负重_超载');
      testThreshold('负重', 100, '负重_超载');
    });
  });

  describe('体温 thresholds', () => {
    it('0-20 → 体温_失温', () => {
      testThreshold('体温', 0, '体温_失温');
      testThreshold('体温', 20, '体温_失温');
    });

    it('21-40 → 体温_寒冷', () => {
      testThreshold('体温', 21, '体温_寒冷');
      testThreshold('体温', 40, '体温_寒冷');
    });

    it('41-60 → 体温_适中', () => {
      testThreshold('体温', 41, '体温_适中');
      testThreshold('体温', 60, '体温_适中');
    });

    it('61-80 → 体温_温暖', () => {
      testThreshold('体温', 61, '体温_温暖');
      testThreshold('体温', 80, '体温_温暖');
    });

    it('81-100 → 体温_炎热', () => {
      testThreshold('体温', 81, '体温_炎热');
      testThreshold('体温', 100, '体温_炎热');
    });
  });

  it('returns correct efficiencyModifier for 饱食度_极低', () => {
    const attrs = { ...defaultAttributes(), '饱食度': 10 };
    const result = applyThresholdEffects(attrs);
    expect(result['饱食度'].efficiencyModifier).toBe(0.5);
  });

  it('returns correct recoveryModifier for 饱食度_饱足', () => {
    const attrs = { ...defaultAttributes(), '饱食度': 90 };
    const result = applyThresholdEffects(attrs);
    expect(result['饱食度'].recoveryModifier).toBe(2);
  });
});

// ============================================================
// applyLinkageEffects — All 30 linkages
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

    it('directly changes 精力值 (-1/h, rate type)', () => {
      const attrs = { ...defaultAttributes(), '饱食度': 30 };
      const result = applyLinkageEffects(attrs);
      expect(result.directChanges['精力值']).toBe(-1);
    });

    it('directly changes 心情 (-1/h, rate type)', () => {
      const attrs = { ...defaultAttributes(), '饱食度': 30 };
      const result = applyLinkageEffects(attrs);
      expect(result.directChanges['心情']).toBe(-1);
    });

    it('directly changes 体温 (-1, rate type)', () => {
      const attrs = { ...defaultAttributes(), '饱食度': 30 };
      const result = applyLinkageEffects(attrs);
      expect(result.directChanges['体温']).toBe(-1);
    });

    it('饱食度 = 29 activates (≤ 30)', () => {
      const attrs = { ...defaultAttributes(), '饱食度': 29 };
      const result = applyLinkageEffects(attrs);
      const count = result.activeLinkages.filter(l => l.triggerAttribute === '饱食度').length;
      expect(count).toBe(4);
    });

    it('饱食度 = 31 does NOT activate', () => {
      const attrs = { ...defaultAttributes(), '饱食度': 31 };
      const result = applyLinkageEffects(attrs);
      const count = result.activeLinkages.filter(l => l.triggerAttribute === '饱食度').length;
      expect(count).toBe(0);
    });
  });

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

    it('directly changes 心情 (-0.7/h, rate type)', () => {
      const attrs = { ...defaultAttributes(), '体力值': 30 };
      const result = applyLinkageEffects(attrs);
      expect(result.directChanges['心情']).toBe(-0.7);
    });
  });

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

    it('directly changes 心情 (-1/h, rate type)', () => {
      const attrs = { ...defaultAttributes(), '健康值': 40 };
      const result = applyLinkageEffects(attrs);
      expect(result.directChanges['心情']).toBe(-1);
    });

    it('健康值 = 41 does NOT activate', () => {
      const attrs = { ...defaultAttributes(), '健康值': 41 };
      const result = applyLinkageEffects(attrs);
      const count = result.activeLinkages.filter(l => l.triggerAttribute === '健康值').length;
      expect(count).toBe(0);
    });
  });

  describe('精力值 linkages', () => {
    it('精力值 ≤ 50 activates 体力值 efficiency -15%', () => {
      const attrs = { ...defaultAttributes(), '精力值': 50 };
      const result = applyLinkageEffects(attrs);
      const link = result.activeLinkages.find(
        l => l.triggerAttribute === '精力值' && l.triggerCondition === 'leq' && l.triggerValue === 50
      );
      expect(link).toBeDefined();
      expect(link!.modifier).toBe(-0.15);
    });

    it('精力值 ≤ 30 activates 体力值 efficiency -20%', () => {
      const attrs = { ...defaultAttributes(), '精力值': 30 };
      const result = applyLinkageEffects(attrs);
      const links = result.activeLinkages.filter(
        l => l.triggerAttribute === '精力值' && l.affectedAttribute === '体力值' && l.modifierType === 'efficiency'
      );
      expect(links).toHaveLength(2);
    });

    it('精力值 > 80 activates 精力值 consumption -20%', () => {
      const attrs = { ...defaultAttributes(), '精力值': 81 };
      const result = applyLinkageEffects(attrs);
      const link = result.activeLinkages.find(
        l => l.triggerAttribute === '精力值' && l.triggerCondition === 'gt'
      );
      expect(link).toBeDefined();
      expect(link!.modifier).toBe(-0.2);
    });

    it('精力值 = 80 does NOT activate gt 80', () => {
      const attrs = { ...defaultAttributes(), '精力值': 80 };
      const result = applyLinkageEffects(attrs);
      const link = result.activeLinkages.find(
        l => l.triggerAttribute === '精力值' && l.triggerCondition === 'gt'
      );
      expect(link).toBeUndefined();
    });
  });

  describe('污垢 linkages', () => {
    it('污垢 > 60 activates 健康值 recovery -30%', () => {
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

    it('污垢 > 80 activates 体力值 consumption +15%', () => {
      const attrs = { ...defaultAttributes(), '污垢': 81 };
      const result = applyLinkageEffects(attrs);
      const link = result.activeLinkages.find(
        l => l.triggerAttribute === '污垢' && l.affectedAttribute === '体力值'
      );
      expect(link).toBeDefined();
      expect(link!.modifier).toBe(0.15);
    });

    it('污垢 > 80 blocks 心情 recovery', () => {
      const attrs = { ...defaultAttributes(), '污垢': 81 };
      const result = applyLinkageEffects(attrs);
      const link = result.activeLinkages.find(
        l => l.triggerAttribute === '污垢' && l.modifierType === 'blockRecovery'
      );
      expect(link).toBeDefined();
    });
  });

  describe('心情 linkages', () => {
    it('心情 ≤ 30 activates 体力值 consumption +20%', () => {
      const attrs = { ...defaultAttributes(), '心情': 30 };
      const result = applyLinkageEffects(attrs);
      const link = result.activeLinkages.find(
        l => l.triggerAttribute === '心情' && l.triggerCondition === 'leq' && l.affectedAttribute === '体力值'
      );
      expect(link).toBeDefined();
      expect(link!.modifier).toBe(0.2);
    });

    it('心情 ≤ 30 activates 精力值 consumption +20%', () => {
      const attrs = { ...defaultAttributes(), '心情': 30 };
      const result = applyLinkageEffects(attrs);
      const link = result.activeLinkages.find(
        l => l.triggerAttribute === '心情' && l.triggerCondition === 'leq' && l.affectedAttribute === '精力值'
      );
      expect(link).toBeDefined();
      expect(link!.modifier).toBe(0.2);
    });

    it('心情 > 80 activates 体力值 recovery +3', () => {
      const attrs = { ...defaultAttributes(), '心情': 81 };
      const result = applyLinkageEffects(attrs);
      const link = result.activeLinkages.find(
        l => l.triggerAttribute === '心情' && l.triggerCondition === 'gt' && l.affectedAttribute === '体力值'
      );
      expect(link).toBeDefined();
      expect(link!.modifier).toBe(3);
    });

    it('心情 > 80 activates 精力值 recovery +2', () => {
      const attrs = { ...defaultAttributes(), '心情': 81 };
      const result = applyLinkageEffects(attrs);
      const link = result.activeLinkages.find(
        l => l.triggerAttribute === '心情' && l.triggerCondition === 'gt' && l.affectedAttribute === '精力值'
      );
      expect(link).toBeDefined();
      expect(link!.modifier).toBe(2);
    });

    it('心情 = 80 does NOT activate gt 80', () => {
      const attrs = { ...defaultAttributes(), '心情': 80 };
      const result = applyLinkageEffects(attrs);
      const count = result.activeLinkages.filter(
        l => l.triggerAttribute === '心情' && l.triggerCondition === 'gt'
      ).length;
      expect(count).toBe(0);
    });
  });

  describe('负重 linkages', () => {
    it('负重 > 50 activates 体力值 consumption +20%', () => {
      const attrs = { ...defaultAttributes(), '负重': 51 };
      const result = applyLinkageEffects(attrs);
      const link = result.activeLinkages.find(
        l => l.triggerAttribute === '负重' && l.triggerValue === 50
      );
      expect(link).toBeDefined();
      expect(link!.modifier).toBe(0.2);
    });

    it('负重 > 75 activates 体力值 consumption +40%', () => {
      const attrs = { ...defaultAttributes(), '负重': 76 };
      const result = applyLinkageEffects(attrs);
      const links = result.activeLinkages.filter(
        l => l.triggerAttribute === '负重' && l.affectedAttribute === '体力值'
      );
      expect(links).toHaveLength(2);
      expect(links[1].modifier).toBe(0.4);
    });

    it('负重 > 75 activates 心情 rate -2', () => {
      const attrs = { ...defaultAttributes(), '负重': 76 };
      const result = applyLinkageEffects(attrs);
      expect(result.directChanges['心情']).toBe(-2);
    });

    it('负重 = 50 does NOT activate', () => {
      const attrs = { ...defaultAttributes(), '负重': 50 };
      const result = applyLinkageEffects(attrs);
      const count = result.activeLinkages.filter(l => l.triggerAttribute === '负重').length;
      expect(count).toBe(0);
    });
  });

  describe('体温 linkages', () => {
    it('体温 ≤ 40 activates 体力值 consumption +30%', () => {
      const attrs = { ...defaultAttributes(), '体温': 40 };
      const result = applyLinkageEffects(attrs);
      const link = result.activeLinkages.find(
        l => l.triggerAttribute === '体温' && l.triggerValue === 40 && l.affectedAttribute === '体力值'
      );
      expect(link).toBeDefined();
      expect(link!.modifier).toBe(0.3);
    });

    it('体温 ≤ 40 activates 精力值 recovery -50%', () => {
      const attrs = { ...defaultAttributes(), '体温': 40 };
      const result = applyLinkageEffects(attrs);
      const link = result.activeLinkages.find(
        l => l.triggerAttribute === '体温' && l.triggerValue === 40 && l.affectedAttribute === '精力值'
      );
      expect(link).toBeDefined();
      expect(link!.modifier).toBe(-0.5);
    });

    it('体温 ≤ 20 activates 健康值 rate -3', () => {
      const attrs = { ...defaultAttributes(), '体温': 20 };
      const result = applyLinkageEffects(attrs);
      expect(result.directChanges['健康值']).toBe(-3);
    });

    it('体温 ≥ 81 activates 口渴度 consumption +50%', () => {
      const attrs = { ...defaultAttributes(), '体温': 81 };
      const result = applyLinkageEffects(attrs);
      const link = result.activeLinkages.find(
        l => l.triggerAttribute === '体温' && l.triggerCondition === 'geq' && l.triggerValue === 81
      );
      expect(link).toBeDefined();
      expect(link!.modifier).toBe(0.5);
    });

    it('体温 ≥ 91 activates 健康值 rate -2', () => {
      const attrs = { ...defaultAttributes(), '体温': 91 };
      const result = applyLinkageEffects(attrs);
      const links = result.activeLinkages.filter(
        l => l.triggerAttribute === '体温' && l.affectedAttribute === '健康值'
      );
      expect(links.some(l => l.modifier === -2)).toBe(true);
    });
  });

  describe('multiple linkages stacking (direct changes)', () => {
    it('饱食度≤30 + 体力值≤30 → 心情 rate effects stack', () => {
      const attrs: Attributes = {
        ...defaultAttributes(),
        '饱食度': 30,
        '体力值': 30,
      };
      const result = applyLinkageEffects(attrs);
      expect(result.directChanges['心情']).toBe(-1 + -0.7);
    });

    it('饱食度≤30 + 健康值≤40 → 心情 rate effects stack', () => {
      const attrs: Attributes = {
        ...defaultAttributes(),
        '饱食度': 30,
        '健康值': 40,
      };
      const result = applyLinkageEffects(attrs);
      expect(result.directChanges['心情']).toBe(-1 + -1);
    });

    it('饱食度≤30 + 体力值≤30 + 健康值≤40 → full 心情 stack', () => {
      const attrs: Attributes = {
        ...defaultAttributes(),
        '饱食度': 30,
        '体力值': 30,
        '健康值': 40,
      };
      const result = applyLinkageEffects(attrs);
      expect(result.directChanges['心情']).toBe(-1 + -0.7 + -1);
    });

    it('体温≤20 + 体温≥91 cannot both be true (sanity)', () => {
      const cold: Attributes = { ...defaultAttributes(), '体温': 15 };
      const hot: Attributes = { ...defaultAttributes(), '体温': 95 };
      const coldResult = applyLinkageEffects(cold);
      const hotResult = applyLinkageEffects(hot);
      expect(coldResult.activeLinkages.some(l => l.triggerAttribute === '体温' && l.triggerCondition === 'leq' && l.triggerValue === 20)).toBe(true);
      expect(coldResult.activeLinkages.some(l => l.triggerAttribute === '体温' && l.triggerCondition === 'geq' && l.triggerValue === 91)).toBe(false);
      expect(hotResult.activeLinkages.some(l => l.triggerAttribute === '体温' && l.triggerCondition === 'geq' && l.triggerValue === 91)).toBe(true);
      expect(hotResult.activeLinkages.some(l => l.triggerAttribute === '体温' && l.triggerCondition === 'leq' && l.triggerValue === 20)).toBe(false);
    });
  });
});

// ============================================================
// clampAttributes
// ============================================================

describe('clampAttributes', () => {
  it('does not mutate input', () => {
    const input: Attributes = { ...defaultAttributes(), '饱食度': -10 };
    const snap = clone(input);
    clampAttributes(input);
    expect(input).toEqual(snap);
  });

  it('clamps negative values to 0', () => {
    const attrs: Attributes = {
      ...defaultAttributes(),
      '饱食度': -10, '口渴度': -5, '体力值': -3,
      '健康值': -1, '精力值': -20, '污垢': -2, '心情': -15,
      '负重': -1, '体温': -10,
    };
    const result = clampAttributes(attrs);
    for (const key of Object.keys(result) as (keyof Attributes)[]) {
      expect(result[key]).toBeGreaterThanOrEqual(0);
    }
  });

  it('clamps above-maximum values to 100', () => {
    const attrs: Attributes = {
      ...defaultAttributes(),
      '饱食度': 120, '口渴度': 110, '体力值': 150,
      '健康值': 200, '精力值': 130, '污垢': 120, '心情': 140,
      '负重': 110, '体温': 105,
    };
    const result = clampAttributes(attrs);
    for (const key of Object.keys(result) as (keyof Attributes)[]) {
      expect(result[key]).toBeLessThanOrEqual(100);
    }
  });

  it('values in range are unchanged', () => {
    const attrs = defaultAttributes();
    const result = clampAttributes(attrs);
    expect(result).toEqual(attrs);
  });

  it('exactly at boundaries (0 and 100)', () => {
    const attrs: Attributes = {
      ...defaultAttributes(),
      '饱食度': 0, '口渴度': 100, '体温': 0, '负重': 100,
    };
    const result = clampAttributes(attrs);
    expect(result['饱食度']).toBe(0);
    expect(result['口渴度']).toBe(100);
    expect(result['体温']).toBe(0);
    expect(result['负重']).toBe(100);
  });
});

// ============================================================
// processNaturalDecay — Full per-hour decay pipeline
// ============================================================

describe('processNaturalDecay', () => {
  it('does not mutate input', () => {
    const input = defaultAttributes();
    const snap = clone(input);
    processNaturalDecay(input, 60);
    expect(input).toEqual(snap);
  });

  describe('base decay rates', () => {
    it('饱食度 decays -1/h for 60min', () => {
      const result = processNaturalDecay(defaultAttributes(), 60);
      expect(result['饱食度']).toBe(59);
    });

    it('饱食度 decays -0.5 for 30min', () => {
      const result = processNaturalDecay(defaultAttributes(), 30);
      expect(result['饱食度']).toBe(59.5);
    });

    it('口渴度 decays -1.5/h', () => {
      const result = processNaturalDecay(defaultAttributes(), 60);
      expect(result['口渴度']).toBe(58.5);
    });

    it('精力值 decays -0.5/h', () => {
      const result = processNaturalDecay(defaultAttributes(), 60);
      expect(result['精力值']).toBe(79.5);
    });

    it('污垢 increases +1/h', () => {
      const result = processNaturalDecay(defaultAttributes(), 60);
      expect(result['污垢']).toBe(21);
    });

    it('心情 decays -0.5/h', () => {
      const result = processNaturalDecay(defaultAttributes(), 60);
      expect(result['心情']).toBe(69.5);
    });

    it('体力值 has no base decay', () => {
      const result = processNaturalDecay(defaultAttributes(), 60);
      expect(result['体力值']).toBe(80);
    });

    it('健康值 has no base decay', () => {
      const result = processNaturalDecay(defaultAttributes(), 60);
      expect(result['健康值']).toBe(100);
    });
  });

  describe('conditional modifiers', () => {
    it('gathering adds -0.5/h to 饱食度', () => {
      const result = processNaturalDecay(defaultAttributes(), 60, undefined, { gathering: true });
      expect(result['饱食度']).toBe(58.5);
    });

    it('fighting adds -0.5/h to 饱食度', () => {
      const result = processNaturalDecay(defaultAttributes(), 60, undefined, { fighting: true });
      expect(result['饱食度']).toBe(58.5);
    });

    it('sunny weather adds -0.5/h to 口渴度', () => {
      const result = processNaturalDecay(defaultAttributes(), 60, '晴');
      expect(result['口渴度']).toBe(58);
    });

    it('mountain terrain adds -0.3/h to 口渴度', () => {
      const result = processNaturalDecay(defaultAttributes(), 60, undefined, { terrain: '山地' });
      expect(result['口渴度']).toBe(58.2);
    });

    it('volcano terrain adds -0.3/h to 口渴度', () => {
      const result = processNaturalDecay(defaultAttributes(), 60, undefined, { terrain: '火山' });
      expect(result['口渴度']).toBe(58.2);
    });

    it('hungry (饱食度≤0) adds -0.8/h to 体力值', () => {
      const attrs = { ...defaultAttributes(), '饱食度': 0 };
      const result = processNaturalDecay(attrs, 60);
      expect(result['体力值']).toBe(79.2);
    });

    it('thirsty (口渴度≤0) adds -0.8/h to 体力值', () => {
      const attrs = { ...defaultAttributes(), '口渴度': 0 };
      const result = processNaturalDecay(attrs, 60);
      expect(result['体力值']).toBe(79.2);
    });

    it('hungry adds -1.5/h to 健康值', () => {
      const attrs = { ...defaultAttributes(), '饱食度': 0 };
      const result = processNaturalDecay(attrs, 60);
      expect(result['健康值']).toBe(98.5);
    });

    it('crafting adds -1/h to 精力值', () => {
      const result = processNaturalDecay(defaultAttributes(), 60, undefined, { crafting: true });
      expect(result['精力值']).toBe(78.5);
    });

    it('fighting adds -0.5/h to 精力值', () => {
      const result = processNaturalDecay(defaultAttributes(), 60, undefined, { fighting: true });
      expect(result['精力值']).toBe(79);
    });

    it('hungry adds -0.5/h to 精力值', () => {
      const attrs = { ...defaultAttributes(), '饱食度': 0 };
      const result = processNaturalDecay(attrs, 60);
      expect(result['精力值']).toBe(79);
    });

    it('gathering adds +0.3/h to 污垢', () => {
      const result = processNaturalDecay(defaultAttributes(), 60, undefined, { gathering: true });
      expect(result['污垢']).toBe(21.3);
    });

    it('fighting adds +0.5/h to 污垢', () => {
      const result = processNaturalDecay(defaultAttributes(), 60, undefined, { fighting: true });
      expect(result['污垢']).toBe(21.5);
    });

    it('rainstorm adds -1.5/h to 污垢', () => {
      const result = processNaturalDecay(defaultAttributes(), 60, '暴雨');
      expect(result['污垢']).toBe(19.5);
    });

    it('污垢 > 60 adds extra -0.5/h to 心情', () => {
      const attrs = { ...defaultAttributes(), '污垢': 61 };
      const result = processNaturalDecay(attrs, 60);
      expect(result['心情']).toBe(69);
    });
  });

  describe('temperature convergence', () => {
    it('converges toward environment temperature at 0.5/h (cooling)', () => {
      const attrs = { ...defaultAttributes(), '体温': 80 };
      const result = processNaturalDecay(attrs, 60, undefined, { environmentTemperature: 50 });
      expect(result['体温']).toBe(79.5);
    });

    it('converges toward environment temperature at 0.5/h (warming)', () => {
      const attrs = { ...defaultAttributes(), '体温': 40 };
      const result = processNaturalDecay(attrs, 60, undefined, { environmentTemperature: 60 });
      expect(result['体温']).toBe(40.5);
    });

    it('no change when at environment temperature', () => {
      const attrs = { ...defaultAttributes(), '体温': 60 };
      const result = processNaturalDecay(attrs, 60, undefined, { environmentTemperature: 60 });
      expect(result['体温']).toBe(60);
    });

    it('near fire adds +10/h to 体温', () => {
      const attrs = { ...defaultAttributes(), '体温': 50 };
      const result = processNaturalDecay(attrs, 60, undefined, { nearFire: true, environmentTemperature: 40 });
      expect(result['体温']).toBe(59.5);
    });
  });

  describe('clamping', () => {
    it('clamps results to valid range', () => {
      const attrs: Attributes = {
        ...defaultAttributes(),
        '饱食度': 0.3,
        '口渴度': 0.5,
        '心情': 0.2,
      };
      const result = processNaturalDecay(attrs, 60);
      for (const key of Object.keys(result) as (keyof Attributes)[]) {
        expect(result[key]).toBeGreaterThanOrEqual(0);
        expect(result[key]).toBeLessThanOrEqual(100);
      }
    });
  });
});

// ============================================================
// checkDeathConditions
// ============================================================

describe('checkDeathConditions', () => {
  it('health = 100 → not dead', () => {
    const result = checkDeathConditions(defaultAttributes());
    expect(result.isDead).toBe(false);
    expect(result.reason).toBeNull();
  });

  it('health = 1 → not dead', () => {
    const attrs = { ...defaultAttributes(), '健康值': 1 };
    const result = checkDeathConditions(attrs);
    expect(result.isDead).toBe(false);
  });

  it('health ≤ 0 → true (dead)', () => {
    const attrs = { ...defaultAttributes(), '健康值': 0 };
    const result = checkDeathConditions(attrs);
    expect(result.isDead).toBe(true);
    expect(result.reason).toBe('健康值归零');
  });

  it('health < 0 → dead', () => {
    const attrs = { ...defaultAttributes(), '健康值': -10 };
    const result = checkDeathConditions(attrs);
    expect(result.isDead).toBe(true);
  });

  it('other attributes at 0 do NOT trigger death', () => {
    const attrs: Attributes = {
      '饱食度': 0, '口渴度': 0, '体力值': 0,
      '健康值': 50, '精力值': 0, '污垢': 100, '心情': 0,
      '负重': 100, '体温': 0,
    };
    const result = checkDeathConditions(attrs);
    expect(result.isDead).toBe(false);
  });
});

// ============================================================
// Backward-compatible exports
// ============================================================

describe('backward compat — applyNaturalDecay', () => {
  it('uses processNaturalDecay with 60min internally', () => {
    const result = applyNaturalDecay(defaultAttributes());
    const expected = processNaturalDecay(defaultAttributes(), 60);
    expect(result).toEqual(expected);
  });
});

describe('backward compat — applyStatusEffects', () => {
  it('applies -10 health for 中毒', () => {
    const attrs = defaultAttributes();
    const statuses: ActiveStatusEffect[] = [{ id: '中毒', remainingDuration: 3 }];
    const result = applyStatusEffects(attrs, statuses);
    expect(result.attributes['健康值']).toBe(90);
  });

  it('decrements duration', () => {
    const attrs = defaultAttributes();
    const statuses: ActiveStatusEffect[] = [{ id: '中毒', remainingDuration: 3 }];
    const result = applyStatusEffects(attrs, statuses);
    expect(result.statusEffects[0].remainingDuration).toBe(2);
  });

  it('expires when duration reaches 0', () => {
    const attrs = defaultAttributes();
    const statuses: ActiveStatusEffect[] = [{ id: '中毒', remainingDuration: 1 }];
    const result = applyStatusEffects(attrs, statuses);
    expect(result.statusEffects).toHaveLength(0);
  });

  it('applies -5 health for 感染', () => {
    const attrs = defaultAttributes();
    const statuses: ActiveStatusEffect[] = [{ id: '感染', remainingDuration: 5 }];
    const result = applyStatusEffects(attrs, statuses);
    expect(result.attributes['健康值']).toBe(95);
  });

  it('stacks 中毒 + 感染 = -15 health/turn', () => {
    const attrs = defaultAttributes();
    const statuses: ActiveStatusEffect[] = [
      { id: '中毒', remainingDuration: 3 },
      { id: '感染', remainingDuration: 5 },
    ];
    const result = applyStatusEffects(attrs, statuses);
    expect(result.attributes['健康值']).toBe(85);
  });

  it('conditional statuses (null duration) persist', () => {
    const attrs = defaultAttributes();
    const statuses: ActiveStatusEffect[] = [{ id: '疲惫', remainingDuration: null }];
    const result = applyStatusEffects(attrs, statuses);
    expect(result.statusEffects).toHaveLength(1);
    expect(result.statusEffects[0].remainingDuration).toBeNull();
  });

  it('unknown status ID is silently skipped', () => {
    const attrs = defaultAttributes();
    const statuses: ActiveStatusEffect[] = [
      { id: '不存在' as StatusEffectId, remainingDuration: 5 },
      { id: '中毒', remainingDuration: 3 },
    ];
    const result = applyStatusEffects(attrs, statuses);
    expect(result.attributes['健康值']).toBe(90);
    expect(result.statusEffects).toHaveLength(1);
  });

  it('empty status list returns unchanged attributes', () => {
    const attrs = defaultAttributes();
    const result = applyStatusEffects(attrs, []);
    expect(result.attributes).toEqual(attrs);
    expect(result.statusEffects).toHaveLength(0);
  });
});

describe('backward compat — applyWeatherEffects', () => {
  it('晴 → 口渴度 -3', () => {
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

  it('unknown weather ID returns unchanged', () => {
    const result = applyWeatherEffects(defaultAttributes(), '大雾' as WeatherId);
    expect(result).toEqual(defaultAttributes());
  });
});

describe('backward compat — createSeededRNG', () => {
  it('produces deterministic sequence from same seed', () => {
    const rng1 = createSeededRNG(42);
    const rng2 = createSeededRNG(42);
    const seq1 = Array.from({ length: 10 }, () => rng1());
    const seq2 = Array.from({ length: 10 }, () => rng2());
    expect(seq1).toEqual(seq2);
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
// Edge cases
// ============================================================

describe('edge cases — sparse/missing attributes', () => {
  const sparseAttrs = (): Attributes => ({ '饱食度': 50, '健康值': 60 } as Attributes);

  it('applyThresholdEffects uses initialValue fallback', () => {
    const result = applyThresholdEffects(sparseAttrs());
    expect(result['饱食度'].effectId).toBe('饱食度_低');
    expect(result['健康值'].effectId).toBe('健康值_受伤');
    expect(result['口渴度'].effectId).toBe('口渴度_低');
  });

  it('applyLinkageEffects uses 0 fallback for missing trigger', () => {
    const result = applyLinkageEffects(sparseAttrs());
    const thirstLinks = result.activeLinkages.filter(l => l.triggerAttribute === '口渴度');
    expect(thirstLinks.length).toBeGreaterThan(0);
  });

  it('checkDeathConditions uses 0 fallback for missing 健康值', () => {
    const attrs = { '饱食度': 50 } as Attributes;
    const result = checkDeathConditions(attrs);
    expect(result.isDead).toBe(true);
  });

  it('clampAttributes uses initialValue fallback', () => {
    const result = clampAttributes(sparseAttrs());
    expect(result['口渴度']).toBe(60);
    expect(result['体力值']).toBe(80);
    expect(result['体温']).toBe(60);
  });
});

describe('edge cases — processNaturalDecay without context', () => {
  it('works with no weather or context', () => {
    const result = processNaturalDecay(defaultAttributes(), 60);
    expect(result['饱食度']).toBe(59);
    expect(result['口渴度']).toBe(58.5);
  });

  it('defaults environmentTemperature to 60', () => {
    const attrs = { ...defaultAttributes(), '体温': 60 };
    const result = processNaturalDecay(attrs, 60);
    expect(result['体温']).toBe(60);
  });
});

// ============================================================
// ALL_LINKAGES constant
// ============================================================

describe('ALL_LINKAGES', () => {
  it('contains 30 linkages from design doc', () => {
    expect(ALL_LINKAGES).toHaveLength(30);
  });

  it('all linkages have valid modifierType', () => {
    const validTypes = ['rate', 'consumption', 'recovery', 'efficiency', 'blockRecovery'];
    for (const linkage of ALL_LINKAGES) {
      expect(validTypes).toContain(linkage.modifierType);
    }
  });

  it('all linkages use valid trigger conditions', () => {
    const validOps = ['leq', 'geq', 'lt', 'gt', 'eq'];
    for (const linkage of ALL_LINKAGES) {
      expect(validOps).toContain(linkage.triggerCondition);
    }
  });
});

// ============================================================
// Full pipeline simulation
// ============================================================

describe('full pipeline simulation', () => {
  it('single hour with no context', () => {
    const result = processNaturalDecay(defaultAttributes(), 60);
    expect(result['饱食度']).toBe(59);
    expect(result['口渴度']).toBe(58.5);
    expect(result['精力值']).toBe(79.5);
    expect(result['污垢']).toBe(21);
    expect(result['心情']).toBe(69.5);
  });

  it('gathering + sunny for 30min', () => {
    const result = processNaturalDecay(defaultAttributes(), 30, '晴', { gathering: true });
    expect(result['饱食度']).toBe(59.25);
    expect(result['口渴度']).toBe(59);
    expect(result['污垢']).toBe(20.65);
  });

  it('full worst case: all negatives active', () => {
    const attrs: Attributes = {
      ...defaultAttributes(),
      '饱食度': 0,
      '口渴度': 0,
      '污垢': 80,
      '体温': 10,
    };
    const result = processNaturalDecay(attrs, 60, '暴雨', { fighting: true, terrain: '山地' });
    for (const key of Object.keys(result) as (keyof Attributes)[]) {
      expect(result[key]).toBeGreaterThanOrEqual(0);
      expect(result[key]).toBeLessThanOrEqual(100);
    }
  });
});
