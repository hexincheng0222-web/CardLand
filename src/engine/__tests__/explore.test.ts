// ============================================================
// CardLand Explore & Gather Engine — Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import type { Attributes } from '../attributes';
import type { Inventory } from '../inventory';
import { createInventory, getItemQuantity } from '../inventory';
import { createReservesSeeded } from '@data/map';
import type { ResourceReserve } from '@data/map';
import {
  calculateExploreTime,
  calculateExploreCost,
  decomposeFood,
  rollBlueprintDrop,
  calculateGatherOutput,
  executeExplore,
  type ExploreState,
} from '../explore';

// ============================================================
// Helpers
// ============================================================

/** Healthy attributes — no thresholds triggered (> 60 for cost checks) */
const defaultAttrs: Attributes = {
  '饱食度': 70,
  '口渴度': 70,
  '体力值': 80,
  '健康值': 100,
  '精力值': 80,
  '污垢': 20,
  '心情': 70,
  '负重': 0,
  '体温': 60,
};

/** Create a seeded RNG that cycles through given values */
function seqRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

/** Create deterministic reserves for tests */
function testReserves(): ResourceReserve[] {
  return createReservesSeeded(42);
}

/** Build ExploreState shorthand */
function makeState(overrides: Partial<ExploreState> = {}): ExploreState {
  return {
    attributes: { ...defaultAttrs },
    inventory: createInventory(),
    reserves: testReserves(),
    weather: '晴',
    isNight: false,
    toolType: 'bare',
    ...overrides,
  };
}

// ============================================================
// 1. calculateExploreTime
// ============================================================

describe('calculateExploreTime', () => {
  it('returns base 30 minutes with healthy attributes', () => {
    expect(calculateExploreTime('A1-South', defaultAttrs, '晴')).toBe(30);
  });

  it('饱食度 ≤ 30 → +50%', () => {
    const attrs = { ...defaultAttrs, '饱食度': 20 };
    expect(calculateExploreTime('A1-South', attrs, '晴')).toBe(45);
  });

  it('体力值 ≤ 50 → +30%', () => {
    const attrs = { ...defaultAttrs, '体力值': 40 };
    // 30 * 1.3 = 39
    expect(calculateExploreTime('A1-South', attrs, '晴')).toBe(39);
  });

  it('健康值 ≤ 30 → +50%', () => {
    const attrs = { ...defaultAttrs, '健康值': 20 };
    expect(calculateExploreTime('A1-South', attrs, '晴')).toBe(45);
  });

  it('stacks all three status modifiers additively', () => {
    const attrs = { ...defaultAttrs, '饱食度': 20, '体力值': 40, '健康值': 20 };
    // 30 * (1 + 0.5 + 0.3 + 0.5) = 30 * 2.3 = 69
    expect(calculateExploreTime('A1-South', attrs, '晴')).toBe(69);
  });

  it('暴雨 → ×1.5 weather modifier', () => {
    expect(calculateExploreTime('A1-South', defaultAttrs, '暴雨')).toBe(45);
  });

  it('combines status and weather (multiplicative)', () => {
    const attrs = { ...defaultAttrs, '饱食度': 20 };
    // 30 * 1.5 * 1.5 = 67.5 → ceil 68
    expect(calculateExploreTime('A1-South', attrs, '暴雨')).toBe(68);
  });

  it('雨 and 阴 do not affect time', () => {
    expect(calculateExploreTime('A1-South', defaultAttrs, '雨')).toBe(30);
    expect(calculateExploreTime('A1-South', defaultAttrs, '阴')).toBe(30);
  });
});

// ============================================================
// 2. calculateExploreCost
// ============================================================

