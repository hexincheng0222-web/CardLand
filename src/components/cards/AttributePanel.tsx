import { Card } from '../Card';
import { AttributeBar } from '../AttributeBar';
import styles from './AttributePanel.module.css';

export interface AttributePanelProps {
  attributes: {
    icon: string;
    name: string;
    current: number;
    max: number;
    isNegativeWhenHigh?: boolean;
  }[];
}

export function AttributePanel({ attributes }: AttributePanelProps) {
  return (
    <Card className={styles.panel}>
      <h2 className={styles.heading}>🛡️ 求生手册</h2>
      <div className={styles.bars}>
        {attributes.map((attr) => (
          <AttributeBar
            key={attr.name}
            icon={attr.icon}
            name={attr.name}
            current={attr.current}
            max={attr.max}
            isNegativeWhenHigh={attr.isNegativeWhenHigh}
          />
        ))}
      </div>
    </Card>
  );
}
