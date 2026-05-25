import { useMemo } from 'react';
import { Card } from './Card';
import { AttributeBar } from './AttributeBar';
import { StatusBadge } from './StatusBadge';
import { useGameStore } from '@stores/gameStore';
import { useWeightCalc } from '@stores/selectors';
import { ATTRIBUTES } from '@data/v1-spec';
import { STATUS_DEFINITIONS, ALL_STATUS_IDS } from '@engine/status';
import { WEATHER_DEFS } from '@engine/weather';
import { formatDisplay } from '@engine/clock';
import styles from './StatusPanel.module.css';

export function StatusPanel() {
  const attributes = useGameStore((s) => s.attributes);
  const statusEffects = useGameStore((s) => s.statusEffects);
  const weather = useGameStore((s) => s.weather);
  const clock = useGameStore((s) => s.clock);
  const weightCalc = useWeightCalc();

  const weatherDef = useMemo(() => {
    return WEATHER_DEFS.find((w) => w.id === weather.current);
  }, [weather.current]);

  const activeStatuses = useMemo(() => {
    const currentTime = clock.totalMinutes;
    return ALL_STATUS_IDS.map((id) => {
      const def = STATUS_DEFINITIONS[id];
      const activeEffect = statusEffects.find(
        (se) => se.id === id && (se.expiresAt === null || currentTime < se.expiresAt),
      );
      const remainingMinutes = activeEffect
        ? activeEffect.expiresAt != null
          ? Math.max(0, activeEffect.expiresAt - currentTime)
          : 0
        : 0;
      return {
        id,
        icon: def.icon,
        name: def.name,
        isNegative: def.isNegative,
        isActive: !!activeEffect,
        remainingMinutes,
      };
    });
  }, [statusEffects, clock.totalMinutes]);

  const weightPercent = Math.max(0, Math.min(100, weightCalc.ratio * 100));

  const activeEffects = activeStatuses.filter((s) => s.isActive);

  return (
    <div className={styles.panel}>
      <Card variant="compact" className={styles.weatherCard}>
        <div className={styles.weather}>
          <span className={styles.weatherIcon}>{weatherDef?.icon ?? '❓'}</span>
          <span className={styles.weatherName}>{weatherDef?.name ?? weather.current}</span>
        </div>
        <div className={styles.turn}>
          <span className={styles.turnLabel}>时间</span>
          <span className={styles.turnValue}>{formatDisplay(clock)}</span>
        </div>
      </Card>

      <Card className={styles.attributesCard}>
        <h2 className={styles.heading}>🛡️ 求生手册</h2>
        <div className={styles.bars}>
          {ATTRIBUTES.map((attr) => (
            <AttributeBar
              key={attr.id}
              icon={attr.icon}
              name={attr.name}
              current={attributes[attr.id] ?? attr.initialValue}
              max={attr.maxValue}
              isNegativeWhenHigh={attr.isNegativeWhenHigh}
            />
          ))}
        </div>
      </Card>

      <Card className={styles.weightCard}>
        <h2 className={styles.heading}>⚖️ 负重</h2>
        <div className={styles.weightRow}>
          <span className={styles.weightLabel}>当前 / 上限</span>
          <span className={styles.weightValue}>
            {weightCalc.weight} / 100
          </span>
        </div>
        <div className={styles.track}>
          <div
            className={`${styles.fill} ${weightPercent > 80 ? styles.redFill : weightPercent > 50 ? styles.yellowFill : styles.greenFill}`}
            style={{ width: `${weightPercent}%` }}
          />
        </div>
        <span className={styles.weightTier}>{weightCalc.tier}</span>
      </Card>

      {activeEffects.length > 0 && (
        <Card className={styles.statusCard}>
          <h2 className={styles.heading}>⚡ 状态效果</h2>
          <div className={styles.statusList}>
            {activeEffects.map((status) => (
              <div key={status.id} className={styles.statusItem}>
                <StatusBadge
                  icon={status.icon}
                  name={status.name}
                  isActive={true}
                  isNegative={status.isNegative}
                  remainingMinutes={status.remainingMinutes}
                />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
