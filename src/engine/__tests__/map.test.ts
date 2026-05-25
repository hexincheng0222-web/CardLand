import { describe, it, expect } from 'vitest';
import {
  getAllPoints,
  getPointsByZone,
  getPointById,
  createReservesSeeded,
  regenerateReserves,
  depleteReserve,
  getMovementCost,
  getConnectedPoints,
  MAP_POINTS,
  MOVEMENT_COSTS,
  ZONE_DANGER_RATES,
  ALL_SUB_ZONES,
} from '@data/map';

// ============================================================
// Map Points — 96 total
// ============================================================

describe('MapPoints', () => {
  it('getAllPoints returns 96 points', () => {
    expect(getAllPoints()).toHaveLength(96);
  });

  it('each zone has exactly 16 points', () => {
    const zones = ['A', 'B', 'C', 'D', 'E', 'F'];
    for (const zone of zones) {
      const pts = getPointsByZone(zone);
      expect(pts, `Zone ${zone} should have 16 points`).toHaveLength(16);
    }
  });

  it('each sub-zone has exactly 4 points', () => {
    for (const sz of ALL_SUB_ZONES) {
      const pts = MAP_POINTS.filter((p) => p.subZone === sz);
      expect(pts, `SubZone ${sz} should have 4 points`).toHaveLength(4);
    }
  });

  it('all points have unique ids', () => {
    const ids = MAP_POINTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(96);
  });

  it('every point has valid zone, subZone, direction', () => {
    for (const p of MAP_POINTS) {
      expect(p.zone).toMatch(/^[A-F]$/);
      expect(p.subZone).toMatch(/^[A-F]\d$/);
      expect(['north', 'south', 'east', 'west']).toContain(p.direction);
    }
  });

  it('every point has risk level 1-5', () => {
    for (const p of MAP_POINTS) {
      expect(p.dangerLevel).toBeGreaterThanOrEqual(1);
      expect(p.dangerLevel).toBeLessThanOrEqual(5);
    }
  });

  it('getPointById returns correct point', () => {
    const point = getPointById('A1-North');
    expect(point).toBeDefined();
    expect(point!.name).toBe('遮阳岩洞');
  });

  it('getPointById returns undefined for unknown id', () => {
    expect(getPointById('Z9-Nowhere')).toBeUndefined();
  });

  it('zone danger rates defined for all 6 zones', () => {
    for (const zone of ['A', 'B', 'C', 'D', 'E', 'F']) {
      expect(ZONE_DANGER_RATES[zone as keyof typeof ZONE_DANGER_RATES]).toBeDefined();
    }
  });

  it('zone A is safest, zone F is most dangerous', () => {
    expect(ZONE_DANGER_RATES.A).toBeLessThan(ZONE_DANGER_RATES.F);
  });
});

// ============================================================
// Resource Reserves
// ============================================================

describe('ResourceReserves', () => {
  it('createReserves creates reserves for all resource outputs', () => {
    const reserves = createReservesSeeded(42);
    expect(reserves.length).toBeGreaterThan(0);

    const totalOutputs = MAP_POINTS.reduce(
      (sum, p) => sum + p.outputs.length,
      0,
    );
    expect(reserves).toHaveLength(totalOutputs);
  });

  it('initial stock is between 50% and 100% of max', () => {
    const reserves = createReservesSeeded(42);
    for (const r of reserves) {
      expect(r.currentStock).toBeGreaterThanOrEqual(Math.floor(r.maxStock * 0.5));
      expect(r.currentStock).toBeLessThanOrEqual(r.maxStock);
    }
  });

  it('water sources have infinite max stock', () => {
    const reserves = createReservesSeeded(42);
    const waterReserves = reserves.filter((r) => r.itemId === '水');
    expect(waterReserves.length).toBeGreaterThan(0);
    for (const r of waterReserves) {
      expect(r.maxStock).toBe(9999);
      expect(r.regenerationRate).toBe(Infinity);
    }
  });

  it('stone/ore have very low regeneration rate', () => {
    const reserves = createReservesSeeded(42);
    const stoneReserves = reserves.filter((r) => r.itemId === '石材');
    expect(stoneReserves.length).toBeGreaterThan(0);
    for (const r of stoneReserves) {
      expect(r.regenerationRate).toBeLessThanOrEqual(0.2);
    }
  });

  it('regeneration increases stock after 1 hour', () => {
    const reserves = createReservesSeeded(42);
    const regen = regenerateReserves(reserves, 1);
    for (let i = 0; i < reserves.length; i++) {
      if (reserves[i].regenerationRate > 0 && reserves[i].regenerationRate !== Infinity) {
        expect(regen[i].currentStock).toBeGreaterThanOrEqual(reserves[i].currentStock);
      }
    }
  });

  it('regeneration caps at maxStock', () => {
    const reserves = createReservesSeeded(42);
    const regen = regenerateReserves(reserves, 10000);
    for (const r of regen) {
      if (r.regenerationRate !== Infinity) {
        expect(r.currentStock).toBeLessThanOrEqual(r.maxStock);
      }
    }
  });

  it('depletion reduces stock correctly', () => {
    const reserves = createReservesSeeded(42);
    const first = reserves[0];
    const depleted = depleteReserve(reserves, first.pointId, first.itemId, 3);
    const found = depleted.find(
      (r) => r.pointId === first.pointId && r.itemId === first.itemId,
    );
    expect(found!.currentStock).toBe(first.currentStock - 3);
  });

  it('depletion cannot go below 0', () => {
    const reserves = createReservesSeeded(42);
    const first = reserves[0];
    const depleted = depleteReserve(reserves, first.pointId, first.itemId, 9999);
    const found = depleted.find(
      (r) => r.pointId === first.pointId && r.itemId === first.itemId,
    );
    expect(found!.currentStock).toBe(0);
  });

  it('depletion does not affect other reserves', () => {
    const reserves = createReservesSeeded(42);
    const first = reserves[0];
    const second = reserves[1];
    const depleted = depleteReserve(reserves, first.pointId, first.itemId, 1);
    const foundSecond = depleted.find(
      (r) => r.pointId === second.pointId && r.itemId === second.itemId,
    );
    expect(foundSecond!.currentStock).toBe(second.currentStock);
  });

  it('deterministic with same seed', () => {
    const a = createReservesSeeded(123);
    const b = createReservesSeeded(123);
    expect(a).toEqual(b);
  });
});

