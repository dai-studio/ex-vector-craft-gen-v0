// Renderer, camera, resize handling and a fixed-step main loop.
import * as THREE from 'three';

export const STEP = 1 / 60;
const MAX_FRAME = 0.25; // never simulate more than this per frame (tab switches)

export function createEngine(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  camera.rotation.order = 'YXZ';

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  /** `update(dt)` runs at a fixed STEP; `frame(dt, alpha)` once per animation frame. */
  function start({ update, frame }) {
    let last = performance.now() / 1000;
    let acc = 0;
    function tick() {
      const now = performance.now() / 1000;
      const dt = Math.min(now - last, MAX_FRAME);
      last = now;
      acc += dt;
      while (acc >= STEP) {
        update(STEP);
        acc -= STEP;
      }
      frame(dt, acc / STEP);
      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  return { THREE, renderer, scene, camera, start };
}
