import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ship } from '../store/useShip'
import { useGame } from '../store/useGame'

const COUNT = 420
const LENGTH = 160

const vert = /* glsl */ `
  attribute vec3 aSeed;
  attribute float aEnd;
  uniform float uTime;
  uniform float uWarp;
  varying float vAlpha;
  varying float vHue;
  void main() {
    // Each streak is a 2-vertex line that scrolls toward +Z (past the ship).
    float speed = 60.0 + aSeed.z * 120.0;
    float z = mod(aSeed.z * ${LENGTH.toFixed(1)} + uTime * speed, ${LENGTH.toFixed(1)}) - ${(LENGTH * 0.72).toFixed(1)};
    float ang = aSeed.x * 6.2831853;
    float rad = 5.0 + aSeed.y * aSeed.y * 46.0;
    float len = (2.0 + aSeed.y * 14.0) * uWarp;
    vec3 p = vec3(cos(ang) * rad, sin(ang) * rad, z - aEnd * len);
    vAlpha = (1.0 - aEnd) * uWarp * smoothstep(${(LENGTH * 0.28).toFixed(1)}, 0.0, abs(z + 20.0) - 40.0);
    vHue = aSeed.x;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`
const frag = /* glsl */ `
  varying float vAlpha;
  varying float vHue;
  void main() {
    vec3 col = mix(vec3(0.35, 0.8, 1.0), vec3(0.85, 0.5, 1.0), step(0.6, vHue));
    col = mix(col, vec3(1.0), 0.35);
    gl_FragColor = vec4(col * vAlpha * 2.2, vAlpha);
  }
`

/** Light-streak tunnel around the ship, driven by `ship.warp`. */
export function WarpStreaks() {
  const ref = useRef<THREE.LineSegments>(null)
  const { geometry, material } = useMemo(() => {
    const seed = new Float32Array(COUNT * 2 * 3)
    const end = new Float32Array(COUNT * 2)
    for (let i = 0; i < COUNT; i++) {
      const a = Math.random()
      const b = Math.random()
      const c = Math.random()
      for (let k = 0; k < 2; k++) {
        seed.set([a, b, c], (i * 2 + k) * 3)
        end[i * 2 + k] = k
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 6), 3))
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3))
    geometry.setAttribute('aEnd', new THREE.BufferAttribute(end, 1))
    const material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { uTime: { value: 0 }, uWarp: { value: 0 } },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    return { geometry, material }
  }, [])

  useFrame((state) => {
    if (!ref.current) return
    const calm = useGame.getState().reducedMotion
    ref.current.visible = ship.warp > 0.02
    material.uniforms.uWarp.value = ship.warp * (calm ? 0.35 : 1)
    material.uniforms.uTime.value = state.clock.elapsedTime * (calm ? 0.15 : 1)
  })

  return <lineSegments ref={ref} geometry={geometry} material={material} frustumCulled={false} />
}
