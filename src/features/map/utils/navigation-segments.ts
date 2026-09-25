import type { Coordinate } from '../types/coordinate';

export type NavigationSegments = {
  completed: Coordinate[];
  detour: Coordinate[];
  pending: Coordinate[];
};

/** Split at the projected car position so the active line never starts behind it. */
export function navigationSegments(
  route: Coordinate[],
  segmentIndex: number,
  position: Coordinate,
  stopIndex: number | null,
): NavigationSegments {
  if (route.length < 2) {
    return { completed: [], detour: [], pending: [] };
  }

  const index = Math.min(Math.max(segmentIndex, 0), route.length - 2);
  const completed = [...route.slice(0, index + 1), position];
  const ahead = [position, ...route.slice(index + 1)];

  if (stopIndex === null || stopIndex <= index || stopIndex >= route.length) {
    return { completed, detour: [], pending: ahead };
  }

  const stopOffset = stopIndex - index;
  return {
    completed,
    detour: ahead.slice(0, stopOffset + 1),
    pending: ahead.slice(stopOffset),
  };
}
