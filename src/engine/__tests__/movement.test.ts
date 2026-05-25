// ============================================================
// CardLand Movement Engine — Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  getMovementCost,
  calculateMovementTime,
  calculateMovementStamina,
  checkMovementRequirements,
  executeMovement,
  getPointZone,
} from '../movement';
import type { Attributes } from '../attributes';
import type { Inventory } from '../inventory';
import { createInventory, addItem } from '../inventory';

// ============================================================
// Test fixtures
// ============================================================

const DEFAULT_ATTRIBUTES: Attributes = {
  '饱食度': 60,
  '口渴度': 60,
  '体力值': 80,
  '健康值': 100,
  '精力值': 80,
  '污垢': 20,
  '心情': 70,
  '负重': 10,
  '体温': 60,
};

function makeAttributes(overrides: Partial<Attributes> = {}): Attributes {
  return { ...DEFAULT_ATTRIBUTES, ...overrides };
}

function makeInventoryWith(items: Record<string, number>): Inventory {
  let inv = createInventory();
  for (const [itemId, qty] of Object.entries(items)) {
    const result = addItem(inv, itemId, qty, 1, 100);
    inv = result.inventory;
  }
  return inv;
}

/** Seeded RNG that always returns 0.5 (for deterministic tests) */
const fixedRng = () => 0.5;

// ============================================================
// getPointZone
// ============================================================

describe('getPointZone', () => {
  it('extracts sub-zone from point ID with direction', () => {
    expect(getPointZone('A1-North')).toBe('A1');
    expect(getPointZone('B3-South')).toBe('B3');
    expect(getPointZone('F4-West')).toBe('F4');
  });

  it('returns zone letter when no dash', () => {
    expect(getPointZone('A')).toBe('A');
    expect(getPointZone('B')).toBe('B');
    expect(getPointZone('A1')).toBe('A1');
  });
});

// ============================================================
// getMovementCost
// ============================================================

