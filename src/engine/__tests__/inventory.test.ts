import { describe, it, expect } from 'vitest';
import type { ItemId } from '@data/types';
import {
  calculateWeight,
  checkWeightLimit,
  addItem,
  removeItem,
  useItem,
} from '../inventory';
import type { InventorySlot } from '../inventory';

// Helper: create a slot
const slot = (itemId: ItemId, quantity: number): InventorySlot => ({
  itemId,
  quantity,
});

// ============================================================
// calculateWeight
// ============================================================

describe('calculateWeight', () => {
  it('returns 0 for empty inventory', () => {
    expect(calculateWeight([])).toBe(0);
  });

  it('computes weight for a single item', () => {
    // 食物 weight=2, quantity=5 => 10
    expect(calculateWeight([slot('食物', 5)])).toBe(10);
  });

  it('computes weight for multiple items', () => {
    const inv = [
      slot('食物', 3), // 6
      slot('水', 2),   // 6
      slot('木材', 1), // 5
    ];
    expect(calculateWeight(inv)).toBe(17);
  });

  it('covers all 16+ item types with correct weights per 物资图鉴 v0.9', () => {
    // Weight table:
    // 食物=2, 水=3, 草药=1, 解毒草=1, 蛇胆=1
    // 木材=5, 石材=8, 纤维=1, 布料=2, 粘土=5
    // 铁矿=6, 硫磺=3, 黑曜石=4
    // 绳索=3, 金属件=4, 高级材料=2, 工具=5, 藏宝图=1, 渔网=3
    const cases: [ItemId, number, number][] = [
      ['食物', 1, 2],
      ['食物', 3, 6],
      ['水', 1, 3],
      ['水', 2, 6],
      ['草药', 1, 1],
      ['草药', 10, 10],
      ['解毒草', 1, 1],
      ['解毒草', 3, 3],
      ['蛇胆', 1, 1],
      ['蛇胆', 2, 2],
      ['木材', 1, 5],
      ['木材', 3, 15],
      ['石材', 1, 8],
      ['石材', 2, 16],
      ['纤维', 1, 1],
      ['纤维', 7, 7],
      ['布料', 1, 2],
      ['布料', 4, 8],
      ['粘土', 1, 5],
      ['粘土', 3, 15],
      ['铁矿', 1, 6],
      ['铁矿', 2, 12],
      ['硫磺', 1, 3],
      ['硫磺', 5, 15],
      ['黑曜石', 1, 4],
      ['黑曜石', 2, 8],
      ['绳索', 1, 3],
      ['绳索', 2, 6],
      ['金属件', 1, 4],
      ['金属件', 3, 12],
      ['高级材料', 1, 2],
      ['高级材料', 5, 10],
      ['工具', 1, 5],
      ['藏宝图', 1, 1],
      ['渔网', 1, 3],
    ];
    for (const [itemId, qty, expected] of cases) {
      expect(calculateWeight([slot(itemId, qty)])).toBe(expected);
    }
  });
});

// ============================================================
// checkWeightLimit
// ============================================================

describe('checkWeightLimit', () => {
  it('returns 轻装 at 0% weight', () => {
    const result = checkWeightLimit([]);
    expect(result.tier).toBe('轻装');
    expect(result.ratio).toBe(0);
    expect(result.canMove).toBe(true);
    expect(result.penalty).toBe(0);
  });

  it('returns 轻装 at exactly 50%', () => {
    // 50 units = 50%
    const inv = [slot('食物', 25)]; // 25 * 2 = 50
    const result = checkWeightLimit(inv);
    expect(result.tier).toBe('轻装');
    expect(result.canMove).toBe(true);
    expect(result.penalty).toBe(0);
  });

  it('returns 负重 at 51%', () => {
    // 51 units = 51%
    const inv = [slot('食物', 25), slot('草药', 1)]; // 50 + 1 = 51
    const result = checkWeightLimit(inv);
    expect(result.tier).toBe('负重');
    expect(result.canMove).toBe(true);
    expect(result.penalty).toBe(0.3);
  });

  it('returns 负重 at exactly 80%', () => {
    // 80 units = 80%
    const inv = [slot('食物', 40)]; // 40 * 2 = 80
    const result = checkWeightLimit(inv);
    expect(result.tier).toBe('负重');
    expect(result.canMove).toBe(true);
    expect(result.penalty).toBe(0.3);
  });

  it('returns 超重 at 81%', () => {
    // 81 units = 81%
    const inv = [slot('食物', 40), slot('草药', 1)]; // 80 + 1 = 81
    const result = checkWeightLimit(inv);
    expect(result.tier).toBe('超重');
    expect(result.canMove).toBe(true);
    expect(result.penalty).toBe(0.5);
  });

  it('returns 超重 at 99%', () => {
    // 99 units = 99%
    const inv: InventorySlot[] = [
      slot('食物', 45), // 90
      slot('水', 3),    // 9 => 99
    ];
    const result = checkWeightLimit(inv);
    expect(result.tier).toBe('超重');
    expect(result.canMove).toBe(true);
    expect(result.penalty).toBe(0.5);
  });

  it('returns 过载 at 100%', () => {
    // 100 units
    const inv: InventorySlot[] = [
      slot('食物', 50), // 100
    ];
    const result = checkWeightLimit(inv);
    expect(result.tier).toBe('过载');
    expect(result.ratio).toBe(1);
    expect(result.canMove).toBe(false);
    expect(result.penalty).toBe(Infinity);
  });

  it('returns 过载 above 100%', () => {
    // 102 units
    const inv: InventorySlot[] = [
      slot('食物', 50), // 100
      slot('草药', 2),  // 2 => 102
    ];
    const result = checkWeightLimit(inv);
    expect(result.tier).toBe('过载');
    expect(result.canMove).toBe(false);
  });

  it('accepts custom maxWeight', () => {
    const inv = [slot('食物', 10)]; // 20 weight, 20/50 = 40%
    const result = checkWeightLimit(inv, 50);
    expect(result.ratio).toBe(0.4);
    expect(result.tier).toBe('轻装');
  });
});

