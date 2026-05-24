import { Card } from '../Card';
import { StatusBadge } from '../StatusBadge';
import styles from './StatusIconPanel.module.css';

export interface StatusIconPanelProps {
  statuses: {
    icon: string;
    name: string;
    isActive: boolean;
    isNegative: boolean;
  }[];
}

export function StatusIconPanel({ statuses }: StatusIconPanelProps) {
  return (
    <Card className={styles.panel}>
      <h2 className={styles.heading}>⚡ 状态图标</h2>
      <div className={styles.grid}>
        {statuses.map((status) => (
          <StatusBadge
            key={status.name}
            icon={status.icon}
            name={status.name}
            isActive={status.isActive}
            isNegative={status.isNegative}
          />
        ))}
      </div>
    </Card>
  );
}
