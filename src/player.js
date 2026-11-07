// Keyboard and mouse → physics body → camera.
import { PLAYER, createBody, step } from './physics.js';

const LOOK_SPEED = 0.0022;
const MAX_PITCH = Math.PI / 2 - 0.01;

export class Player {
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;
    this.body = createBody(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.keys = new Set();
    this.frozen = true; // until the ground under the spawn point is loaded
    this.onToggleFly = null;

    document.addEventListener('mousemove', e => {
      if (!this.locked) return;
      this.yaw -= e.movementX * LOOK_SPEED;
      this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch - e.movementY * LOOK_SPEED));
    });
    document.addEventListener('keydown', e => {
      if (!this.locked) return;
      if (e.code === 'KeyF' && !e.repeat) {
        this.body.flying = !this.body.flying;
        this.body.vel[1] = 0;
        this.onToggleFly?.(this.body.flying);
      }
      if (['Space', 'ShiftLeft', 'ShiftRight'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
    });
    document.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('pointerlockchange', () => { if (!this.locked) this.keys.clear(); });
  }

  get locked() {
    return document.pointerLockElement === this.canvas;
  }

  lock() {
    this.canvas.requestPointerLock?.();
  }

  place(x, y, z, yaw = this.yaw, pitch = this.pitch) {
    this.body.pos = [x, y, z];
    this.body.vel = [0, 0, 0];
    this.yaw = yaw;
    this.pitch = pitch;
  }

  input() {
    const k = c => this.keys.has(c);
    return {
      forward: (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0),
      right: (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0),
      jump: k('Space'),
      down: k('ShiftLeft') || k('ShiftRight'),
      sprint: (k('ShiftLeft') || k('ShiftRight')) && !this.body.flying,
      yaw: this.yaw,
    };
  }

  update(world, dt) {
    if (this.frozen) return;
    step(world, this.body, this.input(), dt);
  }

  /** Eye position, in world coordinates. */
  get eye() {
    const [x, y, z] = this.body.pos;
    return [x, y + PLAYER.eye, z];
  }

  /** Unit vector the camera looks along. */
  get look() {
    const cp = Math.cos(this.pitch);
    return [-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp];
  }

  syncCamera() {
    const [x, y, z] = this.eye;
    this.camera.position.set(x, y, z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}
