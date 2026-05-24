import { Card } from '../Card';
import styles from './LocationCard.module.css';

export interface LocationCardProps {
  currentLocation: string;
  locationIcon: string;
  directions: {
    north?: string;
    south?: string;
    east?: string;
    west?: string;
  };
  onDirectionClick?: (direction: string) => void;
  onMapClick?: () => void;
}

export function LocationCard({ currentLocation, locationIcon, directions, onDirectionClick, onMapClick }: LocationCardProps) {
  const dirConfig = [
    { key: 'north', label: '北', arrow: '↑' },
    { key: 'south', label: '南', arrow: '↓' },
    { key: 'east', label: '东', arrow: '→' },
    { key: 'west', label: '西', arrow: '←' },
  ] as const;

  return (
    <Card className={styles.card}>
      <h2 className={styles.heading}>📍 地点</h2>
      <div className={styles.center}>
        <span className={styles.locationIcon}>{locationIcon}</span>
        <span className={styles.locationName}>{currentLocation}</span>
      </div>
      <div className={styles.directions}>
        {dirConfig.map((dir) => {
          const dest = directions[dir.key as keyof typeof directions];
          return (
            <button
              key={dir.key}
              className={`${styles.dirCard} ${dest ? styles.available : styles.unavailable}`}
              onClick={() => dest && onDirectionClick?.(dir.key)}
              disabled={!dest}
            >
              <span className={styles.dirArrow}>{dir.arrow}</span>
              <span className={styles.dirLabel}>{dir.label}</span>
              <span className={styles.dirDest}>{dest || '—'}</span>
            </button>
          );
        })}
      </div>
      <button className={styles.mapBtn} onClick={onMapClick}>
        🗺️ 地图概览
      </button>
    </Card>
  );
}
