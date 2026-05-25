// ============================================================
// CardLand Save System — Tests
// Tests for persistConfig.ts: save/load, serialization,
// migration, auto-save, and error handling.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveToSlot,
  loadFromSlot,
  loadAndRestore,
  getSaveMetadata,
  getAllSlotMetadata,
  deleteSlot,
  hasSaveData,
  migrateSave,
  tickAutoSave,
  triggerAutoSaveBeforeDanger,
  resetAutoSaveTimer,
  getLastAutoSaveMinutes,
  getAutoSaveTurn,
  serializeSet,
  deserializeSet,
  serializeMap,
  deserializeMap,
  formatTimestamp,
  formatPlayTime,
  SAVE_VERSION,
  type SaveSlot,
  type SerializedGameState,
} from '../persistConfig';

// ============================================================
// Test Helpers
// ============================================================

/** Create a minimal valid SerializedGameState for testing. */
function makeTestState(overrides?: Partial<SerializedGameState>): SerializedGameState {
  return {
    // Time
    clock: {
      totalMinutes: 960, // Day 1, 16:00
      day: 1,
      hour: 16,
      minute: 0,
    },
    weather: {
      current: '晴',
      daysRemaining: 3,
      startDay: 1,
    },

    // Player
    attributes: {
      '饱食度': 60,
      '口渴度': 55,
      '体力值': 80,
      '健康值': 100,
      '精力值': 70,
      '污垢': 15,
      '心情': 65,
      '负重': 10,
      '体温': 60,
    },
    inventory: {
      slots: [
        { itemId: '食物', quantity: 3 },
        { itemId: '水', quantity: 2 },
      ],
      maxSlots: 12,
      maxWeight: 100,
    },
    statusEffects: [
      { id: '饱腹', startedAt: 360, expiresAt: null },
    ],
    equipment: {
      head: null,
      body: null,
      hands: '石斧',
      legs: null,
      feet: null,
      accessory1: null,
      accessory2: null,
    },

    // Map
    currentZone: 'A',
    currentSubZone: 'A1',
    currentPosition: 'A1-North',
    discoveredPoints: ['A1-North', 'A1-South'],
    reserves: [
      { pointId: 'A1-North', itemId: '食物', currentStock: 15, maxStock: 20, regenerationRate: 1.0 },
    ],
    unlockedBlueprints: [],

    // Game state
    gamePhase: 'exploration',
    logs: ['测试日志1', '测试日志2'],
    gameOver: { isOver: false, reason: null },

    // Combat
    activeCombat: null,
    combatHistory: [],
    currentRound: 0,

    ...overrides,
  };
}

/** Write a raw JSON string directly to localStorage (for corruption tests). */
function writeRawSlot(slotIndex: number, raw: string): void {
  localStorage.setItem(`cardland-save-${slotIndex}`, raw);
}

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  localStorage.clear();
  resetAutoSaveTimer();
});

// ============================================================
// Serialization Helpers
// ============================================================

