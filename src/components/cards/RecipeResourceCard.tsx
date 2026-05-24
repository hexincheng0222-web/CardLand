import { useState } from 'react';
import { Card } from '../Card';
import { TabBar } from '../TabBar';
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

const CATEGORY_TABS = ['全部', '装备', '工具', '建筑', '药剂'] as const;

const RECIPE_CATEGORY: Record<string, string> = {
  石刀: '装备',
  木矛: '装备',
  布甲: '装备',
  皮甲: '装备',
  火把: '工具',
  修理工具: '工具',
  绳索: '工具',
  捕鱼陷阱: '工具',
  简易营地: '建筑',
  工作台: '建筑',
  木筏: '建筑',
  药膏: '药剂',
  解毒剂: '药剂',
};

export function RecipeResourceCard({ recipes, resources }: RecipeResourceCardProps) {
  const [activeCategory, setActiveCategory] = useState<string>('全部');

  const filteredRecipes =
    activeCategory === '全部'
      ? recipes
      : recipes.filter((r) => RECIPE_CATEGORY[r.productName] === activeCategory);

  return (
    <Card className={styles.card}>
      <h2 className={styles.heading}>📋 配方 / 资源</h2>
      <div className={styles.section}>
        <h3 className={styles.subHeading}>可制作配方</h3>
        <div className={styles.tabWrapper}>
          <TabBar
            tabs={[...CATEGORY_TABS]}
            activeTab={activeCategory}
            onTabChange={setActiveCategory}
          />
        </div>
        <div className={styles.recipes}>
          {filteredRecipes.map((recipe, index) => (
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
