import { test } from 'node:test';
import assert from 'node:assert/strict';
import { B, BLOCKS, HOTBAR, block, rgb, css } from '../src/blocks.js';

test('every id has a definition in index order', () => {
  for (const [name, id] of Object.entries(B)) {
    assert.equal(BLOCKS[id].id, id, name);
  }
  assert.equal(BLOCKS.length, Object.keys(B).length);
});

test('flags are consistent', () => {
  for (const b of BLOCKS) {
    if (b.id === B.AIR) continue;
    for (const face of ['top', 'side', 'bottom']) assert.equal(typeof b[face], 'number', `${b.name}.${face}`);
    // An opaque block is never see-through, and a see-through block never hides its neighbours.
    if (b.opaque) assert.equal(b.alpha, 1, b.name);
    if (b.alpha < 1) assert.equal(b.opaque, false, b.name);
  }
  assert.equal(block(B.WATER).solid, false);
  assert.equal(block(B.WATER).liquid, true);
  assert.equal(block(B.GLASS).solid, true);
});

test('unknown ids read as air', () => {
  assert.equal(block(255).id, B.AIR);
});

test('the hotbar holds 9 placeable blocks', () => {
  assert.equal(HOTBAR.length, 9);
  assert.ok(!HOTBAR.includes(B.AIR));
});

test('colour helpers', () => {
  assert.deepEqual(rgb(0xff0080), [1, 0, 128 / 255]);
  assert.equal(css(0x808080, 2), 'rgb(255, 255, 255)');
});
