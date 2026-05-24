import type { EnemyTier, EnemyDef } from './types';
import { ENEMIES } from './v1-spec';

// ============================================================
// Enemy Data — organized by tier for combat engine lookup
// ============================================================

/**
 * All enemy definitions grouped by tier.
 * Small: 小野猪, 毒蛇
 * Medium: 野猪
 * Large: 蛇王
 */
export const ENEMIES_BY_TIER: Record<EnemyTier, EnemyDef[]> = {
  Small: [],
  Medium: [],
  Large: [],
};

for (const enemy of ENEMIES) {
  ENEMIES_BY_TIER[enemy.tier].push(enemy);
}

/** Export for convenience */
export const SMALL_ENEMIES = ENEMIES_BY_TIER.Small as ReadonlyArray<EnemyDef>;
export const MEDIUM_ENEMIES = ENEMIES_BY_TIER.Medium as ReadonlyArray<EnemyDef>;
export const LARGE_ENEMIES = ENEMIES_BY_TIER.Large as ReadonlyArray<EnemyDef>;

/**
 * Get a random enemy definition for a given tier.
 * Pure function — uses provided RNG for determinism.
 */
export function getEnemyByTier(tier: EnemyTier, rng: () => number): EnemyDef {
  const pool = ENEMIES_BY_TIER[tier];
  if (pool.length === 0) {
    // Fallback: return first ENEMIES entry (should never happen)
    return ENEMIES[0];
  }
  const index = Math.floor(rng() * pool.length);
  return pool[index];
}

/**
 * Get an enemy definition by index within a tier.
 * Pure function — deterministic without RNG.
 */
export function getEnemyByIndex(tier: EnemyTier, index: number): EnemyDef {
  const pool = ENEMIES_BY_TIER[tier];
  return pool[index % pool.length];
}
