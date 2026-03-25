# Glasses Try-On (MindAR + A-Frame + TypeScript)

A web-based AR glasses try-on prototype using **MindAR Face Tracking**, **A-Frame**, and **Three.js**.

The app anchors a 3D glasses model to the face (nose bridge) and provides on-screen controls for:
- frame size in points
- per-device projection calibration (position + scale)
- saving/loading fit presets

## Features

- Real-time face tracking with MindAR (`mindar-face`)
- GLB glasses model rendering via A-Frame + Three.js
- Anchor-based attachment at face landmark `168` (nose bridge)
- Per-device calibration profile stored in `localStorage`
- Size controls mapped between user-friendly points and 3D scale
- Optional auto-adjust pipeline driven by face measurements
- Debug/inspection helpers exposed in browser console

## Tech Stack

- Vite
- TypeScript
- A-Frame
- MindAR (face)
- Three.js

## Project Structure

```text
.
├── index.html
├── package.json
├── tsconfig.json
├── public/
│   └── models/
│       ├── glasses.glb
│       ├── glassesbonesfinal.glb
│       └── glassesbonesfinal_2.glb
└── src/
    ├── main.ts
    ├── faceMeasurement.ts
    ├── autoAdjuster.ts
    └── style.css
```

## Prerequisites

- Node.js 18+
- npm 9+
- A camera-enabled browser with WebGL support

## Getting Started

```bash
npm install
npm run dev
```

Open the URL shown by Vite (typically `http://localhost:5173`) and allow camera access.

## Scripts

- `npm run dev` - Start the Vite development server
- `npm run build` - Type-check and build production assets
- `npm run preview` - Preview the production build locally

## How It Works

1. `index.html` sets up an `<a-scene mindar-face ...>` AR scene.
2. The glasses model (`/models/glassesbonesfinal.glb`) is loaded into the `#glasses` entity.
3. `#glasses-anchor` uses `mindar-face-target="anchorIndex: 168"`.
4. `src/main.ts` applies fit settings (position/scale/rotation), model material tweaks, calibration offsets, and UI bindings.
5. `src/faceMeasurement.ts` estimates face dimensions from tracked anchor context.
6. `src/autoAdjuster.ts` converts measurements into optional position/scale recommendations.

## UI Controls

Visible controls in the panel:
- **Frame Size (pt)** slider and numeric input (`40-220`)
- **Projection Calibration**
  - Start/Save Position
  - Start/Save Size
  - Reset All
- **Preset**
  - Save Preset
  - Load Preset

Calibration notes:
- Position mode: drag to align, use mouse wheel for depth (`z`).
- Size mode: drag up/down to resize.
- Saved calibration is scoped by device profile (screen size, DPR, user-agent).

## Browser Console Helpers

The app exposes helpers on `window`:

- `enableAutoAdjust()`
- `disableAutoAdjust()`
- `setAutoScaleEnabled(true | false)`
- `isAutoScaleEnabled()`
- `getFaceMeasurements()`
- `getRecommendedSettings()`
- `initializeAutoAdjustmentPipeline()`

Anchor inspector API:

- `anchorInspector.list()`
- `anchorInspector.active()`
- `anchorInspector.setByIndex(index)`
- `anchorInspector.setByAlias(alias)`
- `anchorInspector.showDebug()`
- `anchorInspector.hideDebug()`

## Data Persistence

The app uses `localStorage` keys:

- `mindar-glasses-settings` for manual fit presets
- `mindar-projection-calibration:*` for per-device calibration profiles

## Model Notes

Default model path is set in `index.html`:

```html
<a-asset-item id="glassesModel" src="/models/glassesbonesfinal.glb"></a-asset-item>
```

To use another model, change this `src` and keep material naming conventions clear (`frame`, `lens`, `temple`, etc.) for easier material handling.

## Troubleshooting

- Glasses not visible:
  - Confirm camera permissions are granted
  - Verify model path under `public/models`
  - Check browser devtools console for load errors
- Tracking feels unstable:
  - Improve lighting and keep face centered
  - Re-run projection calibration
- Fit differs across devices:
  - Calibration is device-profile specific; calibrate each target device

## Documentation

Additional project notes:
- `MINDAR_IMPLEMENTATION.md`
- `RENDERER_DOCS.md`
