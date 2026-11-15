// Pure geometry for remote arrow navigation. No DOM, so it is easy to test.

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

/** How much more a step off the arrow's axis costs than a step along it. */
const CROSS_AXIS_WEIGHT = 2;

/**
 * Picks the candidate the arrow should move to from `from`.
 * Returns its index in `candidates`, or -1 when nothing lies in that direction.
 * On a tie the earlier candidate wins.
 */
export function pickNext(from: Rect, candidates: Rect[], dir: Direction): number {
  const fx = from.left + from.width / 2;
  const fy = from.top + from.height / 2;
  let best = -1;
  let bestScore = Infinity;
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const dx = c.left + c.width / 2 - fx;
    const dy = c.top + c.height / 2 - fy;
    let primary: number;
    let cross: number;
    if (dir === 'right') { primary = dx; cross = dy; }
    else if (dir === 'left') { primary = -dx; cross = dy; }
    else if (dir === 'down') { primary = dy; cross = dx; }
    else { primary = -dy; cross = dx; }
    if (primary <= 0) continue;
    const score = primary + CROSS_AXIS_WEIGHT * Math.abs(cross);
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}
