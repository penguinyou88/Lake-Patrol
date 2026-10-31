import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { CONFIG } from '../config.js';
import { causticUniforms } from '../world/Caustics.js';
import { particleTexture, beamTexture } from '../world/Textures.js';
import { damp } from '../utils/math.js';

const SNOW_COUNT = 1600;
const SNOW_BOX = 28;
const _offset = new THREE.Vector3();
const _target = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _look = new THREE.Vector3();

/** Renderer, camera rig, lights, soft shadows, post-processing bloom, and realistic underwater atmosphere. */
export class SceneManager {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    // Enable soft PCF shadow maps
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x1b6f86, 0.035);
    this.scene.background = new THREE.Color(0x1b6f86);

    this.camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.05, 220);
    this.cameraMode = 'chase'; // chase | nose
    this.camPos = new THREE.Vector3();

    // Ambient & Directional Sun lighting with shadows
    this.hemi = new THREE.HemisphereLight(0x9fe8ff, 0x1e293b, 1.1);
    this.sun = new THREE.DirectionalLight(0xdff8ff, 2.0);
    this.sun.position.set(25, 55, 15);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.width = 2048;
    this.sun.shadow.mapSize.height = 2048;
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 100;
    this.sun.shadow.camera.left = -30;
    this.sun.shadow.camera.right = 30;
    this.sun.shadow.camera.top = 30;
    this.sun.shadow.camera.bottom = -30;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.radius = 2.0;

    this.scene.add(this.hemi, this.sun, this.sun.target);

    // Underwater environment elements
    this.buildWaterSurface();
    this.buildGodRays();
    this.buildSnow();

    // Post-processing Composer (Unreal-style HDR Bloom)
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.65, // bloom strength
      0.35, // bloom radius
      0.82  // bloom threshold
    );
    this.composer.addPass(this.bloomPass);

    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    window.addEventListener('resize', () => this.resize());
  }

  buildWaterSurface() {
    // Water surface ceiling visible from below at y = -0.05
    const size = 120;
    const geo = new THREE.PlaneGeometry(size, size, 48, 48);
    geo.rotateX(Math.PI / 2); // face downwards

    const mat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.35,
      roughness: 0.1,
      metalness: 0.8,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    });

    this.surfaceMesh = new THREE.Mesh(geo, mat);
    this.surfaceMesh.position.y = -0.05;
    this.scene.add(this.surfaceMesh);
    this.surfaceGeo = geo;
  }

  buildGodRays() {
    // Angled volumetric sun rays streaming through the water column
    this.godRaysGroup = new THREE.Group();
    const rayGeo = new THREE.PlaneGeometry(6, 22);
    const rayMat = new THREE.MeshBasicMaterial({
      map: beamTexture(),
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    for (let i = 0; i < 9; i++) {
      const ray = new THREE.Mesh(rayGeo, rayMat);
      const angle = (i / 9) * Math.PI * 2;
      const r = 8 + (i % 3) * 5;
      ray.position.set(Math.cos(angle) * r, -8, Math.sin(angle) * r);
      ray.rotation.x = 0.28;
      ray.rotation.y = angle + 0.3;
      ray.rotation.z = -0.15;
      this.godRaysGroup.add(ray);
    }

    this.scene.add(this.godRaysGroup);
  }

  buildSnow() {
    const pos = new Float32Array(SNOW_COUNT * 3);
    this.snowDrift = new Float32Array(SNOW_COUNT * 3);
    for (let i = 0; i < SNOW_COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * SNOW_BOX;
      pos[i * 3 + 1] = (Math.random() - 0.5) * SNOW_BOX;
      pos[i * 3 + 2] = (Math.random() - 0.5) * SNOW_BOX;
      this.snowDrift[i * 3] = (Math.random() - 0.5) * 0.08;
      this.snowDrift[i * 3 + 1] = -0.02 - Math.random() * 0.05;
      this.snowDrift[i * 3 + 2] = (Math.random() - 0.5) * 0.08;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.snowMat = new THREE.PointsMaterial({
      size: 0.07, map: particleTexture(), transparent: true, depthWrite: false,
      color: 0xd8f4ff, opacity: 0.55, sizeAttenuation: true,
    });
    this.snow = new THREE.Points(geo, this.snowMat);
    this.snow.frustumCulled = false;
    this.scene.add(this.snow);
  }

  /** Apply per-level water appearance. */
  applyWater(water) {
    const fogColor = new THREE.Color(water.fogColor);
    this.scene.fog.color.copy(fogColor);
    this.scene.fog.density = water.fogDensity;
    this.scene.background.copy(fogColor);
    this.hemi.color.set(water.skyColor ?? 0x9fe8ff);
    this.hemi.groundColor.set(water.groundColor ?? 0x3a3020);
    this.hemi.intensity = water.ambient ?? 1.1;
    this.sun.intensity = water.sun ?? 2.0;
    this.sun.color.set(water.sunColor ?? 0xdff8ff);
    causticUniforms.uCausticStrength.value = water.caustics ?? 0.5;
    this.snowMat.color.set(water.snowColor ?? 0xd8f4ff);
    this.snowMat.opacity = water.snowOpacity ?? 0.55;
    this.snowMat.size = water.snowSize ?? 0.07;
    this.renderer.toneMappingExposure = water.exposure ?? 1.15;
  }

  toggleCamera() {
    this.cameraMode = this.cameraMode === 'chase' ? 'nose' : 'chase';
    return this.cameraMode;
  }

  /** Follow the AUV. */
  updateCamera(dt, auv, heightAt, snap = false) {
    auv.getLookQuaternion(_q);
    if (this.cameraMode === 'chase') {
      _offset.set(0, 1.05, 4.2).applyQuaternion(_q);
      _target.copy(auv.position).add(_offset);
      const floor = heightAt(_target.x, _target.z) + 0.4;
      if (_target.y < floor) _target.y = floor;
      if (_target.y > -0.15) _target.y = -0.15;
      if (snap) this.camPos.copy(_target);
      else this.camPos.lerp(_target, damp(7, dt));
      this.camera.position.copy(this.camPos);
      _look.set(0, 0.2, -6).applyQuaternion(_q).add(auv.position);
      this.camera.lookAt(_look);
      auv.model.visible = true;

      // Update directional sun shadow camera to track AUV position
      this.sun.target.position.set(auv.position.x, auv.position.y, auv.position.z);
      this.sun.position.set(auv.position.x + 22, auv.position.y + 45, auv.position.z + 12);
    } else {
      _offset.set(0, 0.05, -1.1).applyQuaternion(_q);
      this.camera.position.copy(auv.position).add(_offset);
      this.camPos.copy(this.camera.position);
      this.camera.quaternion.copy(auv.group.quaternion);
      auv.model.visible = false;
    }
  }

  /** Slow orbit used behind the title menu. */
  updateOrbit(time, center, heightAt) {
    const r = 16;
    const a = time * 0.05;
    const x = center.x + Math.cos(a) * r;
    const z = center.z + Math.sin(a) * r;
    const y = Math.max(heightAt(x, z) + 3.5, center.y + 2);
    this.camera.position.set(x, Math.min(y, -1), z);
    this.camera.lookAt(center);
  }

  update(dt, time) {
    causticUniforms.uTime.value = time;

    // Animate water surface ripple displacement
    if (this.surfaceGeo) {
      const pos = this.surfaceGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const wave = Math.sin(x * 0.25 + time * 1.8) * Math.cos(z * 0.25 + time * 1.4) * 0.08;
        pos.setY(i, wave);
      }
      pos.needsUpdate = true;
    }

    // Animate god rays shimmering with current
    if (this.godRaysGroup) {
      this.godRaysGroup.rotation.y = time * 0.015;
    }

    // Marine snow follows the camera, wrapping in a box
    const pos = this.snow.geometry.attributes.position;
    const arr = pos.array;
    const c = this.camera.position;
    const half = SNOW_BOX / 2;
    for (let i = 0; i < SNOW_COUNT; i++) {
      const k = i * 3;
      arr[k] += this.snowDrift[k] * dt;
      arr[k + 1] += this.snowDrift[k + 1] * dt;
      arr[k + 2] += this.snowDrift[k + 2] * dt;
      for (let a = 0; a < 3; a++) {
        const rel = arr[k + a] - c.getComponent(a);
        if (rel > half) arr[k + a] -= SNOW_BOX;
        else if (rel < -half) arr[k + a] -= SNOW_BOX;
      }
    }
    pos.needsUpdate = true;
  }

  render() {
    this.composer.render();
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
  }
}

export { CONFIG };
