import { describe, expect, it } from 'vitest';
import { pickNext, type Rect } from './spatial';

const box = (left: number, top: number, w = 100, h = 60): Rect => ({ left, top, width: w, height: h });

// A row of three tiles, and a row below it with two tiles.
const row = [box(0, 0), box(120, 0), box(240, 0)];
const below = [box(0, 100), box(240, 100)];
const all = row.concat(below);

describe('pickNext', () => {
  it('moves right to the next tile in the row', () => {
    expect(pickNext(row[0], all, 'right')).toBe(1);
  });

  it('moves left to the previous tile in the row', () => {
    expect(pickNext(row[2], all, 'left')).toBe(1);
  });

  it('stays put at the end of the row', () => {
    expect(pickNext(row[2], row, 'right')).toBe(-1);
    expect(pickNext(row[0], row, 'left')).toBe(-1);
  });

  it('moves down to the closest tile in the row below', () => {
    expect(pickNext(row[2], all, 'down')).toBe(4);
    expect(pickNext(row[1], all, 'down')).toBe(3);
  });

  it('moves up from the row below', () => {
    expect(pickNext(below[1], all, 'up')).toBe(2);
  });

  it('prefers a tile in line over a nearer one off to the side', () => {
    const from = box(0, 0);
    const inLine = box(300, 0);
    const offAxis = box(150, 200);
    expect(pickNext(from, [offAxis, inLine], 'right')).toBe(1);
  });
});
