// ============================================================
// CardLand Player Store
// Wires player state (attributes, inventory, equipment, status)
// to React UI via Zustand.
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlayerStoreState } from '../types/playerState';
import type { Attributes, ActiveStatusEffect } from '@engine/attributes';
import { defaultAttributes } from '@engine/turn';
import type { InventorySlot } from '@engine/inventory';
import { useItem as engineUseItem } from '@engine/inventory';
import type { ItemId } from '@data/types';
import { getItemDef } from '@engine/inventory';
import type { GameState } from '@engine/turn';

interface PlayerStoreActions {
  setAttributes: (attributes: Attributes) => void;
  setInventory: (inventory: InventorySlot[]) => void;
  setStatusEffects: (effects: ActiveStatusEffect[]) => void;
  setEquipment: (equipment: Record<string, ItemId | null>) => void;
  useItem: (itemId: ItemId) => void;
  equipItem: (itemId: ItemId) => void;
  syncFromGameState: (gameState: GameState) => void;
  resetPlayer: () => void;
}

export const usePlayerStore = create<PlayerStoreState & PlayerStoreActions>()(
  persist(
    (set, get) => ({
      // -- State --
      attributes: defaultAttributes(),
      inventory: [],
      statusEffects: [],
      equipment: {},

      // -- Actions --
      setAttributes: (attributes) => set({ attributes }),

      setInventory: (inventory) => set({ inventory }),

      setStatusEffects: (effects) => set({ statusEffects: effects }),

      setEquipment: (equipment) => set({ equipment }),

      useItem: (itemId) => {
        const { inventory, attributes } = get();
        const result = engineUseItem(inventory, itemId);
        const nextAttributes = { ...attributes };
        if (result.attributeEffect) {
          const key = result.attributeEffect.attributeId as keyof Attributes;
          nextAttributes[key] = (nextAttributes[key] ?? 0) + result.attributeEffect.amount;
        }
        set({
          inventory: result.inventory,
          attributes: nextAttributes,
        });
      },

      equipItem: (itemId) => {
        const { equipment } = get();
        const itemDef = getItemDef(itemId);
        if (!itemDef) return;

        const effect = itemDef.description || '';
        let slot: string | null = null;
        if (effect.includes('攻击') || itemId === '工具' || itemId === '黑曜石') {
          slot = 'weapon';
        } else if (effect.includes('防御') || itemId === '布料') {
          slot = 'armor';
        }
        if (!slot) return;

        const nextEquipment = { ...equipment };
        nextEquipment[slot] = nextEquipment[slot] === itemId ? null : itemId;
        set({ equipment: nextEquipment });
      },

      syncFromGameState: (gameState) => {
        set({
          attributes: gameState.attributes,
          inventory: gameState.inventory,
          statusEffects: gameState.statusEffects,
        });
      },

      resetPlayer: () => {
        set({
          attributes: defaultAttributes(),
          inventory: [],
          statusEffects: [],
          equipment: {},
        });
      },
    }),
    {
      name: 'cardland-player-store',
      partialize: (state) => ({
        attributes: state.attributes,
        inventory: state.inventory,
        statusEffects: state.statusEffects,
        equipment: state.equipment,
      }),
    }
  )
);
