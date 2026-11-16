import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useGame } from '../store/useGame'
import { glass, glow, hullMaterials } from '../scene/materials'

/**
 * Procedural station models, one builder per project id. Each depicts what its
 * project is. Models are authored in local units (1 = the landmark radius) and
 * must stay behind z = 0.55 so the front dock approach is clear.
 */

interface BuildProps {
  color: string
  /** Station lab: hold every animation still. */
  frozen?: boolean
}

/** Per-frame animation that honours reduced motion and the lab's freeze. Runs once regardless, to pose. */
function useTick(cb: (t: number, dt: number) => void, frozen?: boolean) {
  const t = useRef(0)
  const posed = useRef(false)
  useFrame((_, rawDt) => {
    const still = frozen || useGame.getState().reducedMotion
    if (still && posed.current) return
    const dt = still ? 0 : Math.min(rawDt, 0.05)
    t.current += dt
    posed.current = true
    cb(t.current, dt)
  })
}

const Y = new THREE.Vector3(0, 1, 0)

/** A strut between two points. */
function Tube({
  a,
  b,
  r = 0.02,
  material,
  sides = 6,
}: {
  a: [number, number, number]
  b: [number, number, number]
  r?: number
  material: THREE.Material
  sides?: number
}) {
  const { pos, quat, len } = useMemo(() => {
    const va = new THREE.Vector3(...a)
    const vb = new THREE.Vector3(...b)
    const d = vb.clone().sub(va)
    const len = d.length()
    return {
      pos: va.add(vb).multiplyScalar(0.5),
      quat: new THREE.Quaternion().setFromUnitVectors(Y, d.normalize()),
      len,
    }
  }, [a, b])
  return (
    <mesh position={pos} quaternion={quat} material={material}>
      <cylinderGeometry args={[r, r, len, sides]} />
    </mesh>
  )
}

/** Blinking navigation light. */
function Blinker({
  position,
  color,
  period = 1.6,
  offset = 0,
  size = 0.028,
}: {
  position: [number, number, number]
  color: string
  period?: number
  offset?: number
  size?: number
}) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (!ref.current) return
    const calm = useGame.getState().reducedMotion
    ref.current.visible = calm || (state.clock.elapsedTime + offset) % period < period * 0.35
  })
  return (
    <mesh ref={ref} position={position} material={glow(color, 4)}>
      <sphereGeometry args={[size, 10, 8]} />
    </mesh>
  )
}

/** Docking collar on the front face, with a lit guide ring. */
function DockPort({ y = 0, from, color }: { y?: number; from: number; color: string }) {
  const mats = hullMaterials()
  const len = 0.52 - from
  return (
    <group position={[0, y, from + len / 2]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.mid}>
        <cylinderGeometry args={[0.12, 0.15, len, 12]} />
      </mesh>
      <mesh position={[0, 0, len / 2 - 0.01]} material={glow(color, 3)}>
        <torusGeometry args={[0.125, 0.012, 6, 32]} />
      </mesh>
      <mesh position={[0, 0, len / 2]} material={mats.frame}>
        <circleGeometry args={[0.1, 20]} />
      </mesh>
    </group>
  )
}

