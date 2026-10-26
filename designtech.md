# DESIGNTECH: THE CONECTSOL EDITORIAL & ELECTRIC DESIGN SYSTEM
> **Version:** 2.0.0 · Production Grade Engineering Specification  
> **Aesthetic Core:** *Monopo Saigon Editorial Silence × Industrial Solar Plasma Energy*  
> **Source of Truth:** Conectsol PDF Spreadsheet Extractor Codebase (`variables.css`, `style.css`, `tokens.json`, `app.js`, `tech-text.js`, `electric-logo.js`)

---

## 1. SYSTEM IDENTITY & DESIGN PHILOSOPHY

### 1.1 The Architectural Synthesis
This design system is born from the deliberate collision of two distinct visual paradigms:
1. **Monopo Saigon Editorial Restraint:** Radical monochrome discipline, pure `#000000` obsidian depths, whisper-thin neutral grays, generous 4px-based spatial rhythm, and architectural 0px corners on cards and layout containers.
2. **Conectsol Industrial Solar Precision:** High-voltage chromatic energy, liquid iridescence, molten amber glows (`#FFA439`), radiant solar flame (`#FF6A00`), institutional core orange (`#E35A00`), cybernetic laser scans, kinetic particle reactors, and electrostatic lightning simulations.

### 1.2 The Core Duality: 0px vs. 75px
The foundational signature of this interface is an unyielding geometric rule:
- **0px Sharp Radius:** Applied strictly to structural containers, layout boundaries, editorial cards, input fields, image frames, and table wrappers. It conveys architectural authority, industrial solidity, and computational precision.
- **75px Full-Pill Radius:** Applied exclusively to interactive gestures, buttons, status badges, telemetry chips, segmented tab switchers, and floating notifications. It creates tactile floating elements that hover like molten drops over deep space.

```
+-------------------------------------------------------------------------+
|  STRUCTURAL CONTAINER (0px Radius, 1px solid rgba(255,255,255,0.08))   |
|                                                                         |
|   +--------------------------+         ( ( ( [ 75px PILL BUTTON ] ) ) ) |
|   | 0px Sharp Data Card      |           Molten glow, tactile hover,    |
|   | Architectural precision  |           inverse interaction state      |
|   +--------------------------+                                          |
+-------------------------------------------------------------------------+
```

### 1.3 Editorial Silence vs. High-Tech Flare
- **Whitespace is Acoustic:** The page does not fill every pixel with noise. Large swathes of `#000000` provide visual silence so that typography and chromatic accents feel monumental rather than cluttered.
- **Lighting is Physical:** Light behaves according to simulated physics. Surfaces reflect cursor position with inertial dampening; dropzones tilt in 3D perspective; lasers sweep with specular glare; energy conduits pulse with traveling photons.
- **Data is Sacrosanct:** Numbers and technical codes are rendered in `JetBrains Mono` with `font-variant-numeric: tabular-nums`. Financial and technical tables are zero-clutter, high-contrast, and formatted natively for instant clipboard transfer into spreadsheet engines (Google Sheets, Excel).

---

## 2. CENTRALIZED DESIGN TOKENS (SOURCE OF TRUTH)

### 2.1 Color Palette & Semantic Roles

#### Base Monochrome Tokens (Monopo Core)
| Token Name | CSS Custom Property | Hex / RGBA | Role & Application |
|---|---|---|---|
| **Obsidian** | `--color-obsidian` | `#000000` | Pure black root background, page body, backdrop foundation, modal underlay |
| **Inkstone** | `--color-inkstone` | `#181818` | Softened black for footer surfaces, secondary cards, long-form reading blocks |
| **Paper** | `--color-paper` | `#ffffff` | Primary text, high-contrast headings, inverted button hover fills, table values |
| **Felt Gray** | `--color-felt-gray` | `#6d6d6d` | Muted annotations, step numbers, legal microcopy, empty-state placeholders |
| **Slate Pill** | `--color-slate-pill` | `#636363` | Neutral filled buttons, inactive chips, utilitarian confirm actions |
| **Ash Mist** | `--color-ash-mist` | `#9a9a9a` | Secondary text, inactive tab links, subtle border highlights |
| **Pewter** | `--color-pewter` | `#808080` | Mid-tone neutral for hover states and secondary metadata |

