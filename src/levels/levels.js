/**
 * Data definitions for the 3 playable research levels.
 */
export const LEVELS = [
  {
    id: 1,
    name: 'Geneva Marina: Boat Launch',
    subtitle: 'Clear Water — Early Detection & Dock Inspection',
    description: 'Inspect wooden dock pilings and boat launch shoals for recently arrived Quagga mussels. Practice Edge-AI classification and hydro-vacuum harvesting.',
    seed: 42,
    timeLimit: 120, // seconds
    clarity: 1.0,
    allowedTools: ['vacuum', 'sprayer'],
    spawn: { x: 0, y: -2.5, z: 12, yaw: 0 },
    dock: { x: 0, y: -0.5, z: 10, radius: 4.5 },
    water: {
      fogColor: 0x146b80,
      fogDensity: 0.032,
      skyColor: 0xb5f2ff,
      groundColor: 0x2d3a30,
      ambient: 1.2,
      sun: 1.8,
      caustics: 0.65,
      exposure: 1.15,
      snowColor: 0xdff8ff,
      snowOpacity: 0.5,
      snowSize: 0.06,
    },
    floor: {
      base: -6.5,
      amp: 1.2,
      freq: 0.035,
      sandTint: [0.68, 0.62, 0.46],
      algae: 0.2,
      shore: { axis: 'z', sign: 1, start: 5, end: 35, rise: 3.5 },
    },
    features: {
      dockPoles: true,
      rocks: 8,
      pipe: false,
    },
    mussels: {
      quaggaClusters: 7, // ~30-40 quaggas
      zebraClusters: 5,  // established population
      nativeClusters: 2, // few natives in boat launch
    },
    fishSchools: 2,
  },
  {
    id: 2,
    name: 'Mendota Shoals: Mussel Sanctuary',
    subtitle: 'Rocky Reef — Endangered Native Unionid Protection',
    description: 'A delicate ecological reef with high populations of native Unionids and yellow perch. Chemical tools are strictly RESTRICTED to prevent collateral damage. Vacuum only!',
    seed: 108,
    timeLimit: 150,
    clarity: 0.85,
    allowedTools: ['vacuum'], // Chemical sprayer disabled
    spawn: { x: -8, y: -3.5, z: 10, yaw: -0.4 },
    dock: { x: -8, y: -1.0, z: 10, radius: 4.5 },
    water: {
      fogColor: 0x0f5b66,
      fogDensity: 0.045,
      skyColor: 0x8be5ea,
      groundColor: 0x22352b,
      ambient: 0.95,
      sun: 1.4,
      caustics: 0.5,
      exposure: 1.05,
      snowColor: 0xc8f0f0,
      snowOpacity: 0.6,
      snowSize: 0.08,
    },
    floor: {
      base: -8.0,
      amp: 2.2,
      freq: 0.04,
      sandTint: [0.55, 0.52, 0.40],
      algae: 0.45,
    },
    features: {
      dockPoles: false,
      rocks: 22,
      pipe: false,
    },
    mussels: {
      quaggaClusters: 9,
      zebraClusters: 8,
      nativeClusters: 10, // Rich native beds
    },
    fishSchools: 5,
  },
  {
    id: 3,
    name: 'Turbid Intake: Deep Biofouling',
    subtitle: 'Murky Industrial Intake — Camouflaged Crusts',
    description: 'A deep municipal water intake pipe with low visibility and heavy zebra mussel encrustation. Use the Chemical Micro-Sprayer to dissolve stubborn biofouling on hard steel.',
    seed: 256,
    timeLimit: 140,
    clarity: 0.48, // Murky water degrades AI confidence
    allowedTools: ['vacuum', 'sprayer'],
    spawn: { x: 0, y: -4.0, z: 15, yaw: 0 },
    dock: { x: 0, y: -1.0, z: 15, radius: 4.5 },
    water: {
      fogColor: 0x1b382b, // Murky green-brown
      fogDensity: 0.075,
      skyColor: 0x6e997a,
      groundColor: 0x1c2b20,
      ambient: 0.7,
      sun: 0.9,
      caustics: 0.25,
      exposure: 0.95,
      snowColor: 0xa8c4aa,
      snowOpacity: 0.85,
      snowSize: 0.11,
    },
    floor: {
      base: -10.5,
      amp: 1.5,
      freq: 0.03,
      sandTint: [0.42, 0.45, 0.35],
      algae: 0.65,
    },
    features: {
      dockPoles: false,
      rocks: 10,
      pipe: true, // Concrete/steel water intake pipe
    },
    mussels: {
      quaggaClusters: 12,
      zebraClusters: 14, // Dense camouflage
      nativeClusters: 3,
      encrusted: true,
    },
    fishSchools: 3,
  },
];
