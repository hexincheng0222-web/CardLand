import type { CraftingRecipe, CraftingStation, ItemId } from '@data/types';
import type { InventorySlot } from './inventory';
import { addItem, removeItem, calculateWeight, getItemDef } from './inventory';

// ============================================================
// Types
// ============================================================

export interface CanCraftResult {
  canCraft: boolean;
  reason?: 'missing_materials' | 'wrong_station' | 'weight_limit_exceeded';
  detail?: string;
}

export interface ExecuteCraftResult {
  inventory: InventorySlot[];
  message: string;
}

// ============================================================
// canCraft
// ============================================================

/**
 * Validate whether a recipe can be crafted with the current inventory and station.
 * Checks: materials, station, and whether resulting weight would exceed 100.
 */
export function canCraft(
  inventory: InventorySlot[],
  recipe: CraftingRecipe,
  availableStation: CraftingStation,
): CanCraftResult {
  if (recipe.station !== availableStation) {
    return {
      canCraft: false,
      reason: 'wrong_station',
      detail: `需要 ${recipe.station}，当前为 ${availableStation}`,
    };
  }

  for (const ingredient of recipe.ingredients) {
    const available = countItem(inventory, ingredient.itemId);
    if (available < ingredient.quantity) {
      return {
        canCraft: false,
        reason: 'missing_materials',
        detail: `缺少 ${ingredient.itemId}：需要 ${ingredient.quantity}，当前 ${available}`,
      };
    }
  }

  const netWeightChange = computeNetWeightChange(recipe);
  const currentWeight = calculateWeight(inventory);
  if (currentWeight + netWeightChange > 100) {
    return {
      canCraft: false,
      reason: 'weight_limit_exceeded',
      detail: `制作后负重将超过上限`,
    };
  }

  return { canCraft: true };
}

// ============================================================
// executeCraft
// ============================================================

/**
 * Execute a crafting recipe: consume ingredients, produce the result.
 * Throws if materials are insufficient.
 * Returns a NEW inventory array. Does not mutate input.
 */
export function executeCraft(
  inventory: InventorySlot[],
  recipe: CraftingRecipe,
): ExecuteCraftResult {
  const validation = canCraft(inventory, recipe, recipe.station);
  if (!validation.canCraft) {
    throw new Error(
      `无法制作 ${recipe.productId}：${validation.detail ?? validation.reason}`,
    );
  }

  let result = [...inventory];

  for (const ingredient of recipe.ingredients) {
    result = removeItem(result, ingredient.itemId, ingredient.quantity);
  }

  result = addItem(result, recipe.productId, recipe.productQuantity);

  return {
    inventory: result,
    message: `成功制作 ${recipe.productId}×${recipe.productQuantity}`,
  };
}

// ============================================================
// Helpers
// ============================================================

function countItem(inventory: InventorySlot[], itemId: ItemId): number {
  let total = 0;
  for (const slot of inventory) {
    if (slot.itemId === itemId) {
      total += slot.quantity;
    }
  }
  return total;
}

function computeNetWeightChange(recipe: CraftingRecipe): number {
  let consumedWeight = 0;
  for (const ing of recipe.ingredients) {
    const def = getItemDef(ing.itemId);
    if (def) {
      consumedWeight += def.weight * ing.quantity;
    }
  }

  let producedWeight = 0;
  const productDef = getItemDef(recipe.productId);
  if (productDef) {
    producedWeight += productDef.weight * recipe.productQuantity;
  }

  return producedWeight - consumedWeight;
}
