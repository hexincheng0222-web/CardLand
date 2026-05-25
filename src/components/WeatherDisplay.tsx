// ============================================================
// WeatherDisplay — Weather icon + name + days remaining
// ============================================================

import { WEATHER_DEFS, type WeatherId } from '@engine/weather';
import styles from './WeatherDisplay.module.css';

export interface WeatherDisplayProps {
  weatherId: WeatherId;
  daysRemaining: number;
  className?: string;
}

export function WeatherDisplay({ weatherId, daysRemaining, className = '' }: WeatherDisplayProps) {
  const def = WEATHER_DEFS.find((w) => w.id === weatherId);
  const icon = def?.icon ?? '☀️';
  const name = def?.name ?? weatherId;
  const description = def?.effects?.description ?? '';

  return (
    <div className={`${styles.weather} ${className}`}>
      <span className={styles.icon}>{icon}</span>
      <div className={styles.info}>
        <span className={styles.name}>{name}</span>
        {description && <span className={styles.description}>{description}</span>}
      </div>
      <span className={`${styles.days} ${daysRemaining <= 1 ? styles.urgent : ''}`}>
        {daysRemaining}天
      </span>
    </div>
  );
}