#### Conectsol Solar & Electric Tokens
| Token Name | CSS Custom Property | Hex / RGBA | Role & Application |
|---|---|---|---|
| **Conectsol Orange** | `--color-conectsol-orange` | `#E35A00` | Institutional brand core, active border accents, deep gradient stops |
| **Conectsol Glow** | `--color-conectsol-glow` | `#FF6A00` | Vibrant electric flame, laser scanner beam, pulse indicators, hover accents |
| **Conectsol Amber** | `--color-conectsol-amber` | `#FFA439` | High-legibility telemetry tags, code identifiers (`.col-code`), data highlights |
| **Electric Core** | `--color-electric-core` | `#FFF5E6` | Incandescent lightning centers, laser core highlights, particle spark heads |
| **Solar Halo Deep** | `--color-solar-halo` | `rgba(227, 90, 0, 0.28)` | Ambient radial glow breathing organically behind hero components |

#### Semantic & Audit Tokens
| Token Name | Value | Purpose |
|---|---|---|
| **Emerald Assurance** | `#34D399` / `rgba(52, 211, 153, 0.35)` | Automated audit pass banner, online indicator dots (`#00FF66`), success toast |
| **Negative Alert** | `#FF8080` / `#ef4444` | Negative credit balances in tables, error banners, missing parameter warnings |
| **Zero Balance** | `#6d6d6d` | Zero monetary/credit values (`0`) visually receding to prevent cognitive load |

#### Gradient Definitions
```css
/* Iridescent Chromatic Hero Wash (Molten Oxblood into Amber into Mint) */
--gradient-iridescent-fade: linear-gradient(
  90deg,
  rgb(160, 224, 171) 0%,
  rgb(255, 172, 46) 50%,
  rgb(165, 45, 37) 100%
);

/* Conectsol Master Copy CTA Gradient */
--gradient-solar-cta: linear-gradient(135deg, #E35A00 0%, #FF6A00 100%);
--gradient-solar-cta-hover: linear-gradient(135deg, #FF6A00 0%, #FFA439 100%);

/* Active Tab Indicator Gradient */
--gradient-active-tab: linear-gradient(
  135deg,
  rgba(227, 90, 0, 0.28) 0%,
  rgba(255, 106, 0, 0.12) 100%
);

/* High-Assurance Validation Banner */
--gradient-validation-emerald: linear-gradient(
  135deg,
  rgba(16, 44, 28, 0.75) 0%,
  rgba(8, 24, 15, 0.92) 100%
);

/* Kinetic Reactor Radial Depth */
--gradient-reactor-bg: radial-gradient(
  circle at 50% 40%,
  rgba(32, 16, 5, 0.95) 0%,
  #080808 100%
);
```

---

### 2.2 Typography Scale & Metrics
The typographic system pairs three disciplined typefaces:
1. **Primary Interface & Editorial:** `'Roobert'` / `'Inter'` (Humanist-geometric clarity, aperture balance)
2. **Atmospheric Counterpoint:** `'Raleway'` (Narrow elegance for sparse editorial accents)
3. **Telemetry & Tabular Data:** `'JetBrains Mono'` (Zero-variance width, monospaced precision, code identifiers)

```css
/* Font Family Declarations */
--font-roobert: 'Roobert', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
--font-raleway: 'Raleway', ui-sans-serif, sans-serif;
--font-mono: 'JetBrains Mono', "SFMono-Regular", Consolas, monospace;
```

#### Typographic Scale Hierarchy
| Level | Font Size | Line Height | Letter Spacing | Font Weight | Default Usage |
|---|---|---|---|---|---|
| **caption** | `12px` | `1.19` | `1.5px - 2.0px` | `400` / `500` | Uppercase eyebrow steps, metadata tags, badge labels |
| **body-sm** | `16px` | `1.15` | `0px` | `400` | Navigation links, button labels, table descriptions |
| **body** | `18px` | `1.21` (up to `1.6`) | `0px` | `300` / `400` | Editorial subtext, explanatory section descriptions |
| **subheading** | `39px` | `1.19` | `-0.5px` | `300` | Dropzone titles, error titles, card headers |
| **subheading-lg** | `45px` | `1.15` | `-0.8px` | `400` | Major feature dividers, secondary hero titles |
| **heading-sm** | `54px` | `1.39` | `-1.0px` | `400` | Tablet hero headlines, report summaries |
| **heading** | `78px` | `1.10` | `-1.5px` | `300` (**Whisper**) | Section titles ("Importar Relatórios", "Tabelas Extraídas") |
| **heading-lg** | `94px` | `0.76` | `-2.0px` | `400` (**Anchor**) | Dense typographic statements where lines nearly touch |
| **display** | `225px` | `1.25` | `0px` | `400` | Monumental single-word hero moments ("extração") |

