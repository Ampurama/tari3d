import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { moonPosition } from '../../lib/layout'
import { tier } from '../../lib/device'

/** Shadows are redrawn every other frame: half the cost, no visible difference at this pace. */
function ShadowThrottle() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
    return () => {
      gl.shadowMap.autoUpdate = true
    }
  }, [gl])
  const tick = useRef(0)
  useFrame(() => {
    tick.current = (tick.current + 1) % 2
    if (tick.current === 0) gl.shadowMap.needsUpdate = true
  })
  return null
}

/** Moonlight, soft fills and a locally-generated environment for glossy reflections (no downloads). */
export function Lights() {
  const shadowSize = tier === 'high' ? 2048 : 1024
  return (
    <>
      <ShadowThrottle />
      <hemisphereLight args={['#c4b0ff', '#2c1f5c', 0.62]} />
      <ambientLight intensity={0.08} color="#f3d9ff" />
      <directionalLight
        position={[moonPosition.x * 0.2, moonPosition.y * 0.35, moonPosition.z * 0.12]}
        intensity={1.55}
        color="#fff1e0"
        castShadow
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-bias={-0.0004}
        shadow-intensity={0.6}
        shadow-radius={4}
        shadow-normalBias={0.03}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-camera-near={1}
        shadow-camera-far={60}
      />
      <directionalLight position={[8, 3, 10]} intensity={0.4} color="#ffb6d9" />
      <directionalLight position={[-6, -4, 6]} intensity={0.35} color="#9f8bff" />
      <Environment resolution={64} frames={1} environmentIntensity={0.55}>
        <Lightformer form="ring" intensity={2.2} color="#ffd9ec" position={[0, 6, 6]} scale={6} />
        <Lightformer form="rect" intensity={1.4} color="#c4b0ff" position={[-8, 2, -4]} scale={[6, 3, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#fff0d6" position={[8, 4, -2]} scale={[4, 4, 1]} />
        <Lightformer form="circle" intensity={0.6} color="#3a2b7a" position={[0, -8, 0]} scale={10} />
      </Environment>
    </>
  )
}

export function Effects() {
  const high = tier === 'high'
  return (
    <EffectComposer multisampling={high ? 4 : 2} enableNormalPass={false}>
      <Bloom mipmapBlur intensity={high ? 0.95 : 0.8} luminanceThreshold={0.82} luminanceSmoothing={0.25} radius={0.72} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <Vignette eskil={false} offset={0.22} darkness={0.62} />
    </EffectComposer>
  )
}
