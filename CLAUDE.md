# CLAUDE.md

Guidance for working in this repo. What the product must do lives in [CONTRACT.md](CONTRACT.md).

## Project

**Jacinto Design — Nebula Drift**: a 3D playable portfolio. You fly a ship through a nebula and dock at floating stations, one per project. Solo studio, so all copy is first-person singular ("I", never "we").

## Commands

```bash
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build
npm run typecheck
npm run lint
```

Dev-only inspection screens: `/?station-lab` (one station model at a time, frozen or animated, with a dock-plane overlay) and `/?combat-lab` (starts in an untimed asteroid round).

## Stack

React 19, Vite 6, TypeScript (strict), react-three-fiber + drei, @react-three/postprocessing, Zustand.

## Where things live

- `src/data/projects.ts`: project roster (the source of station content)
- `src/data/world.ts`: station positions, radii, planets (`PLANETS`), flight bounds, dock range
- `src/data/studio.ts`: About / Contact copy
- `src/stations/StationStructure.tsx`: procedural station models, one builder per project id
- `src/stations/Station.tsx`: station interaction, sign, holo screen
- `src/ship/`: flight model, autopilot and docking (`Ship.tsx`), chase camera, ship model, warp streaks
- `src/App.tsx`: keyboard controls, URL hash deep links, launch
- `src/scene/`: nebula sky baked to a cube map (`Nebula.tsx`), ringed planet, gateway (`Sector.tsx`), asteroid game (`VoidCombat.tsx`), shared hull and glow materials (`materials.ts`), post effects
- `src/store/useGame.ts`: game mode, zone, autopilot, overlays, void round + scores
- `src/store/useShip.ts`: per-frame ship state and raw control input (plain mutable objects), HUD telemetry store
- `src/ui/`: HUD, nav, edge markers, project card and About/Contact panels (`Panels.tsx`), touch controls, loader, WebGL fallback

## Rules

- **WebGL, not WebGPU.** Keep `three` pinned to `0.185.0` (postprocessing needs `<0.186`). Do not alias `three` to `three/webgpu`.
- **No physics engine.** Flight, docking and collision are hand-rolled in `Ship.tsx`.
- **No runtime CDN fetches.** GLBs in `public/models/` must be meshopt + WebP + quantized (see README for the gltf-transform commands).
- **Emissive neon is HDR.** Use `glow()` from `materials.ts` (unlit, above 1.0) so Bloom picks it up; tone mapping runs last in `Effects.tsx`, and the canvas is `flat`.
- **Canvas textures are created at their final size** (`canvasTexture(w, h)`); resizing one after upload breaks the GPU copy.
- **Shaders must not produce NaN.** Clamp bases before fractional `pow`, guard `atan`/`normalize`/divide. One NaN pixel becomes a black block through Bloom.
- **Respect reduced motion.** Anything animated checks `useGame.getState().reducedMotion`.
- **Stations:** a new project needs an entry in `projects.ts`, a landmark in `world.ts`, and a builder in `StationStructure.tsx` that depicts what the project is. Keep the front dock area (z ≥ 0.55, local units) clear.
- **Touch is keyboard-free.** Any new keyboard action needs an on-screen control too; `kbd` hints are hidden when `touch` is set.
- **Don't regress controls:** the mouse orbits the camera and clicks to travel; it never steers the ship. No pointer lock, no idle thrust.

## Testing in the browser pane

The pane often runs hidden, which pauses `requestAnimationFrame`, so the scene only advances while screenshots are taken. In dev, drive state through `window.__game`, `window.__ship` (Zustand stores), `window.__flight` (live position, yaw, pitch, velocity), `window.__input` (control intent) and `window.__shipObj` (the ship object). To keep the scene running while hidden, run `window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16)` in the page, then take one screenshot. Synthetic key events get cleared by window blur in a hidden pane, so set `__input` fields directly.
