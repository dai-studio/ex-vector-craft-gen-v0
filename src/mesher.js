// Chunk → triangle buffers. Only faces that can be seen are emitted. Colours
// are flat per face (the "vector" look), darkened by direction and by ambient
// occlusion at each corner. No Three.js here, so it runs under node --test.
import { B, block, rgb } from './blocks.js';
import { hash2 } from './noise.js';
import { CHUNK, HEIGHT, index } from './world.js';

/** Normal, light level and corners (counter-clockwise seen from outside). */
export const FACES = [
  { n: [1, 0, 0],  shade: 0.82, face: 'side',   corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { n: [-1, 0, 0], shade: 0.82, face: 'side',   corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { n: [0, 1, 0],  shade: 1.0,  face: 'top',    corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { n: [0, -1, 0], shade: 0.55, face: 'bottom', corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1],  shade: 0.7,  face: 'side',   corners: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { n: [0, 0, -1], shade: 0.7,  face: 'side',   corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];

/** Light at a corner by how many of its 3 neighbours are opaque (0 = boxed in). */
const AO = [0.5, 0.68, 0.84, 1.0];
const WATER_TOP = 0.875;

const COLORS = new Map();
function colorOf(id, face) {
  const key = id * 4 + (face === 'top' ? 0 : face === 'side' ? 1 : 2);
  let c = COLORS.get(key);
  if (!c) COLORS.set(key, c = rgb(block(id)[face]));
  return c;
}

/** Should a face of `id` towards neighbour `n` be drawn? */
export function faceVisible(id, n) {
  if (id === B.AIR) return false;
  const nb = block(n);
  if (block(id).opaque) return !nb.opaque;
  return n !== id && !nb.opaque;
}

class Buffers {
  constructor(stride) {
    this.stride = stride;
    this.positions = [];
    this.colors = [];
    this.indices = [];
  }
  get vertexCount() { return this.positions.length / 3; }
  toArrays() {
    return {
      positions: new Float32Array(this.positions),
      colors: new Float32Array(this.colors),
      indices: new Uint32Array(this.indices),
      stride: this.stride,
    };
  }
}

/**
 * Build the buffers for `chunk`. Positions are relative to the chunk's origin.
 * Neighbouring chunks are read through `world` for faces on the border.
 * @returns {{ opaque, transparent }} each { positions, colors (rgb / rgba), indices }
 */
export function buildChunkMesh(world, chunk) {
  const { data, cx, cz } = chunk;
  const ox = cx * CHUNK;
  const oz = cz * CHUNK;
  const opaque = new Buffers(3);
  const transparent = new Buffers(4);

  const get = (x, y, z) => {
    if (y < 0) return B.STONE;
    if (y >= HEIGHT) return B.AIR;
    if (x >= 0 && x < CHUNK && z >= 0 && z < CHUNK) return data[index(x, y, z)];
    return world.getBlock(ox + x, y, oz + z);
  };
  const occludes = (x, y, z) => (block(get(x, y, z)).opaque ? 1 : 0);

  for (let y = 0; y < HEIGHT; y++) {
    for (let z = 0; z < CHUNK; z++) {
      for (let x = 0; x < CHUNK; x++) {
        const id = data[index(x, y, z)];
        if (id === B.AIR) continue;
        const def = block(id);
        const see = def.alpha < 1;
        const out = see ? transparent : opaque;
        const tint = 1 + (hash2(7, ox + x + y * 131, oz + z) - 0.5) * 0.07;
        const waterTop = id === B.WATER && get(x, y + 1, z) !== B.WATER;

        for (const f of FACES) {
          const [nx, ny, nz] = f.n;
          if (!faceVisible(id, get(x + nx, y + ny, z + nz))) continue;
          const base = colorOf(id, f.face);
          const start = out.vertexCount;
          const ao = [];
          for (const c of f.corners) {
            const cy = waterTop && c[1] === 1 ? WATER_TOP : c[1];
            out.positions.push(x + c[0], y + cy, z + c[2]);
            let light = f.shade * tint;
            if (!see) {
              // The two blocks beside the corner and the one diagonal to it, in the layer the face looks into.
              const d = c.map((v, axis) => (f.n[axis] !== 0 ? 0 : v ? 1 : -1));
              const px = x + nx;
              const py = y + ny;
              const pz = z + nz;
              const [u, v] = d.map((s, axis) => (s ? axis : -1)).filter(a => a >= 0);
              const offset = (axis, s) => [axis === 0 ? s : 0, axis === 1 ? s : 0, axis === 2 ? s : 0];
              const ou = offset(u, d[u]);
              const ov = offset(v, d[v]);
              const s1 = occludes(px + ou[0], py + ou[1], pz + ou[2]);
              const s2 = occludes(px + ov[0], py + ov[1], pz + ov[2]);
              const cr = occludes(px + ou[0] + ov[0], py + ou[1] + ov[1], pz + ou[2] + ov[2]);
              const level = s1 && s2 ? 0 : 3 - (s1 + s2 + cr);
              ao.push(level);
              light *= AO[level];
            }
            out.colors.push(base[0] * light, base[1] * light, base[2] * light);
            if (see) out.colors.push(def.alpha);
          }
          // Split the quad along the diagonal that keeps the occlusion gradient smooth.
          if (!see && ao[0] + ao[2] < ao[1] + ao[3]) {
            out.indices.push(start + 1, start + 2, start + 3, start + 1, start + 3, start);
          } else {
            out.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
          }
        }
      }
    }
  }
  return { opaque: opaque.toArrays(), transparent: transparent.toArrays() };
}
