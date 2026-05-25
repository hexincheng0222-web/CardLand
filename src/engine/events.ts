// ============================================================
// CardLand V1 Event Resolution Engine
// Deterministic event resolution using seeded RNG
// ============================================================

import type {
  ChoiceEvent,
  ChoiceOption,
  ChoiceOutcome,
  MapPoint,
  ZoneId,
  ItemId,
  AttributeId,
  StatusEffectId,
  EnemyDef,
  NoiseLevel,
  NoiseAction,
  WeatherId,
} from '@data/types';
import { ENEMIES } from '@data/v1-spec';
import { ZONE_DANGER_RATES } from '@data/map';

// ============================================================
// Seeded RNG for deterministic event resolution
// ============================================================

export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Returns a float in [0, 1) */
  next(): number {
    // LCG parameters from Numerical Recipes
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 4294967296;
  }

  /** Returns an integer in [min, max) */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min;
  }
}

// ============================================================
// Player State (minimal interface for requirement checking)
// ============================================================

export interface PlayerState {
  attributes: Record<AttributeId, number>;
  inventory: Record<ItemId, number>;
}

// ============================================================
// Event Result
// ============================================================

export interface EventResult {
  requirementsMet: boolean;
  itemChanges: { itemId: ItemId; quantity: number }[];
  attributeChanges: { attributeId: AttributeId; amount: number }[];
  statusEffects: StatusEffectId[];
  message: string;
}

// ============================================================
// resolveChoiceEvent
// Resolves a player's choice in a choice event using seeded RNG
// ============================================================

export function resolveChoiceEvent(
  event: ChoiceEvent,
  optionId: string,
  rng: SeededRNG,
  playerState: PlayerState
): EventResult {
  const option = event.options.find((o) => o.id === optionId);
  if (!option) {
    return {
      requirementsMet: false,
      itemChanges: [],
      attributeChanges: [],
      statusEffects: [],
      message: `选项 ${optionId} 不存在`,
    };
  }

  // Check requirements
  const reqCheck = checkRequirements(option, playerState);
  if (!reqCheck.met) {
    return {
      requirementsMet: false,
      itemChanges: [],
      attributeChanges: [],
      statusEffects: [],
      message: reqCheck.reason,
    };
  }

  // Determine outcome
  const outcome = rollOutcome(option, rng);

  return {
    requirementsMet: true,
    itemChanges: outcome.itemChanges ?? [],
    attributeChanges: outcome.attributeChanges ?? [],
    statusEffects: outcome.statusEffects ?? [],
    message: outcome.message,
  };
}

function checkRequirements(
  option: ChoiceOption,
  playerState: PlayerState
): { met: boolean; reason: string } {
  for (const req of option.requirements) {
    if (req.itemId !== undefined && req.minValue !== undefined) {
      const have = playerState.inventory[req.itemId] ?? 0;
      if (have < req.minValue) {
        return {
          met: false,
          reason: `需要 ${req.itemId}×${req.minValue}，当前只有 ${have}`,
        };
      }
    }
    if (req.attributeId !== undefined && req.minValue !== undefined) {
      const have = playerState.attributes[req.attributeId] ?? 0;
      if (have < req.minValue) {
        return {
          met: false,
          reason: `需要 ${req.attributeId}≥${req.minValue}，当前 ${have}`,
        };
      }
    }
  }
  return { met: true, reason: '' };
}

function rollOutcome(option: ChoiceOption, rng: SeededRNG): ChoiceOutcome {
  const outcomes = option.outcomes;

  // Single outcome: always applies
  if (outcomes.length === 1) {
    return outcomes[0];
  }

  // Multiple outcomes: roll against cumulative probabilities
  const roll = rng.next();
  let cumulative = 0;
  for (const outcome of outcomes) {
    const prob = outcome.probability ?? 1;
    cumulative += prob;
    if (roll < cumulative) {
      return outcome;
    }
  }

  // Fallback to last outcome if probabilities don't sum to 1
  return outcomes[outcomes.length - 1];
}

