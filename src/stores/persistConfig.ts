// ============================================================
// CardLand Save System — Persist Configuration (v2)
// Unified save: single store snapshot per slot.
// Provides 3 manual save slots + auto-save (slot 0) with
// version migration.
// ============================================================

import { useGameStore } from './gameStore';
import { useCombatStore } from './combatStore';
import type { GamePhase } from './gameStore';
import type { Attributes } from '@engine/attributes';
import type { Inventory } from '@engine/inventory';
import type { StatusEffect } from '@engine/status';
import type { CombatState } from '@engine/combat';
import type { GameClock } from '@engine/clock';
import type { ZoneId, SubZoneId } from '@data/types';
import type { ResourceReserve } from '@data/map';
import type { EquipmentSlots, WeatherStoreState } from './gameStore';

// ============================================================
// Constants
// ============================================================

export const SAVE_VERSION = 2;
/** Auto-save fires every 300 game-minutes (5 game-hours). */
export const AUTO_SAVE_INTERVAL_MINUTES = 300;
const STORAGE_KEY_PREFIX = 'cardland-save-';

// ============================================================
// Serialized Game State — unified store + combat store
// ============================================================

/**
 * Complete snapshot of all store state.
 * Every field is JSON-serializable (no Set/Map/Date).
 */
export interface SerializedGameState {
  // ── Time ──
  clock: GameClock;
  weather: WeatherStoreState;

  // ── Player ──
  attributes: Attributes;
  inventory: Inventory;
  statusEffects: StatusEffect[];
  equipment: EquipmentSlots;

  // ── Map ──
  currentZone: ZoneId;
  currentSubZone: SubZoneId;
  currentPosition: string;
  discoveredPoints: string[];
  reserves: ResourceReserve[];
  unlockedBlueprints: string[];

  // ── Game state ──
  gamePhase: GamePhase;
  logs: string[];
  gameOver: { isOver: boolean; reason: string | null };

  // ── Combat (separate store) ──
  activeCombat: CombatState | null;
  combatHistory: string[];
  currentRound: number;
}

// ============================================================
// Save Slot — the on-disk format
// ============================================================

export interface SaveSlot {
  version: number;
  timestamp: number;
  gameState: SerializedGameState;
  metadata: SaveMetadata;
}

export interface SaveMetadata {
  slot: number;
  version: number;
  timestamp: number;
  turn: number;       // day number for backward compat with SavePanel
  turnNumber: number; // alias for turn (backward compat with StartScreen)
  day: number;        // same as turn
  playerName: string;
  currentZone: string;
  playTime: number;   // total minutes played
  hasData: boolean;
}

// ============================================================
// Serialization Helpers — Set / Map ↔ JSON
// ============================================================

export function serializeSet<T>(set: Set<T>): T[] {
  return Array.from(set);
}

export function deserializeSet<T>(arr: T[]): Set<T> {
  return new Set(arr);
}

export function serializeMap<K, V>(map: Map<K, V>): [K, V][] {
  return Array.from(map.entries());
}

export function deserializeMap<K, V>(entries: [K, V][]): Map<K, V> {
  return new Map(entries);
}

// ============================================================
// Internal — capture / restore across all stores
// ============================================================

/** Snapshot current state from unified store + combat store into a SerializedGameState. */
function captureState(): SerializedGameState {
  const state = useGameStore.getState();
  const combat = useCombatStore.getState();

  return {
    // Time
    clock: { ...state.clock },
    weather: { ...state.weather },

    // Player
    attributes: { ...state.attributes },
    inventory: {
      ...state.inventory,
      slots: state.inventory.slots.map((s) => ({ ...s })),
    },
    statusEffects: state.statusEffects.map((e) => ({ ...e })),
    equipment: { ...state.equipment },

    // Map
    currentZone: state.currentZone,
    currentSubZone: state.currentSubZone,
    currentPosition: state.currentPosition,
    discoveredPoints: [...state.discoveredPoints],
    reserves: state.reserves.map((r) => ({ ...r })),
    unlockedBlueprints: [...state.unlockedBlueprints],

    // Game state
    gamePhase: state.gamePhase,
    logs: [...state.logs],
    gameOver: { ...state.gameOver },

    // Combat
    activeCombat: combat.activeCombat
      ? JSON.parse(JSON.stringify(combat.activeCombat))
      : null,
    combatHistory: [...combat.combatHistory],
    currentRound: combat.currentRound,
  };
}

/** Restore a SerializedGameState back into all stores. */
function restoreState(data: SerializedGameState): void {
  // Restore unified store
  useGameStore.setState({
    clock: data.clock,
    weather: data.weather,
    attributes: data.attributes,
    inventory: data.inventory,
    statusEffects: data.statusEffects,
    equipment: data.equipment,
    currentZone: data.currentZone,
    currentSubZone: data.currentSubZone,
    currentPosition: data.currentPosition,
    discoveredPoints: data.discoveredPoints,
    reserves: data.reserves,
    unlockedBlueprints: data.unlockedBlueprints,
    gamePhase: data.gamePhase,
    logs: data.logs,
    gameOver: data.gameOver,
  });

  // Restore combat store
  useCombatStore.getState().setActiveCombat(data.activeCombat);
  useCombatStore.getState().clearHistory();
  for (const entry of data.combatHistory) {
    useCombatStore.getState().addToHistory(entry);
  }
  useCombatStore.setState({ currentRound: data.currentRound });
}

