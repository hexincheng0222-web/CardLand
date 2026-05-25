import { describe, it, expect } from 'vitest';
import type { AttributeId } from '@data/types';
import {
  createStatusEffect,
  isEffectActive,
  getActiveEffects,
  applyStatusEffects,
  addStatusEffect,
  removeStatusEffect,
  checkPositiveNegatives,
  getStatusModifiers,
  STATUS_DEFINITIONS,
  ALL_STATUS_IDS,
} from '../status';
import type { StatusEffect, StatusEffectId } from '../status';

// ============================================================
// Helpers
// ============================================================

const T = (hours: number) => hours * 60;

const defaultAttrs: Record<AttributeId, number> = {
  '饱食度': 60, '口渴度': 60, '体力值': 80,
  '健康值': 100, '精力值': 80, '污垢': 20,
  '心情': 70, '负重': 0, '体温': 60,
};

const mkEffect = (id: StatusEffectId, start: number, expires: number | null): StatusEffect => ({
  id, startedAt: start, expiresAt: expires,
});

// ============================================================
// All 21 effects exist
// ============================================================

describe('STATUS_DEFINITIONS — all 21 effects', () => {
  it('contains exactly 21 definitions', () => {
    expect(ALL_STATUS_IDS).toHaveLength(21);
  });

  it('all definitions have valid fields', () => {
    for (const id of ALL_STATUS_IDS) {
      const def = STATUS_DEFINITIONS[id];
      expect(def).toBeDefined();
      expect(def.id).toBe(id);
      expect(def.name).toBeTruthy();
      expect(def.icon).toBeTruthy();
      expect(typeof def.isNegative).toBe('boolean');
    }
  });

  it('13 negative + 8 positive', () => {
    const neg = ALL_STATUS_IDS.filter(id => STATUS_DEFINITIONS[id].isNegative);
    const pos = ALL_STATUS_IDS.filter(id => !STATUS_DEFINITIONS[id].isNegative);
    expect(neg).toHaveLength(13);
    expect(pos).toHaveLength(8);
  });
});

// ============================================================
// 1. createStatusEffect
// ============================================================

describe('createStatusEffect', () => {
  it('creates duration-based effect with correct expiresAt', () => {
    const e = createStatusEffect('中毒', T(0));
    expect(e.id).toBe('中毒');
    expect(e.startedAt).toBe(T(0));
    expect(e.expiresAt).toBe(T(3));
  });

  it('creates null-duration effect with expiresAt=null', () => {
    const e = createStatusEffect('疲惫', T(0));
    expect(e.expiresAt).toBeNull();
  });

  it('creates all 21 effects without throwing', () => {
    for (const id of ALL_STATUS_IDS) {
      const e = createStatusEffect(id, T(0));
      expect(e.id).toBe(id);
    }
  });

  it('durations match design doc', () => {
    expect(createStatusEffect('中毒', 0).expiresAt).toBe(T(3));
    expect(createStatusEffect('感染', 0).expiresAt).toBe(T(5));
    expect(createStatusEffect('灼伤', 0).expiresAt).toBe(T(2));
    expect(createStatusEffect('迷路', 0).expiresAt).toBe(T(1));
    expect(createStatusEffect('溺水', 0).expiresAt).toBe(T(1));
    expect(createStatusEffect('蛇毒', 0).expiresAt).toBe(T(3));
    expect(createStatusEffect('疾病', 0).expiresAt).toBe(T(5));
    expect(createStatusEffect('湿身', 0).expiresAt).toBe(T(2));
    expect(createStatusEffect('精神饱满', 0).expiresAt).toBe(T(3));
  });

  it('conditional effects have null duration', () => {
    const conditional: StatusEffectId[] = ['疲惫', '沮丧', '失温症', '中暑', '饮食单调', '饱腹', '专注', '清爽', '愉悦', '防护', '探索者之眼', '暖身'];
    for (const id of conditional) {
      expect(createStatusEffect(id, 0).expiresAt).toBeNull();
    }
  });
});