// ============================================================
// triggerRandomEvent
// Checks if any choice event at a map point triggers
// ============================================================

export interface RandomEventTrigger {
  eventId: string;
  eventName: string;
  triggered: boolean;
}

export function triggerRandomEvent(
  mapPoint: MapPoint,
  rng: SeededRNG
): RandomEventTrigger | null {
  if (mapPoint.choiceEvents.length === 0) {
    return null;
  }

  // Roll for each choice event; return the first triggered one
  for (const event of mapPoint.choiceEvents) {
    const roll = rng.next();
    if (roll < event.triggerChance) {
      return {
        eventId: event.id,
        eventName: event.name,
        triggered: true,
      };
    }
  }

  return null;
}

/** Checks all choice events at a map point and returns which ones trigger */
export function checkAllRandomEvents(
  mapPoint: MapPoint,
  rng: SeededRNG
): RandomEventTrigger[] {
  return mapPoint.choiceEvents.map((event) => {
    const roll = rng.next();
    return {
      eventId: event.id,
      eventName: event.name,
      triggered: roll < event.triggerChance,
    };
  });
}

// ============================================================
// determineEncounter
// Determines if a random encounter occurs based on zone danger rate
// and returns a matching enemy if one occurs
// ============================================================

export function determineEncounter(
  zoneId: ZoneId,
  rng: SeededRNG
): EnemyDef | null {
  const dangerRate = ZONE_DANGER_RATES[zoneId];
  const roll = rng.next();

  if (roll >= dangerRate) {
    return null;
  }

  // Filter enemies whose habitats are in the given zone
  const zoneSubZones: string[] =
    zoneId === 'A' ? ['A1', 'A2', 'A3', 'A4'] : ['B1', 'B2', 'B3', 'B4'];

  const candidates = ENEMIES.filter((enemy) =>
    enemy.habitats.some((h) => zoneSubZones.includes(h))
  );

  if (candidates.length === 0) {
    return null;
  }

  // Pick a random enemy from candidates
  const index = rng.nextInt(0, candidates.length);
  return candidates[index];
}

// ============================================================
// P4.3: Event Trigger System (Noise + Blueprint Drops)
// ============================================================

// --- Types ---

/** Player action types that can trigger events */
export type EventActionType = '采集' | '移动' | '休息' | '战斗' | '制作';

/** Event categories */
export type EventCategory = 'danger' | 'encounter' | 'raid' | 'noise' | 'lost' | 'weather';

/** Event severity */
export type EventSeverity = 'low' | 'medium' | 'high';

/** A generated game event */
export interface GameEvent {
  id: string;
  category: EventCategory;
  name: string;
  description: string;
  icon: string;
  severity: EventSeverity;
  zone: ZoneId;
  possibleOutcomes: EventOutcomeOption[];
}

/** An outcome option for a game event */
export interface EventOutcomeOption {
  id: string;
  label: string;
  probability: number;
  effects: EventEffect;
  message: string;
}

/** Effects applied by an event outcome */
export interface EventEffect {
  healthChange: number;
  staminaChange: number;
  energyChange: number;
  itemGains: { itemId: ItemId; quantity: number }[];
  itemLosses: { itemId: ItemId; quantity: number }[];
  statusEffects: StatusEffectId[];
}

/** Result of processing an event */
export interface EventOutcome {
  optionId: string;
  effects: EventEffect;
  message: string;
}

/** Tracks consecutive actions and noise for event triggering */
export interface EventTracker {
  lastAction: EventActionType | null;
  consecutiveCount: number;
  currentNoiseLevel: NoiseLevel;
  lastZone: ZoneId | null;
}

/** Weather-related encounter modifiers */
export interface EncounterModifiers {
  zoneBaseRate: number;
  weatherModifier: number;
  nightModifier: number;
  noiseModifier: number;
  consecutiveModifier: number;
  totalChance: number;
}

