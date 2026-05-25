// ============================================================
// CardLand Day/Night Cycle — Hour-based pure functions
// ============================================================
// Effects per design doc:
//   清晨 05:00~07:00  体力恢复+20%, 采集+10%, 野兽少
//   白天 07:00~17:00  正常
//   黄昏 17:00~19:00  命中-10%, 体力消耗+10%
//   夜晚 19:00~05:00  采集-50%, 野兽+30%, 体温-0.3/h, 需火把
// ============================================================

import type { TimeOfDay } from './clock';

/** Gameplay effects driven by the current time-of-day period */
export interface DayNightEffects {
  /** Bonus/penalty to stamina recovery rate (e.g. 0.2 = +20%) */
  staminaRecoveryBonus: number;
  /** Bonus/penalty to gather efficiency (e.g. -0.5 = -50%) */
  gatherEfficiency: number;
  /** Bonus/penalty to beast encounter probability (e.g. 0.3 = +30%) */
  beastEncounterBonus: number;
  /** Modifier to hit chance in combat (e.g. -0.1 = -10%) */
  hitChanceModifier: number;
  /** Extra stamina consumption multiplier (e.g. 0.1 = +10%) */
  staminaConsumptionBonus: number;
  /** Body temperature change per hour (negative = heat loss) */
  bodyTemperatureDrop: number;
  /** Whether a torch is required for exploration */
  needsTorch: boolean;
}

// ============================================================
// getTimeOfDay — Return time period from hour (0-23)
// ============================================================

/**
 * Determine the time-of-day period from a raw hour value (0-23).
 *
 * Time ranges:
 * - 清晨 (Dawn): 05:00 – 06:59
 * - 白天 (Day):  07:00 – 16:59
 * - 黄昏 (Dusk): 17:00 – 18:59
 * - 夜晚 (Night): 19:00 – 04:59
 */
export function getTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 7) return '清晨';
  if (hour >= 7 && hour < 17) return '白天';
  if (hour >= 17 && hour < 19) return '黄昏';
  return '夜晚';
}

// ============================================================
// getTimeOfDayEffects — Effects for a given time period
// ============================================================

/**
 * Return the gameplay effects for a specific time-of-day period.
 */
export function getTimeOfDayEffects(tod: TimeOfDay): DayNightEffects {
  switch (tod) {
    case '清晨':
      return {
        staminaRecoveryBonus: 0.2,
        gatherEfficiency: 0.1,
        beastEncounterBonus: -0.3,
        hitChanceModifier: 0,
        staminaConsumptionBonus: 0,
        bodyTemperatureDrop: 0,
        needsTorch: false,
      };
    case '白天':
      return {
        staminaRecoveryBonus: 0,
        gatherEfficiency: 0,
        beastEncounterBonus: 0,
        hitChanceModifier: 0,
        staminaConsumptionBonus: 0,
        bodyTemperatureDrop: 0,
        needsTorch: false,
      };
    case '黄昏':
      return {
        staminaRecoveryBonus: 0,
        gatherEfficiency: 0,
        beastEncounterBonus: 0,
        hitChanceModifier: -0.1,
        staminaConsumptionBonus: 0.1,
        bodyTemperatureDrop: 0,
        needsTorch: false,
      };
    case '夜晚':
      return {
        staminaRecoveryBonus: 0,
        gatherEfficiency: -0.5,
        beastEncounterBonus: 0.3,
        hitChanceModifier: 0,
        staminaConsumptionBonus: 0,
        bodyTemperatureDrop: -0.3,
        needsTorch: true,
      };
  }
}

// ============================================================
// isNight — Convenience check for night hours
// ============================================================

/**
 * Returns true if the given hour falls within the night period (19:00–04:59).
 */
export function isNight(hour: number): boolean {
  return getTimeOfDay(hour) === '夜晚';
}

// ============================================================
// getVisibility — 0-1 visibility modifier
// ============================================================

/**
 * Return a visibility modifier (0.0–1.0) based on the hour.
 *
 * - 清晨  → 0.7  (dim pre-dawn light)
 * - 白天  → 1.0  (full daylight)
 * - 黄昏  → 0.6  (fading light)
 * - 夜晚  → 0.2  (near-total darkness)
 */
export function getVisibility(hour: number): number {
  const tod = getTimeOfDay(hour);
  switch (tod) {
    case '清晨':
      return 0.7;
    case '白天':
      return 1.0;
    case '黄昏':
      return 0.6;
    case '夜晚':
      return 0.2;
  }
}
