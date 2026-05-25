// ============================================================
// CardLand Start Screen — Title + Entry Point
// ============================================================

import { useMemo, useCallback } from 'react';
import { useGameStore } from '@stores/gameStore';
import { getAllSlotMetadata, loadAndRestore } from '@stores/persistConfig';
import styles from './StartScreen.module.css';

export function StartScreen() {
  const setGamePhase = useGameStore((s) => s.setGamePhase);

  const hasSave = useMemo(() => {
    const slots = getAllSlotMetadata();
    return slots.some((s) => s.hasData);
  }, []);

  const latestSaveTurn = useMemo(() => {
    const slots = getAllSlotMetadata();
    const saves = slots.filter((s) => s.hasData);
    if (saves.length === 0) return 0;
    return Math.max(...saves.map((s) => s.turnNumber));
  }, []);

  const handleNewGame = useCallback(() => {
    setGamePhase('hand-selection');
  }, [setGamePhase]);

  const handleContinue = useCallback(() => {
    // Load from the first available slot (auto-save slot 0, or slot 1)
    const slots = getAllSlotMetadata();
    const slotIndex = slots.findIndex((s) => s.hasData && s.slot === 0);
    const fallbackIndex = slots.findIndex((s) => s.hasData);
    const target = slotIndex >= 0 ? slotIndex : fallbackIndex;

    if (target >= 0) {
      loadAndRestore(target as 0 | 1 | 2);
    }
  }, []);

  return (
    <div className={styles.screen}>
      {/* Title */}
      <div className={styles.titleGroup}>
        <span className={styles.titleIcon}>🃏</span>
        <h1 className={styles.titleCn}>卡境 CardLand</h1>
        <span className={styles.titleEn}>A Card Survival Game</span>
      </div>

      {/* Divider */}
      <div className={styles.divider} />

      {/* Flavor text */}
      <p className={styles.flavorText}>
        你从<span className={styles.flavorHighlight}>沙滩岩洞</span>中醒来，
        身边散落着几件<span className={styles.flavorHighlight}>初始物资</span>。
        <br />
        在这座充满<span className={styles.flavorHighlight}>未知与危险</span>的荒岛上，
        每一个回合都是生死抉择。
      </p>

      {/* Buttons */}
      <div className={styles.buttonGroup}>
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleNewGame}>
          🃏 开始游戏
        </button>
        <button
          className={`${styles.btn} ${styles.btnSecondary}`}
          onClick={handleContinue}
          disabled={!hasSave}
        >
          📂 继续游戏
        </button>
        {hasSave && latestSaveTurn > 0 && (
          <span className={styles.saveInfo}>
            最近存档：第 {latestSaveTurn} 天
          </span>
        )}
      </div>

      {/* Version */}
      <span className={styles.version}>V1 · 2026</span>
    </div>
  );
}
