// ============================================================
// ClockDisplay — "第 X 天 HH:MM" time display
// ============================================================

import type { GameClock } from '@engine/clock';
import { formatDisplay, getTimeOfDay } from '@engine/clock';
import styles from './ClockDisplay.module.css';

const TOD_ICONS: Record<string, string> = {
  '清晨': '🌅',
  '白天': '☀️',
  '黄昏': '🌇',
  '夜晚': '🌙',
};

export interface ClockDisplayProps {
  clock: GameClock;
  className?: string;
}

export function ClockDisplay({ clock, className = '' }: ClockDisplayProps) {
  const display = formatDisplay(clock);
  const timeOfDay = getTimeOfDay(clock);
  const todIcon = TOD_ICONS[timeOfDay] ?? '⏰';

  return (
    <div className={`${styles.clock} ${className}`}>
      <span className={styles.todIcon}>{todIcon}</span>
      <span className={styles.text}>{display}</span>
    </div>
  );
}
