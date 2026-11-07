// Chunked voxel world: terrain generation, block access and player edits.
// No Three.js here, so it runs under node --test.
import { B, block } from './blocks.js';
import { createNoise2D, fbm, hash2 } from './noise.js';

export const CHUNK = 16;
export const HEIGHT = 64;
export const WATER_LEVEL = 20;
const TREE_CHANCE = 0.012;

/** Index of a block inside a chunk's data. */
export const index = (x, y, z) => x + z * CHUNK + y * CHUNK * CHUNK;
export const chunkKey = (cx, cz) => `${cx},${cz}`;
export const toChunk = v => Math.floor(v / CHUNK);
const toLocal = v => ((v % CHUNK) + CHUNK) % CHUNK;

export function createGenerator(seed) {
  return {
    seed,
    continents: createNoise2D(seed),
    hills: createNoise2D(seed + 1),
    detail: createNoise2D(seed + 2),
    peaks: createNoise2D(seed + 3),
  };
}

/** Height of the top block of the column at world (x, z). */
export function terrainHeight(gen, x, z) {
  const c = fbm(gen.continents, x / 220, z / 220, 3);
  const hills = fbm(gen.hills, x / 60, z / 60, 4);
  const detail = gen.detail(x / 18, z / 18);
  const m = Math.max(0, fbm(gen.peaks, x / 120, z / 120, 3) - 0.05);
  const h = 22 + c * 10 + hills * 11 * (0.5 + 0.5 * Math.max(0, c + 0.5)) + detail * 1.5 + m * m * 90;
  return Math.max(2, Math.min(HEIGHT - 12, Math.floor(h)));
}

/** The blocks of chunk (cx, cz), before any player edits. */
export function generateChunk(gen, cx, cz) {
  const data = new Uint8Array(CHUNK * CHUNK * HEIGHT);
  const heights = new Int16Array(CHUNK * CHUNK);
  for (let z = 0; z < CHUNK; z++) {
    for (let x = 0; x < CHUNK; x++) {
      const wx = cx * CHUNK + x;
      const wz = cz * CHUNK + z;
      const h = terrainHeight(gen, wx, wz);
      heights[x + z * CHUNK] = h;
      const beach = h <= WATER_LEVEL + 1;
      const rocky = h >= 44;
      for (let y = 0; y <= h; y++) {
        let id;
        if (y <= h - 4 || rocky) id = B.STONE;
        else if (y < h) id = beach ? B.SAND : B.DIRT;
        else id = beach ? B.SAND : B.GRASS;
        data[index(x, y, z)] = id;
      }
      for (let y = h + 1; y <= WATER_LEVEL; y++) data[index(x, y, z)] = B.WATER;
    }
  }
  // Trees, kept 2 blocks from the chunk's edge so they never cross into a neighbour.
  for (let z = 2; z < CHUNK - 2; z++) {
    for (let x = 2; x < CHUNK - 2; x++) {
      const h = heights[x + z * CHUNK];
      if (data[index(x, h, z)] !== B.GRASS) continue;
      const r = hash2(gen.seed, cx * CHUNK + x, cz * CHUNK + z);
      if (r >= TREE_CHANCE) continue;
      plantTree(data, x, h + 1, z, 4 + Math.floor((r / TREE_CHANCE) * 3));
    }
  }
  return data;
}

function plantTree(data, x, base, z, trunk) {
  const top = base + trunk - 1;
  if (top + 2 >= HEIGHT) return;
  for (let dy = -2; dy <= 1; dy++) {
    const r = dy >= 0 ? 1 : 2;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (r === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue; // round the corners
        const i = index(x + dx, top + dy, z + dz);
        if (data[i] === B.AIR) data[i] = B.LEAVES;
      }
    }
  }
  data[index(x, top + 2, z)] = B.LEAVES;
  for (let y = base; y <= top; y++) data[index(x, y, z)] = B.WOOD;
}

export class World {
  /**
   * @param {number} seed
   * @param {Map<string, Map<number, number>>} edits player edits by chunk key → block index → id
   */
  constructor(seed, edits = new Map()) {
    this.seed = seed;
    this.gen = createGenerator(seed);
    this.chunks = new Map();
    this.edits = edits;
    /** Called after a player edit: (x, y, z, id). */
    this.onEdit = null;
  }

  chunk(cx, cz) {
    return this.chunks.get(chunkKey(cx, cz));
  }

  /** The chunk, generated (with saved edits applied) if it isn't loaded. */
  ensure(cx, cz) {
    const key = chunkKey(cx, cz);
    let c = this.chunks.get(key);
    if (c) return c;
    const data = generateChunk(this.gen, cx, cz);
    const edits = this.edits.get(key);
    if (edits) for (const [i, id] of edits) data[i] = id;
    c = { cx, cz, key, data, dirty: true };
    this.chunks.set(key, c);
    // Neighbours' border faces depend on this chunk.
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = this.chunk(cx + dx, cz + dz);
      if (n) n.dirty = true;
    }
    return c;
  }

  unload(cx, cz) {
    this.chunks.delete(chunkKey(cx, cz));
  }

  /** Below the world reads as stone, above it and in unloaded chunks as air. */
  getBlock(x, y, z) {
    if (y < 0) return B.STONE;
    if (y >= HEIGHT) return B.AIR;
    const c = this.chunk(toChunk(x), toChunk(z));
    return c ? c.data[index(toLocal(x), y, toLocal(z))] : B.AIR;
  }

  isSolid(x, y, z) {
    return block(this.getBlock(x, y, z)).solid;
  }

  /** Set a block in a loaded chunk and remember it as a player edit. */
  setBlock(x, y, z, id) {
    if (y < 0 || y >= HEIGHT) return false;
    const cx = toChunk(x);
    const cz = toChunk(z);
    const c = this.chunk(cx, cz);
    if (!c) return false;
    const lx = toLocal(x);
    const lz = toLocal(z);
    const i = index(lx, y, lz);
    if (c.data[i] === id) return false;
    c.data[i] = id;
    c.dirty = true;
    let edits = this.edits.get(c.key);
    if (!edits) this.edits.set(c.key, edits = new Map());
    edits.set(i, id);
    const touch = (dx, dz) => { const n = this.chunk(cx + dx, cz + dz); if (n) n.dirty = true; };
    if (lx === 0) touch(-1, 0);
    if (lx === CHUNK - 1) touch(1, 0);
    if (lz === 0) touch(0, -1);
    if (lz === CHUNK - 1) touch(0, 1);
    this.onEdit?.(x, y, z, id);
    return true;
  }

  /** The y just above the highest solid block of the column (in a loaded chunk). */
  surfaceY(x, z) {
    for (let y = HEIGHT - 1; y >= 0; y--) if (this.isSolid(x, y, z)) return y + 1;
    return 0;
  }
}
