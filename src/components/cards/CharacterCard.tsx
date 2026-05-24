import { Card } from '../Card';
import styles from './CharacterCard.module.css';

export interface CharacterCardProps {
  name: string;
  avatarEmoji: string;
  hp: number;
  maxHp: number;
  weight: number;
  maxWeight: number;
}

export function CharacterCard({ name, avatarEmoji, hp, maxHp, weight, maxWeight }: CharacterCardProps) {
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
        </div>
      </div>
    </Card>
  );
}
