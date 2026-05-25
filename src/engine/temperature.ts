// ============================================================
// CardLand Temperature System — Terrain × Weather Matrix
// Pure functions for environment temperature and body temperature
// ============================================================

import type { ZoneId, WeatherId } from '@data/types';
import type { Attributes } from './attributes';

// ============================================================
// Types
// ============================================================

/** Terrain types corresponding to zones */
export type TerrainId = '海滩' | '丛林' | '山地' | '沼泽' | '浅海' | '遗迹';

/** Clothing type for temperature bonuses */
export type ClothingType = '布料' | '皮革' | null;

// ============================================================
// Zone → Terrain Mapping
// ============================================================

export const ZONE_TERRAIN_MAP: Record<ZoneId, TerrainId> = {
  A: '海滩',
  B: '丛林',
  C: '山地',
  D: '沼泽',
  E: '浅海',
  F: '遗迹',
};

// ============================================================
// Temperature Matrix (环境温度基准)
// Rows = terrain, Columns = weather
// ============================================================

const TEMPERATURE_MATRIX: Record<TerrainId, Record<WeatherId, number>> = {
  '海滩': { '晴': 1, '阴': 0, '雨': -2, '暴雨': -4, '大雾': -2, '酷热': 5 },
  '丛林': { '晴': 1, '阴': 0, '雨': -1, '暴雨': -3, '大雾': -1, '酷热': 3 },
  '山地': { '晴': 0, '阴': -2, '雨': -3, '暴雨': -5, '大雾': -3, '酷热': 5 },
  '沼泽': { '晴': 1, '阴': 0, '雨': -2, '暴雨': -4, '大雾': -2, '酷热': 4 },
  '浅海': { '晴': 1, '阴': 0, '雨': -2, '暴雨': -4, '大雾': -2, '酷热': 3 },
  '遗迹': { '晴': -2, '阴': -3, '雨': -3, '暴雨': -4, '大雾': -3, '酷热': 1 },
};

// ============================================================
// Modifier Constants
// ============================================================

/** Night penalty applied to all terrains */
export const NIGHT_PENALTY = -2;

/** Campfire/torch warming per hour */
export const FIRE_WARMING_PER_HOUR = 10;

/** Clothing bonuses */
export const CLOTHING_BONUS: Record<string, number> = {
  '布料': 2,
  '皮革': 5,
};

/** Wet status penalty per hour */
export const WET_PENALTY_PER_HOUR = -3;

/** Wet status duration in hours */
export const WET_DURATION_HOURS = 2;

/** Hot spring warming per hour */
export const HOT_SPRING_WARMING_PER_HOUR = 15;

/** Temperature convergence rate: ±0.5 per hour toward target */
export const CONVERGENCE_RATE = 0.5;

/** Hypothermia threshold (≤ this value) */
export const HYPOTHERMIA_THRESHOLD = 20;

/** Heatstroke threshold (≥ this value) */
export const HEATSTROKE_THRESHOLD = 91;

// ============================================================
// 1. getEnvironmentTemperature — Base temp from matrix
// ============================================================

/**
 * Get the base environment temperature from the terrain×weather matrix.
 * Optionally applies night penalty.
 *
 * @param terrain - The terrain type (mapped from zone)
 * @param weather - Current weather condition
 * @param isNight - Whether it is nighttime
 * @returns Base environment temperature value
 */
export function getEnvironmentTemperature(
  terrain: TerrainId,
  weather: WeatherId,
  isNight: boolean,
): number {
  const base = TEMPERATURE_MATRIX[terrain][weather];
  return isNight ? base + NIGHT_PENALTY : base;
}

/**
 * Overload that accepts ZoneId and maps to terrain internally.
 */
export function getEnvironmentTemperatureByZone(
  zone: ZoneId,
  weather: WeatherId,
  isNight: boolean,
): number {
  const terrain = ZONE_TERRAIN_MAP[zone];
  return getEnvironmentTemperature(terrain, weather, isNight);
}

// ============================================================
// 2. calculateTemperatureChange — ±0.5/h toward target
// ============================================================

/**
 * Calculate body temperature change toward the target environment temperature.
 * Convergence rate: ±0.5 per hour (scaled by deltaMinutes).
 *
 * @param current - Current body temperature
 * @param target - Target (environment) temperature
 * @param deltaMinutes - Time elapsed in minutes
 * @returns The new body temperature after convergence
 */
export function calculateTemperatureChange(
  current: number,
  target: number,
  deltaMinutes: number,
): number {
  const dt = deltaMinutes / 60;
  const maxChange = CONVERGENCE_RATE * dt;

  if (current < target) {
    return Math.min(current + maxChange, target);
  } else if (current > target) {
    return Math.max(current - maxChange, target);
  }
  return current;
}

