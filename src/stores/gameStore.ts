// ============================================================
// CardLand Game Store
// Wires the core game loop (turn resolution, weather, position,
// phase, logs) to React UI via Zustand.
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GameStoreState, GamePhase, PlayerAction } from '../types/gameState';
import type { GameState } from '@engine/turn';
import type { HandType } from '@data/types';
import { processTurn, startNewGame, createSeededRNG } from '@engine/turn';
import { usePlayerStore } from './playerStore';
import { useMapStore } from './mapStore';
import { tickAutoSave } from './persistConfig';

interface GameStoreActions {
  startNewGame: (handType: HandType) => void;
  initGame: (handType: HandType, seed: number) => void;
  processAction: (action: PlayerAction, rngSeed?: number) => void;
  setGamePhase: (phase: GamePhase) => void;
  addLog: (log: string) => void;
  clearLogs: () => void;
  setGameState: (state: GameState) => void;
  saveGame: () => string;
  loadGame: (savedState: string) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameStoreState & GameStoreActions>()(
  persist(
    (set, get) => ({
      // -- State --
      gameState: startNewGame('生存型', 1),
      gamePhase: 'start',
      logs: [],

      // -- Actions --
      startNewGame: (handType) => {
        const seed = Date.now();
        get().initGame(handType, seed);
      },

      initGame: (handType, seed) => {
        const state = startNewGame(handType, seed);
        set({ gameState: state, gamePhase: 'exploration', logs: [] });
        usePlayerStore.getState().syncFromGameState(state);
        useMapStore.getState().syncFromGameState(state);
      },

      processAction: (action, rngSeed) => {
        const { gameState } = get();
        const rng = rngSeed !== undefined ? createSeededRNG(rngSeed) : () => Math.random();
        const result = processTurn(gameState, action, rng);
        const nextLogs = [...get().logs, ...result.logs];
        const nextPhase: GamePhase = result.state.gameOver.isOver
          ? 'gameover'
          : get().gamePhase;

        set({
          gameState: result.state,
          logs: nextLogs,
          gamePhase: nextPhase,
        });

        tickAutoSave(result.state.turnNumber);

        usePlayerStore.getState().syncFromGameState(result.state);
        useMapStore.getState().syncFromGameState(result.state);
      },

      setGamePhase: (phase) => set({ gamePhase: phase }),

      addLog: (log) => set({ logs: [...get().logs, log] }),

      clearLogs: () => set({ logs: [] }),

      setGameState: (state) => {
        set({ gameState: state });
        usePlayerStore.getState().syncFromGameState(state);
        useMapStore.getState().syncFromGameState(state);
      },

      saveGame: () => {
        const { gameState, gamePhase, logs } = get();
        return JSON.stringify({ gameState, gamePhase, logs });
      },

      loadGame: (savedState) => {
        try {
          const parsed = JSON.parse(savedState) as {
            gameState: GameState;
            gamePhase: GamePhase;
            logs: string[];
          };
          set({
            gameState: parsed.gameState,
            gamePhase: parsed.gamePhase,
            logs: parsed.logs,
          });
          usePlayerStore.getState().syncFromGameState(parsed.gameState);
          useMapStore.getState().syncFromGameState(parsed.gameState);
        } catch {
          // Invalid save data — silently ignore
        }
      },

      resetGame: () => {
        const state = startNewGame('生存型', 1);
        set({ gameState: state, gamePhase: 'start', logs: [] });
        usePlayerStore.getState().resetPlayer();
        useMapStore.getState().syncFromGameState(state);
      },
    }),
    {
      name: 'cardland-game-store',
      partialize: (state) => ({
        gameState: state.gameState,
        gamePhase: state.gamePhase,
        logs: state.logs,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          usePlayerStore.getState().syncFromGameState(state.gameState);
          useMapStore.getState().syncFromGameState(state.gameState);
        }
      },
    }
  )
);
