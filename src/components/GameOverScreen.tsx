// ============================================================
// CardLand Game Over Screen — Death summary + restart
// ============================================================

import { useMemo, useCallback } from 'react';
import { useGameStore } from '@stores/gameStore';
import styles from './GameOverScreen.module.css';

export function GameOverScreen() {
  const gameState = useGameStore((s) => s.gameState);
  const setGamePhase = useGameStore((s) => s.setGamePhase);
  const resetGame = useGameStore((s) => s.resetGame);

  const deathReason = useMemo(
    () => gameState.gameOver.reason ?? '未知原因',
    [gameState.gameOver.reason]
  );

  const turnsSurvived = useMemo(
    () => Math.max(0, gameState.turnNumber - 1), // turnNumber is 1-indexed
    [gameState.turnNumber]
  );

  const itemsCollected = useMemo(
    () => gameState.inventory.reduce((sum, slot) => sum + slot.quantity, 0),
    [gameState.inventory]
  );

  const uniqueItems = useMemo(
    () => gameState.inventory.length,
    [gameState.inventory]
  );

  const currentZone = useMemo(() => {
    const pos = gameState.currentPosition;
    const match = pos.match(/^([AB]\d)/);
    return match?.[1] ?? pos;
  }, [gameState.currentPosition]);

  const handleRestart = useCallback(() => {
    resetGame();
    setGamePhase('start');
  }, [resetGame, setGamePhase]);

  return (
    <div className={styles.screen}>
      {/* Death title */}
      <div className={styles.deathGroup}>
        <span className={styles.deathIcon}>💀</span>
        <h1 className={styles.deathTitle}>你已死亡</h1>
        <p className={styles.deathReason}>{deathReason}</p>
      </div>

      {/* Divider */}
      <div className={styles.divider} />

      {/* Stats card */}
      <div className={styles.statsCard}>
        <h3 className={styles.statsTitle}>📊 生存统计</h3>

        <div className={styles.statRow}>
          <span className={styles.statLabel}>
            <span className={styles.statIcon}>⏱️</span>
            存活回合
          </span>
          <span className={styles.statValue}>{turnsSurvived}</span>
        </div>

        <div className={styles.statRow}>
          <span className={styles.statLabel}>
            <span className={styles.statIcon}>🗺️</span>
            最终区域
          </span>
          <span className={styles.statValue}>{currentZone}</span>
        </div>

        <div className={styles.statRow}>
          <span className={styles.statLabel}>
            <span className={styles.statIcon}>🎒</span>
            物品总数
          </span>
          <span className={styles.statValue}>{itemsCollected}</span>
        </div>

        <div className={styles.statRow}>
          <span className={styles.statLabel}>
            <span className={styles.statIcon}>📦</span>
            物品种类
          </span>
          <span className={styles.statValue}>{uniqueItems}</span>
        </div>
      </div>

      {/* Restart button */}
      <button className={styles.restartButton} onClick={handleRestart}>
        🔄 重新开始
      </button>
    </div>
  );
}
