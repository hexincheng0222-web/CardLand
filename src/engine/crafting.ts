import type { Recipe, RecipeCategory } from '@data/types';
import type { Inventory } from './inventory';
import { addItem, removeItem, getItemDef, getItemQuantity } from './inventory';
import { RECIPES } from '@data/v1-spec';

export interface CraftActionState {
  recipeBook: RecipeBook;
  inventory: Inventory;
  playerEnergy: number;
  playerMood: number;
}

export interface CraftActionResult {
  success: boolean;
  inventory: Inventory;
  timeElapsed: number;
  energyCost: number;
  productQuantity: number;
  message: string;
}

export interface RecipeBook {
  recipes: Recipe[];
  unlockedBlueprints: Set<string>;
}

export interface CraftCheck {
  canCraft: boolean;
  reason?: 'missing_materials' | 'missing_blueprint' | 'wrong_station' | 'recipe_not_found';
  detail?: string;
}

export interface CraftResult {
  inventory: Inventory;
  timeElapsed: number;
  energyCost: number;
  success: boolean;
  message: string;
}

export function createRecipeBook(): RecipeBook {
  return {
    recipes: [...RECIPES],
    unlockedBlueprints: new Set<string>(),
  };
}

export function unlockBlueprint(
  recipeBook: RecipeBook,
  blueprintId: string,
): RecipeBook {
  const next = new Set(recipeBook.unlockedBlueprints);
  next.add(blueprintId);
  return { ...recipeBook, unlockedBlueprints: next };
}

export function getAvailableRecipes(
  recipeBook: RecipeBook,
  unlockedBlueprints: Set<string>,
  category?: RecipeCategory,
): Recipe[] {
  return recipeBook.recipes.filter((r) => {
    if (r.blueprintRequired !== null && !unlockedBlueprints.has(r.blueprintRequired)) {
      return false;
    }
    if (category && r.category !== category) {
      return false;
    }
    return true;
  });
}

export function canCraft(
  recipeBook: RecipeBook,
  inventory: Inventory,
  recipeId: string,
  hasWorkstation: boolean,
  unlockedBlueprints?: Set<string>,
): CraftCheck {
  const recipe = recipeBook.recipes.find((r) => r.id === recipeId);
  if (!recipe) {
    return { canCraft: false, reason: 'recipe_not_found', detail: `配方 ${recipeId} 不存在` };
  }

  const blueprints = unlockedBlueprints ?? recipeBook.unlockedBlueprints;
  if (recipe.blueprintRequired !== null && !blueprints.has(recipe.blueprintRequired)) {
    return {
      canCraft: false,
      reason: 'missing_blueprint',
      detail: `需要蓝图: ${recipe.blueprintRequired}`,
    };
  }

  if (recipe.station !== 'none' && !hasWorkstation) {
    return {
      canCraft: false,
      reason: 'wrong_station',
      detail: `需要 ${recipe.station}，当前无工作台`,
    };
  }

  for (const ing of recipe.ingredients) {
    const available = getItemQuantity(inventory, ing.itemId);
    if (available < ing.quantity) {
      return {
        canCraft: false,
        reason: 'missing_materials',
        detail: `缺少 ${ing.itemId}：需要 ${ing.quantity}，当前 ${available}`,
      };
    }
  }

  return { canCraft: true };
}

export function calculateCraftTime(
  recipe: Recipe,
  hasWorkstation: boolean,
  playerEnergy: number,
): number {
  let time = recipe.baseTime;

  if (playerEnergy <= 50) {
    time = Math.round(time * 1.5);
  }

  if (recipe.station !== 'none' && !hasWorkstation) {
    time = Math.round(time * 2);
  }

  return time;
}

export function calculateEnergyCost(playerEnergy: number): number {
  if (playerEnergy > 80) return -4;
  if (playerEnergy <= 30) return -8;
  return -5;
}

export function calculateSuccessRate(playerEnergy: number): number {
  let rate = 100;
  if (playerEnergy <= 30) rate -= 50;
  else if (playerEnergy <= 50) rate -= 15;
  if (playerEnergy > 80) rate += 10;
  return Math.min(Math.max(rate, 0), 100);
}

