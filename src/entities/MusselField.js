import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createShellGeometry } from './MusselGeometry.js';
import { shellTexture } from '../world/Textures.js';

const Y = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const WHITE = new THREE.Color(1, 1, 1);
const HARMED = new THREE.Color(0.55, 0.55, 0.52);
const DISSOLVE = new THREE.Color(0.85, 1.0, 0.6);

export const SPECIES = ['quagga', 'zebra', 'native'];

/**
 * All bivalves in a level, rendered with one InstancedMesh per species.
 * Each mussel is an "item"; items belong to clusters (used for eDNA + AI boxes).
 */
export class MusselField {
  constructor(rng) {
    this.rng = rng;
    this.group = new THREE.Group();
    this.group.name = 'mussels';
    this.items = [];
    this.clusters = [];
    this.meshes = {};
    this.dirty = new Set();
  }

  /**
   * @param {'quagga'|'zebra'|'native'} species
   * @param {{pos:THREE.Vector3, normal:THREE.Vector3}[]} placements
   * @param {{host?:string, encrusted?:boolean}} opts
   */
  addCluster(species, placements, opts = {}) {
    const rng = this.rng;
    const cluster = {
      id: this.clusters.length,
      species,
      host: opts.host ?? 'rock',
      encrusted: !!opts.encrusted,
      members: [],
      center: new THREE.Vector3(),
      detected: false,
      uncertainSeen: false,
    };
    const spec = CONFIG.mussels[species];
    for (const { pos, normal } of placements) {
      const length = spec.length * (0.75 + rng() * 0.5);
      const quat = new THREE.Quaternion();
      const p = pos.clone();
      if (species === 'native') {
        // Stand partially buried: anterior (umbo) end down, siphons up.
        const up = normal.clone().add(new THREE.Vector3(rng() - 0.5, 0, rng() - 0.5).multiplyScalar(0.7)).normalize();
        quat.setFromUnitVectors(X, up);
        _q.setFromAxisAngle(up, rng() * Math.PI * 2);
        quat.premultiply(_q);
        p.addScaledVector(up, -0.45 * length);
      } else {
        quat.setFromUnitVectors(Y, normal);
        _q.setFromAxisAngle(normal, rng() * Math.PI * 2);
        quat.premultiply(_q);
        const tiltMax = species === 'quagga' ? 0.7 : 0.25;
        _v.set(rng() - 0.5, rng() - 0.5, rng() - 0.5).cross(normal).normalize();
        _q.setFromAxisAngle(_v, (rng() - 0.5) * 2 * tiltMax);
        quat.premultiply(_q);
        p.addScaledVector(normal, 0.015 + rng() * 0.03);
      }
      const hp = spec.hp * (opts.encrusted ? CONFIG.mussels.encrustedMultiplier : 1);
      const tint = 0.82 + rng() * 0.18;
      const item = {
        species,
        cluster,
        index: -1,
        pos: p,
        home: p.clone(),
        quat,
        scale: length,
        hp,
        maxHp: hp,
        state: 'alive', // alive | sucked | dissolving | removed | harmed
        t: 0,
        shake: 0,
        tint: new THREE.Color(tint, tint * (0.97 + rng() * 0.05), tint * (0.95 + rng() * 0.08)),
        exposed: false, // native warning flag for UI
      };
      cluster.members.push(item);
      cluster.center.add(p);
      this.items.push(item);
    }
    cluster.center.divideScalar(Math.max(1, cluster.members.length));
    cluster.radius = cluster.members.reduce((r, m) => Math.max(r, m.pos.distanceTo(cluster.center)), 0) + 0.3;
    this.clusters.push(cluster);
    return cluster;
  }

  build() {
    for (const species of SPECIES) {
      const list = this.items.filter((i) => i.species === species);
      if (!list.length) continue;
      const geo = createShellGeometry(species);
      const mat = new THREE.MeshStandardMaterial({
        map: shellTexture(species),
        roughness: species === 'native' ? 0.75 : 0.55,
        metalness: 0.0,
      });
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      mesh.name = `mussels-${species}`;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      list.forEach((item, i) => {
        item.index = i;
        this.writeMatrix(mesh, item);
        mesh.setColorAt(i, item.tint);
      });
      mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.frustumCulled = false;
      this.meshes[species] = mesh;
      this.group.add(mesh);
    }
  }

  writeMatrix(mesh, item, scaleMul = 1) {
    let pos = item.pos;
    if (item.shake > 0) {
      _v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.05);
      pos = _v.add(item.pos);
    }
    const s = item.scale * scaleMul;
    _m.compose(pos, item.quat, _s.set(s, s, s));
    mesh.setMatrixAt(item.index, _m);
  }

  /** Begin vacuum-pull animation toward the nozzle. */
  suck(item) {
    if (item.state !== 'alive') return;
    item.state = 'sucked';
    item.t = 0;
    this.dirty.add(item.species);
  }

  dissolve(item) {
    if (item.state !== 'alive') return;
    item.state = 'dissolving';
    item.t = 0;
    this.dirty.add(item.species);
  }

  harm(item) {
    if (item.state === 'harmed' || item.state === 'removed') return false;
    item.state = 'harmed';
    const mesh = this.meshes[item.species];
    mesh.setColorAt(item.index, HARMED);
    mesh.instanceColor.needsUpdate = true;
    return true;
  }

  update(dt, nozzle) {
    const changedColors = new Set();
    for (const item of this.items) {
      const mesh = this.meshes[item.species];
      if (item.state === 'sucked') {
        item.t = Math.min(1, item.t + dt / 0.45);
        item.pos.lerpVectors(item.home, nozzle, item.t * item.t);
        _q2.setFromAxisAngle(Y, dt * 12);
        item.quat.multiply(_q2);
        this.writeMatrix(mesh, item, 1 - item.t * 0.85);
        if (item.t >= 1) {
          item.state = 'removed';
          this.writeMatrix(mesh, item, 0);
        }
        this.dirty.add(item.species);
      } else if (item.state === 'dissolving') {
        item.t = Math.min(1, item.t + dt / CONFIG.tools.sprayer.dissolveTime);
        _c.copy(item.tint).lerp(DISSOLVE, item.t);
        mesh.setColorAt(item.index, _c);
        changedColors.add(item.species);
        this.writeMatrix(mesh, item, 1 - item.t * item.t);
        if (item.t >= 1) {
          item.state = 'removed';
          this.writeMatrix(mesh, item, 0);
        }
        this.dirty.add(item.species);
      } else if (item.shake > 0) {
        item.shake -= dt;
        this.writeMatrix(mesh, item);
        if (item.shake <= 0) this.writeMatrix(mesh, item);
        this.dirty.add(item.species);
      }
    }
    for (const s of this.dirty) this.meshes[s].instanceMatrix.needsUpdate = true;
    for (const s of changedColors) this.meshes[s].instanceColor.needsUpdate = true;
    this.dirty.clear();
  }

  isAlive(item) {
    return item.state === 'alive';
  }

  count(species, predicate = () => true) {
    let n = 0;
    for (const i of this.items) if (i.species === species && predicate(i)) n++;
    return n;
  }

  aliveInCluster(cluster) {
    let n = 0;
    for (const m of cluster.members) if (m.state === 'alive') n++;
    return n;
  }

  dispose() {
    for (const mesh of Object.values(this.meshes)) {
      mesh.geometry.dispose();
      mesh.material.dispose();
      mesh.dispose?.();
    }
  }
}

export { WHITE };
