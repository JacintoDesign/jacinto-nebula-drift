# Jacinto Design — Nebula Drift

A 3D playable portfolio. You fly a ship through a neon nebula and dock at floating stations, one per project, each modelled to show what the project is. What the product must always do is written down in [CONTRACT.md](CONTRACT.md).

## What's in it

- **Title screen** over the live scene, then a fly-in from a wide view of the whole sector down to the chase camera. Launching never starts audio; sound is a toggle in the nav.
- **Six stations**, all procedural:
  - **VibeMail**: a mail relay with two frosted-glass envelopes and an uplink dish sending a stream of message packets.
  - **Astra**: an orbital observatory with a rotating habitat wheel, a telescope dome, and the planet it studies hanging below.
  - **Mars Colony**: a floating slab of Mars with habitat domes, a mining rig, a solar field, a landing pad and a rover on its rounds.
  - **Cosmos**: an armillary orrery with a star, planets on tilted orbits, an ISS on its own track, and three glass dashboard readouts.
  - **Periodical**: three magazine volumes on one spine, pages fanned open toward the dock, each volume turning a page.
  - **Cube Lab**: a Rubik's cube in a gimbal with its layers really turning, plus a 2×2 and a 4×4 on side arms.
- **Signs and holograms**: each station has a Japanese blade sign and a hologram of the project above it (demo clip if `video` is set, otherwise the screenshot). Both turn to face the camera.
- **Flight**: arcade model with an attitude limiter, so the ship can't flip over. Flying at a station docks; drifting never does. The mouse orbits the camera and clicks stations to travel; it never steers.
- **Autopilot**: nav menu, edge arrows and station clicks all fly you there, then hover in front of the station and ask before docking. The sector edge hands over to the autopilot, aimed at the nearest unvisited station.
- **Free roam**: the whole galaxy is open. Turn around and fly out to seven planets and moons (an ocean world, a lava world, an iced ringed planet, two gas giants and two moons). Planets are solid; clicking one sets a course, and long hauls cruise faster.
- **Gateway and void**: flying through the ring swaps between the nebula and the black void. In the void, `B` drops out of warp into a 60-second asteroid round (large rocks split into three medium, medium into two small; 100 / 50 / 10 points; top three scores kept locally).
- **About and Contact** are warp cinematics in the void: the camera orbits the ship while the copy (left) or the form (right) sits beside it. Closing either flies home through the gateway.
- **Deep links**: `#<projectId>`, `#about` and `#contact` open on load and stay in sync.
- **Fallbacks**: no WebGL shows a static mini-portfolio. `prefers-reduced-motion` calms the camera, the warp and all station animation. Photo mode (`P`) hides the interface.

## Controls

| | Desktop | Touch |
|---|---|---|
| Thrust / brake | `W` / `S` | **THRUST** / **BRAKE** |
| Boost | `Shift` | **BOOST** |
| Turn / pitch | `A` `D` / `↑` `↓` | D-pad |
| Camera | Drag | Drag |
| Travel | Click a station, an edge arrow, or the nav | Tap the same |
| Dock | Fly at a station, or `E` when in range | Fly at it, or the Dock button |
| Asteroid round | `B` in the void, `Space` to fire | On-screen button, **FIRE** |
| Photo mode | `P` | Menu → Photo mode, tap the hint to exit |
| Back out | `Esc` | ✕ |

## Stack

React 19, Vite 6, TypeScript (strict), react-three-fiber + drei, @react-three/postprocessing, Zustand. WebGL only; `three` is pinned to `0.185.0`.

How it's put together:

- The nebula is a domain-warped fbm shader rendered once into a cube map. That map is the background and, prefiltered, the environment light, so hulls reflect the sky's colours.
- Neon is unlit HDR colour above 1.0; Bloom picks it up, and filmic tone mapping runs last.
- Every hull shares one procedurally drawn panel texture (colour, roughness and bump).
- Flight, docking, collision and the asteroid game are hand-rolled. There is no physics engine.
- Fonts are bundled (Space Grotesk, JetBrains Mono, Noto Sans JP). Nothing is fetched from a CDN at runtime.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production bundle to dist/
npm run typecheck
npm run lint
```

Dev-only screens: `/?station-lab` shows one station model at a time from preset angles, frozen or animated, with an overlay for the dock clearance plane. `/?combat-lab` starts in an untimed asteroid round.

Deploy `dist/` to any static host. `vercel.json` is included.

### Customise

- **Projects and copy**: `src/data/projects.ts`, `src/data/studio.ts`.
- **Station layout, planets and flight bounds**: `src/data/world.ts` (`PLANETS` drives the planet shader, rings, collision and tags).
- **Station models**: one builder per project id in `src/stations/StationStructure.tsx`. Keep geometry behind `z = 0.55` (local units) so the dock approach stays clear.
- **Screenshots and clips**: `public/images/<name>.jpg`, and an optional `video` path on the project for a looping hologram clip.
- **New GLBs** must be meshopt + WebP + quantized: `npx @gltf-transform/cli webp in.glb tmp.glb --quality 90 && npx @gltf-transform/cli meshopt tmp.glb out.glb`.

### Credits

- **Ship**: "Spitfire", [Ultimate Spaceships Pack](https://quaternius.com) by Quaternius (CC0).
- `public/models/` also holds `station.glb`, `dish.glb`, `satellite.glb` and `cargo.glb` from earlier versions. They are not loaded.