---

### 2.3 Spatial Scale & Layout Dimensions
Based on a strict **4px unit increment** (`--spacing-unit: 4px`):

```css
/* Layout Constants */
--page-max-width: 1078px;
--section-gap: 46px;
--card-padding: 34px;
--element-gap: 14px;

/* Spacing Scale */
--spacing-8: 8px;     /* 2 units */
--spacing-12: 12px;   /* 3 units */
--spacing-16: 16px;   /* 4 units */
--spacing-20: 20px;   /* 5 units */
--spacing-24: 24px;   /* 6 units */
--spacing-28: 28px;   /* 7 units */
--spacing-34: 34px;   /* 8.5 units */
--spacing-40: 40px;   /* 10 units */
--spacing-48: 48px;   /* 12 units */
--spacing-64: 64px;   /* 16 units */
--spacing-68: 68px;   /* 17 units */
--spacing-152: 152px; /* 38 units */
```

---

### 2.4 Shadows, Glows & Luminescence

```css
/* Electric Glow Tokens */
--shadow-electric-glow: 0 0 24px rgba(255, 106, 0, 0.45);
--shadow-electric-intense: 0 0 45px rgba(255, 106, 0, 0.75);
--shadow-solar-halo: 0 0 32px rgba(227, 90, 0, 0.65), 0 0 65px rgba(255, 62, 0, 0.35);

/* Physical Surface Elevations */
--shadow-elevation-card: 0 16px 48px rgba(0, 0, 0, 0.75), 0 0 24px rgba(227, 90, 0, 0.04);
--shadow-elevation-hover: 0 20px 56px rgba(0, 0, 0, 0.85), 0 0 36px rgba(255, 106, 0, 0.14);
--shadow-dropzone-3d: 0 10px 40px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05);
--shadow-dropzone-dragover: 0 0 50px rgba(255, 106, 0, 0.55), inset 0 0 25px rgba(255, 106, 0, 0.2);
```

---

### 2.5 Motion, Timing & Physics Constants

```css
/* Signature Easing Curve */
--ease-editorial: cubic-bezier(0.19, 1, 0.22, 1);
--ease-standard: ease;
--ease-linear: linear;

/* Durations */
--duration-fast: 0.22s;
--duration-medium: 0.4s;
--duration-long: 0.85s;
--duration-epic: 1.6s;
```

---

## 3. ATMOSPHERIC SURFACES & LIGHTING ENGINEERING

### 3.1 The Multi-Layer Hero Backdrop
The hero environment creates a feeling of looking through tinted museum glass onto a river of liquid sunlight. It is composed of five distinct composited layers:

```
+-------------------------------------------------------------------------+
| [Layer 5] Content Layer (z: 5) - Typography, CTA row, Electric Logo    |
| [Layer 4] Vignette Overlay (z: 4) - Radial shadow mask & edge blackouts |
| [Layer 3] Interactive Specular Glare (z: 3) - Cursor physics highlight |
| [Layer 2] Harmonic Aurora Canvas (z: 2) - Animated sine wave ribbons   |
| [Layer 1] Art Media Image (z: 1) - High-res liquid iridescent artwork   |
| [Layer 0] Pure Obsidian (#000000) Base Container                        |
+-------------------------------------------------------------------------+
```

#### CSS Implementation Blueprint:
```css
.hero-backdrop {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  overflow: hidden;
  animation: backdropEntrance 1.6s cubic-bezier(0.19, 1, 0.22, 1) both;
}

/* Layer 1: Art Media Image with Parallax Drift */
.hero-art-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.58;
  filter: contrast(1.18) brightness(0.96);
  transform: translate3d(
    calc(var(--parallax-x, 0) * 16px),
    calc(var(--parallax-y, 0) * 10px),
    0
  ) scale(1.06);
  transition: transform 0.3s cubic-bezier(0.19, 1, 0.22, 1);
}

/* Layer 3: Dynamic Specular Reflection Tracking Cursor */
.hero-specular-reflection {
  position: absolute;
  inset: 0;
  mix-blend-mode: screen;
  background: radial-gradient(
    ellipse 750px 480px at var(--cursor-x, 50%) var(--cursor-y, 45%),
    rgba(255, 215, 130, calc(var(--cursor-intensity, 0.45) * 0.65)) 0%,
    rgba(224, 150, 55, calc(var(--cursor-intensity, 0.45) * 0.42)) 28%,
    rgba(140, 85, 30, calc(var(--cursor-intensity, 0.45) * 0.18)) 55%,
    transparent 74%
  );
  filter: blur(20px);
  opacity: var(--specular-opacity, 1);
  will-change: background;
}

/* Layer 4: Vignette Overlay (Guarantees #000000 seamless bleed) */
.hero-vignette-overlay {
  position: absolute;
  inset: 0;
  z-index: 4;
  background: radial-gradient(
    ellipse 95% 85% at 50% 40%,
    transparent 35%,
    rgba(0, 0, 0, 0.28) 65%,
    rgba(0, 0, 0, 0.72) 90%,
    #000000 100%
  ),
  linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.45) 0%,
    transparent 18%,
    transparent 60%,
    #000000 100%
  );
}
```