describe('Serialization Helpers', () => {
  describe('serializeSet / deserializeSet', () => {
    it('round-trips a Set of strings', () => {
      const original = new Set(['A1-North', 'A1-South', 'B2-East']);
      const arr = serializeSet(original);
      expect(Array.isArray(arr)).toBe(true);
      expect(arr).toHaveLength(3);

      const restored = deserializeSet(arr);
      expect(restored).toBeInstanceOf(Set);
      expect(restored.size).toBe(3);
      expect(restored.has('A1-North')).toBe(true);
      expect(restored.has('B2-East')).toBe(true);
    });

    it('round-trips a Set of numbers', () => {
      const original = new Set([1, 2, 3, 42]);
      const arr = serializeSet(original);
      const restored = deserializeSet(arr);
      expect(restored).toEqual(original);
    });

    it('handles empty Set', () => {
      const original = new Set<number>();
      const arr = serializeSet(original);
      expect(arr).toEqual([]);
      const restored = deserializeSet(arr);
      expect(restored.size).toBe(0);
    });

    it('JSON.stringify produces array', () => {
      const set = new Set(['a', 'b']);
      const json = JSON.stringify(serializeSet(set));
      expect(json).toBe('["a","b"]');
    });
  });

  describe('serializeMap / deserializeMap', () => {
    it('round-trips a Map of string to number', () => {
      const original = new Map<string, number>([
        ['中毒', 3],
        ['感染', 5],
      ]);
      const entries = serializeMap(original);
      expect(Array.isArray(entries)).toBe(true);
      expect(entries).toHaveLength(2);

      const restored = deserializeMap(entries);
      expect(restored).toBeInstanceOf(Map);
      expect(restored.get('中毒')).toBe(3);
      expect(restored.get('感染')).toBe(5);
    });

    it('handles empty Map', () => {
      const original = new Map<string, number>();
      const entries = serializeMap(original);
      expect(entries).toEqual([]);
      const restored = deserializeMap(entries);
      expect(restored.size).toBe(0);
    });

    it('JSON.stringify produces array of pairs', () => {
      const map = new Map([['a', 1], ['b', 2]]);
      const json = JSON.stringify(serializeMap(map));
      expect(json).toBe('[["a",1],["b",2]]');
    });
  });
});

// ============================================================
// Save / Load Round-Trip
// ============================================================

