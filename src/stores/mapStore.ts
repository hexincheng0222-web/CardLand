// ============================================================
// CardLand Map Store
// Wires map data (discovered points, zone, available paths)
// to React UI via Zustand.
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MapStoreState } from '../types/mapState';
import type { ZoneId, SubZoneId } from '@data/types';
import { getMovementCost } from '@data/map';
import type { GameState } from '@engine/turn';

interface MapStoreActions {
  discoverPoint: (pointId: string) => void;
  setCurrentZone: (zone: ZoneId) => void;
  setCurrentSubZone: (subZone: SubZoneId) => void;
  updateAvailablePaths: () => void;
  syncFromGameState: (gameState: GameState) => void;
  resetMap: () => void;
}

const ALL_SUB_ZONES: SubZoneId[] = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4'];

export const useMapStore = create<MapStoreState & MapStoreActions>()(
  persist(
    (set, get) => ({
      // -- State --
      discoveredPoints: ['A1-North'],
      currentZone: 'A',
      currentSubZone: 'A1',
      availablePaths: [],

      // -- Actions --
      discoverPoint: (pointId) => {
        const discovered = new Set(get().discoveredPoints);
        if (!discovered.has(pointId)) {
          discovered.add(pointId);
          set({ discoveredPoints: Array.from(discovered) });
        }
      },

      setCurrentZone: (zone) => set({ currentZone: zone }),

      setCurrentSubZone: (subZone) => {
        set({ currentSubZone: subZone });
        get().updateAvailablePaths();
      },

      updateAvailablePaths: () => {
        const { currentSubZone } = get();
        const paths: string[] = [];
        for (const sz of ALL_SUB_ZONES) {
          if (sz === currentSubZone) continue;
          const cost = getMovementCost(currentSubZone, sz);
          if (cost !== undefined) {
            paths.push(sz);
          }
        }
        set({ availablePaths: paths });
      },

      syncFromGameState: (gameState) => {
        const pointId = gameState.currentPosition;
        const match = pointId.match(/^([AB]\d)-/);
        const subZone = (match?.[1] ?? 'A1') as SubZoneId;
        const zone = subZone.charAt(0) as ZoneId;

        const discovered = new Set(get().discoveredPoints);
        discovered.add(pointId);

        set({
          discoveredPoints: Array.from(discovered),
          currentZone: zone,
          currentSubZone: subZone,
        });
        get().updateAvailablePaths();
      },

      resetMap: () => {
        set({
          discoveredPoints: ['A1-North'],
          currentZone: 'A',
          currentSubZone: 'A1',
          availablePaths: [],
        });
      },
    }),
    {
      name: 'cardland-map-store',
      partialize: (state) => ({
        discoveredPoints: state.discoveredPoints,
        currentZone: state.currentZone,
        currentSubZone: state.currentSubZone,
        availablePaths: state.availablePaths,
      }),
    }
  )
);