/** Solar wing: a cell panel with a spine and end rails. */
function SolarWing({
  position,
  rotation,
  size,
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  size: [number, number]
}) {
  const mats = hullMaterials()
  const [w, d] = size
  const cells = Math.max(2, Math.round(w / 0.16))
  return (
    <group position={position} rotation={rotation}>
      <mesh material={mats.solar}>
        <boxGeometry args={[w, 0.012, d]} />
      </mesh>
      <mesh material={mats.frame}>
        <boxGeometry args={[w + 0.02, 0.022, 0.022]} />
      </mesh>
      {Array.from({ length: cells + 1 }, (_, i) => (
        <mesh key={i} position={[-w / 2 + (i * w) / cells, 0, 0]} material={mats.frame}>
          <boxGeometry args={[0.012, 0.02, d + 0.02]} />
        </mesh>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* VibeMail: a mail relay. Two frosted-glass envelopes flank the hub,  */
/* and an uplink dish sends a stream of message packets.               */
/* ------------------------------------------------------------------ */

function Envelope({ side, color }: { side: 1 | -1; color: string }) {
  const mats = hullMaterials()
  const line = glow(color, 2.6)
  const w = 1.02
  const h = 0.66
  const flap = Math.hypot(w / 2, h * 0.52)
  const ang = Math.atan2(h * 0.52, w / 2)
  return (
    <group position={[side * 0.98, 0.02, -0.08]} rotation={[0, -side * 0.22, 0]}>
      <mesh material={glass(color, 0.3)}>
        <boxGeometry args={[w, h, 0.02]} />
      </mesh>
      {/* Frame */}
      {[h / 2, -h / 2].map((y) => (
        <mesh key={y} position={[0, y, 0]} material={line}>
          <boxGeometry args={[w + 0.02, 0.02, 0.03]} />
        </mesh>
      ))}
      {[w / 2, -w / 2].map((x) => (
        <mesh key={x} position={[x, 0, 0]} material={line}>
          <boxGeometry args={[0.02, h + 0.02, 0.03]} />
        </mesh>
      ))}
      {/* Flap: the V that makes it an envelope */}
      {[1, -1].map((s) => (
        <mesh
          key={s}
          position={[(s * w) / 4, h / 2 - (h * 0.52) / 2, 0]}
          rotation={[0, 0, s * ang]}
          material={line}
        >
          <boxGeometry args={[flap, 0.016, 0.026]} />
        </mesh>
      ))}
      {/* Unread badge */}
      <mesh position={[side * (w / 2 - 0.08), h / 2 - 0.08, 0.02]} material={glow('#ff2a6d', 3.2)}>
        <sphereGeometry args={[0.035, 12, 10]} />
      </mesh>
      <mesh position={[-side * (w / 2 + 0.14), 0, 0]} material={mats.frame}>
        <boxGeometry args={[0.3, 0.05, 0.05]} />
      </mesh>
    </group>
  )
}

function VibeMail({ color, frozen }: BuildProps) {
  const mats = hullMaterials()
  const packets = useRef<THREE.Group>(null)
  const dish = useMemo(() => {
    const pts: THREE.Vector2[] = []
    for (let i = 0; i <= 12; i++) {
      const x = (i / 12) * 0.56
      pts.push(new THREE.Vector2(x, x * x * 0.62))
    }
    return new THREE.LatheGeometry(pts, 40)
  }, [])
  const dishMat = useMemo(() => {
    const m = mats.light.clone()
    m.side = THREE.DoubleSide
    return m
  }, [mats])

  useTick((t) => {
    packets.current?.children.forEach((p, i) => {
      // Packets leave the feed and climb the dish boresight, shrinking as they go.
      const s = (t * 0.22 + i / 7) % 1
      p.position.set(0, 0.34 + s * 1.5, 0)
      p.scale.setScalar(1 - s * 0.7)
      p.rotation.y = t * 1.5 + i
      p.visible = s > 0.03
    })
  }, frozen)

  return (
    <group>
      {/* Hub */}
      <mesh material={mats.mid}>
        <cylinderGeometry args={[0.3, 0.3, 0.86, 8]} />
      </mesh>
      {[0.33, -0.33].map((y) => (
        <mesh key={y} position={[0, y, 0]} material={mats.light}>
          <cylinderGeometry args={[0.34, 0.34, 0.1, 8]} />
        </mesh>
      ))}
      {[0.14, -0.02, -0.18].map((y) => (
        <mesh key={y} position={[0, y, 0]} material={mats.window}>
          <cylinderGeometry args={[0.303, 0.303, 0.035, 8, 1, true]} />
        </mesh>
      ))}
      <mesh position={[0, 0.5, 0]} material={mats.dark}>
        <cylinderGeometry args={[0.14, 0.24, 0.26, 8]} />
      </mesh>
      <mesh position={[0, -0.52, 0]} material={mats.dark}>
        <cylinderGeometry args={[0.24, 0.1, 0.3, 8]} />
      </mesh>
      <mesh position={[0, -0.02, 0]} rotation={[Math.PI / 2, 0, 0]} material={glow(color, 2.4)}>
        <torusGeometry args={[0.345, 0.012, 6, 8]} />
      </mesh>

      <Envelope side={1} color={color} />
      <Envelope side={-1} color={color} />

      {/* Uplink dish, tipped back so its beam clears the dock approach */}
      <group position={[0, 0.66, -0.05]} rotation={[-0.42, 0, 0.12]}>
        <mesh material={mats.frame}>
          <cylinderGeometry args={[0.05, 0.07, 0.14, 8]} />
        </mesh>
        <group position={[0, 0.07, 0]}>
          <mesh geometry={dish} material={dishMat} />
          <mesh position={[0, 0.195, 0]} rotation={[Math.PI / 2, 0, 0]} material={glow(color, 2.2)}>
            <torusGeometry args={[0.56, 0.01, 6, 48]} />
          </mesh>
          {[0, 2.1, 4.2].map((a) => (
            <Tube
              key={a}
              a={[Math.cos(a) * 0.5, 0.16, Math.sin(a) * 0.5]}
              b={[0, 0.36, 0]}
              r={0.008}
              material={mats.frame}
            />
          ))}
          <mesh position={[0, 0.36, 0]} material={glow(color, 4)}>
            <sphereGeometry args={[0.035, 12, 10]} />
          </mesh>
          <group ref={packets}>
            {Array.from({ length: 7 }, (_, i) => (
              <mesh key={i} material={glow(color, 3)}>
                <boxGeometry args={[0.1, 0.012, 0.066]} />
              </mesh>
            ))}
          </group>
        </group>
      </group>

      {/* Lower mast and radiators */}
      <mesh position={[0, -0.98, 0]} material={mats.frame}>
        <cylinderGeometry args={[0.014, 0.04, 0.66, 6]} />
      </mesh>
      <Blinker position={[0, -1.32, 0]} color="#ff3355" />
      {[1, -1].map((s) => (
        <mesh key={s} position={[s * 0.16, -0.5, -0.36]} rotation={[0.3, 0, 0]} material={mats.light}>
          <boxGeometry args={[0.02, 0.5, 0.3]} />
        </mesh>
      ))}
      <DockPort from={0.26} color={color} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Astra: an orbital observatory. A rotating habitat wheel around a    */
/* spindle, a telescope dome on top, and the planet it studies below.  */
/* ------------------------------------------------------------------ */

const miniPlanetVert = /* glsl */ `
  varying vec3 vN;
  varying vec3 vObj;
  varying vec3 vView;
  void main() {
    vObj = normalize(position);
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`
const miniPlanetFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uSpin;
  varying vec3 vN;
  varying vec3 vObj;
  varying vec3 vView;
  void main() {
    vec3 n = normalize(vN);
    float lon = atan(vObj.z, vObj.x + 1e-5) + uSpin;
    float swirl = sin(vObj.y * 16.0 + sin(lon * 3.0) * 1.3) * 0.5 + 0.5;
    float storms = sin(lon * 5.0 + vObj.y * 9.0) * 0.5 + 0.5;
    vec3 a = vec3(0.07, 0.03, 0.2);
    vec3 col = mix(a, uColor, swirl * 0.75);
    col = mix(col, vec3(0.3, 0.85, 1.0), storms * storms * 0.25);
    float lit = smoothstep(-0.2, 0.6, dot(n, normalize(vec3(0.5, 0.45, 0.75))));
    float fres = 1.0 - max(dot(n, vView), 0.0);
    fres *= fres;
    gl_FragColor = vec4(col * (0.08 + lit * 1.1) + uColor * fres * 1.6, 1.0);
  }
`

function Astra({ color, frozen }: BuildProps) {
  const mats = hullMaterials()
  const wheel = useRef<THREE.Group>(null)
  const upper = useRef<THREE.Group>(null)
  const planet = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: miniPlanetVert,
        fragmentShader: miniPlanetFrag,
        uniforms: { uColor: { value: new THREE.Color(color) }, uSpin: { value: 0 } },
      }),
    [color],
  )
  const halo = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color).multiplyScalar(0.5),
        transparent: true,
        opacity: 0.35,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [color],
  )

  useTick((t) => {
    if (wheel.current) wheel.current.rotation.y = t * 0.16
    if (upper.current) upper.current.rotation.y = -t * 0.3
    planet.uniforms.uSpin.value = t * 0.12
  }, frozen)

  return (
    <group position={[0, 0.12, -0.58]}>
      {/* Spindle and hub */}
      <mesh material={mats.mid}>
        <cylinderGeometry args={[0.1, 0.1, 1.7, 10]} />
      </mesh>
      <mesh material={mats.light}>
        <cylinderGeometry args={[0.28, 0.28, 0.34, 16]} />
      </mesh>
      <mesh material={mats.window}>
        <cylinderGeometry args={[0.283, 0.283, 0.04, 16, 1, true]} />
      </mesh>
      {[0.2, -0.2].map((y) => (
        <mesh key={y} position={[0, y, 0]} material={mats.dark}>
          <cylinderGeometry args={[0.2, 0.2, 0.08, 16]} />
        </mesh>
      ))}

      {/* Habitat wheel */}
      <group ref={wheel}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.light}>
          <torusGeometry args={[0.92, 0.095, 10, 72]} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.window}>
          <torusGeometry args={[0.822, 0.012, 6, 72]} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={glow(color, 2.6)}>
          <torusGeometry args={[1.02, 0.011, 6, 72]} />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <group key={i} rotation={[0, (i * Math.PI) / 2, 0]}>
            <mesh position={[0.56, 0, 0]} material={mats.dark}>
              <boxGeometry args={[0.6, 0.05, 0.07]} />
            </mesh>
            <mesh position={[0.92, 0, 0]} material={mats.mid}>
              <boxGeometry args={[0.24, 0.24, 0.34]} />
            </mesh>
            <group rotation={[0, Math.PI / 4, 0]}>
              <mesh position={[0.92, 0, 0]} material={mats.dark}>
                <boxGeometry args={[0.2, 0.2, 0.12]} />
              </mesh>
            </group>
          </group>
        ))}
      </group>

      {/* Counter-rotating sensor ring */}
      <group ref={upper} position={[0, 0.5, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.dark}>
          <torusGeometry args={[0.42, 0.03, 8, 48]} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <group key={i} rotation={[0, (i * Math.PI * 2) / 3, 0]}>
            <mesh position={[0.25, 0, 0]} material={mats.frame}>
              <boxGeometry args={[0.34, 0.02, 0.02]} />
            </mesh>
            <mesh position={[0.42, 0, 0]} material={glow(color, 3)}>
              <sphereGeometry args={[0.03, 10, 8]} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Observatory dome and telescope */}
      <group position={[0, 0.85, 0]}>
        <mesh material={mats.dark}>
          <cylinderGeometry args={[0.3, 0.26, 0.1, 20]} />
        </mesh>
        <mesh position={[0, 0.05, 0]} material={mats.light}>
          <sphereGeometry args={[0.28, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <group position={[0, 0.14, 0]} rotation={[-0.75, 0.5, 0]}>
          <mesh position={[0, 0.26, 0]} material={mats.dark}>
            <cylinderGeometry args={[0.085, 0.07, 0.56, 14]} />
          </mesh>
          <mesh position={[0, 0.545, 0]} rotation={[-Math.PI / 2, 0, 0]} material={glow(color, 3)}>
            <circleGeometry args={[0.075, 20]} />
          </mesh>
        </group>
      </group>

      {/* Solar wings on the lower spindle */}
      {[1, -1].map((s) => (
        <group key={s}>
          <SolarWing position={[s * 0.62, -0.62, 0]} rotation={[0.5, 0, 0]} size={[0.8, 0.3]} />
          <mesh position={[s * 0.16, -0.62, 0]} material={mats.frame}>
            <boxGeometry args={[0.14, 0.03, 0.03]} />
          </mesh>
        </group>
      ))}

      {/* The planet under study */}
      <group position={[0, -1.42, 0]}>
        <mesh material={planet}>
          <sphereGeometry args={[0.36, 40, 28]} />
        </mesh>
        <mesh material={halo}>
          <sphereGeometry args={[0.42, 32, 20]} />
        </mesh>
      </group>
      <mesh position={[0, -0.9, 0]} material={glow(color, 3)}>
        <coneGeometry args={[0.05, 0.12, 10]} />
      </mesh>
      <Blinker position={[0, 1.18, 0]} color="#ffffff" period={2.2} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Mars Colony: a floating slab of Mars with domes, a drill rig, solar */
/* field, landing pad and a rover doing its rounds.                    */
/* ------------------------------------------------------------------ */

function marsTerrain() {
  const geo = new THREE.IcosahedronGeometry(1, 5)
  const pos = geo.attributes.position
  const color = new Float32Array(pos.count * 3)
  const top = new THREE.Color('#c8572c')
  const dust = new THREE.Color('#e08a4a')
  const rock = new THREE.Color('#5a2418')
  const c = new THREE.Color()
  const n3 = (x: number, y: number, z: number) =>
    Math.sin(x * 5.1 + y * 3.3) * Math.cos(z * 4.7 - x * 2.1) * 0.5 +
    Math.sin(x * 11.3 + z * 9.1 + y * 7.7) * 0.25
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i)
    let y = pos.getY(i)
    let z = pos.getZ(i)
    const r = Math.hypot(x, z)
    if (y >= 0) {
      // Flat mesa top with low dunes, rougher toward the rim.
      const rim = THREE.MathUtils.smoothstep(r, 0.82, 1)
      y = y * 0.04 + n3(x, 0, z) * 0.025 + rim * (n3(x * 2, 1, z * 2) * 0.05 - 0.04)
      c.copy(top).lerp(dust, THREE.MathUtils.clamp(0.5 + n3(x * 2, 3, z * 2), 0, 1))
    } else {
      // Jagged underside tapering to a point.
      const taper = 1 + y * 0.55
      const j = 1 + n3(x * 2.2, y * 2.2, z * 2.2) * 0.28
      x *= taper * j
      z *= taper * j
      y = y * 0.95 * (1 + n3(z * 3, x * 3, y) * 0.2)
      c.copy(rock).lerp(top, THREE.MathUtils.clamp(1 + y * 3.5, 0, 1) * 0.6)
    }
    pos.setXYZ(i, x * 1.04, y, z * 1.04)
    color.set([c.r, c.g, c.b], i * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(color, 3))
  geo.computeVertexNormals()
  return geo
}

function Dome({ position, r, color }: { position: [number, number, number]; r: number; color: string }) {
  const mats = hullMaterials()
  return (
    <group position={position}>
      <mesh position={[0, 0.02, 0]} material={mats.light}>
        <cylinderGeometry args={[r * 1.08, r * 1.14, 0.05, 20]} />
      </mesh>
      <mesh position={[0, 0.045, 0]} rotation={[Math.PI / 2, 0, 0]} material={glow(color, 2.4)}>
        <torusGeometry args={[r * 1.02, 0.008, 6, 32]} />
      </mesh>
      {/* Lit interior: a habitat block and a strip of greenhouse */}
      <mesh position={[0, 0.045 + r * 0.22, 0]} material={mats.window}>
        <boxGeometry args={[r * 0.7, r * 0.4, r * 0.5]} />
      </mesh>
      <mesh position={[r * 0.1, 0.05, r * 0.5]} material={glow('#58ff8a', 1.6)}>
        <boxGeometry args={[r * 0.8, 0.02, r * 0.22]} />
      </mesh>
      <mesh position={[0, 0.045, 0]} material={glass('#ffb38a', 0.22)}>
        <sphereGeometry args={[r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
    </group>
  )
}

function Mars({ color, frozen }: BuildProps) {
  const mats = hullMaterials()
  const rover = useRef<THREE.Group>(null)
  const radar = useRef<THREE.Group>(null)
  const drill = useRef<THREE.Mesh>(null)
  const terrain = useMemo(marsTerrain, [])
  const ground = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        roughness: 0.95,
        metalness: 0,
      }),
    [],
  )

  useTick((t) => {
    if (rover.current) {
      const a = t * 0.22
      rover.current.position.set(Math.cos(a) * 0.9, 0.035, Math.sin(a) * 0.9)
      rover.current.rotation.y = -a
    }
    if (radar.current) radar.current.rotation.y = t * 0.9
    if (drill.current) drill.current.rotation.y = t * 5
  }, frozen)

  const domes: { p: [number, number, number]; r: number }[] = [
    { p: [-0.3, 0, 0.16], r: 0.31 },
    { p: [0.3, 0, 0.34], r: 0.21 },
    { p: [0.14, 0, -0.38], r: 0.25 },
  ]

  return (
    <group position={[0, 0.05, -0.58]} rotation={[0.24, 0, 0]}>
      <mesh geometry={terrain} material={ground} />
      {domes.map((d, i) => (
        <Dome key={i} position={d.p} r={d.r} color={color} />
      ))}
      {/* Pressurised corridors between domes */}
      <Tube a={[-0.3, 0.05, 0.16]} b={[0.3, 0.05, 0.34]} r={0.035} material={mats.light} sides={8} />
      <Tube a={[-0.3, 0.05, 0.16]} b={[0.14, 0.05, -0.38]} r={0.035} material={mats.light} sides={8} />
      <Tube a={[0.3, 0.05, 0.34]} b={[0.14, 0.05, -0.38]} r={0.03} material={mats.light} sides={8} />

      {/* Landing pad */}
      <group position={[0.64, 0.02, -0.22]}>
        <mesh material={mats.dark}>
          <cylinderGeometry args={[0.2, 0.22, 0.03, 8]} />
        </mesh>
        <mesh position={[0, 0.018, 0]} rotation={[Math.PI / 2, 0, 0]} material={glow(color, 2.6)}>
          <torusGeometry args={[0.16, 0.007, 6, 8]} />
        </mesh>
        {[0, Math.PI / 2].map((a) => (
          <mesh key={a} position={[0, 0.018, 0]} rotation={[0, a, 0]} material={glow('#ffffff', 1.6)}>
            <boxGeometry args={[0.16, 0.004, 0.02]} />
          </mesh>
        ))}
        {/* A parked lander */}
        <mesh position={[0, 0.1, 0]} material={mats.light}>
          <cylinderGeometry args={[0.035, 0.07, 0.14, 8]} />
        </mesh>
        <mesh position={[0, 0.19, 0]} material={mats.mid}>
          <coneGeometry args={[0.035, 0.05, 8]} />
        </mesh>
      </group>

      {/* Mining rig */}
      <group position={[-0.58, 0, -0.42]}>
        <mesh position={[0, 0.3, 0]} material={mats.frame}>
          <cylinderGeometry args={[0.025, 0.12, 0.6, 4, 4]} />
        </mesh>
        <mesh position={[0, 0.3, 0]} material={glow(color, 1.8)}>
          <cylinderGeometry args={[0.008, 0.008, 0.6, 4]} />
        </mesh>
        <mesh ref={drill} position={[0, 0.03, 0]} rotation={[Math.PI, 0, 0]} material={mats.mid}>
          <coneGeometry args={[0.04, 0.1, 5]} />
        </mesh>
        <mesh position={[0, 0.63, 0]} material={mats.dark}>
          <boxGeometry args={[0.09, 0.06, 0.09]} />
        </mesh>
        <Blinker position={[0, 0.7, 0]} color="#ff3b2f" period={1.1} />
        <mesh position={[0.16, 0.04, 0.08]} material={ground}>
          <coneGeometry args={[0.09, 0.09, 6]} />
        </mesh>
      </group>

      {/* Solar field */}
      {[-0.86, -0.68].map((x) =>
        [0.02, 0.2, 0.38].map((z) => (
          <group key={`${x}${z}`} position={[x, 0.07, z - 0.12]}>
            <mesh rotation={[-0.6, 0, 0]} material={mats.solar}>
              <boxGeometry args={[0.14, 0.008, 0.11]} />
            </mesh>
            <mesh position={[0, -0.035, 0]} material={mats.frame}>
              <cylinderGeometry args={[0.006, 0.006, 0.07, 4]} />
            </mesh>
          </group>
        )),
      )}

      {/* Life-support tanks and comms */}
      {[0, 0.11].map((z) => (
        <mesh key={z} position={[0.72, 0.05, 0.14 + z]} rotation={[0, 0, Math.PI / 2]} material={mats.light}>
          <capsuleGeometry args={[0.04, 0.16, 4, 10]} />
        </mesh>
      ))}
      <group position={[-0.08, 0, -0.74]}>
        <mesh position={[0, 0.12, 0]} material={mats.frame}>
          <cylinderGeometry args={[0.01, 0.014, 0.24, 6]} />
        </mesh>
        <group ref={radar} position={[0, 0.25, 0]}>
          <mesh rotation={[0.9, 0, 0]} material={mats.light}>
            <cylinderGeometry args={[0.09, 0.02, 0.035, 14]} />
          </mesh>
        </group>
      </group>

      {/* Rover on its survey loop */}
      <group ref={rover}>
        <mesh material={mats.light}>
          <boxGeometry args={[0.07, 0.035, 0.11]} />
        </mesh>
        {[1, -1].map((s) =>
          [-0.035, 0.035].map((z) => (
            <mesh key={`${s}${z}`} position={[s * 0.04, -0.015, z]} rotation={[0, 0, Math.PI / 2]} material={mats.frame}>
              <cylinderGeometry args={[0.02, 0.02, 0.016, 8]} />
            </mesh>
          )),
        )}
        <mesh position={[0, 0.005, 0.058]} material={glow('#fff2c0', 4)}>
          <boxGeometry args={[0.05, 0.012, 0.006]} />
        </mesh>
      </group>

      {/* Anchor keel that holds the slab on station */}
      <mesh position={[0, -1.0, 0]} material={mats.dark}>
        <cylinderGeometry args={[0.16, 0.05, 0.26, 8]} />
      </mesh>
      <mesh position={[0, -0.88, 0]} rotation={[Math.PI / 2, 0, 0]} material={glow(color, 2.6)}>
        <torusGeometry args={[0.17, 0.012, 6, 24]} />
      </mesh>
      <Blinker position={[0, -1.16, 0]} color={color} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Cosmos: an orrery. A star with planets on tilted orbit rings, an    */
/* ISS on its own track, and a bank of glass dashboard panels.         */
/* ------------------------------------------------------------------ */

function dashboardTexture(color: string, variant: number) {
  const cv = document.createElement('canvas')
  cv.width = 512
  cv.height = 320
  const c = cv.getContext('2d')!
  c.fillStyle = 'rgba(4,14,10,0.55)'
  c.fillRect(0, 0, 512, 320)
  c.strokeStyle = color
  c.fillStyle = color
  c.lineWidth = 3
  c.strokeRect(6, 6, 500, 308)
  c.globalAlpha = 0.9
  c.fillRect(24, 22, 150, 10)
  c.globalAlpha = 0.5
  c.fillRect(24, 40, 90, 6)
  c.globalAlpha = 1
  if (variant === 0) {
    // Near-Earth objects: a line chart.
    c.beginPath()
    for (let i = 0; i <= 24; i++) {
      const x = 28 + i * 19
      const y = 200 - Math.sin(i * 0.7) * 40 - Math.cos(i * 0.31) * 50
      if (i === 0) c.moveTo(x, y)
      else c.lineTo(x, y)
    }
    c.stroke()
    c.globalAlpha = 0.35
    for (let i = 0; i < 5; i++) c.fillRect(28, 90 + i * 45, 456, 1)
  } else if (variant === 1) {
    // ISS tracker: a globe graticule with a ground track.
    c.beginPath()
    c.arc(256, 180, 104, 0, Math.PI * 2)
    c.stroke()
    c.globalAlpha = 0.5
    for (const k of [0.35, 0.7]) {
      c.beginPath()
      c.ellipse(256, 180, 104 * k, 104, 0, 0, Math.PI * 2)
      c.stroke()
      c.beginPath()
      c.ellipse(256, 180, 104, 104 * k, 0, 0, Math.PI * 2)
      c.stroke()
    }
    c.globalAlpha = 1
    c.beginPath()
    c.ellipse(256, 180, 122, 40, -0.5, 0, Math.PI * 2)
    c.stroke()
    c.beginPath()
    c.arc(350, 118, 8, 0, Math.PI * 2)
    c.fill()
  } else {
    // Space weather: bars.
    for (let i = 0; i < 11; i++) {
      const h = 40 + Math.abs(Math.sin(i * 1.7)) * 170
      c.globalAlpha = 0.45 + (i % 3) * 0.25
      c.fillRect(34 + i * 41, 290 - h, 24, h)
    }
  }
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function Orbit({
  radius,
  tilt,
  speed,
  planet,
  size,
  color,
  frozen,
  children,
}: {
  radius: number
  tilt: [number, number, number]
  speed: number
  planet: string
  size: number
  color: string
  frozen?: boolean
  children?: ReactNode
}) {
  const spin = useRef<THREE.Group>(null)
  useTick((t) => {
    if (spin.current) spin.current.rotation.y = t * speed + radius * 9
  }, frozen)
  return (
    <group rotation={tilt}>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={glow(color, 1.5)}>
        <torusGeometry args={[radius, 0.009, 6, 96]} />
      </mesh>
      <group ref={spin}>
        <group position={[radius, 0, 0]}>
          {children ?? (
            <mesh>
              <sphereGeometry args={[size, 20, 14]} />
              <meshStandardMaterial color={planet} emissive={planet} emissiveIntensity={0.55} roughness={0.6} />
            </mesh>
          )}
        </group>
      </group>
    </group>
  )
}

function Cosmos({ color, frozen }: BuildProps) {
  const mats = hullMaterials()
  const panels = useMemo(
    () =>
      [0, 1, 2].map(
        (v) =>
          new THREE.MeshBasicMaterial({
            map: dashboardTexture(color, v),
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            toneMapped: false,
            color: new THREE.Color(1.5, 1.5, 1.5),
          }),
      ),
    [color],
  )
  const corona = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color).multiplyScalar(0.6),
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [color],
  )
  const dish = useMemo(() => {
    const pts: THREE.Vector2[] = []
    for (let i = 0; i <= 10; i++) {
      const x = (i / 10) * 0.3
      pts.push(new THREE.Vector2(x, x * x * 0.9))
    }
    return new THREE.LatheGeometry(pts, 28)
  }, [])
  const dishMat = useMemo(() => {
    const m = mats.light.clone()
    m.side = THREE.DoubleSide
    return m
  }, [mats])

  return (
    <group position={[0, 0.18, -0.74]}>
      {/* The star */}
      <mesh material={glow('#f2ffd8', 3.4)}>
        <sphereGeometry args={[0.17, 28, 20]} />
      </mesh>
      <mesh material={corona}>
        <sphereGeometry args={[0.27, 24, 16]} />
      </mesh>
      <pointLight color={color} intensity={2.5} distance={3} decay={2} />

      <Orbit radius={0.46} tilt={[1.05, 0, 0.3]} speed={0.7} planet="#ff9a52" size={0.06} color={color} frozen={frozen} />
      <Orbit radius={0.7} tilt={[-0.7, 0.6, 0.35]} speed={0.42} planet="#4aa8ff" size={0.095} color={color} frozen={frozen} />
      <Orbit radius={0.94} tilt={[0.45, 1.2, -0.6]} speed={0.26} planet="#d9c8ff" size={0.06} color={color} frozen={frozen}>
        {/* The ISS: truss, modules and solar wings */}
        <group scale={0.9} rotation={[0.3, 0.4, 0]}>
          <mesh material={mats.light}>
            <boxGeometry args={[0.2, 0.02, 0.02]} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.mid}>
            <cylinderGeometry args={[0.022, 0.022, 0.1, 8]} />
          </mesh>
          {[1, -1].map((s) => (
            <mesh key={s} position={[s * 0.1, 0, 0]} material={mats.solar}>
              <boxGeometry args={[0.05, 0.004, 0.16]} />
            </mesh>
          ))}
          <mesh material={glow(color, 4)}>
            <sphereGeometry args={[0.012, 8, 6]} />
          </mesh>
        </group>
      </Orbit>

      {/* Armillary meridians */}
      <mesh material={mats.mid}>
        <torusGeometry args={[1.17, 0.028, 8, 80]} />
      </mesh>
      <mesh rotation={[0, 0, 0]} material={glow(color, 2)}>
        <torusGeometry args={[1.135, 0.006, 6, 80]} />
      </mesh>
      {/* Structural equator ring with sensor pods */}
      <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.dark}>
        <torusGeometry args={[1.2, 0.05, 8, 80]} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={glow(color, 2.6)}>
        <torusGeometry args={[1.265, 0.009, 6, 80]} />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + 0.39
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 1.2, 0, Math.sin(a) * 1.2]}
            rotation={[0, -a, 0]}
            material={i % 2 ? mats.light : mats.mid}
          >
            <boxGeometry args={[0.16, 0.16, 0.26]} />
          </mesh>
        )
      })}

      {/* Trunk, struts and downlink dish */}
      <mesh position={[0, -0.98, 0]} material={mats.mid}>
        <cylinderGeometry args={[0.1, 0.16, 0.5, 10]} />
      </mesh>
      {[0.5, 2.6, 4.7].map((a) => (
        <Tube
          key={a}
          a={[0, -0.78, 0]}
          b={[Math.cos(a) * 1.18, -0.02, Math.sin(a) * 1.18]}
          r={0.016}
          material={mats.frame}
        />
      ))}
      <group position={[0, -1.24, 0]} rotation={[Math.PI - 0.5, 0, 0]}>
        <mesh geometry={dish} material={dishMat} />
        <mesh position={[0, 0.2, 0]} material={glow(color, 3.4)}>
          <sphereGeometry args={[0.025, 10, 8]} />
        </mesh>
      </group>

      {/* Dashboard: three glass readouts fanned toward the dock */}
      {[-0.62, 0, 0.62].map((a, i) => (
        <group key={a} rotation={[0, a, 0]}>
          <group position={[0, -0.78, 0.66]} rotation={[-0.18, 0, 0]}>
            <mesh material={panels[i]}>
              <planeGeometry args={[0.56, 0.35]} />
            </mesh>
            <mesh position={[0, -0.2, -0.01]} material={mats.frame}>
              <boxGeometry args={[0.5, 0.02, 0.02]} />
            </mesh>
          </group>
          <Tube a={[0, -0.98, 0.1]} b={[0, -0.98, 0.66]} r={0.012} material={mats.frame} />
        </group>
      ))}
      <Blinker position={[0, -1.0, -1.25]} color={color} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Periodical: three magazine volumes bound to one spine, pages fanned */
/* open toward the dock, each volume turning a page.                   */
/* ------------------------------------------------------------------ */

function pageTexture(variant: number) {
  const cv = document.createElement('canvas')
  cv.width = 512
  cv.height = 352
  const c = cv.getContext('2d')!
  c.fillStyle = '#efe8d2'
  c.fillRect(0, 0, 512, 352)
  c.fillStyle = '#16140f'
  if (variant === 0) {
    c.fillRect(28, 28, 300, 34)
    c.fillRect(28, 72, 190, 12)
    c.fillStyle = '#d8b400'
    c.fillRect(28, 104, 200, 140)
    c.fillStyle = '#16140f'
    c.beginPath()
    c.arc(128, 174, 44, 0, Math.PI * 2)
    c.fill()
  } else {
    c.fillRect(28, 28, 130, 16)
    c.fillRect(28, 58, 456, 4)
    c.fillStyle = '#d8b400'
    c.fillRect(28, 80, 60, 60)
    c.fillStyle = '#16140f'
  }
  // Columns of body text.
  c.globalAlpha = 0.6
  const x0 = variant === 0 ? 250 : 104
  for (let col = 0; col < (variant === 0 ? 2 : 3); col++) {
    for (let row = 0; row < 26; row++) {
      const y = (variant === 0 ? 104 : 82) + row * 9
      if (y > 320) break
      const w = 104 + ((row * 37 + col * 53) % 20)
      c.fillRect(x0 + col * 132, y, row % 7 === 6 ? w * 0.5 : w, 3)
    }
  }
  c.globalAlpha = 1
  c.fillRect(456, 322, 28, 4)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function numeralTexture(text: string, color: string) {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 128
  const c = cv.getContext('2d')!
  c.fillStyle = color
  c.font = '700 84px Georgia, "Times New Roman", serif'
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(text, 64, 70)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const PAGES = 13
const FAN_FROM = 1.12 // radians off the dock axis: the opening of the book
const PAGE_W = 0.88
const PAGE_H = 0.62

function Volume({
  y,
  index,
  color,
  mats,
  frozen,
}: {
  y: number
  index: number
  color: string
  mats: THREE.Material[]
  frozen?: boolean
}) {
  const hull = hullMaterials()
  const flip = useRef<THREE.Group>(null)
  const numeral = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: numeralTexture(['I', 'II', 'III'][index], '#ffffff'),
        color: new THREE.Color(color).multiplyScalar(2.6),
        transparent: true,
        toneMapped: false,
      }),
    [color, index],
  )

  useTick((t) => {
    if (!flip.current) return
    // One page per volume swings across the opening, then rests.
    const cycle = 6.5
    const s = ((t + index * 2.1) % cycle) / 2.4
    const k = s >= 1 ? 1 : s * s * (3 - 2 * s)
    const dirn = Math.floor((t + index * 2.1) / cycle) % 2 === 0 ? 1 : -1
    const theta = dirn * (FAN_FROM - 0.04) * (1 - 2 * k)
    flip.current.rotation.y = theta - Math.PI / 2
  }, frozen)

  const page = (theta: number, key: number | string, cover: boolean) => (
    <group key={key} rotation={[0, theta - Math.PI / 2, 0]}>
      <mesh position={[0.1 + PAGE_W / 2, 0, 0]} material={cover ? hull.dark : mats[typeof key === 'number' ? key % 2 : 0]}>
        <boxGeometry args={[PAGE_W, PAGE_H + (cover ? 0.04 : 0), cover ? 0.03 : 0.008]} />
      </mesh>
      {cover && (
        <>
          <mesh position={[0.1 + PAGE_W, 0, 0]} material={glow(color, 2.4)}>
            <boxGeometry args={[0.014, PAGE_H + 0.05, 0.036]} />
          </mesh>
          {[1, -1].map((s) => (
            <mesh key={s} position={[0.1 + PAGE_W / 2, s * (PAGE_H / 2 + 0.02), 0]} material={glow(color, 2.4)}>
              <boxGeometry args={[PAGE_W, 0.012, 0.036]} />
            </mesh>
          ))}
        </>
      )}
    </group>
  )

  return (
    <group position={[0, y, 0]}>
      {Array.from({ length: PAGES }, (_, i) => {
        const theta = FAN_FROM + (i / (PAGES - 1)) * (Math.PI * 2 - FAN_FROM * 2)
        return page(theta, i, i === 0 || i === PAGES - 1)
      })}
      <group ref={flip}>
        <mesh position={[0.1 + PAGE_W / 2, 0, 0]} material={mats[0]}>
          <boxGeometry args={[PAGE_W, PAGE_H, 0.008]} />
        </mesh>
      </group>
      <mesh position={[0, 0, 0.112]} material={numeral}>
        <planeGeometry args={[0.2, 0.2]} />
      </mesh>
    </group>
  )
}

function Periodical({ color, frozen }: BuildProps) {
  const hull = hullMaterials()
  const pageMats = useMemo(
    () =>
      [0, 1].map((v) => {
        const map = pageTexture(v)
        return new THREE.MeshStandardMaterial({
          map,
          emissiveMap: map,
          emissive: '#ffffff',
          emissiveIntensity: 0.42,
          roughness: 0.85,
          metalness: 0,
        })
      }),
    [],
  )
  return (
    <group position={[0, 0.05, -0.5]}>
      {/* Spine */}
      <mesh material={hull.dark}>
        <boxGeometry args={[0.2, 2.5, 0.2]} />
      </mesh>
      {[
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x * 0.1, 0, z * 0.1]} material={glow(color, 2.2)}>
          <boxGeometry args={[0.014, 2.5, 0.014]} />
        </mesh>
      ))}
      {[1.12, 0.375, -0.375, -1.12].map((y) => (
        <mesh key={y} position={[0, y, 0]} material={hull.light}>
          <cylinderGeometry args={[0.3, 0.3, 0.05, 6]} />
        </mesh>
      ))}
      {[0.75, 0, -0.75].map((y, i) => (
        <Volume key={y} y={y} index={i} color={color} mats={pageMats} frozen={frozen} />
      ))}
      {/* Masthead and press head */}
      <mesh position={[0, 1.34, 0]} material={hull.mid}>
        <cylinderGeometry args={[0.12, 0.22, 0.22, 6]} />
      </mesh>
      <mesh position={[0, 1.66, 0]} material={hull.frame}>
        <cylinderGeometry args={[0.01, 0.02, 0.44, 6]} />
      </mesh>
      <Blinker position={[0, 1.9, 0]} color={color} period={2} />
      <mesh position={[0, -1.36, 0]} material={hull.mid}>
        <cylinderGeometry args={[0.22, 0.08, 0.26, 6]} />
      </mesh>
      <mesh position={[0, -1.52, 0]} material={glow(color, 3)}>
        <sphereGeometry args={[0.05, 12, 10]} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Cube Lab: a Rubik's cube held in a gimbal, layers turning, with a   */
/* 2x2 and a 4x4 on the side arms.                                     */
/* ------------------------------------------------------------------ */

const FACE_COLORS = ['#ff2438', '#ff7a14', '#f6f6f6', '#ffd400', '#12e06a', '#2478ff']

/** One cubie: a dark body with a sticker on each outward face, colours baked per vertex. */
function cubieGeometry(n: number, size: number, ix: number, iy: number, iz: number) {
  const parts: THREE.BufferGeometry[] = []
  const paint = (g: THREE.BufferGeometry, hex: string) => {
    const c = new THREE.Color(hex)
    const arr = new Float32Array(g.attributes.position.count * 3)
    for (let i = 0; i < arr.length; i += 3) arr.set([c.r, c.g, c.b], i)
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
    return g
  }
  parts.push(paint(new THREE.BoxGeometry(size * 0.97, size * 0.97, size * 0.97), '#08080b'))
  const idx = [ix, iy, iz]
  for (let axis = 0; axis < 3; axis++) {
    for (const sign of [1, -1]) {
      if (idx[axis] !== (sign === 1 ? n - 1 : 0)) continue
      const s = new THREE.PlaneGeometry(size * 0.84, size * 0.84)
      if (axis === 0) s.rotateY((sign * Math.PI) / 2)
      else if (axis === 1) s.rotateX((-sign * Math.PI) / 2)
      else if (sign === -1) s.rotateY(Math.PI)
      const off = [0, 0, 0]
      off[axis] = sign * size * 0.49
      s.translate(off[0], off[1], off[2])
      parts.push(paint(s, FACE_COLORS[axis * 2 + (sign === 1 ? 0 : 1)]))
    }
  }
  const merged = mergeGeometries(parts)
  parts.forEach((p) => p.dispose())
  return merged
}

function cubeMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.15 })
  // Stickers glow in their own colour; the dark body contributes almost nothing.
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n  totalEmissiveRadiance += vColor.rgb * 0.9;',
    )
  }
  return m
}

/** A static n x n cube merged into one mesh. */
function MiniCube({ n, size, material }: { n: number; size: number; material: THREE.Material }) {
  const geometry = useMemo(() => {
    const step = size / n
    const parts: THREE.BufferGeometry[] = []
    for (let x = 0; x < n; x++)
      for (let y = 0; y < n; y++)
        for (let z = 0; z < n; z++) {
          if (x > 0 && x < n - 1 && y > 0 && y < n - 1 && z > 0 && z < n - 1) continue
          const g = cubieGeometry(n, step, x, y, z)
          g.translate((x - (n - 1) / 2) * step, (y - (n - 1) / 2) * step, (z - (n - 1) / 2) * step)
          parts.push(g)
        }
    return mergeGeometries(parts)
  }, [n, size])
  return <mesh geometry={geometry} material={material} />
}

const CUBIE = 0.3
const AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)]

function RubiksCube({ material, frozen }: { material: THREE.Material; frozen?: boolean }) {
  const refs = useRef<(THREE.Mesh | null)[]>([])
  const cubies = useMemo(() => {
    const list: { geometry: THREE.BufferGeometry; grid: THREE.Vector3; quat: THREE.Quaternion }[] = []
    for (let x = 0; x < 3; x++)
      for (let y = 0; y < 3; y++)
        for (let z = 0; z < 3; z++) {
          if (x === 1 && y === 1 && z === 1) continue
          list.push({
            geometry: cubieGeometry(3, CUBIE, x, y, z),
            grid: new THREE.Vector3(x - 1, y - 1, z - 1),
            quat: new THREE.Quaternion(),
          })
        }
    return list
  }, [])
  const turn = useRef({ axis: 0, layer: 1, dir: 1, t: 0, rest: 0.6, seed: 5 })
  const q = useMemo(() => new THREE.Quaternion(), [])
  const p = useMemo(() => new THREE.Vector3(), [])

  useLayoutEffect(() => {
    cubies.forEach((c, i) => refs.current[i]?.position.copy(c.grid).multiplyScalar(CUBIE * 1.02))
  }, [cubies])

  useTick((_, dt) => {
    const s = turn.current
    if (s.rest > 0) {
      s.rest -= dt
      return
    }
    s.t = Math.min(1, s.t + dt / 0.9)
    const k = s.t * s.t * (3 - 2 * s.t)
    const axis = AXES[s.axis]
    q.setFromAxisAngle(axis, (s.dir * k * Math.PI) / 2)
    cubies.forEach((c, i) => {
      if (Math.round(c.grid.getComponent(s.axis)) !== s.layer) return
      const mesh = refs.current[i]
      if (!mesh) return
      mesh.position.copy(p.copy(c.grid).applyQuaternion(q)).multiplyScalar(CUBIE * 1.02)
      mesh.quaternion.copy(q).multiply(c.quat)
      if (s.t >= 1) {
        // Bake the finished quarter turn into the cubie's logical state.
        c.grid.applyQuaternion(q).round()
        c.quat.copy(mesh.quaternion)
      }
    })
    if (s.t >= 1) {
      s.seed = (s.seed * 16807) % 2147483647
      s.axis = s.seed % 3
      s.layer = (Math.floor(s.seed / 3) % 3) - 1
      s.dir = Math.floor(s.seed / 9) % 2 ? 1 : -1
      s.t = 0
      s.rest = 0.45
    }
  }, frozen)

  return (
    <group>
      {cubies.map((c, i) => (
        <mesh
          key={i}
          ref={(m) => {
            refs.current[i] = m
          }}
          geometry={c.geometry}
          material={material}
        />
      ))}
    </group>
  )
}

function Cube({ color, frozen }: BuildProps) {
  const mats = hullMaterials()
  const spin = useRef<THREE.Group>(null)
  const minis = useRef<(THREE.Group | null)[]>([])
  const material = useMemo(cubeMaterial, [])
  const beam = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color).multiplyScalar(0.7),
        transparent: true,
        opacity: 0.1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [color],
  )

  useTick((t) => {
    if (spin.current) spin.current.rotation.y = t * 0.2
    minis.current.forEach((m, i) => {
      if (m) m.rotation.set(t * 0.4 + i, t * 0.55, 0)
    })
  }, frozen)

  return (
    <group position={[0, 0.1, -0.46]}>
      <group ref={spin}>
        {/* Balanced on a corner */}
        <group rotation={[Math.atan(Math.SQRT1_2), 0, Math.PI / 4]}>
          <RubiksCube material={material} frozen={frozen} />
        </group>
      </group>

      {/* Gimbal */}
      {(
        [
          [0, 0, 0],
          [0, Math.PI / 2, 0],
          [Math.PI / 2, 0, 0],
        ] as [number, number, number][]
      ).map((r, i) => (
        <group key={i} rotation={r}>
          <mesh material={i === 2 ? mats.mid : mats.dark}>
            <torusGeometry args={[0.96, 0.024, 8, 80]} />
          </mesh>
          <mesh material={glow(color, 2.4)}>
            <torusGeometry args={[0.93, 0.006, 6, 80]} />
          </mesh>
        </group>
      ))}

      {/* Emitters above and below hold the cube in a containment field */}
      {[1, -1].map((s) => (
        <group key={s} position={[0, s * 1.08, 0]} scale={[1, s, 1]}>
          <mesh material={mats.mid}>
            <cylinderGeometry args={[0.2, 0.12, 0.24, 8]} />
          </mesh>
          <mesh position={[0, -0.125, 0]} rotation={[Math.PI / 2, 0, 0]} material={glow(color, 3)}>
            <torusGeometry args={[0.1, 0.012, 6, 24]} />
          </mesh>
          <mesh position={[0, -0.4, 0]} material={beam}>
            <cylinderGeometry args={[0.1, 0.34, 0.55, 20, 1, true]} />
          </mesh>
          <mesh position={[0, 0.2, 0]} material={mats.dark}>
            <cylinderGeometry args={[0.08, 0.2, 0.16, 8]} />
          </mesh>
        </group>
      ))}
      <Blinker position={[0, 1.4, 0]} color={color} />

      {/* Side arms carrying the other grid sizes */}
      {(
        [
          [-1, 2, 0.26],
          [1, 4, 0.34],
        ] as [number, number, number][]
      ).map(([s, n, size], i) => (
        <group key={s}>
          <Tube a={[s * 0.98, 0, 0]} b={[s * 1.3, 0, 0]} r={0.02} material={mats.frame} />
          <mesh position={[s * 1.3, -0.3, 0]} material={mats.mid}>
            <cylinderGeometry args={[0.1, 0.06, 0.12, 8]} />
          </mesh>
          <Tube a={[s * 1.3, 0, 0]} b={[s * 1.3, -0.26, 0]} r={0.02} material={mats.frame} />
          <group
            ref={(g) => {
              minis.current[i] = g
            }}
            position={[s * 1.3, 0.12 + size / 2, 0]}
          >
            <MiniCube n={n} size={size} material={material} />
          </group>
        </group>
      ))}
    </group>
  )
}

const BUILDERS: Record<string, (p: BuildProps) => ReactNode> = {
  vibemail: VibeMail,
  astra: Astra,
  mars: Mars,
  cosmos: Cosmos,
  periodical: Periodical,
  cube: Cube,
}

export function StationStructure({ id, color, frozen }: BuildProps & { id: string }) {
  const Build = BUILDERS[id] ?? VibeMail
  return <Build color={color} frozen={frozen} />
}
