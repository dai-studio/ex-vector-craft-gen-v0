// Block registry: ids, flags and flat "vector" colours (top / side / bottom).
// No Three.js here, so it runs under node --test.

export const B = Object.freeze({
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WATER: 5,
  WOOD: 6, LEAVES: 7, PLANK: 8, GLASS: 9,
});

/**
 * solid: blocks movement. opaque: hides the faces of blocks next to it.
 * alpha < 1: drawn in the transparent pass. liquid: can be swum in.
 */
const DEFS = [
  { id: B.AIR,    name: 'Air',    solid: false, opaque: false, alpha: 0 },
  { id: B.GRASS,  name: 'Grass',  solid: true,  opaque: true,  alpha: 1, top: 0x7ccf54, side: 0x9a7348, bottom: 0x8a6440 },
  { id: B.DIRT,   name: 'Dirt',   solid: true,  opaque: true,  alpha: 1, top: 0x9a7348, side: 0x8f6a42, bottom: 0x80603c },
  { id: B.STONE,  name: 'Stone',  solid: true,  opaque: true,  alpha: 1, top: 0x9aa1ab, side: 0x8b929c, bottom: 0x7d848e },
  { id: B.SAND,   name: 'Sand',   solid: true,  opaque: true,  alpha: 1, top: 0xf0dc9b, side: 0xe6cf8a, bottom: 0xd9c27e },
  { id: B.WATER,  name: 'Water',  solid: false, opaque: false, alpha: 0.8, liquid: true, top: 0x2f86d4, side: 0x2874bd, bottom: 0x2266a8 },
  { id: B.WOOD,   name: 'Wood',   solid: true,  opaque: true,  alpha: 1, top: 0xc9a46a, side: 0x7a5232, bottom: 0xc9a46a },
  { id: B.LEAVES, name: 'Leaves', solid: true,  opaque: true,  alpha: 1, top: 0x3fa35a, side: 0x37944f, bottom: 0x318547 },
  { id: B.PLANK,  name: 'Plank',  solid: true,  opaque: true,  alpha: 1, top: 0xd8a965, side: 0xcc9c58, bottom: 0xbd8f4f },
  { id: B.GLASS,  name: 'Glass',  solid: true,  opaque: false, alpha: 0.35, top: 0xd6f1ff, side: 0xc4e8fb, bottom: 0xb8def2 },
];

export const BLOCKS = DEFS.map(d => Object.freeze({ liquid: false, ...d }));

export function block(id) {
  return BLOCKS[id] ?? BLOCKS[B.AIR];
}

/** Blocks the player can pick in the hotbar, in order. */
export const HOTBAR = [B.GRASS, B.DIRT, B.STONE, B.SAND, B.WOOD, B.PLANK, B.LEAVES, B.GLASS, B.WATER];

/** Colour for a face: 'top', 'side' or 'bottom'. */
export function faceColor(id, face) {
  return block(id)[face];
}

/** 0xRRGGBB → [r, g, b] in 0..1. */
export function rgb(hex) {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}

/** CSS colour for UI swatches. */
export function css(hex, k = 1) {
  const [r, g, b] = rgb(hex).map(c => Math.round(Math.min(1, c * k) * 255));
  return `rgb(${r}, ${g}, ${b})`;
}
