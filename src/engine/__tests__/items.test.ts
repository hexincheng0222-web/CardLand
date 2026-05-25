import { describe, it, expect } from 'vitest';
import {
  getItemDef,
  createPerishableItem,
  isSpoiled,
  getRemainingShelfLife,
  checkSpoilage,
  preserveItem,
} from '../items';
import type { PerishableItem } from '@data/types';
import type { BagSlot } from '../inventory';

describe('getItemDef', () => {
  it('returns definition for known item', () => {
    const def = getItemDef('生肉');
    expect(def.id).toBe('生肉');
    expect(def.shelfLife).toBe(5);
  });

  it('returns definition for non-perishable item', () => {
    const def = getItemDef('木材');
    expect(def.id).toBe('木材');
    expect(def.shelfLife).toBeUndefined();
  });

  it('throws for unknown item', () => {
    expect(() => getItemDef('不存在' as any)).toThrow('Unknown item');
  });
});

describe('createPerishableItem', () => {
  it('sets correct creation time', () => {
    const item = createPerishableItem('生肉', 360);
    expect(item.itemId).toBe('生肉');
    expect(item.quantity).toBe(1);
    expect(item.createdAt).toBe(360);
  });

  it('throws for non-perishable item', () => {
    expect(() => createPerishableItem('木材', 0)).toThrow('no shelf life');
  });
});

describe('isSpoiled', () => {
  it('returns false before shelfLife expires', () => {
    const item = createPerishableItem('生肉', 360);
    expect(isSpoiled(item, 360 + 4 * 60)).toBe(false);
  });

  it('returns true after shelfLife expires', () => {
    const item = createPerishableItem('生肉', 360);
    expect(isSpoiled(item, 360 + 5 * 60)).toBe(true);
  });

  it('returns false exactly at shelfLife boundary (not yet expired)', () => {
    const item = createPerishableItem('蟹贝', 0);
    expect(isSpoiled(item, 3 * 60)).toBe(false);
  });

  it('returns true one minute past shelfLife', () => {
    const item = createPerishableItem('蟹贝', 0);
    expect(isSpoiled(item, 4 * 60)).toBe(true);
  });

  it('returns false for non-perishable items', () => {
    const item: PerishableItem = { itemId: '木材', quantity: 1, createdAt: 0 };
    expect(isSpoiled(item, 999999)).toBe(false);
  });
});

describe('getRemainingShelfLife', () => {
  it('decreases over time', () => {
    const item = createPerishableItem('生肉', 360);
    const at2h = getRemainingShelfLife(item, 360 + 2 * 60);
    const at4h = getRemainingShelfLife(item, 360 + 4 * 60);
    expect(at2h).toBe(3);
    expect(at4h).toBe(1);
  });

  it('returns 0 when expired', () => {
    const item = createPerishableItem('生肉', 360);
    expect(getRemainingShelfLife(item, 360 + 10 * 60)).toBe(0);
  });

  it('returns full shelfLife at creation time', () => {
    const item = createPerishableItem('蛋', 100);
    expect(getRemainingShelfLife(item, 100)).toBe(6);
  });

  it('returns Infinity for non-perishable items', () => {
    const item: PerishableItem = { itemId: '草药', quantity: 1, createdAt: 0 };
    expect(getRemainingShelfLife(item, 999999)).toBe(Infinity);
  });
});

