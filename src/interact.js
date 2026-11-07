// Outline the targeted block; left click breaks it, right click places the selected block.
import * as THREE from 'three';
import { B } from './blocks.js';
import { blocksPlayer, raycast } from './raycast.js';

const REACH = 6;
const REPEAT = 0.22; // seconds between actions while a button is held

export class Interaction {
  constructor(scene, canvas, world, player, chunks) {
    this.world = world;
    this.player = player;
    this.chunks = chunks;
    this.selected = B.GRASS;
    this.target = null;
    this.held = new Map(); // button → seconds until it repeats

    const box = new THREE.BoxGeometry(1.004, 1.004, 1.004);
    this.outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(box),
      new THREE.LineBasicMaterial({ color: 0x10131c, transparent: true, opacity: 0.85 }),
    );
    this.outline.visible = false;
    scene.add(this.outline);

    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('mousedown', e => {
      if (!player.locked || (e.button !== 0 && e.button !== 2)) return;
      this.act(e.button);
      this.held.set(e.button, REPEAT * 1.6);
    });
    document.addEventListener('mouseup', e => this.held.delete(e.button));
    document.addEventListener('pointerlockchange', () => { if (!player.locked) this.held.clear(); });
  }

  update(dt) {
    this.target = this.player.frozen ? null : raycast(this.world, this.player.eye, this.player.look, REACH);
    if (this.target) {
      const [x, y, z] = this.target.hit;
      this.outline.position.set(x + 0.5, y + 0.5, z + 0.5);
    }
    this.outline.visible = !!this.target && this.player.locked;
    for (const [button, wait] of this.held) {
      const left = wait - dt;
      if (left <= 0) { this.act(button); this.held.set(button, REPEAT); } else this.held.set(button, left);
    }
  }

  act(button) {
    const t = this.target ?? raycast(this.world, this.player.eye, this.player.look, REACH);
    if (!t) return;
    if (button === 0) {
      this.edit(t.hit, B.AIR);
    } else if (!blocksPlayer(this.player.body.pos, t.prev, this.selected)) {
      this.edit(t.prev, this.selected);
    }
  }

  edit([x, y, z], id) {
    if (this.world.setBlock(x, y, z, id)) {
      this.chunks.remeshAround(x, z);
      this.target = raycast(this.world, this.player.eye, this.player.look, REACH);
    }
  }
}
