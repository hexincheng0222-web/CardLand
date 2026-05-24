import { useMemo } from 'react';
import { Card } from './Card';
import { AttributeBar } from './AttributeBar';
import { StatusBadge } from './StatusBadge';
import { usePlayerStore } from '@stores/playerStore';
import { useGameStore } from '@stores/gameStore';
import { useWeightCalc } from '@stores/selectors';
import { ATTRIBUTES, WEATHER_TYPES, STATUS_EFFECTS } from '@data/v1-spec';
import styles from './StatusPanel.module.css';

export function StatusPanel() {
  const attributes = usePlayerStore((s) => s.attributes);
  const statusEffects = usePlayerStore((s) => s.statusEffects);
  const weather = useGameStore((s) => s.gameState.weather);
  const turnNumber = useGameStore((s) => s.gameState.turnNumber);
  const weightCalc = useWeightCalc();

  const weatherDef = useMemo(() => {
    return WEATHER_TYPES.find((w) => w.id === weather.current);
  }, [weather.current]);

  const activeStatuses = useMemo(() => {
    return statusEffects.map((effect) => {
      const def = STATUS_EFFECTS.find((s) => s.id === effect.id);
      return {
        ...effect,
        icon: def?.icon ?? '❓',
        name: def?.name ?? effect.id,
        isNegative: def?.isNegative ?? false,
      };
    });
  }, [statusEffects]);

  const weightPercent = Math.max(0, Math.min(100, weightCalc.ratio * 100));

  return (
    <div className={styles.panel}>
      <Card variant="compact" className={styles.weatherCard}>
        <div className={styles.weather}>
          <span className={styles.weatherIcon}>{weatherDef?.icon ?? '❓'}</span>
          <span className={styles.weatherName}>{weatherDef?.name ?? weather.current}</span>
        </div>
        <div className={styles.turn}>
          <span className={styles.turnLabel}>回合</span>
          <span className={styles.turnValue}>{turnNumber}</span>
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

      {activeStatuses.length > 0 && (
        <Card className={styles.statusCard}>
          <h2 className={styles.heading}>⚡ 状态效果</h2>
          <div className={styles.statusList}>
            {activeStatuses.map((status) => (
              <div key={status.id} className={styles.statusItem}>
                <StatusBadge
                  icon={status.icon}
                  name={status.name}
                  isActive={true}
                  isNegative={status.isNegative}
                />
                {status.remainingDuration !== null && (
                  <span className={styles.duration}>{status.remainingDuration}回合</span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
