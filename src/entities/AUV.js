import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { beamTexture, hullTexture } from '../world/Textures.js';
import { clamp, damp } from '../utils/math.js';

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _acc = new THREE.Vector3();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _closest = new THREE.Vector3();
const _ab = new THREE.Vector3();

/** Phantom Bots AUV: procedural mesh, kinematics, battery and hopper state. Forward = −Z. */
export class AUV {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'auv';
    this.model = new THREE.Group();
    this.group.add(this.model);

    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this.yawVel = 0;
    this.thrustLevel = 0;
    this.battery = 100;
    this.hopper = { quagga: 0, zebra: 0 };
    this.emergency = false;

    this.buildModel();
  }

  get position() {
    return this.group.position;
  }

  get hopperCount() {
    return this.hopper.quagga + this.hopper.zebra;
  }

  buildModel() {
    const m = this.model;
    const hullTex = hullTexture().clone();
    hullTex.repeat.set(1.5, 1);
    hullTex.needsUpdate = true;

    const hullMat = new THREE.MeshStandardMaterial({
      map: hullTex,
      metalness: 0.35,
      roughness: 0.28,
    });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.25 });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 2.2,
      metalness: 0.5,
      roughness: 0.2,
    });
    const orangeMat = new THREE.MeshStandardMaterial({ color: 0xf97316, metalness: 0.2, roughness: 0.4 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x075985,
      metalness: 0.95,
      roughness: 0.05,
      transparent: true,
      opacity: 0.85,
    });
    this.materials = [hullMat, darkMat, accentMat, orangeMat, glassMat];

    // Hull
    const hullGeo = new THREE.CapsuleGeometry(0.32, 1.25, 8, 20);
    hullGeo.rotateX(Math.PI / 2);
    m.add(new THREE.Mesh(hullGeo, hullMat));

    // Accent stripes (Phantom violet)
    for (const s of [-1, 1]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 1.1), accentMat);
      stripe.position.set(0.315 * s, 0.05, 0.05);
      m.add(stripe);
    }
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.9), darkMat);
    spine.position.set(0, 0.32, 0.1);
    m.add(spine);

    // Nose dome + camera lens
    const domeGeo = new THREE.SphereGeometry(0.29, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    domeGeo.rotateX(-Math.PI / 2);
    const dome = new THREE.Mesh(domeGeo, glassMat);
    dome.position.z = -0.76;
    m.add(dome);
    const lens = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00b8d4, emissiveIntensity: 2 })
    );
    lens.position.set(0, 0.02, -0.98);
    m.add(lens);

    // Orange tail cone
    const tailGeo = new THREE.ConeGeometry(0.2, 0.35, 16);
    tailGeo.rotateX(Math.PI / 2);
    const tailCone = new THREE.Mesh(tailGeo, orangeMat);
    tailCone.position.z = 1.05;
    m.add(tailCone);

    // Tail fins (cross)
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.34, 0.3), orangeMat);
      fin.position.z = 0.88;
      fin.rotation.z = (i * Math.PI) / 2 + Math.PI / 4;
      fin.translateY(0.3);
      m.add(fin);
    }

    // Side thruster pods
    this.props = [];
    const ductGeo = new THREE.TorusGeometry(0.15, 0.035, 10, 24);
    const bladeGeo = new THREE.BoxGeometry(0.26, 0.04, 0.01);
    for (const s of [-1, 1]) {
      const pod = new THREE.Group();
      pod.position.set(0.56 * s, -0.02, 0.38);
      pod.add(new THREE.Mesh(ductGeo, darkMat));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.012, 6, 24), accentMat);
      ring.position.z = -0.03;
      pod.add(ring);
      const prop = new THREE.Group();
      for (let b = 0; b < 3; b++) {
        const blade = new THREE.Mesh(bladeGeo, hullMat);
        blade.rotation.z = (b * Math.PI * 2) / 3;
        prop.add(blade);
      }
      pod.add(prop);
      this.props.push(prop);
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.1), darkMat);
      strut.position.x = -0.2 * s;
      pod.add(strut);
      m.add(pod);
    }

    // Vertical thrusters
    for (const z of [-0.35, 0.55]) {
      const vt = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.022, 8, 18), darkMat);
      vt.rotation.x = Math.PI / 2;
      vt.position.set(0, 0.3, z);
      m.add(vt);
    }

    // Tool nozzle under the nose
    const nozzleGeo = new THREE.CylinderGeometry(0.05, 0.09, 0.45, 14);
    nozzleGeo.rotateX(Math.PI / 2);
    const nozzle = new THREE.Mesh(nozzleGeo, darkMat);
    nozzle.position.set(0, -0.36, -0.72);
    m.add(nozzle);
    this.nozzleTip = new THREE.Object3D();
    this.nozzleTip.position.set(0, -0.36, -0.98);
    m.add(this.nozzleTip);
    this.nozzleGlow = new THREE.Mesh(
      new THREE.CircleGeometry(0.045, 16),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.0 })
    );
    this.nozzleGlow.position.set(0, -0.36, -0.951);
    this.nozzleGlow.rotation.y = Math.PI;
    m.add(this.nozzleGlow);

    // Headlights: real spot lights + additive fake volumetric beams
    this.lights = [];
    this.beams = [];
    const beamGeo = new THREE.ConeGeometry(1.5, 7.5, 24, 1, true);
    beamGeo.translate(0, -3.75, 0);
    beamGeo.rotateX(Math.PI / 2);
    for (const s of [-1, 1]) {
      const housingGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.2, 14);
      housingGeo.rotateX(Math.PI / 2);
      const housing = new THREE.Mesh(housingGeo, darkMat);
      housing.position.set(0.36 * s, -0.1, -0.5);
      m.add(housing);
      const lamp = new THREE.Mesh(
        new THREE.CircleGeometry(0.06, 16),
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: 0xffedd5,
          emissiveIntensity: 4.0,
          roughness: 0.1,
        })
      );
      lamp.position.set(0.36 * s, -0.1, -0.601);
      lamp.rotation.y = Math.PI;
      m.add(lamp);

      const spot = new THREE.SpotLight(0xfff1d6, 90, 32, 0.42, 0.55, 1.6);
      spot.position.set(0.36 * s, -0.1, -0.62);
      spot.target.position.set(0.9 * s, -2.2, -12);
      m.add(spot, spot.target);
      this.lights.push(spot);

      const beam = new THREE.Mesh(
        beamGeo,
        new THREE.MeshBasicMaterial({
          map: beamTexture(), color: 0xfff1d6, transparent: true, opacity: 0.15,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
        })
      );
      beam.position.copy(spot.position);
      beam.lookAt(new THREE.Vector3().copy(spot.target.position));
      beam.rotateY(Math.PI); // geometry opens toward −Z; lookAt points +Z
      m.add(beam);
      this.beams.push(beam);
    }

    // Twin scientific laser scale dots (Green 532nm calibration lasers)
    for (const s of [-1, 1]) {
      const laser = new THREE.Mesh(
        new THREE.SphereGeometry(0.015, 8, 6),
        new THREE.MeshStandardMaterial({
          color: 0x4ade80,
          emissive: 0x22c55e,
          emissiveIntensity: 4.5,
        })
      );
      laser.position.set(0.12 * s, -0.12, -0.86);
      m.add(laser);
    }

    // Status LED
    this.led = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x22ff88, emissive: 0x10b981, emissiveIntensity: 2.5 })
    );
    this.led.position.set(0, 0.36, 0.5);
    m.add(this.led);

    // Enable castShadow across all solid AUV parts
    m.traverse((o) => {
      if (o.isMesh && o.material && !o.material.transparent) {
        o.castShadow = true;
      }
    });
  }

  reset(spawn) {
    this.group.position.set(spawn.x, spawn.y, spawn.z);
    this.velocity.set(0, 0, 0);
    this.yaw = spawn.yaw ?? 0;
    this.pitch = 0;
    this.roll = 0;
    this.yawVel = 0;
    this.battery = 100;
    this.hopper.quagga = 0;
    this.hopper.zebra = 0;
    this.emergency = false;
    this.applyRotation();
  }

  /** Orientation used for steering and the camera (no roll). */
  getLookQuaternion(target = new THREE.Quaternion()) {
    _e.set(this.pitch, this.yaw, 0, 'YXZ');
    return target.setFromEuler(_e);
  }

  getForward(target = new THREE.Vector3()) {
    return target.set(0, 0, -1).applyQuaternion(this.getLookQuaternion(_q));
  }

  getNozzleWorld(target = new THREE.Vector3()) {
    return this.nozzleTip.getWorldPosition(target);
  }

  drain(amount) {
    this.battery = Math.max(0, this.battery - amount);
  }

  applyRotation() {
    _e.set(this.pitch, this.yaw, this.roll, 'YXZ');
    this.group.quaternion.setFromEuler(_e);
  }

  /**
   * @param {number} dt
   * @param {{surge:number, sway:number, heave:number, yaw:number, pitch:number, lookX:number, lookY:number}} c
   * @param {{heightAt:Function, colliders:Array, bounds:number}} world
   */
  update(dt, c, world) {
    const cfg = CONFIG.auv;
    if (this.emergency) {
      // Emergency ascent: no control
      this.velocity.multiplyScalar(Math.exp(-2 * dt));
      this.velocity.y = Math.min(this.velocity.y + dt * 2, 1.5);
      this.group.position.addScaledVector(this.velocity, dt);
      this.group.position.y = Math.min(this.group.position.y, cfg.ceiling);
      this.pitch += (0.35 - this.pitch) * damp(2, dt);
      this.roll += (0 - this.roll) * damp(2, dt);
      this.applyRotation();
      return;
    }

    // Rotation (keyboard rates + mouse/touch deltas)
    const yawInput = c.yaw * cfg.yawRate * dt + c.lookX;
    this.yaw -= yawInput;
    this.pitch = clamp(this.pitch - (c.pitch * cfg.pitchRate * dt + c.lookY), -cfg.maxPitch, cfg.maxPitch);
    this.yawVel += ((yawInput / Math.max(dt, 1e-4)) - this.yawVel) * damp(6, dt);

    // Thrust in look frame: surge follows camera pitch ("fly where you look")
    this.getForward(_fwd);
    _right.set(1, 0, 0).applyAxisAngle(_v.set(0, 1, 0), this.yaw);
    _acc.set(0, 0, 0)
      .addScaledVector(_fwd, c.surge * cfg.thrust)
      .addScaledVector(_right, c.sway * cfg.thrust);
    _acc.y += c.heave * cfg.verticalThrust;

    const power = this.battery > 0 ? 1 : 0.15;
    this.velocity.addScaledVector(_acc, dt * power);
    this.velocity.multiplyScalar(Math.exp(-cfg.drag * dt));
    this.group.position.addScaledVector(this.velocity, dt);

    this.thrustLevel = Math.min(1, Math.hypot(c.surge, c.sway, c.heave));

    // Bank into turns and strafes, then self-level
    const targetRoll = clamp(this.yawVel * 0.28 - c.sway * 0.22, -0.6, 0.6);
    this.roll += (targetRoll - this.roll) * damp(4, dt);

    this.collide(world);
    this.applyRotation();

    // Props
    const spin = (0.6 + this.thrustLevel * 14) * dt * (c.surge < 0 ? -1 : 1);
    for (const p of this.props) p.rotation.z += spin * 6;
  }

  collide(world) {
    const p = this.group.position;
    const r = CONFIG.auv.radius;
    const v = this.velocity;

    for (const col of world.colliders) {
      if (col.type === 'sphere') {
        _v.subVectors(p, col.c);
        const d = _v.length();
        const min = col.r + r;
        if (d < min && d > 1e-5) {
          _v.divideScalar(d);
          p.addScaledVector(_v, min - d);
          const vn = v.dot(_v);
          if (vn < 0) v.addScaledVector(_v, -vn * 1.2);
        }
      } else if (col.type === 'cylinder') {
        if (p.y < col.y0 - r || p.y > col.y1 + r) continue;
        const dx = p.x - col.x, dz = p.z - col.z;
        const d = Math.hypot(dx, dz);
        const min = col.r + r;
        if (d < min && d > 1e-5) {
          const nx = dx / d, nz = dz / d;
          p.x += nx * (min - d);
          p.z += nz * (min - d);
          const vn = v.x * nx + v.z * nz;
          if (vn < 0) { v.x -= vn * nx * 1.2; v.z -= vn * nz * 1.2; }
        }
      } else if (col.type === 'capsule') {
        _ab.subVectors(col.b, col.a);
        const t = clamp(_v.subVectors(p, col.a).dot(_ab) / _ab.lengthSq(), 0, 1);
        _closest.copy(col.a).addScaledVector(_ab, t);
        _v.subVectors(p, _closest);
        const d = _v.length();
        const min = col.r + r;
        if (d < min && d > 1e-5) {
          _v.divideScalar(d);
          p.addScaledVector(_v, min - d);
          const vn = v.dot(_v);
          if (vn < 0) v.addScaledVector(_v, -vn * 1.2);
        }
      } else if (col.type === 'box') {
        // Axis-aligned box (dock deck, ramp underside)
        const cx = clamp(p.x, col.min.x, col.max.x);
        const cy = clamp(p.y, col.min.y, col.max.y);
        const cz = clamp(p.z, col.min.z, col.max.z);
        _v.set(p.x - cx, p.y - cy, p.z - cz);
        const d = _v.length();
        if (d < r && d > 1e-5) {
          _v.divideScalar(d);
          p.addScaledVector(_v, r - d);
          const vn = v.dot(_v);
          if (vn < 0) v.addScaledVector(_v, -vn * 1.2);
        }
      }
    }

    // Lakebed and surface
    const floor = world.heightAt(p.x, p.z) + r * 0.8;
    if (p.y < floor) {
      p.y = floor;
      if (v.y < 0) v.y *= -0.2;
    }
    if (p.y > CONFIG.auv.ceiling) {
      p.y = CONFIG.auv.ceiling;
      if (v.y > 0) v.y = 0;
    }
    const b = world.bounds;
    if (Math.abs(p.x) > b) { p.x = Math.sign(p.x) * b; v.x = 0; }
    if (Math.abs(p.z) > b) { p.z = Math.sign(p.z) * b; v.z = 0; }
  }

  setToolGlow(color, intensity) {
    this.nozzleGlow.material.color.set(color);
    this.nozzleGlow.material.opacity = intensity;
  }

  setLed(color) {
    this.led.material.color.set(color);
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        o.material.dispose();
      }
    });
  }
}
