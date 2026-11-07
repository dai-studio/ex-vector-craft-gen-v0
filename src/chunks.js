// Loads, meshes and unloads chunks around the player, a few per frame.
import * as THREE from 'three';
import { buildChunkMesh } from './mesher.js';
import { CHUNK, toChunk } from './world.js';

const GENERATE_PER_FRAME = 2;
const MESH_PER_FRAME = 3;

/** Mesher colours are sRGB; vertex colours are read as linear. */
function toLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function geometryFrom({ positions, colors, indices, stride }) {
  const lin = new Float32Array(colors.length);
  for (let i = 0; i < colors.length; i++) lin[i] = stride === 4 && i % 4 === 3 ? colors[i] : toLinear(colors[i]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.BufferAttribute(lin, stride));
  g.setIndex(new THREE.BufferAttribute(indices, 1));
  g.computeBoundingSphere();
  return g;
}

export class ChunkRenderer {
  constructor(scene, world, { radius = 5 } = {}) {
    this.scene = scene;
    this.world = world;
    this.radius = radius;
    this.meshes = new Map(); // key → { opaque, transparent }
    this.opaqueMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.transparentMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    this.group = new THREE.Group();
    scene.add(this.group);
  }

  /** 0..1: scales every block colour (night is darker). */
  setLight(k) {
    this.opaqueMaterial.color.setScalar(k);
    this.transparentMaterial.color.setScalar(k);
  }

  /** Coordinates within `r` chunks of (pcx, pcz), nearest first. */
  around(pcx, pcz, r) {
    const out = [];
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dz * dz > (r + 0.5) * (r + 0.5)) continue;
        out.push([pcx + dx, pcz + dz, dx * dx + dz * dz]);
      }
    }
    return out.sort((a, b) => a[2] - b[2]);
  }

  /** Is the chunk and each of its 4 neighbours generated? (Border faces need them.) */
  ready(cx, cz) {
    const w = this.world;
    return !!(w.chunk(cx, cz) && w.chunk(cx + 1, cz) && w.chunk(cx - 1, cz) && w.chunk(cx, cz + 1) && w.chunk(cx, cz - 1));
  }

  update(px, pz) {
    const pcx = toChunk(px);
    const pcz = toChunk(pz);
    const w = this.world;

    // Generate one ring past the view so border chunks can be meshed.
    let budget = GENERATE_PER_FRAME;
    for (const [cx, cz] of this.around(pcx, pcz, this.radius + 1)) {
      if (budget <= 0) break;
      if (!w.chunk(cx, cz)) { w.ensure(cx, cz); budget--; }
    }

    budget = MESH_PER_FRAME;
    for (const [cx, cz] of this.around(pcx, pcz, this.radius)) {
      if (budget <= 0) break;
      const c = w.chunk(cx, cz);
      if (c?.dirty && this.ready(cx, cz)) { this.remesh(c); budget--; }
    }

    // Forget chunks well outside the view; edits live on in world.edits.
    const far = this.radius + 3;
    for (const c of [...w.chunks.values()]) {
      if (Math.abs(c.cx - pcx) > far || Math.abs(c.cz - pcz) > far) {
        this.drop(c.key);
        w.unload(c.cx, c.cz);
      }
    }
  }

  /** Right after an edit: rebuild the dirty chunks around it now, not over the next frames. */
  remeshAround(x, z) {
    const cx = toChunk(x);
    const cz = toChunk(z);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const c = this.world.chunk(cx + dx, cz + dz);
        if (c?.dirty && this.ready(c.cx, c.cz)) this.remesh(c);
      }
    }
  }

  remesh(chunk) {
    this.drop(chunk.key);
    const { opaque, transparent } = buildChunkMesh(this.world, chunk);
    const entry = {};
    for (const [name, buf, mat] of [['opaque', opaque, this.opaqueMaterial], ['transparent', transparent, this.transparentMaterial]]) {
      if (!buf.indices.length) continue;
      const mesh = new THREE.Mesh(geometryFrom(buf), mat);
      mesh.position.set(chunk.cx * CHUNK, 0, chunk.cz * CHUNK);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      if (name === 'transparent') mesh.renderOrder = 1;
      this.group.add(mesh);
      entry[name] = mesh;
    }
    this.meshes.set(chunk.key, entry);
    chunk.dirty = false;
  }

  drop(key) {
    const entry = this.meshes.get(key);
    if (!entry) return;
    for (const mesh of Object.values(entry)) {
      this.group.remove(mesh);
      mesh.geometry.dispose();
    }
    this.meshes.delete(key);
  }

  get stats() {
    return { loaded: this.world.chunks.size, meshed: this.meshes.size };
  }
}
