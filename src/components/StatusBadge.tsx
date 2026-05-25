import styles from './StatusBadge.module.css';

export interface StatusBadgeProps {
  icon: string;
  name: string;
  isActive: boolean;
  isNegative?: boolean;
  details?: string;
  /** Remaining duration in minutes (converted from engine's minute-based system) */
  remainingMinutes?: number;
}

function formatRemaining(minutes: number): string {
  if (minutes <= 0) return '';
  if (minutes < 60) return `剩余 ${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `剩余 ${hours}h${mins}m` : `剩余 ${hours} 小时`;
}

export function StatusBadge({
  icon,
  name,
  isActive,
  isNegative = false,
  details,
  remainingMinutes = 0,
}: StatusBadgeProps) {
  const classes = [
    styles.badge,
    isActive ? styles.active : styles.inactive,
    isNegative ? styles.negative : styles.positive,
  ].join(' ');

  const turnsText = formatRemaining(remainingMinutes);

  return (
    <div className={classes}>
      <span className={styles.icon}>{icon}</span>
      {details && (
        <div className={styles.tooltip}>
          <span className={styles.tooltipName}>{name}</span>
          <span className={styles.tooltipDetail}>{details}</span>
          {turnsText && (
            <span className={styles.tooltipTurns}>{turnsText}</span>
          )}
        </div>
      )}
    </div>
  );
}
