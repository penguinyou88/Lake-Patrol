/**
 * Web Audio synthesized sound effects: zero external audio files.
 * Generates thruster hum, sonar pings, hydro-vacuum suction, chemical spray fizz,
 * warning klaxons, and collection chimes.
 */
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.masterGain = null;

    // Continuous sound nodes
    this.thrusterGain = null;
    this.vacuumGain = null;
    this.vacuumFilter = null;
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.ctx = new AudioContext();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // Thruster continuous hum (filtered low drone)
    const thrusterOsc = this.ctx.createOscillator();
    thrusterOsc.type = 'sawtooth';
    thrusterOsc.frequency.setValueAtTime(55, this.ctx.currentTime); // Low A

    const thrusterFilter = this.ctx.createBiquadFilter();
    thrusterFilter.type = 'lowpass';
    thrusterFilter.frequency.setValueAtTime(120, this.ctx.currentTime);

    this.thrusterGain = this.ctx.createGain();
    this.thrusterGain.gain.setValueAtTime(0.001, this.ctx.currentTime);

    thrusterOsc.connect(thrusterFilter);
    thrusterFilter.connect(this.thrusterGain);
    this.thrusterGain.connect(this.masterGain);
    thrusterOsc.start();
    this.thrusterOsc = thrusterOsc;

    // Vacuum continuous white noise rumble
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    this.vacuumFilter = this.ctx.createBiquadFilter();
    this.vacuumFilter.type = 'bandpass';
    this.vacuumFilter.frequency.setValueAtTime(400, this.ctx.currentTime);
    this.vacuumFilter.Q.setValueAtTime(1.5, this.ctx.currentTime);

    this.vacuumGain = this.ctx.createGain();
    this.vacuumGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);

    noiseSource.connect(this.vacuumFilter);
    this.vacuumFilter.connect(this.vacuumGain);
    this.vacuumGain.connect(this.masterGain);
    noiseSource.start();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setThruster(level) {
    if (!this.ctx || !this.thrusterGain) return;
    const now = this.ctx.currentTime;
    const targetGain = Math.max(0.001, level * 0.18);
    this.thrusterGain.gain.setTargetAtTime(targetGain, now, 0.08);
    const targetFreq = 50 + level * 45;
    this.thrusterOsc.frequency.setTargetAtTime(targetFreq, now, 0.1);
  }

  setVacuum(active) {
    if (!this.ctx || !this.vacuumGain) return;
    const now = this.ctx.currentTime;
    const targetGain = active ? 0.25 : 0.0001;
    this.vacuumGain.gain.setTargetAtTime(targetGain, now, 0.05);
  }

  playSonarPing(pitchMultiplier = 1.0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const baseFreq = 1250 * pitchMultiplier;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.65, now + 0.18);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  playCollectChime(species = 'quagga') {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    const freq = species === 'quagga' ? 880 : 587; // High A vs D
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.12);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  playSprayFizz() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const bufferSize = this.ctx.sampleRate * 0.5;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1400, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + 0.5);
  }

  playWarningKlaxon() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.setValueAtTime(320, now + 0.1);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  playDockTone() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => { // C-E-G major arpeggio
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(0.15, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.25);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.3);
    });
  }
}
