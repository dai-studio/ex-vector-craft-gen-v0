// Sky colour, distance fog and a flat square sun and moon that follow the camera.
import * as THREE from 'three';
import { CHUNK } from './world.js';
import { skyAt } from './daycycle.js';

const DISTANCE = 400;

function disc(size, color) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ color, fog: false, depthWrite: false, transparent: true }),
  );
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return mesh;
}

export class Sky {
  constructor(scene, camera, radiusChunks) {
    this.camera = camera;
    this.color = new THREE.Color();
    scene.background = this.color;
    this.far = radiusChunks * CHUNK * 0.92;
    // Fog keeps its own copy of the colour, so it is updated alongside the background.
    this.fog = scene.fog = new THREE.Fog(this.color, this.far * 0.5, this.far);
    this.sun = disc(48, 0xfff1b8);
    this.moon = disc(30, 0xe3e9f7);
    scene.add(this.sun, this.moon);
  }

  /** Update for time `t`; returns the light level (0..1) for the world. */
  update(t, underwater = false) {
    const { sky, light, sunDir, moonDir } = skyAt(t);
    if (underwater) {
      this.color.setHex(0x1d5f99).multiplyScalar(0.4 + 0.6 * light);
      this.fog.near = 0.5;
      this.fog.far = 18;
    } else {
      this.color.setHex(sky);
      this.fog.near = this.far * 0.5;
      this.fog.far = this.far;
    }
    this.fog.color.copy(this.color);
    const p = this.camera.position;
    for (const [mesh, dir] of [[this.sun, sunDir], [this.moon, moonDir]]) {
      mesh.position.set(p.x + dir[0] * DISTANCE, p.y + dir[1] * DISTANCE, p.z + dir[2] * DISTANCE);
      mesh.lookAt(p);
      // Fade out below the horizon.
      mesh.material.opacity = Math.max(0, Math.min(1, dir[1] * 6 + 0.6));
      mesh.visible = mesh.material.opacity > 0;
    }
    return light;
  }
}
