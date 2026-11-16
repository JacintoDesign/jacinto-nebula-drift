import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { HOVER_DIST, LANDMARKS, PLANETS, VOID, WORLD, hoverPoint } from '../data/world'
import { nextStation, useGame } from '../store/useGame'
import { input, ship, useShip } from '../store/useShip'
import { playPing, setEngine } from '../audio/ambience'
import { ShipModel } from './ShipModel'

const THRUST = 24
const BOOST = 46
const YAW_RATE = 1.5
const PITCH_RATE = 1.1
/** Attitude limiter: soft zone starts here, hard stop at PITCH_MAX. */
const PITCH_SOFT = 0.72
const PITCH_MAX = 1.02
const AUTO_SPEED = 46
const GATE = new THREE.Vector3(...WORLD.gateway.position)
const BOUNDS = new THREE.Vector3(...WORLD.bounds.center)
const CINE = new THREE.Vector3(...VOID.cinematic)

const STATIONS = LANDMARKS.map((l) => ({
  id: l.id,
  pos: new THREE.Vector3(...l.position),
  hover: new THREE.Vector3(...hoverPoint(l)),
  /** Hand-rolled collision shell around the station model. */
  shell: l.radius * 2.1,
}))

const BODIES = PLANETS.map((p) => ({
  id: p.id,
  pos: new THREE.Vector3(...p.position),
  shell: p.radius + 5,
  /** Where the autopilot parks for a view of the whole body. */
  orbit: p.radius * 2.7 + 30,
}))
/** Everything the autopilot steers around: [centre, clearance]. */
const OBSTACLES: { pos: THREE.Vector3; clear: number }[] = []

for (const s of STATIONS) OBSTACLES.push({ pos: s.pos, clear: s.shell + 9 })
for (const b of BODIES) OBSTACLES.push({ pos: b.pos, clear: b.shell + 12 })

const v = new THREE.Vector3()
const dir = new THREE.Vector3()
const away = new THREE.Vector3()

function dampAngle(cur: number, target: number, maxStep: number) {
  let d = (target - cur) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return cur + THREE.MathUtils.clamp(d, -maxStep, maxStep)
}

function setForward() {
  const cp = Math.cos(ship.pitch)
  ship.forward.set(-Math.sin(ship.yaw) * cp, Math.sin(ship.pitch), -Math.cos(ship.yaw) * cp)
}

function teleport(pos: THREE.Vector3, yaw: number, speed: number) {
  ship.pos.copy(pos)
  ship.yaw = yaw
  ship.pitch = 0
  setForward()
  ship.vel.copy(ship.forward).multiplyScalar(speed)
}

/**
 * Arcade flight model: thrust along the nose, drag to a stop, yaw/pitch with an
 * attitude limiter. Also owns autopilot, station holds, docking, collision,
 * sector bounds and gateway transit. No physics engine.
 */
