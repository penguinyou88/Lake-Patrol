# 🌊 Phantom Bots: Lake Patrol
### FIRST LEGO League (FLL) 2026 Research Simulation

An interactive 3D underwater autonomous vehicle (AUV) simulation demonstrating the **Phantom Bots** FLL research innovation: autonomous detection and selective eradication of invasive **Quagga mussels** (*Dreissena bugensis*) using **eDNA plume tracking** and **Edge-AI computer vision** to safeguard endangered native freshwater ecosystems without persistent chemical pollution.

🎮 **Live Simulation:** [https://penguinyou88.github.io/Lake-Patrol/](https://penguinyou88.github.io/Lake-Patrol/)

---

## 🕹️ How to Play

### 🎯 Mission Objective
Pilot the AUV through freshwater lakebeds to detect and remove invasive Quagga mussels before they outcompete native species and biofoul municipal water intake systems.

1. **Follow the eDNA Scent:** Watch the top-right minimap heat plume (Blue → Yellow → Red) and listen to your acoustic sonar pings. The ping rate accelerates as you approach live colonies.
2. **Classify Targets with Edge-AI:** Aim your nose cameras at bivalve clusters. On-device vision projects real-time bounding boxes with confidence scores.
3. **Selective Extraction:** Use your high-pressure **Hydro-Vacuum** to harvest quagga mussels directly into your onboard storage hopper.
4. **Dock & Recharge:** When your hopper fills (40/40 mussels) or battery runs low, return to the glowing cyan **Dock Station Dome** to recharge and bank your catch!

---

## ⌨️ Flight & Tool Controls

### Desktop (PC / Mac / Chromebook)
| Action | Key / Input | Notes |
|---|---|---|
| **Surge (Forward / Back)** | `W` / `S` | Thruster acceleration in look direction |
| **Sway (Strafe Left / Right)** | `A` / `D` | Lateral thrusters with auto-leveling roll banking |
| **Heave (Depth Up / Down)** | `Space` / `Shift` *(or `E` / `Q`)* | Ascend or descend through the water column |
| **Steer & Pitch (Look)** | **Mouse Click** *(locks pointer)* | Or use `Arrow Keys` for keyboard-only steering |
| **Equip Hydro-Vacuum** | `1` | Clean physical suction tool (cone 3.6m) |
| **Equip Chemical Sprayer** | `2` | Fast eradication cloud; restricted in sanctuaries |
| **Fire Active Tool** | Hold `Left Click` or `F` | Suctions mussels or sprays bio-treatment |
| **Toggle Camera** | `C` | Switch between 3rd-person Chase and Cockpit Nose-Cam |
| **Pause / Pilot Manual** | `Escape` | Pause mission, view instructions, or restart |

### Mobile & Tablet (iPad / Touchscreen)
* **Virtual Joystick (Left Side):** Touch and drag to thrust forward, backward, and strafe laterally.
* **Touch Look (Right Half):** Drag across the right side of the screen to smoothly aim the AUV and headlights.
* **Depth Buttons (`▲` / `▼`):** Heave ascend or descend.
* **Action Buttons:** Tap `1` or `2` to swap tools, hold `FIRE` to activate, and tap `CAM` to toggle camera views.

---

## 🔬 Species Identification & Scoring Rules

| Species | Reticle Color & Shape | FLL Ecological Context | Mission Score |
|---|---|---|:---:|
| **Invasive Quagga Mussel**<br>*(Dreissena bugensis)* | 🟩 **Green**<br>`[QUAGGA - 94%]`<br>Solid Corner Brackets | Rapidly colonizing Wisconsin lakes; displaces native biodiversity and smothers soft substrates. **Primary mission target!** | **+100 PTS** |
| **Established Zebra Mussel**<br>*(Dreissena polymorpha)* | 🟨 **Amber**<br>`- - ZEBRA - -`<br>Dashed Line Box | Established in Great Lakes basin since the 1990s. Harvesting them consumes battery and hopper space to teach target prioritization. | **0 PTS** |
| **Endangered Native Unionid**<br>*(Freshwater Mussels)* | 🟥 **Red (Flashing)**<br>`[X] NATIVE UNIONID [X]`<br>X-Braced Box | Essential freshwater keystone filter-feeders that aerate lakebed sediment. Direct vacuum or chemical harm is heavily penalized! | **-300 PTS** |
| **Native Yellow Perch**<br>*(Perca flavescens)* | Free-swimming schools | Native fish species sensitive to toxic chemical spray clouds. Harm penalty if caught in chemical mist. | **-150 PTS** |
| **Chemical Misuse Event** | System alert | Triggered when a chemical spray cloud touches any native organism or is deployed in a restricted sanctuary zone. | **-150 PTS** |
| **Time Bonus** | Remaining seconds | Bonus awarded for speed when 100% of quaggas are cleared. | **+5 PTS / sec** |

> ⚠️ **Hopper Banking Rule:** Mussels still held in the hopper when the mission ends only count for **50% of their score**. Always return to the Dock Station to bank them for 100% value!

---

## 🗂️ Playable Research Missions

1. **Mission 01: Geneva Marina (Boat Launch)**
   * *Conditions:* Clear water (100% clarity), shallow wooden dock pilings and shoals.
   * *Focus:* Learn basic flight kinematics, follow the eDNA heatmap, practice AI classification, and empty the hopper at the dock.
2. **Mission 02: Mendota Shoals (Mussel Sanctuary)**
   * *Conditions:* Rocky reef teeming with endangered native Unionids and swimming perch schools.
   * *Focus:* Chemical sprayers are **strictly locked/restricted**. High-precision hydro-vacuuming only!
3. **Mission 03: Turbid Intake (Deep Biofouling)**
   * *Conditions:* Murky water (48% clarity) around an industrial municipal water intake pipe encrusted with heavy zebra biofouling.
   * *Focus:* Turbid conditions reduce AI confidence (displaying `UNCERTAIN` until close inspection). Deploy the Chemical Micro-Sprayer to dissolve stubborn industrial crusts.

---

## 🛠️ Technology & Architecture

* **Engine:** Three.js (WebGL) + Vanilla ES Modules.
* **Rendering & PBR:** Unreal-style HDR Bloom (`UnrealBloomPass`), soft real-time directional shadows (`PCFSoftShadowMap`), normal-mapped procedural sand ripples, animated underwater eelgrass with vertex shader wave displacement, and volumetric god rays.
* **Audio:** 100% runtime procedural Web Audio synthesizer (sonar ping, thruster drone, vacuum noise rumble, chemical fizz, dock arpeggios, and alarm klaxons) with zero external audio assets.
* **Build System:** Vite (`base: './'`), zero-dependency static bundle suitable for GitHub Pages, Vercel, and offline judge kiosks.

---

## 💻 Local Development

```bash
# Install dependencies
npm install

# Start local dev server with hot reload
npm run dev

# Build production bundle in dist/
npm run build

# Deploy automatically to GitHub Pages
npm run deploy
```

---

## 🏆 FIRST LEGO League Presentation Tools

* **Printable Trifold QR Card:** Click **"TRIFOLD QR"** on the title screen or debrief modal to generate a live vector QR code card formatted for 4×6" presentation trifolds.
* **FLL Judge Scorecard:** Every run concludes with an analytical debrief displaying Interception Rate (%), Native Survival (%), Battery Efficiency (pts/% battery), Star Rating (1–3 ★), and team research takeaways.
