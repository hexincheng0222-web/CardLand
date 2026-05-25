import { useState, useMemo } from 'react';
import { Card } from '../Card';
import { TabBar } from '../TabBar';
import { ItemCard } from './ItemCard';
import styles from './InventoryCard.module.css';

export interface InventoryItemData {
  icon: string;
  name: string;
  quantity: number;
  weight: number;
  category: string;
  shelfLifeHours?: number;
}

export interface InventoryCardProps {
  items: InventoryItemData[];
  maxSlots?: number;
  totalWeight?: number;
  maxWeight?: number;
  onUseItem?: (name: string) => void;
}

const TABS = ['全部', '装备', '工具', '材料', '食物', '药剂'];

const CATEGORY_MAP: Record<string, string[]> = {
  '装备': ['装备'],
  '工具': ['工具'],
  '材料': ['建材', '矿石', '特殊'],
  '食物': ['食材', '生存'],
  '药剂': ['药剂'],
};

export function InventoryCard({ items, maxSlots = 12, totalWeight, maxWeight, onUseItem }: InventoryCardProps) {
  const [activeTab, setActiveTab] = useState('全部');

  const filteredItems = useMemo(() => {
    if (activeTab === '全部') return items;
    const cats = CATEGORY_MAP[activeTab] || [];
    return items.filter((item) => cats.includes(item.category));
  }, [items, activeTab]);

  const emptySlots = Math.max(0, maxSlots - items.length);
  const weightDisplay = totalWeight != null && maxWeight != null
    ? `${totalWeight.toFixed(1)}/${maxWeight}`
    : null;

  return (
    <Card className={styles.card}>
      <div className={styles.headingRow}>
        <h2 className={styles.heading}>🎒 物品栏</h2>
        <span className={styles.slotCount}>{items.length}/{maxSlots}</span>
        {weightDisplay && <span className={styles.weightDisplay}>⚖️ {weightDisplay}kg</span>}
      </div>
      <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      <div className={styles.grid}>
        {filteredItems.map((item, index) => (
          <ItemCard
            key={`${item.name}-${index}`}
            icon={item.icon}
            name={item.name}
            quantity={item.quantity}
            weight={item.weight}
            shelfLifeTotalHours={item.shelfLifeHours}
            shelfLifeRemainingHours={item.shelfLifeHours}
            onUse={onUseItem ? () => onUseItem(item.name) : undefined}
          />
        ))}
        {activeTab === '全部' &&
          Array.from({ length: emptySlots }).map((_, i) => (
            <div key={`empty-${i}`} className={styles.emptySlot}>
              <span className={styles.emptyIcon}>+</span>
            </div>
          ))}
      </div>
      {filteredItems.length === 0 && activeTab !== '全部' && (
        <div className={styles.empty}>暂无物品</div>
      )}
    </Card>
  );
}
