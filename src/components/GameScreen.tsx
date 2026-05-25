// ============================================================
// GameScreen — Main game layout (V2: unified Zustand store)
// Left sidebar (narrow, sticky) + Right main area (scrollable)
// ============================================================

import { useState, useMemo, useCallback } from 'react';
import { useGameStore, type EquipmentSlots } from '@stores/gameStore';
import { useWeightCalc } from '@stores/selectors';

import { GameTitleCard } from './cards/GameTitleCard';
import { GuideCraftingCard } from './cards/GuideCraftingCard';
import { CharacterCard } from './cards/CharacterCard';
import { EquipmentCard, type Equipment } from './cards/EquipmentCard';
import { StatusIconPanel } from './cards/StatusIconPanel';
import { LocationCard } from './cards/LocationCard';
import { RecipeResourceCard } from './cards/RecipeResourceCard';
import { InventoryCard } from './cards/InventoryCard';

import { CombatScreen } from './CombatScreen';
import { EventScreen } from './EventScreen';
import { SavePanel } from './SavePanel';

import { ATTRIBUTES, RECIPES, ITEMS } from '@data/v1-spec';
import { STATUS_DEFINITIONS, ALL_STATUS_IDS } from '@engine/status';
import { getMapPointById, getMapPointsBySubZone } from '@data/map';
import { getTimeOfDay } from '@engine/clock';
import { getItemDef } from '@engine/inventory';
import type { StatusEffectId } from '@engine/status';

import styles from './GameScreen.module.css';

const POINT_TYPE_ICONS: Record<string, string> = {
  '资源点': '🌿',
  '休息点': '🏕️',
  '事件点': '❗',
  '危险点': '⚠️',
  '障碍点': '🧱',
};

function lookupItemDef(itemId: string) {
  return getItemDef(itemId as import('@data/types').ItemId) ?? ITEMS.find((i) => i.id === itemId);
}

function getShelfLifeHours(itemId: string): number | undefined {
  const def = ITEMS.find((i) => i.id === itemId);
  return def?.shelfLife;
}