---

## 4. INTERACTIVE CANVAS & KINETIC MOTION RECIPES

### 4.1 Harmonic Aurora Canvas Engine (`HeroCinematicEngine`)
The fluid background is generated at 60 FPS using mathematical sine ribbons with harmonic interference and smooth physics mouse interpolation.

#### Key Algorithm Constants:
- **Interpolation Speed (Lerp):** `0.065` when cursor is active, `0.035` during autonomous drift.
- **Autonomous Figure-Eight:**
  $$\text{targetX} = 0.5 + \sin(t \times 0.00045) \times 0.14$$
  $$\text{targetY} = 0.42 + \cos(t \times 0.00045 \times 0.75) \times 0.09$$
- **Composite Operation:** `ctx.globalCompositeOperation = 'screen'` for luminous addition without burnt clipping.

#### Wave Ribbon Waveform Math:
```javascript
// For each sample point x across the canvas:
const angle1 = t * ribbon.speed + x * ribbon.freq;
const angle2 = t * (ribbon.speed * 0.6) + x * (ribbon.freq * 1.6);
const y = baseWaveY 
  + Math.sin(angle1) * ribbon.amp 
  + Math.cos(angle2) * (ribbon.amp * 0.45)
  + Math.sin((x / canvasWidth) * Math.PI) * mouseInfluence;
```

---

### 4.2 The 3D Perspective Card Tilt
Used on file dropzones and interactive panels to create real physical depth upon mouse hover.

```
       Tilt Pitch (rotateX)
             ^
             |
   <---------+---------> Tilt Yaw (rotateY)
             |
             v
   translateZ(+12px) on hover
```

#### Mathematical Physics Formula:
```javascript
// Normalize mouse coordinates to [-1.0, 1.0] from center
const normX = (clientX - cardRect.left) / cardRect.width * 2 - 1;
const normY = (clientY - cardRect.top) / cardRect.height * 2 - 1;

// Maximum deflection: 8.5 degrees
const targetRotY = normX * 8.5;
const targetRotX = -normY * 8.5;

// Physics smooth lerp loop:
curRotX += (targetRotX - curRotX) * 0.14;
curRotY += (targetRotY - curRotY) * 0.14;

element.style.transform = `perspective(1000px) rotateX(${curRotX}deg) rotateY(${curRotY}deg) translateZ(${isHovered ? 12 : 0}px)`;
```

---

### 4.3 Cybernetic Laser Scanner & Corner Brackets
The dropzone features cybernetic corner indicators and an oscillating laser scanning line that triggers on hover and dragover:

```css
/* Laser Scanner Line */
.dropzone-laser-scanner {
  position: absolute;
  left: 0;
  width: 100%;
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    #FF6A00 20%,
    #FFF5E6 50%,
    #FF6A00 80%,
    transparent 100%
  );
  box-shadow: 0 0 14px #FF6A00, 0 0 24px #E35A00;
  opacity: 0;
  pointer-events: none;
}

.dropzone:hover .dropzone-laser-scanner {
  opacity: 1;
  animation: scanLaser 2.4s ease-in-out infinite alternate;
}

@keyframes scanLaser {
  0%   { top: 4%; }
  100% { top: 96%; }
}

/* Technical Corner Brackets */
.tech-corner {
  position: absolute;
  width: 12px;
  height: 12px;
  border-color: #FF6A00;
  opacity: 0.65;
  transition: opacity 0.3s ease, border-color 0.3s ease;
}
.corner-tl { top: 8px; left: 8px; border-top: 2px solid; border-left: 2px solid; }
.corner-tr { top: 8px; right: 8px; border-top: 2px solid; border-right: 2px solid; }
.corner-bl { bottom: 8px; left: 8px; border-bottom: 2px solid; border-left: 2px solid; }
.corner-br { bottom: 8px; right: 8px; border-bottom: 2px solid; border-right: 2px solid; }
```

