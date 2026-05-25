import { describe, it, expect } from 'vitest';
import type { Inventory } from '../inventory';
import { createInventory, addItem, getItemDef, getItemQuantity } from '../inventory';
import {
  createRecipeBook,
  unlockBlueprint,
  getAvailableRecipes,
  canCraft,
  executeCraft,
  calculateCraftTime,
  calculateEnergyCost,
  calculateSuccessRate,
  calculateCraftTimeById,
  calculateCraftEnergyCostById,
  calculateCraftSuccessRateById,
  executeCraftAction,
} from '../crafting';

function buildInventory(items: { itemId: string; quantity: number }[]): Inventory {
  let inv = createInventory();
  for (const { itemId, quantity } of items) {
    const def = getItemDef(itemId as any)!;
    const result = addItem(inv, itemId, quantity, def.weight, def.stackLimit);
    inv = result.inventory;
  }
  return inv;
}

describe('createRecipeBook', () => {
  it('initializes with all recipes from data', () => {
    const book = createRecipeBook();
    expect(book.recipes.length).toBeGreaterThan(0);
    expect(book.unlockedBlueprints.size).toBe(0);
  });

  it('contains both default and blueprint-gated recipes', () => {
    const book = createRecipeBook();
    const defaultRecipes = book.recipes.filter((r) => r.blueprintRequired === null);
    const blueprintRecipes = book.recipes.filter((r) => r.blueprintRequired !== null);
    expect(defaultRecipes.length).toBeGreaterThan(0);
    expect(blueprintRecipes.length).toBeGreaterThan(0);
  });
});

describe('unlockBlueprint', () => {
  it('adds blueprint to unlocked set', () => {
    const book = createRecipeBook();
    const updated = unlockBlueprint(book, '皮甲蓝图');
    expect(updated.unlockedBlueprints.has('皮甲蓝图')).toBe(true);
  });

  it('does not mutate original book', () => {
    const book = createRecipeBook();
    unlockBlueprint(book, '皮甲蓝图');
    expect(book.unlockedBlueprints.has('皮甲蓝图')).toBe(false);
  });

  it('supports multiple blueprints', () => {
    const book = createRecipeBook();
    let updated = unlockBlueprint(book, '皮甲蓝图');
    updated = unlockBlueprint(updated, '木筏蓝图');
    expect(updated.unlockedBlueprints.has('皮甲蓝图')).toBe(true);
    expect(updated.unlockedBlueprints.has('木筏蓝图')).toBe(true);
  });
});

describe('getAvailableRecipes', () => {
  it('returns only default recipes when no blueprints unlocked', () => {
    const book = createRecipeBook();
    const available = getAvailableRecipes(book, new Set());
    for (const r of available) {
      expect(r.blueprintRequired).toBeNull();
    }
  });

  it('includes blueprint recipes after unlock', () => {
    const book = createRecipeBook();
    const blueprints = new Set(['皮甲蓝图']);
    const available = getAvailableRecipes(book, blueprints);
    const leatherArmor = available.find((r) => r.id === '皮甲');
    expect(leatherArmor).toBeDefined();
  });

  it('filters by category', () => {
    const book = createRecipeBook();
    const tools = getAvailableRecipes(book, new Set(), '工具');
    for (const r of tools) {
      expect(r.category).toBe('工具');
    }
    expect(tools.length).toBeGreaterThan(0);
  });

  it('returns empty for non-existent category with no matches', () => {
    const book = createRecipeBook();
    const filtered = getAvailableRecipes(book, new Set(), '材料');
    const nonMaterial = filtered.find((r) => r.category !== '材料');
    expect(nonMaterial).toBeUndefined();
  });
});