// --- Constants ---

/**
 * Zone base danger rates for the event trigger system.
 * These are the authoritative rates from the design doc.
 */
export const EVENT_ZONE_DANGER_RATES: Record<ZoneId, number> = {
  A: 0.10,  // 海滩: 涨潮、野人巡逻、螃蟹夹伤
  B: 0.30,  // 丛林: 毒蛇、野兽、迷路、陷阱
  C: 0.35,  // 山地: 落石、塌方、毒气、灼伤
  D: 0.30,  // 沼泽: 下陷、水蛭、沼气、疾病
  E: 0.25,  // 浅海: 暗流、鲨鱼、水母、溺水
  F: 0.40,  // 遗迹: 机关、塌方、守护者
};

/** Encounter chance modifiers */
export const ENCOUNTER_MODIFIERS = {
  /** Night adds +15% encounter chance */
  NIGHT_BONUS: 0.15,
  /** Fog adds +30% lost chance */
  FOG_LOST_BONUS: 0.30,
  /** Large noise adds +15% encounter chance */
  LARGE_NOISE_BONUS: 0.15,
  /** Each consecutive same-action after 3 adds +10% */
  CONSECUTIVE_BONUS_PER: 0.10,
  /** Consecutive actions threshold before penalty */
  CONSECUTIVE_THRESHOLD: 3,
  /** Base gather danger rate */
  GATHER_DANGER: 0.25,
  /** Base explore/move encounter rate */
  MOVE_ENCOUNTER: 0.30,
  /** Rest attack rate: outdoor */
  REST_ATTACK_OUTDOOR: 0.15,
  /** Rest attack rate: Lv1 shelter */
  REST_ATTACK_SHELTER_LV1: 0.05,
  /** Rest attack rate: Lv2+ shelter */
  REST_ATTACK_SHELTER_LV2: 0.00,
} as const;

/** Noise level to encounter bonus mapping */
export const NOISE_ENCOUNTER_BONUS: Record<NoiseLevel, number> = {
  'none': 0,
  'small': 0,
  'medium': 0.05,
  'large': 0.15,
};

/** Noise action to noise level mapping (duplicated from combat.ts for independence) */
export const ACTION_NOISE_LEVELS: Record<NoiseAction, NoiseLevel> = {
  '普通移动': 'none',
  '采集': 'small',
  '采矿': 'large',
  '砍伐': 'large',
  '战斗': 'medium',
  '潜行移动': 'none',
};