---

### 4.4 Kinetic Energy Reactor (Processing State)
Replaces generic loading spinners with a concentric celestial reactor that pulses with telemetry feedback:

```html
<div class="energy-reactor-ring" aria-hidden="true">
  <div class="reactor-core"></div>
  <div class="reactor-orbit-1"></div>
  <div class="reactor-orbit-2"></div>
  <div class="reactor-pulse-glow"></div>
</div>
```

```css
.energy-reactor-ring {
  position: relative;
  width: 72px;
  height: 72px;
  margin: 0 auto 24px;
}

.reactor-core {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 20px;
  margin: -10px 0 0 -10px;
  border-radius: 50%;
  background: #FFF5E6;
  box-shadow: 0 0 16px #FF6A00, 0 0 30px #E35A00;
  animation: pulseCore 1.2s ease-in-out infinite;
}

.reactor-orbit-1 {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px dashed rgba(255, 106, 0, 0.7);
  animation: spinOrbit 4s linear infinite;
}

.reactor-orbit-2 {
  position: absolute;
  inset: -8px;
  border-radius: 50%;
  border: 1px solid rgba(255, 164, 57, 0.4);
  border-top-color: #ffffff;
  animation: spinOrbitReverse 2.2s linear infinite;
}

@keyframes pulseCore {
  0%, 100% { transform: scale(0.9); opacity: 0.8; }
  50%      { transform: scale(1.15); opacity: 1; }
}
@keyframes spinOrbit { to { transform: rotate(360deg); } }
@keyframes spinOrbitReverse { to { transform: rotate(-360deg); } }
```

---

### 4.5 The 3D Energy Conduit
A vertical light beam that channels the kinetic energy from the Hero downward into the application workflow:

```css
.energy-conduit-section {
  position: relative;
  width: 100%;
  height: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.conduit-beam-container {
  position: relative;
  width: 2px;
  height: 54px;
  background: rgba(255, 255, 255, 0.1);
}

.conduit-line {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(255, 106, 0, 0.7), rgba(227, 90, 0, 0.2));
  box-shadow: 0 0 10px rgba(255, 106, 0, 0.5);
}

.conduit-spark-packet {
  position: absolute;
  top: 0;
  left: -2px;
  width: 6px;
  height: 18px;
  border-radius: 3px;
  background: #FFF5E6;
  box-shadow: 0 0 12px #FF6A00, 0 0 20px #FF6A00;
  animation: travelConduit 2.2s cubic-bezier(0.45, 0, 0.55, 1) infinite;
}

@keyframes travelConduit {
  0%   { top: -18px; opacity: 0; transform: scaleY(0.5); }
  25%  { opacity: 1; transform: scaleY(1.2); }
  85%  { opacity: 1; transform: scaleY(1); }
  100% { top: 54px; opacity: 0; transform: scaleY(0.5); }
}
```

---

## 5. COMPONENT DESIGN SPECIFICATIONS

### 5.1 Top Navigation Bar
- **Height:** Exactly `66px` (condenses to `58px` below `768px`).
- **Surface:** `rgba(0, 0, 0, 0.82)` with `backdrop-filter: blur(16px)`.
- **Border:** `1px solid rgba(255, 255, 255, 0.09)`.
- **Geometry:** `0px` radius on outer frame; `75px` pill radius on navigation tab buttons.
- **Brand Frame:** `32px × 32px`, `background: rgba(227, 90, 0, 0.14)`, `border: 1px solid rgba(255, 106, 0, 0.45)`, `box-shadow: 0 0 12px rgba(255, 106, 0, 0.35)`.
- **Text Links:** Underline-free; subtle tracking expansion from `1px` to `1.5px` on hover with `--ease-editorial`.

---

### 5.2 Segmented Workflow Tabs Switcher
Floating pill that switches views without losing application state:
```html
<div class="workflow-tabs-section">
  <div class="workflow-tabs-wrap" role="tablist">
    <button type="button" class="workflow-tab-btn active" role="tab" aria-selected="true">
      <svg class="tab-icon">...</svg>
      <span class="tab-text">Relatório Mensal</span>
    </button>
    <button type="button" class="workflow-tab-btn" role="tab" aria-selected="false">
      <svg class="tab-icon">...</svg>
      <span class="tab-text">Histórico 13 Meses</span>
      <span class="tab-badge-highlight">NOVA ABA</span>
    </button>
  </div>
</div>
```

