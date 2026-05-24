import { Card } from '../Card';
import styles from './CharacterCard.module.css';

export interface CharacterCardProps {
  name: string;
  avatarEmoji: string;
  hp: number;
  maxHp: number;
  weight: number;
  maxWeight: number;
  foodCount?: number;
  waterCount?: number;
  herbCount?: number;
  onEat?: () => void;
  onDrink?: () => void;
  onHeal?: () => void;
}

export function CharacterCard({
  name,
  avatarEmoji,
  hp,
  maxHp,
  weight,
  maxWeight,
  foodCount = 0,
  waterCount = 0,
  herbCount = 0,
  onEat,
  onDrink,
  onHeal,
}: CharacterCardProps) {
  const hpPercent = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const weightPercent = Math.max(0, Math.min(100, (weight / maxWeight) * 100));

  return (
    <Card className={styles.card}>
      <h2 className={styles.heading}>👤 人物</h2>
      <div className={styles.body}>
        <div className={styles.avatar}>{avatarEmoji}</div>
        <div className={styles.info}>
          <div className={styles.name}>{name}</div>
          <div className={styles.barGroup}>
            <div className={styles.barRow}>
              <span className={styles.barLabel}>HP</span>
              <div className={styles.track}>
                <div className={`${styles.fill} ${styles.hpFill}`} style={{ width: `${hpPercent}%` }} />
              </div>
              <span className={styles.barValue}>{hp}/{maxHp}</span>
            </div>
            <div className={styles.barRow}>
              <span className={styles.barLabel}>负重</span>
              <div className={styles.track}>
                <div
                  className={`${styles.fill} ${weightPercent > 80 ? styles.redFill : weightPercent > 50 ? styles.yellowFill : styles.greenFill}`}
                  style={{ width: `${weightPercent}%` }}
                />
              </div>
              <span className={styles.barValue}>{weight}/{maxWeight}</span>
            </div>
          </div>
          <div className={styles.actions}>
            <button
              className={`${styles.actionBtn} ${foodCount === 0 ? styles.actionBtnDisabled : ''}`}
              disabled={foodCount === 0}
              onClick={onEat}
            >
              🍖 进食
            </button>
            <button
              className={`${styles.actionBtn} ${waterCount === 0 ? styles.actionBtnDisabled : ''}`}
              disabled={waterCount === 0}
              onClick={onDrink}
            >
              💧 饮水
            </button>
            <button
              className={`${styles.actionBtn} ${herbCount === 0 ? styles.actionBtnDisabled : ''}`}
              disabled={herbCount === 0}
              onClick={onHeal}
            >
              🌿 治疗
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
