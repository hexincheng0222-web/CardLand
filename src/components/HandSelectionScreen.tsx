// ============================================================
// CardLand Hand Selection Screen — Choose starting hand
// ============================================================

import { useCallback } from 'react';
import { useGameStore } from '@stores/gameStore';
import { INITIAL_HANDS, ITEMS } from '@data/v1-spec';
import styles from './HandSelectionScreen.module.css';

/** Map itemId to its icon from ITEMS data */
function getItemIcon(itemId: string): string {
  const item = ITEMS.find((i) => i.id === itemId);
  return item?.icon ?? '📦';
}

export function HandSelectionScreen() {
  const startGame = useGameStore((s) => s.startGame);
  const setGamePhase = useGameStore((s) => s.setGamePhase);

  const handleSelect = useCallback(
    (handType: string) => {
      startGame(handType as '生存型' | '探索型' | '制作型' | '战斗型');
    },
    [startGame]
  );

  const handleBack = useCallback(() => {
    setGamePhase('start');
  }, [setGamePhase]);

  return (
    <div className={styles.screen}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.headerIcon}>🃏</span>
        <h2 className={styles.headerTitle}>选择你的初始手牌</h2>
        <p className={styles.headerSubtitle}>每种手牌适合不同的生存策略</p>
      </div>

      {/* Hand cards grid */}
      <div className={styles.handGrid}>
        {INITIAL_HANDS.map((hand) => (
          <div
            key={hand.type}
            className={styles.handCard}
            onClick={() => handleSelect(hand.type)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleSelect(hand.type);
              }
            }}
          >
            {/* Icon */}
            <span className={styles.handIcon}>{hand.icon}</span>

            {/* Name + trait */}
            <span className={styles.handName}>{hand.name}</span>
            <span className={styles.handTrait}>{hand.特点}</span>

            {/* Items */}
            <div className={styles.itemsList}>
              {hand.items.map((item) => (
                <span key={item.itemId} className={styles.itemChip}>
                  <span className={styles.itemIcon}>{getItemIcon(item.itemId)}</span>
                  {item.itemId}
                  <span className={styles.itemQty}>×{item.quantity}</span>
                </span>
              ))}
            </div>

            {/* Weight */}
            <span className={styles.weightBadge}>
              负重 <span className={styles.weightValue}>{hand.totalWeight}</span>
            </span>

            {/* Description */}
            <p className={styles.handDescription}>{hand.description}</p>
          </div>
        ))}
      </div>

      {/* Back button */}
      <button className={styles.backButton} onClick={handleBack}>
        ← 返回
      </button>
    </div>
  );
}
