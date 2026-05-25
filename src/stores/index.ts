// ============================================================
// CardLand Stores — barrel export
// ============================================================

// Primary store (unified)
export { useGameStore } from './gameStore';
export type { GameState, GamePhase, EquipmentSlots, WeatherStoreState } from './gameStore';

// Backward-compatible re-exports (shims that delegate to unified store)
export { usePlayerStore } from './playerStore';
export { useMapStore } from './mapStore';

// Combat store (separate — combat has its own complex state)
export { useCombatStore } from './combatStore';

// Derived selectors
export { useWeightCalc, useAttributeEffects, useAvailableActions } from './selectors';
