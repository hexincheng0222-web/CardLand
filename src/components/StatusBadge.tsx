import styles from './StatusBadge.module.css';

export interface StatusBadgeProps {
  icon: string;
  name: string;
  isActive: boolean;
  isNegative?: boolean;
  details?: string;
  remainingTurns?: number;
}

export function StatusBadge({
  icon,
  name,
  isActive,
  isNegative = false,
  details,
  remainingTurns = 0,
}: StatusBadgeProps) {
  const classes = [
    styles.badge,
    isActive ? styles.active : styles.inactive,
    isNegative ? styles.negative : styles.positive,
  ].join(' ');

  return (
    <div className={classes}>
      <span className={styles.icon}>{icon}</span>
      {details && (
        <div className={styles.tooltip}>
          <span className={styles.tooltipName}>{name}</span>
          <span className={styles.tooltipDetail}>{details}</span>
          {remainingTurns > 0 && (
            <span className={styles.tooltipTurns}>剩余 {remainingTurns} 回合</span>
          )}
        </div>
      )}
    </div>
  );
}