```css
.workflow-tabs-wrap {
  display: inline-flex;
  align-items: center;
  background: rgba(24, 24, 24, 0.75);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 75px;
  padding: 6px;
  gap: 6px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.workflow-tab-btn.active {
  color: #ffffff;
  background: linear-gradient(135deg, rgba(227, 90, 0, 0.28), rgba(255, 106, 0, 0.12));
  border: 1px solid rgba(255, 106, 0, 0.5);
  box-shadow: 0 4px 20px rgba(255, 106, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.2);
}
```

---

### 5.3 Buttons Hierarchy & Styling

#### A. Ghost Pill Button (The Universal Primary Gesture)
```css
.btn-ghost-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background-color: transparent;
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 75px;
  padding: 12px 34px;
  font-family: var(--font-roobert);
  font-size: 16px;
  font-weight: 400;
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
  transition: background-color 0.4s ease,
              color 0.4s ease,
              border-color 0.4s ease,
              letter-spacing 0.8s cubic-bezier(0.19, 1, 0.22, 1),
              transform 0.2s ease;
}

.btn-ghost-pill:hover {
  background-color: #ffffff;
  color: #000000;
  border-color: #ffffff;
  letter-spacing: 0.5px;
}

.btn-ghost-pill:active {
  transform: scale(0.98);
}
```

#### B. Master Copy CTA Button (High-Voltage Solar Flame)
```css
.btn-copy-master-historico {
  background: linear-gradient(135deg, #E35A00 0%, #FF6A00 100%) !important;
  color: #000000 !important;
  font-weight: 700 !important;
  border: 1px solid rgba(255, 255, 255, 0.4) !important;
  border-radius: 75px;
  padding: 12px 28px !important;
  box-shadow: 0 4px 24px rgba(255, 106, 0, 0.45) !important;
  letter-spacing: 0.6px;
  cursor: pointer;
}

.btn-copy-master-historico:hover {
  background: linear-gradient(135deg, #FF6A00 0%, #FFA439 100%) !important;
  box-shadow: 0 6px 30px rgba(255, 106, 0, 0.65) !important;
  transform: translateY(-2px);
}
```

---

### 5.4 High-Assurance Validation Banner (Emerald Audit)
Displays proof of mathematical and data-integrity verification:
```html
<div class="validation-banner">
  <div class="validation-icon">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
  </div>
  <div class="validation-content">
    <div class="validation-title">Auditoria Matemática e Integridade do Relatório</div>
    <div class="validation-text">
      Os dados foram validados diretamente com os registros oficiais.
    </div>
  </div>
</div>
```

```css
.validation-banner {
  border: 1px solid rgba(52, 211, 153, 0.35);
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(16, 44, 28, 0.75) 0%, rgba(8, 24, 15, 0.92) 100%);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45), 0 0 20px rgba(52, 211, 153, 0.12);
  padding: 18px 24px;
  display: flex;
  align-items: flex-start;
  gap: 16px;
}
.validation-title { color: #34D399; font-weight: 600; font-size: 15px; }
.validation-text { color: #a7f3d0; font-size: 14.5px; line-height: 1.55; }
```

---

### 5.5 Editorial Data Tables (Industrial Precision)
The output tables are built for zero distraction and mathematical scanability:

```css
/* Card Container */
.table-wrapper-block {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(18, 18, 22, 0.95) 0%, rgba(10, 10, 14, 0.98) 100%);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.75);
  overflow: hidden;
}

/* Header Cells */
.editorial-table th {
  padding: 15px 18px;
  font-size: 11.5px;
  font-weight: 600;
  color: #b0b0be;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  white-space: nowrap;
  background-color: rgba(22, 22, 28, 0.95);
  border-bottom: 1px solid rgba(255, 255, 255, 0.14);
  border-right: 1px solid rgba(255, 255, 255, 0.07);
}

/* Body Rows & Hover */
.editorial-table tbody tr {
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  transition: background-color 0.22s ease;
}
.editorial-table tbody tr:hover {
  background-color: rgba(255, 106, 0, 0.07);
}

/* Data Cells */
.editorial-table td {
  padding: 16px 18px;
  color: #f2f2f6;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  font-size: 14px;
}

/* Specific Column Classes */
.editorial-table td.col-code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13.5px;
  color: #FFA439;
  font-weight: 500;
}
.editorial-table td.col-num {
  text-align: right;
  font-family: 'JetBrains Mono', monospace;
}
.val-negative {
  color: #FF8080 !important;
  font-weight: 500;
}
.val-zero {
  color: #6d6d6d !important;
}

/* Custom Themed Scrollbar */
.table-responsive-container::-webkit-scrollbar { height: 8px; }
.table-responsive-container::-webkit-scrollbar-track { background: rgba(14, 14, 18, 0.95); }
.table-responsive-container::-webkit-scrollbar-thumb {
  background: rgba(227, 90, 0, 0.35);
  border-radius: 4px;
}
.table-responsive-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 106, 0, 0.65);
}
```

