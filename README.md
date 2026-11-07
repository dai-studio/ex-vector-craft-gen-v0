# Vector Craft

An original voxel sandbox in plain HTML and Three.js: flat "vector" colours,
endless seeded terrain with hills, beaches, lakes and trees, a day/night cycle,
and blocks you can break and place. No build step.

## Run

```sh
npm run serve        # python3 -m http.server 8080
# open http://localhost:8080
```

Any static file server works; ES modules need `http://`, not `file://`.
Three.js 0.160.0 loads from cdn.jsdelivr.net through the import map in `index.html`.

`?seed=1234` opens (or starts) the world for that seed. The world, your edits and
where you stood are saved in this browser's localStorage; **New world** on the
start screen clears them.

## Controls

| Input | Action |
|---|---|
| Mouse | Look |
| W A S D | Move |
| Space | Jump / swim up / fly up |
| Shift | Sprint / fly down |
| F | Toggle flying |
| Left click | Break block (hold to repeat) |
| Right click | Place block (hold to repeat) |
| 1-9 / wheel | Choose block |
| Esc | Release the mouse |

## Code

| File | Does |
|---|---|
| `src/blocks.js` | Block ids, flags and colours |
| `src/noise.js` | Seeded simplex noise, fbm, hashing |
| `src/world.js` | 16×16×64 chunks, terrain generation, get/set block, edits |
| `src/mesher.js` | Chunk → buffers: face culling, flat shading, ambient occlusion |
| `src/chunks.js` | Loads, meshes and unloads chunks around the player (Three.js) |
| `src/physics.js` | Player box vs voxels, walking, jumping, swimming, flying |
| `src/player.js` | Pointer lock, keyboard and mouse, camera |
| `src/raycast.js` | Voxel ray walk for the targeted block |
| `src/interact.js` | Target outline, break and place |
| `src/daycycle.js` / `src/sky.js` | Time of day, sky, fog, sun and moon |
| `src/hud.js` | Crosshair, hotbar, info, start screen |
| `src/storage.js` | Save and load in localStorage |
| `src/engine.js` / `src/main.js` | Renderer and loop; wiring |

Everything except `chunks.js`, `sky.js`, `interact.js`, `player.js`, `hud.js`,
`engine.js` and `main.js` is free of Three.js and the DOM, and is unit tested:

```sh
npm test             # node --test (Node 20+)
```

Planned and logged with DAI Studio: `plan.dai` is the build plan, `progress.dai`
the history of the work.
