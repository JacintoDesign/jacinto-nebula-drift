import { useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { projectById } from '../data/projects'
import { LANDMARKS, stationFront, stationYaw, type Landmark } from '../data/world'
import { useGame } from '../store/useGame'
import { glow } from '../scene/materials'
import { HoloScreen } from './HoloScreen'
import { StationSign } from './StationSign'
import { StationStructure } from './StationStructure'

/** Hologram centre above the station core, world units. */
const HOLO_HEIGHT = 15.5

function Station({ landmark }: { landmark: Landmark }) {
  const project = projectById(landmark.refId ?? landmark.id)
  const ring = useRef<THREE.Mesh>(null)
  const [fx, fz] = stationFront(landmark)
  // The sign hangs off the station's left shoulder (as seen from the dock approach).
  const side = 10.5
  const signPos: [number, number, number] = [-fz * side + fx * 2, 1.5, fx * side + fz * 2]

  const click = (e: ThreeEvent<MouseEvent>) => {
    const g = useGame.getState()
    if (g.zone !== 'nebula' || g.cinematic || g.phase !== 'flying') return
    // A drag is a camera orbit, not a travel order.
    if (e.delta > 6) return
    e.stopPropagation()
    if (g.hold === landmark.id) g.dock(landmark.id)
    else g.travelTo(landmark.id)
  }
  const over = (e: ThreeEvent<PointerEvent>) => {
    const g = useGame.getState()
    if (g.zone !== 'nebula' || g.cinematic) return
    e.stopPropagation()
    g.setHovered(landmark.id)
    document.body.style.cursor = 'pointer'
  }
  const out = () => {
    if (useGame.getState().hovered === landmark.id) useGame.getState().setHovered(null)
    document.body.style.cursor = ''
  }

  useFrame((state, dt) => {
    const g = useGame.getState()
    if (!ring.current) return
    const on = g.hovered === landmark.id || g.autopilot === landmark.id
    const m = ring.current
    const target = on ? 1 : 0
    m.scale.x += (target - m.scale.x) * Math.min(1, dt * 8)
    m.scale.y = m.scale.z = m.scale.x
    m.visible = m.scale.x > 0.02
    m.lookAt(state.camera.position)
    if (!g.reducedMotion) m.rotateZ(state.clock.elapsedTime * 0.3)
  })

  return (
    <group position={landmark.position}>
      <group rotation={[0, stationYaw(landmark), 0]} scale={landmark.radius}>
        <StationStructure id={landmark.id} color={landmark.color} />
      </group>
      <pointLight color={landmark.color} intensity={260} distance={46} decay={2} position={[fx * 7, 5, fz * 7]} />
      {project && <HoloScreen project={project} height={HOLO_HEIGHT} />}
      <StationSign landmark={landmark} position={signPos} />

      {/* Target ring shown on hover and while the autopilot is inbound */}
      <mesh ref={ring} material={glow(landmark.color, 2.2)} scale={0}>
        <torusGeometry args={[landmark.radius * 2.5, 0.07, 6, 6]} />
      </mesh>

      {/* Click proxy: generous, invisible, never written to colour or depth */}
      <mesh onClick={click} onPointerOver={over} onPointerOut={out}>
        <sphereGeometry args={[landmark.radius * 1.9, 16, 12]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** Every project station. Hidden (and inert) while the ship is in the void. */
export function Stations() {
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    if (group.current) group.current.visible = useGame.getState().zone === 'nebula'
  })
  return (
    <group ref={group}>
      {LANDMARKS.map((l) => (
        <Station key={l.id} landmark={l} />
      ))}
    </group>
  )
}
