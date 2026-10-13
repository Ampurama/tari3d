import { Environment, Lightformer } from '@react-three/drei'
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { moonPosition } from '../../lib/layout'
import { tier } from '../../lib/device'

/** Moonlight, soft fills and a locally-generated environment for glossy reflections (no downloads). */
export function Lights() {
  const shadowSize = tier === 'high' ? 2048 : 1024
  return (
    <>
      <hemisphereLight args={['#b7a2ff', '#241a4d', 0.5]} />
      <ambientLight intensity={0.08} color="#f3d9ff" />
      <directionalLight
        position={[moonPosition.x * 0.2, moonPosition.y * 0.35, moonPosition.z * 0.12]}
        intensity={1.55}
        color="#fff1e0"
        castShadow
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-bias={-0.0004}
        shadow-radius={4}
        shadow-normalBias={0.03}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-camera-near={1}
        shadow-camera-far={40}
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
    <EffectComposer multisampling={high ? 4 : 0} enableNormalPass={false}>
      <Bloom mipmapBlur intensity={high ? 0.95 : 0.8} luminanceThreshold={0.82} luminanceSmoothing={0.25} radius={0.72} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <Vignette eskil={false} offset={0.22} darkness={0.62} />
    </EffectComposer>
  )
}
