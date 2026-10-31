import * as THREE from 'three';
import { CONFIG } from '../config.js';

const _v = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _screen = new THREE.Vector3();

/**
 * Edge-AI Computer Vision detection system:
 * Simulates on-device neural network inference (YOLO-style) on mussel clusters.
 * Calculates dynamic confidence based on distance, water clarity (turbidity), and viewing angle.
 * Renders colorblind-safe reticles & bounding boxes on an overlay 2D canvas.
 */
export class DetectionAI {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.detections = [];

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  /**
   * @param {THREE.Camera} camera
   * @param {MusselField} musselField
   * @param {number} clarity Water clarity multiplier (1.0 clear -> 0.4 murky)
   * @param {number} time
   */
  update(camera, musselField, clarity = 1.0, time = 0) {
    this.detections.length = 0;
    const maxRange = CONFIG.detection.baseRange * Math.max(0.4, clarity);
    camera.getWorldDirection(_fwd);

    const candidates = [];

    for (const cluster of musselField.clusters) {
      const aliveCount = musselField.aliveInCluster(cluster);
      if (aliveCount === 0) continue;

      // Distance check
      _dir.subVectors(cluster.center, camera.position);
      const dist = _dir.length();
      if (dist > maxRange || dist < 0.5) continue;

      // Frustum / angle check
      _dir.normalize();
      const dot = _dir.dot(_fwd);
      if (dot < 0.6) continue; // Must be in front

      // Project to 2D screen coordinates
      _screen.copy(cluster.center).project(camera);
      if (_screen.z < 0 || _screen.z > 1) continue; // Behind near or far plane
      if (_screen.x < -1.1 || _screen.x > 1.1 || _screen.y < -1.1 || _screen.y > 1.1) continue;

      candidates.push({ cluster, dist, dot, screen: _screen.clone() });
    }

    // Sort by distance and cap at max boxes
    candidates.sort((a, b) => a.dist - b.dist);
    const selected = candidates.slice(0, CONFIG.detection.maxBoxes);

    for (const item of selected) {
      const { cluster, dist, dot, screen } = item;

      // Dynamic confidence calculation
      const distPenalty = (dist / maxRange) * 0.35;
      const turbidityPenalty = (1.0 - clarity) * 0.28;
      const anglePenalty = (1.0 - dot) * 0.15;
      const jitter = Math.sin(time * 6 + cluster.id * 17) * 0.03;

      let baseConf = cluster.species === 'quagga' ? 0.95 : cluster.species === 'native' ? 0.98 : 0.91;
      let confidence = baseConf - distPenalty - turbidityPenalty - anglePenalty + jitter;
      confidence = Math.min(0.99, Math.max(0.35, confidence));

      const isUncertain = confidence < CONFIG.detection.uncertainThreshold;

      // Screen space bounding box calculation
      const sx = ((screen.x + 1) * 0.5) * this.canvas.width;
      const sy = ((-screen.y + 1) * 0.5) * this.canvas.height;

      // Projected size scales inversely with distance
      const boxSize = Math.max(34, Math.min(180, (cluster.radius * 2 * this.canvas.height) / (dist * Math.tan((camera.fov * Math.PI) / 360))));
      const half = boxSize * 0.55;

      this.detections.push({
        id: cluster.id,
        species: cluster.species,
        isUncertain,
        confidence: Math.round(confidence * 100),
        x: sx - half,
        y: sy - half,
        width: half * 2,
        height: half * 2,
        dist: dist.toFixed(1),
        alive: musselField.aliveInCluster(cluster),
      });
    }
  }

  render(time) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (const d of this.detections) {
      ctx.save();

      let color = '#22c55e'; // Green for quagga
      let label = `[QUAGGA - ${d.confidence}%]`;
      let style = 'corners';

      if (d.isUncertain) {
        color = '#94a3b8'; // Slate grey for uncertain
        label = `[UNCERTAIN - ${d.confidence}%]`;
        style = 'dotted';
      } else if (d.species === 'zebra') {
        color = '#f59e0b'; // Amber for zebra
        label = `[ZEBRA - ${d.confidence}%]`;
        style = 'dashed';
      } else if (d.species === 'native') {
        color = '#ef4444'; // Red for native unionid
        label = `[NATIVE UNIONID - ${d.confidence}%]`;
        style = 'warning';
      }

      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2;

      const { x, y, width: w, height: h } = d;

      // Reticle shapes (colorblind-safe)
      if (style === 'corners') {
        // Quagga: Corner brackets
        const cornerLen = Math.min(16, w * 0.25);
        ctx.beginPath();
        // Top-left
        ctx.moveTo(x, y + cornerLen); ctx.lineTo(x, y); ctx.lineTo(x + cornerLen, y);
        // Top-right
        ctx.moveTo(x + w - cornerLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cornerLen);
        // Bottom-right
        ctx.moveTo(x + w, y + h - cornerLen); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - cornerLen, y + h);
        // Bottom-left
        ctx.moveTo(x + cornerLen, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - cornerLen);
        ctx.stroke();
      } else if (style === 'dashed') {
        // Zebra: Dashed rectangle
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);
      } else if (style === 'warning') {
        // Native: Flashing warning border + corner hashes
        const pulse = Math.sin(time * 8) * 0.3 + 0.7;
        ctx.globalAlpha = pulse;
        ctx.strokeRect(x, y, w, h);
        // Little diagonal warning crosses on top-left and top-right
        ctx.beginPath();
        ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 4, y + 4);
        ctx.moveTo(x + 4, y - 4); ctx.lineTo(x - 4, y + 4);
        ctx.moveTo(x + w - 4, y - 4); ctx.lineTo(x + w + 4, y + 4);
        ctx.moveTo(x + w + 4, y - 4); ctx.lineTo(x + w - 4, y + 4);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      } else {
        // Uncertain: Dotted box
        ctx.setLineDash([2, 4]);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);
      }

      // Label background + text tag
      ctx.font = '10px "JetBrains Mono", "Courier New", monospace';
      ctx.textBaseline = 'bottom';
      const textWidth = ctx.measureText(label).width;

      ctx.fillStyle = 'rgba(10, 16, 26, 0.82)';
      ctx.fillRect(x, y - 18, textWidth + 8, 16);

      ctx.fillStyle = color;
      ctx.fillText(label, x + 4, y - 5);

      // Distance readout at bottom
      ctx.font = '9px "JetBrains Mono", "Courier New", monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.fillText(`${d.dist}m (${d.alive})`, x + 2, y + h + 12);

      ctx.restore();
    }
  }
}
