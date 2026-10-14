import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { atmosphere } from '../../lib/atmosphere'
import { SUN_DIR } from './Sky'
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

const c = (hex) => new THREE.Color(hex)
/** Light colours for day, sunset and night (the time of day blends between them). */
const SKY = { day: c('#bfe0ff'), sunset: c('#ffd2c0'), night: c('#c4b0ff') }
const GROUND = { day: c('#a9cf7e'), sunset: c('#e8c9a0'), night: c('#2c1f5c') }
const SUN = { day: c('#ffe6bd'), sunset: c('#ffad70'), night: c('#d8d0ff') }
const tmp = new THREE.Color()
const blend = (set, day, sunset) => tmp.copy(set.day).lerp(set.sunset, sunset).lerp(set.night, 1 - day)

/**
 * Warm sunlight from the upper right, a bright sky/ground ambient so shaded sides keep their colour,
 * soft (never black) shadows, and a locally-generated environment for gentle reflections (no downloads).
 * Everything follows the shared time of day: bright day → golden afternoon/sunset → (rare) night.
 */
export function Lights() {
  const shadowSize = tier === 'high' ? 2048 : 1024
  const hemi = useRef()
  const ambient = useRef()
  const sun = useRef()
  useFrame(() => {
    const { day, sunset } = atmosphere
    hemi.current.color.copy(blend(SKY, day, sunset))
    hemi.current.groundColor.copy(blend(GROUND, day, sunset))
    hemi.current.intensity = THREE.MathUtils.lerp(0.62, 1.15 - sunset * 0.2, day)
    ambient.current.intensity = THREE.MathUtils.lerp(0.08, 0.15, day)
    sun.current.color.copy(blend(SUN, day, sunset))
    sun.current.intensity = THREE.MathUtils.lerp(1.1, 3.4 - sunset * 1.0, day)
  })
  const sunPos = SUN_DIR.clone().multiplyScalar(26)
  return (
    <>
      <ShadowThrottle />
      <hemisphereLight ref={hemi} args={['#d9edff', '#bfe0a2', 1.05]} />
      <ambientLight ref={ambient} intensity={0.32} color="#fff6ea" />
      <directionalLight
        ref={sun}
        position={[sunPos.x, sunPos.y, sunPos.z]}
        intensity={2.5}
        color="#fff1d6"
        castShadow
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-bias={-0.0004}
        shadow-intensity={0.55}
        shadow-radius={6}
        shadow-normalBias={0.03}
        shadow-camera-left={-15.5}
        shadow-camera-right={15.5}
        shadow-camera-top={15.5}
        shadow-camera-bottom={-15.5}
        shadow-camera-near={1}
        shadow-camera-far={60}
      />
      {/* a soft warm fill from the other side, so nothing goes flat */}
      <directionalLight position={[-10, 6, 8]} intensity={0.35} color="#ffe2ef" />
      <Environment resolution={64} frames={1} environmentIntensity={0.5}>
        <Lightformer form="ring" intensity={2} color="#fff4e6" position={[0, 6, 6]} scale={6} />
        <Lightformer form="rect" intensity={1.4} color="#dff0ff" position={[-8, 3, -4]} scale={[6, 3, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#fff0d6" position={[8, 4, -2]} scale={[4, 4, 1]} />
        <Lightformer form="circle" intensity={0.8} color="#cfe8b8" position={[0, -8, 0]} scale={10} />
      </Environment>
    </>
  )
}

export function Effects() {
  const high = tier === 'high'
  return (
    <EffectComposer multisampling={high ? 4 : 2} enableNormalPass={false}>
      {/* bloom only for things that really glow (lanterns, lights, sparkles) — not to brighten the world */}
      <Bloom mipmapBlur intensity={high ? 0.5 : 0.4} luminanceThreshold={0.94} luminanceSmoothing={0.2} radius={0.6} />
      {/* film-like curve: rich mid-tones and soft highlights, like a painted background */}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette eskil={false} offset={0.4} darkness={0.2} />
    </EffectComposer>
  )
}
