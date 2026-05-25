import { describe, it, expect } from 'vitest';
import {
  getEnvironmentTemperature,
  getEnvironmentTemperatureByZone,
  calculateTemperatureChange,
  applyTemperatureModifiers,
  getPerHourModifier,
  processTemperature,
  ZONE_TERRAIN_MAP,
  NIGHT_PENALTY,
  FIRE_WARMING_PER_HOUR,
  CLOTHING_BONUS,
  WET_PENALTY_PER_HOUR,
  HOT_SPRING_WARMING_PER_HOUR,
  CONVERGENCE_RATE,
  HYPOTHERMIA_THRESHOLD,
  HEATSTROKE_THRESHOLD,
} from '../temperature';
import type { TerrainId } from '../temperature';
import type { ZoneId, WeatherId } from '@data/types';
import type { Attributes } from '../attributes';
import { DEFAULT_ATTRIBUTES } from '../attributes';

// ============================================================
// Helpers
// ============================================================

const defaultAttributes = (bodyTemp?: number): Attributes => ({
  ...DEFAULT_ATTRIBUTES,
  ...(bodyTemp !== undefined ? { '体温': bodyTemp } : {}),
});

const TERRAINS: TerrainId[] = ['海滩', '丛林', '山地', '沼泽', '浅海', '遗迹'];
const WEATHERS: WeatherId[] = ['晴', '阴', '雨', '暴雨', '大雾', '酷热'];
const ZONES: ZoneId[] = ['A', 'B', 'C', 'D', 'E', 'F'];

// Expected matrix values from design doc
const EXPECTED_MATRIX: Record<TerrainId, Record<WeatherId, number>> = {
  '海滩': { '晴': 1, '阴': 0, '雨': -2, '暴雨': -4, '大雾': -2, '酷热': 5 },
  '丛林': { '晴': 1, '阴': 0, '雨': -1, '暴雨': -3, '大雾': -1, '酷热': 3 },
  '山地': { '晴': 0, '阴': -2, '雨': -3, '暴雨': -5, '大雾': -3, '酷热': 5 },
  '沼泽': { '晴': 1, '阴': 0, '雨': -2, '暴雨': -4, '大雾': -2, '酷热': 4 },
  '浅海': { '晴': 1, '阴': 0, '雨': -2, '暴雨': -4, '大雾': -2, '酷热': 3 },
  '遗迹': { '晴': -2, '阴': -3, '雨': -3, '暴雨': -4, '大雾': -3, '酷热': 1 },
};

// ============================================================
// Zone → Terrain Mapping
// ============================================================

describe('ZONE_TERRAIN_MAP', () => {
  it('maps all 6 zones to correct terrains', () => {
    expect(ZONE_TERRAIN_MAP['A']).toBe('海滩');
    expect(ZONE_TERRAIN_MAP['B']).toBe('丛林');
    expect(ZONE_TERRAIN_MAP['C']).toBe('山地');
    expect(ZONE_TERRAIN_MAP['D']).toBe('沼泽');
    expect(ZONE_TERRAIN_MAP['E']).toBe('浅海');
    expect(ZONE_TERRAIN_MAP['F']).toBe('遗迹');
  });
});

// ============================================================
// 1. getEnvironmentTemperature — Full 6×6 Matrix
// ============================================================

