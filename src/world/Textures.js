import * as THREE from 'three';
import { mulberry32, noise2 } from '../utils/math.js';

// All textures are generated on canvases at runtime: no image assets to ship.

function makeCanvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(canvas, { repeat = 1, color = true, wrap = true } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  if (color) tex.colorSpace = THREE.SRGBColorSpace;
  if (wrap) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
  }
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

const cache = new Map();
const cached = (key, fn) => {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
};

/**
 * Shell textures. Shell UVs: x = around the outline (u), y = distance from umbo (v).
 * Horizontal bands in v appear as concentric growth rings.
 */
export function shellTexture(species) {
  return cached(`shell-${species}`, () => {
    const W = 256, H = 128;
    const c = makeCanvas(W, H);
    const g = c.getContext('2d');
    const img = g.createImageData(W, H);
    const rng = mulberry32(species.length * 99);
    for (let y = 0; y < H; y++) {
      const v = y / (H - 1);
      for (let x = 0; x < W; x++) {
        const u = x / W;
        let r, gg, b;
        const grain = noise2(x * 0.15, y * 0.4, 3) * 0.12 - 0.06;
        if (species === 'quagga') {
          // Pale cream with faint, diffuse concentric bands; darker near umbo.
          const band = 0.5 + 0.5 * Math.sin(v * 46 + noise2(u * 8, v * 3, 5) * 2.2);
          const faint = band * 0.16;
          const umbo = (1 - v) ** 3 * 0.35;
          r = 0.93 - faint - umbo * 0.8;
          gg = 0.86 - faint * 1.1 - umbo;
          b = 0.70 - faint * 1.3 - umbo * 1.1;
        } else if (species === 'zebra') {
          // Bold dark zig-zag stripes on a tan-yellow ground.
          const zig = Math.abs(((u * 18) % 2) - 1) * 0.09;
          const s = Math.sin((v + zig) * 38 + noise2(u * 6, v * 4, 9) * 0.8);
          const stripe = s > 0.15 ? 1 : 0;
          r = stripe ? 0.18 : 0.86;
          gg = stripe ? 0.13 : 0.76;
          b = stripe ? 0.08 : 0.48;
        } else {
          // Native unionid: dark olive-brown periostracum with growth rests.
          const rest = Math.pow(0.5 + 0.5 * Math.sin(v * 22 + noise2(u * 5, v * 2, 2) * 1.5), 6);
          const ray = 0.5 + 0.5 * Math.sin(u * 60);
          r = 0.30 - rest * 0.12 + ray * 0.02;
          gg = 0.24 - rest * 0.1 + ray * 0.03;
          b = 0.12 - rest * 0.05;
        }
        const i = (y * W + x) * 4;
        img.data[i] = Math.max(0, Math.min(255, (r + grain) * 255));
        img.data[i + 1] = Math.max(0, Math.min(255, (gg + grain) * 255));
        img.data[i + 2] = Math.max(0, Math.min(255, (b + grain) * 255));
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    void rng;
    const tex = toTexture(c, { wrap: false });
    tex.wrapS = THREE.RepeatWrapping;
    return tex;
  });
}

export function sandTexture(tint = [0.62, 0.56, 0.42]) {
  return cached(`sand-${tint.join()}`, () => {
    const S = 256;
    const c = makeCanvas(S);
    const g = c.getContext('2d');
    const img = g.createImageData(S, S);
    const rng = mulberry32(7);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        // Tileable by sampling noise on a torus-like wrap
        const n1 = tileNoise(x, y, S, 8, 11);
        const n2 = tileNoise(x, y, S, 32, 23);
        const speck = rng() < 0.03 ? -0.18 : rng() < 0.03 ? 0.12 : 0;
        const k = 0.78 + n1 * 0.25 + n2 * 0.12 + speck;
        const i = (y * S + x) * 4;
        img.data[i] = tint[0] * k * 255;
        img.data[i + 1] = tint[1] * k * 255;
        img.data[i + 2] = tint[2] * k * 255;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return toTexture(c, { repeat: 1 });
  });
}

function tileNoise(x, y, size, period, seed) {
  // Bilinear blend of four noise samples to make a seamless tile
  const fx = (x / size) * period, fy = (y / size) * period;
  const tx = x / size, ty = y / size;
  const a = noise2(fx, fy, seed);
  const b = noise2(fx - period, fy, seed);
  const c = noise2(fx, fy - period, seed);
  const d = noise2(fx - period, fy - period, seed);
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty - 0.5;
}

/** Tileable Voronoi-edge pattern; two scrolling samples combined in-shader give caustics. */
export function causticTexture() {
  return cached('caustic', () => {
    const S = 256;
    const c = makeCanvas(S);
    const g = c.getContext('2d');
    const img = g.createImageData(S, S);
    const rng = mulberry32(42);
    const pts = Array.from({ length: 22 }, () => [rng() * S, rng() * S]);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        let d1 = 1e9, d2 = 1e9;
        for (const [px, py] of pts) {
          let dx = Math.abs(x - px), dy = Math.abs(y - py);
          dx = Math.min(dx, S - dx);
          dy = Math.min(dy, S - dy);
          const d = dx * dx + dy * dy;
          if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
        }
        const edge = Math.sqrt(d2) - Math.sqrt(d1);
        const v = Math.pow(Math.max(0, 1 - edge / 14), 3.2);
        const i = (y * S + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v * 255;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return toTexture(c, { color: false });
  });
}

export function rockTexture() {
  return cached('rock', () => {
    const S = 256;
    const c = makeCanvas(S);
    const g = c.getContext('2d');
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const n = tileNoise(x, y, S, 6, 4) + tileNoise(x, y, S, 24, 8) * 0.5 + tileNoise(x, y, S, 64, 12) * 0.25;
        const k = 0.5 + n * 0.55;
        const i = (y * S + x) * 4;
        img.data[i] = (0.46 * k + 0.04) * 255;
        img.data[i + 1] = (0.45 * k + 0.05) * 255;
        img.data[i + 2] = (0.40 * k + 0.04) * 255;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return toTexture(c, { repeat: 2 });
  });
}

export function concreteTexture() {
  return cached('concrete', () => {
    const S = 256;
    const c = makeCanvas(S);
    const g = c.getContext('2d');
    const img = g.createImageData(S, S);
    const rng = mulberry32(5);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const n = tileNoise(x, y, S, 16, 31) * 0.4 + tileNoise(x, y, S, 4, 37) * 0.6;
        const stain = Math.max(0, tileNoise(x, y, S, 3, 41)) * 0.5;
        const k = 0.62 + n * 0.3 - stain * 0.5 + (rng() - 0.5) * 0.06;
        const i = (y * S + x) * 4;
        img.data[i] = (0.58 * k) * 255;
        img.data[i + 1] = (0.6 * k) * 255;
        img.data[i + 2] = (0.55 * k) * 255;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return toTexture(c);
  });
}

export function woodTexture() {
  return cached('wood', () => {
    const W = 64, H = 256;
    const c = makeCanvas(W, H);
    const g = c.getContext('2d');
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const ring = 0.5 + 0.5 * Math.sin(x * 0.6 + noise2(x * 0.05, y * 0.02, 3) * 6);
        const k = 0.55 + ring * 0.2 + (noise2(x * 0.3, y * 0.05, 9) - 0.5) * 0.2;
        const i = (y * W + x) * 4;
        img.data[i] = 0.38 * k * 255;
        img.data[i + 1] = 0.3 * k * 255;
        img.data[i + 2] = 0.2 * k * 255;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return toTexture(c);
  });
}

/** Yellow perch: olive-gold body with 6–8 dark vertical bars, pale belly. */
export function perchTexture() {
  return cached('perch', () => {
    const W = 128, H = 256; // x = around body (u), y = along length (v)
    const c = makeCanvas(W, H);
    const g = c.getContext('2d');
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      const v = y / H;
      for (let x = 0; x < W; x++) {
        const u = x / W;
        // belly where u≈0.75 (pointing down after rotation)
        const belly = Math.max(0, Math.cos((u - 0.75) * Math.PI * 2));
        const bar = Math.sin(v * Math.PI * 14) > 0.35 && v > 0.18 && v < 0.85 ? 1 : 0;
        const barMask = bar * (1 - belly) * 0.75;
        let r = 0.78 - barMask * 0.55 + belly * 0.15;
        let gg = 0.68 - barMask * 0.5 + belly * 0.2;
        let b = 0.22 - barMask * 0.15 + belly * 0.55;
        const i = (y * W + x) * 4;
        img.data[i] = Math.min(255, r * 255);
        img.data[i + 1] = Math.min(255, gg * 255);
        img.data[i + 2] = Math.min(255, b * 255);
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return toTexture(c, { wrap: false });
  });
}

/** Soft round sprite for particles. */
export function particleTexture() {
  return cached('particle', () => {
    const S = 64;
    const c = makeCanvas(S);
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
    return toTexture(c, { wrap: false });
  });
}

/** Light-cone gradient used for fake volumetric headlight beams. */
export function beamTexture() {
  return cached('beam', () => {
    const W = 4, H = 128;
    const c = makeCanvas(W, H);
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)');
    grd.addColorStop(0.3, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    return toTexture(c, { wrap: false });
  });
}

function makeNormalMap(w, h, heightFn, strength = 1.5) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const yPrev = (y - 1 + h) % h;
    const yNext = (y + 1) % h;
    for (let x = 0; x < w; x++) {
      const xPrev = (x - 1 + w) % w;
      const xNext = (x + 1) % w;

      const hL = heightFn(xPrev, y);
      const hR = heightFn(xNext, y);
      const hU = heightFn(x, yPrev);
      const hD = heightFn(x, yNext);

      const dx = (hR - hL) * strength;
      const dy = (hD - hU) * strength;
      const dz = 1.0;
      const len = Math.hypot(dx, dy, dz);

      const nx = -dx / len;
      const ny = -dy / len;
      const nz = dz / len;

      const idx = (y * w + x) * 4;
      img.data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      img.data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      img.data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      img.data[idx + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return toTexture(c, { color: false });
}

export function sandNormalTexture() {
  return cached('sand-normal', () => {
    const S = 256;
    return makeNormalMap(S, S, (x, y) => {
      const n1 = tileNoise(x, y, S, 12, 17);
      const n2 = tileNoise(x, y, S, 32, 29) * 0.5;
      const wave = Math.sin((x / S) * Math.PI * 18 + (y / S) * Math.PI * 6) * 0.35;
      return n1 + n2 + wave;
    }, 2.2);
  });
}

export function rockNormalTexture() {
  return cached('rock-normal', () => {
    const S = 256;
    return makeNormalMap(S, S, (x, y) => {
      const n1 = tileNoise(x, y, S, 8, 51);
      const n2 = tileNoise(x, y, S, 24, 67) * 0.6;
      const n3 = tileNoise(x, y, S, 64, 83) * 0.3;
      return n1 + n2 + n3;
    }, 3.0);
  });
}

export function hullTexture() {
  return cached('hull-panels', () => {
    const S = 512;
    const c = makeCanvas(S);
    const g = c.getContext('2d');

    // Base carbon-fiber / high-tech pearlescent coat
    g.fillStyle = '#f1f5f9';
    g.fillRect(0, 0, S, S);

    // Subtle carbon weave pattern
    g.fillStyle = 'rgba(15, 23, 42, 0.04)';
    for (let y = 0; y < S; y += 4) {
      for (let x = 0; x < S; x += 4) {
        if ((x + y) % 8 === 0) g.fillRect(x, y, 4, 4);
      }
    }

    // Panel seams
    g.strokeStyle = 'rgba(30, 41, 59, 0.4)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(64, 0); g.lineTo(64, S);
    g.moveTo(256, 0); g.lineTo(256, S);
    g.moveTo(448, 0); g.lineTo(448, S);
    g.moveTo(0, 128); g.lineTo(S, 128);
    g.moveTo(0, 384); g.lineTo(S, 384);
    g.stroke();

    // Rivet rivets along seams
    g.fillStyle = 'rgba(51, 65, 85, 0.6)';
    for (let y = 16; y < S; y += 32) {
      for (const x of [64, 256, 448]) {
        g.beginPath();
        g.arc(x, y, 2.2, 0, Math.PI * 2);
        g.fill();
      }
    }

    // Scientific stencil markings
    g.fillStyle = '#0284c7';
    g.font = 'bold 22px monospace';
    g.fillText('AUV-07', 84, 80);
    g.font = '13px monospace';
    g.fillText('PHANTOM BOTS · eDNA SENSOR', 84, 102);

    // Warning hazard stripes (amber / black)
    for (let i = 0; i < 6; i++) {
      g.fillStyle = i % 2 === 0 ? '#f59e0b' : '#0f172a';
      g.beginPath();
      g.moveTo(280 + i * 16, 60);
      g.lineTo(294 + i * 16, 60);
      g.lineTo(282 + i * 16, 110);
      g.lineTo(268 + i * 16, 110);
      g.closePath();
      g.fill();
    }

    return toTexture(c, { wrap: true, repeat: 1 });
  });
}