// ============================================================
// 2. isEffectActive
// ============================================================

describe('isEffectActive', () => {
  it('duration effect is active before expiry', () => {
    const e = mkEffect('中毒', T(0), T(3));
    expect(isEffectActive(e, T(2))).toBe(true);
  });

  it('duration effect is inactive at expiry', () => {
    const e = mkEffect('中毒', T(0), T(3));
    expect(isEffectActive(e, T(3))).toBe(false);
  });

  it('duration effect is inactive after expiry', () => {
    const e = mkEffect('中毒', T(0), T(3));
    expect(isEffectActive(e, T(5))).toBe(false);
  });

  it('null-duration effect is always active', () => {
    const e = mkEffect('疲惫', T(0), null);
    expect(isEffectActive(e, T(0))).toBe(true);
    expect(isEffectActive(e, T(1000))).toBe(true);
  });
});

// ============================================================
// 3. getActiveEffects
// ============================================================

describe('getActiveEffects', () => {
  it('filters out expired effects', () => {
    const effects: StatusEffect[] = [
      mkEffect('中毒', T(0), T(3)),
      mkEffect('感染', T(0), T(5)),
      mkEffect('迷路', T(0), T(1)),
    ];
    const active = getActiveEffects(effects, T(2));
    expect(active.map(e => e.id)).toEqual(['中毒', '感染']);
  });

  it('keeps null-duration effects', () => {
    const effects: StatusEffect[] = [
      mkEffect('疲惫', T(0), null),
      mkEffect('饱腹', T(0), null),
    ];
    expect(getActiveEffects(effects, T(100))).toHaveLength(2);
  });

  it('returns empty for empty input', () => {
    expect(getActiveEffects([], T(0))).toEqual([]);
  });
});

// ============================================================
// 4. applyStatusEffects
// ============================================================

describe('applyStatusEffects', () => {
  it('applies per-hour health damage for 中毒', () => {
    const effects = [mkEffect('中毒', T(0), T(3))];
    const result = applyStatusEffects(effects, defaultAttrs, T(1));
    expect(result.attributeChanges['健康值']).toBeCloseTo(-1.5);
  });

  it('applies per-hour health damage for 感染', () => {
    const effects = [mkEffect('感染', T(0), T(5))];
    const result = applyStatusEffects(effects, defaultAttrs, T(1));
    expect(result.attributeChanges['健康值']).toBeCloseTo(-0.8);
  });

  it('applies 灼伤 health + staminaMax', () => {
    const effects = [mkEffect('灼伤', T(0), T(2))];
    const result = applyStatusEffects(effects, defaultAttrs, T(1));
    expect(result.attributeChanges['健康值']).toBeCloseTo(-1.2);
  });

  it('applies 溺水 massive damage', () => {
    const effects = [mkEffect('溺水', T(0), T(1))];
    const result = applyStatusEffects(effects, defaultAttrs, T(0.5));
    expect(result.attributeChanges['健康值']).toBeCloseTo(-20);
    expect(result.attributeChanges['体力值']).toBeCloseTo(-30);
  });

  it('applies 蛇毒 health damage', () => {
    const effects = [mkEffect('蛇毒', T(0), T(3))];
    const result = applyStatusEffects(effects, defaultAttrs, T(1));
    expect(result.attributeChanges['健康值']).toBeCloseTo(-2);
  });

  it('applies 疾病 stamina drain', () => {
    const effects = [mkEffect('疾病', T(0), T(5))];
    const result = applyStatusEffects(effects, defaultAttrs, T(1));
    expect(result.attributeChanges['体力值']).toBeCloseTo(-1.5);
  });

  it('applies 湿身 temperature drain', () => {
    const effects = [mkEffect('湿身', T(0), T(2))];
    const result = applyStatusEffects(effects, defaultAttrs, T(1));
    expect(result.attributeChanges['体温']).toBeCloseTo(-0.5);
  });

  it('applies positive 饱腹 stamina recovery', () => {
    const effects = [mkEffect('饱腹', T(0), null)];
    const result = applyStatusEffects(effects, defaultAttrs, T(1));
    expect(result.attributeChanges['体力值']).toBeCloseTo(0.8);
  });

  it('applies 清爽 mood recovery', () => {
    const effects = [mkEffect('清爽', T(0), null)];
    const result = applyStatusEffects(effects, defaultAttrs, T(1));
    expect(result.attributeChanges['心情']).toBeCloseTo(0.5);
    expect(result.attributeChanges['健康值']).toBeUndefined();
  });

  it('applies 暖身 temperature gain', () => {
    const effects = [mkEffect('暖身', T(0), null)];
    const result = applyStatusEffects(effects, defaultAttrs, T(1));
    expect(result.attributeChanges['体温']).toBeCloseTo(0.5);
  });

  it('skips expired effects', () => {
    const effects = [mkEffect('中毒', T(0), T(3))];
    const result = applyStatusEffects(effects, defaultAttrs, T(5));
    expect(result.attributeChanges).toEqual({});
  });

  it('empty effects returns no changes', () => {
    const result = applyStatusEffects([], defaultAttrs, T(0));
    expect(result.attributeChanges).toEqual({});
    expect(result.activeEffects).toEqual([]);
  });

  it('does not mutate input', () => {
    const effects = [mkEffect('中毒', T(0), T(3))];
    const snap = [...effects];
    applyStatusEffects(effects, defaultAttrs, T(1));
    expect(effects).toEqual(snap);
  });
});

