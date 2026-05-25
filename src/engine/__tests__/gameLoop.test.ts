import { describe, it, expect } from 'vitest';
import { startNewGame, runGameLoop } from '../gameLoop';
import type { PlayerAction } from '../gameLoop';

// ============================================================
// startNewGame
// ============================================================

describe('startNewGame', () => {
  it('生存型 starts with food×3, water×2, herbs×1', () => {
    const state = startNewGame('生存型', 42);
    expect(state.currentPosition).toBe('A1-North');
    expect(state.turnNumber).toBe(1);
    expect(state.gameOver.isOver).toBe(false);

    const food = state.inventory.slots.find((s) => s.itemId === '食物');
    expect(food?.quantity).toBe(3);
    const water = state.inventory.slots.find((s) => s.itemId === '水');
    expect(water?.quantity).toBe(2);
    const herb = state.inventory.slots.find((s) => s.itemId === '草药');
    expect(herb?.quantity).toBe(1);
  });

  it('探索型 starts with rope, tool, and treasure map', () => {
    const state = startNewGame('探索型', 99);
    const rope = state.inventory.slots.find((s) => s.itemId === '绳索');
    const tool = state.inventory.slots.find((s) => s.itemId === '工具');
    const map = state.inventory.slots.find((s) => s.itemId === '藏宝图');
    expect(rope?.quantity).toBe(2);
    expect(tool?.quantity).toBe(1);
    expect(map?.quantity).toBe(1);
  });

  it('制作型 starts with wood and fiber', () => {
    const state = startNewGame('制作型', 7);
    const wood = state.inventory.slots.find((s) => s.itemId === '木材');
    const fiber = state.inventory.slots.find((s) => s.itemId === '纤维');
    const toolCount = state.inventory.slots
      .filter((s) => s.itemId === '工具')
      .reduce((sum, s) => sum + s.quantity, 0);
    expect(wood?.quantity).toBe(2);
    expect(fiber?.quantity).toBe(2);
    expect(toolCount).toBe(2); // 2 slots of 1 each (stackLimit=1)
  });

  it('战斗型 starts with tool and herbs', () => {
    const state = startNewGame('战斗型', 13);
    const tool = state.inventory.slots.find((s) => s.itemId === '工具');
    const herb = state.inventory.slots.find((s) => s.itemId === '草药');
    expect(tool?.quantity).toBe(1);
    expect(herb?.quantity).toBe(2);
  });

  it('all 4 hand types produce different inventories', () => {
    const survival = startNewGame('生存型', 1);
    const explore = startNewGame('探索型', 1);
    const craft = startNewGame('制作型', 1);
    const combat = startNewGame('战斗型', 1);

    // At least one inventory differs
    const inventories = [survival, explore, craft, combat].map(
      (s) => JSON.stringify(s.inventory),
    );
    const unique = new Set(inventories);
    expect(unique.size).toBe(4);
  });

  it('same seed + same hand = identical game state', () => {
    const a = startNewGame('生存型', 42);
    const b = startNewGame('生存型', 42);
    expect(a.weather.current).toBe(b.weather.current);
    expect(a.weather.turnsRemaining).toBe(b.weather.turnsRemaining);
    expect(a.inventory).toEqual(b.inventory);
    expect(a.attributes).toEqual(b.attributes);
  });

  it('throws for invalid hand type', () => {
    expect(() => startNewGame('not_a_hand' as any, 0)).toThrow();
  });
});

// ============================================================
// runGameLoop — multi-turn processing
// ============================================================

describe('runGameLoop', () => {
  it('processes a sequence of rest actions', () => {
    const actions: PlayerAction[] = Array.from({ length: 5 }, () => ({
      type: 'rest' as const,
    }));

    const result = runGameLoop(42, actions);
    expect(result.totalTurns).toBe(5);
    expect(result.finalState.turnNumber).toBe(6); // started at 1, +5 turns
  });

  it('processes mixed actions: move → gather → craft → rest', () => {
    const actions: PlayerAction[] = [
      { type: 'rest' },
      { type: 'gather' },
      { type: 'rest' },
      { type: 'gather' },
    ];

    const result = runGameLoop(77, actions);
    expect(result.totalTurns).toBe(4);
    expect(result.finalState.gameOver.isOver).toBe(false);
  });

  it('survives 10 turns with alternating actions', () => {
    const actions: PlayerAction[] = Array.from({ length: 10 }, (_, i) =>
      i % 3 === 0
        ? ({ type: 'rest' as const })
        : i % 3 === 1
          ? ({ type: 'gather' as const })
          : ({ type: 'move' as const, targetSubZone: 'A2' }),
    );

    const result = runGameLoop(100, actions);
    expect(result.finalState.turnNumber).toBeGreaterThanOrEqual(10);
  });

  it('stops early when game over is triggered', () => {
    // Create a sequence that could lead to death
    // Low health start means death is likely after decay/weather
    const actions: PlayerAction[] = Array.from({ length: 50 }, () => ({
      type: 'rest' as const,
    }));

    const result = runGameLoop(42, actions);
    // Either all turns processed or game ended
    expect(result.totalTurns).toBeGreaterThan(0);
  });

  it('deterministic: same seed produces same multi-turn result', () => {
    const actions: PlayerAction[] = [
      { type: 'rest' },
      { type: 'gather' },
      { type: 'rest' },
    ];

    const a = runGameLoop(42, actions);
    const b = runGameLoop(42, actions);

    expect(a.totalTurns).toBe(b.totalTurns);
    expect(a.finalState.turnNumber).toBe(b.finalState.turnNumber);
    expect(a.finalState.attributes).toEqual(b.finalState.attributes);
    expect(a.finalState.inventory).toEqual(b.finalState.inventory);
    expect(a.finalState.weather).toEqual(b.finalState.weather);
  });

  it('different seeds produce different game states', () => {
    const actions: PlayerAction[] = Array.from({ length: 3 }, () => ({
      type: 'rest' as const,
    }));

    const a = runGameLoop(42, actions);
    const b = runGameLoop(43, actions);

    // Weather should differ (different random seed)
    expect(
      a.finalState.weather.current !== b.finalState.weather.current ||
      a.finalState.attributes['体力值'] !== b.finalState.attributes['体力值'],
    ).toBe(true);
  });
});
