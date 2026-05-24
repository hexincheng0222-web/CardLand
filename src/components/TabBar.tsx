import { useState } from 'react';
import styles from './TabBar.module.css';

export interface TabBarProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function TabBar({ tabs, activeTab, onTabChange }: TabBarProps) {
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  return (
    <div className={styles.tabBar}>
      {tabs.map((tab) => (
        <button
          key={tab}
          className={`${styles.tab} ${activeTab === tab ? styles.active : ''}`}
          onClick={() => onTabChange(tab)}
          onMouseEnter={() => setHoveredTab(tab)}
          onMouseLeave={() => setHoveredTab(null)}
        >
          {tab}
          {activeTab === tab && <div className={styles.indicator} />}
          {hoveredTab === tab && activeTab !== tab && <div className={styles.hoverIndicator} />}
        </button>
      ))}
    </div>
  );
}
