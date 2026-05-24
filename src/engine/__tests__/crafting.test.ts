import { describe, it, expect } from 'vitest';
import type { CraftingRecipe, CraftingStation, ItemId } from '@data/types';
import { CRAFTING_RECIPES } from '@data/v1-spec';
import type { InventorySlot } from '../inventory';
import { addItem, calculateWeight } from '../inventory';
import { canCraft, executeCraft } from '../crafting';

const slot = (itemId: ItemId, quantity: number): InventorySlot => ({
  itemId,
  quantity,
});

// ---- Helper: find a recipe by matching ingredients ----
function findRecipe(productId: ItemId, station: CraftingStation, ingredientMatcher: (ingredients: { itemId: ItemId; quantity: number }[]) => boolean): CraftingRecipe | undefined {
  return CRAFTING_RECIPES.find(
    (r) => r.productId === productId && r.station === station && ingredientMatcher(r.ingredients),
  );
}

// ---- Helper: build inventory from ingredients ----
function buildInventory(ingredients: { itemId: ItemId; quantity: number }[]): InventorySlot[] {
  let inv: InventorySlot[] = [];
  for (const ing of ingredients) {
    inv = addItem(inv, ing.itemId, ing.quantity);
  }
  return inv;
}

// ============================================================
// canCraft
// ============================================================

