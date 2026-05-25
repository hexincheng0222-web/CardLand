// ============================================================
// CardLand Weather System — 6 Weather Types + Effects
// Pure functions for weather management
// ============================================================

import type { GameClock } from './clock';

// ============================================================
// Types
// ============================================================

export type WeatherId = '晴' | '阴' | '雨' | '暴雨' | '大雾' | '酷热';

export interface WeatherEffects {
  thirstRate: number;       // 口渴度/h (positive = more thirsty)
  hungerRate: number;       // 饱食度/h (positive = more hungry)
  staminaRate: number;      // 体力值/h (positive = drain)
  healthRate: number;       // 健康值/h (positive = drain)
  energyRate: number;       // 精力值/h (positive = drain)
  moodRate: number;         // 心情/h (positive = gain, negative = drain)
  dirtRate: number;         // 污垢/h (positive = more dirty, negative = cleaner)
  temperatureRate: number;  // 体温/h (positive = warmer, negative = cooler)
  gatherModifier: number;   // 采集产出修正 (0 = no change, -0.2 = -20%)
  exploreModifier: number;  // 探索修正 (0 = no change, -0.5 = -50%)
  hitRateModifier: number;  // 命中率修正 (0 = no change, -0.2 = -20%)
  lostChance: number;       // 迷路概率 (0 = no chance, 0.15 = 15%)
  canExplore: boolean;      // 是否可以探索
  description: string;      // 效果描述
}

export interface WeatherDef {
  id: WeatherId;
  name: string;
  icon: string;
  probability: number;      // 0-1, for weighted random selection
  minDuration: number;      // minimum duration in days
  maxDuration: number;      // maximum duration in days
  effects: WeatherEffects;
}

export interface WeatherState {
  current: WeatherId;
  daysRemaining: number;    // days until weather change
  startDay: number;         // day when this weather started
}

// ============================================================
// Weather Definitions (6 types from design doc)
// ============================================================

export const WEATHER_DEFS: readonly WeatherDef[] = [
  {
    id: '晴',
    name: '晴天',
    icon: '☀️',
    probability: 0.35,
    minDuration: 2,
    maxDuration: 5,
    effects: {
      thirstRate: 0.5,
      hungerRate: 0,
      staminaRate: 0,
      healthRate: 0,
      energyRate: 0,
      moodRate: 0.5,
      dirtRate: 0,
      temperatureRate: 0,  // 体温趋向温暖 (handled by linkage)
      gatherModifier: 0,
      exploreModifier: 0,
      hitRateModifier: 0,
      lostChance: 0,
      canExplore: true,
      description: '口渴+0.5/h, 体温趋向温暖, 心情+0.5/h',
    },
  },
  {
    id: '阴',
    name: '阴天',
    icon: '☁️',
    probability: 0.25,
    minDuration: 2,
    maxDuration: 4,
    effects: {
      thirstRate: 0,
      hungerRate: 0,
      staminaRate: 0,
      healthRate: 0,
      energyRate: 0,
      moodRate: -0.3,
      dirtRate: 0,
      temperatureRate: 0,
      gatherModifier: 0,
      exploreModifier: 0,
      hitRateModifier: 0,
      lostChance: 0,
      canExplore: true,
      description: '心情-0.3/h',
    },
  },
  {
    id: '雨',
    name: '雨天',
    icon: '🌧️',
    probability: 0.20,
    minDuration: 1,
    maxDuration: 3,
    effects: {
      thirstRate: 0,
      hungerRate: 0.3,
      staminaRate: 0,
      healthRate: 0,
      energyRate: 0,
      moodRate: 0,
      dirtRate: -0.8,
      temperatureRate: 0,
      gatherModifier: -0.2,
      exploreModifier: 0,
      hitRateModifier: 0,
      lostChance: 0,
      canExplore: true,
      description: '饱食+0.3/h, 污垢-0.8/h, 采集-20%',
    },
  },
  {
    id: '暴雨',
    name: '暴雨',
    icon: '⛈️',
    probability: 0.10,
    minDuration: 1,
    maxDuration: 2,
    effects: {
      thirstRate: 0,
      hungerRate: 0,
      staminaRate: 0,
      healthRate: 0,
      energyRate: 0,
      moodRate: -1,
      dirtRate: -1.5,
      temperatureRate: -0.5,
      gatherModifier: -1,    // 无法采集
      exploreModifier: -1,   // 无法探索
      hitRateModifier: 0,
      lostChance: 0,
      canExplore: false,
      description: '无法探索, 污垢-1.5/h, 体温-0.5/h, 心情-1/h',
    },
  },
  {
    id: '大雾',
    name: '大雾',
    icon: '🌫️',
    probability: 0.07,
    minDuration: 1,
    maxDuration: 3,
    effects: {
      thirstRate: 0,
      hungerRate: 0,
      staminaRate: 0,
      healthRate: 0,
      energyRate: 0,
      moodRate: 0,
      dirtRate: 0,
      temperatureRate: 0,
      gatherModifier: 0,
      exploreModifier: -0.5,
      hitRateModifier: -0.2,
      lostChance: 0.15,
      canExplore: true,
      description: '迷路+15%, 探索-50%, 命中-20%',
    },
  },
  {
    id: '酷热',
    name: '酷热',
    icon: '🔥',
    probability: 0.03,
    minDuration: 1,
    maxDuration: 2,
    effects: {
      thirstRate: 1.5,  // 口渴翻倍 (base 1.5 → 3.0 total)
      hungerRate: 0,
      staminaRate: 0.5,
      healthRate: 0,
      energyRate: 0,
      moodRate: 0,
      dirtRate: 0,
      temperatureRate: 0.8,
      gatherModifier: 0,
      exploreModifier: 0,
      hitRateModifier: 0,
      lostChance: 0,
      canExplore: true,
      description: '体温+0.8/h, 口渴翻倍, 体力+0.5/h',
    },
  },
] as const;

