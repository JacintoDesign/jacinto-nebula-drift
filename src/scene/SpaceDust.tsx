import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const COUNT = 700
const BOX = 140

const vert = /* glsl */ `
  attribute vec3 aSeed;
  uniform vec3 uCam;
  uniform float uScale;
  varying float vAlpha;
  varying float vTint;
  void main() {
    // Wrap a fixed lattice of motes around the camera so the field is endless.
    vec3 p = mod(aSeed * ${BOX.toFixed(1)} - uCam, ${BOX.toFixed(1)}) - ${(BOX / 2).toFixed(1)} + uCam;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = max(-mv.z, 0.001);
    vAlpha = smoothstep(${(BOX / 2).toFixed(1)}, 20.0, dist) * smoothstep(1.5, 8.0, dist);
    vTint = aSeed.x;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(uScale * (40.0 + aSeed.y * 60.0) / dist, 1.0, 6.0);
  }
`
const frag = /* glsl */ `
  varying float vAlpha;
  varying float vTint;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float a = clamp(1.0 - dot(c, c) * 4.0, 0.0, 1.0) * vAlpha * 0.5;
    vec3 col = mix(vec3(0.5, 0.85, 1.0), vec3(1.0, 0.55, 0.85), step(0.7, vTint));
    gl_FragColor = vec4(col * a, a);
  }
`

/** Drifting motes near the camera: the main cue for speed and parallax. */
export function SpaceDust() {
  const { geometry, material } = useMemo(() => {
    const seed = new Float32Array(COUNT * 3)
    for (let i = 0; i < seed.length; i++) seed[i] = Math.random()
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3))
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3))
    const material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { uCam: { value: new THREE.Vector3() }, uScale: { value: 1 } },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    return { geometry, material }
  }, [])

  useFrame((state) => {
    material.uniforms.uCam.value.copy(state.camera.position)
    material.uniforms.uScale.value = state.gl.getPixelRatio()
  })

  return <points geometry={geometry} material={material} frustumCulled={false} />
}
