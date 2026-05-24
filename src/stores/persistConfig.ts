// ============================================================
// CardLand Save System — Persist Configuration
// Provides 3 save slots + auto-save with version migration.
// ============================================================

import { useGameStore } from './gameStore';
import { usePlayerStore } from './playerStore';
import { useCombatStore } from './combatStore';
import { useMapStore } from './mapStore';

export const SAVE_VERSION = 1;
export const AUTO_SAVE_INTERVAL = 5; // turns
const STORAGE_KEY_PREFIX = 'cardland-save-';

export interface SaveSlot {
  version: number;
  timestamp: number;
  turn: number;
  gameState: ReturnType<typeof useGameStore.getState>['gameState'];
  gamePhase: ReturnType<typeof useGameStore.getState>['gamePhase'];
  logs: string[];
  playerAttributes: ReturnType<typeof usePlayerStore.getState>['attributes'];
  playerInventory: ReturnType<typeof usePlayerStore.getState>['inventory'];
  playerStatusEffects: ReturnType<typeof usePlayerStore.getState>['statusEffects'];
  playerEquipment: ReturnType<typeof usePlayerStore.getState>['equipment'];
  combatState: ReturnType<typeof useCombatStore.getState>['activeCombat'];
  combatHistory: string[];
  combatRound: number;
  mapDiscovered: ReturnType<typeof useMapStore.getState>['discoveredPoints'];
  mapZone: ReturnType<typeof useMapStore.getState>['currentZone'];
  mapSubZone: ReturnType<typeof useMapStore.getState>['currentSubZone'];
  mapPaths: ReturnType<typeof useMapStore.getState>['availablePaths'];
}

export interface SaveMetadata {
  slot: number;
  version: number;
  timestamp: number;
  turn: number;
  hasData: boolean;
}

/** Snapshot current state into a SaveSlot */
function captureSlot(): SaveSlot {
  const game = useGameStore.getState();
  const player = usePlayerStore.getState();
  const combat = useCombatStore.getState();
  const map = useMapStore.getState();

  return {
    version: SAVE_VERSION,
    timestamp: Date.now(),
    turn: game.gameState.turnNumber,
    gameState: game.gameState,
    gamePhase: game.gamePhase,
    logs: game.logs,
    playerAttributes: player.attributes,
    playerInventory: player.inventory,
    playerStatusEffects: player.statusEffects,
    playerEquipment: player.equipment,
    combatState: combat.activeCombat,
    combatHistory: combat.combatHistory,
    combatRound: combat.currentRound,
    mapDiscovered: map.discoveredPoints,
    mapZone: map.currentZone,
    mapSubZone: map.currentSubZone,
    mapPaths: map.availablePaths,
  };
}

/** Restore a SaveSlot into all stores */
function restoreSlot(slot: SaveSlot): void {
  const game = useGameStore.getState();
  const player = usePlayerStore.getState();
  const combat = useCombatStore.getState();
  const map = useMapStore.getState();

  // Restore game store
  game.setGameState(slot.gameState);
  game.setGamePhase(slot.gamePhase);
  game.clearLogs();
  slot.logs.forEach(log => game.addLog(log));

  // Restore player store
  player.setAttributes(slot.playerAttributes);
  player.setInventory(slot.playerInventory);
  player.setStatusEffects(slot.playerStatusEffects);
  player.setEquipment(slot.playerEquipment);

  // Restore combat store
  combat.setActiveCombat(slot.combatState);
  combat.clearHistory();
  slot.combatHistory.forEach(entry => combat.addToHistory(entry));

  // Restore map store
  map.discoveredPoints = slot.mapDiscovered;
  map.currentZone = slot.mapZone;
  map.currentSubZone = slot.mapSubZone;
  map.availablePaths = slot.mapPaths;
}

// --- Version Migration ---

const MIGRATORS: Record<number, (slot: SaveSlot) => SaveSlot> = {
  // Future: 1 -> 2: slot => ({ ...slot, /* migration */ })
};

function migrate(slot: SaveSlot): SaveSlot {
  let current = slot;
  for (let v = current.version + 1; v <= SAVE_VERSION; v++) {
    const migrator = MIGRATORS[v];
    if (migrator) {
      current = migrator(current);
      current.version = v;
    }
  }
  return current;
}

// --- Public API ---

export function saveToSlot(slotIndex: 0 | 1 | 2): void {
  const key = `${STORAGE_KEY_PREFIX}${slotIndex}`;
  const data = captureSlot();
  localStorage.setItem(key, JSON.stringify(data));
}

export function loadFromSlot(slotIndex: 0 | 1 | 2): boolean {
  const key = `${STORAGE_KEY_PREFIX}${slotIndex}`;
  const raw = localStorage.getItem(key);
  if (!raw) return false;

  try {
    const slot = JSON.parse(raw) as SaveSlot;
    const migrated = slot.version !== SAVE_VERSION ? migrate(slot) : slot;
    restoreSlot(migrated);
    return true;
  } catch {
    // Corrupt data — clear slot
    localStorage.removeItem(key);
    return false;
  }
}

export function deleteSlot(slotIndex: 0 | 1 | 2): void {
  localStorage.removeItem(`${STORAGE_KEY_PREFIX}${slotIndex}`);
}

export function getSlotMetadata(slotIndex: 0 | 1 | 2): SaveMetadata {
  const key = `${STORAGE_KEY_PREFIX}${slotIndex}`;
  const raw = localStorage.getItem(key);

  if (!raw) {
    return { slot: slotIndex, version: 0, timestamp: 0, turn: 0, hasData: false };
  }

  try {
    const slot = JSON.parse(raw) as SaveSlot;
    return {
      slot: slotIndex,
      version: slot.version,
      timestamp: slot.timestamp,
      turn: slot.turn,
      hasData: true,
    };
  } catch {
    return { slot: slotIndex, version: 0, timestamp: 0, turn: 0, hasData: false };
  }
}

export function getAllSlotMetadata(): SaveMetadata[] {
  return ([0, 1, 2] as const).map(i => getSlotMetadata(i));
}

// --- Auto-save ---

let _autoSaveTurnCounter = 0;

export function tickAutoSave(currentTurn: number): boolean {
  _autoSaveTurnCounter = currentTurn;
  if (currentTurn > 0 && currentTurn % AUTO_SAVE_INTERVAL === 0) {
    saveToSlot(0); // Slot 0 = auto-save
    return true;
  }
  return false;
}

export function getAutoSaveTurn(): number {
  return _autoSaveTurnCounter;
}

// --- Helpers ---

export function formatTimestamp(ts: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}