import { useState, useEffect, useCallback } from 'react';
import { Card } from '../Card';
import styles from './GuideCraftingCard.module.css';

function getThresholdColor(value: number, max: number, isNegativeWhenHigh?: boolean): string {
  const ratio = value / max;
  if (isNegativeWhenHigh) {
    if (ratio <= 0.3) return 'green';
    if (ratio <= 0.6) return 'yellow';
    return 'red';
  }
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
  survivalStatus?: string;
}

export function GuideCraftingCard({ attributes, recipes, survivalStatus }: GuideCraftingCardProps) {
  const [activePopup, setActivePopup] = useState<'crafting' | null>(null);

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

  return (
    <Card className={styles.card}>
      <div className={styles.header}>📊 生存指南</div>

      <div className={styles.attrGrid}>
        {attributes.map((attr) => {
          const color = getThresholdColor(attr.current, attr.max, attr.isNegativeWhenHigh);
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
          onClick={() => setActivePopup('crafting')}
        >
          🔨 制作{survivalStatus ? <span className={styles.statusLabel}>{survivalStatus}</span> : null}
        </button>
      </div>

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
