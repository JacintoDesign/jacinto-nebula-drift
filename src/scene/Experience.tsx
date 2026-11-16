import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { ChaseCamera } from '../ship/ChaseCamera'
import { Ship } from '../ship/Ship'
import { Stations } from '../stations/Station'
import { Markers } from '../ui/Waypoints'
import { useGame } from '../store/useGame'
import { Effects } from './Effects'
import { Nebula } from './Nebula'
import { SUN_DIR } from './sky'
import { Planets } from './Planet'
import { Sector } from './Sector'
import { SpaceDust } from './SpaceDust'
import { Starfield } from './Starfield'
import { VoidCombat } from './VoidCombat'

const SUN_POS = SUN_DIR.clone().multiplyScalar(200)

/** The whole 3D scene. WebGL only; tone mapping happens in the effect chain. */
export function Experience({ endlessCombat = false }: { endlessCombat?: boolean }) {
  const touch = useGame((s) => s.touch)
  return (
    <Canvas
      className="scene"
      flat
      dpr={touch ? [1, 1.5] : [1, 1.75]}
      gl={{ antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false }}
      camera={{ fov: 55, near: 0.3, far: 7000, position: [46, 34, 104] }}
      onCreated={({ gl }) => {
        gl.setClearColor(new THREE.Color('#010104'))
      }}
    >
      <Nebula />
      <Starfield />
      <SpaceDust />
      <directionalLight position={SUN_POS} color="#ffe4c8" intensity={3.4} />
      <directionalLight position={[-60, -20, 70]} color="#4a7dff" intensity={0.55} />
      <ambientLight color="#8a7cff" intensity={0.12} />
      <Suspense fallback={null}>
        <Planets />
        <Sector />
        <Stations />
        <Ship />
        <VoidCombat endless={endlessCombat} />
      </Suspense>
      <ChaseCamera />
      <Markers />
      <Effects />
    </Canvas>
  )
}