// ============================================================
// 4b. applyStatusEffects — positive counters
// ============================================================

describe('applyStatusEffects — positive counters', () => {
  it('精神饱满 auto-removes 疲惫', () => {
    const effects = [
      mkEffect('精神饱满', T(0), T(3)),
      mkEffect('疲惫', T(0), null),
    ];
    const result = applyStatusEffects(effects, defaultAttrs, T(1));
    expect(result.removedEffects).toContain('疲惫');
    expect(result.activeEffects.map(e => e.id)).not.toContain('疲惫');
  });

  it('愉悦 auto-removes 沮丧', () => {
    const effects = [
      mkEffect('愉悦', T(0), null),
      mkEffect('沮丧', T(0), null),
    ];
    const result = applyStatusEffects(effects, defaultAttrs, T(1));
    expect(result.removedEffects).toContain('沮丧');
  });

  it('暖身 auto-removes 失温症', () => {
    const effects = [
      mkEffect('暖身', T(0), null),
      mkEffect('失温症', T(0), null),
    ];
    const result = applyStatusEffects(effects, defaultAttrs, T(1));
    expect(result.removedEffects).toContain('失温症');
  });

  it('no counter without the positive effect', () => {
    const effects = [mkEffect('疲惫', T(0), null)];
    const result = applyStatusEffects(effects, defaultAttrs, T(1));
    expect(result.removedEffects).toEqual([]);
  });
});

// ============================================================
// 4c. applyStatusEffects — combo: 中毒+疾病
// ============================================================

describe('applyStatusEffects — combo: 中毒+疾病', () => {
  it('adds extra -0.8/h health and stamina', () => {
    const effects = [
      mkEffect('中毒', T(0), T(3)),
      mkEffect('疾病', T(0), T(5)),
    ];
    const result = applyStatusEffects(effects, defaultAttrs, T(1));
    expect(result.attributeChanges['健康值']).toBeCloseTo(-1.5 + -0.8); // -2.3
    expect(result.attributeChanges['体力值']).toBeCloseTo(-1.5 + -0.8); // -2.3
  });
});

// ============================================================
// 4d. applyStatusEffects — 防护 halving
// ============================================================

