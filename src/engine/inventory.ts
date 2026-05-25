// ============================================================
// CardLand V1 Inventory Engine (12-slot bag + stack + weight)
// Pure functions — no side effects, no mutation
// ============================================================

import type { ItemId, ItemDef } from '@data/types';
import { ITEMS } from '@data/v1-spec';

// ============================================================
// Types
// ============================================================

export interface BagSlot {
  itemId: string;
  quantity: number;
  /** Total minutes when the item was added to inventory. Used for perishable tracking. */
  createdAt?: number;
  /** Per-item shelf life override (hours). If undefined, use item def. */
  adjustedShelfLife?: number;
}

/** Backward-compatibility alias */
export type InventorySlot = BagSlot;

export interface Inventory {
  slots: BagSlot[];
  maxSlots: number;   // 12 default, 20 expanded
  maxWeight: number;  // 100 default
}

export interface WeightCheckResult {
  ratio: number;
  tier: '轻装' | '负重' | '超重' | '过载';
  canMove: boolean;
  penalty: number;
}

export interface UseItemResult {
  inventory: Inventory;
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
// createInventory
// ============================================================

/**
 * Create an empty inventory with default 12 slots and 100 max weight.
 * Pure function.
 */
export function createInventory(
  maxSlots: number = 12,
  maxWeight: number = 100,
): Inventory {
  return { slots: [], maxSlots, maxWeight };
}

// ============================================================
// addItem
// ============================================================

/**
 * Add items to inventory, respecting stack limits and slot capacity.
 * Fills existing partial slots first, then creates new slots.
 * Returns a NEW inventory and the overflow quantity that could not fit.
 * Pure function — does not mutate input.
 */
export function addItem(
  inventory: Inventory,
  itemId: string,
  quantity: number,
  itemWeight: number,
  stackLimit: number,
): { inventory: Inventory; overflow: number } {
  if (quantity <= 0) {
    return {
      inventory: { ...inventory, slots: inventory.slots.map((s) => ({ ...s })) },
      overflow: 0,
    };
  }

  const slots = inventory.slots.map((s) => ({ ...s }));
  let remaining = quantity;

  // Track current weight as we add
  let currentWeight = 0;
  for (const s of slots) {
    const w = itemMap[s.itemId]?.weight ?? 0;
    currentWeight += w * s.quantity;
  }

  // First pass: fill existing partial slots for this item
  for (const slot of slots) {
    if (remaining <= 0) break;
    if (slot.itemId === itemId && slot.quantity < stackLimit) {
      const space = stackLimit - slot.quantity;
      let toAdd = Math.min(space, remaining);
      // Weight check
      if (itemWeight > 0) {
        const canByWeight = Math.floor((inventory.maxWeight - currentWeight) / itemWeight);
        toAdd = Math.min(toAdd, canByWeight);
      }
      if (toAdd <= 0) continue;
      slot.quantity += toAdd;
      remaining -= toAdd;
      currentWeight += toAdd * itemWeight;
    }
  }

  // Second pass: create new slots for remaining quantity
  const now = Date.now();
  while (remaining > 0 && slots.length < inventory.maxSlots) {
    let toAdd = Math.min(stackLimit, remaining);
    // Weight check
    if (itemWeight > 0) {
      const canByWeight = Math.floor((inventory.maxWeight - currentWeight) / itemWeight);
      toAdd = Math.min(toAdd, canByWeight);
    }
    if (toAdd <= 0) break;
    slots.push({ itemId, quantity: toAdd, createdAt: now });
    remaining -= toAdd;
    currentWeight += toAdd * itemWeight;
  }

  return {
    inventory: { ...inventory, slots },
    overflow: remaining,
  };
}

// ============================================================
// removeItem
// ============================================================

/**
 * Remove items from inventory.
 * Removes from the END of inventory first (last slot first).
 * Throws if insufficient quantity.
 * Returns a NEW inventory. Does not mutate input.
 */
export function removeItem(
  inventory: Inventory,
  itemId: string,
  quantity: number,
): Inventory {
  if (quantity <= 0) {
    return { ...inventory, slots: inventory.slots.map((s) => ({ ...s })) };
  }

  const slots = inventory.slots.map((s) => ({ ...s }));
  let remaining = quantity;

  // Remove from end first
  for (let i = slots.length - 1; i >= 0; i--) {
    if (slots[i].itemId === itemId) {
      const toRemove = Math.min(slots[i].quantity, remaining);
      slots[i].quantity -= toRemove;
      remaining -= toRemove;
      if (remaining <= 0) break;
    }
  }

  if (remaining > 0) {
    throw new Error(`not enough ${itemId} in inventory`);
  }

  // Filter out empty slots
  return {
    ...inventory,
    slots: slots.filter((s) => s.quantity > 0),
  };
}

// ============================================================
// getItemQuantity
// ============================================================

/**
 * Count total quantity of a specific item across all slots.
 */
export function getItemQuantity(inventory: Inventory, itemId: string): number {
  let total = 0;
  for (const slot of inventory.slots) {
    if (slot.itemId === itemId) {
      total += slot.quantity;
    }
  }
  return total;
}

// ============================================================
// calculateWeight
// ============================================================

/**
 * Calculate total weight of all items in inventory.
 * Takes a weight lookup callback for purity.
 * Pure function — no side effects.
 */
export function calculateWeight(
  inventory: Inventory,
  getItemWeight: (id: string) => number,
): number {
  let total = 0;
  for (const slot of inventory.slots) {
    total += getItemWeight(slot.itemId) * slot.quantity;
  }
  return total;
}

// ============================================================
// hasSpace
// ============================================================

/**
 * Check if the inventory has enough room (slots + partial stacks)
 * to add the given quantity of an item with the given stack limit.
 * Does NOT check weight — caller should verify weight separately.
 */
export function hasSpace(
  inventory: Inventory,
  itemId: string,
  quantity: number,
  stackLimit: number,
): boolean {
  let remaining = quantity;

  // Check existing partial slots for this item
  for (const slot of inventory.slots) {
    if (remaining <= 0) break;
    if (slot.itemId === itemId && slot.quantity < stackLimit) {
      remaining -= stackLimit - slot.quantity;
    }
  }

  if (remaining <= 0) return true;

  // Check how many new slots are needed
  const emptySlots = inventory.maxSlots - inventory.slots.length;
  const slotsNeeded = Math.ceil(remaining / stackLimit);
  return slotsNeeded <= emptySlots;
}

// ============================================================
// getUsedSlots
// ============================================================

/**
 * Count how many bag slots are currently occupied.
 */
export function getUsedSlots(inventory: Inventory): number {
  return inventory.slots.length;
}

// ============================================================
// isFull
// ============================================================

/**
 * Check whether all bag slots are occupied.
 */
export function isFull(inventory: Inventory): boolean {
  return inventory.slots.length >= inventory.maxSlots;
}

// ============================================================
// clearSlot
// ============================================================

/**
 * Remove the slot at the given index.
 * Returns a NEW inventory. Does not mutate input.
 */
export function clearSlot(inventory: Inventory, index: number): Inventory {
  if (index < 0 || index >= inventory.slots.length) {
    return { ...inventory, slots: inventory.slots.map((s) => ({ ...s })) };
  }
  const slots = inventory.slots.filter((_, i) => i !== index);
  return { ...inventory, slots };
}

// ============================================================
// checkWeightLimit
// ============================================================

/**
 * Check weight limit against inventory.maxWeight.
 * Returns tier info: 轻装(≤50%), 负重(51-80%), 超重(81-99%), 过载(≥100%).
 * Pure function.
 */
export function checkWeightLimit(
  inventory: Inventory,
  getItemWeight?: (id: string) => number,
): WeightCheckResult {
  const weightFn = getItemWeight ?? ((id: string) => itemMap[id]?.weight ?? 0);
  const weight = calculateWeight(inventory, weightFn);
  const ratio = inventory.maxWeight > 0 ? weight / inventory.maxWeight : 0;

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
  inventory: Inventory,
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
