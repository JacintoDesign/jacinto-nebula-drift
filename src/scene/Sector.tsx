import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { WORLD } from '../data/world'
import { useGame } from '../store/useGame'
import { glow, hullMaterials, tiled } from './materials'
import { NOISE_GLSL } from './sky'

const R = WORLD.gateway.radius
const MODULES = 72
const LIGHTS = 96

const portalVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv * 2.0 - 1.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const portalFrag = /* glsl */ `
  uniform float uTime;
  uniform float uVoid;
  varying vec2 vUv;
  ${NOISE_GLSL}
  void main() {
    float r = length(vUv);
    if (r > 1.0) discard;
    float ang = atan(vUv.y, vUv.x + 1e-5);
    // Swirl: rotate the lookup faster toward the centre.
    float sw = ang + (1.0 - r) * 2.6 + uTime * 0.12;
    vec3 p = vec3(cos(sw) * r * 2.4, sin(sw) * r * 2.4, uTime * 0.08);
    float n = fbm(p + fbm(p * 2.0 + 3.0));
    float ridge = clamp(1.0 - abs(n - 0.5) * 5.0, 0.0, 1.0);
    ridge *= ridge;
    ridge *= ridge;
    ridge *= ridge;
    float rim = smoothstep(0.72, 1.0, r);
    vec3 cold = mix(vec3(0.25, 0.1, 0.9), vec3(0.05, 0.75, 1.0), n);
    vec3 warm = mix(vec3(1.0, 0.15, 0.5), vec3(0.3, 0.6, 1.0), n);
    vec3 tint = mix(cold, warm, uVoid);
    // Dark membrane with shimmering veins; brighter and warmer seen from the void.
    vec3 col = tint * ridge * (0.6 + uVoid * 1.5) + tint * rim * rim * 1.4 + tint * 0.012;
    float alpha = mix(0.93, 0.8, uVoid);
    gl_FragColor = vec4(col, clamp(alpha + rim * 0.3, 0.0, 1.0));
  }
`

/**
 * The gateway: a segmented jump ring with a dark, shimmering membrane. Flying
 * through it swaps between the nebula and the void (handled by the ship).
 */
export function Sector() {
  const mats = hullMaterials()
  const modules = useRef<THREE.InstancedMesh>(null)
  const lights = useRef<THREE.InstancedMesh>(null)
  const inner = useRef<THREE.Mesh>(null)
  const portal = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: portalVert,
        fragmentShader: portalFrag,
        uniforms: { uTime: { value: 0 }, uVoid: { value: 0 } },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  )
  const ringMat = useMemo(() => tiled(mats.dark, 40, 2), [mats])
  const lightMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
    [],
  )
  const emitterGlow = useMemo(
    () => new THREE.MeshBasicMaterial({ color: new THREE.Color('#05d9e8').multiplyScalar(2.4), toneMapped: false }),
    [],
  )
  const tmpColor = useMemo(() => new THREE.Color(), [])

  useLayoutEffect(() => {
    const m = new THREE.Object3D()
    let seed = 3
    const rnd = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    // Hull modules of uneven depth give the ring a machined, segmented rim.
    for (let i = 0; i < MODULES; i++) {
      const a = (i / MODULES) * Math.PI * 2
      const out = 0.6 + rnd() * 1.6
      m.position.set(Math.cos(a) * (R + 2.2 + out / 2), Math.sin(a) * (R + 2.2 + out / 2), 0)
      m.rotation.set(0, 0, a)
      m.scale.set(1.6 + out, 3.3, 2.6 + rnd() * 3.4)
      m.updateMatrix()
      modules.current!.setMatrixAt(i, m.matrix)
    }
    modules.current!.instanceMatrix.needsUpdate = true
    for (let i = 0; i < LIGHTS; i++) {
      const a = (i / LIGHTS) * Math.PI * 2
      const side = i % 2 === 0 ? 1 : -1
      m.position.set(Math.cos(a) * (R - 1.6), Math.sin(a) * (R - 1.6), side * 2.3)
      m.rotation.set(0, 0, a)
      m.scale.set(0.35, 1.5, 0.35)
      m.updateMatrix()
      lights.current!.setMatrixAt(i, m.matrix)
      lights.current!.setColorAt(i, tmpColor.setRGB(1, 1, 1))
    }
    lights.current!.instanceMatrix.needsUpdate = true
  }, [tmpColor])

  useFrame((state) => {
    const g = useGame.getState()
    const t = g.reducedMotion ? 0 : state.clock.elapsedTime
    const inVoid = g.zone === 'void'
    portal.uniforms.uTime.value = t
    portal.uniforms.uVoid.value = inVoid ? 1 : 0
    // Chase lights run around the rim toward the top.
    const mesh = lights.current
    if (mesh) {
      for (let i = 0; i < LIGHTS; i++) {
        const phase = (i / LIGHTS) * 6 - t * 0.5
        const k = Math.pow(Math.max(0, Math.sin(phase * Math.PI * 2)), 6)
        if (inVoid) tmpColor.setRGB(0.5 + k * 5, 0.1 + k * 0.8, 0.3 + k * 2.4)
        else tmpColor.setRGB(0.1 + k * 0.9, 0.5 + k * 3.6, 0.7 + k * 5)
        mesh.setColorAt(i, tmpColor)
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
    if (inner.current) inner.current.material = glow(inVoid ? '#ff2a6d' : '#05d9e8', 2.2)
    emitterGlow.color.set(inVoid ? '#ff2a6d' : '#05d9e8').multiplyScalar(2.4)
  })

  return (
    <group position={WORLD.gateway.position}>
      <mesh material={ringMat}>
        <torusGeometry args={[R + 1.4, 2.6, 10, 120]} />
      </mesh>
      <mesh material={mats.frame} position={[0, 0, 0]}>
        <torusGeometry args={[R + 5.4, 0.5, 6, 120]} />
      </mesh>
      <instancedMesh ref={modules} args={[undefined, undefined, MODULES]} material={mats.mid}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      {/* Eight field emitters clamp the ring */}
      {Array.from({ length: 8 }, (_, i) => (
        <group key={i} rotation={[0, 0, (i / 8) * Math.PI * 2 + Math.PI / 8]}>
          <mesh position={[R + 2.6, 0, 0]} material={mats.frame}>
            <boxGeometry args={[7.5, 6.5, 8.5]} />
          </mesh>
          <mesh position={[R + 6.8, 0, 0]} material={mats.mid}>
            <boxGeometry args={[1.6, 4, 5.5]} />
          </mesh>
          {[1, -1].map((s) => (
            <mesh key={s} position={[R + 2.6, 0, s * 4.3]} material={emitterGlow}>
              <boxGeometry args={[5, 0.5, 0.2]} />
            </mesh>
          ))}
        </group>
      ))}
      <instancedMesh ref={lights} args={[undefined, undefined, LIGHTS]} material={lightMat}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <mesh ref={inner} material={glow('#05d9e8', 2.2)}>
        <torusGeometry args={[R - 1.25, 0.22, 6, 160]} />
      </mesh>
      <mesh material={portal}>
        <circleGeometry args={[R - 1.2, 96]} />
      </mesh>
      <pointLight color="#3fb8ff" intensity={900} distance={160} decay={2} position={[0, 0, 12]} />
    </group>
  )
}
