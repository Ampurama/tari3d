import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { heartReactor } from '../../content/config'
import { reactorPosition } from '../../lib/layout'
import { CHAPTER_COUNT } from '../../lib/story'
import { count } from '../../lib/device'
import { useChaptersDone, useStore } from '../../store'
import { audio } from '../../audio/engine'
import { Glow, HeartMesh, Interactive } from './Bits'
import { DriftParticles } from './Particles'

const DIM = new THREE.Color('#7d6bb8')
const HOT = new THREE.Color('#ff4f9a')

/**
 * HEART REACTOR — a heart-shaped core above the island.
 * One orbit ring lights up per completed chapter; the heart glows brighter with each.
 * During the ending cutscene it surges, sends out a shockwave and floods the sky with light.
 */
export default function HeartReactor() {
  const heart = useRef()
  const rings = useRef([])
  const halo = useRef()
  const wave = useRef()
  const light = useRef()
  const done = useChaptersDone()
  const view = useStore((s) => s.view)
  const goTo = useStore((s) => s.goTo)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const energy = CHAPTER_COUNT ? done / CHAPTER_COUNT : 0
  const cutscene = view === 'cutscene'
  const cutStart = useRef(null)
  const color = useMemo(() => new THREE.Color(), [])

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    if (cutscene && cutStart.current === null) cutStart.current = t
    if (!cutscene) cutStart.current = null
    const since = cutStart.current === null ? 0 : t - cutStart.current
    // surge curve for the cutscene: builds up, peaks around 6s, stays bright
    const surge = cutscene ? Math.min(1, since / 6) : 0

    const beatSpeed = 1.2 + energy * 1.6 + surge * 2
    const beat = reducedMotion ? 0 : Math.pow(Math.max(0, Math.sin(t * beatSpeed * 2)), 8) * (0.04 + energy * 0.06)
    heart.current.scale.setScalar(0.62 * (1 + beat + surge * 0.35))
    heart.current.rotation.y = reducedMotion ? 0.3 : t * (0.25 + energy * 0.5 + surge * 2.5)
    color.copy(DIM).lerp(HOT, Math.min(1, energy + surge))
    heart.current.material.color.copy(color)
    heart.current.material.emissive.copy(color)
    heart.current.material.emissiveIntensity = 0.25 + energy * 1.3 + surge * 3

    rings.current.forEach((r, i) => {
      if (!r) return
      const on = i < done || cutscene
      r.rotation.z += delta * (on ? 0.4 + i * 0.12 + surge * 4 : 0.05) * (reducedMotion ? 0.2 : 1)
      r.material.opacity = THREE.MathUtils.damp(r.material.opacity, on ? 0.95 : 0.16, 3, delta)
      r.material.emissiveIntensity = on ? 1.4 + surge * 2 : 0.15
    })

    halo.current.material.opacity = 0.12 + energy * 0.45 + surge * 0.4
    halo.current.scale.setScalar(3 + energy * 2.5 + surge * 6)

    // shockwave at the peak of the cutscene
    const w = cutscene ? THREE.MathUtils.clamp((since - 5.5) / 3, 0, 1) : 0
    wave.current.visible = w > 0 && w < 1
    wave.current.scale.setScalar(0.5 + w * 40)
    wave.current.material.opacity = (1 - w) * 0.6

    light.current.intensity = 4 + energy * 16 + surge * 60
  })

  const ready = done >= CHAPTER_COUNT

  return (
    <group position={reactorPosition}>
      <Interactive
        label={`${heartReactor.title} · ${done}/${CHAPTER_COUNT}`}
        onSelect={() => {
          audio.sparkle()
          goTo('reactor')
        }}
        sparkleOffset={[0, 1.45, 0]}
        sparkleColor={ready ? '#ff9fd0' : '#d9c6ff'}
        hideBehind={false}
        active={view === 'explore' || view === 'reactor'}
      >
        <HeartMesh ref={heart} scale={0.62} color="#7d6bb8" emissive="#7d6bb8" glow={0.25} />
        {/* tap target */}
        <mesh>
          <sphereGeometry args={[1.2, 12, 10]} />
          <meshBasicMaterial colorWrite={false} depthWrite={false} />
        </mesh>
      </Interactive>
      {Array.from({ length: CHAPTER_COUNT }, (_, i) => (
        <mesh key={i} ref={(el) => (rings.current[i] = el)} rotation={[Math.PI / 2 + (i - 2) * 0.32, (i - 2) * 0.5, 0]}>
          <torusGeometry args={[1.1 + i * 0.16, 0.014, 8, 80]} />
          <meshStandardMaterial color="#ffc2dd" emissive="#ff8fc4" emissiveIntensity={0.15} transparent opacity={0.16} toneMapped={false} />
        </mesh>
      ))}
      <Glow ref={halo} color="#ff8fc4" size={3} opacity={0.12} />
      <mesh ref={wave} visible={false}>
        <sphereGeometry args={[1, 32, 16]} />
        <meshBasicMaterial color={[2, 0.9, 1.5]} transparent opacity={0} side={THREE.BackSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <pointLight ref={light} color="#ff9fd0" intensity={4} distance={18} decay={1.6} />
      {(energy > 0 || cutscene) && (
        <DriftParticles
          position={[0, -0.5, 0]}
          count={cutscene ? count(260, 120) : Math.round(count(30, 14) * (0.4 + energy))}
          area={cutscene ? [26, 14, 26] : [4.5, 4, 4.5]}
          size={cutscene ? 0.26 : 0.12}
          speed={cutscene ? 0.6 : 0.25}
          intensity={2}
          seed={cutscene ? 401 : 400 + done}
        />
      )}
    </group>
  )
}
