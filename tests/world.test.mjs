import { test } from 'node:test';
import assert from 'node:assert/strict';
import { B } from '../src/blocks.js';
import { createNoise2D, fbm, hash2 } from '../src/noise.js';
import { CHUNK, HEIGHT, WATER_LEVEL, World, createGenerator, generateChunk, index, terrainHeight } from '../src/world.js';

test('noise is seeded, bounded and smooth', () => {
  const a = createNoise2D(7);
  const b = createNoise2D(7);
  const c = createNoise2D(8);
  let differs = false;
  for (let i = 0; i < 500; i++) {
    const x = i * 0.37;
    const y = i * 0.11;
    assert.equal(a(x, y), b(x, y));
    if (a(x, y) !== c(x, y)) differs = true;
    assert.ok(Math.abs(a(x, y)) <= 1.2, `out of range at ${x},${y}`);
    assert.ok(Math.abs(a(x, y) - a(x + 0.001, y)) < 0.05, 'not smooth');
    assert.ok(Math.abs(fbm(a, x, y)) <= 1.2);
  }
  assert.ok(differs, 'different seeds should differ');
  assert.equal(hash2(1, 2, 3), hash2(1, 2, 3));
  assert.notEqual(hash2(1, 2, 3), hash2(1, 3, 2));
});

test('chunks are deterministic per seed', () => {
  const g = createGenerator(42);
  assert.deepEqual(generateChunk(g, 3, -2), generateChunk(createGenerator(42), 3, -2));
  assert.notDeepEqual(generateChunk(g, 0, 0), generateChunk(createGenerator(43), 0, 0));
});

test('columns are layered: stone, then dirt/sand, then a grass or sand top; water fills to sea level', () => {
  const g = createGenerator(1234);
  let sawWater = false;
  let sawGrass = false;
  for (let cx = -3; cx <= 3; cx++) {
    const data = generateChunk(g, cx, 0);
    for (let z = 0; z < CHUNK; z++) {
      for (let x = 0; x < CHUNK; x++) {
        const h = terrainHeight(g, cx * CHUNK + x, z);
        assert.ok(h >= 2 && h < HEIGHT - 10);
        assert.equal(data[index(x, 0, z)], B.STONE);
        const top = data[index(x, h, z)];
        assert.ok([B.GRASS, B.SAND, B.STONE].includes(top), `top ${top}`);
        if (top === B.GRASS) sawGrass = true;
        if (h < WATER_LEVEL) {
          sawWater = true;
          assert.equal(data[index(x, WATER_LEVEL, z)], B.WATER);
          assert.equal(data[index(x, WATER_LEVEL + 1, z)], B.AIR);
        }
      }
    }
  }
  assert.ok(sawGrass, 'expected some grass');
  assert.ok(sawWater, 'expected some water over 7 chunks');
});

test('trees grow on grass with a wood trunk under leaves', () => {
  const g = createGenerator(99);
  let trees = 0;
  for (let cx = 0; cx < 6; cx++) {
    for (let cz = 0; cz < 6; cz++) {
      const data = generateChunk(g, cx, cz);
      for (let i = 0; i < data.length; i++) {
        if (data[i] !== B.WOOD) continue;
        const below = data[i - CHUNK * CHUNK];
        if (below === B.GRASS) trees++;
        assert.ok([B.GRASS, B.WOOD].includes(below), 'trunk must stand on grass or wood');
      }
    }
  }
  assert.ok(trees > 3, `expected some trees, got ${trees}`);
});

test('getBlock and setBlock work across chunk borders, including negative coordinates', () => {
  const w = new World(5);
  for (let cx = -1; cx <= 0; cx++) for (let cz = -1; cz <= 0; cz++) w.ensure(cx, cz);
  for (const c of w.chunks.values()) c.dirty = false;

  assert.equal(w.getBlock(0, -1, 0), B.STONE);
  assert.equal(w.getBlock(0, HEIGHT, 0), B.AIR);
  assert.equal(w.getBlock(500, 30, 500), B.AIR, 'unloaded reads as air');

  assert.ok(w.setBlock(-1, 60, -1, B.GLASS));
  assert.equal(w.getBlock(-1, 60, -1), B.GLASS);
  assert.equal(w.chunk(-1, -1).data[index(CHUNK - 1, 60, CHUNK - 1)], B.GLASS);
  // An edit on a border marks the neighbours across it dirty.
  assert.equal(w.chunk(-1, -1).dirty, true);
  assert.equal(w.chunk(0, -1).dirty, true);
  assert.equal(w.chunk(-1, 0).dirty, true);
  assert.equal(w.chunk(0, 0).dirty, false);

  assert.equal(w.setBlock(-1, 60, -1, B.GLASS), false, 'no-op edits are ignored');
  assert.equal(w.setBlock(0, HEIGHT, 0, B.STONE), false);
  assert.equal(w.setBlock(999, 10, 999, B.STONE), false, 'unloaded chunks are not edited');
});

test('edits survive unloading and are reported', () => {
  const w = new World(5);
  w.ensure(0, 0);
  const seen = [];
  w.onEdit = (...a) => seen.push(a);
  const y = w.surfaceY(4, 4);
  w.setBlock(4, y, 4, B.PLANK);
  assert.deepEqual(seen, [[4, y, 4, B.PLANK]]);
  assert.equal(w.surfaceY(4, 4), y + 1);
  w.unload(0, 0);
  assert.equal(w.getBlock(4, y, 4), B.AIR);
  w.ensure(0, 0);
  assert.equal(w.getBlock(4, y, 4), B.PLANK);
});