describe('Save / Load Round-Trip', () => {
  it('saves and loads full state preserving all fields', () => {
    const state = makeTestState();
    saveToSlot(1, state);

    // loadFromSlot restores into stores and returns boolean
    const ok = loadFromSlot(1);
    expect(ok).toBe(true);
  });

  it('preserves clock.totalMinutes exactly', () => {
    const state = makeTestState({
      clock: { totalMinutes: 12345, day: 8, hour: 15, minute: 45 },
    });
    saveToSlot(1, state);

    // Verify raw JSON preserves the value
    const raw = localStorage.getItem('cardland-save-1');
    expect(raw).not.toBeNull();
    const slot = JSON.parse(raw!) as SaveSlot;
    expect(slot.gameState.clock.totalMinutes).toBe(12345);
    expect(slot.gameState.clock.day).toBe(8);
    expect(slot.gameState.clock.hour).toBe(15);
    expect(slot.gameState.clock.minute).toBe(45);
  });

  it('preserves attributes exactly', () => {
    const state = makeTestState();
    saveToSlot(1, state);

    const raw = localStorage.getItem('cardland-save-1');
    const slot = JSON.parse(raw!) as SaveSlot;
    expect(slot.gameState.attributes['饱食度']).toBe(60);
    expect(slot.gameState.attributes['口渴度']).toBe(55);
    expect(slot.gameState.attributes['体力值']).toBe(80);
    expect(slot.gameState.attributes['健康值']).toBe(100);
  });

  it('preserves inventory slots', () => {
    const state = makeTestState();
    saveToSlot(1, state);

    const raw = localStorage.getItem('cardland-save-1');
    const slot = JSON.parse(raw!) as SaveSlot;
    expect(slot.gameState.inventory.slots).toHaveLength(2);
    expect(slot.gameState.inventory.slots[0]).toEqual({ itemId: '食物', quantity: 3 });
    expect(slot.gameState.inventory.slots[1]).toEqual({ itemId: '水', quantity: 2 });
  });

  it('preserves weather state', () => {
    const state = makeTestState();
    saveToSlot(1, state);

    const raw = localStorage.getItem('cardland-save-1');
    const slot = JSON.parse(raw!) as SaveSlot;
    expect(slot.gameState.weather.current).toBe('晴');
    expect(slot.gameState.weather.daysRemaining).toBe(3);
  });

  it('preserves status effects with timestamps', () => {
    const state = makeTestState();
    state.statusEffects = [
      { id: '饱腹', startedAt: 360, expiresAt: null },
      { id: '中毒', startedAt: 500, expiresAt: 680 },
    ];
    saveToSlot(1, state);

    const raw = localStorage.getItem('cardland-save-1');
    const slot = JSON.parse(raw!) as SaveSlot;
    expect(slot.gameState.statusEffects).toHaveLength(2);
    expect(slot.gameState.statusEffects[0].startedAt).toBe(360);
    expect(slot.gameState.statusEffects[0].expiresAt).toBeNull();
    expect(slot.gameState.statusEffects[1].startedAt).toBe(500);
    expect(slot.gameState.statusEffects[1].expiresAt).toBe(680);
  });

  it('preserves equipment slots', () => {
    const state = makeTestState();
    saveToSlot(1, state);

    const raw = localStorage.getItem('cardland-save-1');
    const slot = JSON.parse(raw!) as SaveSlot;
    expect(slot.gameState.equipment.hands).toBe('石斧');
    expect(slot.gameState.equipment.body).toBeNull();
  });

  it('preserves map state', () => {
    const state = makeTestState();
    saveToSlot(1, state);

    const raw = localStorage.getItem('cardland-save-1');
    const slot = JSON.parse(raw!) as SaveSlot;
    expect(slot.gameState.discoveredPoints).toEqual(['A1-North', 'A1-South']);
    expect(slot.gameState.currentZone).toBe('A');
    expect(slot.gameState.currentSubZone).toBe('A1');
  });

  it('preserves ResourceReserve.currentStock exactly', () => {
    const state = makeTestState({
      reserves: [
        { pointId: 'A1-North', itemId: '食物', currentStock: 15, maxStock: 20, regenerationRate: 1.0 },
        { pointId: 'A1-South', itemId: '水', currentStock: 50, maxStock: 9999, regenerationRate: 100 },
      ],
    });
    saveToSlot(1, state);

    const raw = localStorage.getItem('cardland-save-1');
    const slot = JSON.parse(raw!) as SaveSlot;
    expect(slot.gameState.reserves[0].currentStock).toBe(15);
    expect(slot.gameState.reserves[0].maxStock).toBe(20);
    expect(slot.gameState.reserves[1].currentStock).toBe(50);
  });

  it('preserves combat state', () => {
    const state = makeTestState({
      combatHistory: ['战斗开始：野猪', '造成 5 点伤害'],
      currentRound: 2,
    });
    saveToSlot(1, state);

    const raw = localStorage.getItem('cardland-save-1');
    const slot = JSON.parse(raw!) as SaveSlot;
    expect(slot.gameState.combatHistory).toEqual(['战斗开始：野猪', '造成 5 点伤害']);
    expect(slot.gameState.currentRound).toBe(2);
  });

  it('preserves game phase and logs', () => {
    const state = makeTestState({ gamePhase: 'combat', logs: ['战斗中'] });
    saveToSlot(1, state);

    const raw = localStorage.getItem('cardland-save-1');
    const slot = JSON.parse(raw!) as SaveSlot;
    expect(slot.gameState.gamePhase).toBe('combat');
    expect(slot.gameState.logs).toEqual(['战斗中']);
  });

  it('preserves gameOver state', () => {
    const state = makeTestState({
      gameOver: { isOver: true, reason: '健康值归零' },
    });
    saveToSlot(1, state);

    const raw = localStorage.getItem('cardland-save-1');
    const slot = JSON.parse(raw!) as SaveSlot;
    expect(slot.gameState.gameOver.isOver).toBe(true);
    expect(slot.gameState.gameOver.reason).toBe('健康值归零');
  });
});

// ============================================================
// Save Metadata
// ============================================================