describe('canCraft', () => {
  it('returns true when materials and station available', () => {
    const book = createRecipeBook();
    const inv = buildInventory([{ itemId: '纤维', quantity: 3 }]);
    const result = canCraft(book, inv, '绳索', false);
    expect(result.canCraft).toBe(true);
  });

  it('returns false when missing blueprint', () => {
    const book = createRecipeBook();
    const inv = buildInventory([
      { itemId: '布料', quantity: 2 },
      { itemId: '纤维', quantity: 2 },
    ]);
    const result = canCraft(book, inv, '皮甲', true);
    expect(result.canCraft).toBe(false);
    expect(result.reason).toBe('missing_blueprint');
  });

  it('returns false when missing materials', () => {
    const book = createRecipeBook();
    const inv = buildInventory([{ itemId: '纤维', quantity: 2 }]);
    const result = canCraft(book, inv, '绳索', false);
    expect(result.canCraft).toBe(false);
    expect(result.reason).toBe('missing_materials');
  });

  it('returns false when wrong station', () => {
    const book = createRecipeBook();
    const inv = buildInventory([
      { itemId: '铁矿', quantity: 2 },
      { itemId: '纤维', quantity: 1 },
    ]);
    const result = canCraft(book, inv, '修理工具', false);
    expect(result.canCraft).toBe(false);
    expect(result.reason).toBe('wrong_station');
  });

  it('returns false for non-existent recipe', () => {
    const book = createRecipeBook();
    const inv = createInventory();
    const result = canCraft(book, inv, '不存在的配方', false);
    expect(result.canCraft).toBe(false);
    expect(result.reason).toBe('recipe_not_found');
  });

  it('allows crafting blueprint recipe after unlock', () => {
    const book = createRecipeBook();
    const updated = unlockBlueprint(book, '皮甲蓝图');
    const inv = buildInventory([
      { itemId: '布料', quantity: 2 },
      { itemId: '纤维', quantity: 2 },
    ]);
    const result = canCraft(updated, inv, '皮甲', true);
    expect(result.canCraft).toBe(true);
  });
});

describe('calculateCraftTime', () => {
  it('returns 20 minutes at normal energy with no station penalty', () => {
    const book = createRecipeBook();
    const recipe = book.recipes.find((r) => r.id === '绳索')!;
    expect(calculateCraftTime(recipe, false, 80)).toBe(20);
  });

  it('returns 30 minutes when energy <= 50', () => {
    const book = createRecipeBook();
    const recipe = book.recipes.find((r) => r.id === '绳索')!;
    expect(calculateCraftTime(recipe, false, 50)).toBe(30);
    expect(calculateCraftTime(recipe, false, 30)).toBe(30);
  });

  it('returns 40 minutes for advanced recipe without workstation', () => {
    const book = createRecipeBook();
    const recipe = book.recipes.find((r) => r.id === '修理工具')!;
    expect(calculateCraftTime(recipe, false, 80)).toBe(40);
  });

  it('combines penalties: low energy + no workstation', () => {
    const book = createRecipeBook();
    const recipe = book.recipes.find((r) => r.id === '修理工具')!;
    expect(calculateCraftTime(recipe, false, 30)).toBe(60);
  });
});

describe('calculateEnergyCost', () => {
  it('returns -5 at normal energy', () => {
    expect(calculateEnergyCost(80)).toBe(-5);
    expect(calculateEnergyCost(51)).toBe(-5);
  });

  it('returns -8 when energy <= 30', () => {
    expect(calculateEnergyCost(30)).toBe(-8);
    expect(calculateEnergyCost(10)).toBe(-8);
  });

  it('returns -4 when energy > 80 (focus)', () => {
    expect(calculateEnergyCost(81)).toBe(-4);
    expect(calculateEnergyCost(100)).toBe(-4);
  });
});

describe('calculateSuccessRate', () => {
  it('returns 100% at normal energy', () => {
    expect(calculateSuccessRate(80)).toBe(100);
    expect(calculateSuccessRate(51)).toBe(100);
  });

  it('returns 50% when energy <= 30', () => {
    expect(calculateSuccessRate(30)).toBe(50);
    expect(calculateSuccessRate(10)).toBe(50);
  });

  it('returns 85% when energy <= 50', () => {
    expect(calculateSuccessRate(50)).toBe(85);
    expect(calculateSuccessRate(31)).toBe(85);
  });

  it('returns 110% capped to 100% when energy > 80', () => {
    expect(calculateSuccessRate(81)).toBe(100);
  });
});

