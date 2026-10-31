import { CONFIG } from '../config.js';

/**
 * Tactical Sci-Fi HUD overlay:
 * Depth gauge, compass heading, telemetry, battery bar, hopper status,
 * tool selector, mission timer, eco-score, eDNA minimap, and toast alerts.
 */
export class HUD {
  constructor(ednaSystem) {
    this.edna = ednaSystem;

    // DOM Elements
    this.container = document.getElementById('hud');
    this.depthVal = document.getElementById('hud-depth');
    this.speedVal = document.getElementById('hud-speed');
    this.batteryBar = document.getElementById('hud-battery-bar');
    this.batteryVal = document.getElementById('hud-battery-val');
    this.hopperBar = document.getElementById('hud-hopper-bar');
    this.hopperVal = document.getElementById('hud-hopper-val');
    this.timerVal = document.getElementById('hud-timer');
    this.scoreVal = document.getElementById('hud-score');
    this.tool1 = document.getElementById('tool-slot-1');
    this.tool2 = document.getElementById('tool-slot-2');
    this.toastElem = document.getElementById('hud-toast');
    this.tutorialContainer = document.getElementById('hud-tutorial');
    this.tutorialBadge = document.getElementById('tutorial-badge');
    this.tutorialText = document.getElementById('tutorial-text');
    this.tutorialCloseBtn = document.getElementById('tutorial-close');

    if (this.tutorialCloseBtn) {
      this.tutorialCloseBtn.addEventListener('click', () => {
        this.hideTutorialToast();
      });
    }

    this.minimapCanvas = document.getElementById('minimap-canvas');
    if (this.minimapCanvas) {
      this.minimapCtx = this.minimapCanvas.getContext('2d');
    }

    this.toastTimer = 0;
  }

  show() {
    if (this.container) this.container.style.display = 'block';
  }

  hide() {
    if (this.container) this.container.style.display = 'none';
  }

  showToast(message, type = 'info', duration = 3.0) {
    if (!this.toastElem) return;
    this.toastElem.textContent = message;
    this.toastElem.className = `hud-toast ${type} active`;
    this.toastTimer = duration;
  }

  showTutorialToast(badgeText, messageText) {
    if (!this.tutorialContainer) return;
    if (this.tutorialBadge) this.tutorialBadge.textContent = badgeText;
    if (this.tutorialText) this.tutorialText.textContent = messageText;
    this.tutorialContainer.style.display = 'flex';
  }

  hideTutorialToast() {
    if (this.tutorialContainer) {
      this.tutorialContainer.style.display = 'none';
    }
  }

  update(dt, auv, level, scoreEngine, remainingTime, inputTool) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0 && this.toastElem) {
        this.toastElem.className = 'hud-toast';
      }
    }

    // Telemetry
    const depth = Math.max(0, -auv.position.y).toFixed(1);
    const speed = auv.velocity.length().toFixed(1);
    if (this.depthVal) this.depthVal.textContent = `${depth}m`;
    if (this.speedVal) this.speedVal.textContent = `${speed}m/s`;

    // Battery
    const bat = Math.max(0, Math.round(auv.battery));
    if (this.batteryVal) this.batteryVal.textContent = `${bat}%`;
    if (this.batteryBar) {
      this.batteryBar.style.width = `${bat}%`;
      if (bat <= CONFIG.battery.lowWarning) {
        this.batteryBar.style.backgroundColor = '#ef4444'; // Red
      } else if (bat <= 50) {
        this.batteryBar.style.backgroundColor = '#f59e0b'; // Amber
      } else {
        this.batteryBar.style.backgroundColor = '#22c55e'; // Green
      }
    }

    // Hopper
    const hCount = auv.hopperCount;
    const hMax = CONFIG.hopper.capacity;
    if (this.hopperVal) this.hopperVal.textContent = `${hCount}/${hMax}`;
    if (this.hopperBar) {
      const pct = Math.min(100, Math.round((hCount / hMax) * 100));
      this.hopperBar.style.width = `${pct}%`;
      this.hopperBar.style.backgroundColor = hCount >= hMax ? '#ef4444' : '#38bdf8';
    }

    // Active tool slots
    if (this.tool1) this.tool1.classList.toggle('active', inputTool === 1);
    if (this.tool2) {
      const allowed = level.def.allowedTools?.includes('sprayer') ?? true;
      this.tool2.classList.toggle('active', inputTool === 2);
      this.tool2.classList.toggle('disabled', !allowed);
    }

    // Mission timer (mm:ss)
    if (this.timerVal) {
      const mins = Math.floor(remainingTime / 60);
      const secs = Math.floor(remainingTime % 60);
      this.timerVal.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      if (remainingTime <= 30) {
        this.timerVal.style.color = '#ef4444';
      } else {
        this.timerVal.style.color = '#38bdf8';
      }
    }

    // Score
    if (this.scoreVal) {
      this.scoreVal.textContent = `${scoreEngine.score} PTS`;
    }

    // Render Minimap
    if (this.minimapCtx && this.minimapCanvas) {
      this.minimapCtx.clearRect(0, 0, this.minimapCanvas.width, this.minimapCanvas.height);
      this.edna.renderMinimap(
        this.minimapCtx,
        this.minimapCanvas.width,
        this.minimapCanvas.height,
        auv.position,
        auv.yaw,
        level.def.dock
      );
    }
  }
}
