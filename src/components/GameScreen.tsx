// ============================================================
// CardLand GameScreen — Main game layout
// Left sidebar (narrow, sticky) + Right main area (scrollable)
// Wires all card components to Zustand stores.
// ============================================================

import { useState, useMemo, useCallback } from 'react';
import { useGameStore } from '@stores/gameStore';
import { usePlayerStore } from '@stores/playerStore';
import { useMapStore } from '@stores/mapStore';
import { useWeightCalc } from '@stores/selectors';

// -- Card components (left sidebar) --
import { GameTitleCard } from './cards/GameTitleCard';
import { GuideCraftingCard } from './cards/GuideCraftingCard';
import { CharacterCard } from './cards/CharacterCard';
import { StatusIconPanel } from './cards/StatusIconPanel';
import { SurvivalStatusCard } from './cards/SurvivalStatusCard';

// -- Card components (right main area) --
import { LocationCard } from './cards/LocationCard';
import { RecipeResourceCard } from './cards/RecipeResourceCard';
import { InventoryCard } from './cards/InventoryCard';

// -- Overlay screens --
import { CombatScreen } from './CombatScreen';
import { EventScreen } from './EventScreen';
import { SavePanel } from './SavePanel';

// -- Data --
import { ATTRIBUTES, WEATHER_TYPES, CRAFTING_RECIPES, STATUS_EFFECTS, ITEMS } from '@data/v1-spec';
import { getMapPointById, getMapPointsBySubZone } from '@data/map';

// -- Styles --
import styles from './GameScreen.module.css';

// ============================================================
// Helpers
// ============================================================

/** Map point type → display icon */
const POINT_TYPE_ICONS: Record<string, string> = {
  '资源点': '🌿',
  '休息点': '🏕️',
  '事件点': '❗',
  '危险点': '⚠️',
  '障碍点': '🧱',
};

function getWeatherInfo(weatherId: string) {
  const def = WEATHER_TYPES.find((w) => w.id === weatherId);
  return { icon: def?.icon ?? '☀️', name: def?.name ?? '未知' };
}

function getItemDef(itemId: string) {
  return ITEMS.find((i) => i.id === itemId);
}

// ============================================================
// GameScreen Component
// ============================================================

