import { useCallback, useMemo } from 'react';
import { useCombatStore } from '@stores/combatStore';
import { usePlayerStore } from '@stores/playerStore';
import { COMBAT_STRATEGIES, ITEMS } from '@data/v1-spec';
import type { CombatStrategyId } from '@data/types';
import {
  getAvailableStrategies,
  calculateStaminaCost,
} from '@engine/combat';
import type { PlayerActionRolls, EnemyActionRolls } from '@engine/combat';
import { Card } from './Card';
import { StatusEffectPanel } from './StatusEffectPanel';
import styles from './CombatScreen.module.css';

const MAX_WEIGHT = 100;

const TIER_LABELS: Record<string, string> = {
  Small: '⭐ 小型',
  Medium: '⭐⭐ 中型',
  Large: '⭐⭐⭐ 大型',
};

const TIER_COLORS: Record<string, string> = {
  Small: 'var(--color-green)',
  Medium: 'var(--color-yellow)',
  Large: 'var(--color-red)',
};

export function CombatScreen() {
  const {
    activeCombat,
    combatHistory,
    currentRound,
    playerAction,
    enemyAction,
    endCombat,
  } = useCombatStore();

  const inventory = usePlayerStore((s) => s.inventory);

  const weightRatio = useMemo(() => {
    const totalWeight = inventory.reduce((sum, slot) => {
      const itemDef = ITEMS.find((i) => i.id === slot.itemId);
      return sum + (itemDef?.weight ?? 0) * slot.quantity;
    }, 0);
    return totalWeight / MAX_WEIGHT;
  }, [inventory]);

  const availableStrategies = useMemo(() => {
    if (!activeCombat) return [] as CombatStrategyId[];
    return getAvailableStrategies(weightRatio, activeCombat.player.stamina);
  }, [activeCombat, weightRatio]);

  const getStaminaCost = useCallback(
    (strategyId: CombatStrategyId) => {
      if (!activeCombat) return Infinity;
      const strategy = COMBAT_STRATEGIES.find((s) => s.id === strategyId);
      if (!strategy) return Infinity;
      return calculateStaminaCost(
        strategy.staminaCost,
        activeCombat.combatCount,
        activeCombat.player.stamina
      );
    },
    [activeCombat]
  );

  const handleStrategyClick = useCallback(
    (strategyId: CombatStrategyId) => {
      if (!activeCombat || activeCombat.status !== 'active') return;
      if (!availableStrategies.includes(strategyId)) return;

      const cost = getStaminaCost(strategyId);
      if (cost === Infinity || activeCombat.player.stamina < cost) return;

      // Player action rolls
      const playerRolls: PlayerActionRolls = {
        enemyDodge: Math.random(),
        playerHit: Math.random(),
      };

      playerAction(strategyId, playerRolls, weightRatio);

      // Check if combat ended after player action
      const latestCombat = useCombatStore.getState().activeCombat;
      if (latestCombat && latestCombat.status === 'active') {
        // Enemy action rolls
        const enemyRolls: EnemyActionRolls = {
          playerDodge: Math.random(),
          enemyHit: Math.random(),
        };
        enemyAction(enemyRolls);
      }
    },
    [activeCombat, availableStrategies, getStaminaCost, weightRatio, playerAction, enemyAction]
  );

  if (!activeCombat) {
    return (
      <div className={styles.screen}>
        <Card className={styles.emptyCard}>
          <p className={styles.emptyText}>暂无战斗</p>
        </Card>
      </div>
    );
  }

  const { enemy, player, status } = activeCombat;
  const enemyHpPercent = Math.max(0, Math.min(100, (enemy.hp / enemy.maxHp) * 100));
  const playerHpPercent = Math.max(0, Math.min(100, (player.health / 100) * 100));
  const playerStaminaPercent = Math.max(0, Math.min(100, (player.stamina / 100) * 100));

  const isCombatOver = status !== 'active';

  return (
    <div className={styles.screen}>
      {/* Header: Round counter */}
      <div className={styles.header}>
        <span className={styles.roundBadge}>回合 {currentRound}</span>
        <span className={styles.terrainBadge}>🗺️ {activeCombat.terrain}</span>
        {isCombatOver && (
          <span className={`${styles.statusBadge} ${styles[status]}`}>
            {status === 'victory' && '🏆 胜利'}
            {status === 'defeat' && '💀 失败'}
            {status === 'retreated' && '🏃 撤退'}
          </span>
        )}
      </div>

      {/* Enemy Card */}
      <Card className={styles.enemyCard}>
        <div className={styles.enemyHeader}>
          <span className={styles.enemyIcon}>{enemy.icon}</span>
          <div className={styles.enemyInfo}>
            <span className={styles.enemyName}>{enemy.name}</span>
            <span
              className={styles.enemyTier}
              style={{ color: TIER_COLORS[enemy.tier] ?? 'var(--text-secondary)' }}
            >
              {TIER_LABELS[enemy.tier] ?? enemy.tier}
            </span>
          </div>
        </div>
        <div className={styles.barRow}>
          <span className={styles.barLabel}>HP</span>
          <div className={styles.track}>
            <div
              className={`${styles.fill} ${styles.enemyHpFill}`}
              style={{ width: `${enemyHpPercent}%` }}
            />
          </div>
          <span className={styles.barValue}>
            {enemy.hp}/{enemy.maxHp}
          </span>
        </div>
      </Card>

      {/* Player Status */}
      <Card className={styles.playerCard}>
        <h3 className={styles.sectionHeading}>🛡️ 玩家状态</h3>
        <div className={styles.playerBars}>
          <div className={styles.barRow}>
            <span className={styles.barLabel}>生命</span>
            <div className={styles.track}>
              <div
                className={`${styles.fill} ${styles.playerHpFill}`}
                style={{ width: `${playerHpPercent}%` }}
              />
            </div>
            <span className={styles.barValue}>{player.health}/100</span>
          </div>
          <div className={styles.barRow}>
            <span className={styles.barLabel}>体力</span>
            <div className={styles.track}>
              <div
                className={`${styles.fill} ${styles.playerStaminaFill}`}
                style={{ width: `${playerStaminaPercent}%` }}
              />
            </div>
            <span className={styles.barValue}>{player.stamina}/100</span>
          </div>
        </div>
        <StatusEffectPanel />
      </Card>

      {/* Strategy Cards */}
      <div className={styles.strategiesGrid}>
        {COMBAT_STRATEGIES.map((strategy) => {
          const isAvailable = availableStrategies.includes(strategy.id);
          const cost = getStaminaCost(strategy.id);
          const canAfford = cost !== Infinity && activeCombat.player.stamina >= cost;
          const isDisabled = !isAvailable || !canAfford || isCombatOver;

          return (
            <Card
              key={strategy.id}
              variant="interactive"
              className={`${styles.strategyCard} ${isDisabled ? styles.disabled : ''}`}
              onClick={isDisabled ? undefined : () => handleStrategyClick(strategy.id)}
            >
              <span className={styles.strategyIcon}>{strategy.icon}</span>
              <span className={styles.strategyName}>{strategy.name}</span>
              <span className={styles.strategyDesc}>{strategy.description}</span>
              <span
                className={`${styles.strategyCost} ${
                  canAfford ? styles.costOk : styles.costBad
                }`}
              >
                ⚡ {cost === Infinity ? '∞' : cost} 体力
              </span>
            </Card>
          );
        })}
      </div>

      {/* Combat Log */}
      <Card className={styles.logCard}>
        <h3 className={styles.sectionHeading}>📜 战斗记录</h3>
        <div className={styles.logScroll}>
          {combatHistory.length === 0 ? (
            <p className={styles.logEmpty}>战斗开始...</p>
          ) : (
            combatHistory.map((entry, i) => (
              <div key={i} className={styles.logEntry}>
                {entry}
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Combat Over Actions */}
      {isCombatOver && (
        <div className={styles.endActions}>
          <button className={styles.endButton} onClick={endCombat}>
            结束战斗
          </button>
        </div>
      )}
    </div>
  );
}
