import { useState, useMemo, useCallback } from 'react';
import { usePlayerStore } from '@stores/playerStore';
import { useGameStore } from '@stores/gameStore';
import type { ChoiceEvent, ChoiceOption, ItemId, AttributeId } from '@data/types';
import { STATUS_EFFECTS } from '@data/v1-spec';
import { resolveChoiceEvent, SeededRNG } from '@engine/events';
import type { EventResult } from '@engine/events';
import { Card } from './Card';
import styles from './EventScreen.module.css';

export interface EventScreenProps {
  event: ChoiceEvent;
  onComplete?: () => void;
}

function buildPlayerStateForEvent(
  attributes: Record<AttributeId, number>,
  inventory: { itemId: ItemId; quantity: number }[]
): { attributes: Record<AttributeId, number>; inventory: Record<ItemId, number> } {
  const invMap: Record<ItemId, number> = {} as Record<ItemId, number>;
  for (const slot of inventory) {
    invMap[slot.itemId] = (invMap[slot.itemId] ?? 0) + slot.quantity;
  }
  return { attributes, inventory: invMap };
}

function getDangerLevel(triggerChance: number): { label: string; color: string } {
  if (triggerChance >= 0.5) return { label: '🔴 极高危险', color: 'var(--color-red)' };
  if (triggerChance >= 0.3) return { label: '🟠 高度危险', color: 'var(--color-yellow)' };
  if (triggerChance >= 0.15) return { label: '🟡 中度危险', color: '#fbbf24' };
  return { label: '🟢 低危险', color: 'var(--color-green)' };
}

export function EventScreen({ event, onComplete }: EventScreenProps) {
  const attributes = usePlayerStore((s) => s.attributes);
  const inventory = usePlayerStore((s) => s.inventory);
  const addLog = useGameStore((s) => s.addLog);

  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [result, setResult] = useState<EventResult | null>(null);

  const playerState = useMemo(
    () => buildPlayerStateForEvent(attributes, inventory.slots as { itemId: ItemId; quantity: number }[]),
    [attributes, inventory]
  );

  const danger = useMemo(() => getDangerLevel(event.triggerChance), [event.triggerChance]);

  const checkRequirement = useCallback(
    (req: { itemId?: ItemId; attributeId?: AttributeId; minValue?: number }) => {
      if (req.itemId !== undefined && req.minValue !== undefined) {
        const have = playerState.inventory[req.itemId] ?? 0;
        return have >= req.minValue;
      }
      if (req.attributeId !== undefined && req.minValue !== undefined) {
        const have = playerState.attributes[req.attributeId] ?? 0;
        return have >= req.minValue;
      }
      return true;
    },
    [playerState]
  );

  const handleChoice = useCallback(
    (option: ChoiceOption) => {
      const rng = new SeededRNG(Date.now());
      const eventResult = resolveChoiceEvent(event, option.id, rng, playerState);

      setSelectedChoiceId(option.id);
      setResult(eventResult);

      // Log the result
      addLog(`[事件] ${event.name}: ${eventResult.message}`);
    },
    [event, playerState, addLog]
  );

  const handleComplete = useCallback(() => {
    setSelectedChoiceId(null);
    setResult(null);
    onComplete?.();
  }, [onComplete]);

  return (
    <div className={styles.screen}>
      {/* Event Description Card */}
      <Card className={styles.eventCard}>
        <div className={styles.eventHeader}>
          <span className={styles.eventIcon}>{event.icon}</span>
          <div className={styles.eventTitleGroup}>
            <h2 className={styles.eventName}>{event.name}</h2>
            <span className={styles.dangerBadge} style={{ color: danger.color }}>
              {danger.label}
            </span>
          </div>
        </div>
        <p className={styles.eventDescription}>{event.description}</p>
      </Card>

      {/* Choices */}
      {!result && (
        <div className={styles.choicesGrid}>
          {event.options.map((option) => {
            const allMet = option.requirements.every((req) => checkRequirement(req));

            return (
              <Card
                key={option.id}
                variant="interactive"
                className={`${styles.choiceCard} ${!allMet ? styles.choiceDisabled : ''}`}
                onClick={allMet ? () => handleChoice(option) : undefined}
              >
                <div className={styles.choiceHeader}>
                  <span className={styles.choiceIcon}>{option.icon}</span>
                  <span className={styles.choiceLabel}>{option.label}</span>
                </div>

                {/* Requirements */}
                {option.requirements.length > 0 && (
                  <div className={styles.requirements}>
                    {option.requirements.map((req, idx) => {
                      const met = checkRequirement(req);
                      return (
                        <span
                          key={idx}
                          className={`${styles.requirement} ${met ? styles.met : styles.unmet}`}
                        >
                          {met ? '✅' : '❌'}{' '}
                          {req.itemId
                            ? `${req.itemId}×${req.minValue}`
                            : req.attributeId
                              ? `${req.attributeId}≥${req.minValue}`
                              : ''}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Outcome hint */}
                {option.outcomes.length > 0 && (
                  <p className={styles.outcomeHint}>
                    {option.outcomes[0].message}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Result Display */}
      {result && selectedChoiceId && (
        <Card className={styles.resultCard}>
          <h3 className={styles.resultHeading}>
            {result.requirementsMet ? '✅ 结果' : '❌ 无法执行'}
          </h3>
          <p className={styles.resultMessage}>{result.message}</p>

          {/* Attribute Changes */}
          {result.attributeChanges.length > 0 && (
            <div className={styles.changeGroup}>
              <span className={styles.changeLabel}>属性变化:</span>
              <div className={styles.changeList}>
                {result.attributeChanges.map((change, i) => (
                  <span
                    key={i}
                    className={`${styles.changeItem} ${
                      change.amount >= 0 ? styles.changePositive : styles.changeNegative
                    }`}
                  >
                    {change.amount >= 0 ? '+' : ''}
                    {change.amount} {change.attributeId}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Item Changes */}
          {result.itemChanges.length > 0 && (
            <div className={styles.changeGroup}>
              <span className={styles.changeLabel}>物品变化:</span>
              <div className={styles.changeList}>
                {result.itemChanges.map((change, i) => (
                  <span
                    key={i}
                    className={`${styles.changeItem} ${
                      change.quantity >= 0 ? styles.changePositive : styles.changeNegative
                    }`}
                  >
                    {change.quantity >= 0 ? '获得' : '失去'} {Math.abs(change.quantity)}×
                    {change.itemId}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Status Effects */}
          {result.statusEffects.length > 0 && (
            <div className={styles.changeGroup}>
              <span className={styles.changeLabel}>状态效果:</span>
              <div className={styles.changeList}>
                {result.statusEffects.map((effectId, i) => {
                  const def = STATUS_EFFECTS.find((d) => d.id === effectId);
                  return (
                    <span
                      key={i}
                      className={`${styles.changeItem} ${
                        def?.isNegative ? styles.changeNegative : styles.changePositive
                      }`}
                    >
                      {def?.icon} {def?.name ?? effectId}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <button className={styles.completeButton} onClick={handleComplete}>
            继续
          </button>
        </Card>
      )}
    </div>
  );
}