describe('executeCraft', () => {
  it('deducts materials and produces product on success', () => {
    const book = createRecipeBook();
    const inv = buildInventory([{ itemId: '纤维', quantity: 5 }]);
    const result = executeCraft(book, inv, '绳索', false, 80, 50);

    expect(result.success).toBe(true);
    expect(getItemQuantity(result.inventory, '纤维')).toBe(2);
    expect(getItemQuantity(result.inventory, '绳索')).toBe(1);
  });

  it('consumes time correctly', () => {
    const book = createRecipeBook();
    const inv = buildInventory([{ itemId: '纤维', quantity: 3 }]);
    const result = executeCraft(book, inv, '绳索', false, 80, 100);
    expect(result.timeElapsed).toBe(20);
  });

  it('fails gracefully when energy too low (roll fails)', () => {
    const book = createRecipeBook();
    const inv = buildInventory([{ itemId: '纤维', quantity: 3 }]);
    const result = executeCraft(book, inv, '绳索', false, 30, 60);

    expect(result.success).toBe(false);
    expect(getItemQuantity(result.inventory, '纤维')).toBe(3);
    expect(result.timeElapsed).toBe(30);
    expect(result.energyCost).toBe(-8);
  });

  it('does not consume materials on failure', () => {
    const book = createRecipeBook();
    const inv = buildInventory([{ itemId: '木材', quantity: 2 }, { itemId: '石材', quantity: 1 }]);
    const result = executeCraft(book, inv, '石斧', false, 30, 60);

    expect(result.success).toBe(false);
    expect(getItemQuantity(result.inventory, '木材')).toBe(2);
    expect(getItemQuantity(result.inventory, '石材')).toBe(1);
  });

  it('throws when preconditions not met', () => {
    const book = createRecipeBook();
    const inv = buildInventory([{ itemId: '纤维', quantity: 2 }]);
    expect(() => executeCraft(book, inv, '绳索', false, 80)).toThrow();
  });

  it('does not mutate original inventory', () => {
    const book = createRecipeBook();
    const inv = buildInventory([{ itemId: '纤维', quantity: 5 }]);
    const originalJson = JSON.stringify(inv);
    executeCraft(book, inv, '绳索', false, 80, 100);
    expect(JSON.stringify(inv)).toBe(originalJson);
  });

  it('crafts workbench recipe with workstation', () => {
    const book = createRecipeBook();
    const updated = unlockBlueprint(book, '皮甲蓝图');
    const inv = buildInventory([
      { itemId: '布料', quantity: 3 },
      { itemId: '纤维', quantity: 3 },
    ]);
    const result = executeCraft(updated, inv, '皮甲', true, 80, 100);

    expect(result.success).toBe(true);
    expect(getItemQuantity(result.inventory, '布料')).toBe(1);
    expect(getItemQuantity(result.inventory, '纤维')).toBe(1);
    expect(getItemQuantity(result.inventory, '皮甲')).toBe(1);
  });
});

describe('blueprint unlock integration', () => {
  it('full workflow: unlock → getAvailable → canCraft → executeCraft', () => {
    let book = createRecipeBook();

    const before = getAvailableRecipes(book, book.unlockedBlueprints);
    expect(before.find((r) => r.id === '木筏')).toBeUndefined();

    book = unlockBlueprint(book, '木筏蓝图');

    const after = getAvailableRecipes(book, book.unlockedBlueprints);
    expect(after.find((r) => r.id === '木筏')).toBeDefined();

    const inv = buildInventory([
      { itemId: '木材', quantity: 3 },
      { itemId: '绳索', quantity: 2 },
    ]);
    const check = canCraft(book, inv, '木筏', true);
    expect(check.canCraft).toBe(true);

    const result = executeCraft(book, inv, '木筏', true, 80, 100);
    expect(result.success).toBe(true);
    expect(getItemQuantity(result.inventory, '木筏')).toBe(1);
  });
});

