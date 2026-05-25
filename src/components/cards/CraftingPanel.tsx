import { Card } from '../Card';
import styles from './CraftingPanel.module.css';

export interface CraftingPanelProps {
  recipes: {
    productIcon: string;
    productName: string;
    ingredients: { icon: string; name: string; quantity: number }[];
    station: string;
    craftingTime: number;
  }[];
}

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes}分钟`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m}m` : `${h}小时`;
}

const STATION_LABELS: Record<string, string> = {
  none: '',
  workbench: '工作台',
  kiln: '窑炉',
  furnace: '熔炉',
};

export function CraftingPanel({ recipes }: CraftingPanelProps) {
  return (
    <Card className={styles.panel}>
      <h2 className={styles.heading}>🔨 制作</h2>
      <div className={styles.recipes}>
        {recipes.map((recipe, index) => (
          <div key={index} className={styles.recipe}>
            <div className={styles.product}>
              <span className={styles.productIcon}>{recipe.productIcon}</span>
              <span className={styles.productName}>{recipe.productName}</span>
              <span className={styles.time}>⏱️ {formatTime(recipe.craftingTime)}</span>
            </div>
            <div className={styles.ingredients}>
              {recipe.ingredients.map((ing, i) => (
                <div key={i} className={styles.ingredient}>
                  <span className={styles.ingIcon}>{ing.icon}</span>
                  <span className={styles.ingName}>{ing.name}</span>
                  <span className={styles.ingQty}>×{ing.quantity}</span>
                </div>
              ))}
            </div>
            {recipe.station !== 'none' && (
              <div className={styles.station}>📍 需要: {STATION_LABELS[recipe.station] ?? recipe.station}</div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