describe('getEnvironmentTemperature', () => {
  // Test every terrain×weather combination
  for (const terrain of TERRAINS) {
    for (const weather of WEATHERS) {
      it(`${terrain} + ${weather} = ${EXPECTED_MATRIX[terrain][weather]}`, () => {
        expect(getEnvironmentTemperature(terrain, weather, false)).toBe(
          EXPECTED_MATRIX[terrain][weather],
        );
      });
    }
  }

  it('遗迹 is cold for all weathers except 酷热', () => {
    const coldWeathers: WeatherId[] = ['晴', '阴', '雨', '暴雨', '大雾'];
    for (const weather of coldWeathers) {
      expect(getEnvironmentTemperature('遗迹', weather, false)).toBeLessThan(0);
    }
    expect(getEnvironmentTemperature('遗迹', '酷热', false)).toBeLessThanOrEqual(1);
  });

  it('酷热 gives highest values for all terrains', () => {
    for (const terrain of TERRAINS) {
      const hotValue = getEnvironmentTemperature(terrain, '酷热', false);
      for (const weather of WEATHERS) {
        if (weather !== '酷热') {
          expect(hotValue).toBeGreaterThanOrEqual(
            getEnvironmentTemperature(terrain, weather, false),
          );
        }
      }
    }
  });

  it('暴雨 gives lowest values for most terrains', () => {
    for (const terrain of TERRAINS) {
      const stormValue = getEnvironmentTemperature(terrain, '暴雨', false);
      for (const weather of WEATHERS) {
        expect(stormValue).toBeLessThanOrEqual(
          getEnvironmentTemperature(terrain, weather, false),
        );
      }
    }
  });
});

// ============================================================
// getEnvironmentTemperatureByZone — Zone overload
// ============================================================

describe('getEnvironmentTemperatureByZone', () => {
  for (let i = 0; i < ZONES.length; i++) {
    const zone = ZONES[i];
    const terrain = TERRAINS[i];
    for (const weather of WEATHERS) {
      it(`Zone ${zone} (${terrain}) + ${weather} matches terrain function`, () => {
        expect(getEnvironmentTemperatureByZone(zone, weather, false)).toBe(
          getEnvironmentTemperature(terrain, weather, false),
        );
      });
    }
  }
});

// ============================================================
// Night Modifier
// ============================================================

describe('Night modifier', () => {
  for (const terrain of TERRAINS) {
    for (const weather of WEATHERS) {
      it(`${terrain} + ${weather} + night = base + ${NIGHT_PENALTY}`, () => {
        const dayValue = getEnvironmentTemperature(terrain, weather, false);
        const nightValue = getEnvironmentTemperature(terrain, weather, true);
        expect(nightValue).toBe(dayValue + NIGHT_PENALTY);
      });
    }
  }

  it('night penalty is -2 for all terrains', () => {
    expect(NIGHT_PENALTY).toBe(-2);
  });

  it('遗迹 + 暴雨 + night = -4 + (-2) = -6 (coldest possible)', () => {
    expect(getEnvironmentTemperature('遗迹', '暴雨', true)).toBe(-6);
  });

  it('海滩 + 酷热 + night = 5 + (-2) = 3', () => {
    expect(getEnvironmentTemperature('海滩', '酷热', true)).toBe(3);
  });
});

// ============================================================
// 2. calculateTemperatureChange — Convergence
// ============================================================

describe('calculateTemperatureChange', () => {
  it('converges upward at ±0.5/h rate', () => {
    // Current=40, target=60, 1 hour → 40 + 0.5 = 40.5
    expect(calculateTemperatureChange(40, 60, 60)).toBe(40.5);
  });

  it('converges downward at ±0.5/h rate', () => {
    // Current=80, target=60, 1 hour → 80 - 0.5 = 79.5
    expect(calculateTemperatureChange(80, 60, 60)).toBe(79.5);
  });

  it('clamps to target when close enough', () => {
    // Current=59.8, target=60, 1 hour → max change = 0.5, so 59.8 + 0.5 = 60.3
    // But should clamp to 60
    expect(calculateTemperatureChange(59.8, 60, 60)).toBe(60);
  });

  it('clamps to target when overshooting', () => {
    // Current=59, target=60, 60 min → 59 + 0.5 = 59.5 (not clamped yet)
    expect(calculateTemperatureChange(59, 60, 60)).toBe(59.5);
    // But 240 min → 59 + 2 = 61, should clamp to 60
    expect(calculateTemperatureChange(59, 60, 240)).toBe(60);
  });

  it('returns current when already at target', () => {
    expect(calculateTemperatureChange(60, 60, 60)).toBe(60);
  });

  it('scales rate by deltaMinutes', () => {
    // 30 min → 0.25 change
    expect(calculateTemperatureChange(40, 60, 30)).toBe(40.25);
    // 120 min → 1.0 change
    expect(calculateTemperatureChange(40, 60, 120)).toBe(41);
  });

  it('handles 0 minutes', () => {
    expect(calculateTemperatureChange(50, 60, 0)).toBe(50);
  });

  it('convergence rate constant is 0.5', () => {
    expect(CONVERGENCE_RATE).toBe(0.5);
  });

  it('converges over many hours toward target', () => {
    let temp = 30;
    const target = 60;
    // 60 hours of convergence: 30 + 30*0.5 = 45? No, it converges
    for (let i = 0; i < 60; i++) {
      temp = calculateTemperatureChange(temp, target, 60);
    }
    // After 60 hours at 0.5/h, 30 + 30 = 60
    expect(temp).toBe(60);
  });
});

