import { describe, it, expect } from 'vitest';
import type { ItemId } from '@data/types';
import {
  createInventory,
  addItem,
  removeItem,
  getItemQuantity,
  calculateWeight,
  hasSpace,
  getUsedSlots,
  isFull,
  clearSlot,
  checkWeightLimit,
  useItem,
  getItemDef,
} from '../inventory';
import type { Inventory, BagSlot } from '../inventory';

// ============================================================
// Helpers
// ============================================================

const slot = (itemId: ItemId, quantity: number): BagSlot => ({
  itemId,
  quantity,
});

function weightOf(id: string): number {
  return getItemDef(id as ItemId)?.weight ?? 0;
}

/** Shorthand: addItem using item-def weight & stackLimit */
function add(inventory: Inventory, itemId: ItemId, quantity: number) {
  const def = getItemDef(itemId)!;
  return addItem(inventory, itemId, quantity, def.weight, def.stackLimit);
}

// ============================================================
// createInventory
// ============================================================

describe('createInventory', () => {
  it('returns empty 12-slot inventory with default params', () => {
    const inv = createInventory();
    expect(inv.slots).toEqual([]);
    expect(inv.maxSlots).toBe(12);
    expect(inv.maxWeight).toBe(100);
  });

  it('accepts custom maxSlots', () => {
    const inv = createInventory(20);
    expect(inv.maxSlots).toBe(20);
  });

  it('accepts custom maxWeight', () => {
    const inv = createInventory(12, 200);
    expect(inv.maxWeight).toBe(200);
  });
});

// ============================================================
// addItem
// ============================================================

describe('addItem', () => {
  it('adds item to empty inventory', () => {
    const inv = createInventory();
    const { inventory } = add(inv, '食物', 3);
    expect(inventory.slots).toHaveLength(1);
    expect(inventory.slots[0].itemId).toBe('食物');
    expect(inventory.slots[0].quantity).toBe(3);
  });

  it('auto-stacks when same item exists', () => {
    const inv = createInventory();
    inv.slots.push(slot('食物', 2));
    const { inventory } = add(inv, '食物', 3);
    expect(inventory.slots).toHaveLength(1);
    expect(inventory.slots[0].quantity).toBe(5);
  });

  it('creates new slot for different item', () => {
    const inv = createInventory();
    inv.slots.push(slot('食物', 2));
    const { inventory } = add(inv, '水', 1);
    expect(inventory.slots).toHaveLength(2);
    expect(inventory.slots.some((s) => s.itemId === '食物' && s.quantity === 2)).toBe(true);
    expect(inventory.slots.some((s) => s.itemId === '水' && s.quantity === 1)).toBe(true);
  });

  it('respects stack limit - splits into new slot', () => {
    // 食物 stackLimit=20, existing 18, add 5 → 20 + 3 overflow to new slot
    const inv = createInventory();
    inv.slots.push(slot('食物', 18));
    const { inventory } = add(inv, '食物', 5);
    expect(inventory.slots).toHaveLength(2);
    const qtys = inventory.slots.filter((s) => s.itemId === '食物').map((s) => s.quantity);
    expect(qtys).toContain(20);
    expect(qtys).toContain(3);
  });

  it('respects custom stack limit (e.g. stack 20)', () => {
    const inv = createInventory();
    const { inventory } = addItem(inv, '食物', 25, 2, 20);
    // 20 in first slot, 5 in second
    expect(inventory.slots).toHaveLength(2);
    const qtys = inventory.slots.map((s) => s.quantity);
    expect(qtys).toContain(20);
    expect(qtys).toContain(5);
  });

  it('fills existing partial slots first, then new slots', () => {
    // 纤维 stackLimit=10, existing 8, add 4 → 10 + 2 in new slot
    const inv = createInventory();
    inv.slots.push(slot('纤维', 8));
    const { inventory } = add(inv, '纤维', 4);
    const fiberSlots = inventory.slots.filter((s) => s.itemId === '纤维');
    expect(fiberSlots).toHaveLength(2);
    expect(fiberSlots[0].quantity).toBe(10);
    expect(fiberSlots[1].quantity).toBe(2);
  });

  it('returns overflow when all 12 slots are full', () => {
    const inv = createInventory();
    for (let i = 0; i < 12; i++) {
      inv.slots.push(slot('食物', 1));
    }
    const { inventory, overflow } = add(inv, '水', 1);
    expect(inventory.slots).toHaveLength(12);
    expect(overflow).toBe(1);
  });

  it('returns overflow when quantity exceeds available slots', () => {
    const inv = createInventory(2); // only 2 slots
    const { inventory, overflow } = add(inv, '食物', 45);
    // stackLimit=20 → 20 + 20 in 2 slots, 5 overflow
    expect(inventory.slots).toHaveLength(2);
    expect(overflow).toBe(5);
  });

  it('returns zero overflow when all items fit', () => {
    const inv = createInventory();
    const { overflow } = add(inv, '食物', 3);
    expect(overflow).toBe(0);
  });

  it('handles zero quantity gracefully', () => {
    const inv = createInventory();
    inv.slots.push(slot('食物', 2));
    const { inventory, overflow } = add(inv, '食物', 0);
    expect(inventory.slots).toHaveLength(1);
    expect(overflow).toBe(0);
  });

  it('does not mutate original inventory', () => {
    const inv = createInventory();
    inv.slots.push(slot('食物', 2));
    const originalSlots = JSON.stringify(inv.slots);
    add(inv, '食物', 3);
    expect(JSON.stringify(inv.slots)).toBe(originalSlots);
  });

  it('handles stack limit of 1 (工具, 藏宝图)', () => {
    const inv = createInventory();
    inv.slots.push(slot('工具', 1));
    const { inventory } = add(inv, '工具', 1);
    const toolSlots = inventory.slots.filter((s) => s.itemId === '工具');
    expect(toolSlots).toHaveLength(2);
    expect(toolSlots[0].quantity).toBe(1);
    expect(toolSlots[1].quantity).toBe(1);
  });
});

