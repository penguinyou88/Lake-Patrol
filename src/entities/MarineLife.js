import * as THREE from 'three';
import { perchTexture } from '../world/Textures.js';

const _v = new THREE.Vector3();
const _dir = new THREE.Vector3();

function buildPerchMesh() {
  const group = new THREE.Group();
  const bodyGeo = new THREE.SphereGeometry(0.5, 20, 14);
  bodyGeo.rotateX(Math.PI / 2); // poles along Z → texture v runs head-to-tail
  bodyGeo.scale(0.32, 0.42, 1.0);
  const mat = new THREE.MeshStandardMaterial({ map: perchTexture(), roughness: 0.45, metalness: 0.1 });
  const body = new THREE.Mesh(bodyGeo, mat);
  group.add(body);

  const finMat = new THREE.MeshStandardMaterial({
    color: 0xc8a050, roughness: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.85,
  });
  const tailShape = new THREE.Shape();
  tailShape.moveTo(0, 0);
  tailShape.lineTo(-0.22, 0.32);
  tailShape.lineTo(0, 0.2);
  tailShape.lineTo(0.22, 0.32);
  tailShape.closePath();
  const tailGeo = new THREE.ShapeGeometry(tailShape);
  tailGeo.rotateX(Math.PI / 2);
  tailGeo.rotateZ(Math.PI / 2);
  const tail = new THREE.Mesh(tailGeo, finMat);
  tail.name = 'tail';
  tail.position.z = 0.45;
  group.add(tail);

  const dorsalShape = new THREE.Shape();
  dorsalShape.moveTo(0, 0);
  dorsalShape.lineTo(0.12, 0.16);
  dorsalShape.lineTo(0.42, 0.06);
  dorsalShape.lineTo(0.46, 0);
  dorsalShape.closePath();
  const dorsal = new THREE.Mesh(new THREE.ShapeGeometry(dorsalShape), new THREE.MeshStandardMaterial({
    color: 0x4a4020, side: THREE.DoubleSide, roughness: 0.7,
  }));
  dorsal.rotation.y = -Math.PI / 2;
  dorsal.position.set(0, 0.17, -0.18);
  group.add(dorsal);

  // Eyes
  const eyeGeo = new THREE.SphereGeometry(0.035, 8, 6);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(0.13 * s, 0.05, -0.36);
    group.add(eye);
  }
  group.userData.tail = tail;
  group.userData.materials = [mat, finMat];
  return group;
}

/** Schools of native yellow perch swimming looping paths and fleeing the AUV. */
export class MarineLife {
  constructor(rng) {
    this.rng = rng;
    this.group = new THREE.Group();
    this.group.name = 'fish';
    this.fish = [];
    this.template = buildPerchMesh();
  }

  addSchool(center, count, radius = 6) {
    const rng = this.rng;
    const school = {
      center: center.clone(),
      radiusX: radius * (0.8 + rng() * 0.6),
      radiusZ: radius * (0.8 + rng() * 0.6),
      speed: 0.12 + rng() * 0.08,
      phase: rng() * Math.PI * 2,
      dir: rng() < 0.5 ? 1 : -1,
    };
    for (let i = 0; i < count; i++) {
      const mesh = this.template.clone(true);
      // Clone materials per fish so harmed fish can be greyed individually
      const mats = new Map();
      mesh.traverse((o) => {
        if (o.isMesh) {
          if (!mats.has(o.material)) mats.set(o.material, o.material.clone());
          o.material = mats.get(o.material);
        }
      });
      const s = 0.7 + rng() * 0.5;
      mesh.scale.setScalar(s);
      const tail = mesh.getObjectByName('tail');
      const f = {
        mesh,
        tail,
        school,
        offset: new THREE.Vector3((rng() - 0.5) * 2.5, (rng() - 0.5) * 1.2, (rng() - 0.5) * 2.5),
        lag: rng() * 0.6,
        wag: rng() * 10,
        flee: new THREE.Vector3(),
        state: 'alive', // alive | harmed
        harmedT: 0,
        pos: mesh.position,
        radius: 0.35 * s,
      };
      this.fish.push(f);
      this.group.add(mesh);
    }
  }

  harm(f) {
    if (f.state !== 'alive') return false;
    f.state = 'harmed';
    f.mesh.traverse((o) => {
      if (o.isMesh) {
        o.material.color?.multiplyScalar(0.55);
        o.material.emissive?.setRGB(0.05, 0.05, 0.05);
      }
    });
    return true;
  }

  update(dt, time, auvPos, heightAt) {
    for (const f of this.fish) {
      const s = f.school;
      if (f.state === 'harmed') {
        // Drift belly-up toward the surface
        f.harmedT += dt;
        f.mesh.rotation.z = Math.min(Math.PI, f.mesh.rotation.z + dt * 2);
        f.mesh.position.y = Math.min(-0.4, f.mesh.position.y + dt * 0.25);
        continue;
      }
      const t = time * s.speed * s.dir + s.phase - f.lag;
      _v.set(
        s.center.x + Math.sin(t) * s.radiusX,
        s.center.y + Math.sin(t * 2.0) * 0.8,
        s.center.z + Math.cos(t) * s.radiusZ
      ).add(f.offset);

      // Flee the AUV
      const d = _dir.subVectors(f.mesh.position, auvPos);
      const dist = d.length();
      if (dist < 4.5) f.flee.addScaledVector(d.normalize(), (4.5 - dist) * dt * 2.5);
      f.flee.multiplyScalar(Math.exp(-dt * 0.8));
      _v.add(f.flee);

      const floor = heightAt(_v.x, _v.z) + 0.8;
      if (_v.y < floor) _v.y = floor;
      if (_v.y > -0.8) _v.y = -0.8;

      const prev = f.mesh.position.clone();
      f.mesh.position.lerp(_v, 1 - Math.exp(-dt * 3));
      const vel = _dir.subVectors(f.mesh.position, prev);
      if (vel.lengthSq() > 1e-7) {
        const target = _v.copy(f.mesh.position).add(vel);
        f.mesh.lookAt(target);
        f.mesh.rotateY(Math.PI); // model faces −Z
      }
      f.wag += dt * (8 + vel.length() * 60);
      if (f.tail) {
        f.tail.rotation.y = Math.sin(f.wag) * 0.45;
      }
    }
  }

  aliveCount() {
    return this.fish.filter((f) => f.state === 'alive').length;
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.isMesh) {
        o.material.dispose();
      }
    });
    this.template.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        o.material.dispose();
      }
    });
  }
}
