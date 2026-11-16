import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PLANETS, type PlanetDef } from '../data/world'
import { useGame } from '../store/useGame'
import { NOISE_GLSL, SUN_DIR } from './sky'

const planetVert = /* glsl */ `
  varying vec3 vObj;
  varying vec3 vNormalW;
  varying vec3 vWorld;
  void main() {
    vObj = normalize(position);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`
const planetFrag = /* glsl */ `
  uniform vec3 uSun;
  uniform float uSpin;
  uniform vec3 uA;
  uniform vec3 uB;
  uniform vec3 uC;
  uniform vec3 uAtmo;
  uniform vec3 uLava;
  uniform float uBands;
  uniform float uClouds;
  uniform float uLavaOn;
  uniform float uSeed;
  varying vec3 vObj;
  varying vec3 vNormalW;
  varying vec3 vWorld;
  ${NOISE_GLSL}
  void main() {
    vec3 n = normalize(vNormalW);
    vec3 view = normalize(cameraPosition - vWorld);
    float c = cos(uSpin), s = sin(uSpin);
    vec3 p = vec3(vObj.x * c - vObj.z * s, vObj.y, vObj.x * s + vObj.z * c) + uSeed;

    // Gas: latitude stripes bent by slow turbulence.
    float warp = fbm(p * vec3(2.0, 5.0, 2.0)) - 0.5;
    float lat = vObj.y + warp * 0.16;
    float gas = 0.5 + 0.5 * sin(lat * 19.0 + uSeed);
    float fine = fbm(vec3(p.x * 2.5, lat * 26.0, p.z * 2.5));
    // Rock: continents from warped fbm.
    float land = fbm(p * 2.2 + fbm(p * 4.0) * 0.6);
    float detail = fbm(p * 9.0);

    float h = mix(smoothstep(0.38, 0.7, land), gas, uBands);
    vec3 albedo = mix(uA, uB, h);
    albedo = mix(albedo, uC, clamp(mix(smoothstep(0.5, 0.68, land) * (0.5 + detail), fine * fine * 0.8, uBands), 0.0, 1.0));

    float ndl = dot(n, uSun);
    float lit = smoothstep(-0.12, 0.4, ndl);
    // Cloud deck drifting a little faster than the surface.
    float cloud = smoothstep(0.5, 0.72, fbm(p * 3.2 + vec3(uSpin * 0.6, 0.0, 0.0) + 20.0)) * uClouds;
    albedo = mix(albedo, vec3(0.95, 0.97, 1.0), cloud);

    vec3 col = albedo * (lit * 1.05 + 0.012);
    // Molten cracks: brightest on the night side, where they are the only light.
    float ridge = clamp(1.0 - abs(land - 0.5) * 26.0, 0.0, 1.0);
    ridge *= ridge;
    col += uLava * ridge * (0.3 + detail) * uLavaOn * (1.3 - lit * 0.6);
    // Atmosphere: a rim that glows on the lit limb and stays faint on the dark one.
    float fres = 1.0 - max(dot(n, view), 0.0);
    fres = fres * fres * fres;
    col += uAtmo * fres * (0.1 + lit * 0.9);
    gl_FragColor = vec4(col, 1.0);
  }
`

const ringVert = /* glsl */ `
  varying vec3 vWorld;
  varying vec2 vLocal;
  void main() {
    vLocal = position.xy;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`
