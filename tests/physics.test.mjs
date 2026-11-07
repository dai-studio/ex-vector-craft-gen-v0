import { test } from 'node:test';
import assert from 'node:assert/strict';
import { B, block } from '../src/blocks.js';
import { MOVE, PLAYER, createBody, moveAxis, overlapsSolid, step } from '../src/physics.js';

/** A tiny world: a stone floor at y = 0 plus extra blocks. */
function flatWorld(extra = {}) {
  const at = new Map(Object.entries(extra));
  const getBlock = (x, y, z) => at.get(`${x},${y},${z}`) ?? (y <= 0 ? B.STONE : B.AIR);
  return { getBlock, isSolid: (x, y, z) => block(getBlock(x, y, z)).solid };
}

const DT = 1 / 60;
const run = (w, body, input, seconds) => { for (let t = 0; t < seconds; t += DT) step(w, body, input, DT); return body; };

test('overlap test covers exactly the blocks the box touches', () => {
  const w = flatWorld({ '2,1,0': B.STONE });
  assert.equal(overlapsSolid(w, 0.5, 1, 0.5), false);
  assert.equal(overlapsSolid(w, 0.5, 0.99, 0.5), true, 'sinking into the floor');
  assert.equal(overlapsSolid(w, 1.69, 1, 0.5), false, 'just short of the block at x=2');
  assert.equal(overlapsSolid(w, 1.71, 1, 0.5), true);
});

test('moving into a wall stops flush against it', () => {
  const w = flatWorld({ '2,1,0': B.STONE, '2,2,0': B.STONE });
  const pos = [1.5, 1, 0.5];
  assert.equal(moveAxis(w, pos, 0, 0.4), true);
  assert.ok(Math.abs(pos[0] - (2 - PLAYER.halfWidth)) < 1e-9, `x = ${pos[0]}`);
  assert.equal(moveAxis(w, pos, 0, -0.4), false);
});

test('falls, lands on the floor and stands still', () => {
  const w = flatWorld();
  const body = run(w, createBody(0.5, 10, 0.5), {}, 3);
  assert.ok(Math.abs(body.pos[1] - 1) < 1e-9, `y = ${body.pos[1]}`);
  assert.equal(body.onGround, true);
  assert.equal(body.vel[1], 0);
});

test('a jump clears one block but not two', () => {
  const w = flatWorld();
  const body = run(w, createBody(0.5, 1, 0.5), {}, 0.2);
  let peak = 0;
  step(w, body, { jump: true }, DT);
  for (let t = 0; t < 1.5; t += DT) { step(w, body, {}, DT); peak = Math.max(peak, body.pos[1]); }
  const height = peak - 1;
  assert.ok(height > 1.1 && height < 2, `jump height ${height.toFixed(2)}`);
  assert.equal(body.onGround, true);
});

test('walks in the direction it faces', () => {
  const w = flatWorld();
  const body = run(w, createBody(0.5, 1, 0.5), {}, 0.2);
  run(w, body, { forward: 1, yaw: 0 }, 1);
  assert.ok(body.pos[2] < -3.5, `yaw 0 walks towards -z (z = ${body.pos[2].toFixed(2)})`);
  assert.ok(Math.abs(body.pos[0] - 0.5) < 1e-6);
  const b2 = run(w, createBody(0.5, 1, 0.5), {}, 0.2);
  run(w, b2, { forward: 1, yaw: Math.PI / 2 }, 1);
  assert.ok(b2.pos[0] < -3.5, 'yaw 90° walks towards -x');
  const b3 = run(w, createBody(0.5, 1, 0.5), {}, 0.2);
  run(w, b3, { forward: 1, sprint: true }, 1);
  assert.ok(b3.pos[2] < body.pos[2] - 1.5, 'sprinting is faster');
});

test('walls stop walking; flying ignores gravity', () => {
  const wall = {};
  for (let y = 1; y <= 3; y++) for (let x = -3; x <= 3; x++) wall[`${x},${y},-3`] = B.STONE;
  const w = flatWorld(wall);
  const body = run(w, createBody(0.5, 1, 0.5), { forward: 1 }, 2);
  assert.ok(Math.abs(body.pos[2] - (-2 + PLAYER.halfWidth)) < 1e-6, `z = ${body.pos[2]}`);

  const flyer = createBody(0.5, 5, 0.5);
  flyer.flying = true;
  run(w, flyer, {}, 1);
  assert.ok(Math.abs(flyer.pos[1] - 5) < 1e-6, 'hovers');
  run(w, flyer, { jump: true }, 0.5);
  assert.ok(flyer.pos[1] > 7, 'Space flies up');
});

test('water slows falling and lets you swim up', () => {
  const water = {};
  for (let y = 1; y <= 6; y++) water[`0,${y},0`] = B.WATER;
  const w = flatWorld(water);
  const body = createBody(0.5, 6, 0.5);
  step(w, body, {}, DT);
  assert.equal(body.inWater, true);
  run(w, body, {}, 0.5);
  assert.ok(body.vel[1] >= -MOVE.swimSink - 1e-9, 'sinks slowly');
  const y = body.pos[1];
  run(w, body, { jump: true }, 0.5);
  assert.ok(body.pos[1] > y, 'Space swims up');
});
