// ============================================================
// CardLand GameClock Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  createClock,
  advanceTime,
  formatDisplay,
  getTimeOfDay,
  getTimeOfDayEffects,
} from '../clock';
import type { GameClock } from '../clock';

describe('GameClock', () => {
  // ============================================================
  // createClock
  // ============================================================
  describe('createClock', () => {
    it('should initialize to Day 1, 06:00', () => {
      const clock = createClock();
      expect(clock).toEqual({
        totalMinutes: 360,
        day: 1,
        hour: 6,
        minute: 0,
      });
    });

    it('should return a new object each time', () => {
      const clock1 = createClock();
      const clock2 = createClock();
      expect(clock1).not.toBe(clock2);
      expect(clock1).toEqual(clock2);
    });
  });

  // ============================================================
  // advanceTime
  // ============================================================
  describe('advanceTime', () => {
    it('should advance by 30 minutes → Day 1 06:30', () => {
      const clock = createClock();
      const advanced = advanceTime(clock, 30);
      expect(advanced).toEqual({
        totalMinutes: 390,
        day: 1,
        hour: 6,
        minute: 30,
      });
    });

    it('should advance by 60 minutes → Day 1 07:00 (cross hour boundary)', () => {
      const clock = createClock();
      const advanced = advanceTime(clock, 60);
      expect(advanced).toEqual({
        totalMinutes: 420,
        day: 1,
        hour: 7,
        minute: 0,
      });
    });

    it('should advance by 24*60 minutes → Day 2 06:00 (cross day boundary)', () => {
      const clock = createClock();
      const advanced = advanceTime(clock, 24 * 60);
      expect(advanced).toEqual({
        totalMinutes: 1800, // 360 + 1440
        day: 2,
        hour: 6,
        minute: 0,
      });
    });

    it('should advance by 1140 minutes → Day 2 01:00', () => {
      // Start: Day 1 06:00 (360 min)
      // Add: 1140 min
      // Total: 1500 min
      // Day: floor(1500/1440) + 1 = 2
      // Remainder: 1500 % 1440 = 60 min
      // Hour: floor(60/60) = 1
      // Minute: 60 % 60 = 0
      const clock = createClock();
      const advanced = advanceTime(clock, 1140);
      expect(advanced).toEqual({
        totalMinutes: 1500,
        day: 2,
        hour: 1,
        minute: 0,
      });
    });

    it('should handle zero minutes advance', () => {
      const clock = createClock();
      const advanced = advanceTime(clock, 0);
      expect(advanced).toEqual(clock);
    });

    it('should handle multiple advances correctly', () => {
      let clock = createClock();
      clock = advanceTime(clock, 30); // 06:30
      clock = advanceTime(clock, 30); // 07:00
      clock = advanceTime(clock, 60); // 08:00
      expect(clock).toEqual({
        totalMinutes: 480,
        day: 1,
        hour: 8,
        minute: 0,
      });
    });

    it('should throw on negative minutes', () => {
      const clock = createClock();
      expect(() => advanceTime(clock, -1)).toThrow('Cannot advance time by negative minutes');
    });

    it('should not mutate the original clock', () => {
      const clock = createClock();
      const original = { ...clock };
      advanceTime(clock, 60);
      expect(clock).toEqual(original);
    });

    it('should handle large time advances (multiple days)', () => {
      const clock = createClock();
      // Advance 3 days, 5 hours, 30 minutes
      const advanced = advanceTime(clock, 3 * 24 * 60 + 5 * 60 + 30);
      expect(advanced.day).toBe(4);
      expect(advanced.hour).toBe(11);
      expect(advanced.minute).toBe(30);
    });
  });

  // ============================================================
  // formatDisplay
  // ============================================================
  describe('formatDisplay', () => {
    it('should format initial clock as "第 1 天 06:00"', () => {
      const clock = createClock();
      expect(formatDisplay(clock)).toBe('第 1 天 06:00');
    });

    it('should pad single-digit hours and minutes', () => {
      const clock: GameClock = {
        totalMinutes: 5, // 00:05
        day: 1,
        hour: 0,
        minute: 5,
      };
      expect(formatDisplay(clock)).toBe('第 1 天 00:05');
    });

    it('should format afternoon time correctly', () => {
      const clock: GameClock = {
        totalMinutes: 870, // 14:30
        day: 1,
        hour: 14,
        minute: 30,
      };
      expect(formatDisplay(clock)).toBe('第 1 天 14:30');
    });

    it('should format multi-day time correctly', () => {
      const clock: GameClock = {
        totalMinutes: 1500, // Day 2, 01:00
        day: 2,
        hour: 1,
        minute: 0,
      };
      expect(formatDisplay(clock)).toBe('第 2 天 01:00');
    });

    it('should format end of day correctly', () => {
      const clock: GameClock = {
        totalMinutes: 1439, // 23:59
        day: 1,
        hour: 23,
        minute: 59,
      };
      expect(formatDisplay(clock)).toBe('第 1 天 23:59');
    });
  });

  // ============================================================
  // getTimeOfDay
  // ============================================================
  describe('getTimeOfDay', () => {
    it('should return 清晨 for 05:00-06:59', () => {
      const clock5am: GameClock = { totalMinutes: 300, day: 1, hour: 5, minute: 0 };
      const clock6am: GameClock = { totalMinutes: 360, day: 1, hour: 6, minute: 0 };
      const clock659: GameClock = { totalMinutes: 419, day: 1, hour: 6, minute: 59 };

      expect(getTimeOfDay(clock5am)).toBe('清晨');
      expect(getTimeOfDay(clock6am)).toBe('清晨');
      expect(getTimeOfDay(clock659)).toBe('清晨');
    });

    it('should return 白天 for 07:00-16:59', () => {
      const clock7am: GameClock = { totalMinutes: 420, day: 1, hour: 7, minute: 0 };
      const clock12pm: GameClock = { totalMinutes: 720, day: 1, hour: 12, minute: 0 };
      const clock459pm: GameClock = { totalMinutes: 1019, day: 1, hour: 16, minute: 59 };

      expect(getTimeOfDay(clock7am)).toBe('白天');
      expect(getTimeOfDay(clock12pm)).toBe('白天');
      expect(getTimeOfDay(clock459pm)).toBe('白天');
    });

    it('should return 黄昏 for 17:00-18:59', () => {
      const clock5pm: GameClock = { totalMinutes: 1020, day: 1, hour: 17, minute: 0 };
      const clock6pm: GameClock = { totalMinutes: 1080, day: 1, hour: 18, minute: 0 };
      const clock659pm: GameClock = { totalMinutes: 1139, day: 1, hour: 18, minute: 59 };

      expect(getTimeOfDay(clock5pm)).toBe('黄昏');
      expect(getTimeOfDay(clock6pm)).toBe('黄昏');
      expect(getTimeOfDay(clock659pm)).toBe('黄昏');
    });

    it('should return 夜晚 for 19:00-04:59', () => {
      const clock7pm: GameClock = { totalMinutes: 1140, day: 1, hour: 19, minute: 0 };
      const clock11pm: GameClock = { totalMinutes: 1380, day: 1, hour: 23, minute: 0 };
      const clockMidnight: GameClock = { totalMinutes: 0, day: 1, hour: 0, minute: 0 };
      const clock4am: GameClock = { totalMinutes: 240, day: 1, hour: 4, minute: 0 };
      const clock459am: GameClock = { totalMinutes: 299, day: 1, hour: 4, minute: 59 };

      expect(getTimeOfDay(clock7pm)).toBe('夜晚');
      expect(getTimeOfDay(clock11pm)).toBe('夜晚');
      expect(getTimeOfDay(clockMidnight)).toBe('夜晚');
      expect(getTimeOfDay(clock4am)).toBe('夜晚');
      expect(getTimeOfDay(clock459am)).toBe('夜晚');
    });

    it('should handle boundary transitions correctly', () => {
      // 06:59 → 清晨, 07:00 → 白天
      const clock659: GameClock = { totalMinutes: 419, day: 1, hour: 6, minute: 59 };
      const clock700: GameClock = { totalMinutes: 420, day: 1, hour: 7, minute: 0 };
      expect(getTimeOfDay(clock659)).toBe('清晨');
      expect(getTimeOfDay(clock700)).toBe('白天');

      // 16:59 → 白天, 17:00 → 黄昏
      const clock1659: GameClock = { totalMinutes: 1019, day: 1, hour: 16, minute: 59 };
      const clock1700: GameClock = { totalMinutes: 1020, day: 1, hour: 17, minute: 0 };
      expect(getTimeOfDay(clock1659)).toBe('白天');
      expect(getTimeOfDay(clock1700)).toBe('黄昏');

      // 18:59 → 黄昏, 19:00 → 夜晚
      const clock1859: GameClock = { totalMinutes: 1139, day: 1, hour: 18, minute: 59 };
      const clock1900: GameClock = { totalMinutes: 1140, day: 1, hour: 19, minute: 0 };
      expect(getTimeOfDay(clock1859)).toBe('黄昏');
      expect(getTimeOfDay(clock1900)).toBe('夜晚');

      // 04:59 → 夜晚, 05:00 → 清晨
      const clock459: GameClock = { totalMinutes: 299, day: 1, hour: 4, minute: 59 };
      const clock500: GameClock = { totalMinutes: 300, day: 1, hour: 5, minute: 0 };
      expect(getTimeOfDay(clock459)).toBe('夜晚');
      expect(getTimeOfDay(clock500)).toBe('清晨');
    });
  });

  // ============================================================
  // getTimeOfDayEffects
  // ============================================================
  describe('getTimeOfDayEffects', () => {
    it('should return dawn effects for 清晨', () => {
      const clock: GameClock = { totalMinutes: 360, day: 1, hour: 6, minute: 0 };
      const effects = getTimeOfDayEffects(clock);
      expect(effects).toEqual({
        staminaRecoveryBonus: 0.2,
        gatherEfficiency: 0.1,
        beastEncounterBonus: -0.3,
      });
    });

    it('should return zero effects for 白天', () => {
      const clock: GameClock = { totalMinutes: 720, day: 1, hour: 12, minute: 0 };
      const effects = getTimeOfDayEffects(clock);
      expect(effects).toEqual({
        staminaRecoveryBonus: 0,
        gatherEfficiency: 0,
        beastEncounterBonus: 0,
      });
    });

    it('should return dusk effects for 黄昏', () => {
      const clock: GameClock = { totalMinutes: 1020, day: 1, hour: 17, minute: 0 };
      const effects = getTimeOfDayEffects(clock);
      expect(effects).toEqual({
        staminaRecoveryBonus: 0,
        gatherEfficiency: 0,
        beastEncounterBonus: 0.1,
      });
    });

    it('should return night effects for 夜晚', () => {
      const clock: GameClock = { totalMinutes: 1200, day: 1, hour: 20, minute: 0 };
      const effects = getTimeOfDayEffects(clock);
      expect(effects).toEqual({
        staminaRecoveryBonus: -0.1,
        gatherEfficiency: -0.5,
        beastEncounterBonus: 0.3,
      });
    });

    it('should return all three modifiers for each time period', () => {
      const times: Array<{ hour: number; period: string }> = [
        { hour: 6, period: '清晨' },
        { hour: 12, period: '白天' },
        { hour: 17, period: '黄昏' },
        { hour: 22, period: '夜晚' },
      ];

      for (const { hour } of times) {
        const clock: GameClock = { totalMinutes: hour * 60, day: 1, hour, minute: 0 };
        const effects = getTimeOfDayEffects(clock);
        expect(effects).toHaveProperty('staminaRecoveryBonus');
        expect(effects).toHaveProperty('gatherEfficiency');
        expect(effects).toHaveProperty('beastEncounterBonus');
        expect(typeof effects.staminaRecoveryBonus).toBe('number');
        expect(typeof effects.gatherEfficiency).toBe('number');
        expect(typeof effects.beastEncounterBonus).toBe('number');
      }
    });
  });

  // ============================================================
  // Integration tests
  // ============================================================
  describe('Integration', () => {
    it('should maintain consistency through time advances', () => {
      let clock = createClock();
      
      // Advance to afternoon
      clock = advanceTime(clock, 7 * 60); // +7 hours → 13:00
      expect(formatDisplay(clock)).toBe('第 1 天 13:00');
      expect(getTimeOfDay(clock)).toBe('白天');

      // Advance to evening
      clock = advanceTime(clock, 4 * 60); // +4 hours → 17:00
      expect(formatDisplay(clock)).toBe('第 1 天 17:00');
      expect(getTimeOfDay(clock)).toBe('黄昏');

      // Advance to night
      clock = advanceTime(clock, 2 * 60); // +2 hours → 19:00
      expect(formatDisplay(clock)).toBe('第 1 天 19:00');
      expect(getTimeOfDay(clock)).toBe('夜晚');

      // Advance to next day dawn
      clock = advanceTime(clock, 10 * 60); // +10 hours → 05:00 Day 2
      expect(formatDisplay(clock)).toBe('第 2 天 05:00');
      expect(getTimeOfDay(clock)).toBe('清晨');
    });

    it('should provide correct effects after multiple advances', () => {
      let clock = createClock();
      
      // Start at dawn
      let effects = getTimeOfDayEffects(clock);
      expect(effects.staminaRecoveryBonus).toBe(0.2);

      // Advance to night
      clock = advanceTime(clock, 13 * 60); // +13 hours → 19:00
      effects = getTimeOfDayEffects(clock);
      expect(effects.beastEncounterBonus).toBe(0.3);
      expect(effects.gatherEfficiency).toBe(-0.5);
    });
  });
});