// ============================================================
// addItem
// ============================================================

describe('addItem', () => {
  it('adds item to empty inventory', () => {
    const result = addItem([], '食物', 3);
    expect(result).toHaveLength(1);
    expect(result[0].itemId).toBe('食物');
    expect(result[0].quantity).toBe(3);
  });

  it('stacks into existing slot', () => {
    const inv = [slot('食物', 2)];
    const result = addItem(inv, '食物', 3);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(5);
  });

  it('creates new slot for different item', () => {
    const inv = [slot('食物', 2)];
    const result = addItem(inv, '水', 1);
    expect(result).toHaveLength(2);
    expect(result.some((s) => s.itemId === '食物' && s.quantity === 2)).toBe(true);
    expect(result.some((s) => s.itemId === '水' && s.quantity === 1)).toBe(true);
  });

  it('respects stack limit - splits into new slot', () => {
    // 木材 stackLimit=5, add 3 to existing slot with 3 => 6 total, 5 in first, 1 in second
    const inv = [slot('木材', 3)];
    const result = addItem(inv, '木材', 3);
    expect(result).toHaveLength(2);
    // One slot should have 5, the other 1
    const qtys = result.filter((s) => s.itemId === '木材').map((s) => s.quantity);
    expect(qtys).toContain(5);
    expect(qtys).toContain(1);
  });

  it('respects stack limit - fills existing partial slot first', () => {
    // 木材 stackLimit=5, existing 2, add 4 => fill to 5, remaining 1 in new slot
    const inv = [slot('木材', 2)];
    const result = addItem(inv, '木材', 4);
    const woodSlots = result.filter((s) => s.itemId === '木材');
    expect(woodSlots).toHaveLength(2);
    const qtys = woodSlots.map((s) => s.quantity);
    expect(qtys).toContain(5);
    expect(qtys).toContain(1);
  });

  it('fills multiple partial slots correctly', () => {
    // 纤维 stackLimit=10, two existing slots: 8 and 9, add 5
    // First slot: 8 + 2 = 10 (full)
    // Remaining: 3 → second slot: 9 + 1 = 10 (full)
    // Remaining: 2 → new slot with 2
    const inv = [slot('纤维', 8), slot('木材', 1), slot('纤维', 9)];
    const result = addItem(inv, '纤维', 5);
    const fiberSlots = result.filter((s) => s.itemId === '纤维');
    expect(fiberSlots).toHaveLength(3);
    const qtys = fiberSlots.map((s) => s.quantity);
    expect(qtys).toContain(10);
    expect(qtys).toContain(10);
    expect(qtys).toContain(2);
    // 木材 still there
    expect(result.some((s) => s.itemId === '木材' && s.quantity === 1)).toBe(true);
  });

  it('does not mutate original inventory', () => {
    const inv = [slot('食物', 2)];
    const result = addItem(inv, '食物', 3);
    expect(inv[0].quantity).toBe(2); // unchanged
    expect(result[0].quantity).toBe(5);
    expect(inv).not.toBe(result);
  });

  it('handles stack limit of 1 (工具, 藏宝图)', () => {
    const inv = [slot('工具', 1)];
    const result = addItem(inv, '工具', 1);
    expect(result).toHaveLength(2);
    const toolSlots = result.filter((s) => s.itemId === '工具');
    expect(toolSlots).toHaveLength(2);
    expect(toolSlots[0].quantity).toBe(1);
    expect(toolSlots[1].quantity).toBe(1);
  });

  it('adds zero quantity returns same inventory', () => {
    const inv = [slot('食物', 2)];
    const result = addItem(inv, '食物', 0);
    expect(result).toEqual(inv);
    expect(result).not.toBe(inv); // new array
  });
});

// ============================================================
// removeItem
// ============================================================

