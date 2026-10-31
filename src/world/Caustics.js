import * as THREE from 'three';
import { causticTexture } from './Textures.js';

// Shared uniforms so every caustic-receiving material animates in sync.
export const causticUniforms = {
  uTime: { value: 0 },
  uCausticTex: { value: null },
  uCausticStrength: { value: 0.5 },
  uCausticColor: { value: new THREE.Color(0.75, 0.95, 1.0) },
  uSurfaceY: { value: 0 },
};

/**
 * Patch a MeshStandardMaterial so it receives animated caustic light, projected
 * from above in world XZ space and fading with depth.
 */
export function applyCaustics(material) {
  causticUniforms.uCausticTex.value ??= causticTexture();
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, causticUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCausticWorld;\nvarying vec3 vCausticNormal;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          vec4 cw = vec4(transformed, 1.0);
          vec3 cn = objectNormal;
          #ifdef USE_INSTANCING
            cw = instanceMatrix * cw;
            cn = mat3(instanceMatrix) * cn;
          #endif
          vCausticWorld = (modelMatrix * cw).xyz;
          vCausticNormal = normalize(mat3(modelMatrix) * cn);
        }`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vCausticWorld;
        varying vec3 vCausticNormal;
        uniform float uTime;
        uniform sampler2D uCausticTex;
        uniform float uCausticStrength;
        uniform vec3 uCausticColor;
        uniform float uSurfaceY;`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec2 p = vCausticWorld.xz;
          float c1 = texture2D(uCausticTex, p * 0.075 + vec2(uTime * 0.021, uTime * 0.013)).r;
          float c2 = texture2D(uCausticTex, p * 0.103 + vec2(-uTime * 0.017, uTime * 0.019)).r;
          float caustic = min(c1, c2) * 1.6;
          float depth = max(0.0, uSurfaceY - vCausticWorld.y);
          float facing = clamp(vCausticNormal.y, 0.0, 1.0);
          totalEmissiveRadiance += uCausticColor * caustic * uCausticStrength * facing * exp(-depth * 0.06);
        }`
      );
  };
  material.customProgramCacheKey = () => 'caustics-v1';
  return material;
}
