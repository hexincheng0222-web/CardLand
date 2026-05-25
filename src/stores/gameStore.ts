// ============================================================
// CardLand Unified Game Store
// Single Zustand store replacing gameStore + playerStore + mapStore.
// Time-based system: GameClock with minutes, not turn numbers.
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ── Engine imports ──
import type { GameClock } from '@engine/clock';
import { createClock, advanceTime } from '@engine/clock';
import { processWeatherTick, getWeatherEffects } from '@engine/weather';
import type { Attributes } from '@engine/attributes';
import { processNaturalDecay, clampAttributes, checkDeathConditions, applyLinkageEffects, createSeededRNG as engineCreateSeededRNG } from '@engine/attributes';
import type { StatusEffect, StatusEffectId } from '@engine/status';
import { applyStatusEffects as applyStatusEffectsNew, addStatusEffect } from '@engine/status';
import type { Inventory } from '@engine/inventory';
import { createInventory, useItem as engineUseItem, getItemDef, addItem, removeItem } from '@engine/inventory';
import { checkSpoilage } from '@engine/items';
import type { RestType, RestContext } from '@engine/rest';
import { executeRest } from '@engine/rest';
import type { ExploreState } from '@engine/explore';
import { executeExplore } from '@engine/explore';
import { createRecipeBook, executeCraft, canCraft } from '@engine/crafting';
import type { MoveResult } from '@engine/movement';
import { executeMovement } from '@engine/movement';
import { isNight } from '@engine/daynight';
import { processTemperature, ZONE_TERRAIN_MAP } from '@engine/temperature';

// ── Data imports ──
import type { ItemId, WeatherId, ZoneId, SubZoneId, HandType, AttributeId } from '@data/types';
import { INITIAL_HANDS, ATTRIBUTES } from '@data/v1-spec';
import { getPointById, createReservesSeeded, regenerateReserves, type ResourceReserve } from '@data/map';

// ============================================================
// Types
// ============================================================

export type GamePhase = 'start' | 'hand-selection' | 'exploration' | 'combat' | 'event' | 'gameover';

export interface EquipmentSlots {
  head: ItemId | null;
  body: ItemId | null;
  hands: ItemId | null;
  legs: ItemId | null;
  feet: ItemId | null;
  accessory1: ItemId | null;
  accessory2: ItemId | null;
}

/** Weather state stored in the unified store (time-based, not turn-based) */
export interface WeatherStoreState {
  current: WeatherId;
  daysRemaining: number;
  startDay: number;
}

export interface GameState {
  // ── Time ──
  clock: GameClock;
  weather: WeatherStoreState;

  // ── Player ──
  attributes: Attributes;
  inventory: Inventory;
  statusEffects: StatusEffect[];
  equipment: EquipmentSlots;

  // ── Map ──
  currentZone: ZoneId;
  currentSubZone: SubZoneId;
  currentPosition: string;
  discoveredPoints: string[];
  reserves: ResourceReserve[];
  unlockedBlueprints: string[];

  // ── Game state ──
  gamePhase: GamePhase;
  logs: string[];
  gameOver: { isOver: boolean; reason: string | null };
}

// ============================================================
// Default values
// ============================================================

function defaultEquipment(): EquipmentSlots {
  return {
    head: null,
    body: null,
    hands: null,
    legs: null,
    feet: null,
    accessory1: null,
    accessory2: null,
  };
}

function defaultAttributes(): Attributes {
  const attrs = {} as Attributes;
  for (const attr of ATTRIBUTES) {
    attrs[attr.id] = attr.initialValue;
  }
  return attrs;
}

function pointToZone(pointId: string): { zone: ZoneId; subZone: SubZoneId } {
  const match = pointId.match(/^([A-F]\d)-/);
  const subZone = (match?.[1] ?? 'A1') as SubZoneId;
  const zone = subZone.charAt(0) as ZoneId;
  return { zone, subZone };
}

/** Determine tool type from inventory for explore actions */
function selectToolType(inventory: Inventory): 'bare' | 'stone' | 'iron' {
  const hasIron = inventory.slots.some(
    (s) => s.itemId === '铁斧' || s.itemId === '铁镐' || s.itemId === '黑曜石刀',
  );
  if (hasIron) return 'iron';
  const hasStone = inventory.slots.some(
    (s) => s.itemId === '石斧' || s.itemId === '工具',
  );
  if (hasStone) return 'stone';
  return 'bare';
}