/** Zone event templates — common events per zone */
export const ZONE_EVENT_TEMPLATES: Record<ZoneId, {
  name: string;
  icon: string;
  category: EventCategory;
  severity: EventSeverity;
  description: string;
}[]> = {
  A: [
    { name: '涨潮', icon: '🌊', category: 'weather', severity: 'medium', description: '海水突然上涨，你被迫后退' },
    { name: '野人巡逻', icon: '👁️', category: 'encounter', severity: 'high', description: '远处出现野人巡逻队' },
    { name: '螃蟹夹伤', icon: '🦀', category: 'danger', severity: 'low', description: '被藏在礁石下的螃蟹夹伤' },
  ],
  B: [
    { name: '毒蛇出没', icon: '🐍', category: 'danger', severity: 'medium', description: '草丛中传来嘶嘶声' },
    { name: '野兽袭击', icon: '🐗', category: 'encounter', severity: 'high', description: '一头野兽突然冲出' },
    { name: '迷路', icon: '❓', category: 'lost', severity: 'medium', description: '在密林中迷失了方向' },
    { name: '陷阱', icon: '🪤', category: 'danger', severity: 'medium', description: '踩到了隐藏的捕猎陷阱' },
  ],
  C: [
    { name: '落石', icon: '🪨', category: 'danger', severity: 'high', description: '山体松动，碎石滚落' },
    { name: '塌方', icon: '⛰️', category: 'danger', severity: 'high', description: '脚下的地面突然塌陷' },
    { name: '毒气', icon: '☁️', category: 'danger', severity: 'medium', description: '裂缝中冒出刺鼻的气体' },
    { name: '灼伤', icon: '🔥', category: 'danger', severity: 'medium', description: '踩到高温地面被灼伤' },
  ],
  D: [
    { name: '下陷', icon: '🕳️', category: 'danger', severity: 'medium', description: '脚下的泥地开始下陷' },
    { name: '水蛭', icon: '🪱', category: 'danger', severity: 'low', description: '腿上爬满了水蛭' },
    { name: '沼气', icon: '💨', category: 'danger', severity: 'medium', description: '泥潭中冒出可燃气体' },
    { name: '疾病', icon: '🤒', category: 'danger', severity: 'high', description: '沼泽中的瘴气让你感到不适' },
  ],
  E: [
    { name: '暗流', icon: '🌀', category: 'danger', severity: 'high', description: '一股强力暗流将你卷向深处' },
    { name: '鲨鱼', icon: '🦈', category: 'encounter', severity: 'high', description: '远处的鳍正在靠近' },
    { name: '水母群', icon: '🪼', category: 'danger', severity: 'medium', description: '被水母蜇伤' },
    { name: '溺水', icon: '🌊', category: 'danger', severity: 'high', description: '体力不支，开始下沉' },
  ],
  F: [
    { name: '机关启动', icon: '⚙️', category: 'danger', severity: 'high', description: '触发了古代机关' },
    { name: '塌方', icon: '⛰️', category: 'danger', severity: 'high', description: '洞顶开始坍塌' },
    { name: '守护者', icon: '🗿', category: 'encounter', severity: 'high', description: '石像守护者苏醒了' },
  ],
};

/** Action type to base trigger probability mapping */
export const ACTION_TRIGGER_RATES: Partial<Record<EventActionType, number>> = {
  '采集': ENCOUNTER_MODIFIERS.GATHER_DANGER,      // 25%
  '移动': ENCOUNTER_MODIFIERS.MOVE_ENCOUNTER,      // 30%
};

// --- Functions ---

/**
 * Create a new EventTracker to track consecutive actions and noise.
 */
export function createEventTracker(): EventTracker {
  return {
    lastAction: null,
    consecutiveCount: 0,
    currentNoiseLevel: 'none',
    lastZone: null,
  };
}

/**
 * Update the event tracker after an action is taken.
 * Returns a new tracker (immutable).
 */
export function updateEventTracker(
  tracker: EventTracker,
  action: EventActionType,
  noiseLevel: NoiseLevel,
  zone: ZoneId,
): EventTracker {
  const isSameAction = tracker.lastAction === action;
  const isSameZone = tracker.lastZone === zone;

  return {
    lastAction: action,
    consecutiveCount: isSameAction && isSameZone ? tracker.consecutiveCount + 1 : 1,
    currentNoiseLevel: noiseLevel,
    lastZone: zone,
  };
}

/**
 * Calculate the total encounter chance based on all modifiers.
 *
 * Formula:
 *   total = zoneBase + weatherMod + nightMod + noiseMod + consecutiveMod
 *   total = clamp(total, 0, 1)
 *
 * Modifiers:
 *   - Zone base rate from EVENT_ZONE_DANGER_RATES
 *   - Weather: 大雾 +30% lost chance (applied separately)
 *   - Night: +15% encounter chance
 *   - Noise: +15% for large noise, +5% for medium
 *   - Consecutive: +10% per action after 3 consecutive same actions
 */