describe('Save Metadata', () => {
  it('returns correct metadata for a saved slot', () => {
    const state = makeTestState({
      clock: { totalMinutes: 960, day: 1, hour: 16, minute: 0 },
    });
    saveToSlot(1, state);

    const meta = getSaveMetadata(1);
    expect(meta).not.toBeNull();
    expect(meta!.slot).toBe(1);
    expect(meta!.version).toBe(SAVE_VERSION);
    expect(meta!.turn).toBe(1);       // day number
    expect(meta!.turnNumber).toBe(1); // same as turn
    expect(meta!.day).toBe(1);
    expect(meta!.playerName).toBe('幸存者');
    expect(meta!.currentZone).toBe('A');
    expect(meta!.playTime).toBe(960); // totalMinutes
    expect(meta!.hasData).toBe(true);
    expect(meta!.timestamp).toBeGreaterThan(0);
  });

  it('returns null for empty slot', () => {
    const meta = getSaveMetadata(0);
    expect(meta).toBeNull();
  });

  it('returns null for corrupt data', () => {
    writeRawSlot(0, 'not valid json{{{');
    const meta = getSaveMetadata(0);
    expect(meta).toBeNull();
  });

  it('getAllSlotMetadata returns metadata for all 3 slots', () => {
    const metas = getAllSlotMetadata();
    expect(metas).toHaveLength(3);
    expect(metas[0].slot).toBe(0);
    expect(metas[1].slot).toBe(1);
    expect(metas[2].slot).toBe(2);
  });

  it('getAllSlotMetadata marks empty slots with hasData: false', () => {
    const metas = getAllSlotMetadata();
    for (const m of metas) {
      expect(m.hasData).toBe(false);
    }
  });

  it('getAllSlotMetadata marks saved slots with hasData: true', () => {
    saveToSlot(0, makeTestState());
    saveToSlot(2, makeTestState());

    const metas = getAllSlotMetadata();
    expect(metas[0].hasData).toBe(true);
    expect(metas[1].hasData).toBe(false);
    expect(metas[2].hasData).toBe(true);
  });
});

// ============================================================
// deleteSlot / hasSaveData
// ============================================================

describe('deleteSlot', () => {
  it('removes a saved slot', () => {
    saveToSlot(1, makeTestState());
    expect(hasSaveData()).toBe(true);

    deleteSlot(1);
    expect(hasSaveData()).toBe(false);
    expect(loadFromSlot(1)).toBe(false);
  });

  it('does not throw on empty slot', () => {
    expect(() => deleteSlot(0)).not.toThrow();
  });
});

describe('hasSaveData', () => {
  it('returns false when no saves exist', () => {
    expect(hasSaveData()).toBe(false);
  });

  it('returns true when any slot has data', () => {
    saveToSlot(2, makeTestState());
    expect(hasSaveData()).toBe(true);
  });

  it('returns false after all slots deleted', () => {
    saveToSlot(0, makeTestState());
    saveToSlot(1, makeTestState());
    deleteSlot(0);
    deleteSlot(1);
    expect(hasSaveData()).toBe(false);
  });
});

// ============================================================
// Corrupted Data Handling
// ============================================================

describe('Corrupted Data Handling', () => {
  it('loadFromSlot returns false for invalid JSON', () => {
    writeRawSlot(0, 'not json');
    expect(loadFromSlot(0)).toBe(false);
  });

  it('loadFromSlot returns false for empty string', () => {
    writeRawSlot(0, '');
    expect(loadFromSlot(0)).toBe(false);
  });

  it('loadFromSlot returns false for missing gameState field', () => {
    writeRawSlot(0, JSON.stringify({ version: SAVE_VERSION, timestamp: Date.now() }));
    expect(loadFromSlot(0)).toBe(false);
  });

  it('loadFromSlot clears corrupt slot from localStorage', () => {
    writeRawSlot(1, 'corrupt');
    loadFromSlot(1);
    expect(localStorage.getItem('cardland-save-1')).toBeNull();
  });

  it('loadAndRestore returns false for corrupt data', () => {
    writeRawSlot(0, '{bad json}');
    expect(loadAndRestore(0)).toBe(false);
  });

  it('loadFromSlot returns false for non-object gameState', () => {
    writeRawSlot(0, JSON.stringify({
      version: SAVE_VERSION,
      timestamp: Date.now(),
      gameState: 'not an object',
      metadata: { slot: 0, hasData: true },
    }));
    expect(loadFromSlot(0)).toBe(false);
  });
});

