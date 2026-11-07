import { test } from 'node:test';
import assert from 'node:assert/strict';
import { B, block } from '../src/blocks.js';
import { blocksPlayer, raycast } from '../src/raycast.js';

function worldWith(blocks) {
  const at = new Map(Object.entries(blocks));
  const getBlock = (x, y, z) => at.get(`${x},${y},${z}`) ?? B.AIR;
  return { getBlock, isSolid: (x, y, z) => block(getBlock(x, y, z)).solid };
}

test('hits the first block along the ray, with the cell in front of it', () => {
  const w = worldWith({ '0,0,-4': B.STONE, '0,0,-6': B.DIRT });
  const r = raycast(w, [0.5, 0.5, 0.5], [0, 0, -1]);
  assert.deepEqual(r.hit, [0, 0, -4]);
  assert.deepEqual(r.prev, [0, 0, -3]);
  assert.deepEqual(r.normal.map(v => v + 0), [0, 0, 1]);
  assert.equal(r.id, B.STONE);
  assert.ok(Math.abs(r.distance - 3.5) < 1e-9, 'distance to the near face (z = -3)');
});

test('respects the reach', () => {
  const w = worldWith({ '0,0,-8': B.STONE });
  assert.equal(raycast(w, [0.5, 0.5, 0.5], [0, 0, -1], 6), null);
  assert.ok(raycast(w, [0.5, 0.5, 0.5], [0, 0, -1], 9));
});

test('looks through water and skips the starting cell', () => {
  const w = worldWith({ '0,-1,0': B.WATER, '0,-2,0': B.WATER, '0,-3,0': B.SAND, '0,0,0': B.LEAVES });
  const r = raycast(w, [0.5, 0.7, 0.5], [0, -1, 0]);
  assert.deepEqual(r.hit, [0, -3, 0]);
  assert.deepEqual(r.prev, [0, -2, 0], 'placing replaces the water above');
  assert.deepEqual(r.normal, [0, 1, 0]);
});

test('diagonal rays step through every cell they cross', () => {
  const w = worldWith({ '3,0,-3': B.STONE });
  const r = raycast(w, [0.5, 0.5, 0.5], [1, 0, -1]);
  assert.deepEqual(r.hit, [3, 0, -3]);
  // The previous cell shares a face with the hit.
  const diff = r.hit.map((v, i) => Math.abs(v - r.prev[i])).reduce((a, b) => a + b);
  assert.equal(diff, 1);
});

test('blocks are not placed inside the player', () => {
  const feet = [0.5, 10, 0.5];
  assert.equal(blocksPlayer(feet, [0, 10, 0], B.STONE), true);
  assert.equal(blocksPlayer(feet, [0, 11, 0], B.STONE), true, 'head height');
  assert.equal(blocksPlayer(feet, [0, 12, 0], B.STONE), false);
  assert.equal(blocksPlayer(feet, [0, 9, 0], B.STONE), false, 'under the feet is fine');
  assert.equal(blocksPlayer(feet, [1, 10, 0], B.STONE), false);
  assert.equal(blocksPlayer(feet, [0, 10, 0], B.WATER), false, 'water never blocks');
});