export function calculateEncounterChance(
  zone: ZoneId,
  weather: WeatherId,
  isNight: boolean,
  noiseLevel: NoiseLevel,
  consecutiveActions: number,
): EncounterModifiers {
  const zoneBaseRate = EVENT_ZONE_DANGER_RATES[zone] ?? 0.1;

  const weatherModifier = weather === '大雾' ? ENCOUNTER_MODIFIERS.FOG_LOST_BONUS : 0;

  const nightModifier = isNight ? ENCOUNTER_MODIFIERS.NIGHT_BONUS : 0;

  const noiseModifier = NOISE_ENCOUNTER_BONUS[noiseLevel] ?? 0;

  const consecutiveModifier = consecutiveActions >= ENCOUNTER_MODIFIERS.CONSECUTIVE_THRESHOLD
    ? (consecutiveActions - ENCOUNTER_MODIFIERS.CONSECUTIVE_THRESHOLD + 1) * ENCOUNTER_MODIFIERS.CONSECUTIVE_BONUS_PER
    : 0;

  const totalChance = Math.min(1, Math.max(0,
    zoneBaseRate + weatherModifier + nightModifier + noiseModifier + consecutiveModifier
  ));

  return {
    zoneBaseRate,
    weatherModifier,
    nightModifier,
    noiseModifier,
    consecutiveModifier,
    totalChance,
  };
}

/**
 * Roll for whether an event triggers given a chance value.
 * Returns true if event triggers (roll < chance).
 */
export function rollForEvent(chance: number, rng: SeededRNG): boolean {
  return rng.next() < chance;
}

/**
 * Generate a random event for a given zone.
 * Picks a random event template from the zone's event pool
 * and creates a GameEvent with outcome options.
 */
export function generateEvent(zone: ZoneId, rng: SeededRNG): GameEvent {
  const templates = ZONE_EVENT_TEMPLATES[zone];
  if (!templates || templates.length === 0) {
    // Fallback: generic danger event
    return {
      id: `${zone}-generic`,
      category: 'danger',
      name: '未知危险',
      description: '你感到了一丝不安...',
      icon: '⚠️',
      severity: 'medium',
      zone,
      possibleOutcomes: [
        {
          id: 'escape',
          label: '逃离',
          probability: 0.67,
          effects: { healthChange: 0, staminaChange: -5, energyChange: 0, itemGains: [], itemLosses: [], statusEffects: [] },
          message: '你及时逃离了危险',
        },
        {
          id: 'hurt',
          label: '受伤',
          probability: 0.33,
          effects: { healthChange: -10, staminaChange: -5, energyChange: 0, itemGains: [], itemLosses: [], statusEffects: [] },
          message: '你受了轻伤',
        },
      ],
    };
  }

  const templateIndex = rng.nextInt(0, templates.length);
  const template = templates[templateIndex];

  // Generate severity-appropriate outcomes
  const outcomes = generateOutcomes(template.severity, zone, rng);

  return {
    id: `${zone}-${templateIndex}-${Date.now()}`,
    category: template.category,
    name: template.name,
    description: template.description,
    icon: template.icon,
    severity: template.severity,
    zone,
    possibleOutcomes: outcomes,
  };
}

/**
 * Generate outcome options based on event severity and zone.
 */
