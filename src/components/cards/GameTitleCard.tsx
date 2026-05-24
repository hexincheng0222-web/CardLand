import { Card } from '../Card';
import styles from './GameTitleCard.module.css';

interface GameTitleCardProps {
  weatherIcon?: string;
  weatherName?: string;
  turn?: number;
  weatherTurnsRemaining?: number;
}

export function GameTitleCard({ weatherIcon, weatherName, turn, weatherTurnsRemaining }: GameTitleCardProps = {}) {
  const hasWeather = !!weatherIcon || !!weatherName;
  const hasTurn = turn != null;
  const hasWeatherCountdown = weatherTurnsRemaining != null;

  return (
    <Card variant="elevated" className={styles.titleCard}>
      <div className={styles.logo}>🃏</div>
      <h1 className={styles.title}>卡境</h1>
      <p className={styles.subtitle}>CardLand</p>
      {(hasWeather || hasTurn) && (
        <div className={styles.weatherRow}>
          {hasWeather && (
            <span className={styles.weatherText}>
              {weatherIcon} {weatherName}
            </span>
          )}
          {hasWeather && hasTurn && <span className={styles.separator}>·</span>}
          {hasTurn && (
            <span className={styles.turnText}>回合 {turn}</span>
          )}
        </div>
      )}
      {hasWeatherCountdown && (
        <div className={`${styles.weatherCountdown} ${weatherTurnsRemaining <= 1 ? styles.urgent : ''}`}>
          ({weatherTurnsRemaining}回合后切换)
        </div>
      )}
    </Card>
  );
}
