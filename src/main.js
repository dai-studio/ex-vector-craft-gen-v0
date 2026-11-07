// Vector Craft: wires the modules together.
import { createEngine } from './engine.js';
import { HEIGHT, WATER_LEVEL, World, terrainHeight, toChunk } from './world.js';
import { ChunkRenderer } from './chunks.js';
import { Player } from './player.js';
import { Interaction } from './interact.js';
import { Hud } from './hud.js';
import { Sky } from './sky.js';
import { DAY_LENGTH, START_TIME, clock } from './daycycle.js';
import { clear, load, save } from './storage.js';
import { HOTBAR } from './blocks.js';

const RADIUS = 6; // chunks
const SAVE_EVERY = 5000; // ms

// ── World ──────────────────────────────────────────────────────────────────
const params = new URLSearchParams(location.search);
const askedSeed = params.has('seed') ? Number(params.get('seed')) | 0 : null;
let saved = load();
if (saved && askedSeed !== null && saved.seed !== askedSeed) saved = null; // ?seed= asks for another world
const seed = saved?.seed ?? askedSeed ?? (Math.random() * 2 ** 31) | 0;
const world = new World(seed, saved?.edits ?? new Map());

const canvas = document.getElementById('game');
const engine = createEngine(canvas);
const { scene, camera } = engine;
const chunks = new ChunkRenderer(scene, world, { radius: RADIUS });
const sky = new Sky(scene, camera, RADIUS);
const player = new Player(camera, canvas);
const interaction = new Interaction(scene, canvas, world, player, chunks);
let time = saved?.time ?? START_TIME;

// ── Spawn ──────────────────────────────────────────────────────────────────
/** The nearest dry column to the origin, searching outwards in rings. */
function findSpawn() {
  for (let r = 0; r < 256; r += 4) {
    for (let a = 0; a < 16; a++) {
      const x = Math.round(Math.cos((a / 16) * Math.PI * 2) * r);
      const z = Math.round(Math.sin((a / 16) * Math.PI * 2) * r);
      if (terrainHeight(world.gen, x, z) > WATER_LEVEL + 1) return [x + 0.5, z + 0.5];
      if (r === 0) break;
    }
  }
  return [0.5, 0.5];
}

let needsGround = true; // put the player on the surface once their chunk exists
if (saved?.player) {
  const { pos, yaw, pitch, flying } = saved.player;
  player.place(pos[0], pos[1], pos[2], yaw, pitch);
  player.body.flying = flying;
  needsGround = false;
} else {
  const [x, z] = findSpawn();
  player.place(x, HEIGHT, z, Math.PI * 0.75, -0.15);
}

function respawn() {
  const [x, z] = findSpawn();
  player.place(x, HEIGHT, z, player.yaw, 0);
  player.body.flying = false;
  needsGround = true;
  player.frozen = true;
}

// ── HUD ────────────────────────────────────────────────────────────────────
let resetting = false;
const hud = new Hud(document.getElementById('hud'), {
  onPlay: () => player.lock(),
  onNewWorld: () => {
    resetting = true;
    clear();
    location.href = location.pathname;
  },
  onSelect: id => { interaction.selected = id; },
});
hud.select(saved?.selected ?? 0);
document.addEventListener('pointerlockchange', () => hud.showOverlay(!player.locked));

// ── Saving ─────────────────────────────────────────────────────────────────
function persist() {
  if (resetting) return;
  save({
    seed,
    edits: world.edits,
    player: { pos: player.body.pos, yaw: player.yaw, pitch: player.pitch, flying: player.body.flying },
    time,
    selected: hud.index,
  });
}
let saveTimer = null;
world.onEdit = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 800);
};
setInterval(persist, SAVE_EVERY);
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
window.addEventListener('pagehide', persist);

// ── Loop ───────────────────────────────────────────────────────────────────
let fps = 0;
let frames = 0;
let fpsClock = 0;

engine.start({
  update(dt) {
    if (player.frozen) {
      const [x, , z] = player.body.pos;
      if (world.chunk(toChunk(x), toChunk(z))) {
        if (needsGround) player.body.pos[1] = world.surfaceY(Math.floor(x), Math.floor(z));
        needsGround = false;
        player.frozen = false;
      }
    }
    player.update(world, dt);
    if (player.body.pos[1] < -32) respawn();
    time += dt / DAY_LENGTH;
  },
  frame(dt) {
    chunks.update(player.body.pos[0], player.body.pos[2]);
    player.syncCamera();
    chunks.setLight(sky.update(time, player.body.headInWater));
    interaction.update(dt);

    frames++;
    fpsClock += dt;
    if (fpsClock >= 0.5) { fps = Math.round(frames / fpsClock); frames = 0; fpsClock = 0; }
    const [x, y, z] = player.body.pos.map(v => Math.floor(v));
    const { loaded, meshed } = chunks.stats;
    const mode = player.body.flying ? 'flying' : player.body.inWater ? 'swimming' : '';
    hud.setInfo(
      `${fps} fps   ${clock(time)}   seed ${seed}\n` +
      `x ${x}  y ${y}  z ${z}   ${mode}\n` +
      `chunks ${meshed} drawn / ${loaded} loaded` +
      (player.frozen ? '\nloading terrain…' : ''),
    );
  },
});

// Handy in the console when testing.
window.vectorCraft = { world, player, chunks, persist, HOTBAR };
