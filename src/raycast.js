// Which block is the player looking at? A voxel DDA walk (Amanatides & Woo).
// No Three.js here.
import { B, block } from './blocks.js';
import { PLAYER } from './physics.js';

/** Blocks a ray stops at: anything but air and liquids. */
export const pickable = id => id !== B.AIR && !block(id).liquid;

/**
 * Walk from `origin` along `dir` for up to `maxDist` blocks.
 * Returns { hit: [x,y,z], prev: [x,y,z] (the cell before it, where a block
 * would be placed), normal, id, distance } or null. The starting cell is
 * skipped, so a head inside leaves can still look out.
 */
export function raycast(world, origin, dir, maxDist = 6, stopAt = pickable) {
  const len = Math.hypot(dir[0], dir[1], dir[2]);
  if (!len) return null;
  const d = dir.map(v => v / len);
  const cell = origin.map(Math.floor);
  const step = d.map(v => (v > 0 ? 1 : v < 0 ? -1 : 0));
  const tDelta = d.map(v => (v !== 0 ? Math.abs(1 / v) : Infinity));
  const tMax = d.map((v, i) => {
    if (v > 0) return (cell[i] + 1 - origin[i]) * tDelta[i];
    if (v < 0) return (origin[i] - cell[i]) * tDelta[i];
    return Infinity;
  });
  const normal = [0, 0, 0];
  for (;;) {
    const axis = tMax[0] < tMax[1] ? (tMax[0] < tMax[2] ? 0 : 2) : (tMax[1] < tMax[2] ? 1 : 2);
    const t = tMax[axis];
    if (t > maxDist) return null;
    const prev = [...cell];
    cell[axis] += step[axis];
    tMax[axis] += tDelta[axis];
    normal.fill(0);
    normal[axis] = -step[axis];
    const id = world.getBlock(cell[0], cell[1], cell[2]);
    if (stopAt(id)) return { hit: [...cell], prev, normal: [...normal], id, distance: t };
  }
}

/** Would a solid block at `cell` overlap a player whose feet are at `pos`? */
export function blocksPlayer(pos, cell, id) {
  if (!block(id).solid) return false;
  const [x, y, z] = pos;
  const hw = PLAYER.halfWidth;
  return cell[0] < x + hw && cell[0] + 1 > x - hw
    && cell[1] < y + PLAYER.height && cell[1] + 1 > y
    && cell[2] < z + hw && cell[2] + 1 > z - hw;
}