function generateOutcomes(
  severity: EventSeverity,
  _zone: ZoneId,
  _rng: SeededRNG,
): EventOutcomeOption[] {
  switch (severity) {
    case 'low':
      return [
        {
          id: 'minor-hurt',
          label: '轻伤',
          probability: 0.5,
          effects: { healthChange: -5, staminaChange: -3, energyChange: 0, itemGains: [], itemLosses: [], statusEffects: [] },
          message: '你受了点小伤，但无大碍',
        },
        {
          id: 'escape',
          label: '安全脱身',
          probability: 0.5,
          effects: { healthChange: 0, staminaChange: -5, energyChange: 0, itemGains: [], itemLosses: [], statusEffects: [] },
          message: '你成功避开了危险',
        },
      ];

    case 'medium':
      return [
        {
          id: 'moderate-hurt',
          label: '受伤',
          probability: 0.5,
          effects: { healthChange: -15, staminaChange: -10, energyChange: -5, itemGains: [], itemLosses: [], statusEffects: [] },
          message: '你受了不轻的伤',
        },
        {
          id: 'minor-hurt',
          label: '轻伤',
          probability: 0.33,
          effects: { healthChange: -5, staminaChange: -5, energyChange: 0, itemGains: [], itemLosses: [], statusEffects: [] },
          message: '你勉强脱身，受了点轻伤',
        },
        {
          id: 'escape',
          label: '毫发无伤',
          probability: 0.17,
          effects: { healthChange: 0, staminaChange: -5, energyChange: 0, itemGains: [], itemLosses: [], statusEffects: [] },
          message: '你幸运地避开了所有危险',
        },
      ];

    case 'high':
      return [
        {
          id: 'severe-hurt',
          label: '重伤',
          probability: 0.33,
          effects: { healthChange: -25, staminaChange: -15, energyChange: -10, itemGains: [], itemLosses: [], statusEffects: [] },
          message: '你受到了严重伤害',
        },
        {
          id: 'moderate-hurt',
          label: '受伤',
          probability: 0.34,
          effects: { healthChange: -15, staminaChange: -10, energyChange: -5, itemGains: [], itemLosses: [], statusEffects: [] },
          message: '你受了不轻的伤',
        },
        {
          id: 'escape',
          label: '侥幸逃脱',
          probability: 0.33,
          effects: { healthChange: -5, staminaChange: -10, energyChange: 0, itemGains: [], itemLosses: [], statusEffects: [] },
          message: '你侥幸逃脱，只受了点擦伤',
        },
      ];
  }
}

/**
 * Process an event result by rolling for an outcome.
 * Returns the chosen outcome with its effects.
 */
export function processEventResult(
  event: GameEvent,
  rng: SeededRNG,
): EventOutcome {
  if (event.possibleOutcomes.length === 0) {
    return {
      optionId: 'none',
      effects: { healthChange: 0, staminaChange: 0, energyChange: 0, itemGains: [], itemLosses: [], statusEffects: [] },
      message: '什么也没发生',
    };
  }

  // Single outcome: always apply
  if (event.possibleOutcomes.length === 1) {
    const outcome = event.possibleOutcomes[0];
    return {
      optionId: outcome.id,
      effects: { ...outcome.effects },
      message: outcome.message,
    };
  }

  // Multiple outcomes: roll against cumulative probabilities
  const roll = rng.next();
  let cumulative = 0;
  for (const outcome of event.possibleOutcomes) {
    cumulative += outcome.probability;
    if (roll < cumulative) {
      return {
        optionId: outcome.id,
        effects: { ...outcome.effects },
        message: outcome.message,
      };
    }
  }

  // Fallback to last outcome
  const last = event.possibleOutcomes[event.possibleOutcomes.length - 1];
  return {
    optionId: last.id,
    effects: { ...last.effects },
    message: last.message,
  };
}

/**
 * Calculate rest encounter chance based on shelter level.
 *
 * Design doc:
 *   - 露天 (outdoor): 15%
 *   - Lv1 shelter: 5%
 *   - Lv2+ shelter: 0%
 */
export function calculateRestEncounterChance(shelterLevel: number): number {
  if (shelterLevel >= 2) return ENCOUNTER_MODIFIERS.REST_ATTACK_SHELTER_LV2;
  if (shelterLevel === 1) return ENCOUNTER_MODIFIERS.REST_ATTACK_SHELTER_LV1;
  return ENCOUNTER_MODIFIERS.REST_ATTACK_OUTDOOR;
}

/**
 * Calculate noise-based encounter bonus.
 * Returns the additional encounter chance from noise level.
 */
export function calculateNoiseBonus(noiseLevel: NoiseLevel): number {
  return NOISE_ENCOUNTER_BONUS[noiseLevel] ?? 0;
}

/**
 * Get the noise level for a given action type.
 */
export function getActionNoiseLevel(action: NoiseAction): NoiseLevel {
  return ACTION_NOISE_LEVELS[action] ?? 'none';
}
