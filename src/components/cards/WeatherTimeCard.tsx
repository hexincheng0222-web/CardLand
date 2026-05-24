import { Card } from '../Card';
import styles from './WeatherTimeCard.module.css';

export interface WeatherTimeCardProps {
  weatherIcon: string;
  weatherName: string;
  turn: number;
}

export function WeatherTimeCard({ weatherIcon, weatherName, turn }: WeatherTimeCardProps) {
  return (
    <Card variant="compact" className={styles.weatherCard}>
      <div className={styles.weather}>
        <span className={styles.weatherIcon}>{weatherIcon}</span>
        <span className={styles.weatherName}>{weatherName}</span>
      </div>
      <div className={styles.turn}>
        <span className={styles.turnLabel}>回合</span>
        <span className={styles.turnValue}>{turn}</span>
      </div>
    </Card>
  );
}