// ============================================================
// 3. applyTemperatureModifiers — Clothing bonus
// ============================================================

describe('applyTemperatureModifiers', () => {
  it('no modifiers returns base unchanged', () => {
    expect(
      applyTemperatureModifiers(5, { nearFire: false, clothing: null, isWet: false }),
    ).toBe(5);
  });

  it('布料 clothing adds +2', () => {
    expect(
      applyTemperatureModifiers(0, { nearFire: false, clothing: '布料', isWet: false }),
    ).toBe(2);
  });

  it('皮革 clothing adds +5', () => {
    expect(
      applyTemperatureModifiers(0, { nearFire: false, clothing: '皮革', isWet: false }),
    ).toBe(5);
  });

  it('clothing bonus is constant, not per-hour', () => {
    // Should affect environment temperature directly
    const base = 0;
    const withCloth = applyTemperatureModifiers(base, {
      nearFire: false,
      clothing: '布料',
      isWet: false,
    });
    expect(withCloth).toBe(base + CLOTHING_BONUS['布料']);
  });

  it('布料 bonus is +2', () => {
    expect(CLOTHING_BONUS['布料']).toBe(2);
  });

  it('皮革 bonus is +5', () => {
    expect(CLOTHING_BONUS['皮革']).toBe(5);
  });
});

// ============================================================
// getPerHourModifier — Fire, wet, hot spring
// ============================================================

describe('getPerHourModifier', () => {
  it('no modifiers returns 0', () => {
    expect(
      getPerHourModifier({ nearFire: false, clothing: null, isWet: false }),
    ).toBe(0);
  });

  it('campfire adds +10/h', () => {
    expect(
      getPerHourModifier({ nearFire: true, clothing: null, isWet: false }),
    ).toBe(FIRE_WARMING_PER_HOUR);
  });

  it('wet status adds -3/h', () => {
    expect(
      getPerHourModifier({ nearFire: false, clothing: null, isWet: true }),
    ).toBe(WET_PENALTY_PER_HOUR);
  });

  it('hot spring adds +15/h', () => {
    expect(
      getPerHourModifier({
        nearFire: false,
        clothing: null,
        isWet: false,
        nearHotSpring: true,
      }),
    ).toBe(HOT_SPRING_WARMING_PER_HOUR);
  });

  it('campfire + hot spring = +25/h', () => {
    expect(
      getPerHourModifier({
        nearFire: true,
        clothing: null,
        isWet: false,
        nearHotSpring: true,
      }),
    ).toBe(FIRE_WARMING_PER_HOUR + HOT_SPRING_WARMING_PER_HOUR);
  });

  it('campfire + wet = +10 - 3 = +7/h', () => {
    expect(
      getPerHourModifier({ nearFire: true, clothing: null, isWet: true }),
    ).toBe(FIRE_WARMING_PER_HOUR + WET_PENALTY_PER_HOUR);
  });

  it('campfire warming is +10/h', () => {
    expect(FIRE_WARMING_PER_HOUR).toBe(10);
  });

  it('wet penalty is -3/h', () => {
    expect(WET_PENALTY_PER_HOUR).toBe(-3);
  });

  it('hot spring warming is +15/h', () => {
    expect(HOT_SPRING_WARMING_PER_HOUR).toBe(15);
  });
});

// ============================================================
// 4. processTemperature — Full Pipeline
// ============================================================

