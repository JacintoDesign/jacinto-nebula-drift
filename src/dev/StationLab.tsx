import { useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { LANDMARKS } from '../data/world'
import { Effects } from '../scene/Effects'
import { Nebula } from '../scene/Nebula'
import { SUN_DIR } from '../scene/sky'
import { StationStructure } from '../stations/StationStructure'

const VIEWS: Record<string, [number, number, number]> = {
  Front: [0, 2, 26],
  'Three-quarter': [17, 8, 20],
  Side: [26, 2, 0],
  Top: [0, 28, 0.1],
  Back: [-10, 4, -26],
  Below: [8, -22, 12],
}

/** Snap the camera to a preset without remounting the canvas. */
function Rig({ position }: { position: [number, number, number] }) {
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    camera.position.set(...position)
    camera.lookAt(0, 0, 0)
  }, [camera, position])
  return null
}

/** Dev-only: inspect each station model alone, frozen or animated. `/?station-lab` */
export default function StationLab() {
  const [id, setId] = useState(LANDMARKS[0].id)
  const [frozen, setFrozen] = useState(false)
  const [view, setView] = useState('Three-quarter')
  const [plane, setPlane] = useState(false)
  const l = LANDMARKS.find((x) => x.id === id)!
  return (
    <>
      <Canvas className="scene" flat dpr={[1, 2]} gl={{ antialias: false }} camera={{ fov: 45, position: VIEWS[view], far: 3000 }}>
        <Rig position={VIEWS[view]} />
        <Nebula />
        <directionalLight position={SUN_DIR.clone().multiplyScalar(100)} color="#ffe4c8" intensity={3.4} />
        <directionalLight position={[-60, -20, 70]} color="#4a7dff" intensity={0.55} />
        <ambientLight intensity={0.12} />
        <group scale={l.radius}>
          <StationStructure id={l.id} color={l.color} frozen={frozen} />
        </group>
        {plane && (
          <mesh position={[0, 0, 0.55 * l.radius]}>
            <planeGeometry args={[20, 20]} />
            <meshBasicMaterial color="#ff2a6d" transparent opacity={0.18} depthWrite={false} side={2} />
          </mesh>
        )}
        <OrbitControls makeDefault />
        <Effects />
      </Canvas>
      <div className="lab">
        <div>
          {LANDMARKS.map((x) => (
            <button key={x.id} data-on={x.id === id} onClick={() => setId(x.id)}>
              {x.sign}
            </button>
          ))}
        </div>
        <div>
          {Object.keys(VIEWS).map((v) => (
            <button key={v} data-on={v === view} onClick={() => setView(v)}>
              {v}
            </button>
          ))}
          <button data-on={frozen} onClick={() => setFrozen((f) => !f)}>
            {frozen ? 'Frozen' : 'Animated'}
          </button>
          <button data-on={plane} onClick={() => setPlane((p) => !p)}>
            Dock plane
          </button>
        </div>
      </div>
    </>
  )
}
