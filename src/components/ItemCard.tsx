import styles from './ItemCard.module.css';

export interface ItemCardProps {
  icon: string;
  name: string;
  quantity: number;
  weight: number;
  shelfLifeRemainingHours?: number;
  shelfLifeTotalHours?: number;
  onClick?: () => void;
  onUse?: () => void;
}

export function ItemCard({
  icon,
  name,
  quantity,
  weight,
  shelfLifeRemainingHours,
  shelfLifeTotalHours,
  onClick,
  onUse,
}: ItemCardProps) {
  const isPerishable = shelfLifeRemainingHours != null && shelfLifeTotalHours != null && shelfLifeTotalHours > 0;
  const shelfRatio = isPerishable ? shelfLifeRemainingHours / shelfLifeTotalHours : 1;
  const shelfUrgent = isPerishable && shelfRatio <= 0.25;
  const shelfWarning = isPerishable && shelfRatio <= 0.5 && !shelfUrgent;

  return (
    <div
      className={`${styles.card} ${onUse ? styles.withAction : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <span className={styles.icon}>{icon}</span>
      <span className={styles.name}>{name}</span>
      <div className={styles.meta}>
        <span className={styles.quantity}>×{quantity}</span>
        <span className={styles.weight}>{weight}kg</span>
      </div>
      {isPerishable && (
        <div
          className={`${styles.shelfLife} ${shelfUrgent ? styles.urgent : ''} ${shelfWarning ? styles.warning : ''}`}
        >
          <div
            className={styles.shelfLifeBar}
            style={{ width: `${shelfRatio * 100}%` }}
          />
          <span className={styles.shelfLifeText}>
            ⏳ {shelfLifeRemainingHours}h
          </span>
        </div>
      )}
      {onUse && (
        <button
          className={styles.useButton}
          onClick={(e) => {
            e.stopPropagation();
            onUse();
          }}
        >
          使用
        </button>
      )}
    </div>
  );
}
