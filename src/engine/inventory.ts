import type { ItemId, ItemDef } from '@data/types';
import { ITEMS } from '@data/v1-spec';

// ============================================================
// Types
// ============================================================

export interface InventorySlot {
  itemId: ItemId;
  quantity: number;
}

export interface WeightCheckResult {
  ratio: number;
  tier: '轻装' | '负重' | '超重' | '过载';
  canMove: boolean;
  penalty: number;
}

export interface UseItemResult {
  inventory: InventorySlot[];
  attributeEffect: { attributeId: string; amount: number } | null;
}

// ============================================================
// Item Lookup (cached map for O(1) access)
// ============================================================

const itemMap: Record<string, ItemDef> = {};
for (const item of ITEMS) {
  itemMap[item.id] = item;
}

export function getItemDef(itemId: ItemId): ItemDef | undefined {
  return itemMap[itemId];
}

// ============================================================
// calculateWeight
// ============================================================

/**
 * Calculate total weight of all items in inventory.
 * Pure function - no side effects.
 */
export function calculateWeight(inventory: InventorySlot[]): number {
  let total = 0;
  for (const slot of inventory) {
    const def = itemMap[slot.itemId];
    if (def) {
      total += def.weight * slot.quantity;
    }
  }
  return total;
}

// ============================================================
// checkWeightLimit
// ============================================================

/**
 * Check weight limit against maxWeight (default 100 units).
 * Returns tier info: 轻装(≤50%), 负重(51-80%), 超重(81-99%), 过载(≥100%).
 */
export function checkWeightLimit(
  inventory: InventorySlot[],
  maxWeight: number = 100,
): WeightCheckResult {
  const weight = calculateWeight(inventory);
  const ratio = weight / maxWeight;

  let tier: WeightCheckResult['tier'];
  let canMove: boolean;
  let penalty: number;

  if (ratio <= 0.5) {
    tier = '轻装';
    canMove = true;
    penalty = 0;
  } else if (ratio <= 0.8) {
    tier = '负重';
    canMove = true;
    penalty = 0.3;
  } else if (ratio < 1) {
    tier = '超重';
    canMove = true;
    penalty = 0.5;
  } else {
    tier = '过载';
    canMove = false;
    penalty = Infinity;
  }

  return { ratio, tier, canMove, penalty };
}

// ============================================================
// addItem
// ============================================================

/**
 * Add items to inventory, respecting stack limits.
 * Fills existing partial slots first, then creates new slots.
 * Returns a NEW inventory array. Does not mutate input.
 */
export function addItem(
  inventory: InventorySlot[],
  itemId: ItemId,
  quantity: number,
): InventorySlot[] {
  if (quantity <= 0) {
    return [...inventory];
  }

  const def = itemMap[itemId];
  if (!def) {
    return [...inventory];
  }

  const result = inventory.map((s) => ({ ...s }));
  let remaining = quantity;

  // First pass: fill existing partial slots for this item
  for (const slot of result) {
    if (slot.itemId === itemId && slot.quantity < def.stackLimit) {
      const space = def.stackLimit - slot.quantity;
      const toAdd = Math.min(space, remaining);
      slot.quantity += toAdd;
      remaining -= toAdd;
      if (remaining <= 0) break;
    }
  }

  // Second pass: create new slots for overflow
  while (remaining > 0) {
    const toAdd = Math.min(def.stackLimit, remaining);
    result.push({ itemId, quantity: toAdd });
    remaining -= toAdd;
  }

  return result;
}

// ============================================================
// removeItem
// ============================================================

/**
 * Remove items from inventory.
 * Removes from the END of inventory first (last slot first).
 * Throws if insufficient quantity.
 * Returns a NEW inventory array. Does not mutate input.
 */
export function removeItem(
  inventory: InventorySlot[],
  itemId: ItemId,
  quantity: number,
): InventorySlot[] {
  if (quantity <= 0) {
    return [...inventory];
  }

  const result = inventory.map((s) => ({ ...s }));
  let remaining = quantity;

  // Remove from end first
  for (let i = result.length - 1; i >= 0; i--) {
    if (result[i].itemId === itemId) {
      const toRemove = Math.min(result[i].quantity, remaining);
      result[i].quantity -= toRemove;
      remaining -= toRemove;
      if (remaining <= 0) break;
    }
  }

  if (remaining > 0) {
    throw new Error(`not enough ${itemId} in inventory`);
  }

  // Filter out empty slots
  return result.filter((s) => s.quantity > 0);
}

// ============================================================
// useItem
// ============================================================

/**
 * Use one unit of an item. Returns new inventory and the attribute effect.
 * - 食物 → 饱食度 +1
 * - 水 → 口渴度 +1
 * - 草药/解毒草/蛇胆 → 健康值 +1
 * - Other items: consumed but no attribute effect.
 */
export function useItem(
  inventory: InventorySlot[],
  itemId: ItemId,
): UseItemResult {
  const nextInventory = removeItem(inventory, itemId, 1);

  const attributeEffect = getUseEffect(itemId);

  return { inventory: nextInventory, attributeEffect };
}

/**
 * Determine the attribute effect of using an item.
 */
function getUseEffect(
  itemId: ItemId,
): { attributeId: string; amount: number } | null {
  switch (itemId) {
    case '食物':
      return { attributeId: '饱食度', amount: 1 };
    case '水':
      return { attributeId: '口渴度', amount: 1 };
    case '草药':
    case '解毒草':
    case '蛇胆':
      return { attributeId: '健康值', amount: 1 };
    default:
      return null;
  }
}