// ============================================================
// Version Migration
// ============================================================

describe('Version Migration', () => {
  it('migrateSave handles already-migrated v2 data', () => {
    const state = makeTestState();
    saveToSlot(1, state);
    const raw = localStorage.getItem('cardland-save-1');
    const v2Slot = JSON.parse(raw!) as SaveSlot;

    const migrated = migrateSave(v2Slot, 2);
    expect(migrated.version).toBe(2);
    expect(migrated.gameState.clock).toBeDefined();
  });

  it('migrateSave upgrades v1 flat format to v2 nested format', () => {
    // Simulate v1 flat format (before unified store)
    const v1Flat = {
      version: 1,
      timestamp: Date.now(),
      turn: 10,
      gamePhase: 'exploration',
      logs: ['test log'],
      gameState: {
        attributes: { '饱食度': 50 },
        inventory: { slots: [], maxSlots: 12, maxWeight: 100 },
        currentPosition: 'A1-North',
        weather: { current: '晴', turnsRemaining: 3 },
        turnNumber: 10,
        statusEffects: [],
        gameOver: { isOver: false, reason: null },
      },
      playerAttributes: { '饱食度': 50 },
      playerInventory: { slots: [], maxSlots: 12, maxWeight: 100 },
      playerStatusEffects: [],
      playerEquipment: {},
      combatState: null,
      combatHistory: [],
      combatRound: 0,
      mapDiscovered: ['A1-North'],
      mapZone: 'A',
      mapSubZone: 'A1',
      mapPaths: [],
      metadata: { slot: 0 },
    } as unknown as SaveSlot;

    const migrated = migrateSave(v1Flat, 1);
    expect(migrated.version).toBe(2);
    expect(migrated.gameState).toBeDefined();
    expect(migrated.gameState.clock).toBeDefined();
    expect(migrated.gameState.clock.totalMinutes).toBe(360); // default
    expect(migrated.gameState.gamePhase).toBe('exploration');
    expect(migrated.gameState.logs).toEqual(['test log']);
    expect(migrated.gameState.discoveredPoints).toEqual(['A1-North']);
  });

  it('loadFromSlot auto-migrates v1 data', () => {
    // Write v1 format directly
    const v1Data = {
      version: 1,
      timestamp: Date.now(),
      turn: 10,
      gamePhase: 'exploration',
      logs: ['test'],
      gameState: {
        attributes: { '饱食度': 50 },
        inventory: { slots: [], maxSlots: 12, maxWeight: 100 },
        currentPosition: 'A1-North',
        weather: { current: '晴', turnsRemaining: 3 },
        turnNumber: 10,
        statusEffects: [],
        gameOver: { isOver: false, reason: null },
      },
      playerAttributes: { '饱食度': 50 },
      playerInventory: { slots: [], maxSlots: 12, maxWeight: 100 },
      playerStatusEffects: [],
      playerEquipment: {},
      combatState: null,
      combatHistory: [],
      combatRound: 0,
      mapDiscovered: ['A1-North'],
      mapZone: 'A',
      mapSubZone: 'A1',
      mapPaths: [],
      metadata: { slot: 0 },
    };
    writeRawSlot(0, JSON.stringify(v1Data));

    // Should auto-migrate and restore successfully
    const ok = loadFromSlot(0);
    expect(ok).toBe(true);
  });
});

// ============================================================
// Auto-Save
// ============================================================

