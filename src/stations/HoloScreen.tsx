import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { asset } from '../data/asset'
import type { Project } from '../data/projects'
import { PROJECTS } from '../data/projects'
import { useGame } from '../store/useGame'
import { canvasTexture, drawCaption, loadSignFonts } from '../scene/signTexture'
import { glow } from '../scene/materials'

const W = 12.4
const H = (W * 9) / 16

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const frag = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uFocus;
  uniform float uAspect;
  varying vec2 vUv;
  void main() {
    // Cover-fit the media into the 16:9 screen.
    vec2 uv = vUv;
    float fit = uAspect / (16.0 / 9.0);
    if (fit > 1.0) uv.x = (uv.x - 0.5) / fit + 0.5;
    else uv.y = (uv.y - 0.5) * fit + 0.5;
    // Slight chromatic split sells the projection.
    float split = 0.0025 * (1.0 - uFocus);
    vec3 img = vec3(
      texture2D(uMap, uv + vec2(split, 0.0)).r,
      texture2D(uMap, uv).g,
      texture2D(uMap, uv - vec2(split, 0.0)).b);
    float scan = 0.9 + 0.1 * sin(vUv.y * 420.0 - uTime * 3.0);
    float sweep = smoothstep(0.03, 0.0, abs(fract(vUv.y - uTime * 0.07) - 0.5)) * 0.2;
    vec2 e = min(vUv, 1.0 - vUv);
    float edge = smoothstep(0.0, 0.035, min(e.x, e.y));
    float flicker = 0.97 + 0.03 * sin(uTime * 23.0);
    vec3 col = img * mix(0.8, 1.12, uFocus) * scan;
    col = mix(col + uColor * 0.07, col, uFocus);
    col += uColor * (sweep + (1.0 - edge) * 0.9);
    float alpha = mix(0.84, 0.97, uFocus) * flicker * (0.35 + 0.65 * edge);
    gl_FragColor = vec4(col, alpha);
  }
`

/**
 * Hologram of the project above its station: the demo clip when there is one,
 * otherwise the screenshot, with a caption strip and a projector beam.
 */
export function HoloScreen({ project, height }: { project: Project; height: number }) {
  const group = useRef<THREE.Group>(null)
  const image = useTexture(asset(project.image ?? '/og.jpg'))
  const [video, setVideo] = useState<THREE.VideoTexture | null>(null)
  const index = PROJECTS.findIndex((p) => p.id === project.id) + 1

  useEffect(() => {
    image.colorSpace = THREE.SRGBColorSpace
    image.anisotropy = 8
    image.needsUpdate = true
  }, [image])

  // Optional looping clip; any failure leaves the screenshot in place.
  useEffect(() => {
    if (!project.video) return
    const el = document.createElement('video')
    el.src = asset(project.video)
    el.muted = true
    el.loop = true
    el.playsInline = true
    el.preload = 'metadata'
    let tex: THREE.VideoTexture | null = null
    const ready = () => {
      tex = new THREE.VideoTexture(el)
      tex.colorSpace = THREE.SRGBColorSpace
      setVideo(tex)
    }
    el.addEventListener('loadeddata', ready, { once: true })
    const unsub = useGame.subscribe((s) => {
      const active = s.near === project.id || s.hold === project.id
      if (active) void el.play().catch(() => {})
      else el.pause()
    })
    return () => {
      unsub()
      el.removeEventListener('loadeddata', ready)
      el.pause()
      el.removeAttribute('src')
      el.load()
      tex?.dispose()
      setVideo(null)
    }
  }, [project.id, project.video])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: {
          uMap: { value: null },
          uColor: { value: new THREE.Color(project.color) },
          uTime: { value: 0 },
          uFocus: { value: 0 },
          uAspect: { value: 16 / 9 },
        },
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [project.color],
  )

  const caption = useMemo(() => canvasTexture(1024, 96), [])
  useEffect(() => {
    let live = true
    const draw = () => {
      if (!live) return
      drawCaption(caption.canvas, {
        index: String(index).padStart(2, '0'),
        title: project.title,
        meta: project.meta,
        color: project.color,
      })
      caption.texture.needsUpdate = true
    }
    draw()
    loadSignFonts('').then(draw)
    return () => {
      live = false
    }
  }, [caption, project, index])

  const beam = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(project.color).multiplyScalar(0.55),
        transparent: true,
        opacity: 0.07,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [project.color],
  )

  const world = useMemo(() => new THREE.Vector3(), [])
  useFrame((state, dt) => {
    const g = useGame.getState()
    const grp = group.current
    if (!grp) return
    const map = video ?? image
    material.uniforms.uMap.value = map
    const src = map.image as { videoWidth?: number; videoHeight?: number; width?: number; height?: number }
    const w = src?.videoWidth || src?.width || 16
    const h = src?.videoHeight || src?.height || 9
    material.uniforms.uAspect.value = w / Math.max(1, h)
    material.uniforms.uTime.value = g.reducedMotion ? 0 : state.clock.elapsedTime
    const focus = g.hold === project.id || g.hovered === project.id ? 1 : g.near === project.id ? 0.6 : 0
    const u = material.uniforms.uFocus
    u.value += (focus - u.value) * Math.min(1, dt * 4)
    // Arrivals get a bigger projection.
    const scale = 1 + u.value * 0.16
    grp.scale.setScalar(scale)
    grp.getWorldPosition(world)
    grp.rotation.y = Math.atan2(state.camera.position.x - world.x, state.camera.position.z - world.z)
    if (!g.reducedMotion) grp.position.y = height + Math.sin(state.clock.elapsedTime * 0.7 + index) * 0.18
  })

  const frame = glow(project.color, 2.6)
  const L = 0.9
  return (
    <group>
      <group ref={group} position={[0, height, 0]}>
        <mesh material={material}>
          <planeGeometry args={[W, H]} />
        </mesh>
        {/* Corner brackets */}
        {[
          [-1, 1],
          [1, 1],
          [-1, -1],
          [1, -1],
        ].map(([sx, sy]) => (
          <group key={`${sx}${sy}`} position={[(sx * (W + 0.5)) / 2, (sy * (H + 0.5)) / 2, 0]}>
            <mesh position={[(-sx * L) / 2, 0, 0]} material={frame}>
              <boxGeometry args={[L, 0.07, 0.04]} />
            </mesh>
            <mesh position={[0, (-sy * L) / 2, 0]} material={frame}>
              <boxGeometry args={[0.07, L, 0.04]} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, -H / 2 - 0.95, 0]}>
          <planeGeometry args={[W, (W * 96) / 1024]} />
          <meshBasicMaterial
            map={caption.texture}
            transparent
            toneMapped={false}
            color={new THREE.Color(1.5, 1.5, 1.5)}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
      {/* Projector beam from the station up to the screen */}
      <mesh position={[0, height / 2 + 0.2, 0]} material={beam}>
        <cylinderGeometry args={[W * 0.42, 0.5, height - H / 2 - 2.4, 28, 1, true]} />
      </mesh>
    </group>
  )
}