// ============================================================
// removeItem
// ============================================================

describe('removeItem', () => {
  it('removes partial quantity from a slot', () => {
    const inv = createInventory();
    inv.slots.push(slot('食物', 5));
    const result = removeItem(inv, '食物', 2);
    expect(result.slots).toHaveLength(1);
    expect(result.slots[0].quantity).toBe(3);
  });

  it('removes exact quantity - slot removed', () => {
    const inv = createInventory();
    inv.slots.push(slot('食物', 5));
    const result = removeItem(inv, '食物', 5);
    expect(result.slots.find((s) => s.itemId === '食物')).toBeUndefined();
    expect(result.slots).toHaveLength(0);
  });

  it('removes from multiple slots', () => {
    const inv = createInventory();
    inv.slots.push(slot('食物', 5));
    inv.slots.push(slot('食物', 3));
    const result = removeItem(inv, '食物', 7);
    expect(result.slots).toHaveLength(1);
    expect(result.slots[0].itemId).toBe('食物');
    expect(result.slots[0].quantity).toBe(1);
  });

  it('removes from end of inventory first', () => {
    const inv = createInventory();
    inv.slots.push(slot('食物', 5));
    inv.slots.push(slot('食物', 3));
    const result = removeItem(inv, '食物', 3);
    expect(result.slots).toHaveLength(1);
    expect(result.slots[0].itemId).toBe('食物');
    expect(result.slots[0].quantity).toBe(5);
  });

  it('throws when item not found', () => {
    const inv = createInventory();
    expect(() => removeItem(inv, '食物', 1)).toThrow('not enough 食物');
  });

  it('throws when insufficient quantity', () => {
    const inv = createInventory();
    inv.slots.push(slot('食物', 2));
    expect(() => removeItem(inv, '食物', 5)).toThrow('not enough 食物');
  });

  it('does not mutate original inventory', () => {
    const inv = createInventory();
    inv.slots.push(slot('食物', 5));
    const originalSlots = JSON.stringify(inv.slots);
    removeItem(inv, '食物', 2);
    expect(JSON.stringify(inv.slots)).toBe(originalSlots);
  });

  it('removes entire slot when quantity goes to 0', () => {
    const inv = createInventory();
    inv.slots.push(slot('食物', 3));
    inv.slots.push(slot('水', 2));
    const result = removeItem(inv, '食物', 3);
    expect(result.slots).toHaveLength(1);
    expect(result.slots[0].itemId).toBe('水');
    expect(result.slots[0].quantity).toBe(2);
  });
});

// ============================================================
// getItemQuantity
// ============================================================

