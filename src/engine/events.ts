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
