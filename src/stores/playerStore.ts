// ============================================================
// CardLand Player Store — BACKWARD COMPAT SHIM
// Thin Zustand store that delegates to unified useGameStore.
// New code should import from useGameStore directly.
// ============================================================

import { create } from 'zustand';
import { useGameStore } from './gameStore';
import type { Attributes } from '@engine/attributes';
import type { Inventory } from '@engine/inventory';
import type { ItemId } from '@data/types';
import type { StatusEffect } from '@engine/status';
import type { EquipmentSlots } from './gameStore';

interface PlayerStoreState {
  attributes: Attributes;
  inventory: Inventory;
  statusEffects: StatusEffect[];
  equipment: EquipmentSlots;
  useItem: (itemId: ItemId) => void;
  equipItem: (itemId: ItemId) => void;
}

/**
 * @deprecated Use useGameStore directly. This shim exists for backward compat.
 *
 * Subscribes to the unified store and exposes only player-related state.
 * Components that import usePlayerStore will continue to work, but should
 * migrate to useGameStore for full access to clock, weather, and map state.
 */
export const usePlayerStore = create<PlayerStoreState>()(() => ({
  // Subscribe to unified store for initial values
  attributes: useGameStore.getState().attributes,
  inventory: useGameStore.getState().inventory,
  statusEffects: useGameStore.getState().statusEffects,
  equipment: useGameStore.getState().equipment,

  useItem: (itemId: ItemId) => {
    useGameStore.getState().useItem(itemId);
  },

  equipItem: (itemId: ItemId) => {
    useGameStore.getState().equipItem(itemId);
  },
}));

// Sync from unified store on every change
useGameStore.subscribe((state) => {
  usePlayerStore.setState({
    attributes: state.attributes,
    inventory: state.inventory,
    statusEffects: state.statusEffects,
    equipment: state.equipment,
  });
});