---

### 5.6 Floating Slate Pill Toast Notification
Floating status feedback that confirms clipboard copying without interrupting reading:
```css
.toast-notification {
  position: fixed;
  bottom: 34px;
  left: 50%;
  transform: translateX(-50%) translateY(0);
  background-color: rgba(24, 24, 24, 0.95);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 75px;
  padding: 12px 34px;
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 1000;
  font-size: 16px;
  animation: toastSlideUp 0.8s cubic-bezier(0.19, 1, 0.22, 1);
}

.toast-dot {
  width: 8px;
  height: 8px;
  background-color: #4ade80;
  border-radius: 50%;
  box-shadow: 0 0 8px #4ade80;
}

@keyframes toastSlideUp {
  from { opacity: 0; transform: translateX(-50%) translateY(24px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}
```

---

## 6. RESPONSIVE BREAKPOINT SPECIFICATION

The layout gracefully collapses across four core breakpoints:

| Breakpoint | Target Devices | Critical Architectural Adjustments |
|---|---|---|
| **> 1180px** | Desktop Large | Full peripheral layout; rotating typography punctuation badge rendered at bottom-right. |
| **1180px** | Desktop Medium | Suppress `.rotating-badge` to prevent any horizontal viewport overflow. |
| **960px** | Small Desktop / Tablet Landscape | Hero split grid collapses from `1.15fr / 0.85fr` into single column (`1fr`); Electric Logo scales down to `380px × 340px`. |
| **768px** | Tablet Portrait / Mobile | Top navigation height drops to `58px`; hide secondary nav links; full-width buttons (`width: 100%`); dropzone padding drops to `40px 16px`; metadata ribbon collapses to vertical stack; table search expands to full-width. |
| **540px** | Mobile Small | Electric Logo scales to `300px × 270px`; ambient halo blur adjusted to `22px`; hero display title scales with `clamp(38px, 10vw, 48px)`. |

---

## 7. ACCESSIBILITY & INCLUSIVE DESIGN STANDARDS

