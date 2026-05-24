import { Card } from '../Card';
import styles from './SurvivalStatusCard.module.css';

export interface SurvivalStatusCardProps {
  overallStatus: string;
  statusDescription: string;
  activeEffects: string[];
}

export function SurvivalStatusCard({ overallStatus, statusDescription, activeEffects }: SurvivalStatusCardProps) {
  return (
    <Card className={styles.card}>
      <h2 className={styles.heading}>🌿 生存状态</h2>
      <div className={styles.statusRow}>
        <span className={styles.statusLabel}>总体状态</span>
        <span className={styles.statusValue}>{overallStatus}</span>
      </div>
      <p className={styles.description}>{statusDescription}</p>
      {activeEffects.length > 0 && (
        <div className={styles.effects}>
          <span className={styles.effectsLabel}>当前效果:</span>
          <ul className={styles.effectsList}>
            {activeEffects.map((effect, i) => (
              <li key={i} className={styles.effectItem}>{effect}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