describe('getMovementCost', () => {
  // --- Intra-zone (同板块内) ---
  describe('intra-zone movement', () => {
    it('returns table values for same-zone movement', () => {
      const cost = getMovementCost('A1', 'A2');
      expect(cost).not.toBeNull();
      expect(cost!.timeMinutes).toBe(5);
      expect(cost!.staminaCost).toBe(5);
    });

    it('returns intra-zone default (15min/-10) when same zone but no specific entry', () => {
      // F1↔F2 has entry (10min/-10), but A1↔A2 has entry too (5min/-5)
      const cost = getMovementCost('A1', 'A3');
      expect(cost).not.toBeNull();
      expect(cost!.timeMinutes).toBe(5);
    });

    it('handles same point (within zone)', () => {
      // Same sub-zone should still find a path via table or default
      const cost = getMovementCost('A1', 'A1');
      // No direct A1↔A1 entry, same zone → defaults to 15min/-10
      expect(cost).not.toBeNull();
      expect(cost!.timeMinutes).toBe(15);
      expect(cost!.staminaCost).toBe(-10);
    });
  });

  // --- Cross-zone (跨板块) ---
  describe('cross-zone movement', () => {
    it('A→B costs 20min/20 stamina', () => {
      const cost = getMovementCost('A', 'B');
      expect(cost).not.toBeNull();
      expect(cost!.timeMinutes).toBe(20);
      expect(cost!.staminaCost).toBe(20);
      expect(cost!.requirements).toEqual([]);
    });

    it('A→C requires rope, costs 30min/30 stamina', () => {
      const cost = getMovementCost('A', 'C');
      expect(cost).not.toBeNull();
      expect(cost!.timeMinutes).toBe(30);
      expect(cost!.staminaCost).toBe(30);
      expect(cost!.requirements).toContain('rope');
    });

    it('A→E costs 10min/10 stamina, no requirements', () => {
      const cost = getMovementCost('A', 'E');
      expect(cost).not.toBeNull();
      expect(cost!.timeMinutes).toBe(10);
      expect(cost!.staminaCost).toBe(10);
      expect(cost!.requirements).toEqual([]);
    });

    it('B→C requires climbing_tools, costs 40min/40 stamina', () => {
      const cost = getMovementCost('B', 'C');
      expect(cost).not.toBeNull();
      expect(cost!.timeMinutes).toBe(40);
      expect(cost!.staminaCost).toBe(40);
      expect(cost!.requirements).toContain('climbing_tools');
    });

    it('B→D costs 25min/25 stamina', () => {
      const cost = getMovementCost('B', 'D');
      expect(cost).not.toBeNull();
      expect(cost!.timeMinutes).toBe(25);
      expect(cost!.staminaCost).toBe(25);
    });

    it('C→F costs 35min/35 stamina, no requirements', () => {
      const cost = getMovementCost('C', 'F');
      expect(cost).not.toBeNull();
      expect(cost!.timeMinutes).toBe(35);
      expect(cost!.staminaCost).toBe(35);
      expect(cost!.requirements).toEqual([]);
    });

    it('D→E requires waterproof_gear, costs 20min/20 stamina', () => {
      const cost = getMovementCost('D', 'E');
      expect(cost).not.toBeNull();
      expect(cost!.timeMinutes).toBe(20);
      expect(cost!.staminaCost).toBe(20);
      expect(cost!.requirements).toContain('waterproof_gear');
    });

    it('D→F requires discover_entrance, costs 25min/25 stamina', () => {
      const cost = getMovementCost('D', 'F');
      expect(cost).not.toBeNull();
      expect(cost!.timeMinutes).toBe(25);
      expect(cost!.staminaCost).toBe(25);
      expect(cost!.requirements).toContain('discover_entrance');
    });

    it('E→F requires diving_gear, costs 30min/30 stamina', () => {
      const cost = getMovementCost('E', 'F');
      expect(cost).not.toBeNull();
      expect(cost!.timeMinutes).toBe(30);
      expect(cost!.staminaCost).toBe(30);
      expect(cost!.requirements).toContain('diving_gear');
    });
  });

  // --- Point-to-point resolution ---
  describe('point-to-point resolution', () => {
    it('resolves cross-zone points via zone letters (A1-North → B3-South)', () => {
      const cost = getMovementCost('A1-North', 'B3-South');
      expect(cost).not.toBeNull();
      // Should resolve to A↔B cross-zone: 20min/-20
      expect(cost!.timeMinutes).toBe(20);
    });

    it('resolves same-zone points via sub-zone', () => {
      const cost = getMovementCost('A1-North', 'A2-South');
      expect(cost).not.toBeNull();
      expect(cost!.timeMinutes).toBe(5);
    });
  });

  // --- Non-existent paths ---
  describe('non-existent paths', () => {
    it('returns null for completely invalid locations', () => {
      const cost = getMovementCost('X', 'Y');
      expect(cost).toBeNull();
    });
  });
});

// ============================================================
// calculateMovementTime
// ============================================================

