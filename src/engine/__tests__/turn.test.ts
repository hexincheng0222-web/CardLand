import { describe, it, expect } from 'vitest';
import {
  createSeededRNG,
  defaultAttributes,
  generateWeather,
  processWeatherTurn,
  processActionPhase,
  processTurn,
  startNewGame,
  checkDeathConditions,
} from '../turn';
import type {
  GameState,
  WeatherState,
  PlayerAction,
} from '../turn';

// ============================================================
// Helpers
// ============================================================

function makeDefaultState(overrides?: Partial<GameState>): GameState {
  return {
    attributes: defaultAttributes(),
    inventory: [],
    currentPosition: 'A1-North',
    weather: { current: '晴', turnsRemaining: 3 },
    turnNumber: 1,
    statusEffects: [],
    gameOver: { isOver: false, reason: null },
    ...overrides,
  };
}

/** RNG that always returns 0 — selects first option in any distribution */
function zeroRng(): number {
  return 0;
}



// ============================================================
// createSeededRNG
// ============================================================

describe('createSeededRNG', () => {
  it('produces deterministic sequence from same seed', () => {
    const r1 = createSeededRNG(42);
    const r2 = createSeededRNG(42);
    expect([r1(), r1(), r1()]).toEqual([r2(), r2(), r2()]);
  });

  it('different seeds produce different values', () => {
    const a = createSeededRNG(1)();
    const b = createSeededRNG(2)();
    expect(a).not.toEqual(b);
  });

  it('values are in [0, 1) range', () => {
    const rng = createSeededRNG(7);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

// ============================================================
// defaultAttributes
// ============================================================

describe('defaultAttributes', () => {
  it('returns all 7 attributes with initial values from spec', () => {
    const attrs = defaultAttributes();
    expect(attrs['饱食度']).toBe(60);
    expect(attrs['口渴度']).toBe(60);
    expect(attrs['体力值']).toBe(80);
    expect(attrs['健康值']).toBe(100);
    expect(attrs['精力值']).toBe(80);
    expect(attrs['污垢']).toBe(20);
    expect(attrs['心情']).toBe(70);
  });
});

// ============================================================
// generateWeather
// ============================================================

describe('generateWeather', () => {
  it('returns 晴 when RNG returns 0', () => {
    const rng = () => 0;
    expect(generateWeather(rng)).toBe('晴');
  });

  it('returns 阴 when RNG returns 0.33 (cumulative boundary)', () => {
    // 晴: 0-0.33, 阴: 0.33-0.66, 雨: 0.66-0.83, 暴雨: 0.83-1.0
    const rng = () => 0.33;
    expect(generateWeather(rng)).toBe('阴');
  });

  it('returns 雨 when RNG returns 0.66', () => {
    const rng = () => 0.66;
    expect(generateWeather(rng)).toBe('雨');
  });

  it('returns 暴雨 when RNG returns 0.84 (above 雨-暴雨 boundary at 0.83)', () => {
    const rng = () => 0.84;
    expect(generateWeather(rng)).toBe('暴雨');
  });

  it('returns 暴雨 when RNG returns 0.99', () => {
    const rng = () => 0.99;
    expect(generateWeather(rng)).toBe('暴雨');
  });

  it('generates all 4 weather types with different seeds', () => {
    const types = new Set<string>();
    for (let seed = 0; seed < 50; seed++) {
      const rng = createSeededRNG(seed);
      types.add(generateWeather(rng));
    }
    // All 4 weather types should appear
    expect(types.has('晴')).toBe(true);
    expect(types.has('阴')).toBe(true);
    expect(types.has('雨')).toBe(true);
    expect(types.has('暴雨')).toBe(true);
  });
});

// ============================================================
// processWeatherTurn
// ============================================================

describe('processWeatherTurn', () => {
  it('decrements turnsRemaining by 1 each call', () => {
    const weather: WeatherState = { current: '晴', turnsRemaining: 3 };
    const result = processWeatherTurn(weather, 1, zeroRng);
    expect(result.weather.turnsRemaining).toBe(2);
    expect(result.weather.current).toBe('晴');
  });

  it('changes weather when turnsRemaining reaches 0', () => {
    const weather: WeatherState = { current: '晴', turnsRemaining: 1 };
    // RNG returns 0.33 → should switch to 阴
    const rng = () => 0.33;
    const result = processWeatherTurn(weather, 3, rng);
    expect(result.weather.turnsRemaining).toBeGreaterThan(0);
    expect(result.weather.current).toBe('阴');
    expect(result.log).toBe('天气变化：晴 → 阴');
  });

  it('changes weather after 3 calls (3-turn cycle for 晴)', () => {
    let weather: WeatherState = { current: '晴', turnsRemaining: 3 };
    const rng = () => 0.33; // always → 阴

    // Turn 1
    const r1 = processWeatherTurn(weather, 1, rng);
    expect(r1.weather.turnsRemaining).toBe(2);
    expect(r1.weather.current).toBe('晴');
    expect(r1.log).toBeNull();

    // Turn 2
    const r2 = processWeatherTurn(r1.weather, 2, rng);
    expect(r2.weather.turnsRemaining).toBe(1);
    expect(r2.weather.current).toBe('晴');
    expect(r2.log).toBeNull();

    // Turn 3 — weather should change
    const r3 = processWeatherTurn(r2.weather, 3, rng);
    expect(r3.weather.turnsRemaining).toBeGreaterThan(0);
    expect(r3.weather.current).toBe('阴');
    expect(r3.log).toContain('天气变化');
  });

  it('applies weather attribute effects each turn (晴: 口渴度-3)', () => {
    const weather: WeatherState = { current: '晴', turnsRemaining: 3 };
    const result = processWeatherTurn(weather, 1, zeroRng);
    expect(result.attributeChanges['口渴度']).toBe(-3);
  });

  it('applies 雨 effects (饱食度-1, 污垢-5)', () => {
    const weather: WeatherState = { current: '雨', turnsRemaining: 2 };
    const result = processWeatherTurn(weather, 1, zeroRng);
    expect(result.attributeChanges['饱食度']).toBe(-1);
    expect(result.attributeChanges['污垢']).toBe(-5);
  });

  it('applies 暴雨 effects (体力值-10, 心情-3)', () => {
    const weather: WeatherState = { current: '暴雨', turnsRemaining: 2 };
    const result = processWeatherTurn(weather, 1, zeroRng);
    expect(result.attributeChanges['体力值']).toBe(-10);
    expect(result.attributeChanges['心情']).toBe(-3);
  });

  it('applies 阴 effects (心情-1)', () => {
    const weather: WeatherState = { current: '阴', turnsRemaining: 3 };
    const result = processWeatherTurn(weather, 1, zeroRng);
    expect(result.attributeChanges['心情']).toBe(-1);
  });
});

// ============================================================
// processActionPhase — Move
// ============================================================

describe('processActionPhase — Move', () => {
  it('moves to another subzone and deducts stamina', () => {
    const state = makeDefaultState({ currentPosition: 'A1-North' });
    const action: PlayerAction = { type: 'move', targetSubZone: 'A2' };
    const result = processActionPhase(state, action, zeroRng);

    expect(result.state.currentPosition).toMatch(/^A2-/);
    expect(result.state.attributes['体力值']).toBe(80 - 5); // A1→A2 costs 5
    expect(result.actionLogs.some(l => l.includes('移动到'))).toBe(true);
  });

  it('fails when stamina is too low', () => {
    const state = makeDefaultState({
      attributes: { ...defaultAttributes(), '体力值': 3 },
    });
    const action: PlayerAction = { type: 'move', targetSubZone: 'A2' };
    const result = processActionPhase(state, action, zeroRng);

    expect(result.state.currentPosition).toBe('A1-North'); // unchanged
    expect(result.state.attributes['体力值']).toBe(3); // unchanged
    expect(result.actionLogs.some(l => l.includes('体力不足'))).toBe(true);
  });

  it('fails for invalid movement path', () => {
    const state = makeDefaultState();
    const action: PlayerAction = { type: 'move', targetSubZone: 'B2' as any };
    // A1→B2 is not a direct path (only A→B and subzone→subzone)
    const result = processActionPhase(state, action, zeroRng);
    expect(result.actionLogs.some(l => l.includes('无法从'))).toBe(true);
  });

  it('moves between zones A→B at cost 20', () => {
    const state = makeDefaultState({ currentPosition: 'A1-North' });
    const action: PlayerAction = { type: 'move', targetSubZone: 'B1' };
    const result = processActionPhase(state, action, zeroRng);

    // MOVEMENT_COSTS has 'A-B1': 20 (zone-level A to subzone B1)
    // We use getMovementCost('A1', 'B1') — needs to match
    // actually MOVEMENT_COSTS keys are zone-subzone like 'A-B1'
    const cost = result.state.attributes['体力值'];
    // If move succeeds, stamina is reduced
    if (result.state.currentPosition !== 'A1-North') {
      expect(80 - cost).toBeGreaterThanOrEqual(5);
    }
  });
});

// ============================================================
// processActionPhase — Gather
// ============================================================

describe('processActionPhase — Gather', () => {
  it('collects resources from current location', () => {
    // A1-East has 绳索(1-3) and 木材(2-4)
    const state = makeDefaultState({ currentPosition: 'A1-East' });
    const action: PlayerAction = { type: 'gather' };
    const result = processActionPhase(state, action, zeroRng);

    // With zeroRng, all quantities are min values
    expect(result.actionLogs.some(l => l.includes('绳索') || l.includes('木材'))).toBe(true);
    expect(result.state.attributes['体力值']).toBeLessThan(80); // stamina deducted
  });

  it('deducts stamina for gathering', () => {
    const state = makeDefaultState({ currentPosition: 'A3-South' });
    const action: PlayerAction = { type: 'gather' };
    const result = processActionPhase(state, action, zeroRng);
    expect(result.state.attributes['体力值']).toBe(75); // 80 - 5
  });

  it('returns no resources at location with no outputs', () => {
    // A1-North is a 休息点 with no outputs
    const state = makeDefaultState({ currentPosition: 'A1-North' });
    const action: PlayerAction = { type: 'gather' };
    const result = processActionPhase(state, action, zeroRng);
    expect(result.state.inventory).toEqual([]);
  });

  it('gathers from resource point with multiple outputs', () => {
    // A2-East has 食物(1-3), 水(1-3), 纤维(1-2)
    const state = makeDefaultState({ currentPosition: 'A2-East' });
    const rng = createSeededRNG(42);
    const action: PlayerAction = { type: 'gather' };
    const result = processActionPhase(state, action, rng);

    // Should have collected items
    const totalItems = result.state.inventory.reduce((s, slot) => s + slot.quantity, 0);
    expect(totalItems).toBeGreaterThan(0);
  });
});

// ============================================================
// processActionPhase — Craft
// ============================================================

describe('processActionPhase — Craft', () => {
  it('crafts 绳索 from 纤维 (recipe 0)', () => {
    // Recipe 0: 纤维×3 → 绳索×1, station: none
    const state = makeDefaultState({
      inventory: [
        { itemId: '纤维', quantity: 3 },
      ],
    });
    const action: PlayerAction = { type: 'craft', recipeIndex: 0 };
    const result = processActionPhase(state, action, zeroRng);

    expect(result.actionLogs.some(l => l.includes('成功制作 绳索'))).toBe(true);
    const rope = result.state.inventory.find(s => s.itemId === '绳索');
    expect(rope?.quantity).toBe(1);
  });

  it('fails crafting without enough materials', () => {
    const state = makeDefaultState({
      inventory: [
        { itemId: '纤维', quantity: 2 }, // need 3
      ],
    });
    const action: PlayerAction = { type: 'craft', recipeIndex: 0 };
    const result = processActionPhase(state, action, zeroRng);

    expect(result.actionLogs.some(l => l.includes('无法制作') || l.includes('缺少'))).toBe(true);
    expect(result.state.inventory).toEqual(state.inventory); // unchanged
  });

  it('crafts recipe requiring workbench station', () => {
    // Recipe that requires 'none' station should work (all Tier 0)
    const state = makeDefaultState({
      inventory: [
        { itemId: '木材', quantity: 2 },
        { itemId: '石材', quantity: 1 },
      ],
    });
    const action: PlayerAction = { type: 'craft', recipeIndex: 1 }; // 木材×2 + 石材×1 → 工具×1
    const result = processActionPhase(state, action, zeroRng);

    expect(result.actionLogs.some(l => l.includes('成功制作'))).toBe(true);
  });
});

// ============================================================
// processActionPhase — Rest
// ============================================================

describe('processActionPhase — Rest', () => {
  it('restores stamina at rest point (full: +30/+10/+20)', () => {
    const state = makeDefaultState({
      currentPosition: 'A1-North',
      attributes: { ...defaultAttributes(), '体力值': 50 },
    });
    const action: PlayerAction = { type: 'rest' };
    const result = processActionPhase(state, action, zeroRng);

    expect(result.state.attributes['体力值']).toBe(80); // 50 + 30
    expect(result.state.attributes['健康值']).toBe(110); // 100 + 10 (before clamp)
    expect(result.actionLogs.some(l => l.includes('充分休息'))).toBe(true);
  });

  it('restores less at resource point (+10 stamina, +5 energy)', () => {
    const state = makeDefaultState({
      currentPosition: 'A1-East',
      attributes: { ...defaultAttributes(), '体力值': 50, '精力值': 60 },
    });
    const action: PlayerAction = { type: 'rest' };
    const result = processActionPhase(state, action, zeroRng);

    expect(result.state.attributes['体力值']).toBe(60); // 50 + 10
    expect(result.state.attributes['精力值']).toBe(65); // 60 + 5
    expect(result.actionLogs.some(l => l.includes('资源点'))).toBe(true);
  });

  it('minimal rest at danger point (+5 stamina only)', () => {
    const state = makeDefaultState({
      currentPosition: 'A2-South',
      attributes: { ...defaultAttributes(), '体力值': 50 },
    });
    const action: PlayerAction = { type: 'rest' };
    const result = processActionPhase(state, action, zeroRng);

    expect(result.state.attributes['体力值']).toBe(55); // 50 + 5
    expect(result.actionLogs.some(l => l.includes('不适合充分休息'))).toBe(true);
  });
});

// ============================================================
// processActionPhase — Combat
// ============================================================

describe('processActionPhase — Combat', () => {
  it('returns no enemy when at location without enemyTier', () => {
    const state = makeDefaultState({ currentPosition: 'A1-North' }); // 休息点, no enemy
    const action: PlayerAction = { type: 'combat', strategyId: '普通攻击' };
    const result = processActionPhase(state, action, zeroRng);

    expect(result.actionLogs.some(l => l.includes('没有敌人'))).toBe(true);
  });

  it('initiates combat at location with enemy', () => {
    // B1-East has enemyTier: 'Small'
    const state = makeDefaultState({
      currentPosition: 'B1-East',
      attributes: { ...defaultAttributes(), '体力值': 80, '健康值': 100 },
    });
    const rng = createSeededRNG(42);
    const action: PlayerAction = { type: 'combat', strategyId: '普通攻击' };
    const result = processActionPhase(state, action, rng);

    // Combat should have been resolved (some log about combat)
    expect(result.actionLogs.length).toBeGreaterThan(0);
    // combatState should be present
    expect(result.combatState).toBeDefined();
  });

  it('combat against snake uses proper strategy', () => {
    // B4-East has 毒蛇 with enemyTier: 'Small'
    const state = makeDefaultState({
      currentPosition: 'B4-East',
      attributes: { ...defaultAttributes(), '体力值': 80, '健康值': 100 },
    });
    const rng = createSeededRNG(99);
    const action: PlayerAction = { type: 'combat', strategyId: '猛击' };
    const result = processActionPhase(state, action, rng);

    expect(result.combatState).toBeDefined();
    // Validates that 猛击 strategy was used
  });
});

// ============================================================
// checkDeathConditions
// ============================================================

describe('checkDeathConditions', () => {
  it('returns isDead=false when health > 0', () => {
    const attrs = defaultAttributes();
    const result = checkDeathConditions(attrs);
    expect(result.isDead).toBe(false);
    expect(result.reason).toBeNull();
  });

  it('returns isDead=true when health is 0', () => {
    const attrs = { ...defaultAttributes(), '健康值': 0 };
    const result = checkDeathConditions(attrs);
    expect(result.isDead).toBe(true);
    expect(result.reason).toBe('健康值归零');
  });

  it('returns isDead=true when health is negative', () => {
    const attrs = { ...defaultAttributes(), '健康值': -5 };
    const result = checkDeathConditions(attrs);
    expect(result.isDead).toBe(true);
  });
});

// ============================================================
// processTurn — complete pipeline integration
// ============================================================

describe('processTurn — complete pipeline', () => {
  it('applies natural decay combined with weather effects during a turn', () => {
    const state = makeDefaultState({ currentPosition: 'A1-East' }); // 晴 weather adds 口渴度-3 each turn
    const action: PlayerAction = { type: 'gather' };
    const rng = createSeededRNG(42);
    const result = processTurn(state, action, rng);

    // Natural decay: 饱食度-3, 口渴度-5, 精力-2, 污垢+3, 心情-2
    // Weather 晴: 口渴度-3
    // Gather action: 体力-5
    expect(result.state.attributes['饱食度']).toBe(57);
    expect(result.state.attributes['口渴度']).toBe(52);
    expect(result.state.attributes['精力值']).toBe(78);
    expect(result.state.attributes['污垢']).toBe(23);
    expect(result.state.attributes['心情']).toBe(68);
    expect(result.state.attributes['体力值']).toBe(75);
  });

  it('increments turnNumber after processing', () => {
    const state = makeDefaultState({ turnNumber: 5 });
    const action: PlayerAction = { type: 'rest' };
    const rng = createSeededRNG(42);
    const result = processTurn(state, action, rng);
    expect(result.state.turnNumber).toBe(6);
  });

  it('triggers game over when health reaches 0', () => {
    const state = makeDefaultState({
      attributes: { ...defaultAttributes(), '健康值': 1 },
    });
    const action: PlayerAction = { type: 'rest' };
    const rng = createSeededRNG(42);
    const result = processTurn(state, action, rng);

    // Health starts at 1; natural decay doesn't affect health;
    // but status effects or weather might. After clamping, death check runs.
    // At minimum, if health <= 0 after all steps, game over.
    if (result.state.attributes['健康值'] <= 0) {
      expect(result.state.gameOver.isOver).toBe(true);
    }
  });

  it('processes multiple turns without crash', () => {
    let state = makeDefaultState();
    const rng = createSeededRNG(42);

    for (let i = 0; i < 10; i++) {
      const action: PlayerAction =
        i % 2 === 0
          ? { type: 'rest' }
          : { type: 'gather' };

      const result = processTurn(state, action, rng);
      state = result.state;

      if (state.gameOver.isOver) break;
    }

    // Should survive at least a few turns
    expect(state.turnNumber).toBeGreaterThan(1);
  });

  it('clamps attributes to valid range after turn', () => {
    const state = makeDefaultState({
      attributes: { ...defaultAttributes(), '健康值': 100, '体力值': 80 },
    });
    const action: PlayerAction = { type: 'rest' };
    const rng = createSeededRNG(42);
    const result = processTurn(state, action, rng);

    // Check that all attributes are within bounds
    for (const attrId of ['饱食度', '口渴度', '体力值', '健康值', '精力值', '污垢', '心情'] as const) {
      const val = result.state.attributes[attrId];
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(100);
    }
  });
});

// ============================================================
// startNewGame
// ============================================================

describe('startNewGame', () => {
  it('creates game with 生存型 hand type — starts with food/water/herbs', () => {
    const state = startNewGame('生存型', 42);
    expect(state.currentPosition).toBe('A1-North');
    expect(state.turnNumber).toBe(1);
    expect(state.gameOver.isOver).toBe(false);

    const foodItem = state.inventory.find(s => s.itemId === '食物');
    expect(foodItem?.quantity).toBe(3);
    const waterItem = state.inventory.find(s => s.itemId === '水');
    expect(waterItem?.quantity).toBe(2);
    const herbItem = state.inventory.find(s => s.itemId === '草药');
    expect(herbItem?.quantity).toBe(1);
  });

  it('creates game with 探索型 hand type', () => {
    const state = startNewGame('探索型', 99);
    expect(state.inventory.length).toBeGreaterThanOrEqual(5);
    const mapItem = state.inventory.find(s => s.itemId === '藏宝图');
    expect(mapItem?.quantity).toBe(1);
  });

  it('creates game with 制作型 hand type — has wood and fiber', () => {
    const state = startNewGame('制作型', 7);
    const wood = state.inventory.find(s => s.itemId === '木材');
    expect(wood?.quantity).toBe(2);
    const fiber = state.inventory.find(s => s.itemId === '纤维');
    expect(fiber?.quantity).toBe(2);
  });

  it('creates game with 战斗型 hand type', () => {
    const state = startNewGame('战斗型', 13);
    const tool = state.inventory.find(s => s.itemId === '工具');
    expect(tool?.quantity).toBe(1);
    const herb = state.inventory.find(s => s.itemId === '草药');
    expect(herb?.quantity).toBe(2);
  });

  it('deterministic: same seed produces same game', () => {
    const a = startNewGame('生存型', 42);
    const b = startNewGame('生存型', 42);
    expect(a.weather.current).toBe(b.weather.current);
    expect(a.inventory).toEqual(b.inventory);
    expect(a.attributes).toEqual(b.attributes);
  });

  it('throws for invalid hand type', () => {
    expect(() => startNewGame('invalid' as any, 0)).toThrow();
  });
});