/** Build SaveMetadata from a SerializedGameState. */
function buildMetadata(
  slot: number,
  state: SerializedGameState,
): SaveMetadata {
  return {
    slot,
    version: SAVE_VERSION,
    timestamp: Date.now(),
    turn: state.clock.day,
    turnNumber: state.clock.day,
    day: state.clock.day,
    playerName: '幸存者',
    currentZone: state.currentZone,
    playTime: state.clock.totalMinutes,
    hasData: true,
  };
}

/** Empty metadata for an unused slot. */
function emptyMetadata(slot: number): SaveMetadata {
  return {
    slot,
    version: 0,
    timestamp: 0,
    turn: 0,
    turnNumber: 0,
    day: 0,
    playerName: '',
    currentZone: '',
    playTime: 0,
    hasData: false,
  };
}

// ============================================================
// Version Migration
// ============================================================

type Migrator = (slot: SaveSlot) => SaveSlot;

const MIGRATORS: Record<number, Migrator> = {
  // v1 → v2: restructure from 4-store split to unified store
  2: (slot: SaveSlot): SaveSlot => {
    const v1 = slot as unknown as Record<string, unknown>;
    const gs = v1['gameState'] as Record<string, unknown> | undefined;

    // If it already has the v2 unified shape (clock exists), skip
    if (gs && typeof gs === 'object' && 'clock' in gs) {
      return { ...slot, version: 2 };
    }

    // v1 had 4 separate stores — attempt best-effort migration
    const serialized: SerializedGameState = {
      clock: (gs?.['clock'] as GameClock) ?? { totalMinutes: 360, day: 1, hour: 6, minute: 0 },
      weather: (gs?.['weather'] as WeatherStoreState) ?? { current: '晴', daysRemaining: 3, startDay: 1 },
      attributes: (gs?.['attributes'] as Attributes) ?? (v1['playerAttributes'] as Attributes) ?? {},
      inventory: (gs?.['inventory'] as Inventory) ?? (v1['playerInventory'] as Inventory) ?? { slots: [], maxSlots: 12, maxWeight: 100 },
      statusEffects: (gs?.['statusEffects'] as StatusEffect[]) ?? (v1['playerStatusEffects'] as StatusEffect[]) ?? [],
      equipment: (v1['playerEquipment'] as EquipmentSlots) ?? { head: null, body: null, hands: null, legs: null, feet: null, accessory1: null, accessory2: null },
      currentZone: (v1['mapZone'] as ZoneId) ?? (gs?.['currentZone'] as ZoneId) ?? 'A',
      currentSubZone: (v1['mapSubZone'] as SubZoneId) ?? (gs?.['currentSubZone'] as SubZoneId) ?? 'A1',
      currentPosition: (gs?.['currentPosition'] as string) ?? 'A1-North',
      discoveredPoints: (v1['mapDiscovered'] as string[]) ?? [],
      reserves: (gs?.['reserves'] as ResourceReserve[]) ?? [],
      unlockedBlueprints: [],
      gamePhase: (v1['gamePhase'] as GamePhase) ?? (gs?.['gamePhase'] as GamePhase) ?? 'exploration',
      logs: (v1['logs'] as string[]) ?? [],
      gameOver: (gs?.['gameOver'] as { isOver: boolean; reason: string | null }) ?? { isOver: false, reason: null },
      activeCombat: (v1['combatState'] as CombatState | null) ?? null,
      combatHistory: (v1['combatHistory'] as string[]) ?? [],
      currentRound: (v1['combatRound'] as number) ?? 0,
    };

    const metadata = buildMetadata(slot.metadata?.slot ?? 0, serialized);

    return {
      version: 2,
      timestamp: slot.timestamp ?? Date.now(),
      gameState: serialized,
      metadata,
    };
  },
};

/**
 * Migrate a save from its stored version to the current SAVE_VERSION.
 */
export function migrateSave(saveData: SaveSlot, fromVersion: number): SaveSlot {
  let current = { ...saveData };
  for (let v = fromVersion + 1; v <= SAVE_VERSION; v++) {
    const migrator = MIGRATORS[v];
    if (migrator) {
      current = migrator(current);
      current.version = v;
    }
  }
  return current;
}

// ============================================================
// Public API
// ============================================================

/**
 * Serialize and save game state to localStorage.
 * If `state` is not provided, captures from stores.
 */