### 7.1 Reduced Motion Support (`prefers-reduced-motion`)
When the user requests reduced motion:
- All CSS animations drop duration to `0.01ms`.
- Canvas engines automatically halt `requestAnimationFrame` loops.
- `ElectricLogo` renders a single, crisp, static high-resolution contour snapshot.
- Parallax translations (`translate3d`) are disabled.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .hero-art-image,
  .hero-aurora-canvas,
  .hero-specular-reflection {
    transform: none !important;
  }
  .rotating-badge {
    animation: none !important;
  }
}
```

### 7.2 Semantic Screen Reader Labels
Where visual technology elements are purely decorative or canvas-rendered (such as `TechText` rendering "extração"), the canvas is marked `aria-hidden="true"`, accompanied by an accessible `<span class="sr-only">extração</span>`:

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

### 7.3 Contrast & Focus Visibility
- Text selection is styled explicitly:
  ```css
  ::selection {
    background-color: #ffffff;
    color: #000000;
  }
  ```
- Focus states on interactive buttons maintain high visibility without breaking pill curvature:
  ```css
  .btn-ghost-pill:focus-visible,
  .workflow-tab-btn:focus-visible {
    outline: 2px solid #FF6A00;
    outline-offset: 3px;
  }
  ```

---

## 8. VOICE, TONE & MICROCOPY PRINCIPLES

- **Voice:** Confident, deterministic, highly technical, and completely devoid of marketing hype.
- **Microcopy Patterns:**
  - `ETAPA 01 / SELEÇÃO` (Uppercase, tracked 2px, quiet Felt Gray).
  - `PARSER DETERMINÍSTICO ATIVO` (Engineering telemetry, JetBrains Mono).
  - `PROCESSAMENTO 100% LOCAL · ZERO TRANSMISSÃO EXTERNA` (Absolute privacy reassurance).
  - `COPIAR TODOS OS REGISTROS` (Decisive, action-oriented, uppercase).
- **Clipboard Confirmation:** Avoid generic "Success". Use explicit, useful feedback:
  - *"Todos os 20 registros históricos copiados! Pronto para colar no Google Sheets."*

---

## 9. STRICT ANTI-PATTERNS & REPRODUCIBILITY CONSTRAINTS

To guarantee that any new page or application generated from this specification retains the exact same aesthetic quality, adhere strictly to these negative constraints:

1. ❌ **NEVER apply rounded corners (`border-radius > 0px`) to card containers, dropzones, or page wrappers.** Containers are always sharp (`0px` or `14px` on structured tables).
2. ❌ **NEVER use rounded rectangles (`border-radius: 4px` to `12px`) for primary buttons.** Buttons are ALWAYS `75px` full-pill capsules.
3. ❌ **NEVER introduce generic SaaS colors** (e.g., standard Bootstrap blues `#0d6efd`, generic purples, or neon pinks). The chromatic spectrum belongs strictly to molten solar light (oxblood, bronze, warm amber, solar flame, gold) against monochrome obsidian.
4. ❌ **NEVER use browser default font stacks.** Always declare `'Roobert'` / `'Inter'` for UI and `'JetBrains Mono'` for tabular data.
5. ❌ **NEVER display numbers with proportional fonts in tables.** Always use `font-variant-numeric: tabular-nums` or `JetBrains Mono` so column widths never wiggle on data updates.
6. ❌ **NEVER use standard rotating loading spinners.** Always deploy the Kinetic Energy Reactor ring animation.
7. ❌ **NEVER omit the Google Sheets clipboard format.** Tabular data must be clean TSV (tabs `\t` between columns, newlines `\r\n` between rows) with header included once.

---

## 10. TAILWIND CSS INTEGRATION PRESET

For developers and agents building with Tailwind CSS v3 / v4, add this configuration block to `tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        obsidian: '#000000',
        inkstone: '#181818',
        paper: '#ffffff',
        'felt-gray': '#6d6d6d',
        'slate-pill': '#636363',
        'ash-mist': '#9a9a9a',
        pewter: '#808080',
        'conectsol-orange': '#E35A00',
        'conectsol-glow': '#FF6A00',
        'conectsol-amber': '#FFA439',
        'electric-core': '#FFF5E6',
        emerald: {
          assurance: '#34D399',
          dark: '#102C1C'
        }
      },
      fontFamily: {
        roobert: ['Roobert', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        raleway: ['Raleway', 'sans-serif']
      },
      borderRadius: {
        pill: '75px',
        table: '14px',
        sharp: '0px'
      },
      maxWidth: {
        page: '1078px'
      },
      boxShadow: {
        'electric-glow': '0 0 24px rgba(255, 106, 0, 0.45)',
        'electric-intense': '0 0 45px rgba(255, 106, 0, 0.75)',
        'dropzone-3d': '0 10px 40px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        'table-block': '0 16px 48px rgba(0, 0, 0, 0.75)'
      },
      transitionTimingFunction: {
        editorial: 'cubic-bezier(0.19, 1, 0.22, 1)'
      }
    }
  }
};
```

---

## 11. VERIFICATION CHECKLIST FOR FUTURE AGENTS

When generating a new interface using this design system, verify each item before shipping:

- [ ] Does the body have `background-color: #000000; color: #ffffff;`?
- [ ] Are all primary action buttons shaped as `75px` full pills with subtle tracking expansion on hover?
- [ ] Are structural cards and layout containers set to architectural `0px` radius (or `14px` on tables)?
- [ ] Is maximum content container width constrained to `1078px` with centered alignment?
- [ ] Are tabular numbers styled with `font-variant-numeric: tabular-nums` or `JetBrains Mono`?
- [ ] Are negative balances styled in `#FF8080` and zeros muted in `#6d6d6d`?
- [ ] Does hover on cards or dropzones utilize subtle inertial 3D perspective tilt?
- [ ] Are transitions governed by `cubic-bezier(0.19, 1, 0.22, 1)`?
- [ ] Does the copy-to-clipboard functionality output clean TSV without Markdown or UI artifacts?
- [ ] Is `prefers-reduced-motion` properly configured to freeze animations and canvas loops?

---
*End of Design Engineering Specification.*
