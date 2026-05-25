import { Card } from '../Card';
import { ClockDisplay } from '../ClockDisplay';
import { WeatherDisplay } from '../WeatherDisplay';
import { DayNightIndicator } from '../DayNightIndicator';
import type { GameClock, TimeOfDay } from '@engine/clock';
import type { WeatherId } from '@engine/weather';
import styles from './GameTitleCard.module.css';

interface GameTitleCardProps {
  clock?: GameClock;
  weatherId?: WeatherId;
  daysRemaining?: number;
  timeOfDay?: TimeOfDay;
}

export function GameTitleCard({ clock, weatherId, daysRemaining, timeOfDay }: GameTitleCardProps = {}) {
  return (
    <Card variant="elevated" className={styles.titleCard}>
      <div className={styles.logo}>🃏</div>
      <h1 className={styles.title}>卡境</h1>
      <p className={styles.subtitle}>CardLand</p>
      {clock && (
        <div className={styles.infoRow}>
          <ClockDisplay clock={clock} />
        </div>
      )}
      {timeOfDay && (
        <div className={styles.infoRow}>
          <DayNightIndicator timeOfDay={timeOfDay} />
        </div>
      )}
      {weatherId && daysRemaining != null && (
        <div className={styles.infoRow}>
          <WeatherDisplay weatherId={weatherId} daysRemaining={daysRemaining} />
        </div>
      )}
    </Card>
  );
}
