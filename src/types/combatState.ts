// ============================================================
// CardLand Combat Store Types
// ============================================================

import type { CombatState as EngineCombatState, CombatStatus } from '@engine/combat';

export interface CombatStoreState {
  activeCombat: EngineCombatState | null;
  combatHistory: string[];
  currentRound: number;
}

export type { EngineCombatState as CombatState, CombatStatus };
