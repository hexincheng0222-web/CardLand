// ============================================================
// CardLand Map Store Types
// ============================================================

import type { ZoneId, SubZoneId } from '@data/types';

export interface MapStoreState {
  discoveredPoints: string[];
  currentZone: ZoneId;
  currentSubZone: SubZoneId;
  availablePaths: string[];
}