describe('applyStatusEffects — 防护 halving', () => {
  it('halves negative damage and consumes 防护', () => {
    const effects = [
      mkEffect('防护', T(0), null),
      mkEffect('中毒', T(0), T(3)),
    ];
    const result = applyStatusEffects(effects, defaultAttrs, T(1));
    expect(result.attributeChanges['健康值']).toBeCloseTo(-1.5 * 0.5);
    expect(result.removedEffects).toContain('防护');
  });

  it('防护 consumed after first use', () => {
    const effects = [
      mkEffect('防护', T(0), null),
      mkEffect('中毒', T(0), T(3)),
      mkEffect('感染', T(0), T(5)),
    ];
    const result = applyStatusEffects(effects, defaultAttrs, T(1));
    // Only the first negative effect is halved
    expect(result.attributeChanges['健康值']).toBeCloseTo(-1.5 * 0.5 + -0.8);
    expect(result.removedEffects).toContain('防护');
  });
});

// ============================================================
// 5. addStatusEffect
// ============================================================

describe('addStatusEffect', () => {
  it('adds a new effect', () => {
    const result = addStatusEffect([], '中毒', T(0));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('中毒');
  });

  it('does not duplicate active effects', () => {
    const existing = [mkEffect('中毒', T(0), T(3))];
    const result = addStatusEffect(existing, '中毒', T(1));
    expect(result).toHaveLength(1);
  });

  it('allows re-adding expired effects', () => {
    const existing = [mkEffect('中毒', T(0), T(3))];
    const result = addStatusEffect(existing, '中毒', T(5));
    expect(result).toHaveLength(2);
  });

  it('does not mutate input', () => {
    const existing: StatusEffect[] = [];
    addStatusEffect(existing, '中毒', T(0));
    expect(existing).toEqual([]);
  });
});

// ============================================================
// 5b. addStatusEffect — 3+ negative rule
// ============================================================

describe('addStatusEffect — 3+ negative duration bonus', () => {
  it('extends all negative durations by 1h when 3+ negatives', () => {
    let effects: StatusEffect[] = [];
    effects = addStatusEffect(effects, '中毒', T(0));  // expires T(3)
    effects = addStatusEffect(effects, '感染', T(0));  // expires T(5)

    const beforePoison = effects.find(e => e.id === '中毒')!.expiresAt;
    const beforeInfection = effects.find(e => e.id === '感染')!.expiresAt;

    effects = addStatusEffect(effects, '疲惫', T(0));  // 3rd negative (null duration) → trigger

    const afterPoison = effects.find(e => e.id === '中毒')!.expiresAt;
    const afterInfection = effects.find(e => e.id === '感染')!.expiresAt;
    const afterExhaustion = effects.find(e => e.id === '疲惫')!.expiresAt;

    expect(afterPoison).toBe(beforePoison! + 60);
    expect(afterInfection).toBe(beforeInfection! + 60);
    // 疲惫 is null duration → not extended
    expect(afterExhaustion).toBeNull();
  });

  it('does NOT extend with only 2 negatives', () => {
    let effects: StatusEffect[] = [];
    effects = addStatusEffect(effects, '中毒', T(0));
    effects = addStatusEffect(effects, '感染', T(0));
    const poison = effects.find(e => e.id === '中毒')!;
    expect(poison.expiresAt).toBe(T(3)); // unchanged
  });

  it('positive effects do not count toward 3+ rule', () => {
    let effects: StatusEffect[] = [];
    effects = addStatusEffect(effects, '饱腹', T(0));  // positive, null dur
    effects = addStatusEffect(effects, '清爽', T(0));   // positive, null dur
    effects = addStatusEffect(effects, '中毒', T(0));   // only 1 negative
    const poison = effects.find(e => e.id === '中毒')!;
    expect(poison.expiresAt).toBe(T(3)); // no bonus
  });
});

// ============================================================
// 6. removeStatusEffect
// ============================================================

