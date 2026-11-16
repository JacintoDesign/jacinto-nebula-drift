import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from '../store/useGame'
import { NOISE_GLSL, SUN_DIR } from './sky'

const vert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const frag = /* glsl */ `
  uniform vec3 uSun;
  varying vec3 vDir;
  ${NOISE_GLSL}
  void main() {
    vec3 d = normalize(vDir);
    vec3 q = d * 2.1;
    // Domain warp: three fbm taps bend the lookup so clouds curl into filaments.
    vec3 w = vec3(fbm(q + 1.3), fbm(q + vec3(5.2, 1.3, 2.8)), fbm(q + vec3(9.1, 4.7, 6.3)));
    float n1 = fbm(q * 1.15 + w * 2.3);
    float n2 = fbm(q * 2.6 - w * 1.7 + 7.0);
    float hue = fbm(q * 0.65 + 11.0);

    // Concentrate cloud in a tilted band, densest down the flight lane (-Z).
    float lat = d.y * 1.5 + d.x * 0.35 + (n1 - 0.5) * 0.9;
    float band = exp(-lat * lat * 2.2);
    float core = max(dot(d, normalize(vec3(-0.25, 0.05, -1.0))), 0.0);
    core = core * core * core;

    float dens = smoothstep(0.34, 0.82, n1) * (0.22 + band * 0.9 + core * 0.9);
    float ridge = clamp(1.0 - abs(n2 - 0.5) * 2.4, 0.0, 1.0);
    float fil = ridge * ridge * ridge * ridge;

    vec3 violet = vec3(0.36, 0.14, 0.95);
    vec3 magenta = vec3(1.0, 0.14, 0.44);
    vec3 teal = vec3(0.02, 0.72, 0.86);
    vec3 amber = vec3(1.0, 0.48, 0.2);
    vec3 cloud = mix(violet, magenta, smoothstep(0.38, 0.66, hue));
    cloud = mix(cloud, teal, smoothstep(0.46, 0.74, w.x) * 0.85);

    vec3 col = vec3(0.006, 0.008, 0.024);
    col += cloud * dens * 0.2;
    col += mix(cloud, vec3(1.0), 0.25) * fil * dens * 0.34;
    // Dark dust lanes cut through the bright band.
    float dust = smoothstep(0.48, 0.74, fbm(q * 1.8 + 20.0));
    col *= 1.0 - dust * 0.72 * band;
    // Warm scatter around the star.
    float s = max(dot(d, uSun), 0.0);
    float s8 = s * s; s8 *= s8; s8 *= s8;
    col += amber * s8 * s8 * 0.3 * (0.4 + dens);
    col += vec3(0.02, 0.03, 0.07) * (1.0 - band) * 0.5;
    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }
`

/**
 * The nebula is rendered once into a cube map, then used as both the scene
 * background and (prefiltered) the environment light, so hulls pick up its
 * colours. The void swaps the background for true black.
 */
export function Nebula() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const zone = useGame((s) => s.zone)
  const touch = useGame((s) => s.touch)

  const { sky, env } = useMemo(() => {
    const rt = new THREE.WebGLCubeRenderTarget(touch ? 512 : 1024, {
      type: THREE.HalfFloatType,
      generateMipmaps: false,
    })
    const bake = new THREE.Scene()
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { uSun: { value: SUN_DIR } },
      side: THREE.BackSide,
      depthWrite: false,
    })
    const geo = new THREE.SphereGeometry(5, 48, 32)
    bake.add(new THREE.Mesh(geo, mat))
    new THREE.CubeCamera(0.1, 20, rt).update(gl, bake)
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromCubemap(rt.texture).texture
    pmrem.dispose()
    geo.dispose()
    mat.dispose()
    return { sky: rt, env }
  }, [gl, touch])

  useEffect(() => {
    scene.environment = env
    scene.environmentIntensity = 2.2
    return () => {
      scene.environment = null
      scene.background = null
      sky.dispose()
      env.dispose()
    }
  }, [scene, sky, env])

  useEffect(() => {
    scene.background = zone === 'void' ? new THREE.Color('#000003') : sky.texture
  }, [scene, sky, zone])

  return null
}
