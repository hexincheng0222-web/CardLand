import { useState, useMemo } from 'react';
import { Card } from '../Card';
import { TabBar } from '../TabBar';
import { ItemCard } from '../ItemCard';
import styles from './InventoryCard.module.css';

export interface InventoryCardProps {
  items: {
    icon: string;
    name: string;
    quantity: number;
    weight: number;
    category: string;
  }[];
}

const TABS = ['全部', '装备', '工具', '材料', '食物', '药剂'];

export function InventoryCard({ items }: InventoryCardProps) {
  const [activeTab, setActiveTab] = useState('全部');

  const filteredItems = useMemo(() => {
    if (activeTab === '全部') return items;
    const map: Record<string, string[]> = {
      '装备': ['装备'],
      '工具': ['工具'],
      '材料': ['建材', '矿石', '特殊'],
      '食物': ['生存'],
      '药剂': ['药剂'],
    };
    const cats = map[activeTab] || [];
    return items.filter((item) => cats.includes(item.category));
  }, [items, activeTab]);

  return (
    <Card className={styles.card}>
      <h2 className={styles.heading}>🎒 物品栏</h2>
      <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      <div className={styles.grid}>
        {filteredItems.map((item, index) => (
          <ItemCard
            key={`${item.name}-${index}`}
            icon={item.icon}
            name={item.name}
            quantity={item.quantity}
            weight={item.weight}
          />
        ))}
      </div>
      {filteredItems.length === 0 && (
        <div className={styles.empty}>暂无物品</div>
      )}
    </Card>
  );
}