export function saveToSlot(
  slotIndex: 0 | 1 | 2,
  state?: SerializedGameState,
): void {
  const key = `${STORAGE_KEY_PREFIX}${slotIndex}`;
  const captured = state ?? captureState();
  const metadata = buildMetadata(slotIndex, captured);

  const slot: SaveSlot = {
    version: SAVE_VERSION,
    timestamp: Date.now(),
    gameState: captured,
    metadata,
  };

  try {
    localStorage.setItem(key, JSON.stringify(slot));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

/**
 * Load from slot AND restore into all stores.
 * Returns true on success.
 *
 * This is the function used by SavePanel's loadFromSlot(slot) call,
 * which expects a truthy/falsy return.
 */
export function loadFromSlot(
  slotIndex: 0 | 1 | 2,
): boolean {
  const key = `${STORAGE_KEY_PREFIX}${slotIndex}`;
  const raw = localStorage.getItem(key);
  if (!raw) return false;

  try {
    const slot = JSON.parse(raw) as SaveSlot;

    // Migrate if needed
    const migrated =
      slot.version !== SAVE_VERSION ? migrateSave(slot, slot.version) : slot;

    // Validate basic structure
    if (!migrated.gameState || typeof migrated.gameState !== 'object') {
      return false;
    }

    restoreState(migrated.gameState);
    return true;
  } catch {
    // Corrupt data — clear slot and return false
    localStorage.removeItem(key);
    return false;
  }
}

/**
 * Load from slot AND restore into all stores.
 * Alias for loadFromSlot (unified store handles both load + restore).
 * Returns true on success.
 */
export function loadAndRestore(slotIndex: 0 | 1 | 2): boolean {
  return loadFromSlot(slotIndex);
}

/**
 * Get save metadata without loading the full state.
 * Returns null if slot is empty or corrupt.
 */
export function getSaveMetadata(
  slotIndex: 0 | 1 | 2,
): SaveMetadata | null {
  const key = `${STORAGE_KEY_PREFIX}${slotIndex}`;
  const raw = localStorage.getItem(key);
  if (!raw) return null;

  try {
    const slot = JSON.parse(raw) as SaveSlot;
    return {
      slot: slotIndex,
      version: slot.version ?? 0,
      timestamp: slot.timestamp ?? 0,
      turn: slot.metadata?.turn ?? slot.metadata?.day ?? 0,
      turnNumber: slot.metadata?.turnNumber ?? slot.metadata?.turn ?? slot.metadata?.day ?? 0,
      day: slot.metadata?.day ?? slot.metadata?.turn ?? 0,
      playerName: slot.metadata?.playerName ?? '',
      currentZone: slot.metadata?.currentZone ?? '',
      playTime: slot.metadata?.playTime ?? 0,
      hasData: true,
    };
  } catch {
    return null;
  }
}

/**
 * Get metadata for all 3 save slots.
 * Slots without data get hasData: false.
 */
export function getAllSlotMetadata(): SaveMetadata[] {
  return ([0, 1, 2] as const).map(
    (i) => getSaveMetadata(i) ?? emptyMetadata(i),
  );
}

/**
 * Delete a save slot from localStorage.
 */
export function deleteSlot(slotIndex: 0 | 1 | 2): void {
  localStorage.removeItem(`${STORAGE_KEY_PREFIX}${slotIndex}`);
}

/**
 * Check if any save data exists (any of the 3 slots).
 */
export function hasSaveData(): boolean {
  for (let i = 0; i <= 2; i++) {
    if (localStorage.getItem(`${STORAGE_KEY_PREFIX}${i}`) !== null) {
      return true;
    }
  }
  return false;
}

// ============================================================
// Auto-save — every 300 game-minutes + before danger
// ============================================================

let _lastAutoSaveMinutes = 0;

/**
 * Check if auto-save should fire based on elapsed game-minutes.
 * Call after each processTurn with the current total game-minutes.
 * Returns true if an auto-save was triggered.
 */
export function tickAutoSave(currentTotalMinutes: number): boolean {
  const elapsed = currentTotalMinutes - _lastAutoSaveMinutes;

  if (elapsed >= AUTO_SAVE_INTERVAL_MINUTES && currentTotalMinutes > 0) {
    _lastAutoSaveMinutes = currentTotalMinutes;
    saveToSlot(0); // Slot 0 = auto-save
    return true;
  }
  return false;
}

/**
 * Force an auto-save before a dangerous action (combat, high-risk exploration).
 * Saves to slot 0 and resets the auto-save timer.
 */
export function triggerAutoSaveBeforeDanger(): void {
  saveToSlot(0);
  const state = useGameStore.getState();
  _lastAutoSaveMinutes = state.clock.totalMinutes;
}

/**
 * Get the last auto-save game-minutes value.
 * Used by SavePanel to display auto-save status.
 * Renamed from getAutoSaveTurn for clarity, but kept backward compat.
 */
export function getAutoSaveTurn(): number {
  return Math.floor(_lastAutoSaveMinutes / 60); // convert to hours for display
}

export function getLastAutoSaveMinutes(): number {
  return _lastAutoSaveMinutes;
}

/**
 * Reset auto-save timer (for testing).
 */
export function resetAutoSaveTimer(): void {
  _lastAutoSaveMinutes = 0;
}

// ============================================================
// Helpers
// ============================================================

/** Format a timestamp (ms) as "YYYY-MM-DD HH:MM". */
export function formatTimestamp(ts: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Format play time as "Xd Xh Xm". */
export function formatPlayTime(totalMinutes: number): string {
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(' ');
}