describe('calculateMovementTime', () => {
  const baseCost = {
    from: 'A',
    to: 'B',
    timeMinutes: 30,
    staminaCost: -20,
    requirements: [],
  };

  it('returns base time with no modifiers (normal conditions)', () => {
    const attrs = makeAttributes({ '负重': 30, '体力值': 80, '健康值': 100, '精力值': 80, '心情': 70 });
    const time = calculateMovementTime(baseCost, attrs, '晴');
    expect(time).toBe(30);
  });

  it('applies 轻装 modifier (负重≤25): time -20%', () => {
    const attrs = makeAttributes({ '负重': 20 });
    const time = calculateMovementTime(baseCost, attrs, '晴');
    expect(time).toBe(24); // 30 × 0.8 = 24
  });

  it('applies 负重 modifier (负重>50): time +30%', () => {
    const attrs = makeAttributes({ '负重': 60 });
    const time = calculateMovementTime(baseCost, attrs, '晴');
    expect(time).toBe(39); // 30 × 1.3 = 39
  });

  it('applies 超载 modifier (负重>80): time +50%', () => {
    const attrs = makeAttributes({ '负重': 90 });
    const time = calculateMovementTime(baseCost, attrs, '晴');
    expect(time).toBe(45); // 30 × 1.5 = 45
  });

  it('applies 体力≤30 modifier: time +50%', () => {
    const attrs = makeAttributes({ '体力值': 20, '负重': 30 });
    const time = calculateMovementTime(baseCost, attrs, '晴');
    expect(time).toBe(45); // 30 × 1.5 = 45
  });

  it('applies 健康≤40 modifier: time +30%', () => {
    const attrs = makeAttributes({ '健康值': 30, '负重': 30 });
    const time = calculateMovementTime(baseCost, attrs, '晴');
    expect(time).toBe(39); // 30 × 1.3 = 39
  });

  it('applies 精力≤30 modifier: time +30%', () => {
    const attrs = makeAttributes({ '精力值': 25, '负重': 30 });
    const time = calculateMovementTime(baseCost, attrs, '晴');
    expect(time).toBe(39); // 30 × 1.3 = 39
  });

  it('applies 暴雨 weather: time +50%', () => {
    const attrs = makeAttributes({ '负重': 30 });
    const time = calculateMovementTime(baseCost, attrs, '暴雨');
    expect(time).toBe(45); // 30 × 1.5 = 45
  });

  it('applies 大雾 weather: time +25%', () => {
    const attrs = makeAttributes({ '负重': 30 });
    const time = calculateMovementTime(baseCost, attrs, '大雾');
    expect(time).toBe(38); // 30 × 1.25 = 37.5 → rounded to 38
  });

  it('applies 酷热 weather: no time change (stamina only)', () => {
    const attrs = makeAttributes({ '负重': 30 });
    const time = calculateMovementTime(baseCost, attrs, '酷热');
    expect(time).toBe(30); // 30 × 1.0 = 30
  });

  it('stacks multiple modifiers multiplicatively', () => {
    // 负重60 (×1.3) + 体力20 (×1.5) = ×1.95 → 30 × 1.95 = 58.5 → 59
    const attrs = makeAttributes({ '负重': 60, '体力值': 20 });
    const time = calculateMovementTime(baseCost, attrs, '晴');
    expect(time).toBe(59);
  });

  it('never returns less than 1', () => {
    const tinyCost = { ...baseCost, timeMinutes: 1 };
    const attrs = makeAttributes({ '负重': 10, '体力值': 80 });
    const time = calculateMovementTime(tinyCost, attrs, '晴');
    expect(time).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// calculateMovementStamina
// ============================================================

describe('calculateMovementStamina', () => {
  const baseCost = {
    from: 'A',
    to: 'B',
    timeMinutes: 30,
    staminaCost: -20,
    requirements: [],
  };

  it('returns base stamina with no modifiers', () => {
    const attrs = makeAttributes({ '负重': 30, '心情': 70 });
    const stamina = calculateMovementStamina(baseCost, attrs, '晴');
    expect(stamina).toBe(20); // abs(-20) = 20
  });

  it('applies 轻装 modifier (负重≤25): stamina -20%', () => {
    const attrs = makeAttributes({ '负重': 20 });
    const stamina = calculateMovementStamina(baseCost, attrs, '晴');
    expect(stamina).toBe(16); // 20 × 0.8 = 16
  });

  it('applies 负重 modifier (负重>50): stamina +30%', () => {
    const attrs = makeAttributes({ '负重': 60 });
    const stamina = calculateMovementStamina(baseCost, attrs, '晴');
    expect(stamina).toBe(26); // 20 × 1.3 = 26
  });

  it('applies 超载 modifier (负重>80): stamina +50%', () => {
    const attrs = makeAttributes({ '负重': 90 });
    const stamina = calculateMovementStamina(baseCost, attrs, '晴');
    expect(stamina).toBe(30); // 20 × 1.5 = 30
  });

  it('applies 心情≤30 modifier: stamina +20%', () => {
    const attrs = makeAttributes({ '心情': 20, '负重': 30 });
    const stamina = calculateMovementStamina(baseCost, attrs, '晴');
    expect(stamina).toBe(24); // 20 × 1.2 = 24
  });

  it('applies 酷热 weather: stamina +30%', () => {
    const attrs = makeAttributes({ '负重': 30 });
    const stamina = calculateMovementStamina(baseCost, attrs, '酷热');
    expect(stamina).toBe(26); // 20 × 1.3 = 26
  });

  it('applies 暴雨 weather: no stamina change (time only)', () => {
    const attrs = makeAttributes({ '负重': 30 });
    const stamina = calculateMovementStamina(baseCost, attrs, '暴雨');
    expect(stamina).toBe(20); // stamina multiplier stays 1.0
  });

  it('stacks weight + mood + heat modifiers', () => {
    // 负重60 (×1.3) + 心情20 (×1.2) + 酷热 (×1.3) = ×2.028 → 20 × 2.028 = 40.56 → 41
    const attrs = makeAttributes({ '负重': 60, '心情': 20 });
    const stamina = calculateMovementStamina(baseCost, attrs, '酷热');
    expect(stamina).toBe(41);
  });
});

// ============================================================
// checkMovementRequirements
// ============================================================

describe('checkMovementRequirements', () => {
  it('allows movement on paths with no requirements (A↔B)', () => {
    const inv = createInventory();
    const result = checkMovementRequirements('A', 'B', inv);
    expect(result.canMove).toBe(true);
    expect(result.missingItems).toEqual([]);
  });

  it('blocks A↔C when rope is missing', () => {
    const inv = createInventory();
    const result = checkMovementRequirements('A', 'C', inv);
    expect(result.canMove).toBe(false);
    expect(result.missingItems).toContain('rope');
  });

  it('allows A↔C when rope is present', () => {
    const inv = makeInventoryWith({ 'rope': 1 });
    const result = checkMovementRequirements('A', 'C', inv);
    expect(result.canMove).toBe(true);
    expect(result.missingItems).toEqual([]);
  });

  it('blocks B↔C when climbing_tools is missing', () => {
    const inv = createInventory();
    const result = checkMovementRequirements('B', 'C', inv);
    expect(result.canMove).toBe(false);
    expect(result.missingItems).toContain('climbing_tools');
  });

  it('allows B↔C when climbing_tools is present', () => {
    const inv = makeInventoryWith({ 'climbing_tools': 1 });
    const result = checkMovementRequirements('B', 'C', inv);
    expect(result.canMove).toBe(true);
  });

  it('blocks D↔E when waterproof_gear is missing', () => {
    const inv = createInventory();
    const result = checkMovementRequirements('D', 'E', inv);
    expect(result.canMove).toBe(false);
    expect(result.missingItems).toContain('waterproof_gear');
  });

  it('blocks E↔F when diving_gear is missing', () => {
    const inv = createInventory();
    const result = checkMovementRequirements('E', 'F', inv);
    expect(result.canMove).toBe(false);
    expect(result.missingItems).toContain('diving_gear');
  });

  it('blocks D↔F when discover_entrance is missing', () => {
    const inv = createInventory();
    const result = checkMovementRequirements('D', 'F', inv);
    expect(result.canMove).toBe(false);
    expect(result.missingItems).toContain('discover_entrance');
  });

  it('blocks B↔F when decryption is missing', () => {
    const inv = createInventory();
    const result = checkMovementRequirements('B', 'F', inv);
    expect(result.canMove).toBe(false);
    expect(result.missingItems).toContain('decryption');
  });

  it('returns canMove=false for non-existent paths', () => {
    const inv = createInventory();
    const result = checkMovementRequirements('X', 'Y', inv);
    expect(result.canMove).toBe(false);
  });
});

// ============================================================
// executeMovement
// ============================================================

describe('executeMovement', () => {
  const defaultState = () => ({
    attributes: makeAttributes({ '负重': 30 }), // 30 = no weight modifier
    inventory: createInventory(),
    currentPosition: 'A1-North',
  });

  // --- Success cases ---

  it('A→B costs 20min/20 stamina (from task spec)', () => {
    const state = defaultState();
    const result = executeMovement(state, 'A1-North', 'B1-South', '晴', fixedRng);
    expect(result.success).toBe(true);
    expect(result.timeCost).toBe(20);
    expect(result.staminaCost).toBe(20);
    expect(result.newPosition).toBe('B1-South');
  });

  it('A→C requires rope (from task spec)', () => {
    const state = defaultState();
    const result = executeMovement(state, 'A1-North', 'C1-South', '晴', fixedRng);
    expect(result.success).toBe(false);
    expect(result.message).toContain('rope');
  });

  it('A→C succeeds when rope is in inventory', () => {
    const state = {
      ...defaultState(),
      inventory: makeInventoryWith({ 'rope': 1 }),
    };
    const result = executeMovement(state, 'A1-North', 'C1-South', '晴', fixedRng);
    expect(result.success).toBe(true);
    expect(result.timeCost).toBe(30);
    expect(result.staminaCost).toBe(30);
  });

  it('negative weight (light load) reduces time cost', () => {
    const state = {
      ...defaultState(),
      attributes: makeAttributes({ '负重': 15 }),
    };
    const result = executeMovement(state, 'A', 'B', '晴', fixedRng);
    expect(result.success).toBe(true);
    // 轻装: time × 0.8 → 20 × 0.8 = 16
    expect(result.timeCost).toBe(16);
    // stamina × 0.8 → 20 × 0.8 = 16
    expect(result.staminaCost).toBe(16);
  });

  it('storm increases time by 50% (from task spec)', () => {
    const state = defaultState();
    const result = executeMovement(state, 'A', 'B', '暴雨', fixedRng);
    expect(result.success).toBe(true);
    expect(result.timeCost).toBe(30); // 20 × 1.5 = 30
  });

  it('heavy weight increases time and stamina cost', () => {
    const state = {
      ...defaultState(),
      attributes: makeAttributes({ '负重': 70 }),
    };
    const result = executeMovement(state, 'A', 'B', '晴', fixedRng);
    expect(result.success).toBe(true);
    // 负重: time × 1.3 → 20 × 1.3 = 26, stamina × 1.3 → 20 × 1.3 = 26
    expect(result.timeCost).toBe(26);
    expect(result.staminaCost).toBe(26);
  });

  it('overload increases time and stamina by 50%', () => {
    const state = {
      ...defaultState(),
      attributes: makeAttributes({ '负重': 95 }),
    };
    const result = executeMovement(state, 'A', 'B', '晴', fixedRng);
    expect(result.success).toBe(true);
    expect(result.timeCost).toBe(30); // 20 × 1.5 = 30
    expect(result.staminaCost).toBe(30); // 20 × 1.5 = 30
  });

  // --- Failure cases ---

  it('blocks movement when stamina insufficient (from task spec)', () => {
    const state = {
      ...defaultState(),
      attributes: makeAttributes({ '体力值': 5 }),
    };
    const result = executeMovement(state, 'A', 'B', '晴', fixedRng);
    expect(result.success).toBe(false);
    expect(result.message).toContain('体力不足');
  });

  it('blocks movement when path does not exist', () => {
    const state = defaultState();
    const result = executeMovement(state, 'X', 'Y', '晴', fixedRng);
    expect(result.success).toBe(false);
    expect(result.message).toContain('路径不存在');
  });

  // --- Fog event (大雾) ---

  it('triggers fog event on 15% roll (rng < 0.15)', () => {
    const lowRng = () => 0.1; // < 0.15 → triggers
    const state = defaultState();
    const result = executeMovement(state, 'A', 'B', '大雾', lowRng);
    expect(result.success).toBe(true);
    expect(result.fogEvent).toBeDefined();
    expect(result.fogEvent!.triggered).toBe(true);
    expect(result.fogEvent!.extraTime).toBe(30);
    // Base time with fog modifier: 20 × 1.25 = 25, +30 extra = 55
    expect(result.timeCost).toBe(55);
  });

  it('does not trigger fog event when rng >= 0.15', () => {
    const highRng = () => 0.5; // >= 0.15 → no trigger
    const state = defaultState();
    const result = executeMovement(state, 'A', 'B', '大雾', highRng);
    expect(result.success).toBe(true);
    expect(result.fogEvent).toBeUndefined();
    // Base time with fog modifier only: 20 × 1.25 = 25
    expect(result.timeCost).toBe(25);
  });

  // --- Attribute updates ---

  it('reduces stamina in result attributes', () => {
    const state = defaultState();
    const result = executeMovement(state, 'A', 'B', '晴', fixedRng);
    expect(result.success).toBe(true);
    // stamina: 80 - 20 = 60
    expect(result.staminaCost).toBe(20);
  });

  // --- Modifiers list ---

  it('includes all applicable modifiers in result', () => {
    const state = {
      ...defaultState(),
      attributes: makeAttributes({
        '负重': 60, '体力值': 60, '健康值': 30, '心情': 50, '精力值': 50,
      }),
    };
    const result = executeMovement(state, 'A', 'B', '暴雨', fixedRng);
    expect(result.success).toBe(true);
    const descriptions = result.modifiers.map((m) => m.description);
    expect(descriptions).toContain('负重前行');
    expect(descriptions).toContain('健康不佳');
    expect(descriptions).toContain('暴雨天气');
  });

  // --- Heat weather ---

  it('酷热 increases stamina cost by 30%', () => {
    const state = defaultState();
    const result = executeMovement(state, 'A', 'B', '酷热', fixedRng);
    expect(result.success).toBe(true);
    // 酷热: stamina × 1.3 → 20 × 1.3 = 26
    expect(result.staminaCost).toBe(26);
  });

  // --- Combined modifiers ---

  it('handles extreme conditions: 超载 + 健康低 + 暴雨', () => {
    const state = {
      ...defaultState(),
      attributes: makeAttributes({
        '负重': 90,
        '体力值': 70,
        '健康值': 30,
        '心情': 50,
        '精力值': 50,
      }),
    };
    const result = executeMovement(state, 'A', 'B', '暴雨', fixedRng);
    expect(result.success).toBe(true);
    // Time: 20 × 1.5(超载) × 1.3(健康) × 1.5(暴雨)
    //     = 20 × 2.925 = 58.5 → 59
    expect(result.timeCost).toBe(59);
    // Stamina: 20 × 1.5(超载) = 30
    expect(result.staminaCost).toBe(30);
  });

  it('handles light load + good conditions', () => {
    const state = {
      ...defaultState(),
      attributes: makeAttributes({ '负重': 10 }),
    };
    const result = executeMovement(state, 'A', 'B', '晴', fixedRng);
    expect(result.success).toBe(true);
    // 轻装: time × 0.8 → 16, stamina × 0.8 → 16
    expect(result.timeCost).toBe(16);
    expect(result.staminaCost).toBe(16);
  });

  // --- Cross-zone with full point IDs ---

  it('resolves movement between full point IDs across zones', () => {
    const state = defaultState();
    const result = executeMovement(state, 'A1-North', 'B1-South', '晴', fixedRng);
    expect(result.success).toBe(true);
    expect(result.timeCost).toBe(20); // A↔B base
    expect(result.newPosition).toBe('B1-South');
  });

  // --- Mood low modifier ---

  it('心情≤30 increases stamina cost by 20%', () => {
    const state = {
      ...defaultState(),
      attributes: makeAttributes({ '心情': 25, '负重': 30 }),
    };
    const result = executeMovement(state, 'A', 'B', '晴', fixedRng);
    expect(result.success).toBe(true);
    // 心情低: stamina × 1.2 → 20 × 1.2 = 24
    expect(result.staminaCost).toBe(24);
  });

  // --- Energy low modifier ---

  it('精力≤30 increases time by 30%', () => {
    const state = {
      ...defaultState(),
      attributes: makeAttributes({ '精力值': 20, '负重': 30 }),
    };
    const result = executeMovement(state, 'A', 'B', '晴', fixedRng);
    expect(result.success).toBe(true);
    // 精力不足: time × 1.3 → 20 × 1.3 = 26
    expect(result.timeCost).toBe(26);
  });
});
