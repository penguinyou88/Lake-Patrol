import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { particleTexture } from '../world/Textures.js';

const _nozzle = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _target = new THREE.Vector3();
const _toItem = new THREE.Vector3();
const _v = new THREE.Vector3();

/**
 * Eradication tools:
 * 1. High-pressure Hydro-Vacuum: Cone suction, safe around non-targeted natives, collects into hopper.
 * 2. Chemical Micro-Sprayer (Bio-bullet/Zequanox): Dissolves clusters, leaves toxic cloud risking collateral damage.
 */
export class ToolSystem {
  constructor(scene, audioManager) {
    this.scene = scene;
    this.audio = audioManager;
    this.group = new THREE.Group();
    this.group.name = 'tools';
    this.scene.add(this.group);

    this.sprayCooldown = 0;
    this.toxicClouds = [];

    this.buildVacuumParticles();
  }

  buildVacuumParticles() {
    const count = 180;
    const pos = new Float32Array(count * 3);
    this.vacParticles = [];

    for (let i = 0; i < count; i++) {
      this.vacParticles.push({
        dist: Math.random() * CONFIG.tools.vacuum.range,
        angle: Math.random() * Math.PI * 2,
        spread: Math.random(),
        speed: 4.5 + Math.random() * 3.5,
      });
      pos[i * 3] = 0;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = 0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.vacMat = new THREE.PointsMaterial({
      size: 0.12,
      map: particleTexture(),
      transparent: true,
      depthWrite: false,
      color: 0x67e8f9,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
    });
    this.vacMesh = new THREE.Points(geo, this.vacMat);
    this.vacMesh.frustumCulled = false;
    this.group.add(this.vacMesh);
  }

  update(dt, input, auv, musselField, marineLife, scoreEngine, level) {
    auv.getNozzleWorld(_nozzle);
    auv.getForward(_fwd);

    if (this.sprayCooldown > 0) {
      this.sprayCooldown -= dt;
    }

    const activeTool = input.tool;
    const isFiring = input.firing && auv.battery > 0 && !auv.emergency;

    // 1. Hydro-Vacuum Handling
    if (activeTool === 1 && isFiring) {
      if (auv.hopperCount >= CONFIG.hopper.capacity) {
        // Hopper full!
        auv.setToolGlow(0xf59e0b, 0.4);
        this.audio.setVacuum(false);
        this.vacMat.opacity = 0.0;
      } else {
        auv.setToolGlow(0x00e5ff, 0.85);
        auv.drain(CONFIG.battery.vacuumDrain * dt);
        this.audio.setVacuum(true);
        this.vacMat.opacity = 0.75;

        // Process mussels in vacuum cone
        this.processVacuum(dt, _nozzle, _fwd, auv, musselField, scoreEngine);
      }
    } else {
      if (activeTool === 1) {
        auv.setToolGlow(0x00e5ff, 0.0);
      }
      this.audio.setVacuum(false);
      this.vacMat.opacity = Math.max(0, this.vacMat.opacity - dt * 4);
    }

    // Animate vacuum intake stream
    this.updateVacuumParticles(dt, _nozzle, _fwd);

    // 2. Chemical Sprayer Handling
    if (activeTool === 2) {
      const allowed = level.allowedTools?.includes('sprayer') ?? true;
      if (!allowed) {
        auv.setToolGlow(0xef4444, 0.3); // Red glow indicator: restricted
      } else {
        auv.setToolGlow(0xa3e635, 0.2); // Lime glow
      }

      if (isFiring && this.sprayCooldown <= 0 && allowed) {
        if (auv.battery >= CONFIG.battery.sprayCost) {
          auv.drain(CONFIG.battery.sprayCost);
          this.sprayCooldown = CONFIG.tools.sprayer.cooldown;
          this.audio.playSprayFizz();
          this.audio.playWarningKlaxon();

          // Spawn cloud ahead
          _target.copy(_nozzle).addScaledVector(_fwd, 4.2);
          this.spawnToxicCloud(_target, musselField, marineLife, scoreEngine);
        }
      }
    }

    // Update ongoing toxic clouds
    this.updateToxicClouds(dt, musselField, marineLife, scoreEngine);
  }

  processVacuum(dt, nozzle, fwd, auv, musselField, scoreEngine) {
    const range = CONFIG.tools.vacuum.range;
    const maxCos = Math.cos((CONFIG.tools.vacuum.angleDeg * Math.PI) / 180);

    for (const item of musselField.items) {
      if (item.state !== 'alive') continue;

      _toItem.subVectors(item.pos, nozzle);
      const dist = _toItem.length();
      if (dist > range) continue;

      _toItem.normalize();
      const dot = _toItem.dot(fwd);
      if (dot < maxCos) continue;

      // Inside suction cone!
      item.shake = 0.15;
      item.hp -= CONFIG.tools.vacuum.damagePerSec * dt;

      if (item.hp <= 0) {
        musselField.suck(item);

        if (item.species === 'native') {
          // Direct native suction: ecological violation!
          scoreEngine.recordNativeHarm();
          this.audio.playWarningKlaxon();
        } else {
          // Invasive collected
          if (item.species === 'quagga') auv.hopper.quagga++;
          else if (item.species === 'zebra') auv.hopper.zebra++;

          scoreEngine.recordRemoval(item.species);
          this.audio.playCollectChime(item.species);
        }

        if (auv.hopperCount >= CONFIG.hopper.capacity) {
          break; // Capacity reached
        }
      }
    }
  }

  updateVacuumParticles(dt, nozzle, fwd) {
    const pos = this.vacMesh.geometry.attributes.position;
    const arr = pos.array;
    const maxRange = CONFIG.tools.vacuum.range;
    const spreadRad = (CONFIG.tools.vacuum.angleDeg * Math.PI) / 180;

    for (let i = 0; i < this.vacParticles.length; i++) {
      const p = this.vacParticles[i];
      p.dist -= p.speed * dt;
      if (p.dist <= 0.1) {
        p.dist = maxRange * (0.8 + Math.random() * 0.2);
        p.angle = Math.random() * Math.PI * 2;
        p.spread = Math.random();
      }

      // Conical coordinates along fwd
      const r = Math.sin(spreadRad) * p.dist * p.spread;
      const ox = Math.cos(p.angle) * r;
      const oy = Math.sin(p.angle) * r;

      _v.copy(nozzle).addScaledVector(fwd, p.dist);
      _v.x += ox;
      _v.y += oy;

      arr[i * 3] = _v.x;
      arr[i * 3 + 1] = _v.y;
      arr[i * 3 + 2] = _v.z;
    }
    pos.needsUpdate = true;
  }

  spawnToxicCloud(position, musselField, marineLife, scoreEngine) {
    const geo = new THREE.SphereGeometry(CONFIG.tools.sprayer.cloudRadius, 16, 12);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x84cc16,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      wireframe: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    this.group.add(mesh);

    const cloud = {
      mesh,
      pos: position.clone(),
      radius: CONFIG.tools.sprayer.cloudRadius,
      life: CONFIG.tools.sprayer.cloudLife,
      maxLife: CONFIG.tools.sprayer.cloudLife,
      harmedEntities: new Set(),
      causedMisuse: false,
    };
    this.toxicClouds.push(cloud);

    // Initial instant dissolve of invasives inside
    for (const item of musselField.items) {
      if (item.state !== 'alive') continue;
      if (item.pos.distanceTo(cloud.pos) <= cloud.radius) {
        if (item.species !== 'native') {
          musselField.dissolve(item);
          scoreEngine.recordRemoval(item.species);
        }
      }
    }
  }

  updateToxicClouds(dt, musselField, marineLife, scoreEngine) {
    for (let i = this.toxicClouds.length - 1; i >= 0; i--) {
      const cloud = this.toxicClouds[i];
      cloud.life -= dt;

      // Expand slightly then fade
      const progress = 1 - cloud.life / cloud.maxLife;
      const scale = 1.0 + progress * 0.4;
      cloud.mesh.scale.set(scale, scale, scale);
      cloud.mesh.material.opacity = Math.max(0, (cloud.life / cloud.maxLife) * 0.4);

      const curRadius = cloud.radius * scale;

      // Check collateral damage on native mussels
      for (const item of musselField.items) {
        if (item.species === 'native' && item.state === 'alive') {
          if (item.pos.distanceTo(cloud.pos) <= curRadius) {
            if (!cloud.harmedEntities.has(item)) {
              cloud.harmedEntities.add(item);
              musselField.harm(item);
              scoreEngine.recordNativeHarm();
              this.audio.playWarningKlaxon();

              if (!cloud.causedMisuse) {
                cloud.causedMisuse = true;
                scoreEngine.recordChemicalMisuse();
              }
            }
          }
        }
      }

      // Check collateral damage on fish
      for (const fish of marineLife.fish) {
        if (fish.state === 'alive') {
          if (fish.mesh.position.distanceTo(cloud.pos) <= curRadius) {
            if (!cloud.harmedEntities.has(fish)) {
              cloud.harmedEntities.add(fish);
              marineLife.harm(fish);
              scoreEngine.recordFishHarm();
              this.audio.playWarningKlaxon();

              if (!cloud.causedMisuse) {
                cloud.causedMisuse = true;
                scoreEngine.recordChemicalMisuse();
              }
            }
          }
        }
      }

      if (cloud.life <= 0) {
        this.group.remove(cloud.mesh);
        cloud.mesh.geometry.dispose();
        cloud.mesh.material.dispose();
        this.toxicClouds.splice(i, 1);
      }
    }
  }

  dispose() {
    this.vacMesh.geometry.dispose();
    this.vacMesh.material.dispose();
    for (const c of this.toxicClouds) {
      this.group.remove(c.mesh);
      c.mesh.geometry.dispose();
      c.mesh.material.dispose();
    }
  }
}
