// Player movement against the voxel grid: an axis-aligned box moved one axis
// at a time, snapped to block faces on contact. No Three.js here.
import { block } from './blocks.js';

export const PLAYER = Object.freeze({ halfWidth: 0.3, height: 1.8, eye: 1.62 });
const EPS = 1e-4;

export const MOVE = Object.freeze({
  walk: 4.6, sprint: 7.5, swim: 3, fly: 10,
  gravity: 28, jump: 8.6, terminal: 40,
  swimGravity: 6, swimUp: 3.5, swimSink: 3,
});

/** Does a player box with its feet at (x, y, z) overlap a solid block? */
export function overlapsSolid(world, x, y, z, hw = PLAYER.halfWidth, h = PLAYER.height) {
  const x0 = Math.floor(x - hw + EPS), x1 = Math.floor(x + hw - EPS);
  const y0 = Math.floor(y + EPS), y1 = Math.floor(y + h - EPS);
  const z0 = Math.floor(z - hw + EPS), z1 = Math.floor(z + hw - EPS);
  for (let by = y0; by <= y1; by++) {
    for (let bz = z0; bz <= z1; bz++) {
      for (let bx = x0; bx <= x1; bx++) {
        if (world.isSolid(bx, by, bz)) return true;
      }
    }
  }
  return false;
}

/**
 * Move `pos` along `axis` (0 x, 1 y, 2 z) by `delta` (less than a block).
 * On contact it stops flush against the block. Returns whether it hit.
 */
export function moveAxis(world, pos, axis, delta, hw = PLAYER.halfWidth, h = PLAYER.height) {
  if (delta === 0) return false;
  const before = pos[axis];
  pos[axis] += delta;
  if (!overlapsSolid(world, pos[0], pos[1], pos[2], hw, h)) return false;
  if (axis === 1) {
    pos[1] = delta < 0 ? Math.floor(pos[1]) + 1 : Math.floor(pos[1] + h) - h;
  } else {
    pos[axis] = delta < 0 ? Math.floor(pos[axis] - hw) + 1 + hw : Math.floor(pos[axis] + hw) - hw;
  }
  // Snapping can't fix a box that started inside a block: stay put.
  if (overlapsSolid(world, pos[0], pos[1], pos[2], hw, h)) pos[axis] = before;
  return true;
}

export function createBody(x, y, z) {
  return { pos: [x, y, z], vel: [0, 0, 0], onGround: false, flying: false, inWater: false, headInWater: false };
}

const approach = (v, target, k) => v + (target - v) * k;

/**
 * Advance `body` by `dt`. `input`: { forward, right } in -1..1, { jump, down, sprint } booleans,
 * and `yaw` (radians, 0 = looking towards -z).
 */
export function step(world, body, input, dt) {
  const [x, y, z] = body.pos;
  body.inWater = block(world.getBlock(Math.floor(x), Math.floor(y + 0.4), Math.floor(z))).liquid;
  body.headInWater = block(world.getBlock(Math.floor(x), Math.floor(y + PLAYER.eye), Math.floor(z))).liquid;

  // Horizontal: turn the input into a world direction and ease the velocity towards it.
  let f = input.forward || 0;
  let r = input.right || 0;
  const len = Math.hypot(f, r);
  if (len > 1) { f /= len; r /= len; }
  const sin = Math.sin(input.yaw || 0);
  const cos = Math.cos(input.yaw || 0);
  const speed = body.flying ? MOVE.fly : body.inWater ? MOVE.swim : input.sprint ? MOVE.sprint : MOVE.walk;
  const tx = (-sin * f + cos * r) * speed;
  const tz = (-cos * f - sin * r) * speed;
  const grip = body.onGround || body.flying || body.inWater ? 1 - Math.exp(-dt * 18) : 1 - Math.exp(-dt * 3);
  body.vel[0] = approach(body.vel[0], tx, grip);
  body.vel[2] = approach(body.vel[2], tz, grip);

  // Vertical.
  if (body.flying) {
    const up = (input.jump ? 1 : 0) - (input.down ? 1 : 0);
    body.vel[1] = approach(body.vel[1], up * MOVE.fly * 0.8, 1 - Math.exp(-dt * 12));
  } else if (body.inWater) {
    body.vel[1] -= MOVE.swimGravity * dt;
    if (input.jump) body.vel[1] = Math.min(body.vel[1] + 30 * dt, MOVE.swimUp);
    body.vel[1] = Math.max(body.vel[1], -MOVE.swimSink);
  } else {
    body.vel[1] -= MOVE.gravity * dt;
    if (input.jump && body.onGround) body.vel[1] = MOVE.jump;
    body.vel[1] = Math.max(body.vel[1], -MOVE.terminal);
  }

  // Move: y first (so landing is known), then x and z. Each move is under a block per step.
  const dy = body.vel[1] * dt;
  if (moveAxis(world, body.pos, 1, dy)) {
    if (body.vel[1] < 0) { body.onGround = true; if (body.flying && input.down) body.flying = false; }
    body.vel[1] = 0;
  } else if (dy !== 0) {
    body.onGround = false;
  }
  if (moveAxis(world, body.pos, 0, body.vel[0] * dt)) body.vel[0] = 0;
  if (moveAxis(world, body.pos, 2, body.vel[2] * dt)) body.vel[2] = 0;
  return body;
}
