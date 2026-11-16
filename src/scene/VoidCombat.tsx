import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from '../store/useGame'
import { input, ship } from '../store/useShip'
import { asteroidGeometry } from './asteroidGeometry'
import { glow } from './materials'

/** Tier 0 = large, 1 = medium, 2 = small. */
const RADIUS = [5.2, 2.9, 1.5]
const POINTS = [100, 50, 10]
const SPLIT = [3, 2, 0]
const MAX_ROCKS = 56
const MAX_SHOTS = 28
const MAX_DEBRIS = 360
const SHOT_SPEED = 170
const FIRE_INTERVAL = 0.13

interface Rock {
  active: boolean
  tier: number
  pos: THREE.Vector3
  vel: THREE.Vector3
  axis: THREE.Vector3
  spin: number
  flash: number
}
interface Shot {
  active: boolean
  pos: THREE.Vector3
  vel: THREE.Vector3
  life: number
}

const tmp = new THREE.Vector3()
const seg = new THREE.Vector3()
const right = new THREE.Vector3()
const origin = new THREE.Vector3()
const drift = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)
const Z = new THREE.Vector3(0, 0, 1)

const debrisVert = /* glsl */ `
  attribute float aLife;
  uniform float uScale;
  varying float vLife;
  void main() {
    vLife = aLife;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(uScale * 90.0 * aLife / max(-mv.z, 0.1), 0.0, 9.0);
  }
`
const debrisFrag = /* glsl */ `
  varying float vLife;
  void main() {
    if (vLife <= 0.0) discard;
    vec2 c = gl_PointCoord - 0.5;
    float a = clamp(1.0 - dot(c, c) * 4.0, 0.0, 1.0);
    vec3 col = mix(vec3(1.0, 0.45, 0.15), vec3(1.0, 0.95, 0.8), vLife) * 2.5;
    gl_FragColor = vec4(col * a * vLife, a * vLife);
  }
`

/**
 * The asteroid game in the void. Rocks, shots and debris live in fixed pools
 * mutated in place; swept segment tests stop fast shots tunnelling.
 */
