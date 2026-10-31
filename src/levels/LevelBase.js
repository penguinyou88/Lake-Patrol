import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { mulberry32 } from '../utils/math.js';
import { createTerrain, makeHeightFn } from '../world/Terrain.js';
import { woodTexture, rockTexture, rockNormalTexture, concreteTexture } from '../world/Textures.js';
import { Vegetation } from '../world/Vegetation.js';
import { MusselField } from '../entities/MusselField.js';
import { MarineLife } from '../entities/MarineLife.js';

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();

/**
 * Builds the physical game world from a Level configuration:
 * Lakebed, Dock pilings, Boulders, Industrial pipes, Mussel clusters, Fish schools,
 * and Dock Station recharge zone.
 */
export class LevelBase {
  constructor(levelDef) {
    this.def = levelDef;
    this.group = new THREE.Group();
    this.group.name = `level-${levelDef.id}`;
    this.rng = mulberry32(levelDef.seed);

    this.colliders = [];
    this.heightAt = makeHeightFn(levelDef.floor, levelDef.seed);

    this.musselField = new MusselField(this.rng);
    this.marineLife = new MarineLife(this.rng);

    this.buildWorld();
  }

  buildWorld() {
    // 1. Lakebed Terrain
    this.terrain = createTerrain(this.def, this.heightAt);
    this.group.add(this.terrain);

    // 2. Dock Station (Recharge & Hopper Emptying Ring)
    this.buildDockStation();

    // 3. Level-specific architectural features
    if (this.def.features.dockPoles) {
      this.buildDockPiers();
    }

    if (this.def.features.rocks > 0) {
      this.buildRocks(this.def.features.rocks);
    }

    if (this.def.features.pipe) {
      this.buildIntakePipe();
    }

    // 4. Underwater living eelgrass vegetation
    this.vegetation = new Vegetation(this.rng, this.heightAt);
    this.group.add(this.vegetation.group);

    // 5. Populate Mussel Clusters & Fish
    this.populateMussels();
    this.populateFish();

    // Finalize entities
    this.musselField.build();
    this.group.add(this.musselField.group);
    this.group.add(this.marineLife.group);
  }