describe('removeItem', () => {
  it('removes partial quantity from a slot', () => {
    const inv = [slot('食物', 5)];
    const result = removeItem(inv, '食物', 2);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(3);
  });

  it('removes exact quantity - slot removed', () => {
    const inv = [slot('食物', 5)];
    const result = removeItem(inv, '食物', 5);
    expect(result.find((s) => s.itemId === '食物')).toBeUndefined();
    expect(result).toHaveLength(0);
  });

  it('removes from multiple slots', () => {
    // Two stacks of 食物: 5 and 3, remove 7
    const inv = [slot('食物', 5), slot('食物', 3)];
    const result = removeItem(inv, '食物', 7);
    expect(result).toHaveLength(1);
    expect(result[0].itemId).toBe('食物');
    expect(result[0].quantity).toBe(1);
  });

  it('removes from end of inventory first (last-in first-removed)', () => {
    // The removeItem should remove from the last slot first
    const inv = [slot('食物', 5), slot('食物', 3)];
    const result = removeItem(inv, '食物', 3);
    expect(result).toHaveLength(1);
    expect(result[0].itemId).toBe('食物');
    expect(result[0].quantity).toBe(5);
  });

  it('throws when item not found', () => {
    expect(() => removeItem([], '食物', 1)).toThrow('not enough 食物');
  });

  it('throws when insufficient quantity', () => {
    expect(() => removeItem([slot('食物', 2)], '食物', 5)).toThrow(
      'not enough 食物',
    );
  });

  it('does not mutate original inventory', () => {
    const inv = [slot('食物', 5)];
    const result = removeItem(inv, '食物', 2);
    expect(inv[0].quantity).toBe(5);
    expect(result[0].quantity).toBe(3);
  });

  it('removes entire slot when quantity goes to 0', () => {
    const inv = [slot('食物', 3), slot('水', 2)];
    const result = removeItem(inv, '食物', 3);
    expect(result).toHaveLength(1);
    expect(result[0].itemId).toBe('水');
    expect(result[0].quantity).toBe(2);
  });
});

// ============================================================
// useItem
// ============================================================

describe('useItem', () => {
  it('using 食物 restores 饱食度', () => {
    const inv = [slot('食物', 3)];
    const { inventory, attributeEffect } = useItem(inv, '食物');
    expect(inventory[0].quantity).toBe(2);
    expect(attributeEffect).toEqual({
      attributeId: '饱食度',
      amount: 1,
    });
  });

  it('using 水 restores 口渴度', () => {
    const inv = [slot('水', 2)];
    const { inventory, attributeEffect } = useItem(inv, '水');
    expect(inventory[0].quantity).toBe(1);
    expect(attributeEffect).toEqual({
      attributeId: '口渴度',
      amount: 1,
    });
  });

  it('using 草药 restores 健康值', () => {
    const inv = [slot('草药', 5)];
    const { inventory, attributeEffect } = useItem(inv, '草药');
    expect(inventory[0].quantity).toBe(4);
    expect(attributeEffect).toEqual({
      attributeId: '健康值',
      amount: 1,
    });
  });

  it('using 解毒草 restores 健康值', () => {
    const inv = [slot('解毒草', 2)];
    const { inventory, attributeEffect } = useItem(inv, '解毒草');
    expect(inventory[0].quantity).toBe(1);
    expect(attributeEffect).toEqual({
      attributeId: '健康值',
      amount: 1,
    });
  });

  it('using 蛇胆 restores 健康值', () => {
    const inv = [slot('蛇胆', 2)];
    const { inventory, attributeEffect } = useItem(inv, '蛇胆');
    expect(inventory[0].quantity).toBe(1);
    expect(attributeEffect).toEqual({
      attributeId: '健康值',
      amount: 1,
    });
  });

  it('returns null attributeEffect for non-consumable items', () => {
    const inv = [slot('木材', 3)];
    const { inventory, attributeEffect } = useItem(inv, '木材');
    expect(inventory[0].quantity).toBe(2); // still consumed
    expect(attributeEffect).toBeNull();
  });

  it('throws when consumable not present', () => {
    expect(() => useItem([], '食物')).toThrow('not enough 食物');
  });

  it('removes slot when last item consumed', () => {
    const inv = [slot('食物', 1)];
    const { inventory } = useItem(inv, '食物');
    expect(inventory).toHaveLength(0);
  });

  it('does not mutate original inventory', () => {
    const inv = [slot('食物', 3)];
    const { inventory } = useItem(inv, '食物');
    expect(inv[0].quantity).toBe(3); // unchanged
    expect(inventory[0].quantity).toBe(2);
  });

  it('removes from last slot when multiple stacks exist', () => {
    const inv = [slot('食物', 5), slot('食物', 3)];
    const { inventory } = useItem(inv, '食物');
    const foodSlots = inventory.filter((s) => s.itemId === '食物');
    expect(foodSlots).toHaveLength(2);
    // First slot unchanged, last slot decreased
    expect(foodSlots[0].quantity).toBe(5);
    expect(foodSlots[1].quantity).toBe(2);
  });
});
