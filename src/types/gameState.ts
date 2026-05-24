// ============================================================
// CardLand Game Store Types
// ============================================================

import type { GameState as EngineGameState, WeatherState, PlayerAction } from '@engine/turn';

export type GamePhase = 'start' | 'hand-selection' | 'exploration' | 'combat' | 'crafting' | 'event' | 'gameover';

export interface GameStoreState {
  gameState: EngineGameState;
  gamePhase: GamePhase;
  logs: string[];
}

export type { EngineGameState as GameState, WeatherState, PlayerAction };
export type PointId = string;
