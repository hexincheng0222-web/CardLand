import type {
  ItemId,
  ItemDef,
  PerishableItem,
  PreservationMethod,
  SpoilageResult,
} from '@data/types';
import { ITEMS, SPOILAGE_PENALTIES } from '@data/v1-spec';

const itemMap = new Map<string, ItemDef>();
for (const item of ITEMS) {
  itemMap.set(item.id, item);
}

export function getItemDef(itemId: ItemId): ItemDef {
  const def = itemMap.get(itemId);
  if (!def) {
    throw new Error(`Unknown item: ${itemId}`);
  }
  return def;
}

export function createPerishableItem(
  itemId: ItemId,
  currentTime: number,
): PerishableItem {
  const def = getItemDef(itemId);
  if (def.shelfLife === undefined) {
    throw new Error(`Item ${itemId} has no shelf life`);
  }
  return {
    itemId,
    quantity: 1,
    createdAt: currentTime,
  };
}

export function isSpoiled(item: PerishableItem, currentTime: number): boolean {
  const def = getItemDef(item.itemId);
  if (def.shelfLife === undefined) return false;
  const effectiveShelfLife = item.adjustedShelfLife ?? def.shelfLife;
  const elapsedHours = (currentTime - item.createdAt) / 60;
  return elapsedHours >= effectiveShelfLife;
}

export function getRemainingShelfLife(
  item: PerishableItem,
  currentTime: number,
): number {
  const def = getItemDef(item.itemId);
  if (def.shelfLife === undefined) return Infinity;
  const effectiveShelfLife = item.adjustedShelfLife ?? def.shelfLife;
  const elapsedHours = (currentTime - item.createdAt) / 60;
  return Math.max(0, effectiveShelfLife - elapsedHours);
}

export function checkSpoilage(
  items: BagSlot[],
  currentTime: number,
): SpoilageResult {
  const spoiledItems: SpoilageResult['spoiledItems'] = [];

  for (let i = 0; i < items.length; i++) {
    const slot = items[i];
    const def = getItemDef(slot.itemId as ItemId);
    if (def.shelfLife === undefined) continue;

    const item: PerishableItem = {
      itemId: slot.itemId as ItemId,
      quantity: slot.quantity,
      createdAt: slot.createdAt ?? currentTime,
      adjustedShelfLife: slot.adjustedShelfLife,
    };

    if (isSpoiled(item, currentTime)) {
      const penalty = SPOILAGE_PENALTIES[item.itemId] ?? { type: '无' };
      spoiledItems.push({ itemIndex: i, itemId: item.itemId, penalty });
    }
  }

  return { spoiledItems, totalChecked: items.length };
}

const SHELF_LIFE_BONUS: Record<PreservationMethod, number> = {
  '烹饪': 10,
  '腌制': 25,
  '庇护所Lv2': 0,
};

export function preserveItem(
  item: PerishableItem,
  method: PreservationMethod,
): PerishableItem {
  const def = getItemDef(item.itemId);
  if (def.shelfLife === undefined) {
    throw new Error(`Item ${item.itemId} has no shelf life to preserve`);
  }

  const baseShelfLife = item.adjustedShelfLife ?? def.shelfLife;

  if (method === '庇护所Lv2') {
    return {
      ...item,
      preservedBy: method,
      adjustedShelfLife: baseShelfLife * 1.5,
    };
  }

  const bonus = SHELF_LIFE_BONUS[method];
  return {
    ...item,
    preservedBy: method,
    adjustedShelfLife: baseShelfLife + bonus,
  };
}

import type { BagSlot } from './inventory';

export function markSpoiled(slot: BagSlot): BagSlot {
  return { ...slot, adjustedShelfLife: 0 };
}