describe('removeStatusEffect', () => {
  it('removes effect by id', () => {
    const effects = [
      mkEffect('中毒', T(0), T(3)),
      mkEffect('感染', T(0), T(5)),
    ];
    const result = removeStatusEffect(effects, '中毒');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('感染');
  });

  it('no-op if id not found', () => {
    const effects = [mkEffect('中毒', T(0), T(3))];
    const result = removeStatusEffect(effects, '感染');
    expect(result).toHaveLength(1);
  });

  it('does not mutate input', () => {
    const effects: StatusEffect[] = [mkEffect('中毒', T(0), T(3))];
    removeStatusEffect(effects, '中毒');
    expect(effects).toHaveLength(1);
  });
});

// ============================================================
// 7. checkPositiveNegatives
// ============================================================

describe('checkPositiveNegatives', () => {
  it('detects 精神饱满→疲惫 counter', () => {
    const effects = [
      mkEffect('精神饱满', T(0), T(3)),
      mkEffect('疲惫', T(0), null),
    ];
    const result = checkPositiveNegatives(effects, T(1));
    expect(result.removedEffects).toContain('疲惫');
    expect(result.comboEffects).toContain('精神饱满→疲惫自动解除');
  });

  it('detects 愉悦→沮丧 counter', () => {
    const effects = [
      mkEffect('愉悦', T(0), null),
      mkEffect('沮丧', T(0), null),
    ];
    const result = checkPositiveNegatives(effects, T(1));
    expect(result.removedEffects).toContain('沮丧');
  });

  it('detects 暖身→失温症 counter', () => {
    const effects = [
      mkEffect('暖身', T(0), null),
      mkEffect('失温症', T(0), null),
    ];
    const result = checkPositiveNegatives(effects, T(1));
    expect(result.removedEffects).toContain('失温症');
  });

  it('detects 3+ negative rule', () => {
    const effects = [
      mkEffect('中毒', T(0), T(3)),
      mkEffect('感染', T(0), T(5)),
      mkEffect('湿身', T(0), T(2)),
    ];
    const result = checkPositiveNegatives(effects, T(1));
    expect(result.durationBonuses.size).toBe(3);
    expect(result.durationBonuses.get('中毒')).toBe(60);
    expect(result.comboEffects).toContain('3+负面状态:所有持续时间+1h');
  });

  it('detects 中毒+感染 combo', () => {
    const effects = [
      mkEffect('中毒', T(0), T(3)),
      mkEffect('感染', T(0), T(5)),
    ];
    const result = checkPositiveNegatives(effects, T(1));
    expect(result.comboEffects).toContain('中毒+感染:健康-2.3/h');
  });

  it('detects 中毒+疾病 combo', () => {
    const effects = [
      mkEffect('中毒', T(0), T(3)),
      mkEffect('疾病', T(0), T(5)),
    ];
    const result = checkPositiveNegatives(effects, T(1));
    expect(result.comboEffects).toContain('中毒+疾病:健康-2.3/h,体力额外-0.8/h');
  });

  it('detects 疲惫+沮丧 combo', () => {
    const effects = [
      mkEffect('疲惫', T(0), null),
      mkEffect('沮丧', T(0), null),
    ];
    const result = checkPositiveNegatives(effects, T(1));
    expect(result.comboEffects).toContain('疲惫+沮丧:行动力-50%');
  });

  it('no combos with single effect', () => {
    const effects = [mkEffect('中毒', T(0), T(3))];
    const result = checkPositiveNegatives(effects, T(1));
    expect(result.removedEffects).toEqual([]);
    expect(result.durationBonuses.size).toBe(0);
    expect(result.comboEffects).toEqual([]);
  });

  it('empty effects returns empty result', () => {
    const result = checkPositiveNegatives([], T(0));
    expect(result.removedEffects).toEqual([]);
    expect(result.comboEffects).toEqual([]);
  });
});

// ============================================================
// 8. getStatusModifiers
// ============================================================