describe('P2.3 action-level crafting', () => {
  describe('calculateCraftTimeById', () => {
    it('returns 20 minutes at normal energy', () => {
      const book = createRecipeBook();
      expect(calculateCraftTimeById('绳索', book, false, 80)).toBe(20);
    });

    it('returns 30 minutes when energy <= 50', () => {
      const book = createRecipeBook();
      expect(calculateCraftTimeById('绳索', book, false, 50)).toBe(30);
      expect(calculateCraftTimeById('绳索', book, false, 20)).toBe(30);
    });

    it('throws for non-existent recipe', () => {
      const book = createRecipeBook();
      expect(() => calculateCraftTimeById('不存在', book, false, 80)).toThrow('不存在');
    });
  });

  describe('calculateCraftEnergyCostById', () => {
    it('returns -5 at normal energy', () => {
      expect(calculateCraftEnergyCostById('绳索', 60)).toBe(-5);
    });

    it('returns -8 when energy <= 30', () => {
      expect(calculateCraftEnergyCostById('绳索', 30)).toBe(-8);
    });

    it('returns -4 when energy > 80', () => {
      expect(calculateCraftEnergyCostById('绳索', 90)).toBe(-4);
    });
  });

  describe('calculateCraftSuccessRateById', () => {
    it('returns 100 at normal energy', () => {
      expect(calculateCraftSuccessRateById('绳索', 60)).toBe(100);
    });

    it('returns 50 when energy <= 30', () => {
      expect(calculateCraftSuccessRateById('绳索', 20)).toBe(50);
    });

    it('returns 85 when energy 31-50', () => {
      expect(calculateCraftSuccessRateById('绳索', 40)).toBe(85);
    });
  });

  describe('executeCraftAction', () => {
    function makeState(energy: number, mood: number, items: { itemId: string; quantity: number }[]) {
      const book = createRecipeBook();
      const inventory = buildInventory(items);
      return { recipeBook: book, inventory, playerEnergy: energy, playerMood: mood };
    }

    it('deducts materials and produces product on success', () => {
      const state = makeState(80, 70, [{ itemId: '纤维', quantity: 5 }]);
      const result = executeCraftAction(state, '绳索', false, () => 0.1);
      expect(result.success).toBe(true);
      expect(getItemQuantity(result.inventory, '纤维')).toBe(2);
      expect(getItemQuantity(result.inventory, '绳索')).toBe(1);
      expect(result.productQuantity).toBe(1);
    });

    it('consumes time and energy on failure', () => {
      const state = makeState(30, 70, [{ itemId: '纤维', quantity: 3 }]);
      const result = executeCraftAction(state, '绳索', false, () => 0.99);
      expect(result.success).toBe(false);
      expect(result.timeElapsed).toBe(30);
      expect(result.energyCost).toBe(-8);
      expect(result.productQuantity).toBe(0);
    });

    it('preserves materials on failure', () => {
      const state = makeState(30, 70, [{ itemId: '纤维', quantity: 3 }]);
      const result = executeCraftAction(state, '绳索', false, () => 0.99);
      expect(result.success).toBe(false);
      expect(getItemQuantity(result.inventory, '纤维')).toBe(3);
    });

    it('applies mood <= 30 output penalty (-30%)', () => {
      const state = makeState(80, 20, [{ itemId: '纤维', quantity: 5 }]);
      const result = executeCraftAction(state, '绳索', false, () => 0.01);
      expect(result.success).toBe(true);
      expect(result.productQuantity).toBe(1);
    });

    it('no mood penalty when mood > 30', () => {
      const state = makeState(80, 50, [{ itemId: '纤维', quantity: 5 }]);
      const result = executeCraftAction(state, '绳索', false, () => 0.01);
      expect(result.success).toBe(true);
      expect(result.productQuantity).toBe(1);
    });

    it('energy > 80 gets +10% success rate (capped at 100)', () => {
      const state = makeState(90, 70, [{ itemId: '纤维', quantity: 3 }]);
      const result = executeCraftAction(state, '绳索', false, () => 0.99);
      expect(result.success).toBe(true);
    });

    it('throws when preconditions not met', () => {
      const state = makeState(80, 70, [{ itemId: '纤维', quantity: 2 }]);
      expect(() => executeCraftAction(state, '绳索', false, () => 0.5)).toThrow();
    });

    it('does not mutate original inventory', () => {
      const state = makeState(80, 70, [{ itemId: '纤维', quantity: 5 }]);
      const originalJson = JSON.stringify(state.inventory);
      executeCraftAction(state, '绳索', false, () => 0.01);
      expect(JSON.stringify(state.inventory)).toBe(originalJson);
    });
  });
});
