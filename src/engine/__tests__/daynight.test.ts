// ============================================================
// CardLand Day/Night Cycle Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  getTimeOfDay,
  getTimeOfDayEffects,
  isNight,
  getVisibility,
} from '../daynight';

// ============================================================
// getTimeOfDay
// ============================================================
describe('getTimeOfDay', () => {
  it('should return 清晨 for 05:00–06:59', () => {
    expect(getTimeOfDay(5)).toBe('清晨');
    expect(getTimeOfDay(6)).toBe('清晨');
  });

  it('should return 白天 for 07:00–16:59', () => {
    expect(getTimeOfDay(7)).toBe('白天');
    expect(getTimeOfDay(12)).toBe('白天');
    expect(getTimeOfDay(16)).toBe('白天');
  });

  it('should return 黄昏 for 17:00–18:59', () => {
    expect(getTimeOfDay(17)).toBe('黄昏');
    expect(getTimeOfDay(18)).toBe('黄昏');
  });

  it('should return 夜晚 for 19:00–04:59', () => {
    expect(getTimeOfDay(19)).toBe('夜晚');
    expect(getTimeOfDay(23)).toBe('夜晚');
    expect(getTimeOfDay(0)).toBe('夜晚');
    expect(getTimeOfDay(4)).toBe('夜晚');
  });

  it('should handle boundary transitions', () => {
    // 04:59 → 夜晚, 05:00 → 清晨
    expect(getTimeOfDay(4)).toBe('夜晚');
    expect(getTimeOfDay(5)).toBe('清晨');

    // 06:59 → 清晨, 07:00 → 白天
    expect(getTimeOfDay(6)).toBe('清晨');
    expect(getTimeOfDay(7)).toBe('白天');

    // 16:59 → 白天, 17:00 → 黄昏
    expect(getTimeOfDay(16)).toBe('白天');
    expect(getTimeOfDay(17)).toBe('黄昏');

    // 18:59 → 黄昏, 19:00 → 夜晚
    expect(getTimeOfDay(18)).toBe('黄昏');
    expect(getTimeOfDay(19)).toBe('夜晚');
  });

  it('should cover all 24 hours without gaps', () => {
    const periods = new Set<string>();
    for (let h = 0; h < 24; h++) {
      periods.add(getTimeOfDay(h));
    }
    expect(periods).toEqual(new Set(['清晨', '白天', '黄昏', '夜晚']));
  });
});

// ============================================================
// getTimeOfDayEffects
// ============================================================
describe('getTimeOfDayEffects', () => {
  it('should return dawn effects for 清晨', () => {
    const effects = getTimeOfDayEffects('清晨');
    expect(effects.staminaRecoveryBonus).toBe(0.2);
    expect(effects.gatherEfficiency).toBe(0.1);
    expect(effects.beastEncounterBonus).toBe(-0.3);
    expect(effects.hitChanceModifier).toBe(0);
    expect(effects.staminaConsumptionBonus).toBe(0);
    expect(effects.bodyTemperatureDrop).toBe(0);
    expect(effects.needsTorch).toBe(false);
  });

  it('should return neutral effects for 白天', () => {
    const effects = getTimeOfDayEffects('白天');
    expect(effects.staminaRecoveryBonus).toBe(0);
    expect(effects.gatherEfficiency).toBe(0);
    expect(effects.beastEncounterBonus).toBe(0);
    expect(effects.hitChanceModifier).toBe(0);
    expect(effects.staminaConsumptionBonus).toBe(0);
    expect(effects.bodyTemperatureDrop).toBe(0);
    expect(effects.needsTorch).toBe(false);
  });

  it('should return dusk effects for 黄昏', () => {
    const effects = getTimeOfDayEffects('黄昏');
    expect(effects.hitChanceModifier).toBe(-0.1);
    expect(effects.staminaConsumptionBonus).toBe(0.1);
    expect(effects.staminaRecoveryBonus).toBe(0);
    expect(effects.gatherEfficiency).toBe(0);
    expect(effects.beastEncounterBonus).toBe(0);
    expect(effects.bodyTemperatureDrop).toBe(0);
    expect(effects.needsTorch).toBe(false);
  });

  it('should return night effects for 夜晚', () => {
    const effects = getTimeOfDayEffects('夜晚');
    expect(effects.gatherEfficiency).toBe(-0.5);
    expect(effects.beastEncounterBonus).toBe(0.3);
    expect(effects.bodyTemperatureDrop).toBe(-0.3);
    expect(effects.needsTorch).toBe(true);
    expect(effects.staminaRecoveryBonus).toBe(0);
    expect(effects.hitChanceModifier).toBe(0);
    expect(effects.staminaConsumptionBonus).toBe(0);
  });

  it('should return all 7 fields for every time period', () => {
    const periods = ['清晨', '白天', '黄昏', '夜晚'] as const;
    const requiredKeys = [
      'staminaRecoveryBonus',
      'gatherEfficiency',
      'beastEncounterBonus',
      'hitChanceModifier',
      'staminaConsumptionBonus',
      'bodyTemperatureDrop',
      'needsTorch',
    ] as const;

    for (const tod of periods) {
      const effects = getTimeOfDayEffects(tod);
      for (const key of requiredKeys) {
        expect(effects).toHaveProperty(key);
      }
    }
  });
});