describe('calculateExploreCost', () => {
  it('returns base cost with healthy attributes', () => {
    const cost = calculateExploreCost('A1-South', defaultAttrs);
    expect(cost.stamina).toBe(-5);
    expect(cost.energy).toBe(0);
    expect(cost.dirt).toBe(2);
  });

  it('饱食度 ≤ 60 → stamina -2', () => {
    const cost = calculateExploreCost('A1-South', { ...defaultAttrs, '饱食度': 50 });
    expect(cost.stamina).toBe(-7);
  });

  it('口渴度 ≤ 60 → stamina -2', () => {
    const cost = calculateExploreCost('A1-South', { ...defaultAttrs, '口渴度': 50 });
    expect(cost.stamina).toBe(-7);
  });

  it('负重 > 50 → stamina -3', () => {
    const cost = calculateExploreCost('A1-South', { ...defaultAttrs, '负重': 60 });
    expect(cost.stamina).toBe(-8);
  });

  it('健康值 ≤ 60 → stamina -2', () => {
    const cost = calculateExploreCost('A1-South', { ...defaultAttrs, '健康值': 50 });
    expect(cost.stamina).toBe(-7);
  });

  it('stacks all stamina modifiers', () => {
    const attrs = { ...defaultAttrs, '饱食度': 50, '口渴度': 50, '负重': 60, '健康值': 50 };
    // -5 -2 -2 -3 -2 = -14
    expect(calculateExploreCost('A1-South', attrs).stamina).toBe(-14);
  });

  it('精力值 ≤ 50 → energy -3', () => {
    const cost = calculateExploreCost('A1-South', { ...defaultAttrs, '精力值': 40 });
    expect(cost.energy).toBe(-3);
  });

  it('饱食度 ≤ 30 → energy -3', () => {
    const cost = calculateExploreCost('A1-South', { ...defaultAttrs, '饱食度': 20 });
    expect(cost.energy).toBe(-3);
  });

  it('swamp terrain (zone D) → dirt +2', () => {
    expect(calculateExploreCost('D2-South', defaultAttrs).dirt).toBe(4);
  });

  it('cave terrain (zone F) → dirt +2', () => {
    expect(calculateExploreCost('F1-East', defaultAttrs).dirt).toBe(4);
  });

  it('mine terrain (zone C2) → dirt +2', () => {
    expect(calculateExploreCost('C2-East', defaultAttrs).dirt).toBe(4);
  });

  it('non-swamp non-cave → base dirt only', () => {
    expect(calculateExploreCost('A1-South', defaultAttrs).dirt).toBe(2);
    expect(calculateExploreCost('B1-South', defaultAttrs).dirt).toBe(2);
  });
});

// ============================================================
// 3. decomposeFood
// ============================================================

