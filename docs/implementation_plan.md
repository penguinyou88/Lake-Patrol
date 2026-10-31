# Phantom Bots: Lake Patrol — Implementation Plan

A technical blueprint for a browser-based 3D simulation game showcasing the Phantom Bots FIRST LEGO League (FLL) research project: an Autonomous Underwater Vehicle (AUV) that **detects** invasive quagga mussels (eDNA + Edge-AI vision) and **removes** them without harming native species.

---

## 0. Review Notes (Changes from v1)

| Area | v1 | Refined |
| --- | --- | --- |
| Project root | `quagga-intercept/` sub-folder | Repo root (`Lake-Patrol/`) |
| Vite base path | Hard-coded repo name | `base: './'` (relative), so the same build works on GitHub Pages, Vercel, and itch.io |
| 3D models | `.glb` files | **Procedural geometry only** (no model files to make, license, or load). Shells use canvas-generated textures |
| Audio | `.mp3` files | **Synthesized with Web Audio** (sonar ping, thruster hum, vacuum, klaxon). Nothing to download |
| "6-DOF" | Undefined roll | 5 player-controlled axes (surge, sway, heave, yaw, pitch) + automatic cosmetic roll/banking with self-leveling. Easier to fly |
| Touch / iPad | Claimed, not specified | Virtual joystick (move), drag-to-look, heave buttons, fire button, tool buttons |
| Battery | Mentioned only in `config.js` | Fully specified drain model + recharge at dock (§2-D) |
| Hopper | Mentioned only | Capacity limit; empty it at the dock. Creates a "plan your route" loop |
| Win / loss | Undefined | Mission timer, battery depletion, or all quaggas cleared → debrief (§2-E) |
| Zebra score | 0 | Kept at **0**: zebras are already established in these Wisconsin lakes, so the mission targets the new quagga front. Vacuuming zebras still uses battery and hopper space, which teaches target prioritization. A future "pre-invasion lake" level could score them via `levels.js` |
| Chemical rules | "Enters radius within 5 s" (unclear) | A toxic cloud lingers 5 s. Each native/fish inside it at any moment is harmed once (§2-C) |
| AI realism | Fixed confidence values | Confidence depends on distance, turbidity, and viewing angle. Below a threshold it shows `UNCERTAIN`, which teaches that AI needs a human (or a closer look) in the loop |
| Education | Debrief only | Title screen **Field Guide** (species ID cards) + debrief "Research Takeaways" for judges |
| Accessibility | Color-only reticles | Text label + distinct reticle **shape** per class (corners / dashed / X), so it is colorblind-safe |
| Performance | — | `InstancedMesh` for mussels, pixel ratio capped at 1.75, no shadow maps, ≤ ~1,500 instances per level |

---

## 1. Architecture & Tech Stack

### Engine: Three.js + Vite (HTML5 / WebGL), vanilla JavaScript (ES modules)

* **Zero-install judge access:** runs in any modern browser (iPad, Chromebook, laptop, phone).
* **Agent-friendly:** small, plain JS modules with clear responsibilities.
* **No asset pipeline:** all geometry, textures, and audio are generated at runtime.

