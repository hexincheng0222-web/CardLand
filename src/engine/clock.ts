// ============================================================
// CardLand GameClock — Time-of-Day System
// Pure functions for game time management
// ============================================================

/** Represents the game clock state */
export interface GameClock {
  totalMinutes: number; // absolute minutes from game start
  day: number; // current day (1-based)
  hour: number; // 0-23
  minute: number; // 0-59
}

/** Time-of-day periods with Chinese names */
export type TimeOfDay = '清晨' | '白天' | '黄昏' | '夜晚';

/** Effects modifiers based on time of day */
export interface TimeOfDayEffects {
  staminaRecoveryBonus: number;
  gatherEfficiency: number;
  beastEncounterBonus: number;
}

// ============================================================
// createClock — Initialize to Day 1, 06:00 (清晨)
// ============================================================

/**
 * Create a new GameClock starting at Day 1, 06:00.
 * This is the game's starting time (清晨/dawn).
 */
export function createClock(): GameClock {
  return {
    totalMinutes: 360, // 6 hours * 60 minutes
    day: 1,
    hour: 6,
    minute: 0,
  };
}

// ============================================================
// advanceTime — Add minutes with auto-carry
// ============================================================

/**
 * Advance the clock by the given number of minutes.
 * Returns a new GameClock with proper carry logic:
 * - 60 minutes → +1 hour
 * - 24 hours → +1 day
 *
 * @param clock - Current clock state (not mutated)
 * @param minutes - Number of minutes to advance (must be >= 0)
 * @returns New GameClock with advanced time
 */
export function advanceTime(clock: GameClock, minutes: number): GameClock {
  if (minutes < 0) {
    throw new Error('Cannot advance time by negative minutes');
  }

  const newTotalMinutes = clock.totalMinutes + minutes;
  
  // Calculate day, hour, minute from total minutes
  const day = Math.floor(newTotalMinutes / (24 * 60)) + 1; // 1-based
  const remainder = newTotalMinutes % (24 * 60);
  const hour = Math.floor(remainder / 60);
  const minute = remainder % 60;

  return {
    totalMinutes: newTotalMinutes,
    day,
    hour,
    minute,
  };
}

// ============================================================
// formatDisplay — Return "第 X 天 HH:MM"
// ============================================================

/**
 * Format the clock for display as "第 X 天 HH:MM".
 * Hours and minutes are zero-padded to 2 digits.
 */
export function formatDisplay(clock: GameClock): string {
  const hourStr = String(clock.hour).padStart(2, '0');
  const minuteStr = String(clock.minute).padStart(2, '0');
  return `第 ${clock.day} 天 ${hourStr}:${minuteStr}`;
}

// ============================================================
// getTimeOfDay — Get the current time period
// ============================================================

/**
 * Determine the time-of-day period based on the current hour.
 *
 * Time ranges:
 * - 清晨 (Dawn): 05:00 - 06:59
 * - 白天 (Day): 07:00 - 16:59
 * - 黄昏 (Dusk): 17:00 - 18:59
 * - 夜晚 (Night): 19:00 - 04:59
 */
export function getTimeOfDay(clock: GameClock): TimeOfDay {
  const { hour } = clock;
  
  if (hour >= 5 && hour < 7) {
    return '清晨';
  }
  if (hour >= 7 && hour < 17) {
    return '白天';
  }
  if (hour >= 17 && hour < 19) {
    return '黄昏';
  }
  return '夜晚';
}

// ============================================================
// getTimeOfDayEffects — Get modifiers for current time period
// ============================================================

/**
 * Get the gameplay effects based on the current time of day.
 *
 * Effects:
 * - 清晨 (Dawn): +20% stamina recovery, +10% gather efficiency, -30% beast encounter
 * - 白天 (Day): No modifiers
 * - 黄昏 (Dusk): +10% beast encounter
 * - 夜晚 (Night): -50% gather efficiency, +30% beast encounter, -10% stamina recovery
 */
export function getTimeOfDayEffects(clock: GameClock): TimeOfDayEffects {
  const timeOfDay = getTimeOfDay(clock);

  switch (timeOfDay) {
    case '清晨':
      return {
        staminaRecoveryBonus: 0.2,
        gatherEfficiency: 0.1,
        beastEncounterBonus: -0.3,
      };
    case '白天':
      return {
        staminaRecoveryBonus: 0,
        gatherEfficiency: 0,
        beastEncounterBonus: 0,
      };
    case '黄昏':
      return {
        staminaRecoveryBonus: 0,
        gatherEfficiency: 0,
        beastEncounterBonus: 0.1,
      };
    case '夜晚':
      return {
        staminaRecoveryBonus: -0.1,
        gatherEfficiency: -0.5,
        beastEncounterBonus: 0.3,
      };
  }
}
