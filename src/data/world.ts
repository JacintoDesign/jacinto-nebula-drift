import { PROJECTS } from './projects'

export type LandmarkKind = 'project'

export interface Landmark {
  id: string
  kind: LandmarkKind
  /** Reference id into PROJECTS when kind === 'project'. */
  refId?: string
  /** Latin neon sign (used by HUD + 3D signage). */
  sign: string
  /** Japanese blade-sign glyphs. */
  signJP: string
  /** Station-class sub-label, e.g. "市場 · ARCADE BAY". */
  sub: string
  color: string
  /** World position of the station core. */
  position: [number, number, number]
  /** Station core radius — drives mesh scale and the dock trigger range. */
  radius: number
  /** Deterministic variety seed for procedural detailing. */
  seed: number
}

const p = (id: string) => {
  const proj = PROJECTS.find((x) => x.id === id)
  if (!proj) throw new Error(`world: unknown project ${id}`)
  return proj
}

function projectStation(
  id: string,
  position: [number, number, number],
  radius: number,
  seed: number,
): Landmark {
  const proj = p(id)
  return {
    id: proj.id,
    kind: 'project',
    refId: proj.id,
    sign: proj.sign,
    signJP: proj.signJP,
    sub: proj.sub,
    color: proj.color,
    position,
    radius,
    seed,
  }
}

/**
 * Flight corridor. The six project stations stagger left/right at varied depth +
 * height down a curving lane through the nebula, ordered like the portfolio grid
 * (VibeMail first). A derelict gateway-ring (see Sector) looms behind the lane
 * as the hero landmark. (About is not a station — it's the warp cinematic.)
 */
export const LANDMARKS: Landmark[] = [
  projectStation('vibemail', [-26, -2, -11], 5, 23),
  projectStation('astra', [29, 9, -36], 5, 37),
  projectStation('mars', [-31, 3, -62], 5, 41),
  projectStation('cosmos', [27, -9, -87], 5, 53),
  projectStation('periodical', [-29, 6, -113], 5, 67),
  projectStation('cube', [30, -4, -138], 5, 79),
]

export const landmarkById = (id: string) => LANDMARKS.find((l) => l.id === id)

/** Spawn pose, soft play-volume, and dock trigger distance for the arcade flight model. */
export const WORLD = {
  /** Ship spawn position + the point it initially faces. */
  spawn: [0, 2, 49] as [number, number, number],
  lookAt: [0, 1, 16] as [number, number, number],
  /** Edge of the galaxy: beyond this the autopilot turns the ship back toward the stations. */
  bounds: {
    center: [0, 0, -78] as [number, number, number],
    radius: 1500,
  },
  /** Within this distance of a station core, docking becomes available. */
  dockRange: 17,
  /** The hero gateway-ring that frames the far end of the lane. */
  gateway: {
    position: [0, 2, -164] as [number, number, number],
    radius: 46,
  },
}

/** Distance in front of a station core where autopilot arrivals hover. */
export const HOVER_DIST = 22

/** Unit vector (x, z) a station's dock faces: toward the lane axis, biased to the spawn. */
export function stationFront(l: Landmark): [number, number] {
  const x = l.position[0] >= 0 ? -1 : 1
  const z = 0.5
  const len = Math.hypot(x, z)
  return [x / len, z / len]
}

/** Y rotation that turns local +Z onto the station's front vector. */
export function stationYaw(l: Landmark): number {
  const [x, z] = stationFront(l)
  return Math.atan2(x, z)
}

/** World point where the ship hovers when holding at a station. */
export function hoverPoint(l: Landmark): [number, number, number] {
  const [x, z] = stationFront(l)
  return [l.position[0] + x * HOVER_DIST, l.position[1] + 1.5, l.position[2] + z * HOVER_DIST]
}

/** The void beyond the gateway: its own soft bounds and the cinematic anchor. */
export const VOID = {
  radius: 240,
  cinematic: [0, 60, -1400] as [number, number, number],
}

export interface PlanetDef {
  id: string
  name: string
  position: [number, number, number]
  radius: number
  /** Axial tilt of the body (and its ring), radians. */
  tilt: [number, number, number]
  /** Surface ramp, low to high. */
  colors: [string, string, string]
  atmosphere: string
  /** 1 = banded gas giant, 0 = rocky terrain. */
  bands: number
  /** Cloud cover over the surface, 0..1. */
  clouds?: number
  /** Colour of molten cracks that glow on the night side. */
  lava?: string
  /** Ring as [inner, outer] in planet radii. */
  ring?: [number, number]
  ringColors?: [string, string]
}

/**
 * Bodies scattered through the galaxy for free roam. The stations sit in the
 * middle of it; every planet can be flown to and around.
 */
export const PLANETS: PlanetDef[] = [
  {
    id: 'ione',
    name: 'Ione',
    position: [-360, 30, -520],
    radius: 120,
    tilt: [0.42, 0, 0.3],
    colors: ['#21124d', '#b84d85', '#fabd99'],
    atmosphere: '#8052ff',
    bands: 1,
    ring: [1.35, 2.35],
    ringColors: ['#d99abf', '#8cb3ff'],
  },
  {
    id: 'thalassa',
    name: 'Thalassa',
    position: [300, -70, 640],
    radius: 150,
    tilt: [0.2, 0, -0.25],
    colors: ['#06224f', '#0d5c8f', '#3f8f5a'],
    atmosphere: '#4aa8ff',
    bands: 0,
    clouds: 0.75,
  },
  {
    id: 'selka',
    name: 'Selka',
    position: [540, 30, 520],
    radius: 26,
    tilt: [0, 0, 0.1],
    colors: ['#3a3a44', '#8d8a90', '#d9d4cc'],
    atmosphere: '#9aa0b8',
    bands: 0,
  },
  {
    id: 'cinder',
    name: 'Cinder',
    position: [840, 130, -300],
    radius: 72,
    tilt: [0.1, 0, 0.5],
    colors: ['#120806', '#3a1a12', '#6b3a22'],
    atmosphere: '#ff5a2a',
    bands: 0,
    lava: '#ff5a14',
  },
  {
    id: 'glacia',
    name: 'Glacia',
    position: [-800, -150, 260],
    radius: 96,
    tilt: [-0.5, 0, -0.35],
    colors: ['#3d6f9c', '#a9d9ee', '#f4fbff'],
    atmosphere: '#9be8ff',
    bands: 0.35,
    clouds: 0.3,
    ring: [1.5, 1.95],
    ringColors: ['#cfefff', '#7fb8e6'],
  },
  {
    id: 'umbra',
    name: 'Umbra',
    position: [-160, 420, -1120],
    radius: 190,
    tilt: [0.3, 0, -0.6],
    colors: ['#0f2b2e', '#1f7a70', '#d6f0a8'],
    atmosphere: '#39ffb0',
    bands: 1,
  },
  {
    id: 'pebble',
    name: 'Pebble',
    position: [170, 64, 96],
    radius: 13,
    tilt: [0, 0, 0],
    colors: ['#3b2a26', '#8a6a55', '#c9b29a'],
    atmosphere: '#c9a27a',
    bands: 0,
  },
]
