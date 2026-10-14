import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { envelope, glowFlowers } from '../../content/config'
import { bonusHeartSpot, envelopeSpot, glowFlowerSpots, loveTree } from '../../lib/layout'
import { useInteractable } from '../../lib/interactions'
import { chapterIndex, chapterStatus } from '../../lib/story'
import { useChapterUnlocked, useStore } from '../../store'
import { audio } from '../../audio/engine'
import Tappable from './Interact'
import { Glow, HeartMesh } from './Bits'

const damp = THREE.MathUtils.damp

/* ───────── Chapter 1: three glowing flowers ───────── */

function GlowFlower({ flower, index }) {
  const ref = useRef()
  const halo = useRef()
  const found = useStore((s) => s.flowersFound.includes(flower.id))
  const awake = useStore((s) => s.mochiAwake)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const position = glowFlowerSpots[index]
  // once picked, each flower is replanted in a little ring at the foot of the Love Tree
  const home = useRef(new THREE.Vector3(loveTree.x - 1.4 + index * 0.45, 0, loveTree.z + 2.3))
  useInteractable(`glow:${flower.id}`, {
    position,
    radius: 1.5,
    label: 'Pick the glowing flower',
    enabled: () => awake && !found,
    onInteract: () => {
      if (useStore.getState().findGlowFlower(flower.id)) audio.sfx('pickup')
    },
  })
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime + index
    const g = ref.current
    const target = found ? home.current : position
    g.position.x = damp(g.position.x, target.x, 2.5, delta)
    g.position.z = damp(g.position.z, target.z, 2.5, delta)
    g.position.y = (found ? loveTree.y : position.y) + (reducedMotion || found ? 0 : Math.sin(t * 2) * 0.04)
    g.rotation.y = reducedMotion ? 0 : t * 0.6
    halo.current.material.opacity = damp(halo.current.material.opacity, found ? 0.35 : awake ? 0.85 + Math.sin(t * 3) * 0.1 : 0.3, 3, delta)
  })
  const c = new THREE.Color(flower.color)
  return (
    <Tappable id={`glow:${flower.id}`}>
      <group ref={ref} position={position}>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.015, 0.02, 0.4, 5]} />
          <meshStandardMaterial color="#6fae86" />
        </mesh>
        {Array.from({ length: 5 }, (_, i) => (
          <mesh key={i} position={[Math.cos((i / 5) * Math.PI * 2) * 0.07, 0.42, Math.sin((i / 5) * Math.PI * 2) * 0.07]} rotation={[0.6, (i / 5) * Math.PI * 2, 0]} scale={[0.06, 0.1, 0.03]}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshBasicMaterial color={c.clone().multiplyScalar(1.6)} toneMapped={false} />
          </mesh>
        ))}
        <mesh position={[0, 0.43, 0]} scale={0.035}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshBasicMaterial color={[3, 2.6, 1.6]} toneMapped={false} />
        </mesh>
        <Glow ref={halo} position={[0, 0.42, 0]} color={flower.color} size={1.2} opacity={0.5} />
      </group>
    </Tappable>
  )
}

export function GlowFlowers() {
  return glowFlowers.map((f, i) => <GlowFlower key={f.id} flower={f} index={i} />)
}

/* ───────── Chapter 5: the envelope beneath the Love Tree ───────── */

export function Envelope() {
  const ref = useRef()
  const halo = useRef()
  const open = useChapterUnlocked('letter')
  const opened = useStore((s) => s.envelopeOpened)
  const reducedMotion = useStore((s) => s.reducedMotion)
  useInteractable('envelope', {
    position: envelopeSpot,
    radius: 1.5,
    priority: 0.5,
    label: () => (useStore.getState().envelopeOpened ? 'Read the letter again' : envelope.label),
    enabled: () => chapterStatus(useStore.getState())[chapterIndex('letter')]?.unlocked,
    onInteract: () => {
      const s = useStore.getState()
      audio.sfx('reveal')
      if (s.envelopeOpened) s.openLetterAgain()
      else s.openEnvelope()
    },
  })
  useFrame(({ clock }, delta) => {
    if (!ref.current) return
    const t = clock.elapsedTime
    ref.current.position.y = envelopeSpot.y + 0.12 + (reducedMotion ? 0 : Math.abs(Math.sin(t * 2)) * 0.06)
    ref.current.rotation.y = reducedMotion ? 0.3 : Math.sin(t * 0.8) * 0.3
    halo.current.material.opacity = damp(halo.current.material.opacity, opened ? 0.25 : 0.8, 2, delta)
  })
  if (!open) return null
  return (
    <Tappable id="envelope">
      <group ref={ref} position={envelopeSpot}>
        <mesh rotation={[-1.2, 0, 0]}>
          <boxGeometry args={[0.42, 0.28, 0.02]} />
          <meshStandardMaterial color="#fff4e6" emissive="#ffe2c4" emissiveIntensity={0.4} />
        </mesh>
        {/* the flap and its little heart seal */}
        <mesh position={[0, 0.03, 0.01]} rotation={[-1.2, 0, Math.PI / 4]} scale={[0.2, 0.2, 0.01]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#ffe9d6" />
        </mesh>
        <HeartMesh position={[0, 0.06, 0.05]} rotation={[-1.2, 0, 0]} scale={0.035} color="#ff7aa8" emissive="#ff4f8a" glow={1} />
        <Glow ref={halo} position={[0, 0.15, 0]} color="#ffe2c4" size={1.6} opacity={0.8} />
      </group>
    </Tappable>
  )
}

/* ───────── the optional secret: a tiny heart behind the blossom tree ───────── */

export function BonusHeart() {
  const ref = useRef()
  const found = useStore((s) => s.bonusFound)
  const reducedMotion = useStore((s) => s.reducedMotion)
  useInteractable('bonus-heart', {
    position: bonusHeartSpot,
    radius: 1.3,
    label: () => (useStore.getState().bonusFound ? 'The tiny secret heart' : 'A tiny glowing heart…'),
    onInteract: () => {
      audio.sfx('reveal')
      useStore.getState().findBonusHeart()
    },
  })
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime
    ref.current.position.y = bonusHeartSpot.y + (reducedMotion ? 0 : Math.sin(t * 1.6) * 0.06)
    ref.current.rotation.y = reducedMotion ? 0 : t * 0.8
    const pulse = 1 + (reducedMotion ? 0 : Math.pow(Math.max(0, Math.sin(t * 2.4)), 8) * 0.25)
    ref.current.scale.setScalar(0.09 * pulse)
  })
  return (
    <Tappable id="bonus-heart">
      <group>
        <HeartMesh ref={ref} position={bonusHeartSpot} scale={0.09} color="#ffd6ea" emissive="#ff6fae" glow={found ? 0.8 : 1.4} />
        <Glow position={bonusHeartSpot} color="#ffb3d6" size={0.9} opacity={found ? 0.3 : 0.6} />
      </group>
    </Tappable>
  )
}
