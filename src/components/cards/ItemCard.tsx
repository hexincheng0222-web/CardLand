import { Card } from '../Card';
import styles from './ItemCard.module.css';

export interface ItemCardProps {
  icon: string;
  name: string;
  quantity: number;
  weight: number;
  shelfLifeTotalHours?: number;
  shelfLifeRemainingHours?: number;
  onUse?: () => void;
}

export function ItemCard({
  icon,
  name,
  quantity,
  weight,
  shelfLifeTotalHours,
  shelfLifeRemainingHours,
  onUse,
}: ItemCardProps) {
  const shelfLifePercent =
    shelfLifeTotalHours && shelfLifeRemainingHours != null
      ? Math.max(0, Math.min(100, (shelfLifeRemainingHours / shelfLifeTotalHours) * 100))
      : null;

  return (
    <Card className={styles.card} variant="interactive" onClick={onUse}>
      <div className={styles.topRow}>
        <span className={styles.icon}>{icon}</span>
        <span className={styles.quantity}>×{quantity}</span>
      </div>
      <span className={styles.name}>{name}</span>
      <div className={styles.bottomRow}>
        <span className={styles.weight}>⚖️ {weight}kg</span>
        {shelfLifePercent != null && (
          <div className={styles.shelfBar}>
            <div
              className={styles.shelfFill}
              style={{ width: `${shelfLifePercent}%` }}
            />
          </div>
        )}
      </div>
    </Card>
  );
}