export function GameScreen() {
  const clock = useGameStore((s) => s.clock);
  const weather = useGameStore((s) => s.weather);
  const gamePhase = useGameStore((s) => s.gamePhase);
  const attributes = useGameStore((s) => s.attributes);
  const inventory = useGameStore((s) => s.inventory);
  const statusEffects = useGameStore((s) => s.statusEffects);
  const equipment = useGameStore((s) => s.equipment);
  const currentPosition = useGameStore((s) => s.currentPosition);
  const currentSubZone = useGameStore((s) => s.currentSubZone);
  const gameOver = useGameStore((s) => s.gameOver);

  const resetGame = useGameStore((s) => s.resetGame);
  const setGamePhase = useGameStore((s) => s.setGamePhase);
  const moveTo = useGameStore((s) => s.moveTo);
  const explore = useGameStore((s) => s.explore);
  const rest = useGameStore((s) => s.rest);
  const useItem = useGameStore((s) => s.useItem);

  const { weight } = useWeightCalc();

  const [showSavePanel, setShowSavePanel] = useState(false);

  const timeOfDay = useMemo(() => getTimeOfDay(clock), [clock.hour]);

  const attributePanelData = useMemo(
    () =>
      ATTRIBUTES.map((def) => ({
        icon: def.icon,
        name: def.name,
        current: attributes[def.id] ?? 0,
        max: def.maxValue,
        isNegativeWhenHigh: def.isNegativeWhenHigh,
      })),
    [attributes],
  );

  const craftingPanelData = useMemo(
    () =>
      RECIPES.map((r) => {
        const productDef = lookupItemDef(r.productId);
        return {
          productIcon: productDef?.icon ?? '📦',
          productName: productDef?.name ?? r.productId,
          ingredients: r.ingredients.map((ing) => {
            const ingDef = lookupItemDef(ing.itemId);
            return {
              icon: ingDef?.icon ?? '·',
              name: ingDef?.name ?? ing.itemId,
              quantity: ing.quantity,
            };
          }),
          station: r.station,
          craftingTime: r.baseTime,
        };
      }),
    [],
  );

  const statusIconPanelData = useMemo(() => {
    const currentTime = clock.totalMinutes;
    const activeIds = new Set(
      statusEffects
        .filter((se) => se.expiresAt === null || currentTime < se.expiresAt)
        .map((se) => se.id),
    );

    return ALL_STATUS_IDS.map((id) => {
      const def = STATUS_DEFINITIONS[id];
      const activeEffect = statusEffects.find(
        (se) => se.id === id && (se.expiresAt === null || currentTime < se.expiresAt),
      );
      const remainingMinutes = activeEffect
        ? activeEffect.expiresAt != null
          ? Math.max(0, activeEffect.expiresAt - currentTime)
          : 0
        : 0;

      return {
        icon: def.icon,
        name: def.name,
        isActive: activeIds.has(id),
        isNegative: def.isNegative,
        details: `${def.name} — ${def.removalMethods.join(', ')}`,
        remainingMinutes,
      };
    });
  }, [statusEffects, clock.totalMinutes]);

  const survivalStatusData = useMemo(() => {
    const hp = attributes['健康值'] ?? 0;
    const stamina = attributes['体力值'] ?? 0;
    const hunger = attributes['饱食度'] ?? 0;
    const thirst = attributes['口渴度'] ?? 0;
    const mood = attributes['心情'] ?? 0;

    let overallStatus: string;
    let statusDescription: string;

    if (hp <= 30) {
      overallStatus = '濒死';
      statusDescription = '生命值极低，需要立即治疗！';
    } else if (stamina <= 20) {
      overallStatus = '精疲力竭';
      statusDescription = '体力耗尽，需要休息恢复。';
    } else if (hunger <= 20 || thirst <= 20) {
      overallStatus = '饥渴交迫';
      statusDescription = '需要尽快补充食物和水。';
    } else if (hp <= 60) {
      overallStatus = '受伤';
      statusDescription = '身体有伤，行动力下降。';
    } else if (mood <= 30) {
      overallStatus = '情绪低落';
      statusDescription = '心情较差，产出效率降低。';
    } else if (hp >= 80 && stamina >= 60) {
      overallStatus = '状态良好';
      statusDescription = '身体状况良好，可以正常活动。';
    } else {
      overallStatus = '一般';
      statusDescription = '身体状态一般，注意补给。';
    }

    const activeEffects = statusEffects
      .filter((se) => se.expiresAt === null || clock.totalMinutes < se.expiresAt)
      .map((se) => {
        const def = STATUS_DEFINITIONS[se.id as StatusEffectId];
        return `${def?.icon ?? ''} ${def?.name ?? se.id}`;
      });

    return { overallStatus, statusDescription, activeEffects };
  }, [attributes, statusEffects, clock.totalMinutes]);

  const EQUIPMENT_SLOTS: { slot: keyof EquipmentSlots; icon: string; name: string }[] = [
    { slot: 'head', icon: '👑', name: '头部' },
    { slot: 'body', icon: '🛡️', name: '护甲' },
    { slot: 'hands', icon: '⚔️', name: '武器' },
    { slot: 'legs', icon: '👖', name: '腿部' },
    { slot: 'feet', icon: '👢', name: '鞋子' },
    { slot: 'accessory1', icon: '💍', name: '饰品1' },
    { slot: 'accessory2', icon: '💍', name: '饰品2' },
  ];

  const equipmentData: Equipment[] = useMemo(() => {
    return EQUIPMENT_SLOTS.map((def) => {
      const equippedId = equipment[def.slot];
      const itemDef = equippedId ? lookupItemDef(equippedId) : undefined;
      return {
        slot: def.slot,
        icon: def.icon,
        name: def.name,
        item: itemDef ? { icon: itemDef.icon, name: itemDef.name } : undefined,
      };
    });
  }, [equipment]);

  const locationData = useMemo(() => {
    const currentPoint = getMapPointById(currentPosition);
    const subZonePoints = getMapPointsBySubZone(currentSubZone);

    const directions: { north?: string; south?: string; east?: string; west?: string } = {};
    for (const pt of subZonePoints) {
      if (pt.direction === 'north') directions.north = pt.name;
      if (pt.direction === 'south') directions.south = pt.name;
      if (pt.direction === 'east') directions.east = pt.name;
      if (pt.direction === 'west') directions.west = pt.name;
    }

    return {
      currentLocation: currentPoint?.name ?? currentPosition,
      locationIcon: POINT_TYPE_ICONS[currentPoint?.type ?? ''] ?? '📍',
      directions,
    };
  }, [currentPosition, currentSubZone]);

  const recipeResourceData = useMemo(() => {
    const recipes = RECIPES.map((r) => {
      const productDef = lookupItemDef(r.productId);
      return {
        productIcon: productDef?.icon ?? '📦',
        productName: productDef?.name ?? r.productId,
        ingredients: r.ingredients.map((ing) => {
          const ingDef = lookupItemDef(ing.itemId);
          return {
            icon: ingDef?.icon ?? '·',
            name: ingDef?.name ?? ing.itemId,
            quantity: ing.quantity,
          };
        }),
      };
    });

    const resources = inventory.slots.map((slot) => {
      const def = lookupItemDef(slot.itemId);
      return {
        icon: def?.icon ?? '📦',
        name: def?.name ?? slot.itemId,
        quantity: slot.quantity,
      };
    });

    return { recipes, resources };
  }, [inventory]);

  const inventoryData = useMemo(
    () =>
      inventory.slots.map((slot) => {
        const def = lookupItemDef(slot.itemId);
        const shelfLife = getShelfLifeHours(slot.itemId);
        return {
          icon: def?.icon ?? '📦',
          name: def?.name ?? slot.itemId,
          quantity: slot.quantity,
          weight: def?.weight ?? 0,
          category: def?.category ?? '特殊',
          shelfLifeHours: shelfLife,
        };
      }),
    [inventory],
  );

  const currentEvent = useMemo(() => {
    if (gamePhase !== 'event') return null;
    const currentPoint = getMapPointById(currentPosition);
    if (currentPoint?.choiceEvents?.length) {
      return currentPoint.choiceEvents[0];
    }
    return null;
  }, [gamePhase, currentPosition]);

  const handleSaveOpen = useCallback(() => setShowSavePanel(true), []);
  const handleSaveClose = useCallback(() => setShowSavePanel(false), []);
  const handleEventComplete = useCallback(() => {
    setGamePhase('exploration');
  }, [setGamePhase]);

  const foodCount = useMemo(
    () => inventory.slots.filter((s) => s.itemId === '食物').reduce((sum, s) => sum + s.quantity, 0),
    [inventory],
  );
  const waterCount = useMemo(
    () => inventory.slots.filter((s) => s.itemId === '水').reduce((sum, s) => sum + s.quantity, 0),
    [inventory],
  );
  const herbCount = useMemo(
    () => inventory.slots.filter((s) => s.itemId === '草药').reduce((sum, s) => sum + s.quantity, 0),
    [inventory],
  );

  const handleEat = useCallback(() => {
    if (foodCount > 0) useItem('食物');
  }, [foodCount, useItem]);
  const handleDrink = useCallback(() => {
    if (waterCount > 0) useItem('水');
  }, [waterCount, useItem]);
  const handleHeal = useCallback(() => {
    if (herbCount > 0) useItem('草药');
  }, [herbCount, useItem]);

  const handleExplore = useCallback(() => {
    if (gamePhase !== 'exploration') return;
    explore();
  }, [gamePhase, explore]);

  const handleRest = useCallback(() => {
    if (gamePhase !== 'exploration') return;
    rest('短休');
  }, [gamePhase, rest]);

  const handleDirectionClick = useCallback(
    (direction: string) => {
      if (gamePhase !== 'exploration') return;
      const subZonePoints = getMapPointsBySubZone(currentSubZone);
      const targetPoint = subZonePoints.find((p) => p.direction === direction);
      if (targetPoint) {
        moveTo(targetPoint.id);
      }
    },
    [gamePhase, currentSubZone, moveTo],
  );

  const handleMapClick = useCallback(() => {}, []);

  return (
    <div className={styles.screen}>
      <aside className={styles.sidebar}>
        <GameTitleCard
          clock={clock}
          weatherId={weather.current}
          daysRemaining={weather.daysRemaining}
          timeOfDay={timeOfDay}
        />
        <GuideCraftingCard
          attributes={attributePanelData}
          recipes={craftingPanelData}
          survivalStatus={survivalStatusData.overallStatus}
        />
        <CharacterCard
          name="幸存者"
          avatarEmoji="🧑"
          hp={attributes['健康值'] ?? 0}
          maxHp={100}
          weight={weight}
          maxWeight={inventory.maxWeight}
          foodCount={foodCount}
          waterCount={waterCount}
          herbCount={herbCount}
          onEat={handleEat}
          onDrink={handleDrink}
          onHeal={handleHeal}
        />
        <EquipmentCard equipment={equipmentData} />
        <StatusIconPanel statuses={statusIconPanelData} />
        <button className={styles.saveButton} onClick={handleSaveOpen}>
          💾 存档
        </button>
      </aside>

      <main className={styles.main}>
        <section className={styles.section}>
          <LocationCard
            currentLocation={locationData.currentLocation}
            locationIcon={locationData.locationIcon}
            directions={locationData.directions}
            onDirectionClick={handleDirectionClick}
            onMapClick={handleMapClick}
            onExplore={handleExplore}
            onRest={handleRest}
          />
        </section>

        <section className={styles.section}>
          <RecipeResourceCard
            recipes={recipeResourceData.recipes}
            resources={recipeResourceData.resources}
          />
        </section>

        <section className={styles.section}>
          <InventoryCard items={inventoryData} />
        </section>
      </main>

      {gamePhase === 'combat' && (
        <div className={styles.overlayBackdrop}>
          <div className={styles.overlayContent}>
            <CombatScreen />
          </div>
        </div>
      )}

      {gamePhase === 'event' && currentEvent && (
        <div className={styles.overlayBackdrop}>
          <div className={styles.overlayContent}>
            <EventScreen event={currentEvent} onComplete={handleEventComplete} />
          </div>
        </div>
      )}

      {showSavePanel && <SavePanel onClose={handleSaveClose} />}

      {gamePhase === 'gameover' && (
        <div className={styles.gameOverOverlay}>
          <div className={styles.gameOverTitle}>💀 游戏结束</div>
          <div className={styles.gameOverReason}>
            {gameOver.reason ?? '你未能在荒岛中存活下来。'}
          </div>
          <button className={styles.gameOverRestart} onClick={resetGame}>
            🔄 重新开始
          </button>
        </div>
      )}
    </div>
  );
}