  buildDockStation() {
    const { x, y, z, radius } = this.def.dock;
    const group = new THREE.Group();
    group.position.set(x, y, z);

    // Glowing cyan docking ring with high emissive bloom
    const ringGeo = new THREE.TorusGeometry(radius * 0.75, 0.08, 16, 48);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 2.8,
      roughness: 0.15,
      metalness: 0.85,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    group.add(ring);

    // Dock buoy floats with safety strobe beacons
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const bx = Math.cos(angle) * radius * 0.75;
      const bz = Math.sin(angle) * radius * 0.75;
      const buoy = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.22, 0.55, 16),
        new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.35, metalness: 0.2 })
      );
      buoy.castShadow = true;
      buoy.receiveShadow = true;
      buoy.position.set(bx, 0.1, bz);
      group.add(buoy);

      // Flashing strobe beacon on top of buoy
      const strobe = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 12, 8),
        new THREE.MeshStandardMaterial({
          color: 0xffedd5,
          emissive: 0xf97316,
          emissiveIntensity: 3.5,
        })
      );
      strobe.position.set(bx, 0.42, bz);
      group.add(strobe);
    }

    this.dockRing = ring;
    this.group.add(group);
  }

  buildDockPiers() {
    const woodMat = new THREE.MeshStandardMaterial({
      map: woodTexture(),
      roughness: 0.85,
    });

    // Main wooden dock platform
    const deckGeo = new THREE.BoxGeometry(4.5, 0.35, 18);
    const deck = new THREE.Mesh(deckGeo, woodMat);
    deck.position.set(0, 0.2, 8);
    deck.castShadow = true;
    deck.receiveShadow = true;
    this.group.add(deck);

    this.colliders.push({
      type: 'box',
      min: new THREE.Vector3(-2.25, -0.2, -1),
      max: new THREE.Vector3(2.25, 0.4, 17),
    });

    // Support pilings (cylinders)
    const poleGeo = new THREE.CylinderGeometry(0.22, 0.24, 10, 14);
    this.polePositions = [];

    for (let z = 0; z <= 16; z += 4) {
      for (const side of [-1.8, 1.8]) {
        const pole = new THREE.Mesh(poleGeo, woodMat);
        const floorY = this.heightAt(side, z);
        pole.position.set(side, (floorY + 0.3) * 0.5, z);
        pole.scale.y = Math.max(0.5, (0.3 - floorY) / 10);
        pole.castShadow = true;
        pole.receiveShadow = true;
        this.group.add(pole);

        this.polePositions.push({ x: side, z, y0: floorY, y1: 0.3 });
        this.colliders.push({
          type: 'cylinder',
          x: side,
          z,
          y0: floorY,
          y1: 0.3,
          r: 0.25,
        });
      }
    }
  }

  buildRocks(count) {
    const rockMat = new THREE.MeshStandardMaterial({
      map: rockTexture(),
      normalMap: rockNormalTexture(),
      normalScale: new THREE.Vector2(1.2, 1.2),
      roughness: 0.82,
      metalness: 0.05,
    });
    this.rockPositions = [];

    for (let i = 0; i < count; i++) {
      const radius = 1.2 + this.rng() * 2.2;
      const angle = this.rng() * Math.PI * 2;
      const dist = 6 + this.rng() * 28;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const floorY = this.heightAt(x, z);

      const geo = new THREE.DodecahedronGeometry(radius, 1);
      // Deform rock vertices slightly
      const pos = geo.attributes.position;
      for (let j = 0; j < pos.count; j++) {
        _v.fromBufferAttribute(pos, j);
        _v.multiplyScalar(0.85 + this.rng() * 0.3);
        pos.setXYZ(j, _v.x, _v.y, _v.z);
      }
      geo.computeVertexNormals();

      const rock = new THREE.Mesh(geo, rockMat);
      rock.position.set(x, floorY + radius * 0.45, z);
      rock.rotation.set(this.rng() * 3, this.rng() * 3, this.rng() * 3);
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.group.add(rock);

      this.rockPositions.push({ pos: rock.position.clone(), r: radius });
      this.colliders.push({
        type: 'sphere',
        c: rock.position.clone(),
        r: radius * 0.85,
      });
    }
  }

  buildIntakePipe() {
    const concreteMat = new THREE.MeshStandardMaterial({
      map: concreteTexture(),
      roughness: 0.8,
    });

    const pipeGeo = new THREE.CylinderGeometry(1.4, 1.4, 30, 24);
    pipeGeo.rotateX(Math.PI / 2);
    const pipe = new THREE.Mesh(pipeGeo, concreteMat);
    pipe.position.set(0, -7.5, -4);
    pipe.castShadow = true;
    pipe.receiveShadow = true;
    this.group.add(pipe);

    // Metal intake grate at mouth
    const grate = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 0.4, 16),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.4 })
    );
    grate.rotateX(Math.PI / 2);
    grate.position.set(0, -7.5, -19);
    grate.castShadow = true;
    grate.receiveShadow = true;
    this.group.add(grate);

    this.pipeInfo = {
      center: pipe.position.clone(),
      start: new THREE.Vector3(0, -7.5, 11),
      end: new THREE.Vector3(0, -7.5, -19),
      radius: 1.4,
    };

    this.colliders.push({
      type: 'capsule',
      a: this.pipeInfo.start,
      b: this.pipeInfo.end,
      r: 1.45,
    });
  }

  populateMussels() {
    const mDef = this.def.mussels;
    const isEncrusted = !!mDef.encrusted;

    // A. Quaggas
    for (let c = 0; c < mDef.quaggaClusters; c++) {
      const placements = this.getPlacementCluster('quagga');
      if (placements.length > 0) {
        this.musselField.addCluster('quagga', placements, { encrusted: isEncrusted });
      }
    }

    // B. Zebras (Established baseline)
    for (let c = 0; c < mDef.zebraClusters; c++) {
      const placements = this.getPlacementCluster('zebra');
      if (placements.length > 0) {
        this.musselField.addCluster('zebra', placements, { encrusted: isEncrusted });
      }
    }

    // C. Native Unionids (Sanctuary beds in sand)
    for (let c = 0; c < mDef.nativeClusters; c++) {
      const placements = this.getPlacementCluster('native');
      if (placements.length > 0) {
        this.musselField.addCluster('native', placements);
      }
    }
  }

  getPlacementCluster(species) {
    const rng = this.rng;
    const placements = [];
    const count = species === 'native' ? (3 + Math.floor(rng() * 4)) : (6 + Math.floor(rng() * 8));

    if (species === 'native') {
      // Natives embed in sandy lakebed depressions
      const angle = rng() * Math.PI * 2;
      const dist = 7 + rng() * 22;
      const cx = Math.cos(angle) * dist;
      const cz = Math.sin(angle) * dist;

      for (let i = 0; i < count; i++) {
        const px = cx + (rng() - 0.5) * 2.5;
        const pz = cz + (rng() - 0.5) * 2.5;
        const py = this.heightAt(px, pz);
        placements.push({
          pos: new THREE.Vector3(px, py, pz),
          normal: new THREE.Vector3(0, 1, 0),
        });
      }
      return placements;
    }

    // Invasive quagga or zebra: place on rocks, dock poles, intake pipe, or hard seabed
    if (this.pipeInfo && rng() < 0.45) {
      // Pipe encrustation
      const z = -17 + rng() * 26;
      const angle = rng() * Math.PI * 2;
      for (let i = 0; i < count; i++) {
        const th = angle + (rng() - 0.5) * 0.4;
        const pz = z + (rng() - 0.5) * 1.5;
        const px = Math.cos(th) * this.pipeInfo.radius;
        const py = this.pipeInfo.center.y + Math.sin(th) * this.pipeInfo.radius;
        placements.push({
          pos: new THREE.Vector3(px, py, pz),
          normal: new THREE.Vector3(Math.cos(th), Math.sin(th), 0).normalize(),
        });
      }
    } else if (this.polePositions && this.polePositions.length > 0 && rng() < 0.4) {
      // Dock pole colonization
      const pole = this.polePositions[Math.floor(rng() * this.polePositions.length)];
      const yBase = pole.y0 + 0.8 + rng() * (pole.y1 - pole.y0 - 1.5);
      for (let i = 0; i < count; i++) {
        const angle = rng() * Math.PI * 2;
        const px = pole.x + Math.cos(angle) * 0.23;
        const pz = pole.z + Math.sin(angle) * 0.23;
        const py = yBase + (rng() - 0.5) * 0.8;
        placements.push({
          pos: new THREE.Vector3(px, py, pz),
          normal: new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)).normalize(),
        });
      }
    } else if (this.rockPositions && this.rockPositions.length > 0 && rng() < 0.6) {
      // Boulder colonization
      const rock = this.rockPositions[Math.floor(rng() * this.rockPositions.length)];
      const dir = new THREE.Vector3(rng() - 0.5, rng() * 0.6 + 0.1, rng() - 0.5).normalize();
      for (let i = 0; i < count; i++) {
        const localDir = dir.clone().add(new THREE.Vector3((rng() - 0.5) * 0.35, (rng() - 0.5) * 0.35, (rng() - 0.5) * 0.35)).normalize();
        const p = rock.pos.clone().addScaledVector(localDir, rock.r * 0.96);
        placements.push({
          pos: p,
          normal: localDir,
        });
      }
    } else {
      // Seabed cluster
      const angle = rng() * Math.PI * 2;
      const dist = 5 + rng() * 25;
      const cx = Math.cos(angle) * dist;
      const cz = Math.sin(angle) * dist;
      for (let i = 0; i < count; i++) {
        const px = cx + (rng() - 0.5) * 2.0;
        const pz = cz + (rng() - 0.5) * 2.0;
        const py = this.heightAt(px, pz);
        placements.push({
          pos: new THREE.Vector3(px, py, pz),
          normal: new THREE.Vector3(0, 1, 0),
        });
      }
    }

    return placements;
  }

  populateFish() {
    for (let i = 0; i < this.def.fishSchools; i++) {
      const angle = this.rng() * Math.PI * 2;
      const dist = 8 + this.rng() * 22;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = Math.min(-1.5, this.heightAt(x, z) + 2.5 + this.rng() * 2.5);
      const count = 4 + Math.floor(this.rng() * 5);
      this.marineLife.addSchool(new THREE.Vector3(x, y, z), count);
    }
  }

  isInsideDock(pos) {
    const { x, z, radius } = this.def.dock;
    return Math.hypot(pos.x - x, pos.z - z) <= radius;
  }

  update(dt, time, auvPos) {
    this.musselField.update(dt, auvPos);
    this.marineLife.update(dt, time, auvPos, this.heightAt);
    this.vegetation?.update(time);

    // Pulse the dock ring
    if (this.dockRing) {
      const pulse = Math.sin(time * 3) * 0.2 + 0.65;
      this.dockRing.material.opacity = pulse;
    }
  }

  dispose() {
    this.musselField.dispose();
    this.marineLife.dispose();
    this.vegetation?.dispose();
    this.group.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material?.dispose();
      }
    });
  }
}
