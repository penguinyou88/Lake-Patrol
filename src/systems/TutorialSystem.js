/**
 * Interactive tutorial and tactical guidance system for Level 1 (Geneva Marina).
 * Walks first-time pilots through kinematics, eDNA sonar tracking, Edge-AI reticles,
 * and hopper banking at the dock station.
 */
export class TutorialSystem {
  constructor(hud) {
    this.hud = hud;
    this.enabled = false;
    this.step = 0;
    this.stepTimer = 0;
    this.hasMoved = false;
    this.hasFired = false;
    this.hasDocked = false;

    this.steps = [
      {
        id: 'piloting',
        badge: 'TUTORIAL 1/4: PILOTING',
        text: 'W/A/S/D thrust & strafe · Space/Shift (or E/Q) heave depth · Click to steer',
        minDuration: 5.0,
      },
      {
        id: 'edna',
        badge: 'TUTORIAL 2/4: eDNA SENSORS',
        text: 'Follow the top-right minimap heatmap (yellow/red) and sonar audio pings toward quagga colonies',
        minDuration: 6.0,
      },
      {
        id: 'vision',
        badge: 'TUTORIAL 3/4: EDGE-AI VISION',
        text: 'Green [ ] = Quagga (+100 PTS) · Amber = Zebra · Red [X] = Endangered Native (-300 PTS penalty!)',
        minDuration: 7.0,
      },
      {
        id: 'harvest',
        badge: 'TUTORIAL 4/4: EXTRACTION & DOCK',
        text: 'Hold Left-Click or [F] to vacuum. When hopper is full (40/40), return to glowing Dock ring to bank & recharge!',
        minDuration: 7.0,
      },
    ];
  }

  start(levelId) {
    if (levelId === 1) {
      this.enabled = true;
      this.step = 0;
      this.stepTimer = 0;
      this.hasMoved = false;
      this.hasFired = false;
      this.hasDocked = false;
      this.showCurrentStep();
    } else {
      this.enabled = false;
    }
  }

  showCurrentStep() {
    if (!this.enabled || this.step >= this.steps.length) return;
    const s = this.steps[this.step];
    this.hud.showTutorialToast(s.badge, s.text);
    this.stepTimer = s.minDuration;
  }

  update(dt, auv, input, detectionCount, inDock) {
    if (!this.enabled || this.step >= this.steps.length) return;

    this.stepTimer -= dt;

    if (this.step === 0) {
      if (auv.velocity.length() > 0.8) this.hasMoved = true;
      if (this.stepTimer <= 0 && this.hasMoved) {
        this.step++;
        this.showCurrentStep();
      }
    } else if (this.step === 1) {
      if (this.stepTimer <= 0) {
        this.step++;
        this.showCurrentStep();
      }
    } else if (this.step === 2) {
      if (detectionCount > 0 || this.stepTimer <= 0) {
        if (this.stepTimer <= 0) {
          this.step++;
          this.showCurrentStep();
        }
      }
    } else if (this.step === 3) {
      if (input.firing) this.hasFired = true;
      if (inDock && auv.hopperCount > 0) this.hasDocked = true;
      if (this.stepTimer <= 0 && (this.hasFired || this.hasDocked)) {
        this.step++;
        this.hud.hideTutorialToast();
        this.enabled = false;
      }
    }
  }

  dismiss() {
    this.enabled = false;
    this.hud.hideTutorialToast();
  }
}

