import { test } from 'node:test';
import assert from 'node:assert/strict';
import { B, block } from '../src/blocks.js';
import { FACES, buildChunkMesh, faceVisible } from '../src/mesher.js';
import { CHUNK, HEIGHT, World, index } from '../src/world.js';

/** A world with one empty chunk at (0, 0) we can fill by hand. */
function emptyWorld() {
  const w = new World(1);
  const data = new Uint8Array(CHUNK * CHUNK * HEIGHT);
  const c = { cx: 0, cz: 0, key: '0,0', data, dirty: true };
  w.chunks.set('0,0', c);
  return { w, c, set: (x, y, z, id) => { data[index(x, y, z)] = id; } };
}

const quads = buf => buf.indices.length / 6;

test('face winding is counter-clockwise from outside', () => {
  for (const f of FACES) {
    const [a, b, c] = f.corners;
    const u = b.map((v, i) => v - a[i]);
    const v = c.map((x, i) => x - a[i]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]].map(x => x + 0); // no -0
    assert.deepEqual(n, f.n);
  }
});

test('visibility rules', () => {
  assert.equal(faceVisible(B.STONE, B.AIR), true);
  assert.equal(faceVisible(B.STONE, B.DIRT), false);
  assert.equal(faceVisible(B.STONE, B.GLASS), true, 'see-through neighbours show the face');
  assert.equal(faceVisible(B.STONE, B.WATER), true);
  assert.equal(faceVisible(B.WATER, B.WATER), false, 'no faces inside a body of water');
  assert.equal(faceVisible(B.GLASS, B.GLASS), false);
  assert.equal(faceVisible(B.WATER, B.STONE), false);
  assert.equal(faceVisible(B.AIR, B.STONE), false);
});

test('a lone block has 6 faces; two touching blocks hide the shared pair', () => {
  const { w, c, set } = emptyWorld();
  set(5, 10, 5, B.STONE);
  assert.equal(quads(buildChunkMesh(w, c).opaque), 6);
  set(6, 10, 5, B.STONE);
  const m = buildChunkMesh(w, c);
  assert.equal(quads(m.opaque), 10);
  assert.equal(m.opaque.positions.length / 3, 40);
  assert.equal(m.opaque.colors.length, m.opaque.positions.length);
  assert.equal(quads(m.transparent), 0);
});

test('transparent blocks go to the transparent buffers with alpha; water lowers its surface', () => {
  const { w, c, set } = emptyWorld();
  set(2, 5, 2, B.WATER);
  set(2, 6, 2, B.WATER);
  const m = buildChunkMesh(w, c);
  assert.equal(quads(m.opaque), 0);
  // 2 stacked water blocks: 4 sides each + top + bottom, no face between them.
  assert.equal(quads(m.transparent), 10);
  assert.equal(m.transparent.colors.length / 4, m.transparent.positions.length / 3);
  assert.ok(Math.abs(m.transparent.colors[3] - block(B.WATER).alpha) < 1e-6);
  const ys = [];
  for (let i = 1; i < m.transparent.positions.length; i += 3) ys.push(m.transparent.positions[i]);
  assert.ok(Math.abs(Math.max(...ys) - 6.875) < 1e-6, 'top water surface sits a little low');
});

test('corners next to blocks are darker (ambient occlusion)', () => {
  const { w, c, set } = emptyWorld();
  set(5, 10, 5, B.STONE);
  const lone = buildChunkMesh(w, c).opaque;
  const brightest = Math.max(...lone.colors);
  set(4, 11, 5, B.STONE); // a block beside the top face's -x edge
  const m = buildChunkMesh(w, c).opaque;
  // The top face of (5,10,5): the quad whose 4 corners are all at y = 11 within x, z in [5, 6].
  let top = [];
  for (let q = 0; q < m.positions.length / 12; q++) {
    const verts = [0, 1, 2, 3].map(k => {
      const v = q * 4 + k;
      const [x, y, z] = m.positions.slice(v * 3, v * 3 + 3);
      return { x, y, z, g: m.colors[v * 3 + 1] };
    });
    if (verts.every(p => p.y === 11 && p.x >= 5 && p.x <= 6 && p.z >= 5 && p.z <= 6)) top = verts;
  }
  assert.equal(top.length, 4);
  const dark = top.filter(t => t.x === 5).map(t => t.g);
  const light = top.filter(t => t.x === 6).map(t => t.g);
  assert.ok(Math.max(...dark) < Math.min(...light), 'corners on the occluded edge are darker');
  assert.ok(Math.max(...light) <= brightest + 1e-6);
});

test('faces on the chunk border read the neighbouring chunk', () => {
  const { w, c, set } = emptyWorld();
  set(CHUNK - 1, 10, 3, B.STONE);
  assert.equal(quads(buildChunkMesh(w, c).opaque), 6);
  const nb = { cx: 1, cz: 0, key: '1,0', data: new Uint8Array(CHUNK * CHUNK * HEIGHT), dirty: true };
  nb.data[index(0, 10, 3)] = B.STONE;
  w.chunks.set('1,0', nb);
  assert.equal(quads(buildChunkMesh(w, c).opaque), 5, '+x face is hidden by the neighbour');
});

test('a generated chunk meshes to sane buffers', () => {
  const w = new World(1234);
  for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) w.ensure(x, z);
  const t = performance.now();
  const m = buildChunkMesh(w, w.chunk(0, 0));
  const ms = performance.now() - t;
  assert.ok(quads(m.opaque) > 256, 'at least one face per column');
  for (const v of m.opaque.positions) assert.ok(Number.isFinite(v));
  for (const i of m.opaque.indices) assert.ok(i < m.opaque.positions.length / 3);
  for (const v of m.opaque.colors) assert.ok(v >= 0 && v <= 1.1);
  assert.ok(ms < 200, `meshing took ${ms.toFixed(1)}ms`);
});
