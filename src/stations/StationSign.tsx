import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Landmark } from '../data/world'
import { canvasTexture, drawBladeSign, loadSignFonts } from '../scene/signTexture'
import { hullMaterials } from '../scene/materials'

const HEIGHT = 10.5
const WIDTH = (HEIGHT * 256) / 800

/** Neon blade sign that yaws to face the camera, so it reads from every approach. */
export function StationSign({ landmark, position }: { landmark: Landmark; position: [number, number, number] }) {
  const group = useRef<THREE.Group>(null)
  const mats = hullMaterials()
  const { canvas, texture } = useMemo(() => canvasTexture(256, 800), [])

  useEffect(() => {
    let live = true
    const draw = () => {
      if (!live) return
      drawBladeSign(canvas, {
        jp: landmark.signJP,
        name: landmark.sign,
        sub: landmark.sub,
        color: landmark.color,
      })
      texture.needsUpdate = true
    }
    draw()
    loadSignFonts(landmark.signJP).then(draw)
    return () => {
      live = false
    }
  }, [canvas, texture, landmark])

  useEffect(() => () => texture.dispose(), [texture])

  const world = useMemo(() => new THREE.Vector3(), [])
  useFrame((state) => {
    const g = group.current
    if (!g) return
    g.getWorldPosition(world)
    g.rotation.y = Math.atan2(state.camera.position.x - world.x, state.camera.position.z - world.z)
  })

  return (
    <group ref={group} position={position}>
      <mesh>
        <planeGeometry args={[WIDTH, HEIGHT]} />
        <meshBasicMaterial
          map={texture}
          transparent
          toneMapped={false}
          color={new THREE.Color(1.7, 1.7, 1.7)}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Mounting spine behind the sign */}
      <mesh position={[0, 0, -0.14]} material={mats.frame}>
        <boxGeometry args={[0.3, HEIGHT + 0.8, 0.12]} />
      </mesh>
    </group>
  )
}
