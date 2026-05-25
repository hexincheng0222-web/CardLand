// ============================================================
// CardLand Player Store Types
// ============================================================

import type { Attributes, ActiveStatusEffect } from '@engine/attributes';
import type { Inventory } from '@engine/inventory';
import type { ItemId } from '@data/types';

export interface PlayerStoreState {
  attributes: Attributes;
  inventory: Inventory;
  statusEffects: ActiveStatusEffect[];
  equipment: Record<string, ItemId | null>;
}
