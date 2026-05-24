import { Card } from '../Card';
import styles from './RecipeResourceCard.module.css';

export interface RecipeResourceCardProps {
  recipes: {
    productIcon: string;
    productName: string;
    ingredients: { icon: string; name: string; quantity: number }[];
    effect?: string;
  }[];
  resources: {
    icon: string;
    name: string;
    quantity: number;
  }[];
}

export function RecipeResourceCard({ recipes, resources }: RecipeResourceCardProps) {
  return (
    <Card className={styles.card}>
      <h2 className={styles.heading}>📋 配方 / 资源</h2>
      <div className={styles.section}>
        <h3 className={styles.subHeading}>可制作配方</h3>
        <div className={styles.recipes}>
          {recipes.map((recipe, index) => (
            <div key={index} className={styles.recipe}>
              <span className={styles.recipeIcon}>{recipe.productIcon}</span>
              <span className={styles.recipeName}>{recipe.productName}</span>
              <div className={styles.recipeIngredients}>
                {recipe.ingredients.map((ing, i) => (
                  <span key={i} className={styles.ingTag}>
                    {ing.icon}×{ing.quantity}
                  </span>
                ))}
              </div>
              {recipe.effect && <div className={styles.recipeEffect}>✨ {recipe.effect}</div>}
            </div>
          ))}
        </div>
      </div>
      <div className={styles.section}>
        <h3 className={styles.subHeading}>资源摘要</h3>
        <div className={styles.resources}>
          {resources.map((res, index) => (
            <div key={index} className={styles.resource}>
              <span className={styles.resIcon}>{res.icon}</span>
              <span className={styles.resName}>{res.name}</span>
              <span className={styles.resQty}>×{res.quantity}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
