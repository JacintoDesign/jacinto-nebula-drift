import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { ship } from '../store/useShip'
import { useGame } from '../store/useGame'
import { WarpStreaks } from './WarpStreaks'

export const SHIP_URL = import.meta.env.BASE_URL + 'models/ship.glb'
/** Fitted length of the hull in world units. */
const SHIP_SIZE = 3.4

/** Engine nozzles measured on the fitted hull: [x, y, z, radius]. */
const NOZZLES: [number, number, number, number][] = [
  [0, 0.1, 1.5, 0.17],
  [-0.6, 0.05, 1.13, 0.085],
  [0.6, 0.05, 1.13, 0.085],
]

const exhaustVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const exhaustFrag = /* glsl */ `
  uniform float uPower;
  uniform float uTime;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    // The cone's tip (uv.y = 1) is the tail of the plume.
    float along = 1.0 - clamp(vUv.y, 0.0, 1.0);
    float flicker = 0.85 + 0.15 * sin(uTime * 40.0 + along * 18.0);
    float core = along * along;
    float a = core * flicker * (0.1 + uPower * 0.42);
    vec3 col = mix(uColor, vec3(1.0), core * 0.25) * (1.0 + uPower * 0.6);
    gl_FragColor = vec4(col * a, a);
  }
`

/**
 * The player's fighter: bundled GLB fitted to size with nose on -Z, plus
 * engine plumes and warp streaks. Only cosmetic motion (bank, bob) lives here.
 */
export function ShipModel() {
  const hull = useRef<THREE.Group>(null)
  const plumes = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  const { scene } = useGLTF(SHIP_URL, false)

  const model = useMemo(() => {
    const root = scene.clone(true)
    const box = new THREE.Box3().setFromObject(root)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    root.position.sub(center)
    const holder = new THREE.Group()
    holder.add(root)
    holder.scale.setScalar(SHIP_SIZE / Math.max(size.x, size.y, size.z, 1e-4))
    root.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
      if (m && 'envMapIntensity' in m) m.envMapIntensity = 1.6
    })
    return holder
  }, [scene])

  // Unit cone with its mouth at the origin and its tip one unit astern (+Z).
  const plume = useMemo(() => {
    const g = new THREE.ConeGeometry(1, 1, 16, 1, true)
    g.rotateX(Math.PI / 2)
    g.translate(0, 0, 0.5)
    return g
  }, [])
  const nozzle = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#3fd8ff', toneMapped: false, side: THREE.DoubleSide }),
    [],
  )
  const exhaust = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: exhaustVert,
        fragmentShader: exhaustFrag,
        uniforms: {
          uPower: { value: 0 },
          uTime: { value: 0 },
          uColor: { value: new THREE.Color('#3fd8ff') },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  )

  useFrame((state, delta) => {
    const calm = useGame.getState().reducedMotion
    if (hull.current) {
      hull.current.rotation.z = ship.bank
      hull.current.position.y = calm ? 0 : Math.sin(state.clock.elapsedTime * 1.5) * 0.05
    }
    exhaust.uniforms.uTime.value = calm ? 0 : state.clock.elapsedTime
    exhaust.uniforms.uPower.value = ship.throttle
    if (plumes.current) {
      // Short at idle, stretching with thrust; never longer than about a third of the hull.
      const len = 0.16 + ship.throttle * 0.75 + ship.warp * 0.35
      plumes.current.scale.z += (len - plumes.current.scale.z) * Math.min(1, delta * 10)
    }
    nozzle.color.setRGB(0.25, 0.85, 1).multiplyScalar(0.5 + ship.throttle * 2.2)
    if (light.current) light.current.intensity = 2 + ship.throttle * 9
  })

  return (
    <group>
      <group ref={hull}>
        {/* The GLB faces +Z; flight forward is -Z. */}
        <group rotation={[0, Math.PI, 0]}>
          <primitive object={model} />
        </group>
        {/* One plume per nozzle on the model, seated at the nozzle mouth */}
        <group ref={plumes}>
          {NOZZLES.map(([x, y, z, r]) => (
            <mesh key={x} position={[x, y, z]} scale={[r, r, 1]} geometry={plume} material={exhaust} />
          ))}
        </group>
        {NOZZLES.map(([x, y, z, r]) => (
          <mesh key={x} position={[x, y, z - 0.02]} material={nozzle}>
            <circleGeometry args={[r * 0.8, 20]} />
          </mesh>
        ))}
        <pointLight ref={light} color="#3fd8ff" distance={14} decay={2} position={[0, 0.2, 1.9]} />
      </group>
      <WarpStreaks />
    </group>
  )
}

useGLTF.preload(SHIP_URL, false)
