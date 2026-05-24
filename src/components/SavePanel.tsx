// ============================================================
// CardLand Save Panel — Save/Load UI Overlay
// ============================================================

import { useState, useCallback } from 'react';
import {
  saveToSlot,
  loadFromSlot,
  deleteSlot,
  getAllSlotMetadata,
  getAutoSaveTurn,
  formatTimestamp,
} from '@stores/persistConfig';
import { useGameStore } from '@stores/gameStore';
import styles from './SavePanel.module.css';

interface SavePanelProps {
  onClose?: () => void;
}

export function SavePanel({ onClose }: SavePanelProps) {
  const [showSlots, setShowSlots] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const resetGame = useGameStore((s) => s.resetGame);

  const showFeedback = useCallback((msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 1500);
  }, []);

  const handleSave = useCallback((slot: 0 | 1 | 2) => {
    saveToSlot(slot);
    showFeedback(`已保存到槽位 ${slot + 1}`);
  }, [showFeedback]);

  const handleLoad = useCallback((slot: 0 | 1 | 2) => {
    const ok = loadFromSlot(slot);
    if (ok) {
      showFeedback(`已从槽位 ${slot + 1} 读取`);
      setShowSlots(false);
      onClose?.();
    } else {
      showFeedback('读取失败：存档已损坏');
    }
  }, [showFeedback, onClose]);

  const handleDelete = useCallback((slot: 0 | 1 | 2) => {
    deleteSlot(slot);
    showFeedback(`槽位 ${slot + 1} 已删除`);
  }, [showFeedback]);

  const handleReset = useCallback(() => {
    resetGame();
    onClose?.();
  }, [resetGame, onClose]);

  const meta = getAllSlotMetadata();
  const autoSaveTurn = getAutoSaveTurn();

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <h2 className={styles.title}>存档</h2>

        {feedback && <div className={styles.feedback}>{feedback}</div>}

        {/* Auto-save indicator */}
        {autoSaveTurn > 0 && (
          <div className={styles.autoSave}>
            <span className={styles.autoSaveDot} />
            自动存档：第 {autoSaveTurn} 回合
          </div>
        )}

        {/* Action buttons */}
        <div className={styles.actions}>
          <button
            className={styles.btn}
            onClick={() => { saveToSlot(1); showFeedback('已保存到槽位 2'); }}
          >
            保存
          </button>
          <button
            className={styles.btn}
            onClick={() => setShowSlots(v => !v)}
          >
            读取
          </button>
          <button
            className={styles.btnSecondary}
            onClick={handleReset}
          >
            重新开始
          </button>
        </div>

        {/* Slot list */}
        {showSlots && (
          <div className={styles.slotList}>
            <div className={styles.slotHeader}>选择存档槽位</div>
            {meta.map((m, i) => (
              <div key={i} className={styles.slotRow}>
                <div className={styles.slotInfo}>
                  <span className={styles.slotLabel}>槽位 {i + 1}</span>
                  {m.hasData ? (
                    <>
                      <span className={styles.slotMeta}>
                        第 {m.turn} 回合 · {formatTimestamp(m.timestamp)}
                      </span>
                    </>
                  ) : (
                    <span className={styles.slotEmpty}>空</span>
                  )}
                </div>
                <div className={styles.slotActions}>
                  {m.hasData ? (
                    <>
                      <button className={styles.slotBtn} onClick={() => handleLoad(i as 0 | 1 | 2)}>
                        读取
                      </button>
                      <button
                        className={styles.slotBtnDanger}
                        onClick={() => handleDelete(i as 0 | 1 | 2)}
                      >
                        删除
                      </button>
                    </>
                  ) : (
                    <button className={styles.slotBtn} onClick={() => handleSave(i as 0 | 1 | 2)}>
                      保存至此
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <button className={styles.closeBtn} onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  );
}