import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { fbm2, smoothstep, noise2 } from '../utils/math.js';
import { sandTexture, sandNormalTexture } from './Textures.js';
import { applyCaustics } from './Caustics.js';

/** Build the analytic height function for a level's lakebed. */
export function makeHeightFn(floor, seed) {
  const { base, amp, freq = 0.03, shore } = floor;
  return (x, z) => {
    let h = base + fbm2(x * freq, z * freq, seed, 4) * amp;
    h += (noise2(x * 0.35, z * 0.35, seed + 5) - 0.5) * 0.25; // small ripples
    if (shore) {
      const along = shore.axis === 'x' ? x : z;
      h += smoothstep(shore.start, shore.end, along * (shore.sign ?? 1)) * shore.rise;
    }
    return h;
  };
}

export function createTerrain(level, heightAt) {
  const { size, segments } = CONFIG.world;
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const seed = level.seed;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
    // Darker silty / algae patches for visual variety
    const patch = smoothstep(0.45, 0.75, noise2(x * 0.05, z * 0.05, seed + 9));
    const algae = smoothstep(0.55, 0.8, noise2(x * 0.11 + 40, z * 0.11, seed + 13)) * (level.floor.algae ?? 0.3);
    colors[i * 3] = 1 - patch * 0.35 - algae * 0.35;
    colors[i * 3 + 1] = 1 - patch * 0.3 - algae * 0.05;
    colors[i * 3 + 2] = 1 - patch * 0.25 - algae * 0.4;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const map = sandTexture(level.floor.sandTint).clone();
  map.repeat.set(size / 5, size / 5);
  map.needsUpdate = true;

  const normalMap = sandNormalTexture().clone();
  normalMap.repeat.set(size / 4, size / 4);
  normalMap.needsUpdate = true;

  const mat = applyCaustics(
    new THREE.MeshStandardMaterial({
      map,
      normalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.02,
    })
  );
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'lakebed';
  mesh.receiveShadow = true;
  return mesh;
}
