import { CONFIG } from '../config.js';

/**
 * Universal input listener supporting:
 * 1. Keyboard (WASD, Space/Shift, Arrows, 1/2, C, F, Esc)
 * 2. Mouse look (with optional Pointer Lock)
 * 3. Mobile touch controls (Virtual joystick on left, look swipe on right, action buttons)
 */
export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseLook = { x: 0, y: 0 };
    this.pointerLocked = false;
    this.enabled = true;

    // Output state per frame
    this.state = {
      surge: 0,
      sway: 0,
      heave: 0,
      yaw: 0,
      pitch: 0,
      lookX: 0,
      lookY: 0,
      firing: false,
      tool: 1, // 1: vacuum, 2: sprayer
      cameraToggle: false,
      pauseToggle: false,
    };

    // Touch handling state
    this.touchActive = false;
    this.leftTouchId = null;
    this.rightTouchId = null;
    this.stickCenter = { x: 0, y: 0 };
    this.stickCurrent = { x: 0, y: 0 };
    this.rightLast = { x: 0, y: 0 };
    this.touchHeave = 0;
    this.touchFiring = false;

    this.bindEvents();
  }

  bindEvents() {
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      this.keys.add(e.code);

      if (e.code === 'Digit1') this.state.tool = 1;
      if (e.code === 'Digit2') this.state.tool = 2;
      if (e.code === 'KeyC') this.state.cameraToggle = true;
      if (e.code === 'Escape') this.state.pauseToggle = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    // Pointer lock & mouse movement
    this.canvas.addEventListener('click', () => {
      if (!this.pointerLocked && this.enabled && !this.touchActive) {
        this.canvas.requestPointerLock?.();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (this.pointerLocked) {
        const sens = CONFIG.auv.mouseSensitivity;
        this.mouseLook.x += e.movementX * sens;
        this.mouseLook.y += e.movementY * sens;
      }
    });

    window.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (e.button === 0 && this.pointerLocked) {
        this.state.firing = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.state.firing = false;
      }
    });

    // Touch events
    const touchOverlay = document.getElementById('touch-overlay');
    if (touchOverlay) {
      this.bindTouchEvents(touchOverlay);
    }
  }

  bindTouchEvents(overlay) {
    const stickZone = document.getElementById('touch-stick-zone');
    const stickNub = document.getElementById('touch-stick-nub');
    const heaveUp = document.getElementById('btn-heave-up');
    const heaveDown = document.getElementById('btn-heave-down');
    const btnFire = document.getElementById('btn-touch-fire');
    const btnTool1 = document.getElementById('btn-touch-tool-1');
    const btnTool2 = document.getElementById('btn-touch-tool-2');
    const btnCam = document.getElementById('btn-touch-cam');

    if (btnTool1) btnTool1.addEventListener('touchstart', (e) => { e.preventDefault(); this.state.tool = 1; });
    if (btnTool2) btnTool2.addEventListener('touchstart', (e) => { e.preventDefault(); this.state.tool = 2; });
    if (btnCam) btnCam.addEventListener('touchstart', (e) => { e.preventDefault(); this.state.cameraToggle = true; });

    if (btnFire) {
      btnFire.addEventListener('touchstart', (e) => { e.preventDefault(); this.touchFiring = true; });
      btnFire.addEventListener('touchend', (e) => { e.preventDefault(); this.touchFiring = false; });
      btnFire.addEventListener('touchcancel', (e) => { e.preventDefault(); this.touchFiring = false; });
    }

    if (heaveUp) {
      heaveUp.addEventListener('touchstart', (e) => { e.preventDefault(); this.touchHeave = 1; });
      heaveUp.addEventListener('touchend', (e) => { e.preventDefault(); if (this.touchHeave === 1) this.touchHeave = 0; });
    }
    if (heaveDown) {
      heaveDown.addEventListener('touchstart', (e) => { e.preventDefault(); this.touchHeave = -1; });
      heaveDown.addEventListener('touchend', (e) => { e.preventDefault(); if (this.touchHeave === -1) this.touchHeave = 0; });
    }

    overlay.addEventListener('touchstart', (e) => {
      this.touchActive = true;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.clientX < window.innerWidth * 0.45 && this.leftTouchId === null) {
          this.leftTouchId = t.identifier;
          this.stickCenter = { x: t.clientX, y: t.clientY };
          this.stickCurrent = { x: t.clientX, y: t.clientY };
          if (stickZone && stickNub) {
            stickZone.style.display = 'block';
            stickZone.style.left = `${t.clientX}px`;
            stickZone.style.top = `${t.clientY}px`;
            stickNub.style.transform = `translate(0px, 0px)`;
          }
        } else if (t.clientX >= window.innerWidth * 0.45 && this.rightTouchId === null) {
          // Check if not touching an action button
          const target = document.elementFromPoint(t.clientX, t.clientY);
          if (target && target.closest('button')) continue;
          this.rightTouchId = t.identifier;
          this.rightLast = { x: t.clientX, y: t.clientY };
        }
      }
    }, { passive: false });

    overlay.addEventListener('touchmove', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === this.leftTouchId) {
          this.stickCurrent = { x: t.clientX, y: t.clientY };
          const dx = t.clientX - this.stickCenter.x;
          const dy = t.clientY - this.stickCenter.y;
          const dist = Math.hypot(dx, dy);
          const maxR = 45;
          const clampedDist = Math.min(dist, maxR);
          const angle = Math.atan2(dy, dx);
          const nx = Math.cos(angle) * clampedDist;
          const ny = Math.sin(angle) * clampedDist;
          if (stickNub) {
            stickNub.style.transform = `translate(${nx}px, ${ny}px)`;
          }
        } else if (t.identifier === this.rightTouchId) {
          const dx = t.clientX - this.rightLast.x;
          const dy = t.clientY - this.rightLast.y;
          const sens = CONFIG.auv.touchSensitivity;
          this.mouseLook.x += dx * sens;
          this.mouseLook.y += dy * sens;
          this.rightLast = { x: t.clientX, y: t.clientY };
        }
      }
    }, { passive: false });

    const endTouch = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === this.leftTouchId) {
          this.leftTouchId = null;
          if (stickZone) stickZone.style.display = 'none';
        } else if (t.identifier === this.rightTouchId) {
          this.rightTouchId = null;
        }
      }
    };
    overlay.addEventListener('touchend', endTouch);
    overlay.addEventListener('touchcancel', endTouch);
  }

  update() {
    let surge = 0;
    let sway = 0;
    let heave = 0;
    let yaw = 0;
    let pitch = 0;

    // Keyboard Surge (W/S)
    if (this.keys.has('KeyW')) surge += 1;
    if (this.keys.has('KeyS')) surge -= 1;

    // Keyboard Sway (A/D)
    if (this.keys.has('KeyD')) sway += 1;
    if (this.keys.has('KeyA')) sway -= 1;

    // Keyboard Heave (Space/Shift, E/Q)
    if (this.keys.has('Space') || this.keys.has('KeyE')) heave += 1;
    if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.keys.has('KeyQ')) heave -= 1;

    // Arrow steering
    if (this.keys.has('ArrowRight')) yaw -= 1;
    if (this.keys.has('ArrowLeft')) yaw += 1;
    if (this.keys.has('ArrowUp')) pitch -= 1;
    if (this.keys.has('ArrowDown')) pitch += 1;

    // Fire key
    if (this.keys.has('KeyF')) {
      this.state.firing = true;
    }

    // Touch stick overlay
    if (this.leftTouchId !== null) {
      const dx = this.stickCurrent.x - this.stickCenter.x;
      const dy = this.stickCurrent.y - this.stickCenter.y;
      const maxR = 45;
      sway += Math.min(1, Math.max(-1, dx / maxR));
      surge += Math.min(1, Math.max(-1, -dy / maxR));
    }

    if (this.touchHeave !== 0) heave += this.touchHeave;
    if (this.touchFiring) this.state.firing = true;

    this.state.surge = Math.min(1, Math.max(-1, surge));
    this.state.sway = Math.min(1, Math.max(-1, sway));
    this.state.heave = Math.min(1, Math.max(-1, heave));
    this.state.yaw = Math.min(1, Math.max(-1, yaw));
    this.state.pitch = Math.min(1, Math.max(-1, pitch));

    this.state.lookX = this.mouseLook.x;
    this.state.lookY = this.mouseLook.y;

    // Reset single-frame deltas
    this.mouseLook.x = 0;
    this.mouseLook.y = 0;

    const out = { ...this.state };
    this.state.cameraToggle = false;
    this.state.pauseToggle = false;
    return out;
  }
}