const ringFrag = /* glsl */ `
  uniform vec3 uSun;
  uniform vec3 uCenter;
  uniform float uRadius;
  uniform vec2 uSpan;
  uniform vec3 uA;
  uniform vec3 uB;
  varying vec3 vWorld;
  varying vec2 vLocal;
  float h(float x) { return fract(sin(x * 91.17) * 43758.5453); }
  void main() {
    float r = length(vLocal) / uRadius;
    float t = clamp((r - uSpan.x) / max(uSpan.y - uSpan.x, 1e-3), 0.0, 1.0);
    // Stacked stripe frequencies give ringlets and gaps.
    float x = t * 46.0;
    float stripes = mix(h(floor(x)), h(floor(x) + 1.0), smoothstep(0.0, 1.0, fract(x)));
    float coarse = mix(h(floor(t * 9.0) + 40.0), h(floor(t * 9.0) + 41.0), smoothstep(0.0, 1.0, fract(t * 9.0)));
    float a = (0.25 + stripes * 0.75) * (0.3 + coarse * 0.7);
    a *= smoothstep(0.0, 0.05, t) * smoothstep(1.0, 0.9, t);
    a *= 1.0 - smoothstep(0.52, 0.56, t) * smoothstep(0.62, 0.58, t) * 0.9;
    // Planet shadow: test the ray from this fragment toward the sun against the sphere.
    vec3 oc = vWorld - uCenter;
    float b = dot(oc, uSun);
    float disc = b * b - (dot(oc, oc) - uRadius * uRadius);
    float shadow = (b < 0.0 && disc > 0.0) ? 0.06 : 1.0;
    vec3 col = mix(uA, uB, coarse) * shadow * 0.75;
    gl_FragColor = vec4(col * a, a * 0.85);
  }
`

function Planet({ def, index }: { def: PlanetDef; index: number }) {
  const surface = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: planetVert,
        fragmentShader: planetFrag,
        uniforms: {
          uSun: { value: SUN_DIR },
          uSpin: { value: index * 1.7 },
          uA: { value: new THREE.Color(def.colors[0]) },
          uB: { value: new THREE.Color(def.colors[1]) },
          uC: { value: new THREE.Color(def.colors[2]) },
          uAtmo: { value: new THREE.Color(def.atmosphere) },
          uLava: { value: new THREE.Color(def.lava ?? '#000000').multiplyScalar(2.2) },
          uBands: { value: def.bands },
          uClouds: { value: def.clouds ?? 0 },
          uLavaOn: { value: def.lava ? 1 : 0 },
          uSeed: { value: index * 13.7 },
        },
      }),
    [def, index],
  )
  const ring = useMemo(
    () =>
      def.ring &&
      new THREE.ShaderMaterial({
        vertexShader: ringVert,
        fragmentShader: ringFrag,
        uniforms: {
          uSun: { value: SUN_DIR },
          uCenter: { value: new THREE.Vector3(...def.position) },
          uRadius: { value: def.radius },
          uSpan: { value: new THREE.Vector2(...def.ring) },
          uA: { value: new THREE.Color(def.ringColors?.[0] ?? '#ffffff') },
          uB: { value: new THREE.Color(def.ringColors?.[1] ?? '#aaaaaa') },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        premultipliedAlpha: true,
      }),
    [def],
  )

  useFrame((_, dt) => {
    if (!useGame.getState().reducedMotion) surface.uniforms.uSpin.value += dt * 0.006
  })

  const detail = def.radius > 60 ? 96 : 48
  return (
    <group position={def.position} rotation={def.tilt}>
      <mesh
        material={surface}
        onClick={(e) => {
          const g = useGame.getState()
          // A drag is a camera orbit; only a clean click sets a course.
          if (e.delta > 6 || g.zone !== 'nebula' || g.cinematic || g.phase !== 'flying') return
          e.stopPropagation()
          g.travelTo(def.id)
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <sphereGeometry args={[def.radius, detail, Math.round(detail * 0.66)]} />
      </mesh>
      {ring && def.ring && (
        <mesh material={ring} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[def.radius * def.ring[0], def.radius * def.ring[1], 160, 1]} />
        </mesh>
      )}
    </group>
  )
}

/** The galaxy's planets and moons. Hidden while the ship is in the void. */
export function Planets() {
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    if (group.current) group.current.visible = useGame.getState().zone === 'nebula'
  })
  return (
    <group ref={group}>
      {PLANETS.map((p, i) => (
        <Planet key={p.id} def={p} index={i} />
      ))}
    </group>
  )
}