describe('canCraft', () => {
  // --- Tier 0: 绳索 (纤维×3 → 绳索, station=none) ---
  it('allows crafting 绳索 with enough 纤维 at correct station', () => {
    const recipe: CraftingRecipe = {
      productId: '绳索',
      productQuantity: 1,
      ingredients: [{ itemId: '纤维', quantity: 3 }],
      station: 'none',
      craftingTime: 1,
    };
    const inv = buildInventory([{ itemId: '纤维', quantity: 3 }]);
    const result = canCraft(inv, recipe, 'none');
    expect(result.canCraft).toBe(true);
  });

  it('rejects 绳索 when missing 纤维', () => {
    const recipe: CraftingRecipe = {
      productId: '绳索',
      productQuantity: 1,
      ingredients: [{ itemId: '纤维', quantity: 3 }],
      station: 'none',
      craftingTime: 1,
    };
    const inv = buildInventory([{ itemId: '纤维', quantity: 2 }]);
    const result = canCraft(inv, recipe, 'none');
    expect(result.canCraft).toBe(false);
    expect(result.reason).toBe('missing_materials');
  });

  it('rejects when wrong station', () => {
    // 皮甲 requires workbench
    const recipe: CraftingRecipe = {
      productId: '布料',
      productQuantity: 1,
      ingredients: [
        { itemId: '布料', quantity: 2 },
        { itemId: '纤维', quantity: 2 },
      ],
      station: 'workbench',
      craftingTime: 2,
    };
    const inv = buildInventory([
      { itemId: '布料', quantity: 2 },
      { itemId: '纤维', quantity: 2 },
    ]);
    const result = canCraft(inv, recipe, 'none');
    expect(result.canCraft).toBe(false);
    expect(result.reason).toBe('wrong_station');
  });

  it('rejects when crafting would have net positive weight exceeding capacity', () => {
    // Use a recipe where output is heavier than inputs.
    // e.g. consume 草药×1 (weight 1) → produce 石材×1 (weight 8): net +7
    const recipe: CraftingRecipe = {
      productId: '石材',
      productQuantity: 1,
      ingredients: [{ itemId: '草药', quantity: 1 }],
      station: 'none',
      craftingTime: 1,
    };
    // Inventory: 食物×48 (96 weight) + 草药×1 (1 weight) = 97 total.
    // After craft: 97 - 1 + 8 = 104 > 100.
    const inv = [slot('食物', 48), slot('草药', 1)];
    const result = canCraft(inv, recipe, 'none');
    expect(result.canCraft).toBe(false);
    expect(result.reason).toBe('weight_limit_exceeded');
  });

  it('allows crafting even at heavy weight when recipe decreases net weight', () => {
    // 石斧 consumes 木材×2 (10) + 石材×1 (8) = 18 weight, produces 工具 (5 weight): net -13
    const recipe: CraftingRecipe = {
      productId: '工具',
      productQuantity: 1,
      ingredients: [
        { itemId: '木材', quantity: 2 },
        { itemId: '石材', quantity: 1 },
      ],
      station: 'none',
      craftingTime: 2,
    };
    // Inventory at 95 weight + materials. After crafting: 95 - 18 + 5 = 82 (still ≤ 100)
    const inv = [
      ...buildInventory([
        { itemId: '木材', quantity: 2 },
        { itemId: '石材', quantity: 1 },
      ]),
      ...buildInventory([{ itemId: '食物', quantity: 39 }]), // 39*2=78, +18 from materials = 96 total
    ];
    const result = canCraft(inv, recipe, 'none');
    expect(result.canCraft).toBe(true);
  });

  // --- Tier 0 recipe tests with actual spec data ---
  describe('Tier 0 recipes (no station)', () => {
    // 石斧: 木材×2 + 石材×1 → 工具
    it('allows 石斧', () => {
      const recipe = findRecipe('石刀', 'none', (ings) =>
        ings.some((i) => i.itemId === '石材'),
      );
      expect(recipe).toBeDefined();
      const inv = buildInventory([
        { itemId: '木材', quantity: 2 },
        { itemId: '石材', quantity: 1 },
      ]);
      const result = canCraft(inv, recipe!, 'none');
      expect(result.canCraft).toBe(true);
    });

    // 木矛: 木材×2 + 绳索×1 → 工具
    it('allows 木矛', () => {
      const recipe = findRecipe('木矛', 'none', (ings) =>
        ings.some((i) => i.itemId === '绳索') && !ings.some((i) => i.itemId === '石材'),
      );
      expect(recipe).toBeDefined();
      const inv = buildInventory([
        { itemId: '木材', quantity: 2 },
        { itemId: '绳索', quantity: 1 },
      ]);
      const result = canCraft(inv, recipe!, 'none');
      expect(result.canCraft).toBe(true);
    });

    it('rejects 木矛 when missing 绳索', () => {
      const recipe = findRecipe('木矛', 'none', (ings) =>
        ings.some((i) => i.itemId === '绳索') && !ings.some((i) => i.itemId === '石材'),
      );
      const inv = buildInventory([{ itemId: '木材', quantity: 2 }]);
      const result = canCraft(inv, recipe!, 'none');
      expect(result.canCraft).toBe(false);
    });

    // 布甲: 纤维×2 + 绳索×1 → 布料 (v1-spec recipe for "防具类")
    it('allows 布甲', () => {
      const recipe = findRecipe('布甲', 'none', (ings) =>
        ings.some((i) => i.itemId === '绳索'),
      );
      expect(recipe).toBeDefined();
      const inv = buildInventory([
        { itemId: '纤维', quantity: 2 },
        { itemId: '绳索', quantity: 1 },
      ]);
      const result = canCraft(inv, recipe!, 'none');
      expect(result.canCraft).toBe(true);
    });

    // 绷带: 布料×1 → (v1-spec has a recipe for it - actually looking at the recipes,
    //        the 消耗品类 entry for 草药×2 is for 药膏, 解毒草×1 is for 解毒剂)
    //        Actually in the v1-spec, 绷带 is not explicitly a crafting recipe - it's 布料×1
    //        But in 物资图鉴, 绷带: 🧶×1 (布料×1). Let me just define it inline.

    // 药膏: 草药×2 → 草药 (v1-spec)
    it('allows 药膏', () => {
      const recipe = findRecipe('药膏', 'none', (ings) =>
        ings.length === 1 && ings[0].itemId === '草药' && ings[0].quantity === 2,
      );
      expect(recipe).toBeDefined();
      const inv = buildInventory([{ itemId: '草药', quantity: 2 }]);
      const result = canCraft(inv, recipe!, 'none');
      expect(result.canCraft).toBe(true);
    });

    // 解毒剂: 解毒草×1 → 解毒草 (v1-spec)
    it('allows 解毒剂', () => {
      const recipe = findRecipe('解毒剂', 'none', (ings) =>
        ings.length === 1 && ings[0].itemId === '解毒草',
      );
      expect(recipe).toBeDefined();
      const inv = buildInventory([{ itemId: '解毒草', quantity: 1 }]);
      const result = canCraft(inv, recipe!, 'none');
      expect(result.canCraft).toBe(true);
    });

    // 火把: 木材×1 + 纤维×2 → 工具 (v1-spec)
    it('allows 火把', () => {
      const recipe = findRecipe('火把', 'none', (ings) =>
        ings.some((i) => i.itemId === '木材' && i.quantity === 1) &&
        ings.some((i) => i.itemId === '纤维' && i.quantity === 2),
      );
      expect(recipe).toBeDefined();
      const inv = buildInventory([
        { itemId: '木材', quantity: 1 },
        { itemId: '纤维', quantity: 2 },
      ]);
      const result = canCraft(inv, recipe!, 'none');
      expect(result.canCraft).toBe(true);
    });

    // 简易营地: 木材×4 + 纤维×2 → 工具 (v1-spec)
    it('allows 简易营地', () => {
      const recipe = findRecipe('简易营地', 'none', (ings) =>
        ings.some((i) => i.itemId === '木材' && i.quantity === 4),
      );
      expect(recipe).toBeDefined();
      const inv = buildInventory([
        { itemId: '木材', quantity: 4 },
        { itemId: '纤维', quantity: 2 },
      ]);
      const result = canCraft(inv, recipe!, 'none');
      expect(result.canCraft).toBe(true);
    });
  });

  // --- Tier 1 recipes (workbench) ---
  describe('Tier 1 recipes (workbench)', () => {
    // 皮甲: 布料×2 + 纤维×2 → 布料 (v1-spec)
    it('allows 皮甲 at workbench', () => {
      const recipe = findRecipe('皮甲', 'workbench', (ings) =>
        ings.some((i) => i.itemId === '布料' && i.quantity === 2),
      );
      expect(recipe).toBeDefined();
      const inv = buildInventory([
        { itemId: '布料', quantity: 2 },
        { itemId: '纤维', quantity: 2 },
      ]);
      const result = canCraft(inv, recipe!, 'workbench');
      expect(result.canCraft).toBe(true);
    });

    it('rejects 皮甲 without workbench', () => {
      const recipe = findRecipe('皮甲', 'workbench', (ings) =>
        ings.some((i) => i.itemId === '布料' && i.quantity === 2),
      );
      const inv = buildInventory([
        { itemId: '布料', quantity: 2 },
        { itemId: '纤维', quantity: 2 },
      ]);
      const result = canCraft(inv, recipe!, 'none');
      expect(result.canCraft).toBe(false);
      expect(result.reason).toBe('wrong_station');
    });

    // 修理工具: 铁矿×2 + 纤维×1 → 工具 (v1-spec workbench)
    it('allows 修理工具 at workbench', () => {
      const recipe = findRecipe('修理工具', 'workbench', (ings) =>
        ings.some((i) => i.itemId === '铁矿'),
      );
      expect(recipe).toBeDefined();
      const inv = buildInventory([
        { itemId: '铁矿', quantity: 2 },
        { itemId: '纤维', quantity: 1 },
      ]);
      const result = canCraft(inv, recipe!, 'workbench');
      expect(result.canCraft).toBe(true);
    });

    // 加固营地: 木材×3 + 金属件×1 → 工具 (v1-spec workbench)
    it('allows 加固营地 at workbench', () => {
      const recipe = findRecipe('木筏', 'workbench', () => true);
      expect(recipe).toBeDefined();
      const inv = buildInventory([
        { itemId: '木材', quantity: 3 },
        { itemId: '绳索', quantity: 2 },
      ]);
      const result = canCraft(inv, recipe!, 'workbench');
      expect(result.canCraft).toBe(true);
    });

    // 木筏: 木材×3 + 绳索×2 → 绳索 (v1-spec workbench)
    it('allows 木筏 at workbench', () => {
      const recipe = findRecipe('木筏', 'workbench', () => true);
      expect(recipe).toBeDefined();
      const inv = buildInventory([
        { itemId: '木材', quantity: 3 },
        { itemId: '绳索', quantity: 2 },
      ]);
      const result = canCraft(inv, recipe!, 'workbench');
      expect(result.canCraft).toBe(true);
    });

    // 捕鱼陷阱: 渔网×1 + 木材×1 → 渔网 (v1-spec workbench)
    it('allows 捕鱼陷阱 at workbench', () => {
      const recipe = findRecipe('捕鱼陷阱', 'workbench', () => true);
      expect(recipe).toBeDefined();
      const inv = buildInventory([
        { itemId: '渔网', quantity: 1 },
        { itemId: '木材', quantity: 1 },
      ]);
      const result = canCraft(inv, recipe!, 'workbench');
      expect(result.canCraft).toBe(true);
    });
  });
});