describe('getStatusModifiers', () => {
  it('returns zeroed modifiers with no effects', () => {
    const mods = getStatusModifiers([], T(0));
    expect(mods.healthPerHour).toBe(0);
    expect(mods.staminaPerHour).toBe(0);
    expect(mods.preventsMoving).toBe(false);
    expect(mods.preventsCombat).toBe(false);
    expect(mods.coldImmunity).toBe(false);
  });

  it('中毒 contributes healthPerHour=-1.5', () => {
    const effects = [mkEffect('中毒', T(0), T(3))];
    const mods = getStatusModifiers(effects, T(1));
    expect(mods.healthPerHour).toBeCloseTo(-1.5);
  });

  it('疲惫 doubles energy consumption', () => {
    const effects = [mkEffect('疲惫', T(0), null)];
    const mods = getStatusModifiers(effects, T(1));
    expect(mods.energyConsumptionMultiplier).toBe(2);
    expect(mods.actionPowerReduction).toBeCloseTo(0.3);
  });

  it('精神饱满 reduces stamina consumption by 50%', () => {
    const effects = [mkEffect('精神饱满', T(0), T(3))];
    const mods = getStatusModifiers(effects, T(1));
    expect(mods.staminaConsumptionReduction).toBeCloseTo(0.5);
  });

  it('迷路 prevents moving', () => {
    const effects = [mkEffect('迷路', T(0), T(1))];
    const mods = getStatusModifiers(effects, T(0.5));
    expect(mods.preventsMoving).toBe(true);
    expect(mods.staminaPerHour).toBeCloseTo(-10);
  });

  it('蛇毒 prevents action', () => {
    const effects = [mkEffect('蛇毒', T(0), T(3))];
    const mods = getStatusModifiers(effects, T(1));
    expect(mods.preventsAction).toBe(true);
    expect(mods.healthPerHour).toBeCloseTo(-2);
  });

  it('失温症 + 中暑 prevent combat', () => {
    const effects = [
      mkEffect('失温症', T(0), null),
    ];
    const mods = getStatusModifiers(effects, T(1));
    expect(mods.preventsCombat).toBe(true);
    expect(mods.actionPowerReduction).toBeCloseTo(0.5);
  });

  it('暖身 provides cold immunity', () => {
    const effects = [mkEffect('暖身', T(0), null)];
    const mods = getStatusModifiers(effects, T(1));
    expect(mods.coldImmunity).toBe(true);
    expect(mods.temperaturePerHour).toBeCloseTo(0.5);
  });

  it('清爽 provides infection resistance', () => {
    const effects = [mkEffect('清爽', T(0), null)];
    const mods = getStatusModifiers(effects, T(1));
    expect(mods.infectionResistance).toBeCloseTo(0.2);
    expect(mods.moodPerHour).toBeCloseTo(0.5);
  });

  it('愉悦 reduces consumption and danger', () => {
    const effects = [mkEffect('愉悦', T(0), null)];
    const mods = getStatusModifiers(effects, T(1));
    expect(mods.consumptionReduction).toBeCloseTo(0.2);
    expect(mods.dangerReduction).toBeCloseTo(0.05);
  });

  it('专注 halves crafting energy', () => {
    const effects = [mkEffect('专注', T(0), null)];
    const mods = getStatusModifiers(effects, T(1));
    expect(mods.craftingEnergyReduction).toBeCloseTo(0.5);
  });

  it('探索者之眼 enables hidden discovery', () => {
    const effects = [mkEffect('探索者之眼', T(0), null)];
    const mods = getStatusModifiers(effects, T(1));
    expect(mods.hiddenResourceDiscovery).toBe(true);
  });

  it('沮丧 blocks mood recovery', () => {
    const effects = [mkEffect('沮丧', T(0), null)];
    const mods = getStatusModifiers(effects, T(1));
    expect(mods.moodRecoveryBlocked).toBe(true);
    expect(mods.productionReduction).toBeCloseTo(0.2);
  });

  it('饮食单调 blocks mood recovery and reduces efficiency', () => {
    const effects = [mkEffect('饮食单调', T(0), null)];
    const mods = getStatusModifiers(effects, T(1));
    expect(mods.moodRecoveryBlocked).toBe(true);
    expect(mods.actionPowerReduction).toBeCloseTo(0.1);
  });

  it('灼伤 reduces stamina max', () => {
    const effects = [mkEffect('灼伤', T(0), T(2))];
    const mods = getStatusModifiers(effects, T(1));
    expect(mods.staminaMaxReduction).toBe(20);
    expect(mods.healthPerHour).toBeCloseTo(-1.2);
  });

  it('skips expired effects', () => {
    const effects = [mkEffect('中毒', T(0), T(3))];
    const mods = getStatusModifiers(effects, T(5));
    expect(mods.healthPerHour).toBe(0);
  });
});

