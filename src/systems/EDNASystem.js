import * as THREE from 'three';
import { CONFIG } from '../config.js';

const _v = new THREE.Vector3();

/**
 * eDNA (Environmental DNA) Veliger plume simulation & acoustic proximity ping.
 * Spawning invasive quagga clusters emit a scalar concentration field:
 * C(p) = Σ (C0 * n_alive) / (1 + k * dist²)
 * Renders a 48x48 heat grid on the tactical minimap and drives sonar ping frequency.
 */
export class EDNASystem {
  constructor(audioManager) {
    this.audio = audioManager;
    this.gridSize = CONFIG.edna.grid;
    this.grid = new Float32Array(this.gridSize * this.gridSize);

    this.timer = 0;
    this.pingTimer = 0;
    this.localConcentration = 0;
  }

  /**
   * Sample eDNA scalar concentration at point (x, y, z).
   */
  sample(x, y, z, musselField) {
    let sum = 0;
    const k = CONFIG.edna.k;
    for (const cluster of musselField.clusters) {
      if (cluster.species !== 'quagga') continue;
      const alive = musselField.aliveInCluster(cluster);
      if (alive === 0) continue;

      const dx = x - cluster.center.x;
      const dy = y - cluster.center.y;
      const dz = z - cluster.center.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      sum += (alive * 4.0) / (1.0 + k * distSq);
    }
    return sum;
  }

  update(dt, auvPos, musselField) {
    this.timer += dt;

    // Refresh 2D heat grid at 4 Hz
    if (this.timer >= 1.0 / CONFIG.edna.refreshHz) {
      this.timer = 0;
      this.updateHeatmap(musselField);
    }

    // Sample local concentration at AUV location
    this.localConcentration = this.sample(auvPos.x, auvPos.y, auvPos.z, musselField);

    // Normalize concentration [0, 1] roughly
    const norm = Math.min(1.0, this.localConcentration / 35.0);

    // Dynamic acoustic sonar ping interval
    const interval = THREE.MathUtils.lerp(CONFIG.edna.pingMax, CONFIG.edna.pingMin, norm);
    this.pingTimer += dt;
    if (this.pingTimer >= interval) {
      this.pingTimer = 0;
      const pitchMul = 1.0 + norm * 0.45;
      this.audio.playSonarPing(pitchMul);
    }
  }

  updateHeatmap(musselField) {
    const worldSize = CONFIG.world.size;
    const half = worldSize / 2;
    const step = worldSize / this.gridSize;

    for (let gy = 0; gy < this.gridSize; gy++) {
      const z = -half + (gy + 0.5) * step;
      for (let gx = 0; gx < this.gridSize; gx++) {
        const x = -half + (gx + 0.5) * step;
        const val = this.sample(x, -5, z, musselField);
        this.grid[gy * this.gridSize + gx] = val;
      }
    }
  }

  /**
   * Render the concentration field onto a minimap 2D canvas context.
   */
  renderMinimap(ctx, width, height, auvPos, auvYaw, dockStation) {
    const worldSize = CONFIG.world.size;
    const half = worldSize / 2;
    const cellW = width / this.gridSize;
    const cellH = height / this.gridSize;

    // 1. Draw eDNA heat grid cells
    for (let gy = 0; gy < this.gridSize; gy++) {
      for (let gx = 0; gx < this.gridSize; gx++) {
        const val = this.grid[gy * this.gridSize + gx];
        if (val < 1.0) continue;

        // Normalized intensity
        const t = Math.min(1.0, val / 40.0);
        let r = 0, g = 0, b = 0, a = 0.4 * t;

        if (t < 0.4) {
          // Blue to Cyan
          r = 10;
          g = Math.floor(100 + t * 300);
          b = 220;
        } else if (t < 0.75) {
          // Cyan to Yellow
          const u = (t - 0.4) / 0.35;
          r = Math.floor(u * 255);
          g = 240;
          b = Math.floor((1 - u) * 200);
        } else {
          // Yellow to Red/Magenta
          const u = (t - 0.75) / 0.25;
          r = 255;
          g = Math.floor((1 - u) * 220);
          b = Math.floor(u * 60);
          a = 0.65;
        }

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
        ctx.fillRect(gx * cellW, gy * cellH, cellW + 0.5, cellH + 0.5);
      }
    }

    // 2. Draw Dock Station marker
    if (dockStation) {
      const dx = ((dockStation.x + half) / worldSize) * width;
      const dz = ((dockStation.z + half) / worldSize) * height;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(dx, dz, 5, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.fill();
    }

    // 3. Draw AUV position & direction triangle
    const ax = ((auvPos.x + half) / worldSize) * width;
    const az = ((auvPos.z + half) / worldSize) * height;

    ctx.save();
    ctx.translate(ax, az);
    ctx.rotate(-auvYaw);

    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(0, 3);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}
