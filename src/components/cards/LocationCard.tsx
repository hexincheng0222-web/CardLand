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
  onExplore?: () => void;
  onRest?: () => void;
}

export function LocationCard({ currentLocation, locationIcon, directions, onDirectionClick, onMapClick, onExplore, onRest }: LocationCardProps) {
  const cards = [
    {
      key: 'current',
      icon: locationIcon,
      label: currentLocation,
      subLabel: '当前位置',
      available: true,
      onClick: undefined,
      actions: [
        { label: '⛏️探索', onClick: onExplore },
        { label: '🏕️休息', onClick: onRest },
      ],
    },
    {
      key: 'north',
      icon: '↑',
      label: directions.north || '—',
      subLabel: '北',
      available: !!directions.north,
      onClick: () => onDirectionClick?.('north'),
      actions: !!directions.north
        ? [
            { label: '⛏️探索', onClick: onExplore },
            { label: '🚶前往', onClick: () => onDirectionClick?.('north') },
          ]
        : [],
    },
    {
      key: 'south',
      icon: '↓',
      label: directions.south || '—',
      subLabel: '南',
      available: !!directions.south,
      onClick: () => onDirectionClick?.('south'),
      actions: !!directions.south
        ? [
            { label: '⛏️探索', onClick: onExplore },
            { label: '🚶前往', onClick: () => onDirectionClick?.('south') },
          ]
        : [],
    },
    {
      key: 'east',
      icon: '→',
      label: directions.east || '—',
      subLabel: '东',
      available: !!directions.east,
      onClick: () => onDirectionClick?.('east'),
      actions: !!directions.east
        ? [
            { label: '⛏️探索', onClick: onExplore },
            { label: '🚶前往', onClick: () => onDirectionClick?.('east') },
          ]
        : [],
    },
    {
      key: 'west',
      icon: '←',
      label: directions.west || '—',
      subLabel: '西',
      available: !!directions.west,
      onClick: () => onDirectionClick?.('west'),
      actions: !!directions.west
        ? [
            { label: '⛏️探索', onClick: onExplore },
            { label: '🚶前往', onClick: () => onDirectionClick?.('west') },
          ]
        : [],
    },
    {
      key: 'map',
      icon: '🗺️',
      label: '地图概览',
      subLabel: '查看全貌',
      available: true,
      onClick: onMapClick,
      actions: [],
    },
  ];

  return (
    <Card className={styles.card}>
      <h2 className={styles.heading}>📍 地点</h2>
      <div className={styles.grid}>
        {cards.map((card) => (
          <button
            key={card.key}
            className={`${styles.locationCard} ${card.available ? styles.available : styles.unavailable} ${card.key === 'current' ? styles.current : ''}`}
            onClick={card.onClick}
            disabled={!card.available || !card.onClick}
          >
            <span className={styles.cardIcon}>{card.icon}</span>
            <span className={styles.cardLabel}>{card.label}</span>
            <span className={styles.cardSubLabel}>{card.subLabel}</span>
            {card.actions.length > 0 && (
              <span className={styles.actions}>
                {card.actions.map((action) => (
                  <span
                    key={action.label}
                    className={styles.actionBtn}
                    role="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.stopPropagation();
                      action.onClick?.();
                    }}
                  >
                    {action.label}
                  </span>
                ))}
              </span>
            )}
          </button>
        ))}
      </div>
    </Card>
  );
}
