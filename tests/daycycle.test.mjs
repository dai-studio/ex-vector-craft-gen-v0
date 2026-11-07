import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clock, skyAt, wrapTime } from '../src/daycycle.js';

test('noon is bright and blue, midnight is dark', () => {
  const noon = skyAt(0.5);
  const night = skyAt(0);
  assert.equal(noon.light, 1);
  assert.equal(noon.sky, 0x8ec9ff);
  assert.ok(night.light < 0.4);
  assert.equal(night.sky, 0x0b1026);
});

test('the sun rises in the east, peaks at noon and sets; the moon is opposite', () => {
  assert.ok(Math.abs(skyAt(0.25).sunDir[1]) < 1e-9, 'on the horizon at sunrise');
  assert.ok(skyAt(0.5).sunDir[1] > 0.9, 'high at noon');
  assert.ok(skyAt(0).sunDir[1] < -0.9, 'below at midnight');
  const s = skyAt(0.4);
  assert.ok(Math.abs(Math.hypot(...s.sunDir) - 1) < 1e-9);
  assert.deepEqual(s.moonDir, s.sunDir.map(v => -v));
});

test('light and colour change smoothly', () => {
  let prev = skyAt(0);
  for (let i = 1; i <= 1000; i++) {
    const cur = skyAt(i / 1000);
    assert.ok(Math.abs(cur.light - prev.light) < 0.02, `jump at ${i / 1000}`);
    for (const shift of [16, 8, 0]) {
      assert.ok(Math.abs(((cur.sky >> shift) & 255) - ((prev.sky >> shift) & 255)) <= 12, `colour jump at ${i / 1000}`);
    }
    prev = cur;
  }
});

test('time wraps and reads as a clock', () => {
  assert.equal(wrapTime(1.25), 0.25);
  assert.equal(wrapTime(-0.25), 0.75);
  assert.equal(clock(0.5), '12:00');
  assert.equal(clock(0.25 + 1 / 48), '06:30');
  assert.equal(clock(1), '00:00');
});
