import { GameTitleCard } from '@components/cards/GameTitleCard';
import { WeatherTimeCard } from '@components/cards/WeatherTimeCard';
import { AttributePanel } from '@components/cards/AttributePanel';
import { CraftingPanel } from '@components/cards/CraftingPanel';
import { CharacterCard } from '@components/cards/CharacterCard';
import { StatusIconPanel } from '@components/cards/StatusIconPanel';
import { SurvivalStatusCard } from '@components/cards/SurvivalStatusCard';
import { LocationCard } from '@components/cards/LocationCard';
import { RecipeResourceCard } from '@components/cards/RecipeResourceCard';
import { InventoryCard } from '@components/cards/InventoryCard';
import {
  ATTRIBUTES,
  CRAFTING_RECIPES,
  STATUS_EFFECTS,
  WEATHER_TYPES,
  ITEMS,
} from '@data/v1-spec';
import styles from './CardsPage.module.css';

// Sample player state for dev page
const SAMPLE_ATTRIBUTES = ATTRIBUTES.map((attr) => ({
  icon: attr.icon,
  name: attr.name,
  current: attr.initialValue,
  max: attr.maxValue,
  isNegativeWhenHigh: attr.isNegativeWhenHigh,
}));

const SAMPLE_CRAFTING_RECIPES = CRAFTING_RECIPES.slice(0, 4).map((recipe) => {
  const productItem = ITEMS.find((i) => i.id === recipe.productId);
  return {
    productIcon: productItem?.icon ?? '❓',
    productName: productItem?.name ?? recipe.productId,
    ingredients: recipe.ingredients.map((ing) => {
      const item = ITEMS.find((i) => i.id === ing.itemId);
      return {
        icon: item?.icon ?? '❓',
        name: item?.name ?? ing.itemId,
        quantity: ing.quantity,
      };
    }),
    station: recipe.station,
    craftingTime: recipe.craftingTime,
  };
});

const SAMPLE_STATUSES = STATUS_EFFECTS.map((status) => ({
  icon: status.icon,
  name: status.name,
  isActive: status.id === '中毒' || status.id === '饱腹' || status.id === '专注',
  isNegative: status.isNegative,
}));

const SAMPLE_INVENTORY = [
  { icon: '🍖', name: '食物', quantity: 5, weight: 2, category: '生存' },
  { icon: '💧', name: '水', quantity: 3, weight: 3, category: '生存' },
  { icon: '🌿', name: '草药', quantity: 4, weight: 1, category: '生存' },
  { icon: '🪵', name: '木材', quantity: 6, weight: 5, category: '建材' },
  { icon: '🪨', name: '石材', quantity: 2, weight: 8, category: '建材' },
  { icon: '🧵', name: '纤维', quantity: 8, weight: 1, category: '建材' },
  { icon: '⛏️', name: '铁矿', quantity: 3, weight: 6, category: '矿石' },
  { icon: '💨', name: '硫磺', quantity: 2, weight: 3, category: '矿石' },
  { icon: '🪢', name: '绳索', quantity: 2, weight: 3, category: '特殊' },
  { icon: '🔩', name: '金属件', quantity: 1, weight: 4, category: '特殊' },
  { icon: '🔧', name: '工具', quantity: 1, weight: 5, category: '特殊' },
  { icon: '🗺️', name: '藏宝图', quantity: 1, weight: 1, category: '特殊' },
];

const SAMPLE_RECIPE_RESOURCES = {
  recipes: [
    {
      productIcon: '🪢',
      productName: '绳索',
      ingredients: [
        { icon: '🧵', name: '纤维', quantity: 3 },
      ],
      effect: '攀爬/制作必备',
    },
    {
      productIcon: '🔧',
      productName: '工具',
      ingredients: [
        { icon: '🪵', name: '木材', quantity: 2 },
        { icon: '🪨', name: '石材', quantity: 1 },
      ],
      effect: '攻击力+5',
    },
  ],
  resources: [
    { icon: '🍖', name: '食物', quantity: 5 },
    { icon: '💧', name: '水', quantity: 3 },
    { icon: '🪵', name: '木材', quantity: 6 },
    { icon: '🧵', name: '纤维', quantity: 8 },
    { icon: '⛏️', name: '铁矿', quantity: 3 },
  ],
};

export function CardsPage() {
  return (
    <div className={styles.page}>
      <aside className={styles.leftSidebar}>
        <GameTitleCard />
        <WeatherTimeCard
          weatherIcon={WEATHER_TYPES[0].icon}
          weatherName={WEATHER_TYPES[0].name}
          turn={5}
        />
        <AttributePanel attributes={SAMPLE_ATTRIBUTES} />
        <CraftingPanel recipes={SAMPLE_CRAFTING_RECIPES} />
        <CharacterCard
          name="幸存者"
          avatarEmoji="🧑"
          hp={80}
          maxHp={100}
          weight={25}
          maxWeight={50}
        />
        <StatusIconPanel statuses={SAMPLE_STATUSES} />
        <SurvivalStatusCard
          overallStatus="良好"
          statusDescription="当前状态稳定，注意保持饱食度和口渴度。"
          activeEffects={['每回合体力恢复 +5', '制作/解谜消耗精力减半']}
        />
      </aside>
      <main className={styles.rightMain}>
        <LocationCard
          currentLocation="A1 - 海滩"
          locationIcon="🏖️"
          directions={{
            north: 'A2 - 丛林边缘',
            east: 'B1 - 浅海',
          }}
        />
        <RecipeResourceCard
          recipes={SAMPLE_RECIPE_RESOURCES.recipes}
          resources={SAMPLE_RECIPE_RESOURCES.resources}
        />
        <InventoryCard items={SAMPLE_INVENTORY} />
      </main>
    </div>
  );
}