describe('decomposeFood', () => {
  describe('蟹贝', () => {
    it('bare → 水×1', () => {
      expect(decomposeFood('蟹贝', 'bare').outputs).toEqual([
        { itemId: '水', quantity: 1 },
      ]);
    });

    it('stone → 生肉×1 + 水×1', () => {
      expect(decomposeFood('蟹贝', 'stone').outputs).toEqual([
        { itemId: '生肉', quantity: 1 },
        { itemId: '水', quantity: 1 },
      ]);
    });

    it('iron → 生肉×1 + 水×2', () => {
      expect(decomposeFood('蟹贝', 'iron').outputs).toEqual([
        { itemId: '生肉', quantity: 1 },
        { itemId: '水', quantity: 2 },
      ]);
    });

    it('obsidian → 生肉×2 + 水×2', () => {
      expect(decomposeFood('蟹贝', 'obsidian').outputs).toEqual([
        { itemId: '生肉', quantity: 2 },
        { itemId: '水', quantity: 2 },
      ]);
    });
  });

  describe('鱼', () => {
    it('bare → 生肉×1', () => {
      expect(decomposeFood('鱼', 'bare').outputs).toEqual([
        { itemId: '生肉', quantity: 1 },
      ]);
    });

    it('stone → 生肉×2', () => {
      expect(decomposeFood('鱼', 'stone').outputs).toEqual([
        { itemId: '生肉', quantity: 2 },
      ]);
    });

    it('iron → 生肉×2', () => {
      expect(decomposeFood('鱼', 'iron').outputs).toEqual([
        { itemId: '生肉', quantity: 2 },
      ]);
    });

    it('obsidian → 生肉×3', () => {
      expect(decomposeFood('鱼', 'obsidian').outputs).toEqual([
        { itemId: '生肉', quantity: 3 },
      ]);
    });
  });

  describe('椰子', () => {
    it('bare → 食物×1 when rng < 0.5', () => {
      expect(decomposeFood('椰子', 'bare', () => 0.3).outputs).toEqual([
        { itemId: '食物', quantity: 1 },
      ]);
    });

    it('bare → 水×1 when rng ≥ 0.5', () => {
      expect(decomposeFood('椰子', 'bare', () => 0.7).outputs).toEqual([
        { itemId: '水', quantity: 1 },
      ]);
    });

    it('bare → boundary at 0.5 (goes to 水)', () => {
      expect(decomposeFood('椰子', 'bare', () => 0.5).outputs).toEqual([
        { itemId: '水', quantity: 1 },
      ]);
    });

    it('stone → 食物×1 + 水×1', () => {
      expect(decomposeFood('椰子', 'stone').outputs).toEqual([
        { itemId: '食物', quantity: 1 },
        { itemId: '水', quantity: 1 },
      ]);
    });

    it('iron → 食物×2 + 水×1', () => {
      expect(decomposeFood('椰子', 'iron').outputs).toEqual([
        { itemId: '食物', quantity: 2 },
        { itemId: '水', quantity: 1 },
      ]);
    });

    it('obsidian → 食物×2 + 水×2', () => {
      expect(decomposeFood('椰子', 'obsidian').outputs).toEqual([
        { itemId: '食物', quantity: 2 },
        { itemId: '水', quantity: 2 },
      ]);
    });
  });

  describe('蛋', () => {
    it('bare → 食物×1', () => {
      expect(decomposeFood('蛋', 'bare').outputs).toEqual([
        { itemId: '食物', quantity: 1 },
      ]);
    });

    it('stone → 食物×1', () => {
      expect(decomposeFood('蛋', 'stone').outputs).toEqual([
        { itemId: '食物', quantity: 1 },
      ]);
    });

    it('iron → 食物×1', () => {
      expect(decomposeFood('蛋', 'iron').outputs).toEqual([
        { itemId: '食物', quantity: 1 },
      ]);
    });

    it('obsidian → 食物×2', () => {
      expect(decomposeFood('蛋', 'obsidian').outputs).toEqual([
        { itemId: '食物', quantity: 2 },
      ]);
    });
  });

  describe('兽肉', () => {
    it('bare → 生肉×2', () => {
      expect(decomposeFood('兽肉', 'bare').outputs).toEqual([
        { itemId: '生肉', quantity: 2 },
      ]);
    });

    it('stone → 生肉×3', () => {
      expect(decomposeFood('兽肉', 'stone').outputs).toEqual([
        { itemId: '生肉', quantity: 3 },
      ]);
    });

    it('iron → 生肉×4', () => {
      expect(decomposeFood('兽肉', 'iron').outputs).toEqual([
        { itemId: '生肉', quantity: 4 },
      ]);
    });

    it('obsidian → 生肉×5', () => {
      expect(decomposeFood('兽肉', 'obsidian').outputs).toEqual([
        { itemId: '生肉', quantity: 5 },
      ]);
    });
  });
});

// ============================================================
// 4. rollBlueprintDrop
// ============================================================

describe('rollBlueprintDrop', () => {
  it('returns null for points without blueprint mapping', () => {
    expect(rollBlueprintDrop('A1-South', () => 0.01)).toBeNull();
  });

  it('returns blueprint name when roll succeeds (rng < 0.33)', () => {
    expect(rollBlueprintDrop('A4-North', () => 0.2)).toBe('工作台蓝图');
  });

  it('returns null when roll fails (rng ≥ 0.33)', () => {
    expect(rollBlueprintDrop('A4-North', () => 0.5)).toBeNull();
  });

  it('boundary: rng = 0.33 → null (not strictly less)', () => {
    expect(rollBlueprintDrop('A4-North', () => 0.33)).toBeNull();
  });

  it('boundary: rng = 0.329 → success', () => {
    expect(rollBlueprintDrop('A4-North', () => 0.329)).toBe('工作台蓝图');
  });

  it('boundary: rng = 0.0 → success', () => {
    expect(rollBlueprintDrop('A4-North', () => 0.0)).toBe('工作台蓝图');
  });
});

// ============================================================
// 5. calculateGatherOutput
// ============================================================