describe('Auto-Save', () => {
  it('tickAutoSave fires after AUTO_SAVE_INTERVAL_MINUTES game-minutes', () => {
    // Pass 300 minutes directly
    const result = tickAutoSave(300);
    expect(result).toBe(true);
    // Should have saved to slot 0
    expect(hasSaveData()).toBe(true);
    const meta = getSaveMetadata(0);
    expect(meta).not.toBeNull();
  });

  it('tickAutoSave does not fire before interval', () => {
    // Pass 240 minutes (less than 300)
    const result = tickAutoSave(240);
    expect(result).toBe(false);
    expect(hasSaveData()).toBe(false);
  });

  it('tickAutoSave does not fire at 0 minutes', () => {
    const result = tickAutoSave(0);
    expect(result).toBe(false);
  });

  it('tickAutoSave fires again after another interval', () => {
    tickAutoSave(300); // fires
    resetAutoSaveTimer();
    tickAutoSave(600); // fires again
    expect(getLastAutoSaveMinutes()).toBe(600);
  });

  it('getAutoSaveTurn returns correct value', () => {
    tickAutoSave(300);
    // getAutoSaveTurn converts minutes to hours: 300/60 = 5
    expect(getAutoSaveTurn()).toBe(5);
  });

  it('triggerAutoSaveBeforeDanger saves to slot 0', () => {
    triggerAutoSaveBeforeDanger();
    expect(hasSaveData()).toBe(true);
    const meta = getSaveMetadata(0);
    expect(meta).not.toBeNull();
  });
});

// ============================================================
// loadAndRestore
// ============================================================

describe('loadAndRestore', () => {
  it('returns true on successful load', () => {
    saveToSlot(1, makeTestState());
    const result = loadAndRestore(1);
    expect(result).toBe(true);
  });

  it('returns false for empty slot', () => {
    expect(loadAndRestore(0)).toBe(false);
  });

  it('returns false for corrupt data', () => {
    writeRawSlot(0, 'corrupt');
    expect(loadAndRestore(0)).toBe(false);
  });
});

// ============================================================
// Utility Functions
// ============================================================

describe('Utility Functions', () => {
  describe('formatTimestamp', () => {
    it('formats a valid timestamp', () => {
      const ts = new Date(2026, 0, 15, 14, 30).getTime(); // Jan 15, 2026 14:30
      const result = formatTimestamp(ts);
      expect(result).toBe('2026-01-15 14:30');
    });

    it('returns — for 0', () => {
      expect(formatTimestamp(0)).toBe('—');
    });

    it('pads single digits', () => {
      const ts = new Date(2026, 0, 5, 9, 5).getTime(); // Jan 5, 2026 09:05
      const result = formatTimestamp(ts);
      expect(result).toBe('2026-01-05 09:05');
    });
  });

  describe('formatPlayTime', () => {
    it('formats minutes only', () => {
      expect(formatPlayTime(30)).toBe('30m');
    });

    it('formats hours and minutes', () => {
      expect(formatPlayTime(90)).toBe('1h 30m');
    });

    it('formats days, hours, and minutes', () => {
      expect(formatPlayTime(1500)).toBe('1d 1h 0m');
    });

    it('handles zero', () => {
      expect(formatPlayTime(0)).toBe('0m');
    });
  });
});

// ============================================================
// Edge Cases
// ============================================================