// ============================================================
// isNight
// ============================================================
describe('isNight', () => {
  it('should return true for 19:00–23:59', () => {
    expect(isNight(19)).toBe(true);
    expect(isNight(20)).toBe(true);
    expect(isNight(23)).toBe(true);
  });

  it('should return true for 00:00–04:59', () => {
    expect(isNight(0)).toBe(true);
    expect(isNight(1)).toBe(true);
    expect(isNight(4)).toBe(true);
  });

  it('should return false for 05:00–18:59', () => {
    expect(isNight(5)).toBe(false);
    expect(isNight(6)).toBe(false);
    expect(isNight(7)).toBe(false);
    expect(isNight(12)).toBe(false);
    expect(isNight(17)).toBe(false);
    expect(isNight(18)).toBe(false);
  });

  it('should agree with getTimeOfDay', () => {
    for (let h = 0; h < 24; h++) {
      expect(isNight(h)).toBe(getTimeOfDay(h) === '夜晚');
    }
  });
});

// ============================================================
// getVisibility
// ============================================================
describe('getVisibility', () => {
  it('should return 1.0 during 白天', () => {
    expect(getVisibility(7)).toBe(1.0);
    expect(getVisibility(12)).toBe(1.0);
    expect(getVisibility(16)).toBe(1.0);
  });

  it('should return 0.7 during 清晨', () => {
    expect(getVisibility(5)).toBe(0.7);
    expect(getVisibility(6)).toBe(0.7);
  });

  it('should return 0.6 during 黄昏', () => {
    expect(getVisibility(17)).toBe(0.6);
    expect(getVisibility(18)).toBe(0.6);
  });

  it('should return 0.2 during 夜晚', () => {
    expect(getVisibility(0)).toBe(0.2);
    expect(getVisibility(4)).toBe(0.2);
    expect(getVisibility(19)).toBe(0.2);
    expect(getVisibility(23)).toBe(0.2);
  });

  it('should always return a value between 0 and 1', () => {
    for (let h = 0; h < 24; h++) {
      const v = getVisibility(h);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('should have highest visibility during day and lowest at night', () => {
    expect(getVisibility(12)).toBeGreaterThan(getVisibility(6));  // day > dawn
    expect(getVisibility(6)).toBeGreaterThan(getVisibility(18));   // dawn > dusk
    expect(getVisibility(18)).toBeGreaterThan(getVisibility(22));  // dusk > night
  });
});

// ============================================================
// Integration — cross-function consistency
// ============================================================
describe('Integration', () => {
  it('isNight should match night effects requiring torch', () => {
    for (let h = 0; h < 24; h++) {
      const tod = getTimeOfDay(h);
      const effects = getTimeOfDayEffects(tod);
      if (isNight(h)) {
        expect(effects.needsTorch).toBe(true);
      } else {
        expect(effects.needsTorch).toBe(false);
      }
    }
  });

  it('night should have lowest visibility', () => {
    for (let h = 0; h < 24; h++) {
      if (isNight(h)) {
        expect(getVisibility(h)).toBe(0.2);
      }
    }
  });
});
