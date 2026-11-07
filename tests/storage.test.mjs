import { test } from 'node:test';
import assert from 'node:assert/strict';
import { B } from '../src/blocks.js';
import { KEY, clear, deserialize, load, save, serialize } from '../src/storage.js';
import { World } from '../src/world.js';

function memoryStorage() {
  const m = new Map();
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m };
}

test('a world round-trips through storage, edits included', () => {
  const store = memoryStorage();
  const w = new World(321);
  w.ensure(0, 0);
  w.ensure(-1, 0);
  const y = w.surfaceY(3, 3);
  w.setBlock(3, y, 3, B.GLASS);
  w.setBlock(-5, 2, 7, B.AIR);
  const state = { seed: 321, edits: w.edits, player: { pos: [3.5, y + 1, 3.5], yaw: 1, pitch: -0.2, flying: true }, time: 0.42, selected: 4 };
  assert.equal(save(state, store), true);

  const back = load(store);
  assert.equal(back.seed, 321);
  assert.deepEqual(back.player, state.player);
  assert.equal(back.time, 0.42);
  assert.equal(back.selected, 4);

  const w2 = new World(back.seed, back.edits);
  w2.ensure(0, 0);
  w2.ensure(-1, 0);
  assert.equal(w2.getBlock(3, y, 3), B.GLASS);
  assert.equal(w2.getBlock(-5, 2, 7), B.AIR);
  assert.deepEqual(w2.chunk(0, 0).data, w.chunk(0, 0).data);
});

test('nothing saved, unreadable or foreign data loads as null', () => {
  assert.equal(load(memoryStorage()), null);
  const s = memoryStorage();
  s.setItem(KEY, '{not json');
  assert.equal(load(s), null);
  assert.equal(deserialize({ v: 2, seed: 1 }), null);
  assert.equal(deserialize({ v: 1, seed: 'x' }), null);
  assert.equal(load(null), null);
});

test('bad entries are dropped, not trusted', () => {
  const d = deserialize({
    v: 1, seed: 5,
    edits: { '0,0': [[1, 2], ['x', 3], [4]], 'evil': [[1, 1]], '2,-3': 'nope' },
    player: { pos: [1, 'two', 3] },
    time: 'noon',
  });
  assert.deepEqual([...d.edits.keys()], ['0,0']);
  assert.deepEqual([...d.edits.get('0,0')], [[1, 2]]);
  assert.equal(d.player, null);
  assert.equal(d.time, null);
});

test('storage that throws never breaks the game', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); }, removeItem() { throw new Error('denied'); } };
  assert.equal(load(broken), null);
  assert.equal(save({ seed: 1, edits: new Map() }, broken), false);
  assert.doesNotThrow(() => clear(broken));
});

test('empty edit maps are not written', () => {
  const edits = new Map([['0,0', new Map()], ['1,1', new Map([[5, B.SAND]])]]);
  assert.deepEqual(serialize({ seed: 1, edits }).edits, { '1,1': [[5, B.SAND]] });
});