// ============================================================
// 3. applyTemperatureModifiers — Fire, clothing, wet status
// ============================================================

export interface TemperatureModifierInputs {
  /** Whether near a campfire or torch */
  nearFire: boolean;
  /** Equipped clothing type */
  clothing: ClothingType;
  /** Whether the player is currently wet */
  isWet: boolean;
  /** Whether near a hot spring */
  nearHotSpring?: boolean;
}

/**
 * Apply temperature modifiers from equipment, fire, wet status, etc.
 *
 * @param base - Base environment temperature
 * @param inputs - Modifier inputs
 * @returns Adjusted environment temperature
 */
export function applyTemperatureModifiers(
  base: number,
  inputs: TemperatureModifierInputs,
): number {
  let result = base;

  // Clothing bonus (constant, not per-hour)
  if (inputs.clothing && CLOTHING_BONUS[inputs.clothing]) {
    result += CLOTHING_BONUS[inputs.clothing];
  }

  return result;
}

/**
 * Calculate per-hour temperature modifier from active sources.
 * These are applied as direct per-hour changes to body temperature.
 *
 * @param inputs - Modifier inputs
 * @returns Per-hour temperature change from modifiers
 */
export function getPerHourModifier(inputs: TemperatureModifierInputs): number {
  let perHour = 0;

  // Campfire/torch warming
  if (inputs.nearFire) {
    perHour += FIRE_WARMING_PER_HOUR;
  }

  // Wet status penalty
  if (inputs.isWet) {
    perHour += WET_PENALTY_PER_HOUR;
  }

  // Hot spring warming
  if (inputs.nearHotSpring) {
    perHour += HOT_SPRING_WARMING_PER_HOUR;
  }

  return perHour;
}

// ============================================================
// 4. processTemperature — Full pipeline
// ============================================================

export interface TemperatureResult {
  /** New body temperature after processing */
  bodyTemperature: number;
  /** Environment temperature used for convergence */
  environmentTemperature: number;
  /** Whether hypothermia is triggered */
  hasHypothermia: boolean;
  /** Whether heatstroke is triggered */
  hasHeatstroke: boolean;
}

/**
 * Full temperature processing pipeline.
 *
 * Steps:
 * 1. Get base environment temperature from terrain×weather matrix
 * 2. Apply constant modifiers (clothing) to environment temp
 * 3. Converge body temperature toward environment temp
 * 4. Apply per-hour modifiers (fire, wet, hot spring) to body temp
 * 5. Clamp body temperature to [0, 100]
 * 6. Check for hypothermia/heatstroke
 *
 * @param attributes - Current player attributes (reads 体温)
 * @param zone - Current zone
 * @param weather - Current weather
 * @param isNight - Whether nighttime
 * @param nearFire - Whether near campfire/torch
 * @param clothing - Equipped clothing type
 * @param isWet - Whether wet
 * @param deltaMinutes - Time elapsed in minutes
 * @param nearHotSpring - Whether near hot spring (optional)
 * @returns Temperature processing result
 */
export function processTemperature(
  attributes: Attributes,
  zone: ZoneId,
  weather: WeatherId,
  isNight: boolean,
  nearFire: boolean,
  clothing: ClothingType,
  isWet: boolean,
  deltaMinutes: number,
  nearHotSpring?: boolean,
): TemperatureResult {
  // 1. Base environment temperature from matrix
  const baseEnvTemp = getEnvironmentTemperatureByZone(zone, weather, isNight);

  // 2. Apply constant modifiers (clothing) to environment
  const envTemp = applyTemperatureModifiers(baseEnvTemp, {
    nearFire,
    clothing,
    isWet,
    nearHotSpring,
  });

  // 3. Converge body temperature toward environment
  const currentBodyTemp = attributes['体温'] ?? 60;
  let newBodyTemp = calculateTemperatureChange(currentBodyTemp, envTemp, deltaMinutes);

  // 4. Apply per-hour modifiers (fire, wet, hot spring)
  const dt = deltaMinutes / 60;
  const perHourMod = getPerHourModifier({ nearFire, clothing, isWet, nearHotSpring });
  newBodyTemp += perHourMod * dt;

  // 5. Clamp to [0, 100]
  newBodyTemp = Math.max(0, Math.min(100, newBodyTemp));

  // 6. Check thresholds
  const hasHypothermia = newBodyTemp <= HYPOTHERMIA_THRESHOLD;
  const hasHeatstroke = newBodyTemp >= HEATSTROKE_THRESHOLD;

  return {
    bodyTemperature: newBodyTemp,
    environmentTemperature: envTemp,
    hasHypothermia,
    hasHeatstroke,
  };
}
