import * as THREE from 'three';

/**
 * Procedural bivalve shells (unit length along +X, umbo/hinge at the origin).
 * Local axes: X = length (anterior umbo → posterior), Y = height (ventral −Y → dorsal +Y),
 * Z = thickness (left/right valves). Dreissenids attach with the ventral side (−Y) on the substrate.
 *
 *  - Quagga: rounded, asymmetric fan; no flat ventral side, so it cannot stand upright.
 *  - Zebra: D/triangular, pointed umbo, flat ventral face with a sharp ridge (carina).
 *  - Native unionid: large elongated oval, thick and inflated.
 */
const SPECIES_SHAPES = {
  quagga: {
    center: [0.52, 0.02], rx: 0.5, ryTop: 0.36, ryBottom: 0.3, pinchY: -0.03,
    pinch: 0.55, ventralFlat: null, umbo: [0.06, -0.03], thickness: 0.17, carina: 1.0,
  },
  zebra: {
    center: [0.55, 0.06], rx: 0.5, ryTop: 0.3, ryBottom: 0.3, pinchY: -0.1,
    pinch: 0.32, ventralFlat: -0.13, umbo: [0.06, -0.1], thickness: 0.2, carina: 0.45,
  },
  native: {
    center: [0.5, 0.0], rx: 0.5, ryTop: 0.27, ryBottom: 0.24, pinchY: 0,
    pinch: 0.12, ventralFlat: null, umbo: [0.3, 0.17], thickness: 0.2, carina: 1.0,
  },
};

function outlinePoint(shape, theta, out) {
  const { center, rx, ryTop, ryBottom, pinch, pinchY, ventralFlat } = shape;
  const s = Math.sin(theta);
  let x = center[0] + Math.cos(theta) * rx;
  let y = center[1] + s * (s > 0 ? ryTop : ryBottom);
  // Pinch toward the anterior (umbo) end
  const t = Math.max(0, Math.min(1, x / (center[0] + rx)));
  y = pinchY + (y - pinchY) * Math.pow(t, pinch);
  if (ventralFlat !== null) y = Math.max(y, ventralFlat);
  out.set(x, y);
  return out;
}

export function createShellGeometry(species, nU = 36, nV = 10) {
  const shape = SPECIES_SHAPES[species];
  const [ux, uy] = shape.umbo;
  const positions = [];
  const uvs = [];
  const indices = [];
  const b = new THREE.Vector2();

  for (let side = 0; side < 2; side++) {
    const sign = side === 0 ? 1 : -1;
    const offset = positions.length / 3;
    for (let i = 0; i <= nU; i++) {
      const theta = (i / nU) * Math.PI * 2;
      outlinePoint(shape, theta, b);
      // Ventral rays (below the umbo) get a fuller profile on zebras → sharp carina
      const ventral = b.y < uy + 0.02;
      const exp = ventral ? shape.carina : 1.0;
      for (let j = 0; j <= nV; j++) {
        const v = j / nV;
        const s = Math.sin((v * Math.PI) / 2);
        const x = ux + (b.x - ux) * s;
        const y = uy + (b.y - uy) * s;
        const z = sign * shape.thickness * Math.pow(Math.cos((v * Math.PI) / 2), exp) * (1 - 0.15 * v);
        positions.push(x, y, z);
        uvs.push(i / nU, v);
      }
    }
    const row = nV + 1;
    for (let i = 0; i < nU; i++) {
      for (let j = 0; j < nV; j++) {
        const a = offset + i * row + j;
        const bb = offset + (i + 1) * row + j;
        const c = offset + (i + 1) * row + j + 1;
        const d = offset + i * row + j + 1;
        if (sign > 0) indices.push(a, d, bb, bb, d, c);
        else indices.push(a, bb, d, bb, c, d);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}