describe('calculateGatherOutput', () => {
  it('returns empty for points with no outputs (rest points)', () => {
    const result = calculateGatherOutput(
      'A1-North', defaultAttrs, '晴', false, 'bare', testReserves(), () => 0.5,
    );
    expect(result.rawItems).toEqual([]);
    expect(result.decomposedItems).toEqual([]);
    expect(result.reservesDepleted).toEqual([]);
  });

  it('produces items from point outputs', () => {
    // A1-South outputs 食物(1-3) and 水(1-3)
    const rng = seqRng([0.9, 0.9]);
    const result = calculateGatherOutput(
      'A1-South', defaultAttrs, '晴', false, 'bare', testReserves(), rng,
    );
    expect(result.rawItems.length).toBe(2); // 食物 + 水
    expect(result.decomposedItems.length).toBeGreaterThan(0);
  });

  it('depletes reserves correctly', () => {
    const rng = seqRng([0.9, 0.9]);
    const result = calculateGatherOutput(
      'A1-South', defaultAttrs, '晴', false, 'bare', testReserves(), rng,
    );
    for (const d of result.reservesDepleted) {
      expect(d.amount).toBeGreaterThan(0);
      expect(d.pointId).toBe('A1-South');
    }
  });

  it('returns empty when all reserves are 0', () => {
    const emptyReserves: ResourceReserve[] = [
      { pointId: 'A1-South', itemId: '食物', currentStock: 0, maxStock: 20, regenerationRate: 1 },
      { pointId: 'A1-South', itemId: '水', currentStock: 0, maxStock: 9999, regenerationRate: Infinity },
    ];
    const result = calculateGatherOutput(
      'A1-South', defaultAttrs, '晴', false, 'bare', emptyReserves, () => 0.5,
    );
    expect(result.rawItems).toEqual([]);
    expect(result.decomposedItems).toEqual([]);
    expect(result.reservesDepleted).toEqual([]);
  });

  it('caps output by current reserve stock', () => {
    const lowReserves: ResourceReserve[] = [
      { pointId: 'A1-South', itemId: '食物', currentStock: 1, maxStock: 20, regenerationRate: 1 },
      { pointId: 'A1-South', itemId: '水', currentStock: 1, maxStock: 9999, regenerationRate: Infinity },
    ];
    // rng=0.9 → rawAmount would be 3 for min:1,max:3, but capped to 1
    const rng = seqRng([0.9, 0.9]);
    const result = calculateGatherOutput(
      'A1-South', defaultAttrs, '晴', false, 'bare', lowReserves, rng,
    );
    for (const d of result.reservesDepleted) {
      expect(d.amount).toBeLessThanOrEqual(1);
    }
  });

  it('暴雨 reduces output by 50%', () => {
    const reserves = testReserves();
    const rng1 = seqRng([0.99, 0.99]);
    const rng2 = seqRng([0.99, 0.99]);

    const normal = calculateGatherOutput('A1-South', defaultAttrs, '晴', false, 'bare', reserves, rng1);
    const stormy = calculateGatherOutput('A1-South', defaultAttrs, '暴雨', false, 'bare', reserves, rng2);

    const sumItems = (items: { quantity: number }[]) => items.reduce((s, i) => s + i.quantity, 0);
    expect(sumItems(stormy.decomposedItems)).toBeLessThan(sumItems(normal.decomposedItems));
  });

  it('雨 reduces output by 20%', () => {
    const reserves = testReserves();
    const rng1 = seqRng([0.99, 0.99]);
    const rng2 = seqRng([0.99, 0.99]);

    const normal = calculateGatherOutput('A1-South', defaultAttrs, '晴', false, 'bare', reserves, rng1);
    const rainy = calculateGatherOutput('A1-South', defaultAttrs, '雨', false, 'bare', reserves, rng2);

    const sumItems = (items: { quantity: number }[]) => items.reduce((s, i) => s + i.quantity, 0);
    expect(sumItems(rainy.decomposedItems)).toBeLessThan(sumItems(normal.decomposedItems));
  });

  it('night reduces output by 50%', () => {
    const reserves = testReserves();
    const rng1 = seqRng([0.99, 0.99]);
    const rng2 = seqRng([0.99, 0.99]);

    const day = calculateGatherOutput('A1-South', defaultAttrs, '晴', false, 'bare', reserves, rng1);
    const night = calculateGatherOutput('A1-South', defaultAttrs, '晴', true, 'bare', reserves, rng2);

    const sumItems = (items: { quantity: number }[]) => items.reduce((s, i) => s + i.quantity, 0);
    expect(sumItems(night.decomposedItems)).toBeLessThan(sumItems(day.decomposedItems));
  });

  it('饱食度 ≤ 30 reduces output by 50%', () => {
    const reserves = testReserves();
    const rng1 = seqRng([0.99, 0.99]);
    const rng2 = seqRng([0.99, 0.99]);

    const normal = calculateGatherOutput('A1-South', defaultAttrs, '晴', false, 'bare', reserves, rng1);
    const hungry = calculateGatherOutput(
      'A1-South', { ...defaultAttrs, '饱食度': 20 }, '晴', false, 'bare', reserves, rng2,
    );

    const sumItems = (items: { quantity: number }[]) => items.reduce((s, i) => s + i.quantity, 0);
    expect(sumItems(hungry.decomposedItems)).toBeLessThan(sumItems(normal.decomposedItems));
  });

  it('beach zone food decomposes as 蟹贝', () => {
    // A1-South is zone A → 蟹贝. With bare hands → 水×1 per food unit.
    const reserves = testReserves();
    const rng = seqRng([0.9, 0.9]);
    const result = calculateGatherOutput('A1-South', defaultAttrs, '晴', false, 'bare', reserves, rng);
    // Should have water from decomposition (蟹贝 bare → 水×1)
    const waterItems = result.decomposedItems.filter((i) => i.itemId === '水');
    expect(waterItems.length).toBeGreaterThan(0);
    // Should NOT have 生肉 with bare hands on 蟹贝
    const meatItems = result.decomposedItems.filter((i) => i.itemId === '生肉');
    expect(meatItems.length).toBe(0);
  });

  it('beach zone with iron tool produces 生肉', () => {
    const reserves = testReserves();
    const rng = seqRng([0.9, 0.9]);
    const result = calculateGatherOutput('A1-South', defaultAttrs, '晴', false, 'iron', reserves, rng);
    // 蟹贝 iron → 生肉×1 + 水×2
    const meatItems = result.decomposedItems.filter((i) => i.itemId === '生肉');
    expect(meatItems.length).toBeGreaterThan(0);
  });

  it('non-food items pass through without decomposition', () => {
    // A1-East outputs 绳索 and 木材 — no food
    const reserves = testReserves();
    const rng = seqRng([0.9, 0.9]);
    const result = calculateGatherOutput('A1-East', defaultAttrs, '晴', false, 'bare', reserves, rng);
    const itemIds = result.decomposedItems.map((i) => i.itemId);
    expect(itemIds).toContain('绳索');
    expect(itemIds).toContain('木材');
  });

  it('rolls blueprint drop from A4-North', () => {
    const reserves = testReserves();
    // A4-North outputs 藏宝图 and 工具
    const rng = seqRng([0.9, 0.9, 0.1]); // last value < 0.33 → drop
    const result = calculateGatherOutput('A4-North', defaultAttrs, '晴', false, 'bare', reserves, rng);
    expect(result.blueprintDrop).toBe('工作台蓝图');
  });

  it('blueprint drop fails when rng ≥ 0.33', () => {
    const reserves = testReserves();
    const rng = seqRng([0.9, 0.9, 0.5]); // last value ≥ 0.33 → no drop
    const result = calculateGatherOutput('A4-North', defaultAttrs, '晴', false, 'bare', reserves, rng);
    expect(result.blueprintDrop).toBeNull();
  });
});