export function GameScreen() {
  // ── Store selectors ──
  const gameState = useGameStore((s) => s.gameState);
  const gamePhase = useGameStore((s) => s.gamePhase);
  const resetGame = useGameStore((s) => s.resetGame);
  const setGamePhase = useGameStore((s) => s.setGamePhase);

  const attributes = usePlayerStore((s) => s.attributes);
  const inventory = usePlayerStore((s) => s.inventory);
  const statusEffects = usePlayerStore((s) => s.statusEffects);

  const currentSubZone = useMapStore((s) => s.currentSubZone);

  const { weight } = useWeightCalc();

  // ── Local state ──
  const [showSavePanel, setShowSavePanel] = useState(false);

  // ── Derived data: left sidebar ──

  const weatherInfo = useMemo(
    () => getWeatherInfo(gameState.weather.current),
    [gameState.weather.current],
  );

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
      CRAFTING_RECIPES.map((r) => {
        const productDef = getItemDef(r.productId);
        return {
          productIcon: productDef?.icon ?? '📦',
          productName: productDef?.name ?? r.productId,
          ingredients: r.ingredients.map((ing) => {
            const ingDef = getItemDef(ing.itemId);
            return {
              icon: ingDef?.icon ?? '·',
              name: ingDef?.name ?? ing.itemId,
              quantity: ing.quantity,
            };
          }),
          station: r.station,
          craftingTime: r.craftingTime,
        };
      }),
    [],
  );

  const maxWeight = 100;

  const statusIconPanelData = useMemo(
    () =>
      STATUS_EFFECTS.map((def) => {
        const activeEffect = statusEffects.find((se) => se.id === def.id);
        return {
          icon: def.icon,
          name: def.name,
          isActive: !!activeEffect,
          isNegative: def.isNegative,
          details: def.effectDescription,
          remainingTurns: activeEffect?.remainingDuration ?? 0,
        };
      }),
    [statusEffects],
  );

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

    const activeEffects = statusEffects.map((se) => {
      const def = STATUS_EFFECTS.find((d) => d.id === se.id);
      return `${def?.icon ?? ''} ${def?.name ?? se.id}`;
    });

    return { overallStatus, statusDescription, activeEffects };
  }, [attributes, statusEffects]);

  // ── Derived data: right main area ──

  const locationData = useMemo(() => {
    const currentPoint = getMapPointById(gameState.currentPosition);
    const subZonePoints = getMapPointsBySubZone(currentSubZone);

    const directions: { north?: string; south?: string; east?: string; west?: string } = {};
    for (const pt of subZonePoints) {
      if (pt.direction === 'north') directions.north = pt.name;
      if (pt.direction === 'south') directions.south = pt.name;
      if (pt.direction === 'east') directions.east = pt.name;
      if (pt.direction === 'west') directions.west = pt.name;
    }

    return {
      currentLocation: currentPoint?.name ?? gameState.currentPosition,
      locationIcon: POINT_TYPE_ICONS[currentPoint?.type ?? ''] ?? '📍',
      directions,
    };
  }, [gameState.currentPosition, currentSubZone]);

  const recipeResourceData = useMemo(() => {
    const recipes = CRAFTING_RECIPES.map((r) => {
      const productDef = getItemDef(r.productId);
      return {
        productIcon: productDef?.icon ?? '📦',
        productName: productDef?.name ?? r.productId,
        ingredients: r.ingredients.map((ing) => {
          const ingDef = getItemDef(ing.itemId);
          return {
            icon: ingDef?.icon ?? '·',
            name: ingDef?.name ?? ing.itemId,
            quantity: ing.quantity,
          };
        }),
        effect: r.effect,
      };
    });

    const resources = inventory.map((slot) => {
      const def = getItemDef(slot.itemId);
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
      inventory.map((slot) => {
        const def = getItemDef(slot.itemId);
        return {
          icon: def?.icon ?? '📦',
          name: def?.name ?? slot.itemId,
          quantity: slot.quantity,
          weight: def?.weight ?? 0,
          category: def?.category ?? '特殊',
        };
      }),
    [inventory],
  );

  // ── Derived data: overlays ──

  /** Find a choice event from the current map point for the event overlay */
  const currentEvent = useMemo(() => {
    if (gamePhase !== 'event') return null;
    const currentPoint = getMapPointById(gameState.currentPosition);
    if (currentPoint?.choiceEvents?.length) {
      return currentPoint.choiceEvents[0];
    }
    return null;
  }, [gamePhase, gameState.currentPosition]);

  // ── Handlers ──

  const handleSaveOpen = useCallback(() => setShowSavePanel(true), []);
  const handleSaveClose = useCallback(() => setShowSavePanel(false), []);

  const handleEventComplete = useCallback(() => {
    setGamePhase('exploration');
  }, [setGamePhase]);

  const handleDirectionClick = useCallback((_direction: string) => {
    // Movement is handled by the game engine via processAction;
    // this is a UI hook for future direction-click integration.
  }, []);

  const handleMapClick = useCallback(() => {
    // Map overlay integration point — not in scope for layout.
  }, []);

  // ── Render ──

  return (
    <div className={styles.screen}>
      {/* ─── Left Sidebar ─── */}
      <aside className={styles.sidebar}>
        <GameTitleCard
          weatherIcon={weatherInfo.icon}
          weatherName={weatherInfo.name}
          turn={gameState.turnNumber}
        />
        <GuideCraftingCard attributes={attributePanelData} recipes={craftingPanelData} />
        <CharacterCard
          name="幸存者"
          avatarEmoji="🧑"
          hp={attributes['健康值'] ?? 0}
          maxHp={100}
          weight={weight}
          maxWeight={maxWeight}
        />
        <StatusIconPanel statuses={statusIconPanelData} />
        <SurvivalStatusCard
          overallStatus={survivalStatusData.overallStatus}
          statusDescription={survivalStatusData.statusDescription}
          activeEffects={survivalStatusData.activeEffects}
        />
        <button className={styles.saveButton} onClick={handleSaveOpen}>
          💾 存档
        </button>
      </aside>

      {/* ─── Right Main Area ─── */}
      <main className={styles.main}>
        <section className={styles.section}>
          <LocationCard
            currentLocation={locationData.currentLocation}
            locationIcon={locationData.locationIcon}
            directions={locationData.directions}
            onDirectionClick={handleDirectionClick}
            onMapClick={handleMapClick}
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

      {/* ─── Overlays ─── */}

      {/* Combat overlay */}
      {gamePhase === 'combat' && (
        <div className={styles.overlayBackdrop}>
          <div className={styles.overlayContent}>
            <CombatScreen />
          </div>
        </div>
      )}

      {/* Event overlay */}
      {gamePhase === 'event' && currentEvent && (
        <div className={styles.overlayBackdrop}>
          <div className={styles.overlayContent}>
            <EventScreen event={currentEvent} onComplete={handleEventComplete} />
          </div>
        </div>
      )}

      {/* Save panel overlay */}
      {showSavePanel && <SavePanel onClose={handleSaveClose} />}

      {/* Game over overlay */}
      {gamePhase === 'gameover' && (
        <div className={styles.gameOverOverlay}>
          <div className={styles.gameOverTitle}>💀 游戏结束</div>
          <div className={styles.gameOverReason}>
            {gameState.gameOver.reason ?? '你未能在荒岛中存活下来。'}
          </div>
          <button className={styles.gameOverRestart} onClick={resetGame}>
            🔄 重新开始
          </button>
        </div>
      )}
    </div>
  );
}
