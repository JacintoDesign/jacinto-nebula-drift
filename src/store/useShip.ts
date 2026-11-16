import { create } from 'zustand'
import * as THREE from 'three'
import { WORLD, hoverPoint, landmarkById } from '../data/world'

/**
 * Per-frame ship state. Mutated in place by the flight model and read by the
 * camera, HUD markers, radar and combat without going through React.
 */
export const ship = {
  pos: new THREE.Vector3(...WORLD.spawn),
  vel: new THREE.Vector3(),
  forward: new THREE.Vector3(0, 0, -1),
  yaw: 0,
  pitch: 0,
  /** Cosmetic roll, radians. */
  bank: 0,
  speed: 0,
  /** 0..1 engine output for exhaust, streaks and audio. */
  throttle: 0,
  boost: false,
  /** 0..1 warp intensity (void cruise, cinematics, gateway routing). */
  warp: 0,
}

/** Place the ship directly at a station hold (deep links). */
export function placeAtStation(id: string) {
  const l = landmarkById(id)
  if (!l) return
  const h = hoverPoint(l)
  ship.pos.set(h[0], h[1], h[2])
  ship.vel.set(0, 0, 0)
  ship.yaw = Math.atan2(-(l.position[0] - h[0]), -(l.position[2] - h[2]))
  ship.pitch = 0
}

/** Raw control intent, written by keyboard and touch controls. */
export const input = {
  thrust: false,
  brake: false,
  boost: false,
  fire: false,
  /** -1..1, positive turns left. */
  yaw: 0,
  /** -1..1, positive pitches up. */
  pitch: 0,
}

interface ShipHud {
  speed: number
  boost: boolean
  assist: boolean
  set: (s: Partial<Omit<ShipHud, 'set'>>) => void
}

/** Low-frequency telemetry for the HUD (updated ~10 Hz). */
export const useShip = create<ShipHud>()((set) => ({
  speed: 0,
  boost: false,
  assist: false,
  set: (s) => set(s),
}))

if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __ship: typeof useShip }).__ship = useShip
  Object.assign(window, { __flight: ship, __input: input })
}
