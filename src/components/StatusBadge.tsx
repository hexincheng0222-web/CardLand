import styles from './StatusBadge.module.css';

export interface StatusBadgeProps {
  icon: string;
  name: string;
  isActive: boolean;
  isNegative?: boolean;
}

export function StatusBadge({ icon, name, isActive, isNegative = false }: StatusBadgeProps) {
  const classes = [
    styles.badge,
    isActive ? styles.active : styles.inactive,
    isNegative ? styles.negative : styles.positive,
  ].join(' ');

  return (
    <div className={classes} title={name}>
      <span className={styles.icon}>{icon}</span>
      <span className={styles.name}>{name}</span>
    </div>
  );
}
