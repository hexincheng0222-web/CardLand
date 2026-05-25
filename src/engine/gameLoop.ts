// ============================================================
// CardLand V1 Game Loop Engine
// Higher-level functions for game state management
// ============================================================

import type { HandType } from '@data/types';
import { WEATHER_TYPES, INITIAL_HANDS, ATTRIBUTES } from '@data/v1-spec';
import type { Inventory } from './inventory';
import { addItem, getItemDef, createInventory } from './inventory';
import type { Attributes } from './attributes';
import {
  createSeededRNG,
  generateWeather,
  processTurn,
} from './turn';
import type {
  GameState,
  PlayerAction,
} from './turn';

// ============================================================
// startNewGame — initialize a new game
// ============================================================

export function startNewGame(handType: HandType, seed: number): GameState {
  const hand = INITIAL_HANDS.find((h) => h.type === handType);
  if (!hand) {
    throw new Error(`无效的开局类型：${handType}`);
  }

  const rng = createSeededRNG(seed);

  let inventory: Inventory = createInventory();
  for (const item of hand.items) {
    const def = getItemDef(item.itemId)!;
    const result = addItem(inventory, item.itemId, item.quantity, def.weight, def.stackLimit);
    inventory = result.inventory;
  }

  const currentWeather = generateWeather(rng);
  const weatherDef = WEATHER_TYPES.find((w) => w.id === currentWeather);

  const attrs = {} as Attributes;
  for (const attr of ATTRIBUTES) {
    attrs[attr.id] = attr.initialValue;
  }

  return {
    attributes: attrs,
    inventory,
    currentPosition: 'A1-North',
    weather: {
      current: currentWeather,
      turnsRemaining: weatherDef?.duration ?? 3,
    },
    turnNumber: 1,
    statusEffects: [],
    gameOver: { isOver: false, reason: null },
  };
}

// ============================================================
// runGameLoop — process a sequence of turns
// ============================================================

export interface GameLoopResult {
  finalState: GameState;
  totalTurns: number;
  turnLogs: string[][];
  gameOverReason: string | null;
}

/**
 * Process a sequence of player actions as game turns.
 * Runs until all actions are consumed or game over is triggered.
 * Pure function — deterministic when given seeded actions and RNG.
 */
export function runGameLoop(
  initialSeed: number,
  actions: PlayerAction[],
): GameLoopResult {
  const rng = createSeededRNG(initialSeed);
  let state = startNewGame('生存型', initialSeed);
  const turnLogs: string[][] = [];
  let totalTurns = 0;

  for (const action of actions) {
    if (state.gameOver.isOver) break;

    const result = processTurn(state, action, rng);
    state = result.state;
    turnLogs.push(result.logs);
    totalTurns += 1;
  }

  return {
    finalState: state,
    totalTurns,
    turnLogs,
    gameOverReason: state.gameOver.reason,
  };
}

// ============================================================
// Re-exports for convenience
// ============================================================

export { processTurn, generateWeather } from './turn';
export type { GameState, PlayerAction, TurnResult } from './turn';
