import { Bloom, ChromaticAberration, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import { useMemo } from 'react'
import * as THREE from 'three'
import { useGame } from '../store/useGame'

/** HDR bloom on emissive neon, a little lens character, then filmic tone mapping. */
export function Effects() {
  const touch = useGame((s) => s.touch)
  const offset = useMemo(() => new THREE.Vector2(0.0007, 0.0007), [])
  return (
    <EffectComposer multisampling={touch ? 0 : 4} frameBufferType={THREE.HalfFloatType}>
      <Bloom mipmapBlur intensity={0.85} luminanceThreshold={1} luminanceSmoothing={0.25} radius={0.78} />
      <ChromaticAberration offset={offset} radialModulation modulationOffset={0.35} />
      <Vignette darkness={0.62} offset={0.22} />
      <Noise opacity={0.045} blendFunction={BlendFunction.OVERLAY} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}
