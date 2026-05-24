// ============================================================
// CardLand Combat Store
// Wires combat engine (initiate, resolve, log, round counter)
// to React UI via Zustand.
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CombatStoreState } from '../types/combatState';
import type {
  CombatState,
  InitiateCombatParams,
  PlayerActionRolls,
  EnemyActionRolls,
} from '@engine/combat';
import type { CombatStrategyId } from '@data/types';
import {
  initiateCombat,
  resolvePlayerAction,
  resolveEnemyAction,
  checkCombatEnd,
} from '@engine/combat';

interface CombatStoreActions {
  setActiveCombat: (combat: CombatState | null) => void;
  startCombat: (params: InitiateCombatParams) => void;
  playerAction: (strategyId: CombatStrategyId, rolls: PlayerActionRolls, weightRatio: number) => void;
  enemyAction: (rolls: EnemyActionRolls) => void;
  endCombat: () => void;
  clearHistory: () => void;
  addToHistory: (entry: string) => void;
}

export const useCombatStore = create<CombatStoreState & CombatStoreActions>()(
  persist(
    (set, get) => ({
      // -- State --
      activeCombat: null,
      combatHistory: [],
      currentRound: 0,

      // -- Actions --
      setActiveCombat: (combat) => set({ activeCombat: combat }),

      startCombat: (params) => {
        const combat = initiateCombat(params);
        set({
          activeCombat: combat,
          combatHistory: [`战斗开始：${combat.enemy.name}`],
          currentRound: 1,
        });
      },

      playerAction: (strategyId, rolls, weightRatio) => {
        const { activeCombat, currentRound } = get();
        if (!activeCombat) return;

        const result = resolvePlayerAction(activeCombat, strategyId, rolls, weightRatio);
        const history = [...get().combatHistory];
        history.push(`回合 ${currentRound}：玩家使用 ${strategyId}`);
        if (result.damageDealt > 0) {
          history.push(`造成 ${result.damageDealt} 点伤害`);
        }
        if (result.enemyDodged) {
          history.push('敌人闪避了攻击');
        }
        if (result.state.status === 'retreated') {
          history.push('撤退成功');
        }

        set({
          activeCombat: checkCombatEnd(result.state),
          combatHistory: history,
        });
      },

      enemyAction: (rolls) => {
        const { activeCombat, currentRound } = get();
        if (!activeCombat) return;

        const result = resolveEnemyAction(activeCombat, rolls);
        const history = [...get().combatHistory];
        if (result.damageReceived > 0) {
          history.push(`受到 ${result.damageReceived} 点伤害`);
        }
        if (result.playerDodged) {
          history.push('成功闪避敌人攻击');
        }

        set({
          activeCombat: checkCombatEnd(result.state),
          combatHistory: history,
          currentRound: currentRound + 1,
        });
      },

      endCombat: () => {
        const { activeCombat } = get();
        if (activeCombat) {
          const history = [...get().combatHistory];
          history.push(`战斗结束：${activeCombat.status}`);
          set({ activeCombat: null, combatHistory: history, currentRound: 0 });
        }
      },

      clearHistory: () => set({ combatHistory: [] }),

      addToHistory: (entry) => set({ combatHistory: [...get().combatHistory, entry] }),
    }),
    {
      name: 'cardland-combat-store',
      partialize: (state) => ({
        activeCombat: state.activeCombat,
        combatHistory: state.combatHistory,
        currentRound: state.currentRound,
      }),
    }
  )
);
