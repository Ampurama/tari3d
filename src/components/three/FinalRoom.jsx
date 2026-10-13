import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { areas } from '../../lib/layout'
import { count } from '../../lib/device'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'
import { Glow, HeartMesh } from './Bits'
import { DriftParticles, Fireflies } from './Particles'

const PINK_LIGHT = new THREE.Color('#ffd6ea')
const WARM_LIGHT = new THREE.Color('#ffc58a')

/**
 * The little star that was never lit. It wakes up once the final letter has appeared,
 * and only then can it be touched — that opens the secret ending.
 */
function SecretStar() {
  const core = useRef()
  const halo = useRef()
  const [hovered, setHovered] = useState(false)
  const awake = useStore((s) => s.starAwake)
  const stage = useStore((s) => s.secretStage)
  const findSecret = useStore((s) => s.findSecret)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const live = awake && !stage
  useCursor(hovered && live)

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    const pulse = reducedMotion ? 1 : 0.8 + 0.3 * Math.sin(t * 2.2)
    const target = !awake ? 0.12 : stage ? 0.5 : 1
    halo.current.material.opacity = THREE.MathUtils.damp(halo.current.material.opacity, target * 0.9 * pulse, 2, delta)
    const s = THREE.MathUtils.damp(halo.current.scale.x, (awake ? 1.1 : 0.5) * (hovered && live ? 1.4 : 1) * pulse, 3, delta)
    halo.current.scale.set(s, s, 1)
    core.current.scale.setScalar(THREE.MathUtils.damp(core.current.scale.x, awake ? 1 : 0.55, 2, delta))
    core.current.material.color.setScalar(awake ? 2.6 : 0.5)
  })

  return (
    <group
      position={[2.15, 4.55, -1.4]}
      onClick={(e) => {
        if (!live) return
        e.stopPropagation()
        if (e.delta > 8) return
        if (findSecret()) audio.sparkle()
      }}
      onPointerOver={(e) => {
        if (!live) return
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
    >
      <mesh ref={core} scale={0.55}>
        <octahedronGeometry args={[0.09, 0]} />
        <meshBasicMaterial color={[0.5, 0.5, 0.5]} toneMapped={false} />
      </mesh>
      <Glow ref={halo} color="#fff1c9" size={0.5} opacity={0.1} />
      {/* generous tap target for fingers */}
      <mesh>
        <sphereGeometry args={[0.45, 10, 8]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

/*
 * The Secret Room — a quiet glass platform far above everything, ringed by candles,
 * with a great translucent heart. Lazy-loaded and only mounted for the ending.
 * During the secret ending the same room turns warm and soft (no extra scene is created).
 */
export default function FinalRoom() {
  const heart = useRef()
  const flames = useRef([])
  const keyLight = useRef()
  const warmGlow = useRef()
  const reducedMotion = useStore((s) => s.reducedMotion)
  const secretStage = useStore((s) => s.secretStage)
  const warm = Boolean(secretStage) && secretStage !== 'found'
  const candles = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2
        return { x: Math.cos(a) * 4.2, z: Math.sin(a) * 4.2, h: 0.25 + ((i * 7) % 5) * 0.08 }
      }),
    [],
  )

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    const slow = warm ? 0.4 : 1
    if (!reducedMotion) {
      heart.current.rotation.y = Math.sin(t * 0.3 * slow) * 0.4
      heart.current.position.y = 3.2 + Math.sin(t * 0.8 * slow) * 0.12
    }
    const beat = reducedMotion ? 0 : Math.pow(Math.max(0, Math.sin(t * 2.4 * slow)), 8) * 0.05
    heart.current.scale.setScalar(1.5 * (1 + beat))
    flames.current.forEach((f, i) => {
      if (!f) return
      const flick = reducedMotion ? 1 : 0.85 + 0.25 * Math.sin(t * 9 * slow + i * 2.1) * Math.sin(t * 5.3 * slow + i)
      f.scale.set(0.035, 0.07 * flick, 0.035)
    })
    // warm, soft light for the secret ending
    keyLight.current.color.lerp(warm ? WARM_LIGHT : PINK_LIGHT, Math.min(1, delta * 0.6))
    keyLight.current.intensity = THREE.MathUtils.damp(keyLight.current.intensity, warm ? 11 : 18, 0.8, delta)
    warmGlow.current.material.opacity = THREE.MathUtils.damp(warmGlow.current.material.opacity, warm ? 0.32 : 0, 0.8, delta)
  })

  return (
    <group position={areas.finalRoom}>
      {/* glass floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[5.2, 64]} />
        <meshPhysicalMaterial color="#2a2056" roughness={0.15} metalness={0.2} clearcoat={1} transparent opacity={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[5.05, 5.2, 64]} />
        <meshBasicMaterial color={[2, 1.4, 0.9]} toneMapped={false} />
      </mesh>
      {/* candles */}
      {candles.map((c, i) => (
        <group key={i} position={[c.x, 0, c.z]}>
          <mesh position={[0, c.h / 2, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.08, c.h, 12]} />
            <meshStandardMaterial color="#fff6ee" roughness={0.6} />
          </mesh>
          <mesh ref={(el) => (flames.current[i] = el)} position={[0, c.h + 0.07, 0]}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshBasicMaterial color={[3, 2.1, 1.1]} toneMapped={false} />
          </mesh>
          <Glow position={[0, c.h + 0.08, 0]} color="#ffcf87" size={0.8} opacity={0.7} />
        </group>
      ))}
      {/* the big heart */}
      <HeartMesh ref={heart} position={[0, 3.2, -1.5]} scale={1.5} color="#ff9cc8" emissive="#ff4f9a" glow={1.1} />
      <Glow position={[0, 3.2, -1.8]} color="#ff8fc4" size={9} opacity={0.4} />
      <Glow position={[0, 3.2, -2.2]} color="#b892ff" size={16} opacity={0.2} />
      <Glow ref={warmGlow} position={[0, 2.6, -2.6]} color="#ffc58a" size={20} opacity={0} />
      <SecretStar />
      <pointLight ref={keyLight} position={[0, 3.5, 1.5]} color="#ffd6ea" intensity={18} distance={14} />
      <pointLight position={[0, 1, 0]} color="#ffcf87" intensity={6} distance={10} />
      <ambientLight intensity={0.2} />
      <DriftParticles position={[0, 3, 0]} count={count(80, 40)} area={[11, 7, 11]} size={0.14} speed={0.18} seed={211} intensity={1.5} />
      <Fireflies count={count(40, 20)} area={[9, 3, 9]} center={[0, 0.6, 0]} seed={212} />
    </group>
  )
}