export function VoidCombat({ endless = false }: { endless?: boolean }) {
  const shapes = useMemo(() => [asteroidGeometry(1), asteroidGeometry(2), asteroidGeometry(3)], [])
  const rockMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#a39a90', roughness: 0.92, metalness: 0.05, flatShading: true }),
    [],
  )
  const hotMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#8a7f78', roughness: 0.9, emissive: '#ff7a3a', emissiveIntensity: 1.6, flatShading: true }),
    [],
  )
  const rocks = useMemo<Rock[]>(
    () =>
      Array.from({ length: MAX_ROCKS }, () => ({
        active: false,
        tier: 0,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        axis: new THREE.Vector3(1, 0, 0),
        spin: 0,
        flash: 0,
      })),
    [],
  )
  const shots = useMemo<Shot[]>(
    () =>
      Array.from({ length: MAX_SHOTS }, () => ({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
      })),
    [],
  )
  const debris = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_DEBRIS * 3), 3))
    geometry.setAttribute('aLife', new THREE.BufferAttribute(new Float32Array(MAX_DEBRIS), 1))
    const material = new THREE.ShaderMaterial({
      vertexShader: debrisVert,
      fragmentShader: debrisFrag,
      uniforms: { uScale: { value: 1 } },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    return { geometry, material, vel: new Float32Array(MAX_DEBRIS * 3), next: 0 }
  }, [])

  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __rocks: Rock[] }).__rocks = rocks
  }, [rocks])

  const rockRefs = useRef<(THREE.Mesh | null)[]>([])
  const shotRefs = useRef<(THREE.Mesh | null)[]>([])
  const reticle = useRef<THREE.Mesh>(null)
  const lamp = useRef<THREE.DirectionalLight>(null)
  const root = useRef<THREE.Group>(null)
  const cooldown = useRef(0)
  const gun = useRef(1)
  const mode = useRef('warp')

  useEffect(
    () => () => {
      shapes.forEach((s) => s.dispose())
      rockMat.dispose()
      hotMat.dispose()
      debris.geometry.dispose()
      debris.material.dispose()
    },
    [shapes, rockMat, hotMat, debris],
  )

  const spawn = (tier: number, pos: THREE.Vector3, vel: THREE.Vector3) => {
    const r = rocks.find((x) => !x.active)
    if (!r) return
    r.active = true
    r.tier = tier
    r.pos.copy(pos)
    r.vel.copy(vel)
    r.axis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
    r.spin = (0.2 + Math.random() * 0.6) * (tier + 1) * 0.6
    r.flash = 0
    const mesh = rockRefs.current[rocks.indexOf(r)]
    if (mesh) {
      mesh.geometry = shapes[Math.floor(Math.random() * 3)]
      mesh.scale.setScalar(RADIUS[tier])
      mesh.quaternion.setFromAxisAngle(r.axis, Math.random() * 6)
    }
  }

  /** Bring a fresh large rock in from ahead of the ship, drifting across its path. */
  const spawnLarge = (near: boolean) => {
    const dist = near ? 45 + Math.random() * 60 : 95 + Math.random() * 40
    const ang = (Math.random() - 0.5) * (near ? 2.4 : 1.6)
    tmp.copy(ship.forward).applyAxisAngle(UP, ang)
    tmp.y += (Math.random() - 0.5) * 0.5
    tmp.normalize().multiplyScalar(dist).add(ship.pos)
    seg.set(Math.random() - 0.5, (Math.random() - 0.5) * 0.4, Math.random() - 0.5).multiplyScalar(9)
    spawn(0, tmp, seg)
  }

  const burst = (pos: THREE.Vector3, count: number, speed: number) => {
    const p = debris.geometry.attributes.position as THREE.BufferAttribute
    const life = debris.geometry.attributes.aLife as THREE.BufferAttribute
    for (let i = 0; i < count; i++) {
      const k = debris.next
      debris.next = (debris.next + 1) % MAX_DEBRIS
      p.setXYZ(k, pos.x, pos.y, pos.z)
      life.setX(k, 0.6 + Math.random() * 0.4)
      tmp.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
      tmp.multiplyScalar(speed * (0.3 + Math.random()))
      debris.vel.set([tmp.x, tmp.y, tmp.z], k * 3)
    }
  }

  const destroy = (r: Rock) => {
    // Copy the parent's state first: its pool slot may be reused by a fragment.
    const tier = r.tier
    origin.copy(r.pos)
    drift.copy(r.vel)
    r.active = false
    const g = useGame.getState()
    if (g.voidMode === 'combat') g.addScore(POINTS[tier])
    burst(origin, 14 + (2 - tier) * 10, 10 + (2 - tier) * 6)
    for (let i = 0; i < SPLIT[tier]; i++) {
      // Fragments keep the parent's momentum and fly apart.
      tmp.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
      seg.copy(drift).addScaledVector(tmp, 7 + Math.random() * 6)
      tmp.multiplyScalar(RADIUS[tier] * 0.5).add(origin)
      spawn(tier + 1, tmp, seg)
    }
    navigator.vibrate?.(8)
  }

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const g = useGame.getState()
    const inVoid = g.zone === 'void' && !g.cinematic
    if (root.current) root.current.visible = inVoid
    const combat = inVoid && g.voidMode === 'combat'

    // Round lifecycle: seed the field on entry, clear it when returning to warp.
    if (g.voidMode !== mode.current || !inVoid) {
      if (combat && mode.current !== 'combat') {
        rocks.forEach((r) => (r.active = false))
        shots.forEach((s) => (s.active = false))
        for (let i = 0; i < 9; i++) spawnLarge(true)
      }
      if (!inVoid || g.voidMode === 'warp') {
        rocks.forEach((r) => (r.active = false))
        shots.forEach((s) => (s.active = false))
      }
      mode.current = inVoid ? g.voidMode : 'warp'
    }
    if (!inVoid) return

    if (combat) {
      if (!endless) g.tickRound(dt)
      // Keep the field stocked.
      let large = 0
      let total = 0
      for (const r of rocks) {
        if (!r.active) continue
        total++
        if (r.tier === 0) large++
      }
      if (large < 5 && total < MAX_ROCKS - 12) spawnLarge(false)

      // Fire alternating wing cannons.
      cooldown.current -= dt
      if (input.fire && cooldown.current <= 0) {
        const s = shots.find((x) => !x.active)
        if (s) {
          cooldown.current = FIRE_INTERVAL
          gun.current *= -1
          right.crossVectors(ship.forward, UP).normalize()
          s.active = true
          s.life = 1.1
          s.pos.copy(ship.pos).addScaledVector(right, gun.current * 0.75).addScaledVector(ship.forward, 1.6)
          s.vel.copy(ship.forward).multiplyScalar(SHOT_SPEED).add(ship.vel)
        }
      }
    }

    // Shots: move, then sweep the travelled segment against every rock.
    shots.forEach((s, i) => {
      const mesh = shotRefs.current[i]
      if (!s.active) {
        if (mesh) mesh.visible = false
        return
      }
      seg.copy(s.vel).multiplyScalar(dt)
      const len = seg.length()
      for (const r of rocks) {
        if (!r.active) continue
        // Closest point on the segment to the rock centre.
        tmp.copy(r.pos).sub(s.pos)
        const t = THREE.MathUtils.clamp(tmp.dot(seg) / Math.max(len * len, 1e-6), 0, 1)
        tmp.copy(s.pos).addScaledVector(seg, t)
        if (tmp.distanceToSquared(r.pos) < (RADIUS[r.tier] * 0.92) ** 2) {
          s.active = false
          destroy(r)
          break
        }
      }
      s.pos.add(seg)
      s.life -= dt
      if (s.life <= 0) s.active = false
      if (mesh) {
        mesh.visible = s.active
        mesh.position.copy(s.pos)
        tmp.copy(s.vel).normalize()
        mesh.quaternion.setFromUnitVectors(Z, tmp)
      }
    })

    // Rocks: drift, tumble, bump the ship, recycle when left far behind.
    rocks.forEach((r, i) => {
      const mesh = rockRefs.current[i]
      if (!mesh) return
      mesh.visible = r.active
      if (!r.active) return
      r.pos.addScaledVector(r.vel, dt)
      if (!g.reducedMotion) mesh.rotateOnAxis(r.axis, r.spin * dt)
      mesh.position.copy(r.pos)
      r.flash = Math.max(0, r.flash - dt * 4)
      mesh.material = r.flash > 0 ? hotMat : rockMat
      tmp.copy(ship.pos).sub(r.pos)
      const d = tmp.length()
      const min = RADIUS[r.tier] + 1.3
      if (d < min && d > 0.001) {
        tmp.normalize()
        ship.pos.copy(r.pos).addScaledVector(tmp, min)
        const inward = ship.vel.dot(tmp)
        if (inward < 0) ship.vel.addScaledVector(tmp, -inward * 1.5)
        r.vel.addScaledVector(tmp, -4)
        r.flash = 1
      }
      if (d > 230) r.active = false
    })

    // Debris.
    const p = debris.geometry.attributes.position as THREE.BufferAttribute
    const life = debris.geometry.attributes.aLife as THREE.BufferAttribute
    for (let k = 0; k < MAX_DEBRIS; k++) {
      const l = life.getX(k)
      if (l <= 0) continue
      life.setX(k, l - dt * 0.9)
      p.setXYZ(
        k,
        p.getX(k) + debris.vel[k * 3] * dt,
        p.getY(k) + debris.vel[k * 3 + 1] * dt,
        p.getZ(k) + debris.vel[k * 3 + 2] * dt,
      )
    }
    p.needsUpdate = true
    life.needsUpdate = true
    debris.material.uniforms.uScale.value = state.gl.getPixelRatio()

    // Headlamp: rocks are lit from the pilot's side so they read against black.
    if (lamp.current) {
      lamp.current.position.copy(state.camera.position)
      lamp.current.target.position.copy(ship.pos).addScaledVector(ship.forward, 40)
      lamp.current.target.updateMatrixWorld()
    }
    if (reticle.current) {
      reticle.current.visible = combat
      reticle.current.position.copy(ship.pos).addScaledVector(ship.forward, 70)
      reticle.current.lookAt(state.camera.position)
    }
  })

  return (
    <group ref={root} visible={false}>
      {rocks.map((_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            rockRefs.current[i] = m
          }}
          geometry={shapes[i % 3]}
          material={rockMat}
          visible={false}
        />
      ))}
      {shots.map((_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            shotRefs.current[i] = m
          }}
          material={glow('#7dfcff', 4)}
          visible={false}
        >
          <boxGeometry args={[0.16, 0.16, 4.6]} />
        </mesh>
      ))}
      <directionalLight ref={lamp} color="#cfe4ff" intensity={2.2} />
      <points geometry={debris.geometry} material={debris.material} frustumCulled={false} />
      <mesh ref={reticle} material={glow('#7dfcff', 1.6)} visible={false}>
        <ringGeometry args={[1.5, 1.62, 40]} />
      </mesh>
    </group>
  )
}