// ============================================================
// 6. executeExplore
// ============================================================

describe('executeExplore', () => {
  it('returns canExplore=false for unknown point', () => {
    const result = executeExplore(makeState(), 'INVALID-POINT', () => 0.5);
    expect(result.canExplore).toBe(false);
    expect(result.failReason).toBe('未知点位');
  });

  it('returns timeCost and cost for valid point', () => {
    const result = executeExplore(makeState(), 'A1-South', () => 0.5);
    expect(result.canExplore).toBe(true);
    expect(result.timeCost).toBe(30);
    expect(result.cost.stamina).toBe(-5);
  });

  it('adds gathered items to inventory', () => {
    const result = executeExplore(makeState(), 'A1-South', () => 0.9);
    // A1-South outputs 食物 and 水 → decomposed items in inventory
    expect(result.newInventory.slots.length).toBeGreaterThan(0);
  });

  it('depletes reserves in result', () => {
    const state = makeState();
    const result = executeExplore(state, 'A1-South', () => 0.9);

    // Check reserves decreased
    for (const d of result.gatherResult.reservesDepleted) {
      const oldR = state.reserves.find((r) => r.pointId === d.pointId && r.itemId === d.itemId);
      const newR = result.newReserves.find((r) => r.pointId === d.pointId && r.itemId === d.itemId);
      if (oldR && newR) {
        expect(newR.currentStock).toBeLessThanOrEqual(oldR.currentStock - d.amount);
      }
    }
  });

  it('does not mutate input inventory', () => {
    const state = makeState();
    const originalSlots = state.inventory.slots.length;
    executeExplore(state, 'A1-South', () => 0.9);
    expect(state.inventory.slots.length).toBe(originalSlots);
  });

  it('does not mutate input reserves', () => {
    const state = makeState();
    const oldStock = state.reserves.find(
      (r) => r.pointId === 'A1-South' && r.itemId === '食物',
    )?.currentStock;
    executeExplore(state, 'A1-South', () => 0.9);
    const stillOld = state.reserves.find(
      (r) => r.pointId === 'A1-South' && r.itemId === '食物',
    )?.currentStock;
    expect(stillOld).toBe(oldStock);
  });

  it('handles rest points (no outputs) gracefully', () => {
    const result = executeExplore(makeState(), 'A1-North', () => 0.5);
    expect(result.canExplore).toBe(true);
    expect(result.gatherResult.rawItems).toEqual([]);
    expect(result.gatherResult.decomposedItems).toEqual([]);
  });

  it('iron tool produces 生肉 from beach food', () => {
    const state = makeState({ toolType: 'iron' });
    const result = executeExplore(state, 'A1-South', () => 0.9);
    const qty = getItemQuantity(result.newInventory, '生肉');
    expect(qty).toBeGreaterThan(0);
  });

  it('bare tool produces only 水 from beach food (蟹贝)', () => {
    const state = makeState({ toolType: 'bare' });
    const result = executeExplore(state, 'A1-South', () => 0.9);
    const meat = getItemQuantity(result.newInventory, '生肉');
    const water = getItemQuantity(result.newInventory, '水');
    expect(meat).toBe(0);
    expect(water).toBeGreaterThan(0);
  });

  it('暴雨 reduces items added to inventory', () => {
    const normal = executeExplore(makeState({ weather: '晴' }), 'A1-South', () => 0.99);
    const stormy = executeExplore(makeState({ weather: '暴雨' }), 'A1-South', () => 0.99);

    const totalSlots = (inv: Inventory) =>
      inv.slots.reduce((s, slot) => s + slot.quantity, 0);
    expect(totalSlots(stormy.newInventory)).toBeLessThan(totalSlots(normal.newInventory));
  });

  it('handles overflow when inventory is full', () => {
    // Create a nearly full inventory
    const fullInv = createInventory(1, 100); // 1 slot only
    const state = makeState({ inventory: fullInv });
    const result = executeExplore(state, 'A1-South', () => 0.9);
    // With only 1 slot, some items may overflow
    expect(result.gatherResult.overflow).toBeGreaterThanOrEqual(0);
  });

  it('food decomposition integrates with inventory (椰子 zone A3)', () => {
    // A3-South is coconut grove → 椰子 decomposition
    const state = makeState({ toolType: 'stone' });
    const result = executeExplore(state, 'A3-South', () => 0.9);
    // 椰子 stone → 食物×1 + 水×1 per unit
    const food = getItemQuantity(result.newInventory, '食物');
    const water = getItemQuantity(result.newInventory, '水');
    expect(food + water).toBeGreaterThan(0);
  });
});