describe('getItemQuantity', () => {
  it('returns 0 for empty inventory', () => {
    const inv = createInventory();
    expect(getItemQuantity(inv, '食物')).toBe(0);
  });

  it('sums across multiple slots', () => {
    const inv = createInventory();
    inv.slots.push(slot('食物', 5));
    inv.slots.push(slot('食物', 3));
    expect(getItemQuantity(inv, '食物')).toBe(8);
  });

  it('ignores other items', () => {
    const inv = createInventory();
    inv.slots.push(slot('食物', 5));
    inv.slots.push(slot('水', 3));
    expect(getItemQuantity(inv, '食物')).toBe(5);
  });
});

// ============================================================
// calculateWeight
// ============================================================

describe('calculateWeight', () => {
  it('returns 0 for empty inventory', () => {
    const inv = createInventory();
    expect(calculateWeight(inv, weightOf)).toBe(0);
  });

  it('computes weight for a single item', () => {
    // 食物 weight=1, quantity=5 => 5
    const inv = createInventory();
    inv.slots.push(slot('食物', 5));
    expect(calculateWeight(inv, weightOf)).toBe(5);
  });

  it('computes weight for multiple items', () => {
    const inv = createInventory();
    inv.slots.push(slot('食物', 3)); // 3
    inv.slots.push(slot('水', 2));   // 2
    inv.slots.push(slot('木材', 1)); // 2
    expect(calculateWeight(inv, weightOf)).toBe(7);
  });

  it('covers all item types with correct weights per 物资图鉴', () => {
    const cases: [ItemId, number, number][] = [
      ['食物', 1, 1], ['食物', 3, 3],
      ['水', 1, 1], ['水', 2, 2],
      ['草药', 1, 1], ['草药', 10, 10],
      ['解毒草', 1, 1], ['解毒草', 3, 3],
      ['蛇胆', 1, 1], ['蛇胆', 2, 2],
      ['木材', 1, 2], ['木材', 3, 6],
      ['石材', 1, 8], ['石材', 2, 16],
      ['纤维', 1, 1], ['纤维', 7, 7],
      ['布料', 1, 2], ['布料', 4, 8],
      ['粘土', 1, 5], ['粘土', 3, 15],
      ['铁矿', 1, 6], ['铁矿', 2, 12],
      ['硫磺', 1, 3], ['硫磺', 5, 15],
      ['黑曜石', 1, 4], ['黑曜石', 2, 8],
      ['绳索', 1, 3], ['绳索', 2, 6],
      ['金属件', 1, 4], ['金属件', 3, 12],
      ['高级材料', 1, 2], ['高级材料', 5, 10],
      ['工具', 1, 5], ['藏宝图', 1, 1], ['渔网', 1, 3],
    ];
    for (const [itemId, qty, expected] of cases) {
      const inv = createInventory();
      inv.slots.push(slot(itemId, qty));
      expect(calculateWeight(inv, weightOf)).toBe(expected);
    }
  });
});

// ============================================================
// hasSpace
// ============================================================

describe('hasSpace', () => {
  it('returns true for empty inventory', () => {
    const inv = createInventory();
    expect(hasSpace(inv, '食物', 5, 10)).toBe(true);
  });

  it('returns true when partial slot has room', () => {
    const inv = createInventory();
    inv.slots.push(slot('食物', 7)); // 3 more space in this slot
    expect(hasSpace(inv, '食物', 3, 10)).toBe(true);
  });

  it('returns true when empty slots available', () => {
    const inv = createInventory();
    inv.slots.push(slot('食物', 10)); // full slot
    expect(hasSpace(inv, '食物', 5, 10)).toBe(true); // new slot needed
  });

  it('returns false when no slots left and partial is full', () => {
    const inv = createInventory(1); // only 1 slot
    inv.slots.push(slot('食物', 10)); // full
    expect(hasSpace(inv, '食物', 1, 10)).toBe(false);
  });

  it('returns true when quantity fits exactly in remaining slots', () => {
    const inv = createInventory(2);
    inv.slots.push(slot('食物', 10)); // full
    // Need to add 10 more → 1 new slot needed, 1 empty slot available
    expect(hasSpace(inv, '食物', 10, 10)).toBe(true);
  });

  it('returns false when quantity needs more slots than available', () => {
    const inv = createInventory(2);
    inv.slots.push(slot('食物', 10)); // full
    // Need to add 11 → 2 new slots needed, only 1 empty slot
    expect(hasSpace(inv, '食物', 11, 10)).toBe(false);
  });
});

// ============================================================
// getUsedSlots
// ============================================================

