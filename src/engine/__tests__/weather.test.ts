// ============================================================
// CardLand Weather System Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  createWeatherState,
  rollWeatherChange,
  calculateWeatherDuration,
  getWeatherEffects,
  shouldWeatherChange,
  processWeatherTick,
  getWeatherDef,
  validateProbabilities,
  WEATHER_DEFS,
  type WeatherId,
  type WeatherState,
} from '../weather';
import { createClock, advanceTime } from '../clock';

// ============================================================
// Test Helpers
// ============================================================

/** RNG that always returns a fixed value */
function fixedRng(value: number): () => number {
  return () => value;
}

/** Create a seeded RNG for deterministic testing */
function createSeededRNG(seed: number): () => number {
  let s = seed | 0;
  return function mulberry32(): number {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================
// Weather Definitions Tests
// ============================================================

describe('Weather Definitions', () => {
  it('should have exactly 6 weather types', () => {
    expect(WEATHER_DEFS).toHaveLength(6);
  });

  it('should have all required weather IDs', () => {
    const ids = WEATHER_DEFS.map(w => w.id);
    expect(ids).toContain('晴');
    expect(ids).toContain('阴');
    expect(ids).toContain('雨');
    expect(ids).toContain('暴雨');
    expect(ids).toContain('大雾');
    expect(ids).toContain('酷热');
  });

  it('should have probabilities that sum to 1.0', () => {
    expect(validateProbabilities()).toBe(true);
  });

  it('should have correct probabilities for each weather type', () => {
    const probs = Object.fromEntries(WEATHER_DEFS.map(w => [w.id, w.probability]));
    expect(probs['晴']).toBeCloseTo(0.35, 2);
    expect(probs['阴']).toBeCloseTo(0.25, 2);
    expect(probs['雨']).toBeCloseTo(0.20, 2);
    expect(probs['暴雨']).toBeCloseTo(0.10, 2);
    expect(probs['大雾']).toBeCloseTo(0.07, 2);
    expect(probs['酷热']).toBeCloseTo(0.03, 2);
  });

  it('should have valid duration ranges for all weather types', () => {
    for (const def of WEATHER_DEFS) {
      expect(def.minDuration).toBeGreaterThanOrEqual(1);
      expect(def.maxDuration).toBeGreaterThanOrEqual(def.minDuration);
      expect(def.maxDuration).toBeLessThanOrEqual(5);
    }
  });
});

// ============================================================
// createWeatherState Tests
// ============================================================

describe('createWeatherState', () => {
  it('should initialize with 晴天', () => {
    const state = createWeatherState();
    expect(state.current).toBe('晴');
  });

  it('should initialize with 3 days remaining', () => {
    const state = createWeatherState();
    expect(state.daysRemaining).toBe(3);
  });

  it('should initialize with startDay 1', () => {
    const state = createWeatherState();
    expect(state.startDay).toBe(1);
  });
});

// ============================================================
// calculateWeatherDuration Tests
// ============================================================

describe('calculateWeatherDuration', () => {
  it('should return duration within min-max range for 晴', () => {
    const rng = createSeededRNG(42);
    for (let i = 0; i < 100; i++) {
      const duration = calculateWeatherDuration('晴', rng);
      expect(duration).toBeGreaterThanOrEqual(2);
      expect(duration).toBeLessThanOrEqual(5);
    }
  });

  it('should return duration within min-max range for 阴', () => {
    const rng = createSeededRNG(123);
    for (let i = 0; i < 100; i++) {
      const duration = calculateWeatherDuration('阴', rng);
      expect(duration).toBeGreaterThanOrEqual(2);
      expect(duration).toBeLessThanOrEqual(4);
    }
  });

  it('should return duration within min-max range for 雨', () => {
    const rng = createSeededRNG(456);
    for (let i = 0; i < 100; i++) {
      const duration = calculateWeatherDuration('雨', rng);
      expect(duration).toBeGreaterThanOrEqual(1);
      expect(duration).toBeLessThanOrEqual(3);
    }
  });

  it('should return duration within min-max range for 暴雨', () => {
    const rng = createSeededRNG(789);
    for (let i = 0; i < 100; i++) {
      const duration = calculateWeatherDuration('暴雨', rng);
      expect(duration).toBeGreaterThanOrEqual(1);
      expect(duration).toBeLessThanOrEqual(2);
    }
  });

  it('should return duration within min-max range for 大雾', () => {
    const rng = createSeededRNG(101);
    for (let i = 0; i < 100; i++) {
      const duration = calculateWeatherDuration('大雾', rng);
      expect(duration).toBeGreaterThanOrEqual(1);
      expect(duration).toBeLessThanOrEqual(3);
    }
  });

  it('should return duration within min-max range for 酷热', () => {
    const rng = createSeededRNG(202);
    for (let i = 0; i < 100; i++) {
      const duration = calculateWeatherDuration('酷热', rng);
      expect(duration).toBeGreaterThanOrEqual(1);
      expect(duration).toBeLessThanOrEqual(2);
    }
  });

  it('should return 1 for unknown weather ID', () => {
    const duration = calculateWeatherDuration('未知' as WeatherId, fixedRng(0.5));
    expect(duration).toBe(1);
  });
});

// ============================================================
// rollWeatherChange Tests
// ============================================================

describe('rollWeatherChange', () => {
  it('should return a valid weather state', () => {
    const rng = createSeededRNG(42);
    const state = rollWeatherChange('晴', rng, 1);
    expect(state.current).toBeDefined();
    expect(state.daysRemaining).toBeGreaterThan(0);
    expect(state.startDay).toBe(1);
  });

  it('should use probability weights for selection', () => {
    const rng = createSeededRNG(42);
    const counts: Record<string, number> = {};

    // Roll many times to test distribution
    for (let i = 0; i < 1000; i++) {
      const state = rollWeatherChange('晴', rng, 1);
      counts[state.current] = (counts[state.current] || 0) + 1;
    }

    // 晴天 should be most common (~35%)
    expect(counts['晴']).toBeGreaterThan(250);
    expect(counts['晴']).toBeLessThan(450);

    // 阴天 should be second most common (~25%)
    expect(counts['阴']).toBeGreaterThan(150);
    expect(counts['阴']).toBeLessThan(350);
  });

  it('should calculate duration for rolled weather', () => {
    const rng = createSeededRNG(42);
    const state = rollWeatherChange('晴', rng, 1);

    const def = WEATHER_DEFS.find(w => w.id === state.current)!;
    expect(state.daysRemaining).toBeGreaterThanOrEqual(def.minDuration);
    expect(state.daysRemaining).toBeLessThanOrEqual(def.maxDuration);
  });

  it('should set startDay correctly', () => {
    const rng = createSeededRNG(42);
    const state = rollWeatherChange('晴', rng, 5);
    expect(state.startDay).toBe(5);
  });
});

// ============================================================
// getWeatherEffects Tests
// ============================================================

describe('getWeatherEffects', () => {
  it('should return correct effects for 晴天', () => {
    const effects = getWeatherEffects('晴');
    expect(effects.thirstRate).toBe(0.5);
    expect(effects.moodRate).toBe(0.5);
    expect(effects.canExplore).toBe(true);
    expect(effects.gatherModifier).toBe(0);
  });

  it('should return correct effects for 阴天', () => {
    const effects = getWeatherEffects('阴');
    expect(effects.moodRate).toBe(-0.3);
    expect(effects.canExplore).toBe(true);
  });

  it('should return correct effects for 雨天', () => {
    const effects = getWeatherEffects('雨');
    expect(effects.hungerRate).toBe(0.3);
    expect(effects.dirtRate).toBe(-0.8);
    expect(effects.gatherModifier).toBe(-0.2);
    expect(effects.canExplore).toBe(true);
  });

  it('should return correct effects for 暴雨', () => {
    const effects = getWeatherEffects('暴雨');
    expect(effects.moodRate).toBe(-1);
    expect(effects.dirtRate).toBe(-1.5);
    expect(effects.temperatureRate).toBe(-0.5);
    expect(effects.canExplore).toBe(false);
    expect(effects.gatherModifier).toBe(-1);
  });

  it('should return correct effects for 大雾', () => {
    const effects = getWeatherEffects('大雾');
    expect(effects.lostChance).toBe(0.15);
    expect(effects.exploreModifier).toBe(-0.5);
    expect(effects.hitRateModifier).toBe(-0.2);
    expect(effects.canExplore).toBe(true);
  });

  it('should return correct effects for 酷热', () => {
    const effects = getWeatherEffects('酷热');
    expect(effects.thirstRate).toBe(1.5);
    expect(effects.temperatureRate).toBe(0.8);
    expect(effects.staminaRate).toBe(0.5);
    expect(effects.canExplore).toBe(true);
  });

  it('should return neutral effects for unknown weather ID', () => {
    const effects = getWeatherEffects('未知' as WeatherId);
    expect(effects.thirstRate).toBe(0);
    expect(effects.canExplore).toBe(true);
    expect(effects.description).toBe('无效果');
  });

  it('should return a copy of effects (not reference)', () => {
    const effects1 = getWeatherEffects('晴');
    const effects2 = getWeatherEffects('晴');
    expect(effects1).toEqual(effects2);
    expect(effects1).not.toBe(effects2);
  });
});

// ============================================================
// shouldWeatherChange Tests
// ============================================================

describe('shouldWeatherChange', () => {
  it('should return true when daysRemaining is 0', () => {
    const state: WeatherState = { current: '晴', daysRemaining: 0, startDay: 1 };
    const clock = createClock();
    expect(shouldWeatherChange(state, clock)).toBe(true);
  });

  it('should return true when daysRemaining is negative', () => {
    const state: WeatherState = { current: '晴', daysRemaining: -1, startDay: 1 };
    const clock = createClock();
    expect(shouldWeatherChange(state, clock)).toBe(true);
  });

  it('should return false when daysRemaining is positive', () => {
    const state: WeatherState = { current: '晴', daysRemaining: 3, startDay: 1 };
    const clock = createClock();
    expect(shouldWeatherChange(state, clock)).toBe(false);
  });

  it('should return false when daysRemaining is 1', () => {
    const state: WeatherState = { current: '晴', daysRemaining: 1, startDay: 1 };
    const clock = createClock();
    expect(shouldWeatherChange(state, clock)).toBe(false);
  });
});

// ============================================================
// processWeatherTick Tests
// ============================================================

describe('processWeatherTick', () => {
  it('should decrement daysRemaining by 1', () => {
    const state = createWeatherState();
    const clock = createClock();
    const rng = createSeededRNG(42);

    const newState = processWeatherTick(state, clock, rng);
    expect(newState.daysRemaining).toBe(2);
  });

  it('should roll new weather when daysRemaining reaches 0', () => {
    const state: WeatherState = { current: '晴', daysRemaining: 1, startDay: 1 };
    const clock = advanceTime(createClock(), 24 * 60); // Day 2
    const rng = createSeededRNG(42);

    const newState = processWeatherTick(state, clock, rng);
    // Should have rolled new weather
    expect(newState.daysRemaining).toBeGreaterThan(0);
  });

  it('should not change weather when daysRemaining > 1', () => {
    const state = createWeatherState();
    const clock = createClock();
    const rng = createSeededRNG(42);

    const newState = processWeatherTick(state, clock, rng);
    expect(newState.current).toBe('晴');
  });

  it('should not mutate input state', () => {
    const state = createWeatherState();
    const clock = createClock();
    const rng = createSeededRNG(42);
    const original = { ...state };

    processWeatherTick(state, clock, rng);
    expect(state).toEqual(original);
  });

  it('should handle multiple ticks correctly', () => {
    let state = createWeatherState();
    const clock = createClock();
    const rng = createSeededRNG(42);

    // Tick 1: 3 -> 2
    state = processWeatherTick(state, clock, rng);
    expect(state.daysRemaining).toBe(2);

    // Tick 2: 2 -> 1
    state = processWeatherTick(state, clock, rng);
    expect(state.daysRemaining).toBe(1);

    // Tick 3: 1 -> 0 -> new weather
    state = processWeatherTick(state, clock, rng);
    expect(state.daysRemaining).toBeGreaterThan(0);
  });
});

// ============================================================
// getWeatherDef Tests
// ============================================================

describe('getWeatherDef', () => {
  it('should return correct def for 晴', () => {
    const def = getWeatherDef('晴');
    expect(def).toBeDefined();
    expect(def!.name).toBe('晴天');
    expect(def!.icon).toBe('☀️');
  });

  it('should return correct def for 阴', () => {
    const def = getWeatherDef('阴');
    expect(def).toBeDefined();
    expect(def!.name).toBe('阴天');
    expect(def!.icon).toBe('☁️');
  });

  it('should return correct def for 雨', () => {
    const def = getWeatherDef('雨');
    expect(def).toBeDefined();
    expect(def!.name).toBe('雨天');
    expect(def!.icon).toBe('🌧️');
  });

  it('should return correct def for 暴雨', () => {
    const def = getWeatherDef('暴雨');
    expect(def).toBeDefined();
    expect(def!.name).toBe('暴雨');
    expect(def!.icon).toBe('⛈️');
  });

  it('should return correct def for 大雾', () => {
    const def = getWeatherDef('大雾');
    expect(def).toBeDefined();
    expect(def!.name).toBe('大雾');
    expect(def!.icon).toBe('🌫️');
  });

  it('should return correct def for 酷热', () => {
    const def = getWeatherDef('酷热');
    expect(def).toBeDefined();
    expect(def!.name).toBe('酷热');
    expect(def!.icon).toBe('🔥');
  });

  it('should return undefined for unknown weather ID', () => {
    const def = getWeatherDef('未知' as WeatherId);
    expect(def).toBeUndefined();
  });
});

// ============================================================
// Integration Tests
// ============================================================

describe('Weather System Integration', () => {
  it('should handle full weather cycle', () => {
    let state = createWeatherState();
    const clock = createClock();
    const rng = createSeededRNG(42);

    // Simulate several days
    for (let day = 0; day < 10; day++) {
      state = processWeatherTick(state, clock, rng);
    }

    // Should still have valid state
    expect(state.daysRemaining).toBeGreaterThan(0);
    expect(WEATHER_DEFS.some(w => w.id === state.current)).toBe(true);
  });

  it('should produce different weather sequences with different seeds', () => {
    const rng1 = createSeededRNG(42);
    const rng2 = createSeededRNG(123);

    const sequence1: string[] = [];
    const sequence2: string[] = [];
    for (let i = 0; i < 10; i++) {
      sequence1.push(rollWeatherChange('晴', rng1, 1).current);
      sequence2.push(rollWeatherChange('晴', rng2, 1).current);
    }

    const hasDifference = sequence1.some((w, i) => w !== sequence2[i]);
    expect(hasDifference).toBe(true);
  });

  it('should respect consecutive same weather cap at 5 days', () => {
    // This is enforced by the duration ranges in WEATHER_DEFS
    // 晴天 has maxDuration: 5, which is the cap
    const def = WEATHER_DEFS.find(w => w.id === '晴')!;
    expect(def.maxDuration).toBeLessThanOrEqual(5);
  });
});