describe('processTemperature', () => {
  it('converges body temp toward environment temp over time', () => {
    const attrs = defaultAttributes(40);
    const result = processTemperature(
      attrs, 'A', '晴', false, false, null, false, 60,
    );
    expect(result.bodyTemperature).toBe(39.5);
    expect(result.environmentTemperature).toBe(1);
  });

  it('applies night penalty to environment temperature', () => {
    const attrs = defaultAttributes(60);
    const dayResult = processTemperature(
      attrs, 'A', '晴', false, false, null, false, 60,
    );
    const nightResult = processTemperature(
      attrs, 'A', '晴', true, false, null, false, 60,
    );
    expect(dayResult.environmentTemperature).toBe(1);
    expect(nightResult.environmentTemperature).toBe(-1);
  });

  it('campfire adds per-hour warming to body temperature', () => {
    const attrs = defaultAttributes(50);
    const result = processTemperature(
      attrs, 'A', '晴', false, true, null, false, 60,
    );
    expect(result.bodyTemperature).toBeCloseTo(49.5 + 10, 5);
  });

  it('clothing adjusts environment temperature', () => {
    const attrs = defaultAttributes(60);
    const noCloth = processTemperature(
      attrs, 'A', '晴', false, false, null, false, 60,
    );
    const withCloth = processTemperature(
      attrs, 'A', '晴', false, false, '皮革', false, 60,
    );
    expect(noCloth.environmentTemperature).toBe(1);
    expect(withCloth.environmentTemperature).toBe(6);
  });

  it('wet status applies per-hour penalty', () => {
    const attrs = defaultAttributes(50);
    const result = processTemperature(
      attrs, 'A', '晴', false, false, null, true, 60,
    );
    expect(result.bodyTemperature).toBeCloseTo(49.5 - 3, 5);
  });

  it('clamps body temperature to [0, 100]', () => {
    const attrs = defaultAttributes(5);
    const result = processTemperature(
      attrs, 'F', '暴雨', true, false, null, true, 60,
    );
    expect(result.bodyTemperature).toBeGreaterThanOrEqual(0);

    const attrs2 = defaultAttributes(98);
    const result2 = processTemperature(
      attrs2, 'A', '酷热', false, true, null, false, 60,
    );
    expect(result2.bodyTemperature).toBeLessThanOrEqual(100);
  });

  it('returns all required fields', () => {
    const attrs = defaultAttributes(60);
    const result = processTemperature(
      attrs, 'A', '晴', false, false, null, false, 60,
    );
    expect(result).toHaveProperty('bodyTemperature');
    expect(result).toHaveProperty('environmentTemperature');
    expect(result).toHaveProperty('hasHypothermia');
    expect(result).toHaveProperty('hasHeatstroke');
  });

  it('processes with 0 minutes (no change)', () => {
    const attrs = defaultAttributes(60);
    const result = processTemperature(
      attrs, 'A', '晴', false, false, null, false, 0,
    );
    expect(result.bodyTemperature).toBe(60);
  });

  it('uses default body temp of 60 if 体温 missing', () => {
    const attrs = { ...DEFAULT_ATTRIBUTES };
    delete (attrs as Record<string, number>)['体温'];
    const result = processTemperature(
      attrs, 'A', '晴', false, false, null, false, 60,
    );
    expect(result.bodyTemperature).toBeLessThanOrEqual(60.5);
    expect(result.bodyTemperature).toBeGreaterThanOrEqual(59.5);
  });

  it('nearHotSpring adds per-hour warming', () => {
    const attrs = defaultAttributes(50);
    const result = processTemperature(
      attrs, 'A', '晴', false, false, null, false, 60, true,
    );
    expect(result.bodyTemperature).toBeCloseTo(49.5 + 15, 5);
  });
});

// ============================================================
// Hypothermia & Heatstroke Thresholds
// ============================================================