// ============================================================
// Initial state
// ============================================================

function createInitialState(handType: HandType = '生存型', seed: number = 1): GameState {
  const hand = INITIAL_HANDS.find((h) => h.type === handType);

  let inventory: Inventory = createInventory();
  if (hand) {
    for (const item of hand.items) {
      const def = getItemDef(item.itemId);
      if (def) {
        const result = addItem(inventory, item.itemId, item.quantity, def.weight, def.stackLimit);
        inventory = result.inventory;
      }
    }
  }

  const clock = createClock(); // Day 1, 06:00

  // Generate initial weather using RNG
  const weatherRng = engineCreateSeededRNG(seed);
  const roll = weatherRng();
  let cumul = 0;
  let initialWeather: WeatherId = '晴';
  const WEATHER_PROBS: { id: WeatherId; prob: number; min: number; max: number }[] = [
    { id: '晴', prob: 0.35, min: 2, max: 5 },
    { id: '阴', prob: 0.25, min: 2, max: 4 },
    { id: '雨', prob: 0.20, min: 1, max: 3 },
    { id: '暴雨', prob: 0.10, min: 1, max: 2 },
    { id: '大雾', prob: 0.07, min: 1, max: 3 },
    { id: '酷热', prob: 0.03, min: 1, max: 2 },
  ];
  for (const w of WEATHER_PROBS) {
    cumul += w.prob;
    if (roll < cumul) {
      initialWeather = w.id;
      break;
    }
  }
  const weatherDef = WEATHER_PROBS.find((w) => w.id === initialWeather)!;
  const durationRange = weatherDef.max - weatherDef.min + 1;
  const duration = weatherDef.min + Math.floor(weatherRng() * durationRange);

  const { zone, subZone } = pointToZone('A1-North');
  const reserves = createReservesSeeded(seed);

  return {
    clock,
    weather: {
      current: initialWeather,
      daysRemaining: duration,
      startDay: 1,
    },
    attributes: defaultAttributes(),
    inventory,
    statusEffects: [],
    equipment: defaultEquipment(),
    currentZone: zone,
    currentSubZone: subZone,
    currentPosition: 'A1-North',
    discoveredPoints: ['A1-North'],
    reserves,
    unlockedBlueprints: [],
    gamePhase: 'start',
    logs: [],
    gameOver: { isOver: false, reason: null },
  };
}

// ============================================================
// Actions interface
// ============================================================

interface GameStoreActions {
  // ── Game lifecycle ──
  startGame: (handType: HandType) => void;
  resetGame: () => void;
  setGamePhase: (phase: GamePhase) => void;
  addLog: (log: string) => void;
  clearLogs: () => void;

  // ── Core game actions ──
  moveTo: (targetPointId: string) => boolean;
  explore: () => boolean;
  rest: (restType: RestType) => boolean;
  craftItem: (recipeId: string) => boolean;
  useItem: (itemId: ItemId) => boolean;
  equipItem: (itemId: ItemId) => void;

  // ── Time processing ──
  processTurn: (deltaMinutes: number) => void;

  // ── Save/Load ──
  saveGame: (slotIndex: number) => void;
  loadGame: (slotIndex: number) => boolean;
}

// ============================================================
// Store
// ============================================================

