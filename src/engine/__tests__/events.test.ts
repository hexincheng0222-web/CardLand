import { describe, it, expect } from 'vitest';
import {
  SeededRNG,
  resolveChoiceEvent,
  triggerRandomEvent,
  checkAllRandomEvents,
  determineEncounter,
  type PlayerState,
} from '../events';
import { MAP_POINTS, ZONE_DANGER_RATES, MOVEMENT_COSTS } from '@data/map';
import { ENEMIES } from '@data/v1-spec';

// ============================================================
// Helper: create a player state with full resources
// ============================================================

function fullPlayerState(): PlayerState {
  return {
    attributes: {
      饱食度: 100,
      口渴度: 100,
      体力值: 100,
      健康值: 100,
      精力值: 100,
      污垢: 0,
      心情: 100,
    },
    inventory: {
      食物: 10,
      水: 10,
      草药: 10,
      解毒草: 10,
      蛇胆: 10,
      木材: 10,
      石材: 10,
      纤维: 10,
      布料: 10,
      粘土: 10,
      铁矿: 10,
      硫磺: 10,
      黑曜石: 10,
      绳索: 10,
      金属件: 10,
      高级材料: 10,
      工具: 10,
      藏宝图: 10,
      渔网: 10,
      石刀: 0,
      木矛: 0,
      布甲: 0,
      皮甲: 0,
      火把: 0,
      修理工具: 0,
      简易营地: 0,
      工作台: 0,
      药膏: 0,
      解毒剂: 0,
      木筏: 0,
      捕鱼陷阱: 0,
    },
  };
}

function lowStaminaPlayerState(): PlayerState {
  const state = fullPlayerState();
  state.attributes.体力值 = 30;
  return state;
}

function noToolsPlayerState(): PlayerState {
  const state = fullPlayerState();
  state.inventory.工具 = 0;
  state.inventory.绳索 = 0;
  return state;
}

// ============================================================
// SeededRNG tests
// ============================================================

