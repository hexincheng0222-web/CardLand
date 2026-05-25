// ============================================================
// CardLand Map Store — BACKWARD COMPAT SHIM
// Thin Zustand store that delegates to unified useGameStore.
// New code should import from useGameStore directly.
// ============================================================

import { create } from 'zustand';
import { useGameStore } from './gameStore';
import type { ZoneId, SubZoneId } from '@data/types';

interface MapStoreState {
  discoveredPoints: string[];
  currentZone: ZoneId;
  currentSubZone: SubZoneId;
  currentPosition: string;
}

/**
 * @deprecated Use useGameStore directly. This shim exists for backward compat.
 *
 * Subscribes to the unified store and exposes only map-related state.
 * Components that import useMapStore will continue to work, but should
 * migrate to useGameStore for full access to clock, weather, and player state.
 */
export const useMapStore = create<MapStoreState>()(() => ({
  discoveredPoints: useGameStore.getState().discoveredPoints,
  currentZone: useGameStore.getState().currentZone,
  currentSubZone: useGameStore.getState().currentSubZone,
  currentPosition: useGameStore.getState().currentPosition,
}));

// Sync from unified store on every change
useGameStore.subscribe((state) => {
  useMapStore.setState({
    discoveredPoints: state.discoveredPoints,
    currentZone: state.currentZone,
    currentSubZone: state.currentSubZone,
    currentPosition: state.currentPosition,
  });
});