describe('Temperature thresholds', () => {
  it('hypothermia threshold is 20', () => {
    expect(HYPOTHERMIA_THRESHOLD).toBe(20);
  });

  it('heatstroke threshold is 91', () => {
    expect(HEATSTROKE_THRESHOLD).toBe(91);
  });

  it('hypothermia triggers when body temp ≤ 20', () => {
    const attrs = defaultAttributes(20);
    const result = processTemperature(
      attrs, 'F', '暴雨', true, false, null, false, 60,
    );
    expect(result.hasHypothermia).toBe(true);
  });

  it('hypothermia does not trigger when body temp > 20', () => {
    const attrs = defaultAttributes(25);
    const result = processTemperature(
      attrs, 'A', '晴', false, false, null, false, 60,
    );
    expect(result.hasHypothermia).toBe(false);
  });

  it('heatstroke triggers when body temp ≥ 91', () => {
    const attrs = defaultAttributes(92);
    const result = processTemperature(
      attrs, 'A', '酷热', false, true, null, false, 60,
    );
    expect(result.hasHeatstroke).toBe(true);
  });

  it('heatstroke does not trigger when body temp < 91', () => {
    const attrs = defaultAttributes(80);
    const result = processTemperature(
      attrs, 'A', '晴', false, false, null, false, 60,
    );
    expect(result.hasHeatstroke).toBe(false);
  });

  it('hypothermia at exactly 20 (≤)', () => {
    const attrs = defaultAttributes(20.5);
    const result = processTemperature(
      attrs, 'F', '暴雨', true, false, null, true, 60,
    );
    expect(result.hasHypothermia).toBe(true);
  });

  it('heatstroke at exactly 91 (≥)', () => {
    const attrs = defaultAttributes(91);
    const result = processTemperature(
      attrs, 'A', '酷热', false, false, null, false, 60,
    );
    expect(result.hasHeatstroke).toBe(false);

    const attrs2 = defaultAttributes(91.5);
    const result2 = processTemperature(
      attrs2, 'A', '酷热', false, true, null, false, 60,
    );
    expect(result2.hasHeatstroke).toBe(true);
  });
});

// ============================================================
// Combined Scenarios
// ============================================================

describe('Combined scenarios', () => {
  it('coldest scenario: 遗迹 + 暴雨 + night + wet, no fire', () => {
    const attrs = defaultAttributes(30);
    const result = processTemperature(
      attrs, 'F', '暴雨', true, false, null, true, 60,
    );
    expect(result.environmentTemperature).toBe(-6);
    expect(result.bodyTemperature).toBeCloseTo(26.5, 5);
  });

  it('warmest scenario: 海滩 + 酷热 + fire + leather + hot spring', () => {
    const attrs = defaultAttributes(70);
    const result = processTemperature(
      attrs, 'A', '酷热', false, true, '皮革', false, 60, true,
    );
    expect(result.environmentTemperature).toBe(10);
    expect(result.bodyTemperature).toBeCloseTo(94.5, 5);
    expect(result.hasHeatstroke).toBe(true);
  });

  it('campfire can counteract wet status', () => {
    const attrs = defaultAttributes(50);
    const result = processTemperature(
      attrs, 'A', '晴', false, true, null, true, 60,
    );
    expect(result.bodyTemperature).toBeCloseTo(56.5, 5);
  });

  it('皮革 armor raises environment temperature by 5', () => {
    const attrs = defaultAttributes(60);
    const noArmor = processTemperature(
      attrs, 'C', '暴雨', true, false, null, false, 60,
    );
    const withArmor = processTemperature(
      attrs, 'C', '暴雨', true, false, '皮革', false, 60,
    );
    expect(noArmor.environmentTemperature).toBe(-7);
    expect(withArmor.environmentTemperature).toBe(-2);
    expect(withArmor.environmentTemperature - noArmor.environmentTemperature).toBe(5);
  });

  it('all zone×weather combinations produce valid temperatures', () => {
    for (const zone of ZONES) {
      for (const weather of WEATHERS) {
        const attrs = defaultAttributes(60);
        const result = processTemperature(
          attrs, zone, weather, false, false, null, false, 60,
        );
        expect(typeof result.bodyTemperature).toBe('number');
        expect(isNaN(result.bodyTemperature)).toBe(false);
        expect(result.bodyTemperature).toBeGreaterThanOrEqual(0);
        expect(result.bodyTemperature).toBeLessThanOrEqual(100);
      }
    }
  });
});
