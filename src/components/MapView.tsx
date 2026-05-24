import { useMemo, useCallback } from 'react';
import { useGameStore } from '@stores/gameStore';
import { LocationCard } from '@components/cards/LocationCard';
import { getMapPointById, getMovementCost } from '@data/map';
import type { SubZoneId } from '@data/types';

const ALL_SUB_ZONES: SubZoneId[] = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4'];
const DIRECTION_KEYS = ['north', 'south', 'east', 'west'] as const;

type DirectionKey = (typeof DIRECTION_KEYS)[number];

function getLocationIcon(pointType: string | undefined): string {
  switch (pointType) {
    case '休息点':
      return '⛺';
    case '资源点':
      return '🌿';
    case '事件点':
      return '❓';
    case '危险点':
      return '⚠️';
    case '障碍点':
      return '🚧';
    default:
      return '📍';
  }
}

export function MapView() {
  const gameState = useGameStore((s) => s.gameState);
  const processAction = useGameStore((s) => s.processAction);
  const currentPosition = gameState.currentPosition;
  const stamina = gameState.attributes['体力值'] ?? 0;

  const currentPoint = useMemo(() => getMapPointById(currentPosition), [currentPosition]);
  const currentSubZone = currentPoint?.subZone ?? 'A1';

  // Build all possible moves from current sub-zone
  const availableMoves = useMemo(() => {
    const moves: { subZone: SubZoneId; cost: number; name: string }[] = [];
    for (const sz of ALL_SUB_ZONES) {
      if (sz === currentSubZone) continue;
      const cost = getMovementCost(currentSubZone, sz);
      if (cost !== undefined) {
        const point = getMapPointById(`${sz}-North`) ?? getMapPointById(`${sz}-South`);
        moves.push({ subZone: sz, cost, name: point?.name ?? sz });
      }
    }
    return moves;
  }, [currentSubZone]);

  // Filter to moves the player can afford and map to 4 directions
  const validMoves = useMemo(
    () => availableMoves.filter((m) => stamina >= m.cost),
    [availableMoves, stamina]
  );

  const directions = useMemo(() => {
    const dirs: Partial<Record<DirectionKey, string>> = {};
    for (let i = 0; i < Math.min(validMoves.length, 4); i++) {
      const move = validMoves[i];
      dirs[DIRECTION_KEYS[i]] = `${move.subZone} ${move.name}`;
    }
    return dirs;
  }, [validMoves]);

  const handleDirectionClick = useCallback(
    (direction: string) => {
      const dirIndex = DIRECTION_KEYS.indexOf(direction as DirectionKey);
      if (dirIndex >= 0 && dirIndex < validMoves.length) {
        processAction({ type: 'move', targetSubZone: validMoves[dirIndex].subZone });
      }
    },
    [validMoves, processAction]
  );

  const handleMapClick = useCallback(() => {
    // Map overview modal — not implemented in this task
    // eslint-disable-next-line no-console
    console.log('Map overview clicked');
  }, []);

  const locationIcon = getLocationIcon(currentPoint?.type);

  return (
    <LocationCard
      currentLocation={`${currentSubZone} - ${currentPoint?.name ?? '未知地点'}`}
      locationIcon={locationIcon}
      directions={directions}
      onDirectionClick={handleDirectionClick}
      onMapClick={handleMapClick}
    />
  );
}