describe('getUsedSlots', () => {
  it('returns 0 for empty inventory', () => {
    expect(getUsedSlots(createInventory())).toBe(0);
  });

  it('returns correct count', () => {
    const inv = createInventory();
    inv.slots.push(slot('食物', 3));
    inv.slots.push(slot('水', 2));
    expect(getUsedSlots(inv)).toBe(2);
  });
});

// ============================================================
// isFull
// ============================================================

describe('isFull', () => {
  it('returns false for empty inventory', () => {
    expect(isFull(createInventory())).toBe(false);
  });

  it('returns false when partially filled', () => {
    const inv = createInventory();
    inv.slots.push(slot('食物', 3));
    expect(isFull(inv)).toBe(false);
  });

  it('returns true when all slots used', () => {
    const inv = createInventory(2);
    inv.slots.push(slot('食物', 3));
    inv.slots.push(slot('水', 2));
    expect(isFull(inv)).toBe(true);
  });
});

// ============================================================
// clearSlot
// ============================================================

describe('clearSlot', () => {
  it('removes slot at given index', () => {
    const inv = createInventory();
    inv.slots.push(slot('食物', 3));
    inv.slots.push(slot('水', 2));
    inv.slots.push(slot('木材', 1));
    const result = clearSlot(inv, 1); // remove 水
    expect(result.slots).toHaveLength(2);
    expect(result.slots[0].itemId).toBe('食物');
    expect(result.slots[1].itemId).toBe('木材');
  });

  it('does nothing for out-of-bounds index', () => {
    const inv = createInventory();
    inv.slots.push(slot('食物', 3));
    const result = clearSlot(inv, 5);
    expect(result.slots).toHaveLength(1);
  });

  it('does nothing for negative index', () => {
    const inv = createInventory();
    inv.slots.push(slot('食物', 3));
    const result = clearSlot(inv, -1);
    expect(result.slots).toHaveLength(1);
  });

  it('does not mutate original inventory', () => {
    const inv = createInventory();
    inv.slots.push(slot('食物', 3));
    inv.slots.push(slot('水', 2));
    const originalSlots = JSON.stringify(inv.slots);
    clearSlot(inv, 0);
    expect(JSON.stringify(inv.slots)).toBe(originalSlots);
  });
});

// ============================================================
// checkWeightLimit
// ============================================================

describe('checkWeightLimit', () => {
  it('returns 轻装 at 0% weight', () => {
    const inv = createInventory();
    const result = checkWeightLimit(inv, weightOf);
    expect(result.tier).toBe('轻装');
    expect(result.ratio).toBe(0);
    expect(result.canMove).toBe(true);
    expect(result.penalty).toBe(0);
  });

  it('returns 轻装 at exactly 50%', () => {
    const inv = createInventory();
    inv.slots.push(slot('食物', 50)); // 50 * 1 = 50
    const result = checkWeightLimit(inv, weightOf);
    expect(result.tier).toBe('轻装');
    expect(result.canMove).toBe(true);
    expect(result.penalty).toBe(0);
  });

  it('returns 负重 at 51%', () => {
    const inv = createInventory();
    inv.slots.push(slot('食物', 50)); // 50
    inv.slots.push(slot('草药', 1));  // 1 → 51
    const result = checkWeightLimit(inv, weightOf);
    expect(result.tier).toBe('负重');
    expect(result.canMove).toBe(true);
    expect(result.penalty).toBe(0.3);
  });

  it('returns 负重 at exactly 80%', () => {
    const inv = createInventory();
    inv.slots.push(slot('食物', 80)); // 80 * 1 = 80
    const result = checkWeightLimit(inv, weightOf);
    expect(result.tier).toBe('负重');
    expect(result.canMove).toBe(true);
    expect(result.penalty).toBe(0.3);
  });

  it('returns 超重 at 81%', () => {
    const inv = createInventory();
    inv.slots.push(slot('食物', 80)); // 80
    inv.slots.push(slot('草药', 1));  // 1 → 81
    const result = checkWeightLimit(inv, weightOf);
    expect(result.tier).toBe('超重');
    expect(result.canMove).toBe(true);
    expect(result.penalty).toBe(0.5);
  });

  it('returns 超重 at 99%', () => {
    const inv = createInventory();
    inv.slots.push(slot('食物', 99)); // 99 * 1 = 99
    const result = checkWeightLimit(inv, weightOf);
    expect(result.tier).toBe('超重');
    expect(result.canMove).toBe(true);
    expect(result.penalty).toBe(0.5);
  });

  it('returns 过载 at 100%', () => {
    const inv = createInventory();
    inv.slots.push(slot('食物', 100)); // 100 * 1 = 100
    const result = checkWeightLimit(inv, weightOf);
    expect(result.tier).toBe('过载');
    expect(result.ratio).toBe(1);
    expect(result.canMove).toBe(false);
    expect(result.penalty).toBe(Infinity);
  });

  it('returns 过载 above 100%', () => {
    const inv = createInventory();
    inv.slots.push(slot('食物', 100)); // 100
    inv.slots.push(slot('草药', 2));   // 2 → 102
    const result = checkWeightLimit(inv, weightOf);
    expect(result.tier).toBe('过载');
    expect(result.canMove).toBe(false);
  });

  it('works without explicit getItemWeight (uses global item map)', () => {
    const inv = createInventory();
    inv.slots.push(slot('食物', 50)); // 50
    const result = checkWeightLimit(inv);
    expect(result.tier).toBe('轻装');
  });
});