export const useGameStore = create<GameState & GameStoreActions>()(
  persist(
    (set, get) => ({
      // ── Initial state ──
      ...createInitialState(),

      // ============================================================
      // Game lifecycle
      // ============================================================

      startGame: (handType: HandType) => {
        const seed = Date.now();
        const state = createInitialState(handType, seed);
        set({
          ...state,
          gamePhase: 'exploration',
          logs: [`游戏开始！开局类型：${handType}`],
        });
      },

      resetGame: () => {
        const state = createInitialState();
        set({
          ...state,
          gamePhase: 'start',
          logs: [],
        });
      },

      setGamePhase: (phase) => set({ gamePhase: phase }),

      addLog: (log) => set({ logs: [...get().logs, log] }),

      clearLogs: () => set({ logs: [] }),

      // ============================================================
      // moveTo — Execute movement to a target point
      // ============================================================

      moveTo: (targetPointId: string): boolean => {
        const state = get();
        if (state.gameOver.isOver) return false;

        const { zone, subZone } = pointToZone(targetPointId);
        const weather = state.weather.current;

        const moveResult: MoveResult = executeMovement(
          {
            attributes: state.attributes,
            inventory: state.inventory,
            currentPosition: state.currentPosition,
          },
          state.currentPosition,
          targetPointId,
          weather,
          Math.random,
        );

        if (!moveResult.success) {
          set({ logs: [...state.logs, moveResult.message] });
          return false;
        }

        // Apply stamina cost
        const newAttributes: Attributes = {
          ...state.attributes,
          '体力值': (state.attributes['体力值'] ?? 0) - moveResult.staminaCost,
        };

        // Advance clock by movement time
        const newClock = advanceTime(state.clock, moveResult.timeCost);

        // Discover the target point
        const discovered = new Set(state.discoveredPoints);
        discovered.add(targetPointId);

        // Apply natural decay during movement time
        const decayed = processNaturalDecay(newAttributes, moveResult.timeCost, weather, {
          terrain: ZONE_TERRAIN_MAP[zone],
        });

        // Apply status effects during movement time
        const currentTime = newClock.totalMinutes;
        const statusResult = applyStatusEffectsNew(
          state.statusEffects,
          decayed,
          currentTime,
        );

        // Process temperature
        const nightTime = isNight(newClock.hour);
        const tempResult = processTemperature(
          statusResult.attributeChanges as unknown as Attributes,
          zone,
          weather,
          nightTime,
          false, // nearFire
          null,  // clothing
          false, // isWet
          moveResult.timeCost,
        );

        // Merge all attribute changes
        const finalAttrs = clampAttributes({
          ...decayed,
          ...(statusResult.attributeChanges as Partial<Attributes>),
          '体温': tempResult.bodyTemperature,
        });

        // Check death
        const death = checkDeathConditions(finalAttrs);

        const logs = [...state.logs, moveResult.message];
        if (moveResult.fogEvent) {
          logs.push(moveResult.fogEvent.message);
        }
        if (death.isDead) {
          logs.push(`游戏结束：${death.reason}`);
        }

        set({
          clock: newClock,
          attributes: finalAttrs,
          statusEffects: statusResult.activeEffects,
          currentZone: zone,
          currentSubZone: subZone,
          currentPosition: targetPointId,
          discoveredPoints: Array.from(discovered),
          gameOver: death.isDead ? { isOver: true, reason: death.reason } : state.gameOver,
          gamePhase: death.isDead ? 'gameover' : state.gamePhase,
          logs,
        });

        return true;
      },

      // ============================================================
      // explore — Execute exploration at current point
      // ============================================================

      explore: (): boolean => {
        const state = get();
        if (state.gameOver.isOver) return false;

        const nightTime = isNight(state.clock.hour);
        const toolType = selectToolType(state.inventory);

        const exploreState: ExploreState = {
          attributes: state.attributes,
          inventory: state.inventory,
          reserves: state.reserves,
          weather: state.weather.current,
          isNight: nightTime,
          toolType,
        };

        const result = executeExplore(exploreState, state.currentPosition, Math.random);

        if (!result.canExplore) {
          set({
            logs: [...state.logs, result.failReason ?? '无法探索'],
          });
          return false;
        }

        // Apply attribute costs from exploration
        const newAttributes: Attributes = {
          ...state.attributes,
          '体力值': (state.attributes['体力值'] ?? 0) + result.cost.stamina,
          '精力值': (state.attributes['精力值'] ?? 0) + result.cost.energy,
          '污垢': (state.attributes['污垢'] ?? 0) + result.cost.dirt,
        };

        // Advance clock
        const newClock = advanceTime(state.clock, result.timeCost);

        // Apply natural decay during explore time
        const { zone } = pointToZone(state.currentPosition);
        const decayed = processNaturalDecay(newAttributes, result.timeCost, state.weather.current, {
          terrain: ZONE_TERRAIN_MAP[zone],
          gathering: true,
        });

        // Apply status effects
        const currentTime = newClock.totalMinutes;
        const statusResult = applyStatusEffectsNew(
          state.statusEffects,
          decayed,
          currentTime,
        );

        // Process temperature
        const tempResult = processTemperature(
          clampAttributes(decayed),
          zone,
          state.weather.current,
          nightTime,
          false,
          null,
          false,
          result.timeCost,
        );

        const finalAttrs = clampAttributes({
          ...decayed,
          ...(statusResult.attributeChanges as Partial<Attributes>),
          '体温': tempResult.bodyTemperature,
        });

        const death = checkDeathConditions(finalAttrs);

        // Build logs
        const logs = [...state.logs];
        for (const item of result.gatherResult.decomposedItems) {
          logs.push(`采集到 ${item.itemId}×${item.quantity}`);
        }
        if (result.gatherResult.blueprintDrop) {
          logs.push(`发现蓝图：${result.gatherResult.blueprintDrop}`);
        }
        if (result.gatherResult.overflow > 0) {
          logs.push(`背包已满，丢失 ${result.gatherResult.overflow} 件物品`);
        }
        if (death.isDead) {
          logs.push(`游戏结束：${death.reason}`);
        }

        // Update unlocked blueprints
        const newBlueprints = [...state.unlockedBlueprints];
        if (result.gatherResult.blueprintDrop && !newBlueprints.includes(result.gatherResult.blueprintDrop)) {
          newBlueprints.push(result.gatherResult.blueprintDrop);
        }

        set({
          clock: newClock,
          attributes: finalAttrs,
          inventory: result.newInventory,
          statusEffects: statusResult.activeEffects,
          reserves: result.newReserves,
          unlockedBlueprints: newBlueprints,
          gameOver: death.isDead ? { isOver: true, reason: death.reason } : state.gameOver,
          gamePhase: death.isDead ? 'gameover' : state.gamePhase,
          logs,
        });

        return true;
      },

      // ============================================================
      // rest — Execute rest action
      // ============================================================

      rest: (restType: RestType): boolean => {
        const state = get();
        if (state.gameOver.isOver) return false;

        const point = getPointById(state.currentPosition);

        const context: RestContext = {
          pointId: state.currentPosition,
          weather: state.weather.current,
          environmentTemperature: 60, // default; real value from temperature engine
          hasCampfire: false, // TODO: check campfire state
          shelterLevel: 0,   // TODO: check shelter level
          isRestPoint: point?.type === '休息点',
          isWarmSpring: state.currentPosition === 'C4-South',
        };

        const result = executeRest(state.attributes, restType, context, Math.random);

        if (!result.success) {
          set({ logs: [...state.logs, result.failReason ?? '无法休息'] });
          return false;
        }

        // Advance clock
        const newClock = advanceTime(state.clock, result.timeCost);

        // Apply status effects during rest
        const currentTime = newClock.totalMinutes;
        let currentStatusEffects = [...state.statusEffects];

        // Grant status effects from rest
        for (const statusId of result.statusEffectsGained) {
          currentStatusEffects = addStatusEffect(currentStatusEffects, statusId as StatusEffectId, currentTime);
        }

        // Apply status effects over rest duration
        const statusResult = applyStatusEffectsNew(
          currentStatusEffects,
          result.newAttributes,
          currentTime,
        );

        const finalAttrs = clampAttributes({
          ...result.newAttributes,
          ...(statusResult.attributeChanges as Partial<Attributes>),
        });

        const death = checkDeathConditions(finalAttrs);

        const logs = [...state.logs];
        logs.push(`${restType}完成，时间+${result.timeCost}分钟`);
        if (result.beastAttack) {
          logs.push('遭遇野兽袭击！');
        }
        if (result.wetTriggered) {
          logs.push('被暴雨淋湿了');
        }
        if (death.isDead) {
          logs.push(`游戏结束：${death.reason}`);
        }

        set({
          clock: newClock,
          attributes: finalAttrs,
          statusEffects: statusResult.activeEffects,
          gameOver: death.isDead ? { isOver: true, reason: death.reason } : state.gameOver,
          gamePhase: death.isDead ? 'gameover' : state.gamePhase,
          logs,
        });

        return true;
      },

      // ============================================================
      // craftItem — Execute crafting
      // ============================================================

      craftItem: (recipeId: string): boolean => {
        const state = get();
        if (state.gameOver.isOver) return false;

        const recipeBook = createRecipeBook();
        const hasWorkstation = state.inventory.slots.some((s) => s.itemId === '工作台');
        const playerEnergy = state.attributes['精力值'] ?? 80;

        const check = canCraft(recipeBook, state.inventory, recipeId, hasWorkstation, new Set(state.unlockedBlueprints));
        if (!check.canCraft) {
          set({ logs: [...state.logs, `无法制作：${check.detail ?? check.reason}`] });
          return false;
        }

        try {
          const result = executeCraft(
            recipeBook,
            state.inventory,
            recipeId,
            hasWorkstation,
            playerEnergy,
          );

          // Apply energy cost
          const newAttributes: Attributes = {
            ...state.attributes,
            '精力值': (state.attributes['精力值'] ?? 80) + result.energyCost,
          };

          // Advance clock
          const newClock = advanceTime(state.clock, result.timeElapsed);

          // Apply natural decay during crafting
          const { zone } = pointToZone(state.currentPosition);
          const decayed = processNaturalDecay(newAttributes, result.timeElapsed, state.weather.current, {
            terrain: ZONE_TERRAIN_MAP[zone],
            crafting: true,
          });

          const finalAttrs = clampAttributes(decayed);
          const death = checkDeathConditions(finalAttrs);

          const logs = [...state.logs, result.message];
          if (death.isDead) {
            logs.push(`游戏结束：${death.reason}`);
          }

          set({
            clock: newClock,
            attributes: finalAttrs,
            inventory: result.inventory,
            gameOver: death.isDead ? { isOver: true, reason: death.reason } : state.gameOver,
            gamePhase: death.isDead ? 'gameover' : state.gamePhase,
            logs,
          });

          return true;
        } catch (e: unknown) {
          set({
            logs: [...state.logs, `制作失败：${e instanceof Error ? e.message : String(e)}`],
          });
          return false;
        }
      },

      // ============================================================
      // useItem — Use a consumable item
      // ============================================================

      useItem: (itemId: ItemId): boolean => {
        const state = get();
        if (state.gameOver.isOver) return false;

        try {
          const result = engineUseItem(state.inventory, itemId);
          const newAttributes: Attributes = { ...state.attributes };
          if (result.attributeEffect) {
            const key = result.attributeEffect.attributeId as AttributeId;
            newAttributes[key] = (newAttributes[key] ?? 0) + result.attributeEffect.amount;
          }

          const finalAttrs = clampAttributes(newAttributes);

          set({
            inventory: result.inventory,
            attributes: finalAttrs,
            logs: [...state.logs, `使用了 ${itemId}`],
          });

          return true;
        } catch {
          set({ logs: [...state.logs, `无法使用 ${itemId}`] });
          return false;
        }
      },

      // ============================================================
      // equipItem — Toggle equipment in appropriate slot
      // ============================================================

      equipItem: (itemId: ItemId) => {
        const state = get();
        const itemDef = getItemDef(itemId);
        if (!itemDef) return;

        // Determine slot from item type
        let slot: keyof EquipmentSlots | null = null;
        const desc = itemDef.description || '';
        if (desc.includes('攻击') || itemId === '石斧' || itemId === '木矛' || itemId === '铁斧' || itemId === '铁镐' || itemId === '黑曜石刀') {
          slot = 'hands';
        } else if (desc.includes('防御') || itemId === '布甲' || itemId === '皮甲') {
          slot = 'body';
        } else if (itemId === '布料' || itemId === '兽皮') {
          slot = 'body';
        }

        if (!slot) return;

        const newEquipment: EquipmentSlots = { ...state.equipment };
        newEquipment[slot] = newEquipment[slot] === itemId ? null : itemId;

        set({
          equipment: newEquipment,
          logs: [...state.logs, newEquipment[slot] ? `装备了 ${itemId}` : `卸下了 ${itemId}`],
        });
      },

      // ============================================================
      // processTurn — Advance time and apply all effects
      // ============================================================

      processTurn: (deltaMinutes: number) => {
        const state = get();
        if (state.gameOver.isOver) return;

        const logs: string[] = [...state.logs];
        const oldDay = state.clock.day;

        // 1. Advance GameClock
        const newClock = advanceTime(state.clock, deltaMinutes);
        const newDay = newClock.day;

        // 2. Weather tick if day changed
        let weatherState = { ...state.weather };
        if (newDay > oldDay) {
          const rng = engineCreateSeededRNG(newClock.totalMinutes);
          weatherState = processWeatherTick(weatherState, newClock, rng) as WeatherStoreState;
          if (weatherState.current !== state.weather.current) {
            logs.push(`天气变化：${state.weather.current} → ${weatherState.current}`);
          }
        }

        // 3. Apply natural attribute decay (per-hour, scaled by deltaMinutes)
        const { zone } = pointToZone(state.currentPosition);
        const nightTime = isNight(newClock.hour);
        let currentAttrs = processNaturalDecay(
          state.attributes,
          deltaMinutes,
          weatherState.current,
          {
            terrain: ZONE_TERRAIN_MAP[zone],
            isNight: nightTime,
          },
        );

        // 4. Apply weather effects
        const weatherEffects = getWeatherEffects(weatherState.current);
        const weatherDt = deltaMinutes / 60;
        currentAttrs = {
          ...currentAttrs,
          '口渴度': (currentAttrs['口渴度'] ?? 0) - weatherEffects.thirstRate * weatherDt,
          '饱食度': (currentAttrs['饱食度'] ?? 0) - weatherEffects.hungerRate * weatherDt,
          '体力值': (currentAttrs['体力值'] ?? 0) - weatherEffects.staminaRate * weatherDt,
          '健康值': (currentAttrs['健康值'] ?? 0) - weatherEffects.healthRate * weatherDt,
          '精力值': (currentAttrs['精力值'] ?? 0) - weatherEffects.energyRate * weatherDt,
          '心情': (currentAttrs['心情'] ?? 0) + weatherEffects.moodRate * weatherDt,
          '污垢': (currentAttrs['污垢'] ?? 0) + weatherEffects.dirtRate * weatherDt,
          '体温': (currentAttrs['体温'] ?? 0) + weatherEffects.temperatureRate * weatherDt,
        };

        // 5. Apply linkage effects
        const linkageResult = applyLinkageEffects(currentAttrs);
        for (const [attrId, amount] of Object.entries(linkageResult.directChanges)) {
          const key = attrId as AttributeId;
          currentAttrs[key] = (currentAttrs[key] ?? 0) + amount;
        }

        // 6. Apply status effects
        const currentTime = newClock.totalMinutes;
        const statusResult = applyStatusEffectsNew(
          state.statusEffects,
          currentAttrs,
          currentTime,
        );
        currentAttrs = { ...currentAttrs, ...(statusResult.attributeChanges as Partial<Attributes>) };

        // 7. Process temperature
        const tempResult = processTemperature(
          currentAttrs,
          zone,
          weatherState.current,
          nightTime,
          false,
          null,
          false,
          deltaMinutes,
        );
        currentAttrs['体温'] = tempResult.bodyTemperature;

        // 8. Clamp all attributes
        currentAttrs = clampAttributes(currentAttrs);

        // 9. Check death conditions
        const death = checkDeathConditions(currentAttrs);
        if (death.isDead) {
          logs.push(`游戏结束：${death.reason}`);
        }

        // 10. Check food spoilage and remove spoiled items
        const spoilageResult = checkSpoilage(state.inventory.slots, newClock.totalMinutes);
        let newInventory = state.inventory;
        if (spoilageResult.spoiledItems.length > 0) {
          for (const spoiled of spoilageResult.spoiledItems) {
            try {
              newInventory = removeItem(newInventory, spoiled.itemId, 1);
              logs.push(`⚠️ ${spoiled.itemId} 已腐败`);
            } catch {
              // Item already removed, skip
            }
          }
        }

        // 10. Regenerate reserves (once per full hour crossed)
        let newReserves = state.reserves;
        const hoursElapsed = deltaMinutes / 60;
        if (hoursElapsed >= 1) {
          newReserves = regenerateReserves(state.reserves, hoursElapsed);
        }

        set({
          clock: newClock,
          weather: weatherState,
          attributes: currentAttrs,
          statusEffects: statusResult.activeEffects,
          reserves: newReserves,
          inventory: newInventory,
          gameOver: death.isDead ? { isOver: true, reason: death.reason } : state.gameOver,
          gamePhase: death.isDead ? 'gameover' : state.gamePhase,
          logs,
        });
      },

      // ============================================================
      // Save / Load
      // ============================================================

      saveGame: (slotIndex: number) => {
        const state = get();
        const saveData = {
          version: 2,
          timestamp: Date.now(),
          day: state.clock.day,
          clock: state.clock,
          weather: state.weather,
          attributes: state.attributes,
          inventory: state.inventory,
          statusEffects: state.statusEffects,
          equipment: state.equipment,
          currentZone: state.currentZone,
          currentSubZone: state.currentSubZone,
          currentPosition: state.currentPosition,
          discoveredPoints: state.discoveredPoints,
          reserves: state.reserves,
          unlockedBlueprints: state.unlockedBlueprints,
          gamePhase: state.gamePhase,
          logs: state.logs,
          gameOver: state.gameOver,
        };
        try {
          localStorage.setItem(`cardland-save-${slotIndex}`, JSON.stringify(saveData));
        } catch {
          // Storage full or unavailable
        }
      },

      loadGame: (slotIndex: number): boolean => {
        try {
          const raw = localStorage.getItem(`cardland-save-${slotIndex}`);
          if (!raw) return false;
          const data = JSON.parse(raw);

          // Migrate from v1 (turn-based) if needed
          if (data.version === 1 || data.gameState) {
            // Legacy save — reset instead
            return false;
          }

          set({
            clock: data.clock,
            weather: data.weather,
            attributes: data.attributes,
            inventory: data.inventory,
            statusEffects: data.statusEffects ?? [],
            equipment: data.equipment ?? defaultEquipment(),
            currentZone: data.currentZone,
            currentSubZone: data.currentSubZone,
            currentPosition: data.currentPosition,
            discoveredPoints: data.discoveredPoints,
            reserves: data.reserves ?? [],
            unlockedBlueprints: data.unlockedBlueprints ?? [],
            gamePhase: data.gamePhase,
            logs: data.logs ?? [],
            gameOver: data.gameOver ?? { isOver: false, reason: null },
          });
          return true;
        } catch {
          return false;
        }
      },
    }),
    {
      name: 'cardland-unified-store',
      partialize: (state) => ({
        clock: state.clock,
        weather: state.weather,
        attributes: state.attributes,
        inventory: state.inventory,
        statusEffects: state.statusEffects,
        equipment: state.equipment,
        currentZone: state.currentZone,
        currentSubZone: state.currentSubZone,
        currentPosition: state.currentPosition,
        discoveredPoints: state.discoveredPoints,
        reserves: state.reserves,
        unlockedBlueprints: state.unlockedBlueprints,
        gamePhase: state.gamePhase,
        logs: state.logs,
        gameOver: state.gameOver,
      }),
    },
  ),
);

// ============================================================
// Backward-compatible selectors for components that still
// import from playerStore / mapStore
// ============================================================

/** Re-export as usePlayerStore-compatible selector for gradual migration */
export const usePlayerAttributes = () => useGameStore((s) => s.attributes);
export const usePlayerInventory = () => useGameStore((s) => s.inventory);
export const usePlayerStatusEffects = () => useGameStore((s) => s.statusEffects);
export const usePlayerEquipment = () => useGameStore((s) => s.equipment);
export const useCurrentPosition = () => useGameStore((s) => s.currentPosition);
export const useCurrentZone = () => useGameStore((s) => s.currentZone);
export const useCurrentSubZone = () => useGameStore((s) => s.currentSubZone);
export const useDiscoveredPoints = () => useGameStore((s) => s.discoveredPoints);
export const useGameClock = () => useGameStore((s) => s.clock);
export const useWeather = () => useGameStore((s) => s.weather);