// ============================================================
// 8b. getStatusModifiers — combo effects
// ============================================================

describe('getStatusModifiers — combo overrides', () => {
  it('疲惫+沮丧 overrides actionPowerReduction to 50%', () => {
    const effects = [
      mkEffect('疲惫', T(0), null),   // 0.3
      mkEffect('沮丧', T(0), null),   // 0
    ];
    const mods = getStatusModifiers(effects, T(1));
    expect(mods.actionPowerReduction).toBeCloseTo(0.5);
  });

  it('中毒+疾病 adds extra -0.8/h health and stamina', () => {
    const effects = [
      mkEffect('中毒', T(0), T(3)),   // health -1.5
      mkEffect('疾病', T(0), T(5)),   // stamina -1.5
    ];
    const mods = getStatusModifiers(effects, T(1));
    expect(mods.healthPerHour).toBeCloseTo(-1.5 + -0.8); // -2.3
    expect(mods.staminaPerHour).toBeCloseTo(-1.5 + -0.8); // -2.3
  });

  it('multiple negative effects stack', () => {
    const effects = [
      mkEffect('中毒', T(0), T(3)),
      mkEffect('感染', T(0), T(5)),
      mkEffect('湿身', T(0), T(2)),
    ];
    const mods = getStatusModifiers(effects, T(1));
    expect(mods.healthPerHour).toBeCloseTo(-1.5 + -0.8); // -2.3
    expect(mods.temperaturePerHour).toBeCloseTo(-0.5);
  });
});

// ============================================================
// Integration: full lifecycle
// ============================================================

describe('integration — full lifecycle', () => {
  it('add → apply → check → remove cycle', () => {
    let effects: StatusEffect[] = [];

    // Add 中毒
    effects = addStatusEffect(effects, '中毒', T(0));
    expect(effects).toHaveLength(1);

    // Apply effects
    const app1 = applyStatusEffects(effects, defaultAttrs, T(1));
    expect(app1.attributeChanges['健康值']).toBeCloseTo(-1.5);
    expect(app1.activeEffects).toHaveLength(1);

    // Check stacking
    const stacking = checkPositiveNegatives(effects, T(1));
    expect(stacking.removedEffects).toEqual([]);

    // Get modifiers
    const mods = getStatusModifiers(effects, T(1));
    expect(mods.healthPerHour).toBeCloseTo(-1.5);

    // Remove
    effects = removeStatusEffect(effects, '中毒');
    expect(effects).toHaveLength(0);
  });

  it('counter lifecycle: 精神饱满 removes 疲惫', () => {
    let effects: StatusEffect[] = [];
    effects = addStatusEffect(effects, '疲惫', T(0));
    expect(effects).toHaveLength(1);

    effects = addStatusEffect(effects, '精神饱满', T(0));
    expect(effects).toHaveLength(2);

    const result = applyStatusEffects(effects, defaultAttrs, T(1));
    expect(result.removedEffects).toContain('疲惫');
    expect(result.activeEffects.map(e => e.id)).not.toContain('疲惫');
  });

  it('防护 consumption lifecycle', () => {
    let effects: StatusEffect[] = [];
    effects = addStatusEffect(effects, '防护', T(0));

    // Apply with negative effect — 防护 should halve and consume
    effects = addStatusEffect(effects, '中毒', T(0));
    const result = applyStatusEffects(effects, defaultAttrs, T(1));
    expect(result.attributeChanges['健康值']).toBeCloseTo(-1.5 * 0.5);
    expect(result.removedEffects).toContain('防护');

    // After 防护 consumed, next apply should be full damage
    effects = result.activeEffects;
    const result2 = applyStatusEffects(effects, defaultAttrs, T(2));
    expect(result2.attributeChanges['健康值']).toBeCloseTo(-1.5);
  });

  it('3+ negative triggers duration extension', () => {
    let effects: StatusEffect[] = [];
    effects = addStatusEffect(effects, '中毒', T(0));
    effects = addStatusEffect(effects, '感染', T(0));

    // 2 negatives — no extension yet
    const e2 = effects.find(e => e.id === '中毒')!;
    expect(e2.expiresAt).toBe(T(3));

    // 3rd negative — triggers extension
    effects = addStatusEffect(effects, '灼伤', T(0));
    const e3 = effects.find(e => e.id === '中毒')!;
    expect(e3.expiresAt).toBe(T(3) + 60); // extended by 1h
  });
});