export function executeCraft(
  recipeBook: RecipeBook,
  inventory: Inventory,
  recipeId: string,
  hasWorkstation: boolean,
  playerEnergy: number,
  roll?: number,
): CraftResult {
  const check = canCraft(recipeBook, inventory, recipeId, hasWorkstation);
  if (!check.canCraft) {
    throw new Error(`无法制作 ${recipeId}：${check.detail ?? check.reason}`);
  }

  const recipe = recipeBook.recipes.find((r) => r.id === recipeId)!;
  const timeElapsed = calculateCraftTime(recipe, hasWorkstation, playerEnergy);
  const energyCost = calculateEnergyCost(playerEnergy);
  const successRate = calculateSuccessRate(playerEnergy);

  const effectiveRoll = roll ?? (successRate >= 100 ? 0 : Math.random() * 100);
  const success = successRate >= 100 || effectiveRoll < successRate;

  if (!success) {
    return {
      inventory: { ...inventory, slots: inventory.slots.map((s) => ({ ...s })) },
      timeElapsed,
      energyCost,
      success: false,
      message: `制作 ${recipe.productId} 失败！材料未消耗，时间 +${timeElapsed}分钟，精力 ${energyCost}`,
    };
  }

  let result: Inventory = { ...inventory, slots: inventory.slots.map((s) => ({ ...s })) };
  for (const ing of recipe.ingredients) {
    result = removeItem(result, ing.itemId, ing.quantity);
  }

  const def = getItemDef(recipe.productId as any);
  if (def) {
    const addResult = addItem(result, recipe.productId, recipe.productQuantity, def.weight, def.stackLimit);
    result = addResult.inventory;
  }

  return {
    inventory: result,
    timeElapsed,
    energyCost,
    success: true,
    message: `成功制作 ${recipe.productId}×${recipe.productQuantity}，时间 +${timeElapsed}分钟，精力 ${energyCost}`,
  };
}

export function calculateCraftTimeById(
  recipeId: string,
  recipeBook: RecipeBook,
  hasWorkstation: boolean,
  playerEnergy: number,
): number {
  const recipe = recipeBook.recipes.find((r) => r.id === recipeId);
  if (!recipe) throw new Error(`配方 ${recipeId} 不存在`);
  return calculateCraftTime(recipe, hasWorkstation, playerEnergy);
}

export function calculateCraftEnergyCostById(
  _recipeId: string,
  playerEnergy: number,
): number {
  return calculateEnergyCost(playerEnergy);
}

export function calculateCraftSuccessRateById(
  _recipeId: string,
  playerEnergy: number,
): number {
  return calculateSuccessRate(playerEnergy);
}

export function executeCraftAction(
  state: CraftActionState,
  recipeId: string,
  hasWorkstation: boolean,
  rng?: () => number,
): CraftActionResult {
  const { recipeBook, inventory, playerEnergy, playerMood } = state;

  const check = canCraft(recipeBook, inventory, recipeId, hasWorkstation);
  if (!check.canCraft) {
    throw new Error(`无法制作 ${recipeId}：${check.detail ?? check.reason}`);
  }

  const recipe = recipeBook.recipes.find((r) => r.id === recipeId)!;
  const timeElapsed = calculateCraftTime(recipe, hasWorkstation, playerEnergy);
  const energyCost = calculateEnergyCost(playerEnergy);
  const successRate = calculateSuccessRate(playerEnergy);

  const roll = rng ? rng() * 100 : (successRate >= 100 ? 0 : Math.random() * 100);
  const success = successRate >= 100 || roll < successRate;

  if (!success) {
    return {
      success: false,
      inventory: { ...inventory, slots: inventory.slots.map((s) => ({ ...s })) },
      timeElapsed,
      energyCost,
      productQuantity: 0,
      message: `制作 ${recipe.productId} 失败！材料未消耗，时间 +${timeElapsed}分钟，精力 ${energyCost}`,
    };
  }

  let result: Inventory = { ...inventory, slots: inventory.slots.map((s) => ({ ...s })) };
  for (const ing of recipe.ingredients) {
    result = removeItem(result, ing.itemId, ing.quantity);
  }

  const baseQty = recipe.productQuantity;
  const moodMultiplier = playerMood <= 30 ? 0.7 : 1;
  const productQuantity = Math.max(1, Math.round(baseQty * moodMultiplier));

  const def = getItemDef(recipe.productId as any);
  if (def) {
    const addResult = addItem(result, recipe.productId, productQuantity, def.weight, def.stackLimit);
    result = addResult.inventory;
  }

  return {
    success: true,
    inventory: result,
    timeElapsed,
    energyCost,
    productQuantity,
    message: `成功制作 ${recipe.productId}×${productQuantity}，时间 +${timeElapsed}分钟，精力 ${energyCost}`,
  };
}
