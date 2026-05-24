import { useState, useEffect, useCallback } from 'react';
import { Card } from '../Card';
import { AttributeBar } from '../AttributeBar';
import styles from './GuideCraftingCard.module.css';

const SURVIVAL_KEYS = ['健康', '饱食', '口渴', '体力'];

function getThresholdColor(value: number, max: number): string {
  const ratio = value / max;
  if (ratio >= 0.61) return 'green';
  if (ratio >= 0.31) return 'yellow';
  return 'red';
}

export interface GuideCraftingCardProps {
  attributes: {
    icon: string;
    name: string;
    current: number;
    max: number;
    isNegativeWhenHigh?: boolean;
  }[];
  recipes: {
    productIcon: string;
    productName: string;
    ingredients: { icon: string; name: string; quantity: number }[];
    station: string;
    craftingTime: number;
  }[];
}

export function GuideCraftingCard({ attributes, recipes }: GuideCraftingCardProps) {
  const [activePopup, setActivePopup] = useState<'guide' | 'crafting' | null>(null);

  const closePopup = useCallback(() => {
    setActivePopup(null);
  }, []);

  useEffect(() => {
    if (!activePopup) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePopup();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activePopup, closePopup]);

  const survivalAttrs = attributes.filter((a) => SURVIVAL_KEYS.includes(a.name));

  return (
    <Card className={styles.card}>
      <div className={styles.header}>📊 生存指南</div>

      <div className={styles.attrRow}>
        {survivalAttrs.map((attr) => {
          const color = getThresholdColor(attr.current, attr.max);
          return (
            <span key={attr.name} className={`${styles.attrItem} ${styles[color]}`}>
              <span className={styles.attrIcon}>{attr.icon}</span>
              <span className={styles.attrValue}>{attr.current}</span>
            </span>
          );
        })}
      </div>

      <div className={styles.btnRow}>
        <button
          type="button"
          className={styles.btn}
          onClick={() => setActivePopup('guide')}
        >
          🛡️ 查看全部
        </button>
        <button
          type="button"
          className={styles.btn}
          onClick={() => setActivePopup('crafting')}
        >
          🔨 制作
        </button>
      </div>

      {activePopup === 'guide' && (
        <div className={styles.overlay} onClick={closePopup} role="presentation">
          <div
            className={styles.popup}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="生存指南"
          >
            <button
              type="button"
              className={styles.closeBtn}
              onClick={closePopup}
              aria-label="关闭"
            >
              ✕
            </button>
            <h2 className={styles.popupHeading}>🛡️ 生存指南</h2>
            <div className={styles.bars}>
              {attributes.map((attr) => (
                <AttributeBar
                  key={attr.name}
                  icon={attr.icon}
                  name={attr.name}
                  current={attr.current}
                  max={attr.max}
                  isNegativeWhenHigh={attr.isNegativeWhenHigh}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {activePopup === 'crafting' && (
        <div className={styles.overlay} onClick={closePopup} role="presentation">
          <div
            className={styles.popup}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="制作"
          >
            <button
              type="button"
              className={styles.closeBtn}
              onClick={closePopup}
              aria-label="关闭"
            >
              ✕
            </button>
            <h2 className={styles.popupHeading}>🔨 制作</h2>
            <div className={styles.recipes}>
              {recipes.map((recipe, index) => (
                <div key={index} className={styles.recipe}>
                  <div className={styles.product}>
                    <span className={styles.productIcon}>{recipe.productIcon}</span>
                    <span className={styles.productName}>{recipe.productName}</span>
                    <span className={styles.time}>⏱️ {recipe.craftingTime}回合</span>
                  </div>
                  <div className={styles.ingredients}>
                    {recipe.ingredients.map((ing, i) => (
                      <span key={i} className={styles.ingredient}>
                        <span className={styles.ingIcon}>{ing.icon}</span>
                        {ing.name} ×{ing.quantity}
                      </span>
                    ))}
                  </div>
                  {recipe.station !== 'none' && (
                    <div className={styles.station}>📍 需要: {recipe.station}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