```
Lake-Patrol/
├── index.html                  # Canvas container + HUD/menu DOM
├── package.json                # three, vite (dev), gh-pages (dev)
├── vite.config.js              # base: './'
├── public/favicon.svg
├── docs/implementation_plan.md
└── src/
    ├── main.js                 # Boot, game loop, state machine (title → playing → paused → debrief)
    ├── config.js               # Balancing: scoring, battery, tool, physics constants
    ├── core/
    │   ├── SceneManager.js     # Renderer, camera rig, fog, lights, caustics, marine snow
    │   ├── InputManager.js     # Keyboard, mouse (pointer lock / drag), touch controls
    │   └── AudioManager.js     # Web Audio synth: ping, hum, vacuum, klaxon
    ├── world/
    │   ├── Terrain.js          # Procedural lakebed heightfield, rocks, dock pilings, intake pipe
    │   └── Textures.js         # Canvas-generated textures (shell banding, sand, concrete)
    ├── entities/
    │   ├── AUV.js              # Hull mesh, thrusters, headlights, kinematics, battery, hopper
    │   ├── MusselField.js      # InstancedMesh per species, per-instance state (alive, hp, cluster)
    │   ├── MusselGeometry.js   # Procedural quagga / zebra / unionid shell geometry
    │   └── MarineLife.js       # Yellow perch schools on wandering spline paths
    ├── systems/
    │   ├── DetectionAI.js      # Frustum + range test, 3D→2D projection, confidence model
    │   ├── EDNASystem.js       # Scalar concentration field, minimap heatmap, ping rate
    │   ├── ToolSystem.js       # Hydro-vacuum cone, chemical sprayer + toxic clouds
    │   └── ScoreEngine.js      # Events → score, penalties, debrief metrics
    ├── ui/
    │   ├── HUD.js              # Telemetry, battery, hopper, tool selector, minimap, toasts
    │   ├── Menus.js            # Title, field guide, level select, pause, debrief modal
    │   └── styles.css          # Sci-fi tactical glass UI
    └── levels/
        ├── LevelBase.js        # Builds the world from a level definition and checks win/loss
        └── levels.js           # Data definitions: Level 1 Marina, Level 2 Shoals, Level 3 Intake
```

Levels are **data-driven** (fog, clarity, spawn tables, allowed tools, timer), so new levels need no new code.

---

## 2. Core Subsystem Specifications

### A. Underwater Environment & AUV Physics

* **Visuals:** `FogExp2` color/density per level. Animated caustic texture projected on the lakebed. ~1,500 "marine snow" points wrap around the camera. Hemisphere ambient light + sun directional light that fades with depth.
* **Kinematics:** body-frame thrust → world acceleration. Exponential drag (`v *= exp(-drag·dt)`). Yaw and pitch rates are smoothed, pitch is clamped to ±60°, and roll banks into yaw turns, then self-levels. The AUV collides with the lakebed (height sample) and the surface ceiling.
* **Controls (desktop):** `W/S` surge, `A/D` sway, `Space`/`Shift` (or `E`/`Q`) heave, mouse (click to lock the pointer) or arrow keys for yaw/pitch, `1`/`2` select tool, hold left mouse button or `F` to fire, `C` switches camera (chase / nose-cam), `Esc` pauses.
* **Controls (touch):** left virtual stick (surge/sway), right-half drag (look), ▲▼ heave buttons, FIRE button, tool buttons.
* **Headlights:** two `SpotLight`s on the nose, aimed slightly down.

### B. Multi-Modal Detection

* **eDNA (micro):** concentration `C(p) = Σ C₀·n_alive / (1 + k·d²)` over live quagga clusters. The minimap shows a 48×48 heat grid (blue → yellow → red), refreshed at 4 Hz. Sonar ping interval goes from 2.0 s (low) to 0.25 s (high). Clearing clusters visibly cools the map.
* **Edge-AI vision (macro):** a candidate is in the camera frustum, within range (8 m × level clarity), and among the nearest 16. Its world box projects to a screen rect on a 2D canvas overlay.
  * `confidence = base − distancePenalty − turbidityPenalty − anglePenalty + jitter` (clamped to 0.35–0.99).
  * Labels: `QUAGGA 94%` (green, corner brackets), `ZEBRA 88%` (amber, dashed box), `NATIVE UNIONID 97%` (red, flashing X-box). Below 0.6 it shows grey `UNCERTAIN`.

### C. Eradication Tools

| Tool | Behavior | Battery | Notes |
| --- | --- | --- | --- |
| **Hydro-Vacuum** | Cone (3.5 m, 25°). Mussels inside lose HP. At 0 HP they shrink and fly into the nozzle → hopper | 4 %/s while firing | No collateral damage. A native mussel **directly** vacuumed is harmed. Encrusted clusters (on pipes) take 3× longer |
| **Chemical Micro-Sprayer** | 1 s spray creates a toxic cloud (radius 3 m) at the aim point. It kills all invasives inside within ~1 s. Cloud lingers 5 s | 6 % per spray, 1.5 s cooldown | Each native mussel/fish inside the cloud at any time is harmed **once**. A spray that harms anything also counts as a misuse event. Disabled in Level 2 (sanctuary) |

