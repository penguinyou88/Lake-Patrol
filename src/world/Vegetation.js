import * as THREE from 'three';

const _dummy = new THREE.Object3D();
const _pos = new THREE.Vector3();

/**
 * Procedural underwater eelgrass / ribbon weed (Vallisneria americana).
 * Dense clumps of green ribbon blades that sway gently in the current.
 */
export class Vegetation {
  constructor(rng, heightAt) {
    this.rng = rng;
    this.heightAt = heightAt;
    this.group = new THREE.Group();
    this.group.name = 'vegetation';

    this.bladeCount = 380;
    this.build();
  }

  build() {
    // Slender ribbon grass geometry (segmented vertically for wave deformation)
    const bladeGeo = new THREE.PlaneGeometry(0.12, 1.8, 1, 6);
    bladeGeo.translate(0, 0.9, 0); // origin at base

    // Patch vertex shader to animate sway with underwater current
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2e7d32,
      roughness: 0.65,
      metalness: 0.05,
      side: THREE.DoubleSide,
      shadowSide: THREE.DoubleSide,
    });

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      this.shaderUniforms = shader.uniforms;

      shader.vertexShader = `
        uniform float uTime;
        ${shader.vertexShader}
      `;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        float heightFactor = clamp(position.y / 1.8, 0.0, 1.0);
        float sway = sin(uTime * 1.6 + transformed.x * 2.5 + transformed.z * 1.8) * 0.28 * heightFactor;
        float swayZ = cos(uTime * 1.3 + transformed.x * 1.2) * 0.18 * heightFactor;
        transformed.x += sway;
        transformed.z += swayZ;
        `
      );
    };

    const mesh = new THREE.InstancedMesh(bladeGeo, mat, this.bladeCount);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Distribute blades in 18 organic clumps around the lakebed
    let idx = 0;
    const clumps = 20;
    for (let c = 0; c < clumps; c++) {
      const angle = this.rng() * Math.PI * 2;
      const dist = 6 + this.rng() * 26;
      const cx = Math.cos(angle) * dist;
      const cz = Math.sin(angle) * dist;
      const count = Math.floor(this.bladeCount / clumps);

      for (let i = 0; i < count && idx < this.bladeCount; i++) {
        const ox = (this.rng() - 0.5) * 3.2;
        const oz = (this.rng() - 0.5) * 3.2;
        const x = cx + ox;
        const z = cz + oz;
        const y = this.heightAt(x, z);

        _dummy.position.set(x, y - 0.05, z);
        _dummy.rotation.y = this.rng() * Math.PI * 2;
        _dummy.rotation.x = (this.rng() - 0.5) * 0.2;
        _dummy.rotation.z = (this.rng() - 0.5) * 0.2;

        const scaleY = 0.75 + this.rng() * 0.65;
        const scaleXZ = 0.8 + this.rng() * 0.4;
        _dummy.scale.set(scaleXZ, scaleY, scaleXZ);

        _dummy.updateMatrix();
        mesh.setMatrixAt(idx++, _dummy.matrix);
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    this.mesh = mesh;
    this.group.add(mesh);
  }

  update(time) {
    if (this.shaderUniforms) {
      this.shaderUniforms.uTime.value = time;
    }
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

