import styles from './ItemCard.module.css';

export interface ItemCardProps {
  icon: string;
  name: string;
  quantity: number;
  weight: number;
  onClick?: () => void;
}

export function ItemCard({ icon, name, quantity, weight, onClick }: ItemCardProps) {
  return (
    <div className={styles.card} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
      <span className={styles.icon}>{icon}</span>
      <span className={styles.name}>{name}</span>
      <div className={styles.meta}>
        <span className={styles.quantity}>×{quantity}</span>
        <span className={styles.weight}>{weight}kg</span>
      </div>
    </div>
  );
}