// ============================================================
// Edge cases
// ============================================================

describe('edge cases', () => {
  it('addStatusEffect at exact expiry time re-adds', () => {
    const effects = [mkEffect('中毒', T(0), T(3))];
    // At T(3), the effect is expired (expiresAt is exclusive)
    const result = addStatusEffect(effects, '中毒', T(3));
    expect(result).toHaveLength(2);
  });

  it('applyStatusEffects with all expired returns empty', () => {
    const effects = [
      mkEffect('中毒', T(0), T(1)),
      mkEffect('感染', T(0), T(1)),
    ];
    const result = applyStatusEffects(effects, defaultAttrs, T(5));
    expect(result.attributeChanges).toEqual({});
    expect(result.activeEffects).toEqual([]);
  });

  it('getStatusModifiers with all expired returns zeroes', () => {
    const effects = [
      mkEffect('中毒', T(0), T(1)),
      mkEffect('疲惫', T(0), T(1)),
    ];
    const mods = getStatusModifiers(effects, T(5));
    expect(mods.healthPerHour).toBe(0);
    expect(mods.energyConsumptionMultiplier).toBe(1);
  });

  it('multiple same-type positive effects do not stack', () => {
    let effects: StatusEffect[] = [];
    effects = addStatusEffect(effects, '饱腹', T(0));
    effects = addStatusEffect(effects, '饱腹', T(1));
    expect(effects).toHaveLength(1);
  });

  it('applyStatusEffects with multiple positives and negatives', () => {
    const effects = [
      mkEffect('中毒', T(0), T(3)),
      mkEffect('感染', T(0), T(5)),
      mkEffect('饱腹', T(0), null),
      mkEffect('清爽', T(0), null),
    ];
    const result = applyStatusEffects(effects, defaultAttrs, T(1));
    // Negative damage
    expect(result.attributeChanges['健康值']).toBeCloseTo(-1.5 + -0.8);
    // Positive recovery
    expect(result.attributeChanges['体力值']).toBeCloseTo(0.8);
    expect(result.attributeChanges['心情']).toBeCloseTo(0.5);
  });

  it('checkPositiveNegatives handles simultaneous counter + combo', () => {
    const effects = [
      mkEffect('精神饱满', T(0), T(3)),
      mkEffect('疲惫', T(0), null),
      mkEffect('沮丧', T(0), null),
      mkEffect('中毒', T(0), T(3)),
      mkEffect('感染', T(0), T(5)),
    ];
    const result = checkPositiveNegatives(effects, T(1));
    expect(result.removedEffects).toContain('疲惫');
    expect(result.comboEffects).toContain('精神饱满→疲惫自动解除');
    expect(result.comboEffects).toContain('中毒+感染:健康-2.3/h');
    // After 疲惫 removed: 沮丧+中毒+感染 = 3 negatives → 3+ rule triggers
    // 沮丧 has null duration so only 中毒 and 感染 get bonuses
    expect(result.durationBonuses.size).toBe(2);
  });
});