### D. Battery, Hopper & Dock

* Battery 100 %. Drain: idle 0.15 %/s, thrust up to +0.5 %/s, tools as above.
* Hopper capacity: 40 mussels. When full, the vacuum stops working.
* **Dock station** (glowing ring near spawn): while inside it, battery recharges at 8 %/s and the hopper empties, which **banks** its contents. Mussels still in the hopper when the mission ends count at 50 %.
* At 0 % battery the AUV goes into emergency surface mode → mission ends.

### E. Scoring & Mission Flow

| Event | Points |
| --- | --- |
| Quagga removed | +100 |
| Zebra removed | 0 (configurable per level; established population) |
| Chemical misuse event | −150 |
| Native unionid harmed | −300 |
| Fish harmed | −150 |
| Time bonus (all quaggas cleared) | +5 per remaining second |

* **End conditions:** all quaggas cleared, mission timer expires, or battery is depleted.
* **Debrief (FLL Judge Scorecard):** Interception Rate (% quaggas removed), Native Survival %, Fish Survival %, Eco-Score, Battery Efficiency (points per % battery), star rating (1–3), plus 3 "Research Takeaways" tied to the team's project.

---

## 3. Roadmap & Status

### Phase 1: Engine Foundation & AUV Controller
- [x] Vite + Three.js project, relative base path
- [x] Underwater scene: fog, lights, caustics, marine snow, procedural lakebed
- [x] AUV mesh from primitives + headlights
- [x] Kinematics with drag, banking, terrain collision; chase / nose camera
- [x] Keyboard, mouse, and touch input

### Phase 2: Biological Entities
- [x] Procedural shell geometry (quagga / zebra / unionid) + canvas textures
- [x] Instanced clusters on rocks, pilings, intake pipe, sand
- [x] Yellow perch schools

### Phase 3: Sensors & HUD
- [x] Tactical HUD (depth, heading, speed, battery, hopper, tool, timer, score)
- [x] Edge-AI bounding boxes with confidence model
- [x] eDNA field, minimap heatmap, sonar ping

### Phase 4: Tools & Scoring
- [x] Hydro-vacuum with suction particles + hopper
- [x] Chemical sprayer + toxic clouds + collateral checks
- [x] Score engine + debrief modal
- [x] Dock recharge / hopper banking

### Phase 5: Levels, Audio & Polish
- [x] Level 1 Geneva Marina, Level 2 Mendota Shoals, Level 3 Turbid Intake (data-driven)
- [x] Synth audio (sonar ping, thrusters, vacuum, fizz, warning klaxon, dock chime)
- [x] Title screen, field guide, level select, pause modal
- [x] Balance pass (flight physics, battery drain, hopper capacity, scoring penalties)
- [x] Level 1 Interactive Tactical Tutorial (piloting, eDNA heatmap, Edge-AI reticles, vacuum & docking)
- [x] Local High Scores & Progress Persistence (`localStorage` record tracking, star ratings, new record debrief banner)
- [x] FLL Trifold Presentation QR Card modal (client-side SVG QR generator, printable 4x6" trifold card format, customizable simulation URL)
- [x] SVG Favicon and mobile touch optimizations
- [x] Production build verification (`dist/` relative paths ready for GitHub Pages, Vercel, or itch.io)

---

## 4. Running Locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs dist/
```

---

## 5. Hosting & Deployment

Because `base: './'` is relative, the same `dist/` works everywhere.

### Option 1: GitHub Pages (recommended for FLL)
1. `npm run deploy` (runs `vite build && gh-pages -d dist`).
2. In GitHub → Settings → Pages, set the source to the `gh-pages` branch.
3. The game is live at `https://<user>.github.io/Lake-Patrol/`. Put a QR code to this URL on the trifold.

### Option 2: Vercel
Import the GitHub repo. Vercel auto-detects Vite. You get automatic redeploys on every push.

### Option 3: itch.io
`npm run build`, zip the **contents** of `dist/`, upload as an HTML project, and check "played in the browser".
