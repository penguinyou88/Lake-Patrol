import { CONFIG } from '../config.js';

/**
 * Score engine and FLL Judge debrief metrics generator.
 * Tracks ecological outcomes, penalties, battery efficiency, and research takeaways.
 */
export class ScoreEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.score = 0;
    this.quaggasRemoved = 0;
    this.zebrasRemoved = 0;
    this.nativesHarmed = 0;
    this.fishHarmed = 0;
    this.chemicalMisuses = 0;

    this.initialQuaggas = 0;
    this.initialNatives = 0;
    this.initialFish = 0;

    this.bankedQuaggas = 0;
    this.bankedZebras = 0;
    this.batterySpent = 0;
  }

  initLevel(musselField, marineLife) {
    this.reset();
    this.initialQuaggas = musselField.count('quagga');
    this.initialNatives = musselField.count('native');
    this.initialFish = marineLife.aliveCount();
  }

  recordRemoval(species) {
    if (species === 'quagga') {
      this.quaggasRemoved++;
      this.score += CONFIG.scoring.quagga;
    } else if (species === 'zebra') {
      this.zebrasRemoved++;
      this.score += CONFIG.scoring.zebra; // 0 in Wisconsin baseline
    }
  }

  recordNativeHarm() {
    this.nativesHarmed++;
    this.score += CONFIG.scoring.nativeHarm;
  }

  recordFishHarm() {
    this.fishHarmed++;
    this.score += CONFIG.scoring.fishHarm;
  }

  recordChemicalMisuse() {
    this.chemicalMisuses++;
    this.score += CONFIG.scoring.chemicalMisuse;
  }

  bankHopper(hopper) {
    this.bankedQuaggas += hopper.quagga;
    this.bankedZebras += hopper.zebra;
    hopper.quagga = 0;
    hopper.zebra = 0;
  }

  /**
   * Final debrief summary prepared for the FLL presentation modal.
   */
  getDebrief(remainingSeconds = 0, currentBattery = 100, currentHopper = { quagga: 0, zebra: 0 }) {
    // Unbanked hopper mussels lose 50% value
    const unbankedQuaggaPenalty = Math.round(currentHopper.quagga * CONFIG.scoring.quagga * (1 - CONFIG.hopper.unbankedFactor));
    const finalScore = Math.max(0, this.score - unbankedQuaggaPenalty + (this.quaggasRemoved === this.initialQuaggas ? remainingSeconds * CONFIG.scoring.timeBonusPerSec : 0));

    const interceptionRate = this.initialQuaggas > 0 ? Math.round((this.quaggasRemoved / this.initialQuaggas) * 100) : 100;
    const nativeSurvival = this.initialNatives > 0 ? Math.max(0, Math.round(((this.initialNatives - this.nativesHarmed) / this.initialNatives) * 100)) : 100;
    const fishSurvival = this.initialFish > 0 ? Math.max(0, Math.round(((this.initialFish - this.fishHarmed) / this.initialFish) * 100)) : 100;

    const batteryUsed = Math.max(1, 100 - currentBattery);
    const efficiency = (finalScore / batteryUsed).toFixed(1);

    let stars = 1;
    if (interceptionRate >= 75 && nativeSurvival >= 95 && fishSurvival >= 95) stars = 2;
    if (interceptionRate >= 95 && nativeSurvival === 100 && fishSurvival === 100 && this.chemicalMisuses === 0) stars = 3;

    return {
      finalScore,
      stars,
      quaggasRemoved: this.quaggasRemoved,
      initialQuaggas: this.initialQuaggas,
      zebrasRemoved: this.zebrasRemoved,
      interceptionRate,
      nativeSurvival,
      fishSurvival,
      nativesHarmed: this.nativesHarmed,
      fishHarmed: this.fishHarmed,
      chemicalMisuses: this.chemicalMisuses,
      batteryUsed: Math.round(batteryUsed),
      efficiency,
      takeaways: [
        {
          title: 'eDNA Veliger Plume Detection',
          desc: 'Micro-acoustic & eDNA sensing detects microscopic larvae before adult colonies form dense biofouling crusts.',
        },
        {
          title: 'Edge-AI Computer Vision',
          desc: 'Real-time morphological classification (fan outline vs sharp D-carina) prevents non-target mortality of endangered native Unionids.',
        },
        {
          title: 'Selective Physical Extraction',
          desc: 'High-volume hydro-vacuuming with onboard hopper banking eliminates invasive biomass without introducing persistent chemical toxins into freshwater ecosystems.',
        },
      ],
    };
  }
}
