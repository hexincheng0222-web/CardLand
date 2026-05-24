// ============================================================
// CardLand Derived Selectors
// Computed hooks combining multiple stores for UI consumption.
// ============================================================

import { useMemo } from 'react';
import { usePlayerStore } from './playerStore';
import { useGameStore } from './gameStore';
import { checkWeightLimit, calculateWeight } from '@engine/inventory';
import { applyThresholdEffects, applyLinkageEffects } from '@engine/attributes';
import { getAvailableStrategies } from '@engine/combat';
import { getMapPointById, getMovementCost } from '@data/map';
import type { SubZoneId } from '@data/types';

/** Weight calculation: current weight, ratio, tier, penalties */
export function useWeightCalc() {
  const inventory = usePlayerStore((s) => s.inventory);
  return useMemo(() => {
    const weight = calculateWeight(inventory);
    const check = checkWeightLimit(inventory);
    return {
      weight,
      ratio: check.ratio,
      tier: check.tier,
      canMove: check.canMove,
      penalty: check.penalty,
    };
  }, [inventory]);
}

/** Current threshold and linkage effects for all attributes */
export function useAttributeEffects() {
  const attributes = usePlayerStore((s) => s.attributes);
  return useMemo(() => {
    const thresholds = applyThresholdEffects(attributes);
    const linkages = applyLinkageEffects(attributes);
    return { thresholds, linkages };
  }, [attributes]);
}

/** Available actions based on position, stamina, weight, and game phase */
export function useAvailableActions() {
  const attributes = usePlayerStore((s) => s.attributes);
  const inventory = usePlayerStore((s) => s.inventory);
  const currentPosition = useGameStore((s) => s.gameState.currentPosition);
  const gamePhase = useGameStore((s) => s.gamePhase);

  return useMemo(() => {
    const stamina = attributes['体力值'] ?? 0;
    const weightCheck = checkWeightLimit(inventory);
    const point = getMapPointById(currentPosition);

    type ActionInfo = {
      type: 'action' | 'move' | 'combat';
      id: string;
      label: string;
      available: boolean;
      reason?: string;
    };

    const actions: ActionInfo[] = [];

    if (gamePhase === 'exploration') {
      actions.push(
        { type: 'action', id: 'gather', label: '采集', available: stamina >= 5, reason: '体力不足' },
        { type: 'action', id: 'rest', label: '休息', available: true },
        { type: 'action', id: 'craft', label: '制作', available: stamina >= 5, reason: '体力不足' }
      );

      const allSubZones: SubZoneId[] = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4'];
      for (const sz of allSubZones) {
        if (sz === point?.subZone) continue;
        const cost = getMovementCost(point?.subZone ?? 'A1', sz);
        if (cost !== undefined) {
          actions.push({
            type: 'move',
            id: `move-${sz}`,
            label: `移动到 ${sz}`,
            available: stamina >= cost,
            reason: stamina < cost ? `需要体力 ${cost}` : undefined,
          });
        }
      }
    } else if (gamePhase === 'combat') {
      const strategies = getAvailableStrategies(weightCheck.ratio, stamina);
      const allStrategies: CombatStrategyId[] = [
        '普通攻击',
        '猛击',
        '闪避姿态',
        '格挡',
        '精准攻击',
        '撤退',
      ];
      for (const s of allStrategies) {
        actions.push({
          type: 'combat',
          id: s,
          label: s,
          available: strategies.includes(s),
          reason: strategies.includes(s) ? undefined : '当前状态不可用',
        });
      }
    }

    return actions;
  }, [attributes, inventory, currentPosition, gamePhase]);
}

import type { CombatStrategyId } from '@data/types';