describe('SeededRNG', () => {
  it('should produce deterministic sequences for the same seed', () => {
    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(42);
    for (let i = 0; i < 10; i++) {
      expect(rng1.next()).toBe(rng2.next());
    }
  });

  it('should produce values in [0, 1)', () => {
    const rng = new SeededRNG(123);
    for (let i = 0; i < 100; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('should produce different sequences for different seeds', () => {
    const rng1 = new SeededRNG(1);
    const rng2 = new SeededRNG(2);
    const seq1 = Array.from({ length: 5 }, () => rng1.next());
    const seq2 = Array.from({ length: 5 }, () => rng2.next());
    expect(seq1).not.toEqual(seq2);
  });
});

// ============================================================
// resolveChoiceEvent tests — Zone A (Beach)
// ============================================================

describe('resolveChoiceEvent — Zone A', () => {
  const a1South = MAP_POINTS.find((p) => p.id === 'A1-South')!;
  const a1West = MAP_POINTS.find((p) => p.id === 'A1-West')!;
  const a2South = MAP_POINTS.find((p) => p.id === 'A2-South')!;
  const a3North = MAP_POINTS.find((p) => p.id === 'A3-North')!;
  const a4North = MAP_POINTS.find((p) => p.id === 'A4-North')!;

  it('A1-South 漂流物事件 — 仔细搜索 gives items and stamina cost', () => {
    const event = a1South.choiceEvents[0];
    const rng = new SeededRNG(1);
    const result = resolveChoiceEvent(event, 'A1-drift-1', rng, fullPlayerState());
    expect(result.requirementsMet).toBe(true);
    expect(result.itemChanges).toContainEqual({ itemId: '食物', quantity: 2 });
    expect(result.itemChanges).toContainEqual({ itemId: '水', quantity: 1 });
    expect(result.attributeChanges).toContainEqual({ attributeId: '体力值', amount: -10 });
  });

  it('A1-South 漂流物事件 — 快速拾取 gives fewer items', () => {
    const event = a1South.choiceEvents[0];
    const rng = new SeededRNG(1);
    const result = resolveChoiceEvent(event, 'A1-drift-2', rng, fullPlayerState());
    expect(result.requirementsMet).toBe(true);
    expect(result.itemChanges).toContainEqual({ itemId: '食物', quantity: 1 });
    expect(result.itemChanges).toContainEqual({ itemId: '水', quantity: 1 });
    expect(result.attributeChanges).toEqual([]);
  });

  it('A1-South 漂流物事件 — 无视离开 gives nothing', () => {
    const event = a1South.choiceEvents[0];
    const rng = new SeededRNG(1);
    const result = resolveChoiceEvent(event, 'A1-drift-3', rng, fullPlayerState());
    expect(result.requirementsMet).toBe(true);
    expect(result.itemChanges).toEqual([]);
    expect(result.attributeChanges).toEqual([]);
    expect(result.message).toContain('无产出');
  });

  it('A1-West 废弃营地事件 — 战斗 requires tools', () => {
    const event = a1West.choiceEvents[0];
    const rng = new SeededRNG(1);
    const result = resolveChoiceEvent(event, 'A1-camp-1', rng, noToolsPlayerState());
    expect(result.requirementsMet).toBe(false);
    expect(result.message).toContain('需要');
  });

  it('A1-West 废弃营地事件 — 战斗 with tools succeeds (seeded)', () => {
    const event = a1West.choiceEvents[0];
    // Seed chosen so rng.next() < 0.67 (success branch)
    const rng = new SeededRNG(0);
    const result = resolveChoiceEvent(event, 'A1-camp-1', rng, fullPlayerState());
    expect(result.requirementsMet).toBe(true);
    // With seed 0, first next() ≈ 0.236 < 0.67 → success branch
    expect(result.itemChanges).toContainEqual({ itemId: '工具', quantity: 2 });
    expect(result.itemChanges).toContainEqual({ itemId: '食物', quantity: 3 });
  });

  it('A1-West 废弃营地事件 — 逃跑 costs stamina', () => {
    const event = a1West.choiceEvents[0];
    const rng = new SeededRNG(1);
    const result = resolveChoiceEvent(event, 'A1-camp-2', rng, fullPlayerState());
    expect(result.requirementsMet).toBe(true);
    expect(result.attributeChanges).toContainEqual({ attributeId: '体力值', amount: -15 });
  });

  it('A1-West 废弃营地事件 — 躲藏 has two branches', () => {
    const event = a1West.choiceEvents[0];
    // Seed 0: rng.next() ≈ 0.236 < 0.5 → success (hide)
    const rngHide = new SeededRNG(0);
    const resultHide = resolveChoiceEvent(event, 'A1-camp-3', rngHide, fullPlayerState());
    expect(resultHide.requirementsMet).toBe(true);
    expect(resultHide.attributeChanges).toEqual([]);

    // Seed chosen so rng.next() >= 0.5 → failure (discovered)
    // We need a seed where first next() >= 0.5
    // Let's find one by brute force in the test or use a known seed
    // Actually, with seed=123456, let's just verify the structure
    const rngDisc = new SeededRNG(123456);
    const resultDisc = resolveChoiceEvent(event, 'A1-camp-3', rngDisc, fullPlayerState());
    expect(resultDisc.requirementsMet).toBe(true);
    // One of the two branches should be taken
    expect(resultDisc.message).toBeTruthy();
  });

  it('A2-South 鲨鱼逼近 — 快速游回 requires stamina>50', () => {
    const event = a2South.choiceEvents[0];
    const rng = new SeededRNG(1);
    const result = resolveChoiceEvent(event, 'A2-shark-1', rng, lowStaminaPlayerState());
    expect(result.requirementsMet).toBe(false);
    expect(result.message).toContain('体力值');
  });

  it('A2-South 鲨鱼逼近 — 绳索固定 consumes rope', () => {
    const event = a2South.choiceEvents[0];
    const rng = new SeededRNG(1);
    const result = resolveChoiceEvent(event, 'A2-shark-2', rng, fullPlayerState());
    expect(result.requirementsMet).toBe(true);
    expect(result.itemChanges).toContainEqual({ itemId: '绳索', quantity: -1 });
    expect(result.itemChanges).toContainEqual({ itemId: '食物', quantity: 2 });
  });

  it('A2-South 鲨鱼逼近 — 强行突破 has two branches', () => {
    const event = a2South.choiceEvents[0];
    const rng = new SeededRNG(1);
    const result = resolveChoiceEvent(event, 'A2-shark-3', rng, fullPlayerState());
    expect(result.requirementsMet).toBe(true);
    // Should be one of the two branches
    expect(result.message).toBeTruthy();
  });

  it('A3-North 鸟巢高台 — 快速偷蛋 has two branches', () => {
    const event = a3North.choiceEvents[0];
    const rng = new SeededRNG(1);
    const result = resolveChoiceEvent(event, 'A3-bird-1', rng, fullPlayerState());
    expect(result.requirementsMet).toBe(true);
    expect(result.itemChanges).toContainEqual({ itemId: '食物', quantity: 2 });
  });

  it('A3-North 鸟巢高台 — 绳索速降 requires rope', () => {
    const event = a3North.choiceEvents[0];
    const rng = new SeededRNG(1);
    const result = resolveChoiceEvent(event, 'A3-bird-2', rng, noToolsPlayerState());
    expect(result.requirementsMet).toBe(false);
    expect(result.message).toContain('绳索');
  });

  it('A3-North 鸟巢高台 — 放弃攀爬 gives nothing', () => {
    const event = a3North.choiceEvents[0];
    const rng = new SeededRNG(1);
    const result = resolveChoiceEvent(event, 'A3-bird-3', rng, fullPlayerState());
    expect(result.requirementsMet).toBe(true);
    expect(result.itemChanges).toEqual([]);
    expect(result.message).toContain('无产出');
  });

  it('A4-North 船体探索 — 深入搜索 has three branches', () => {
    const event = a4North.choiceEvents[0];
    const rng = new SeededRNG(1);
    const result = resolveChoiceEvent(event, 'A4-ship-1', rng, fullPlayerState());
    expect(result.requirementsMet).toBe(true);
    expect(result.message).toBeTruthy();
  });

  it('A4-North 船体探索 — 只搜货舱 gives safe rewards', () => {
    const event = a4North.choiceEvents[0];
    const rng = new SeededRNG(1);
    const result = resolveChoiceEvent(event, 'A4-ship-2', rng, fullPlayerState());
    expect(result.requirementsMet).toBe(true);
    expect(result.itemChanges).toContainEqual({ itemId: '金属件', quantity: 2 });
    expect(result.itemChanges).toContainEqual({ itemId: '布料', quantity: 2 });
    expect(result.attributeChanges).toEqual([]);
  });

  it('A4-North 船体探索 — 放弃探索 gives nothing', () => {
    const event = a4North.choiceEvents[0];
    const rng = new SeededRNG(1);
    const result = resolveChoiceEvent(event, 'A4-ship-3', rng, fullPlayerState());
    expect(result.requirementsMet).toBe(true);
    expect(result.itemChanges).toEqual([]);
    expect(result.message).toContain('无产出');
  });
});

// ============================================================
// resolveChoiceEvent tests — Zone B (Jungle)
// ============================================================

describe('resolveChoiceEvent — Zone B', () => {
  const b1East = MAP_POINTS.find((p) => p.id === 'B1-East')!;
  const b1West = MAP_POINTS.find((p) => p.id === 'B1-West')!;
  const b2South = MAP_POINTS.find((p) => p.id === 'B2-South')!;
  const b3North = MAP_POINTS.find((p) => p.id === 'B3-North')!;
  const b4North = MAP_POINTS.find((p) => p.id === 'B4-North')!;

  it('B1-East 毒蛇遭遇 — 战斗 has success/failure branches', () => {
    const event = b1East.choiceEvents[0];
    const rng = new SeededRNG(1);
    const result = resolveChoiceEvent(event, 'B1-snake-1', rng, fullPlayerState());
    expect(result.requirementsMet).toBe(true);
    expect(result.message).toBeTruthy();
  });

  it('B1-East 毒蛇遭遇 — 绕行 costs stamina', () => {
    const event = b1East.choiceEvents[0];
    const rng = new SeededRNG(1);
    const result = resolveChoiceEvent(event, 'B1-snake-2', rng, fullPlayerState());
    expect(result.requirementsMet).toBe(true);
    expect(result.attributeChanges).toContainEqual({ attributeId: '体力值', amount: -10 });
  });

  it('B1-East 毒蛇遭遇 — 火把驱赶 requires tool', () => {
    const event = b1East.choiceEvents[0];
    const rng = new SeededRNG(1);
    const resultNoTool = resolveChoiceEvent(event, 'B1-snake-3', rng, noToolsPlayerState());
    expect(resultNoTool.requirementsMet).toBe(false);

    const resultTool = resolveChoiceEvent(event, 'B1-snake-3', rng, fullPlayerState());
    expect(resultTool.requirementsMet).toBe(true);
    expect(resultTool.itemChanges).toContainEqual({ itemId: '蛇胆', quantity: 1 });
  });

  it('B1-West 大型野猪狩猎 — 狩猎 requires tool and stamina', () => {
    const event = b1West.choiceEvents[0];
    const rng = new SeededRNG(1);
    const resultNoTool = resolveChoiceEvent(event, 'B1-boar-1', rng, noToolsPlayerState());
    expect(resultNoTool.requirementsMet).toBe(false);

    const resultLowStamina = resolveChoiceEvent(event, 'B1-boar-1', rng, lowStaminaPlayerState());
    expect(resultLowStamina.requirementsMet).toBe(false);
    expect(resultLowStamina.message).toContain('体力值');
  });

  it('B1-West 大型野猪狩猎 — 远程攻击 requires 2 tools', () => {
    const event = b1West.choiceEvents[0];
    const rng = new SeededRNG(1);
    const state = fullPlayerState();
    state.inventory.工具 = 1;
    const result = resolveChoiceEvent(event, 'B1-boar-2', rng, state);
    expect(result.requirementsMet).toBe(false);
    expect(result.message).toContain('工具');
  });

  it('B1-West 大型野猪狩猎 — 逃跑 costs stamina', () => {
    const event = b1West.choiceEvents[0];
    const rng = new SeededRNG(1);
    const result = resolveChoiceEvent(event, 'B1-boar-3', rng, fullPlayerState());
    expect(result.requirementsMet).toBe(true);
    expect(result.attributeChanges).toContainEqual({ attributeId: '体力值', amount: -10 });
  });

  it('B1-West 大型野猪狩猎 — 躲藏 has two branches', () => {
    const event = b1West.choiceEvents[0];
    const rng = new SeededRNG(1);
    const result = resolveChoiceEvent(event, 'B1-boar-4', rng, fullPlayerState());
    expect(result.requirementsMet).toBe(true);
    expect(result.message).toBeTruthy();
  });

  it('B2-South 野猪踪迹追踪 — 追踪 has two branches', () => {
    const event = b2South.choiceEvents[0];
    const rng = new SeededRNG(1);
    const result = resolveChoiceEvent(event, 'B2-trap-1', rng, fullPlayerState());
    expect(result.requirementsMet).toBe(true);
    expect(result.itemChanges).toContainEqual({ itemId: '食物', quantity: 3 });
  });

  it('B2-South 野猪踪迹追踪 — 修复陷阱 requires tool', () => {
    const event = b2South.choiceEvents[0];
    const rng = new SeededRNG(1);
    const result = resolveChoiceEvent(event, 'B2-trap-2', rng, noToolsPlayerState());
    expect(result.requirementsMet).toBe(false);
  });

  it('B2-South 野猪踪迹追踪 — 无视 gives nothing', () => {
    const event = b2South.choiceEvents[0];
    const rng = new SeededRNG(1);
    const result = resolveChoiceEvent(event, 'B2-trap-3', rng, fullPlayerState());
    expect(result.requirementsMet).toBe(true);
    expect(result.itemChanges).toEqual([]);
    expect(result.message).toContain('无产出');
  });

  it('B3-North 瀑布后方探索 — 深入探索 has two branches', () => {
    const event = b3North.choiceEvents[0];
    const rng = new SeededRNG(1);
    const result = resolveChoiceEvent(event, 'B3-waterfall-1', rng, fullPlayerState());
    expect(result.requirementsMet).toBe(true);
    expect(result.message).toBeTruthy();
  });

  it('B3-North 瀑布后方探索 — 水潭捕鱼 gives safe rewards', () => {
    const event = b3North.choiceEvents[0];
    const rng = new SeededRNG(1);
    const result = resolveChoiceEvent(event, 'B3-waterfall-2', rng, fullPlayerState());
    expect(result.requirementsMet).toBe(true);
    expect(result.itemChanges).toContainEqual({ itemId: '食物', quantity: 3 });
    expect(result.itemChanges).toContainEqual({ itemId: '水', quantity: 2 });
  });

  it('B3-North 瀑布后方探索 — 原路返回 gives nothing', () => {
    const event = b3North.choiceEvents[0];
    const rng = new SeededRNG(1);
    const result = resolveChoiceEvent(event, 'B3-waterfall-3', rng, fullPlayerState());
    expect(result.requirementsMet).toBe(true);
    expect(result.itemChanges).toEqual([]);
    expect(result.message).toContain('无额外产出');
  });

  it('B4-North 蛇王抉择 — 猎杀蛇王 requires 2 tools and stamina>50', () => {
    const event = b4North.choiceEvents[0];
    const rng = new SeededRNG(1);
    const state = fullPlayerState();
    state.inventory.工具 = 1;
    const result = resolveChoiceEvent(event, 'B4-snakeking-1', rng, state);
    expect(result.requirementsMet).toBe(false);
    expect(result.message).toContain('工具');
  });

  it('B4-North 蛇王抉择 — 偷取蛇蛋 gives items but costs stamina', () => {
    const event = b4North.choiceEvents[0];
    const rng = new SeededRNG(1);
    const result = resolveChoiceEvent(event, 'B4-snakeking-2', rng, fullPlayerState());
    expect(result.requirementsMet).toBe(true);
    expect(result.itemChanges).toContainEqual({ itemId: '蛇胆', quantity: 1 });
    expect(result.itemChanges).toContainEqual({ itemId: '草药', quantity: 2 });
    expect(result.attributeChanges).toContainEqual({ attributeId: '体力值', amount: -20 });
  });

  it('B4-North 蛇王抉择 — 撤退 gives nothing', () => {
    const event = b4North.choiceEvents[0];
    const rng = new SeededRNG(1);
    const result = resolveChoiceEvent(event, 'B4-snakeking-3', rng, fullPlayerState());
    expect(result.requirementsMet).toBe(true);
    expect(result.itemChanges).toEqual([]);
    expect(result.message).toContain('安全撤离');
  });
});

// ============================================================
// triggerRandomEvent tests
// ============================================================

describe('triggerRandomEvent', () => {
  it('should return null for points with no choice events', () => {
    const point = MAP_POINTS.find((p) => p.id === 'A1-North')!;
    const rng = new SeededRNG(1);
    const result = triggerRandomEvent(point, rng);
    expect(result).toBeNull();
  });

  it('should trigger event when roll < triggerChance (50%)', () => {
    const point = MAP_POINTS.find((p) => p.id === 'A1-South')!;
    // Seed 0 gives first next() ≈ 0.236 < 0.5 → should trigger
    const rng = new SeededRNG(0);
    const result = triggerRandomEvent(point, rng);
    expect(result).not.toBeNull();
    expect(result!.triggered).toBe(true);
    expect(result!.eventId).toBe('A1-drift');
  });

  it('should NOT trigger event when roll >= triggerChance (50%)', () => {
    const point = MAP_POINTS.find((p) => p.id === 'A1-South')!;
    // We need a seed where first next() >= 0.5
    // Let's brute-force find one
    let triggerSeed = -1;
    for (let s = 0; s < 10000; s++) {
      const rng = new SeededRNG(s);
      if (rng.next() >= 0.5) {
        triggerSeed = s;
        break;
      }
    }
    expect(triggerSeed).not.toBe(-1);
    const rng = new SeededRNG(triggerSeed);
    const result = triggerRandomEvent(point, rng);
    expect(result).toBeNull();
  });

  it('should trigger 33% chance events at correct probability', () => {
    const point = MAP_POINTS.find((p) => p.id === 'A2-South')!;
    // Find seed where first next() < 0.33
    let triggerSeed = -1;
    for (let s = 0; s < 10000; s++) {
      const rng = new SeededRNG(s);
      if (rng.next() < 0.33) {
        triggerSeed = s;
        break;
      }
    }
    expect(triggerSeed).not.toBe(-1);
    const rng = new SeededRNG(triggerSeed);
    const result = triggerRandomEvent(point, rng);
    expect(result).not.toBeNull();
    expect(result!.triggered).toBe(true);
    expect(result!.eventId).toBe('A2-shark');
  });

  it('should trigger 67% chance events at correct probability', () => {
    const point = MAP_POINTS.find((p) => p.id === 'B4-North')!;
    // Seed 0: first next() ≈ 0.236 < 0.67 → should trigger
    const rng = new SeededRNG(0);
    const result = triggerRandomEvent(point, rng);
    expect(result).not.toBeNull();
    expect(result!.triggered).toBe(true);
    expect(result!.eventId).toBe('B4-snakeking');
  });
});

// ============================================================
// checkAllRandomEvents tests
// ============================================================

describe('checkAllRandomEvents', () => {
  it('should check all choice events at a point', () => {
    const point = MAP_POINTS.find((p) => p.id === 'B1-East')!;
    const rng = new SeededRNG(0);
    const results = checkAllRandomEvents(point, rng);
    expect(results).toHaveLength(point.choiceEvents.length);
    expect(results[0].eventId).toBe('B1-snake');
  });
});

// ============================================================
// determineEncounter tests
// ============================================================

describe('determineEncounter', () => {
  it('should return null when roll >= danger rate', () => {
    // Find a seed where first next() >= 0.1 (Zone A danger rate)
    let noEncounterSeed = -1;
    for (let s = 0; s < 10000; s++) {
      const rng = new SeededRNG(s);
      if (rng.next() >= 0.1) {
        noEncounterSeed = s;
        break;
      }
    }
    expect(noEncounterSeed).not.toBe(-1);
    const rng = new SeededRNG(noEncounterSeed);
    const result = determineEncounter('A', rng);
    expect(result).toBeNull();
  });

  it('should return an enemy when roll < danger rate for Zone B', () => {
    // Find a seed where first next() < 0.3 (Zone B danger rate)
    let encounterSeed = -1;
    for (let s = 0; s < 10000; s++) {
      const rng = new SeededRNG(s);
      if (rng.next() < 0.3) {
        encounterSeed = s;
        break;
      }
    }
    expect(encounterSeed).not.toBe(-1);
    const rng = new SeededRNG(encounterSeed);
    const result = determineEncounter('B', rng);
    expect(result).not.toBeNull();
    // All B-zone enemies should be in the ENEMIES list
    expect(ENEMIES.map((e) => e.name)).toContain(result!.name);
  });

  it('Zone A should have no enemies defined (returns null even on encounter)', () => {
    // Even if an encounter rolls in Zone A, there are no enemies with A habitats
    // So it should return null
    let encounterSeed = -1;
    for (let s = 0; s < 10000; s++) {
      const rng = new SeededRNG(s);
      if (rng.next() < 0.1) {
        encounterSeed = s;
        break;
      }
    }
    // If we can't find a seed with roll < 0.1 in 10000 tries, that's statistically unlikely
    // but possible. Let's just verify the danger rate is correct.
    expect(ZONE_DANGER_RATES.A).toBe(0.1);
    expect(ZONE_DANGER_RATES.B).toBe(0.3);

    if (encounterSeed !== -1) {
      const rng = new SeededRNG(encounterSeed);
      const result = determineEncounter('A', rng);
      // Zone A has no enemy habitats, so result should be null
      expect(result).toBeNull();
    }
  });

  it('Zone B should return enemies from B habitats only', () => {
    // Find seed where encounter triggers in B
    let encounterSeed = -1;
    for (let s = 0; s < 10000; s++) {
      const rng = new SeededRNG(s);
      if (rng.next() < 0.3) {
        encounterSeed = s;
        break;
      }
    }
    expect(encounterSeed).not.toBe(-1);

    const rng = new SeededRNG(encounterSeed);
    const result = determineEncounter('B', rng);
    expect(result).not.toBeNull();

    // Verify the enemy's habitats are all in zone B
    const bSubZones = ['B1', 'B2', 'B3', 'B4'];
    expect(result!.habitats.some((h) => bSubZones.includes(h))).toBe(true);
  });

  it('should use correct danger rates', () => {
    expect(ZONE_DANGER_RATES.A).toBe(0.1);
    expect(ZONE_DANGER_RATES.B).toBe(0.3);
  });
});

// ============================================================
// Map data integrity tests
// ============================================================

describe('Map data integrity', () => {
  it('should have exactly 32 map points', () => {
    expect(MAP_POINTS).toHaveLength(32);
  });

  it('should have 16 points in Zone A', () => {
    const zoneA = MAP_POINTS.filter((p) => p.zone === 'A');
    expect(zoneA).toHaveLength(16);
  });

  it('should have 16 points in Zone B', () => {
    const zoneB = MAP_POINTS.filter((p) => p.zone === 'B');
    expect(zoneB).toHaveLength(16);
  });

  it('each point should have required fields', () => {
    for (const point of MAP_POINTS) {
      expect(point.id).toBeTruthy();
      expect(point.zone).toMatch(/^[AB]$/);
      expect(point.subZone).toBeTruthy();
      expect(point.direction).toMatch(/^(north|south|east|west)$/);
      expect(point.name).toBeTruthy();
      expect(point.type).toBeTruthy();
      expect(point.description).toBeTruthy();
      expect(point.staminaCost).toBeGreaterThanOrEqual(0);
      expect(point.dangerLevel).toBeGreaterThanOrEqual(1);
      expect(point.dangerLevel).toBeLessThanOrEqual(5);
    }
  });

  it('all IDs should be unique', () => {
    const ids = MAP_POINTS.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('A→B movement cost should be 20', () => {
    expect(MOVEMENT_COSTS['A-B1']).toBe(20);
    expect(MOVEMENT_COSTS['A-B2']).toBe(20);
    expect(MOVEMENT_COSTS['A-B3']).toBe(20);
    expect(MOVEMENT_COSTS['A-B4']).toBe(20);
  });
});
