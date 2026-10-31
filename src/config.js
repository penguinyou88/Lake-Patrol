// Central balancing constants. Tune here; levels may override some values.
export const CONFIG = {
  world: {
    size: 140,          // lakebed width/depth in meters
    segments: 160,      // terrain resolution
    surfaceY: 0,
  },

  auv: {
    thrust: 7.0,        // m/s² forward/lateral
    verticalThrust: 4.5,
    boost: 1.6,         // multiplier while holding boost (R / double-tap)
    drag: 1.5,          // exponential velocity damping (1/s)
    yawRate: 1.7,       // rad/s at full arrow-key input
    pitchRate: 1.2,
    maxPitch: 1.05,     // ~60°
    mouseSensitivity: 0.0022,
    touchSensitivity: 0.006,
    radius: 0.75,
    ceiling: -0.6,      // keep below the surface
  },

  battery: {
    idleDrain: 0.12,    // % per second
    thrustDrain: 0.45,  // % per second at full thrust
    vacuumDrain: 3.2,   // % per second while firing
    sprayCost: 6,       // % per spray
    dockRecharge: 9,    // % per second inside the dock ring
    lowWarning: 25,
  },

  hopper: {
    capacity: 40,
    unbankedFactor: 0.5,  // unbanked hopper contents lose this share of value at mission end
  },

  tools: {
    vacuum: { range: 3.6, angleDeg: 26, damagePerSec: 1.0 },
    sprayer: { range: 7, cloudRadius: 3.0, cloudLife: 5, cooldown: 1.6, dissolveTime: 1.0 },
  },

  scoring: {
    quagga: 100,
    zebra: 0,             // established population in WI lakes — no reward (configurable per level)
    chemicalMisuse: -150,
    nativeHarm: -300,
    fishHarm: -150,
    timeBonusPerSec: 5,
  },

  mussels: {
    quagga: { length: 0.30, hp: 0.55 },
    zebra: { length: 0.27, hp: 0.55 },
    native: { length: 0.80, hp: 1.3 },
    encrustedMultiplier: 3,
  },

  detection: {
    baseRange: 9,
    maxBoxes: 16,
    uncertainThreshold: 0.6,
  },

  edna: {
    k: 0.012,           // dispersion falloff
    grid: 48,
    refreshHz: 4,
    pingMin: 0.28,      // seconds between pings at max concentration
    pingMax: 2.2,
  },
};