describe('checkSpoilage', () => {
  it('returns correct spoiled items', () => {
    const items: BagSlot[] = [
      { itemId: '生肉', quantity: 1, createdAt: 0 },
      { itemId: '蟹贝', quantity: 1, createdAt: 0 },
      { itemId: '椰子', quantity: 1, createdAt: 0 },
    ];
    const result = checkSpoilage(items, 6 * 60);
    expect(result.totalChecked).toBe(3);
    expect(result.spoiledItems).toHaveLength(2);
    expect(result.spoiledItems[0].itemId).toBe('生肉');
    expect(result.spoiledItems[1].itemId).toBe('蟹贝');
  });

  it('returns empty when nothing spoiled', () => {
    const items: BagSlot[] = [
      { itemId: '生肉', quantity: 1, createdAt: 0 },
      { itemId: '椰子', quantity: 1, createdAt: 0 },
    ];
    const result = checkSpoilage(items, 2 * 60);
    expect(result.spoiledItems).toHaveLength(0);
  });

  it('assigns correct penalties', () => {
    const items: BagSlot[] = [
      { itemId: '生肉', quantity: 1, createdAt: 0 },
      { itemId: '熟肉', quantity: 1, createdAt: 0 },
    ];
    const result = checkSpoilage(items, 20 * 60);
    expect(result.spoiledItems[0].penalty.type).toBe('中毒');
    expect(result.spoiledItems[0].penalty.poisonChance).toBe(0.5);
    expect(result.spoiledItems[1].penalty.type).toBe('效果衰减');
    expect(result.spoiledItems[1].penalty.effectReduction).toBe(0.3);
  });

  it('handles empty array', () => {
    const result = checkSpoilage([], 100);
    expect(result.spoiledItems).toHaveLength(0);
    expect(result.totalChecked).toBe(0);
  });
});

describe('preserveItem', () => {
  it('烹饪 extends shelfLife by 10h', () => {
    const item = createPerishableItem('生肉', 0);
    const preserved = preserveItem(item, '烹饪');
    expect(preserved.adjustedShelfLife).toBe(15);
    expect(preserved.preservedBy).toBe('烹饪');
  });

  it('腌制 extends shelfLife by 25h', () => {
    const item = createPerishableItem('生肉', 0);
    const preserved = preserveItem(item, '腌制');
    expect(preserved.adjustedShelfLife).toBe(30);
    expect(preserved.preservedBy).toBe('腌制');
  });

  it('庇护所Lv2 extends shelfLife by 50%', () => {
    const item = createPerishableItem('生肉', 0);
    const preserved = preserveItem(item, '庇护所Lv2');
    expect(preserved.adjustedShelfLife).toBe(7.5);
    expect(preserved.preservedBy).toBe('庇护所Lv2');
  });

  it('preserved item spoils later than unpreserved', () => {
    const raw = createPerishableItem('生肉', 0);
    const preserved = preserveItem(raw, '烹饪');
    expect(isSpoiled(raw, 6 * 60)).toBe(true);
    expect(isSpoiled(preserved, 6 * 60)).toBe(false);
  });

  it('庇护所Lv2 stacks with prior preservation', () => {
    const item = createPerishableItem('生肉', 0);
    const cooked = preserveItem(item, '烹饪');
    const sheltered = preserveItem(cooked, '庇护所Lv2');
    expect(sheltered.adjustedShelfLife).toBe(22.5);
  });

  it('throws for non-perishable item', () => {
    const item: PerishableItem = { itemId: '木材', quantity: 1, createdAt: 0 };
    expect(() => preserveItem(item, '烹饪')).toThrow('no shelf life');
  });
});

describe('shelfLife data integrity', () => {
  it('生肉 has 5h shelfLife', () => {
    expect(getItemDef('生肉').shelfLife).toBe(5);
  });

  it('熟肉 has 15h shelfLife', () => {
    expect(getItemDef('熟肉').shelfLife).toBe(15);
  });

  it('蛋 has 6h shelfLife', () => {
    expect(getItemDef('蛋').shelfLife).toBe(6);
  });

  it('蟹贝 has 4h shelfLife', () => {
    expect(getItemDef('蟹贝').shelfLife).toBe(4);
  });

  it('椰子 has 20h shelfLife', () => {
    expect(getItemDef('椰子').shelfLife).toBe(20);
  });

  it('木材 has no shelfLife', () => {
    expect(getItemDef('木材').shelfLife).toBeUndefined();
  });
});
