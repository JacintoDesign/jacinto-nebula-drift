import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from '../store/useGame'
import { SUN_DIR } from './sky'

const vert = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uScale;
  varying vec3 vColor;
  void main() {
    float tw = 0.78 + 0.22 * sin(uTime * (0.6 + aPhase * 1.7) + aPhase * 40.0);
    vColor = aColor * tw;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale;
  }
`
const frag = /* glsl */ `
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r2 = dot(c, c) * 4.0;
    float a = clamp(1.0 - r2, 0.0, 1.0);
    a *= a;
    gl_FragColor = vec4(vColor * a, a);
  }
`

/** Beyond the farthest planet, inside the camera's far plane. */
const STAR_DIST = 5200

function makeStars(count: number, minSize: number, maxSize: number, bright: number) {
  const pos = new Float32Array(count * 3)
  const size = new Float32Array(count)
  const phase = new Float32Array(count)
  const color = new Float32Array(count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < count; i++) {
    const u = Math.random() * 2 - 1
    const t = Math.random() * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    pos.set([s * Math.cos(t) * STAR_DIST, u * STAR_DIST, s * Math.sin(t) * STAR_DIST], i * 3)
    // Mostly faint, a few bright: bias the size distribution hard.
    const k = Math.pow(Math.random(), 7)
    size[i] = minSize + k * (maxSize - minSize)
    phase[i] = Math.random()
    const temp = Math.random()
    c.setHSL(temp < 0.5 ? 0.6 : temp < 0.85 ? 0.1 : 0.92, 0.25 + Math.random() * 0.4, 0.75)
    const gain = bright * (0.5 + k * 3.5)
    color.set([c.r * gain, c.g * gain, c.b * gain], i * 3)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
  geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3))
  return geo
}

function sunTexture() {
  const s = 256
  const cv = document.createElement('canvas')
  cv.width = cv.height = s
  const ctx = cv.getContext('2d')!
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.06, 'rgba(255,240,220,0.95)')
  g.addColorStop(0.16, 'rgba(255,190,130,0.32)')
  g.addColorStop(0.45, 'rgba(255,120,90,0.07)')
  g.addColorStop(1, 'rgba(255,100,80,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  // Thin diffraction spikes.
  ctx.globalCompositeOperation = 'lighter'
  for (const [w, h] of [
    [s, 2],
    [2, s],
  ]) {
    const sg = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    sg.addColorStop(0, 'rgba(255,230,200,0.7)')
    sg.addColorStop(1, 'rgba(255,230,200,0)')
    ctx.fillStyle = sg
    ctx.fillRect((s - w) / 2, (s - h) / 2, w, h)
  }
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Twinkling stars and the sector's sun, locked to the camera so they sit at infinity. */
export function Starfield() {
  const group = useRef<THREE.Group>(null)
  const sun = useRef<THREE.Sprite>(null)
  const voidStars = useRef<THREE.Points>(null)
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: { uTime: { value: 0 }, uScale: { value: 1 } },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  )
  const near = useMemo(() => makeStars(4200, 1.4, 7, 1), [])
  const far = useMemo(() => makeStars(11000, 1.1, 3.2, 0.8), [])
  const sunMap = useMemo(sunTexture, [])

  useFrame((state) => {
    const g = useGame.getState()
    group.current?.position.copy(state.camera.position)
    material.uniforms.uTime.value = g.reducedMotion ? 0 : state.clock.elapsedTime
    material.uniforms.uScale.value = state.gl.getPixelRatio() * (state.size.height / 900)
    if (voidStars.current) voidStars.current.visible = g.zone === 'void'
    if (sun.current) sun.current.visible = g.zone === 'nebula'
  })

  return (
    <group ref={group}>
      <points geometry={near} material={material} frustumCulled={false} />
      <points ref={voidStars} geometry={far} material={material} frustumCulled={false} rotation={[1, 2, 0]} />
      <sprite ref={sun} position={SUN_DIR.clone().multiplyScalar(STAR_DIST)} scale={2600}>
        <spriteMaterial
          map={sunMap}
          color={new THREE.Color(3.2, 2.6, 2.1)}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          transparent
          toneMapped={false}
        />
      </sprite>
    </group>
  )
}
