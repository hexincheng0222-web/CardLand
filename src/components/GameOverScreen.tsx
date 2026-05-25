import { useMemo, useCallback } from 'react';
import { useGameStore } from '@stores/gameStore';
import styles from './GameOverScreen.module.css';

export function GameOverScreen() {
  const clock = useGameStore((s) => s.clock);
  const gameOver = useGameStore((s) => s.gameOver);
  const inventory = useGameStore((s) => s.inventory);
  const currentZone = useGameStore((s) => s.currentZone);
  const resetGame = useGameStore((s) => s.resetGame);
  const setGamePhase = useGameStore((s) => s.setGamePhase);

  const deathReason = gameOver.reason ?? '未知原因';

  const daysSurvived = Math.max(0, clock.day - 1);

  const itemsCollected = useMemo(
    () => inventory.slots.reduce((sum, slot) => sum + slot.quantity, 0),
    [inventory],
  );

  const uniqueItems = inventory.slots.length;

  const handleRestart = useCallback(() => {
    resetGame();
    setGamePhase('start');
  }, [resetGame, setGamePhase]);

  return (
    <div className={styles.screen}>
      <div className={styles.deathGroup}>
        <span className={styles.deathIcon}>💀</span>
        <h1 className={styles.deathTitle}>你已死亡</h1>
        <p className={styles.deathReason}>{deathReason}</p>
      </div>

      <div className={styles.divider} />

      <div className={styles.statsCard}>
        <h3 className={styles.statsTitle}>📊 生存统计</h3>

        <div className={styles.statRow}>
          <span className={styles.statLabel}>
            <span className={styles.statIcon}>⏱️</span>
            存活天数
          </span>
          <span className={styles.statValue}>{daysSurvived} 天</span>
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

      <button className={styles.restartButton} onClick={handleRestart}>
        🔄 重新开始
      </button>
    </div>
  );
}
