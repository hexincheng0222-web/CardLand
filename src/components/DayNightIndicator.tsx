// ============================================================
// DayNightIndicator — Time period icon with label
// ============================================================

import type { TimeOfDay } from '@engine/clock';
import styles from './DayNightIndicator.module.css';

const TOD_CONFIG: Record<TimeOfDay, { icon: string; label: string; className: string }> = {
  '清晨': { icon: '🌅', label: '清晨', className: 'dawn' },
  '白天': { icon: '☀️', label: '白天', className: 'day' },
  '黄昏': { icon: '🌇', label: '黄昏', className: 'dusk' },
  '夜晚': { icon: '🌙', label: '夜晚', className: 'night' },
};

export interface DayNightIndicatorProps {
  timeOfDay: TimeOfDay;
  className?: string;
}

export function DayNightIndicator({ timeOfDay, className = '' }: DayNightIndicatorProps) {
  const config = TOD_CONFIG[timeOfDay] ?? TOD_CONFIG['白天'];

  return (
    <div className={`${styles.indicator} ${styles[config.className]} ${className}`}>
      <span className={styles.icon}>{config.icon}</span>
      <span className={styles.label}>{config.label}</span>
    </div>
  );
}
