import { Card } from '../Card';
import styles from './EquipmentCard.module.css';

export interface Equipment {
  slot: string;
  icon: string;
  name: string;
  item?: {
    icon: string;
    name: string;
  };
}

export interface EquipmentCardProps {
  equipment: Equipment[];
}

export function EquipmentCard({ equipment }: EquipmentCardProps) {
  return (
    <Card className={styles.card}>
      <h2 className={styles.heading}>⚙️ 装备</h2>
      <div className={styles.grid}>
        {equipment.map((eq) => (
          <div
            key={eq.slot}
            className={[styles.slot, eq.item ? styles.slotEquipped : styles.slotEmpty].join(' ')}
          >
            {eq.item ? (
              <>
                <span className={styles.itemIcon}>{eq.item.icon}</span>
                <span className={styles.itemName}>{eq.item.name}</span>
              </>
            ) : (
              <>
                <span className={styles.slotIcon}>{eq.icon}</span>
                <span className={styles.slotLabel}>{eq.name}</span>
              </>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
