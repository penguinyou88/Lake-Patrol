import * as THREE from 'three';
import { CONFIG } from './config.js';
import { SceneManager } from './core/SceneManager.js';
import { InputManager } from './core/InputManager.js';
import { AudioManager } from './core/AudioManager.js';
import { AUV } from './entities/AUV.js';
import { DetectionAI } from './systems/DetectionAI.js';
import { EDNASystem } from './systems/EDNASystem.js';
import { ToolSystem } from './systems/ToolSystem.js';
import { ScoreEngine } from './systems/ScoreEngine.js';
import { TutorialSystem } from './systems/TutorialSystem.js';
import { LevelBase } from './levels/LevelBase.js';
import { LEVELS } from './levels/levels.js';
import { HUD } from './ui/HUD.js';
import { Menus } from './ui/Menus.js';

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.detectionCanvas = document.getElementById('detection-overlay');

    // Core managers
    this.sceneMgr = new SceneManager(this.canvas);
    this.inputMgr = new InputManager(this.canvas);
    this.audioMgr = new AudioManager();

    // Entities & Systems
    this.auv = new AUV();
    this.sceneMgr.scene.add(this.auv.group);

    this.detectionAI = new DetectionAI(this.detectionCanvas);
    this.ednaSystem = new EDNASystem(this.audioMgr);
    this.toolSystem = new ToolSystem(this.sceneMgr.scene, this.audioMgr);
    this.scoreEngine = new ScoreEngine();

    // UI
    this.hud = new HUD(this.ednaSystem);
    this.tutorial = new TutorialSystem(this.hud);
    this.menus = new Menus({
      onStartLevel: (id) => this.startLevel(id),
      onResume: () => this.resumeGame(),
      onRestartLevel: () => this.startLevel(this.currentLevelId),
      onQuitToTitle: () => this.quitToTitle(),
      onNextLevel: () => this.startLevel(this.currentLevelId + 1),
    });

    // State
    this.state = 'title'; // 'title' | 'playing' | 'paused' | 'debrief'
    this.currentLevelId = 1;
    this.currentLevel = null;
    this.remainingTime = 120;
    this.clock = new THREE.Clock();

    // Docking state
    this.wasInDock = false;

    // Load initial level for title screen background
    this.loadLevelData(1);

    // Start loop
    requestAnimationFrame((t) => this.loop(t));
  }

  loadLevelData(levelId) {
    if (this.currentLevel) {
      this.sceneMgr.scene.remove(this.currentLevel.group);
      this.currentLevel.dispose();
      this.currentLevel = null;
    }

    const def = LEVELS.find((l) => l.id === levelId) || LEVELS[0];
    this.currentLevelId = def.id;
    this.currentLevel = new LevelBase(def);
    this.sceneMgr.scene.add(this.currentLevel.group);

    // Apply water settings
    this.sceneMgr.applyWater(def.water);

    // Reset AUV
    this.auv.reset(def.spawn);

    // Position camera
    this.sceneMgr.updateCamera(0.016, this.auv, this.currentLevel.heightAt, true);

    // Reset score engine
    this.scoreEngine.initLevel(this.currentLevel.musselField, this.currentLevel.marineLife);

    this.remainingTime = def.timeLimit;
  }

  startLevel(levelId) {
    this.audioMgr.init();
    this.audioMgr.resume();

    this.loadLevelData(levelId);
    this.state = 'playing';
    this.hud.show();
    this.hud.showToast(`MISSION 0${this.currentLevelId}: ${this.currentLevel.def.name.toUpperCase()}`, 'info', 4.0);
    this.tutorial.start(this.currentLevelId);
  }

  resumeGame() {
    this.state = 'playing';
    this.audioMgr.resume();
  }

  quitToTitle() {
    this.state = 'title';
    this.hud.hide();
    this.tutorial.dismiss();
    this.audioMgr.setThruster(0);
    this.audioMgr.setVacuum(false);
  }

  loop(currentTime) {
    requestAnimationFrame((t) => this.loop(t));

    const dt = Math.min(0.05, this.clock.getDelta());
    const time = this.clock.getElapsedTime();

    if (this.state === 'title') {
      // Gentle orbit camera around dock
      this.sceneMgr.updateOrbit(time, this.currentLevel.def.dock, this.currentLevel.heightAt);
      this.sceneMgr.update(dt, time);
      this.currentLevel.update(dt, time, this.sceneMgr.camera.position);
      this.sceneMgr.render();
      return;
    }

    if (this.state === 'paused') {
      return;
    }

    if (this.state === 'playing') {
      const input = this.inputMgr.update();

      // Pause toggle
      if (input.pauseToggle) {
        this.state = 'paused';
        this.menus.showPause();
        this.audioMgr.setThruster(0);
        this.audioMgr.setVacuum(false);
        return;
      }

      // Camera toggle
      if (input.cameraToggle) {
        const mode = this.sceneMgr.toggleCamera();
        this.hud.showToast(`CAMERA: ${mode.toUpperCase()} VIEW`, 'info', 1.5);
      }

      // Mission Timer
      this.remainingTime -= dt;

      // Passive battery drain
      this.auv.drain(CONFIG.battery.idleDrain * dt);
      if (this.auv.thrustLevel > 0) {
        this.auv.drain(CONFIG.battery.thrustDrain * this.auv.thrustLevel * dt);
      }

      // AUV Kinematics
      const worldInfo = {
        heightAt: this.currentLevel.heightAt,
        colliders: this.currentLevel.colliders,
        bounds: CONFIG.world.size * 0.48,
      };
      this.auv.update(dt, input, worldInfo);

      // Docking check: recharge & empty hopper
      const inDock = this.currentLevel.isInsideDock(this.auv.position);
      if (inDock) {
        if (!this.wasInDock) {
          this.audioMgr.playDockTone();
          this.hud.showToast('DOCKING DOME: RECHARGING & BANKING HOPPER', 'dock', 3.0);
        }
        // Recharge battery
        this.auv.battery = Math.min(100, this.auv.battery + CONFIG.battery.dockRecharge * dt);

        // Bank hopper
        if (this.auv.hopperCount > 0) {
          this.scoreEngine.bankHopper(this.auv.hopper);
        }
      }
      this.wasInDock = inDock;

      // Low battery / emergency check
      if (this.auv.battery <= 0 && !this.auv.emergency) {
        this.auv.emergency = true;
        this.audioMgr.playWarningKlaxon();
        this.hud.showToast('BATTERY DEPLETED — EMERGENCY ASCENT ENGAGED', 'warning', 4.0);
      }

      // Eradication Tools
      this.toolSystem.update(
        dt,
        input,
        this.auv,
        this.currentLevel.musselField,
        this.currentLevel.marineLife,
        this.scoreEngine,
        this.currentLevel.def
      );

      // Level world updates (mussels animation, fish swimming)
      this.currentLevel.update(dt, time, this.auv.position);

      // eDNA System
      this.ednaSystem.update(dt, this.auv.position, this.currentLevel.musselField);

      // Edge-AI Vision Detection
      this.detectionAI.update(
        this.sceneMgr.camera,
        this.currentLevel.musselField,
        this.currentLevel.def.clarity,
        time
      );

      // Tutorial guidance update (for Level 1)
      this.tutorial.update(dt, this.auv, input, this.detectionAI.detections.length, inDock);

      // Camera follow
      this.sceneMgr.updateCamera(dt, this.auv, this.currentLevel.heightAt);

      // Audio engine continuous sounds
      this.audioMgr.setThruster(this.auv.thrustLevel);

      // Update HUD
      this.hud.update(
        dt,
        this.auv,
        this.currentLevel,
        this.scoreEngine,
        Math.max(0, this.remainingTime),
        input.tool
      );

      // 3D & 2D Renders
      this.sceneMgr.update(dt, time);
      this.sceneMgr.render();
      this.detectionAI.render(time);

      // Check Mission Completion / Game Over conditions
      const aliveQuaggas = this.currentLevel.musselField.count('quagga', (i) => i.state === 'alive');
      const timeUp = this.remainingTime <= 0;
      const surfacedEmergency = this.auv.emergency && this.auv.position.y >= CONFIG.auv.ceiling - 0.1;

      if (aliveQuaggas === 0 || timeUp || surfacedEmergency) {
        this.endMission();
      }
    }
  }

  endMission() {
    this.state = 'debrief';
    this.tutorial.dismiss();
    this.audioMgr.setThruster(0);
    this.audioMgr.setVacuum(false);
    this.hud.hide();

    const debriefData = this.scoreEngine.getDebrief(
      Math.max(0, Math.round(this.remainingTime)),
      this.auv.battery,
      this.auv.hopper
    );

    this.menus.showDebrief(debriefData, this.currentLevelId);
  }
}

// Boot game when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