describe('Edge Cases', () => {
  it('handles very large totalMinutes', () => {
    const state = makeTestState({
      clock: { totalMinutes: 999999, day: 694, hour: 9, minute: 39 },
    });
    saveToSlot(1, state);

    const raw = localStorage.getItem('cardland-save-1');
    const slot = JSON.parse(raw!) as SaveSlot;
    expect(slot.gameState.clock.totalMinutes).toBe(999999);
    expect(slot.metadata.playTime).toBe(999999);
  });

  it('handles empty logs array', () => {
    const state = makeTestState({ logs: [] });
    saveToSlot(1, state);

    const raw = localStorage.getItem('cardland-save-1');
    const slot = JSON.parse(raw!) as SaveSlot;
    expect(slot.gameState.logs).toEqual([]);
  });

  it('handles many inventory slots', () => {
    const state = makeTestState();
    state.inventory.slots = Array.from({ length: 12 }, (_, i) => ({
      itemId: '食物' as const,
      quantity: i + 1,
    }));
    saveToSlot(1, state);

    const raw = localStorage.getItem('cardland-save-1');
    const slot = JSON.parse(raw!) as SaveSlot;
    expect(slot.gameState.inventory.slots).toHaveLength(12);
  });

  it('handles null activeCombat', () => {
    const state = makeTestState({ activeCombat: null });
    saveToSlot(1, state);

    const raw = localStorage.getItem('cardland-save-1');
    const slot = JSON.parse(raw!) as SaveSlot;
    expect(slot.gameState.activeCombat).toBeNull();
  });

  it('overwrites existing save in same slot', () => {
    const state1 = makeTestState({
      clock: { totalMinutes: 600, day: 1, hour: 10, minute: 0 },
    });
    const state2 = makeTestState({
      clock: { totalMinutes: 1200, day: 1, hour: 20, minute: 0 },
    });

    saveToSlot(1, state1);
    saveToSlot(1, state2);

    const raw = localStorage.getItem('cardland-save-1');
    const slot = JSON.parse(raw!) as SaveSlot;
    expect(slot.gameState.clock.totalMinutes).toBe(1200);
  });

  it('slot 0 (auto-save) is independent of slots 1 and 2', () => {
    const state1 = makeTestState({
      clock: { totalMinutes: 300, day: 1, hour: 5, minute: 0 },
    });
    const state2 = makeTestState({
      clock: { totalMinutes: 600, day: 1, hour: 10, minute: 0 },
    });

    saveToSlot(0, state1);
    saveToSlot(1, state2);

    const raw0 = localStorage.getItem('cardland-save-0');
    const raw1 = localStorage.getItem('cardland-save-1');
    expect(JSON.parse(raw0!).gameState.clock.totalMinutes).toBe(300);
    expect(JSON.parse(raw1!).gameState.clock.totalMinutes).toBe(600);

    deleteSlot(0);
    expect(localStorage.getItem('cardland-save-0')).toBeNull();
    expect(localStorage.getItem('cardland-save-1')).not.toBeNull();
  });

  it('preserves unlockedBlueprints', () => {
    const state = makeTestState({
      unlockedBlueprints: ['石斧蓝图', '木矛蓝图'],
    });
    saveToSlot(1, state);

    const raw = localStorage.getItem('cardland-save-1');
    const slot = JSON.parse(raw!) as SaveSlot;
    expect(slot.gameState.unlockedBlueprints).toEqual(['石斧蓝图', '木矛蓝图']);
  });

  it('preserves multiple reserves with different stocks', () => {
    const state = makeTestState({
      reserves: [
        { pointId: 'A1-North', itemId: '食物', currentStock: 5, maxStock: 20, regenerationRate: 1.0 },
        { pointId: 'A1-South', itemId: '木材', currentStock: 0, maxStock: 30, regenerationRate: 0.3 },
        { pointId: 'B2-East', itemId: '铁矿', currentStock: 8, maxStock: 10, regenerationRate: 0.15 },
      ],
    });
    saveToSlot(1, state);

    const raw = localStorage.getItem('cardland-save-1');
    const slot = JSON.parse(raw!) as SaveSlot;
    expect(slot.gameState.reserves).toHaveLength(3);
    expect(slot.gameState.reserves[0].currentStock).toBe(5);
    expect(slot.gameState.reserves[1].currentStock).toBe(0);
    expect(slot.gameState.reserves[2].currentStock).toBe(8);
  });
});
