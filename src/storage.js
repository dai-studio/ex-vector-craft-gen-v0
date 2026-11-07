// Save and load the world in localStorage: the seed plus player edits (the
// terrain itself is regenerated from the seed), and where the player was.
// Storage can be missing or throw (private windows, blocked site data), so
// every access is guarded and the game runs without it.

export const KEY = 'vector-craft:v1';

function defaultStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/** Game state → a JSON-safe object. `edits` is Map<chunkKey, Map<index, id>>. */
export function serialize({ seed, edits, player, time, selected }) {
  const e = {};
  for (const [key, m] of edits) if (m.size) e[key] = [...m];
  return { v: 1, seed, edits: e, player, time, selected };
}

const isNum = v => typeof v === 'number' && Number.isFinite(v);

/** The inverse of serialize; null if the data isn't a save we understand. */
export function deserialize(o) {
  if (!o || o.v !== 1 || !isNum(o.seed)) return null;
  const edits = new Map();
  for (const [key, pairs] of Object.entries(o.edits ?? {})) {
    if (!/^-?\d+,-?\d+$/.test(key) || !Array.isArray(pairs)) continue;
    const m = new Map();
    for (const p of pairs) if (Array.isArray(p) && Number.isInteger(p[0]) && Number.isInteger(p[1])) m.set(p[0], p[1]);
    if (m.size) edits.set(key, m);
  }
  const p = o.player;
  const player = p && Array.isArray(p.pos) && p.pos.length === 3 && p.pos.every(isNum)
    ? { pos: p.pos, yaw: isNum(p.yaw) ? p.yaw : 0, pitch: isNum(p.pitch) ? p.pitch : 0, flying: !!p.flying }
    : null;
  return {
    seed: o.seed,
    edits,
    player,
    time: isNum(o.time) ? o.time : null,
    selected: Number.isInteger(o.selected) ? o.selected : 0,
  };
}

export function load(storage = defaultStorage()) {
  try {
    const raw = storage?.getItem(KEY);
    return raw ? deserialize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function save(state, storage = defaultStorage()) {
  try {
    if (!storage) return false;
    storage.setItem(KEY, JSON.stringify(serialize(state)));
    return true;
  } catch {
    return false;
  }
}

export function clear(storage = defaultStorage()) {
  try { storage?.removeItem(KEY); } catch { /* nothing to clear */ }
}