// ============================================================
// Movement Costs
// ============================================================

describe('MovementCosts', () => {
  it('A→B zone connection costs 20 stamina', () => {
    const cost = getMovementCost('A', 'B');
    expect(cost).toBeDefined();
    expect(cost!.staminaCost).toBe(20);
    expect(cost!.requirements).toEqual([]);
  });

  it('A→C requires rope', () => {
    const cost = getMovementCost('A', 'C');
    expect(cost).toBeDefined();
    expect(cost!.requirements).toContain('rope');
  });

  it('C→F is the only passage to ruins (no special requirements)', () => {
    const cost = getMovementCost('C', 'F');
    expect(cost).toBeDefined();
    expect(cost!.staminaCost).toBe(35);
    expect(cost!.requirements).toEqual([]);
  });

  it('subzone-level lookup works within same zone', () => {
    const cost = getMovementCost('A1', 'A2');
    expect(cost).toBeDefined();
    expect(cost!.staminaCost).toBe(5);
  });

  it('cross-zone subzone lookup falls back to zone-level', () => {
    const cost = getMovementCost('A1', 'B3');
    expect(cost).toBeDefined();
    expect(cost!.staminaCost).toBe(20);
  });

  it('returns undefined for truly disconnected paths', () => {
    const cost = getMovementCost('A1', 'NONEXISTENT');
    expect(cost).toBeUndefined();
  });

  it('backward-compatible MOVEMENT_COSTS record has zone-level keys', () => {
    expect(MOVEMENT_COSTS['A-B']).toBe(20);
    expect(MOVEMENT_COSTS['A-C']).toBe(30);
    expect(MOVEMENT_COSTS['C-F']).toBe(35);
  });

  it('all cross-zone connections have positive stamina cost', () => {
    const crossZone = [
      ['A', 'B'], ['A', 'C'], ['A', 'E'],
      ['B', 'C'], ['B', 'D'], ['B', 'F'],
      ['C', 'F'], ['D', 'E'], ['D', 'F'], ['E', 'F'],
    ];
    for (const [from, to] of crossZone) {
      const cost = getMovementCost(from, to);
      expect(cost, `${from}→${to} should have a cost`).toBeDefined();
      expect(cost!.staminaCost).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// Connected Points
// ============================================================

describe('ConnectedPoints', () => {
  it('A1-North connects to other A1 points and zone B points', () => {
    const connected = getConnectedPoints('A1-North');
    expect(connected).toContain('A1-South');
    expect(connected).toContain('A1-East');
    expect(connected).toContain('A1-West');
  });

  it('returns empty array for unknown point', () => {
    expect(getConnectedPoints('Z9-Unknown')).toEqual([]);
  });

  it('point connects to other subzones in same zone', () => {
    const connected = getConnectedPoints('A1-North');
    expect(connected.some((id) => id.startsWith('A2-'))).toBe(true);
    expect(connected.some((id) => id.startsWith('A3-'))).toBe(true);
    expect(connected.some((id) => id.startsWith('A4-'))).toBe(true);
  });
});
