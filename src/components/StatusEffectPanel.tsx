import { usePlayerStore } from '@stores/playerStore';
import { STATUS_EFFECTS } from '@data/v1-spec';
import { StatusBadge } from './StatusBadge';
import styles from './StatusEffectPanel.module.css';

export function StatusEffectPanel() {
  const statusEffects = usePlayerStore((s) => s.statusEffects);

  if (statusEffects.length === 0) {
    return (
      <div className={styles.panel}>
        <h3 className={styles.heading}>⚡ 状态效果</h3>
        <p className={styles.empty}>暂无活跃状态效果</p>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <h3 className={styles.heading}>⚡ 状态效果</h3>
      <div className={styles.grid}>
        {statusEffects.map((effect) => {
          const def = STATUS_EFFECTS.find((d) => d.id === effect.id);
          if (!def) return null;

          const remainingText =
            effect.expiresAt === null
              ? '持续'
              : `剩余 ${Math.max(0, effect.expiresAt - Date.now())} 分钟`;

          return (
            <div key={effect.id} className={styles.effectCard}>
              <StatusBadge
                icon={def.icon}
                name={def.name}
                isActive={true}
                isNegative={def.isNegative}
              />
              <span className={styles.turns}>{remainingText}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
