import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { LANDMARKS, hoverPoint } from '../data/world'
import { useGame } from '../store/useGame'
import { input, ship } from '../store/useShip'

const INTRO_SECONDS = 5
/** Establishing shot: high and wide over the spawn, looking down the lane. */
const VISTA_POS = new THREE.Vector3(46, 34, 104)
const VISTA_LOOK = new THREE.Vector3(-4, -2, -70)

const HOLDS = new Map(
  LANDMARKS.map((l) => [
    l.id,
    { pos: new THREE.Vector3(...l.position), hover: new THREE.Vector3(...hoverPoint(l)) },
  ]),
)

const wantPos = new THREE.Vector3()
const wantLook = new THREE.Vector3()
const off = new THREE.Vector3()
const euler = new THREE.Euler(0, 0, 0, 'YXZ')
const UP = new THREE.Vector3(0, 1, 0)
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/**
 * Chase camera. The mouse (or a touch drag) orbits it and never steers the
 * ship. Also runs the intro fly-in, station hold framing and the About /
 * Contact orbit, and shifts the view so 3D subjects sit beside open panels.
 */
export function ChaseCamera() {
  const { gl } = useThree()
  const orbit = useRef({ yaw: 0, pitch: 0, dragging: false, last: 0 })
  const look = useRef(VISTA_LOOK.clone())
  const intro = useRef(0)
  const cine = useRef({ t: 0, active: false })
  const lastShip = useRef(ship.pos.clone())
  const lastHold = useRef<string | null>(null)
  const shift = useRef({ x: 0, y: 0 })
  const fov = useRef(55)

  useEffect(() => {
    const el = gl.domElement
    const o = orbit.current
    let id = -1
    let px = 0
    let py = 0
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || id !== -1) return
      id = e.pointerId
      px = e.clientX
      py = e.clientY
    }
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return
      const dx = e.clientX - px
      const dy = e.clientY - py
      if (!o.dragging && Math.hypot(dx, dy) < 5) return
      o.dragging = true
      o.yaw -= dx * 0.005
      o.pitch = THREE.MathUtils.clamp(o.pitch + dy * 0.004, -1.1, 1.2)
      o.last = performance.now()
      px = e.clientX
      py = e.clientY
    }
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return
      id = -1
      o.dragging = false
    }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [gl])

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const cam = state.camera as THREE.PerspectiveCamera
    const g = useGame.getState()
    const o = orbit.current
    const aspect = state.size.width / state.size.height
    const portrait = aspect < 0.9
    let snap = false
    let stiffness = 6
    let fovWant = portrait ? 70 : 55

    // A jump (gateway routing, cinematics, deep links) cuts instead of sweeping.
    if (lastShip.current.distanceToSquared(ship.pos) > 40 * 40) snap = true
    lastShip.current.copy(ship.pos)
    if (g.hold !== lastHold.current) {
      lastHold.current = g.hold
      o.yaw = 0
      o.pitch = 0
    }

    // Chase pose behind the ship (also the end of the intro).
    const chase = () => {
      euler.set(ship.pitch * 0.55 - 0.02 - o.pitch, ship.yaw + o.yaw, 0)
      off.set(0, portrait ? 3.4 : 2.7, portrait ? 13 : 9.5).applyEuler(euler)
      wantPos.copy(ship.pos).add(off)
      const orbiting = Math.min(1, (Math.abs(o.yaw) + Math.abs(o.pitch)) * 2)
      wantLook.copy(ship.pos).addScaledVector(ship.forward, 9 * (1 - orbiting))
      wantLook.y += 1.1 * (1 - orbiting)
    }

    if (g.phase === 'loading') {
      const t = g.reducedMotion ? 0 : state.clock.elapsedTime
      wantPos.copy(VISTA_POS)
      wantPos.x += Math.sin(t * 0.07) * 10
      wantPos.y += Math.sin(t * 0.05) * 3
      wantLook.copy(VISTA_LOOK)
      snap = true
    } else if (g.phase === 'intro') {
      intro.current += dt / INTRO_SECONDS
      const k = ease(Math.min(1, intro.current))
      chase()
      wantPos.lerpVectors(VISTA_POS, wantPos, k)
      wantLook.lerpVectors(VISTA_LOOK, wantLook, k)
      snap = true
      if (intro.current >= 1) g.setPhase('flying')
    } else if (g.cinematic) {
      const c = cine.current
      if (!c.active) {
        c.active = true
        c.t = 0
        snap = true
      }
      if (!g.reducedMotion) c.t += dt
      // Slow orbit that climbs from level to a high, near top-down view.
      const ang = 0.7 + c.t * 0.1
      const elev = g.reducedMotion ? 0.5 : 0.12 + 1.1 * ease(Math.min(1, c.t / 50))
      const r = portrait ? 17 : 12.5
      wantPos.set(Math.sin(ang) * Math.cos(elev), Math.sin(elev), Math.cos(ang) * Math.cos(elev))
      wantPos.multiplyScalar(r).add(ship.pos)
      wantLook.copy(ship.pos)
      stiffness = 4
    } else if (g.hold && HOLDS.has(g.hold)) {
      const h = HOLDS.get(g.hold)!
      // Frame the whole station (and its hologram) from behind the ship.
      off.copy(h.hover).sub(h.pos)
      off.y = 0
      const back = off.length() + (portrait ? 30 : 11)
      off.normalize().multiplyScalar(back)
      off.y = 6
      off.applyAxisAngle(UP, o.yaw)
      off.y += o.pitch * 22
      wantPos.copy(h.pos).add(off)
      wantLook.copy(h.pos)
      wantLook.y += 4.5
      stiffness = 2.4
    } else {
      chase()
      fovWant += Math.min(1, ship.speed / 50) * 9 + ship.warp * 12
      // Recentre behind the ship once the pilot is flying again.
      const moving = input.thrust || input.yaw !== 0 || input.pitch !== 0 || !!g.autopilot
      if (!o.dragging && moving && performance.now() - o.last > 700) {
        const k = Math.exp(-dt * 2.4)
        o.yaw *= k
        o.pitch *= k
      }
    }
    if (!g.cinematic) cine.current.active = false

    if (snap) {
      cam.position.copy(wantPos)
      look.current.copy(wantLook)
    } else {
      const k = 1 - Math.exp(-dt * stiffness)
      cam.position.lerp(wantPos, k)
      look.current.lerp(wantLook, 1 - Math.exp(-dt * stiffness * 1.4))
    }
    cam.lookAt(look.current)

    // Slide the subject clear of whichever panel is open.
    const wide = state.size.width >= 900
    let sx = 0
    let sy = 0
    const panel = g.cinematic ?? (g.overlay ? 'project' : null)
    if (panel && !wide) sy = 0.2
    else if (panel === 'about') sx = -0.2
    else if (panel === 'contact') sx = 0.2
    else if (panel === 'project') sx = 0.19
    const s = shift.current
    const sk = snap ? 1 : 1 - Math.exp(-dt * 3)
    s.x += (sx - s.x) * sk
    s.y += (sy - s.y) * sk
    if (g.reducedMotion) fovWant = portrait ? 70 : 55
    fov.current += (fovWant - fov.current) * Math.min(1, dt * 3)
    cam.fov = fov.current
    const { width, height } = state.size
    if (Math.abs(s.x) > 0.001 || Math.abs(s.y) > 0.001) {
      cam.setViewOffset(width, height, s.x * width, s.y * height, width, height)
    } else if (cam.view?.enabled) cam.clearViewOffset()
    cam.updateProjectionMatrix()
  })

  return null
}
