import { Card } from '../Card';
import styles from './GameTitleCard.module.css';

export function GameTitleCard() {
  return (
    <Card variant="elevated" className={styles.titleCard}>
      <div className={styles.logo}>🃏</div>
      <h1 className={styles.title}>卡境</h1>
      <p className={styles.subtitle}>CardLand</p>
    </Card>
  );
}