// Probability validation constant
const TOTAL_PROBABILITY = WEATHER_DEFS.reduce((sum, w) => sum + w.probability, 0);

// ============================================================
// 1. createWeatherState — Initialize weather
// ============================================================

/**
 * Create a new WeatherState starting with 晴天 (sunny) on day 1.
 * Default duration is 3 days.
 */
export function createWeatherState(): WeatherState {
  return {
    current: '晴',
    daysRemaining: 3,
    startDay: 1,
  };
}

// ============================================================
// 2. rollWeatherChange — Roll new weather (probability weighted)
// ============================================================

/**
 * Roll a new weather based on probability weights.
 * Uses weighted random selection from all 6 weather types.
 *
 * @param currentWeather - Current weather ID (to potentially avoid repeats)
 * @param rng - Random number generator returning [0, 1)
 * @returns New WeatherState with rolled weather
 */
export function rollWeatherChange(
  _currentWeather: WeatherId,
  rng: () => number,
  currentDay: number = 1,
): WeatherState {
  const roll = rng();
  let cumulative = 0;

  for (const def of WEATHER_DEFS) {
    cumulative += def.probability;
    if (roll < cumulative) {
      const duration = calculateWeatherDuration(def.id, rng);
      return {
        current: def.id,
        daysRemaining: duration,
        startDay: currentDay,
      };
    }
  }

  // Fallback to 晴天 (should not happen if probabilities sum to 1.0)
  const duration = calculateWeatherDuration('晴', rng);
  return {
    current: '晴',
    daysRemaining: duration,
    startDay: currentDay,
  };
}

// ============================================================
// 3. calculateWeatherDuration — Days 1-5
// ============================================================

/**
 * Calculate weather duration in days based on weather type.
 * Duration ranges from minDuration to maxDuration (inclusive).
 *
 * @param weatherId - Weather type to calculate duration for
 * @param rng - Random number generator returning [0, 1)
 * @returns Duration in days (integer)
 */
export function calculateWeatherDuration(weatherId: WeatherId, rng: () => number): number {
  const def = WEATHER_DEFS.find(w => w.id === weatherId);
  if (!def) return 1;

  const range = def.maxDuration - def.minDuration + 1;
  return def.minDuration + Math.floor(rng() * range);
}

// ============================================================
// 4. getWeatherEffects — All effects for a weather type
// ============================================================

/**
 * Get the effects for a specific weather type.
 *
 * @param weatherId - Weather type to get effects for
 * @returns WeatherEffects object with all modifiers
 */
export function getWeatherEffects(weatherId: WeatherId): WeatherEffects {
  const def = WEATHER_DEFS.find(w => w.id === weatherId);
  if (!def) {
    // Return neutral effects if weather not found
    return {
      thirstRate: 0,
      hungerRate: 0,
      staminaRate: 0,
      healthRate: 0,
      energyRate: 0,
      moodRate: 0,
      dirtRate: 0,
      temperatureRate: 0,
      gatherModifier: 0,
      exploreModifier: 0,
      hitRateModifier: 0,
      lostChance: 0,
      canExplore: true,
      description: '无效果',
    };
  }
  return { ...def.effects };
}

// ============================================================
// 5. shouldWeatherChange — Check if weather duration expired
// ============================================================

/**
 * Check if the weather should change based on the current clock.
 * Weather changes when daysRemaining reaches 0.
 *
 * @param state - Current weather state
 * @param clock - Current game clock
 * @returns true if weather should change
 */
export function shouldWeatherChange(state: WeatherState, _clock: GameClock): boolean {
  return state.daysRemaining <= 0;
}

// ============================================================
// 6. processWeatherTick — Advance weather state
// ============================================================

/**
 * Process a weather tick (called once per day transition).
 * Decrements daysRemaining and rolls new weather if expired.
 *
 * @param state - Current weather state
 * @param clock - Current game clock
 * @param rng - Random number generator returning [0, 1)
 * @returns New WeatherState (possibly with new weather)
 */
export function processWeatherTick(
  state: WeatherState,
  clock: GameClock,
  rng: () => number,
): WeatherState {
  const newDaysRemaining = state.daysRemaining - 1;

  if (newDaysRemaining <= 0) {
    // Weather expired, roll new weather
    return rollWeatherChange(state.current, rng, clock.day);
  }

  return {
    ...state,
    daysRemaining: newDaysRemaining,
  };
}

// ============================================================
// Utility: Get weather def by ID
// ============================================================

/**
 * Get the full weather definition by ID.
 */
export function getWeatherDef(weatherId: WeatherId): WeatherDef | undefined {
  return WEATHER_DEFS.find(w => w.id === weatherId);
}

/**
 * Validate that weather probabilities sum to 1.0 (within floating point tolerance).
 */
export function validateProbabilities(): boolean {
  return Math.abs(TOTAL_PROBABILITY - 1.0) < 0.001;
}
