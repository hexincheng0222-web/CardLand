import styles from './AttributeBar.module.css';

export interface AttributeBarProps {
  icon: string;
  name: string;
  current: number;
  max: number;
  isNegativeWhenHigh?: boolean;
}

function getThresholdColor(value: number, max: number, isNegativeWhenHigh: boolean): string {
  const ratio = value / max;
  if (isNegativeWhenHigh) {
    if (ratio <= 0.3) return 'green';
    if (ratio <= 0.6) return 'yellow';
    return 'red';
  }
  if (ratio >= 0.61) return 'green';
  if (ratio >= 0.31) return 'yellow';
  return 'red';
}

export function AttributeBar({ icon, name, current, max, isNegativeWhenHigh = false }: AttributeBarProps) {
  const percentage = Math.max(0, Math.min(100, (current / max) * 100));
  const color = getThresholdColor(current, max, isNegativeWhenHigh);

  return (
    <div className={styles.bar}>
      <div className={styles.header}>
        <span className={styles.icon}>{icon}</span>
        <span className={styles.name}>{name}</span>
        <span className={styles.value}>
          {current}<span className={styles.max}>/{max}</span>
        </span>
      </div>
      <div className={styles.track}>
        <div
          className={`${styles.fill} ${styles[color]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
