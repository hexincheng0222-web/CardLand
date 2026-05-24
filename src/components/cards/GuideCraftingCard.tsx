import { useState, useEffect, useCallback } from 'react';
import { Card } from '../Card';
import { AttributeBar } from '../AttributeBar';
import styles from './GuideCraftingCard.module.css';

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

  return (
    <Card className={styles.card}>
      <div className={styles.grid}>
        <button
          type="button"
          className={styles.subCard}
          onClick={() => setActivePopup('guide')}
        >
          <span className={styles.subIcon}>🛡️</span>
          <span className={styles.subLabel}>生存指南</span>
        </button>

        <button
          type="button"
          className={styles.subCard}
          onClick={() => setActivePopup('crafting')}
        >
          <span className={styles.subIcon}>🔨</span>
          <span className={styles.subLabel}>制作</span>
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
