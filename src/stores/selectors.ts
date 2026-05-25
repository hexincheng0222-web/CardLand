// ============================================================
// CardLand Derived Selectors
// Computed hooks combining unified store for UI consumption.
// ============================================================

import { useMemo } from 'react';
import { useGameStore } from './gameStore';
import { checkWeightLimit, calculateWeight, getItemDef } from '@engine/inventory';
import { applyThresholdEffects, applyLinkageEffects } from '@engine/attributes';
import { getAvailableStrategies } from '@engine/combat';
import { getMapPointById, getMovementCost } from '@data/map';
import type { SubZoneId } from '@data/types';
import type { CombatStrategyId } from '@data/types';

const weightOf = (id: string) => getItemDef(id as import('@data/types').ItemId)?.weight ?? 0;

/** Weight calculation: current weight, ratio, tier, penalties */
export function useWeightCalc() {
  const inventory = useGameStore((s) => s.inventory);
  return useMemo(() => {
    const weight = calculateWeight(inventory, weightOf);
    const check = checkWeightLimit(inventory, weightOf);
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
  const attributes = useGameStore((s) => s.attributes);
  return useMemo(() => {
    const thresholds = applyThresholdEffects(attributes);
    const linkages = applyLinkageEffects(attributes);
    return { thresholds, linkages };
  }, [attributes]);
}

/** Available actions based on position, stamina, weight, and game phase */
export function useAvailableActions() {
  const attributes = useGameStore((s) => s.attributes);
  const inventory = useGameStore((s) => s.inventory);
  const currentPosition = useGameStore((s) => s.currentPosition);
  const gamePhase = useGameStore((s) => s.gamePhase);

  return useMemo(() => {
    const stamina = attributes['体力值'] ?? 0;
    const weightCheck = checkWeightLimit(inventory, weightOf);
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

      const allSubZones: SubZoneId[] = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'C4', 'D1', 'D2', 'D3', 'D4', 'E1', 'E2', 'E3', 'E4', 'F1', 'F2', 'F3', 'F4'];
      for (const sz of allSubZones) {
        if (sz === point?.subZone) continue;
        const cost = getMovementCost(point?.subZone ?? 'A1', sz);
        if (cost !== undefined) {
          actions.push({
            type: 'move',
            id: `move-${sz}`,
            label: `移动到 ${sz}`,
            available: stamina >= cost.staminaCost,
            reason: stamina < cost.staminaCost ? `需要体力 ${cost.staminaCost}` : undefined,
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
        '恐吓',
        '撤退',
        '潜行击',
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