export function Ship() {
  const group = useRef<THREE.Group>(null)
  const yawVel = useRef(0)
  const pitchVel = useRef(0)
  const gateCooldown = useRef(0)
  const routing = useRef(false)
  const dockBlock = useRef<string | null>(null)
  const hudClock = useRef(0)
  const prev = useRef({ cinematic: null as string | null, autopilot: null as string | null })

  useEffect(() => {
    if (import.meta.env.DEV && group.current) {
      ;(window as unknown as { __shipObj: THREE.Object3D }).__shipObj = group.current
    }
  }, [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const g = useGame.getState()
    const obj = group.current
    if (!obj) return
    gateCooldown.current -= dt

    // --- React to state transitions -------------------------------------
    if (g.cinematic !== prev.current.cinematic) {
      if (g.cinematic) {
        if (g.zone !== 'void') g.setZone('void')
        else if (g.voidMode !== 'warp') g.exitCombat()
        g.triggerFlash()
        teleport(CINE, 0, 0)
      }
      prev.current.cinematic = g.cinematic
    }
    if (g.autopilot !== prev.current.autopilot) {
      // Leaving the void for a project: jump to the gateway and warp home through it.
      if (g.autopilot && g.autopilot !== 'gateway' && g.zone === 'void') {
        if (g.voidMode !== 'warp') g.exitCombat()
        g.triggerFlash()
        v.copy(GATE)
        v.z -= 150
        teleport(v, Math.PI, 90)
        routing.current = true
      }
      prev.current.autopilot = g.autopilot
    }

    const flying = g.phase === 'flying'
    const steering = input.thrust || input.brake || input.yaw !== 0 || input.pitch !== 0
    let throttle = 0
    let warpTarget = 0
    const prevZ = ship.pos.z

    if (!flying) {
      // Parked at the spawn until launch; the camera does the fly-in.
      ship.vel.multiplyScalar(Math.exp(-dt * 3))
    } else if (g.cinematic) {
      // Hanging in warp: the streaks sell the motion, the ship holds station.
      ship.pos.lerp(CINE, 1 - Math.exp(-dt * 4))
      ship.vel.set(0, 0, 0)
      ship.pitch *= Math.exp(-dt * 3)
      yawVel.current = 0
      throttle = 0.8
      warpTarget = 1
    } else if (routing.current) {
      // Straight run through the gateway back to the nebula.
      ship.yaw = Math.PI
      ship.pitch = 0
      setForward()
      ship.vel.copy(ship.forward).multiplyScalar(110)
      ship.pos.x += (GATE.x - ship.pos.x) * Math.min(1, dt * 4)
      ship.pos.y += (GATE.y - ship.pos.y) * Math.min(1, dt * 4)
      throttle = 1
      warpTarget = 1
      if (g.zone === 'nebula') routing.current = false
    } else if (g.hold) {
      const st = STATIONS.find((s) => s.id === g.hold)
      if (st) {
        ship.pos.lerp(st.hover, 1 - Math.exp(-dt * 2.6))
        ship.vel.set(0, 0, 0)
        dir.copy(st.pos).sub(ship.pos)
        ship.yaw = dampAngle(ship.yaw, Math.atan2(-dir.x, -dir.z), dt * 1.6)
        ship.pitch *= Math.exp(-dt * 3)
        yawVel.current = 0
        dockBlock.current = st.id
      }
    } else if (g.autopilot) {
      if (steering) {
        g.cancelAutopilot()
      } else {
        const toGate = g.autopilot === 'gateway'
        const st = STATIONS.find((s) => s.id === g.autopilot)
        const body = BODIES.find((b) => b.id === g.autopilot)
        let target = toGate ? v.copy(GATE) : st ? v.copy(st.hover) : null
        if (body) {
          // Park on the near side of the planet, far enough out to see all of it.
          target = v.copy(ship.pos).sub(body.pos)
          if (target.lengthSq() < 1) target.set(0, 0, 1)
          target.normalize().multiplyScalar(body.orbit).add(body.pos)
        }
        if (!target) g.cancelAutopilot()
        else {
          if (toGate) {
            // Aim through the ring, from whichever side the ship is on.
            target.z += ship.pos.z > GATE.z ? -30 : 30
          }
          dir.copy(target).sub(ship.pos)
          const dist = dir.length()
          dir.normalize()
          // Steer around station shells that sit between the ship and the target.
          for (const o of OBSTACLES) {
            if (o.pos === body?.pos) continue
            away.copy(ship.pos).sub(o.pos)
            const d = away.length()
            const clear = o.clear
            if (d < clear + 14 && d > 0.01) {
              const k = THREE.MathUtils.clamp((clear + 14 - d) / 14, 0, 1)
              away.normalize()
              // Only the component perpendicular to travel, so it slides past.
              away.addScaledVector(dir, -away.dot(dir))
              dir.addScaledVector(away, k * 1.4)
            }
          }
          dir.normalize()
          const turn = dt * (dist < 30 ? 3.2 : 2.2)
          ship.yaw = dampAngle(ship.yaw, Math.atan2(-dir.x, -dir.z), turn)
          ship.pitch = dampAngle(
            ship.pitch,
            THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)), -0.9, 0.9),
            turn,
          )
          setForward()
          const align = Math.max(0.2, ship.forward.dot(dir))
          // Long hauls across the galaxy cruise faster than local hops.
          const cruise = dist > 260 ? AUTO_SPEED * 2.6 : AUTO_SPEED
          const want = toGate ? AUTO_SPEED : Math.min(cruise, 3 + dist * 0.85) * align
          const cur = ship.vel.length()
          const next = cur + (want - cur) * Math.min(1, dt * 2.2)
          ship.vel.copy(ship.forward).multiplyScalar(next)
          throttle = Math.min(1, next / 30)
          if (next > AUTO_SPEED * 1.3) warpTarget = 0.45
          if (st && dist < 2.2) g.arrive(st.id)
          else if (body && dist < 6) g.cancelAutopilot()
        }
      }
    } else {
      // --- Manual flight ---------------------------------------------------
      const inVoidWarp = g.zone === 'void' && g.voidMode === 'warp'
      yawVel.current += (input.yaw * YAW_RATE - yawVel.current) * Math.min(1, dt * 6)
      let pitchIn = input.pitch
      const over = Math.abs(ship.pitch) - PITCH_SOFT
      if (over > 0 && Math.sign(pitchIn) === Math.sign(ship.pitch)) {
        pitchIn *= Math.max(0, 1 - over / (PITCH_MAX - PITCH_SOFT))
      }
      pitchVel.current += (pitchIn * PITCH_RATE - pitchVel.current) * Math.min(1, dt * 6)
      ship.yaw += yawVel.current * dt
      ship.pitch = THREE.MathUtils.clamp(ship.pitch + pitchVel.current * dt, -PITCH_MAX, PITCH_MAX)
      // Auto-level: ease the nose back to the horizon when not pitching.
      if (input.pitch === 0) ship.pitch *= Math.exp(-dt * (over > 0 ? 1.8 : 0.7))
      setForward()

      const boost = input.thrust && input.boost
      if (input.thrust) {
        const power = (boost ? BOOST : THRUST) * (inVoidWarp ? 1.8 : 1)
        ship.vel.addScaledVector(ship.forward, power * dt)
      }
      const drag = input.brake ? 4 : input.thrust ? 0.9 : 1.5
      ship.vel.multiplyScalar(Math.exp(-dt * drag))
      // Arcade grip: bleed sideways drift toward the nose.
      const sp = ship.vel.length()
      if (sp > 0.01) {
        v.copy(ship.forward).multiplyScalar(sp)
        ship.vel.lerp(v, Math.min(1, dt * 2.6))
      } else ship.vel.set(0, 0, 0)
      throttle = input.thrust ? (boost ? 1 : 0.6) : 0
      ship.boost = boost
      if (inVoidWarp) warpTarget = Math.min(1, sp / 40)
      else if (boost) warpTarget = 0.35
    }

    ship.pos.addScaledVector(ship.vel, dt)
    setForward()

    // --- World interactions (not during scripted moves) ---------------------
    if (flying && !g.cinematic) {
      // Gateway transit: crossing the ring plane inside the ring swaps zones.
      const a = prevZ - GATE.z
      const b = ship.pos.z - GATE.z
      if (a * b < 0 && gateCooldown.current <= 0) {
        const r = Math.hypot(ship.pos.x - GATE.x, ship.pos.y - GATE.y)
        if (r < WORLD.gateway.radius - 5) {
          gateCooldown.current = 1.2
          g.setZone(g.zone === 'nebula' ? 'void' : 'nebula')
          g.triggerFlash()
          navigator.vibrate?.(30)
          if (g.autopilot === 'gateway') g.cancelAutopilot()
        }
      }

      if (g.zone === 'nebula') {
        let near: string | null = null
        for (const s of STATIONS) {
          away.copy(ship.pos).sub(s.pos)
          const d = away.length()
          // Collision shell: push out and cancel inward velocity.
          if (d < s.shell && d > 0.001 && !g.hold) {
            away.normalize()
            ship.pos.copy(s.pos).addScaledVector(away, s.shell)
            const inward = ship.vel.dot(away)
            if (inward < 0) ship.vel.addScaledVector(away, -inward * 1.2)
          }
          if (d < WORLD.dockRange + 4) near = s.id
          if (dockBlock.current === s.id && d > HOVER_DIST + 8) dockBlock.current = null
        }
        // Planets are solid: skim the surface, never pass through.
        for (const b of BODIES) {
          away.copy(ship.pos).sub(b.pos)
          const d = away.length()
          if (d < b.shell && d > 0.001) {
            away.normalize()
            ship.pos.copy(b.pos).addScaledVector(away, b.shell)
            const inward = ship.vel.dot(away)
            if (inward < 0) ship.vel.addScaledVector(away, -inward)
          }
        }
        if (near !== g.near) {
          g.setNear(near)
          if (near && !g.hold) playPing()
        }
        // Auto-dock: only when actively flying at a station, never on drift.
        if (near && !g.hold && !g.autopilot && input.thrust && dockBlock.current !== near) {
          const s = STATIONS.find((x) => x.id === near)!
          dir.copy(s.pos).sub(ship.pos).normalize()
          if (ship.forward.dot(dir) > 0.72) g.dock(near)
        }
        // Sector edge: hand over to the autopilot, aimed at unseen work.
        if (!g.autopilot && !g.hold && ship.pos.distanceTo(BOUNDS) > WORLD.bounds.radius) {
          let best = nextStation(g.visited)
          let bestD = Infinity
          for (const s of STATIONS) {
            if (g.visited.includes(s.id)) continue
            const d = s.pos.distanceToSquared(ship.pos)
            if (d < bestD) {
              bestD = d
              best = s.id
            }
          }
          g.travelTo(best)
        }
      } else if (!routing.current) {
        if (g.near) g.setNear(null)
        // Void: soft wall keeps the ship within reach of the gateway.
        away.copy(ship.pos).sub(GATE)
        const d = away.length()
        if (d > VOID.radius) {
          away.normalize()
          ship.pos.copy(GATE).addScaledVector(away, VOID.radius)
          const out = ship.vel.dot(away)
          if (out > 0) ship.vel.addScaledVector(away, -out)
        }
      }
    }

    // --- Derived state + transform ---------------------------------------
    ship.speed = ship.vel.length()
    ship.throttle += (throttle - ship.throttle) * Math.min(1, dt * 5)
    ship.warp += (warpTarget - ship.warp) * Math.min(1, dt * 2.5)
    if (g.hold || g.autopilot || g.cinematic || !flying) ship.boost = false
    const bankTarget = g.autopilot || g.hold ? 0 : yawVel.current * 0.42
    ship.bank += (bankTarget - ship.bank) * Math.min(1, dt * 6)

    obj.position.copy(ship.pos)
    obj.rotation.set(ship.pitch, ship.yaw, 0, 'YXZ')

    hudClock.current += dt
    if (hudClock.current > 0.1) {
      hudClock.current = 0
      setEngine(ship.throttle)
      const hud = useShip.getState()
      const speed = Math.round(ship.speed)
      const assist = !g.autopilot && !g.hold && Math.abs(ship.pitch) > PITCH_SOFT
      if (hud.speed !== speed || hud.boost !== ship.boost || hud.assist !== assist) {
        hud.set({ speed, boost: ship.boost, assist })
      }
    }
  })

  return (
    <group ref={group} position={WORLD.spawn}>
      <ShipModel />
    </group>
  )
}
