import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { atmosphere } from '../../lib/atmosphere'
import { SUN_DIR } from './Sky'
import { tier } from '../../lib/device'
import { islandCenter } from './Player'

const ORIGIN = new THREE.Vector3()
import { useStore } from '../../store'

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
// night is a deep, clear blue lit by the moon (not a flat purple)
// dreamcore daylight: a lavender sky light, a mint-green bounce from the ground, pearly sunshine
const SKY = { day: c('#d4d0ff'), sunset: c('#ffcfd6'), night: c('#a9b8ff') }
const GROUND = { day: c('#b4d6a0'), sunset: c('#eac6b0'), night: c('#1e2450') }
const SUN = { day: c('#fff0dc'), sunset: c('#ffa87a'), night: c('#c7d4ff') }
const tmp = new THREE.Color()
const blend = (set, day, sunset) => tmp.copy(set.day).lerp(set.sunset, sunset).lerp(set.night, 1 - day)

/**
 * Warm sunlight from the upper right, a bright sky/ground ambient so shaded sides keep their colour,
 * soft (never black) shadows, and a locally-generated environment for gentle reflections (no downloads).
 * Everything follows the shared time of day: bright day → golden afternoon/sunset → (rare) night.
 */
const focus = new THREE.Vector3()

export function Lights() {
  const shadowSize = tier === 'high' ? 2048 : 1024
  const hemi = useRef()
  const ambient = useRef()
  const sun = useRef()
  const scene = useThree((s) => s.scene)
  // the sun's target has to be in the scene for its direction (and its shadows) to follow it around
  useEffect(() => {
    const target = sun.current.target
    scene.add(target)
    return () => scene.remove(target)
  }, [scene])
  useFrame((_, delta) => {
    const { day, sunset } = atmosphere
    hemi.current.color.copy(blend(SKY, day, sunset))
    hemi.current.groundColor.copy(blend(GROUND, day, sunset))
    hemi.current.intensity = THREE.MathUtils.lerp(0.42, 1.15 - sunset * 0.2, day)
    ambient.current.intensity = THREE.MathUtils.lerp(0.08, 0.15, day)
    sun.current.color.copy(blend(SUN, day, sunset))
    sun.current.intensity = THREE.MathUtils.lerp(1.6, 3.4 - sunset * 1.0, day)
    // the sun (and its shadows) goes wherever she is: the home island, Sky Island, the western isles
    // all get the same soft shadows as the main island
    const s = useStore.getState()
    const target = s.phase === 'world' ? islandCenter() : ORIGIN
    focus.x = THREE.MathUtils.damp(focus.x, target.x, 3, delta)
    focus.y = THREE.MathUtils.damp(focus.y, target.y, 3, delta)
    focus.z = THREE.MathUtils.damp(focus.z, target.z, 3, delta)
    // the sun crosses the sky with the hours: long golden shadows morning and evening, the moon at night
    sun.current.position.copy(focus).addScaledVector(atmosphere.sunDir, 26)
    sun.current.target.position.copy(focus)
    sun.current.target.updateMatrixWorld()
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
      {/* a soft rose fill from the other side, so nothing goes flat (and everything feels a little in love) */}
      <directionalLight position={[-10, 6, 8]} intensity={0.45} color="#ffd6ea" />
      <Environment resolution={64} frames={1} environmentIntensity={0.5}>
        <Lightformer form="ring" intensity={2} color="#fff4e6" position={[0, 6, 6]} scale={6} />
        <Lightformer form="rect" intensity={1.4} color="#dff0ff" position={[-8, 3, -4]} scale={[6, 3, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#fff0d6" position={[8, 4, -2]} scale={[4, 4, 1]} />
        <Lightformer form="circle" intensity={0.8} color="#cfe8b8" position={[0, -8, 0]} scale={10} />
      </Environment>
    </>
  )
}

/**
 * The grade follows the hour: rich colour by day, a touch warmer and softer at golden hour, cooler
 * and a little more contrasty at night (moonlight reads as blue, lanterns as warm).
 */
function useGrade(hue, bc) {
  useFrame(() => {
    const night = 1 - atmosphere.day
    if (hue.current) hue.current.saturation = 0.12 - night * 0.14 + atmosphere.sunset * atmosphere.day * 0.04
    if (bc.current) {
      bc.current.contrast = 0.06 + night * 0.06
      bc.current.brightness = -night * 0.02
    }
  })
}

export function Effects() {
  const high = tier === 'high'
  const hue = useRef()
  const bc = useRef()
  useGrade(hue, bc)
  return (
    <EffectComposer multisampling={high ? 4 : 2} enableNormalPass={false}>
      {/* soft contact shadows where things meet: under trees, props, the avatar, in the folds of the
          ground (warm violet, never black: it should read as painted shade). Laptops/desktops only. */}
      {high ? <N8AO halfRes quality="low" aoRadius={1.1} distanceFalloff={0.6} intensity={2.2} color="#3b2a52" /> : <></>}
      {/* bloom only for things that really glow (lanterns, lights, sparkles) — not to brighten the world */}
      <Bloom mipmapBlur intensity={high ? 0.5 : 0.4} luminanceThreshold={0.94} luminanceSmoothing={0.2} radius={0.6} />
      {/* film-like curve: rich mid-tones and soft highlights, like a painted background */}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      {/* ACES leaves pastels a little grey: give the colour back, with a touch more depth */}
      <HueSaturation ref={hue} saturation={0.12} />
      <BrightnessContrast ref={bc} contrast={0.06} />
      <Vignette eskil={false} offset={0.4} darkness={0.2} />
    </EffectComposer>
  )
}