// ============================================================
// executeCraft
// ============================================================

describe('executeCraft', () => {
  // --- 绳索 ---
  it('crafts 绳索: consumes 纤维×3, produces 绳索×1', () => {
    const recipe: CraftingRecipe = {
      productId: '绳索',
      productQuantity: 1,
      ingredients: [{ itemId: '纤维', quantity: 3 }],
      station: 'none',
      craftingTime: 1,
    };
    const inv = buildInventory([{ itemId: '纤维', quantity: 5 }]);
    const { inventory, message } = executeCraft(inv, recipe);

    // Fibers consumed: 5 - 3 = 2
    const fiber = inventory.find((s) => s.itemId === '纤维');
    expect(fiber?.quantity).toBe(2);

    // Rope produced: 1
    const rope = inventory.find((s) => s.itemId === '绳索');
    expect(rope?.quantity).toBe(1);

    expect(message).toContain('成功');
  });

  // --- 石斧: 木材×2 + 石材×1 → 工具 ---
  it('crafts 石斧: consumes materials, produces 石刀', () => {
    const recipe = findRecipe('石刀', 'none', (ings) =>
      ings.some((i) => i.itemId === '石材'),
    )!;
    const inv = buildInventory([
      { itemId: '木材', quantity: 3 },
      { itemId: '石材', quantity: 2 },
    ]);
    const { inventory } = executeCraft(inv, recipe);

    const wood = inventory.find((s) => s.itemId === '木材');
    expect(wood?.quantity).toBe(1); // 3 - 2

    const stone = inventory.find((s) => s.itemId === '石材');
    expect(stone?.quantity).toBe(1); // 2 - 1

    const tool = inventory.find((s) => s.itemId === '石刀');
    expect(tool?.quantity).toBe(1);
  });

  // --- 药膏: 草药×2 → 草药 ---
  it('crafts 药膏: consumes 草药×2, produces 药膏×1', () => {
    const recipe = findRecipe('药膏', 'none', (ings) =>
      ings.length === 1 && ings[0].itemId === '草药' && ings[0].quantity === 2,
    )!;
    const inv = buildInventory([{ itemId: '草药', quantity: 4 }]);
    const { inventory } = executeCraft(inv, recipe);

    // 2 consumed, 1 produced => net -1
    const herb = inventory.find((s) => s.itemId === '草药');
    expect(herb?.quantity).toBe(2); // 4 - 2
    const medicine = inventory.find((s) => s.itemId === '药膏');
    expect(medicine?.quantity).toBe(1);
  });

  // --- 火把: 木材×1 + 纤维×2 → 工具 ---
  it('crafts 火把: consumes 木材 and 纤维, produces 火把', () => {
    const recipe = findRecipe('火把', 'none', (ings) =>
      ings.some((i) => i.itemId === '木材' && i.quantity === 1) &&
      ings.some((i) => i.itemId === '纤维' && i.quantity === 2),
    )!;
    const inv = buildInventory([
      { itemId: '木材', quantity: 3 },
      { itemId: '纤维', quantity: 5 },
    ]);
    const { inventory } = executeCraft(inv, recipe);

    // Materials consumed
    expect(inventory.find((s) => s.itemId === '木材')?.quantity).toBe(2); // 3 - 1
    expect(inventory.find((s) => s.itemId === '纤维')?.quantity).toBe(3); // 5 - 2

    // Torch produced
    const torch = inventory.find((s) => s.itemId === '火把');
    expect(torch?.quantity).toBe(1);
  });

  // --- Weight verification after crafting ---
  it('updates weight correctly after crafting', () => {
    const recipe: CraftingRecipe = {
      productId: '绳索',
      productQuantity: 1,
      ingredients: [{ itemId: '纤维', quantity: 3 }],
      station: 'none',
      craftingTime: 1,
    };
    const inv = buildInventory([{ itemId: '纤维', quantity: 3 }]);
    const weightBefore = calculateWeight(inv); // 3 * 1 = 3
    expect(weightBefore).toBe(3);

    const { inventory } = executeCraft(inv, recipe);
    const weightAfter = calculateWeight(inventory); // 绳索 weight=3
    expect(weightAfter).toBe(3);
    expect(inventory.some((s) => s.itemId === '绳索')).toBe(true);
  });

  // --- Cannot craft with insufficient materials ---
  it('throws when materials insufficient', () => {
    const recipe: CraftingRecipe = {
      productId: '绳索',
      productQuantity: 1,
      ingredients: [{ itemId: '纤维', quantity: 3 }],
      station: 'none',
      craftingTime: 1,
    };
    const inv = buildInventory([{ itemId: '纤维', quantity: 2 }]);
    expect(() => executeCraft(inv, recipe)).toThrow();
  });

  // --- Crafting respects stack limits by creating new slots ---
  it('creates new stack when product already at stack limit', () => {
    const recipe: CraftingRecipe = {
      productId: '工具',
      productQuantity: 1,
      ingredients: [{ itemId: '纤维', quantity: 1 }],
      station: 'none',
      craftingTime: 1,
    };
    // 工具 stackLimit=1, already have 1 → new slot created
    const inv = [slot('工具', 1), slot('纤维', 1)];
    const { inventory } = executeCraft(inv, recipe);
    const tools = inventory.filter((s) => s.itemId === '工具');
    expect(tools).toHaveLength(2);
    expect(tools[0].quantity).toBe(1);
    expect(tools[1].quantity).toBe(1);
  });

  // --- Pure function check ---
  it('does not mutate original inventory', () => {
    const recipe: CraftingRecipe = {
      productId: '绳索',
      productQuantity: 1,
      ingredients: [{ itemId: '纤维', quantity: 3 }],
      station: 'none',
      craftingTime: 1,
    };
    const inv = buildInventory([{ itemId: '纤维', quantity: 3 }]);
    const originalJson = JSON.stringify(inv);
    executeCraft(inv, recipe);
    expect(JSON.stringify(inv)).toBe(originalJson);
  });

  // --- 简易营地: 木材×4 + 纤维×2 → 工具 ---
  it('crafts 简易营地: consumes 木材×4 + 纤维×2, produces 简易营地', () => {
    const recipe = findRecipe('简易营地', 'none', (ings) =>
      ings.some((i) => i.itemId === '木材' && i.quantity === 4),
    )!;
    const inv = buildInventory([
      { itemId: '木材', quantity: 5 },
      { itemId: '纤维', quantity: 3 },
    ]);
    const { inventory } = executeCraft(inv, recipe);

    expect(inventory.find((s) => s.itemId === '木材')?.quantity).toBe(1); // 5 - 4
    expect(inventory.find((s) => s.itemId === '纤维')?.quantity).toBe(1); // 3 - 2
    expect(inventory.find((s) => s.itemId === '简易营地')?.quantity).toBe(1);
  });

  // --- Tier 1: 皮甲 ---
  it('crafts 皮甲 at workbench: consumes 布料×2 + 纤维×2, produces 皮甲', () => {
    const recipe = findRecipe('皮甲', 'workbench', (ings) =>
      ings.some((i) => i.itemId === '布料' && i.quantity === 2),
    )!;
    const inv = buildInventory([
      { itemId: '布料', quantity: 3 },
      { itemId: '纤维', quantity: 3 },
    ]);
    const { inventory } = executeCraft(inv, recipe);

    expect(inventory.find((s) => s.itemId === '布料')?.quantity).toBe(1); // 3 - 2
    expect(inventory.find((s) => s.itemId === '纤维')?.quantity).toBe(1); // 3 - 2
    expect(inventory.find((s) => s.itemId === '皮甲')?.quantity).toBe(1);
  });
});
