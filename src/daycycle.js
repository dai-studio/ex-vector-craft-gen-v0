// Time of day → sky colour, light level and sun / moon directions. No Three.js here.
// t runs 0..1: 0 midnight, 0.25 sunrise, 0.5 noon, 0.75 sunset.

export const DAY_LENGTH = 600; // seconds for a full day
export const START_TIME = 0.3; // a fresh world starts in the morning

const NIGHT = 0x0b1026;
const DAWN = 0xf2a65a;
const DAY = 0x8ec9ff;
const DUSK = 0xf08a4b;

const KEYS = [
  [0.0, NIGHT, 0.3],
  [0.2, NIGHT, 0.3],
  [0.25, DAWN, 0.66],
  [0.32, DAY, 1.0],
  [0.68, DAY, 1.0],
  [0.75, DUSK, 0.66],
  [0.8, NIGHT, 0.3],
  [1.0, NIGHT, 0.3],
];

function mixHex(a, b, k) {
  let out = 0;
  for (const shift of [16, 8, 0]) {
    const ca = (a >> shift) & 255;
    const cb = (b >> shift) & 255;
    out |= Math.round(ca + (cb - ca) * k) << shift;
  }
  return out;
}

export function wrapTime(t) {
  return ((t % 1) + 1) % 1;
}

/** { sky (0xRRGGBB), light (0..1), sunDir, moonDir (unit vectors) } at time `t`. */
export function skyAt(t) {
  t = wrapTime(t);
  let i = 0;
  while (KEYS[i + 1][0] < t) i++;
  const [t0, c0, l0] = KEYS[i];
  const [t1, c1, l1] = KEYS[i + 1];
  const k = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
  const a = (t - 0.25) * Math.PI * 2;
  const len = Math.hypot(Math.cos(a), Math.sin(a), 0.3);
  const sunDir = [Math.cos(a) / len, Math.sin(a) / len, 0.3 / len];
  return {
    sky: mixHex(c0, c1, k),
    light: l0 + (l1 - l0) * k,
    sunDir,
    moonDir: sunDir.map(v => -v),
  };
}

/** "06:30"-style clock for the HUD. */
export function clock(t) {
  const minutes = Math.floor(wrapTime(t) * 24 * 60 + 1e-6) % (24 * 60); // + ε: 06:30 is 389.999… in floats
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