// ============================================================
// useItem
// ============================================================

describe('useItem', () => {
  it('using 食物 restores 饱食度', () => {
    const inv = createInventory();
    inv.slots.push(slot('食物', 3));
    const { inventory, attributeEffect } = useItem(inv, '食物');
    expect(inventory.slots[0].quantity).toBe(2);
    expect(attributeEffect).toEqual({ attributeId: '饱食度', amount: 1 });
  });

  it('using 水 restores 口渴度', () => {
    const inv = createInventory();
    inv.slots.push(slot('水', 2));
    const { inventory, attributeEffect } = useItem(inv, '水');
    expect(inventory.slots[0].quantity).toBe(1);
    expect(attributeEffect).toEqual({ attributeId: '口渴度', amount: 1 });
  });

  it('using 草药 restores 健康值', () => {
    const inv = createInventory();
    inv.slots.push(slot('草药', 5));
    const { inventory, attributeEffect } = useItem(inv, '草药');
    expect(inventory.slots[0].quantity).toBe(4);
    expect(attributeEffect).toEqual({ attributeId: '健康值', amount: 1 });
  });

  it('using 解毒草 restores 健康值', () => {
    const inv = createInventory();
    inv.slots.push(slot('解毒草', 2));
    const { inventory, attributeEffect } = useItem(inv, '解毒草');
    expect(inventory.slots[0].quantity).toBe(1);
    expect(attributeEffect).toEqual({ attributeId: '健康值', amount: 1 });
  });

  it('using 蛇胆 restores 健康值', () => {
    const inv = createInventory();
    inv.slots.push(slot('蛇胆', 2));
    const { inventory, attributeEffect } = useItem(inv, '蛇胆');
    expect(inventory.slots[0].quantity).toBe(1);
    expect(attributeEffect).toEqual({ attributeId: '健康值', amount: 1 });
  });

  it('returns null attributeEffect for non-consumable items', () => {
    const inv = createInventory();
    inv.slots.push(slot('木材', 3));
    const { inventory, attributeEffect } = useItem(inv, '木材');
    expect(inventory.slots[0].quantity).toBe(2);
    expect(attributeEffect).toBeNull();
  });

  it('throws when item not present', () => {
    const inv = createInventory();
    expect(() => useItem(inv, '食物')).toThrow('not enough 食物');
  });

  it('removes slot when last item consumed', () => {
    const inv = createInventory();
    inv.slots.push(slot('食物', 1));
    const { inventory } = useItem(inv, '食物');
    expect(inventory.slots).toHaveLength(0);
  });

  it('does not mutate original inventory', () => {
    const inv = createInventory();
    inv.slots.push(slot('食物', 3));
    const originalSlots = JSON.stringify(inv.slots);
    useItem(inv, '食物');
    expect(JSON.stringify(inv.slots)).toBe(originalSlots);
  });

  it('removes from last slot when multiple stacks exist', () => {
    const inv = createInventory();
    inv.slots.push(slot('食物', 5));
    inv.slots.push(slot('食物', 3));
    const { inventory } = useItem(inv, '食物');
    const foodSlots = inventory.slots.filter((s) => s.itemId === '食物');
    expect(foodSlots).toHaveLength(2);
    expect(foodSlots[0].quantity).toBe(5);
    expect(foodSlots[1].quantity).toBe(2);
  });
});
