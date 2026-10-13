import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { hiddenNotes } from '../../content/config'
import { loveTree, noteSpots, secretStarSpot } from '../../lib/layout'
import { useInteractable } from '../../lib/interactions'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'
import { Glow } from './Bits'
import Tappable from './Interact'

const damp = THREE.MathUtils.damp

/** A small rolled note, glowing faintly. Optional — it never blocks anything. */
function Note({ note }) {
  const ref = useRef()
  const glow = useRef()
  const found = useStore((s) => s.notesFound.includes(note.id))
  const reducedMotion = useStore((s) => s.reducedMotion)
  const position = noteSpots[note.id]
  useInteractable(`note:${note.id}`, {
    position,
    radius: 1.3,
    label: found ? 'Read the note again' : 'Pick up the little note',
    onInteract: () => {
      if (useStore.getState().findNote(note)) audio.sfx('reveal')
    },
  })
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    ref.current.position.y = 0.32 + (reducedMotion ? 0 : Math.sin(t * 1.8 + position.x) * 0.04)
    ref.current.rotation.y = reducedMotion ? 0 : t * 0.5
    glow.current.material.opacity = damp(glow.current.material.opacity, found ? 0.2 : 0.55 + 0.2 * Math.sin(t * 2), 3, delta)
  })
  if (!position) return null
  return (
    <Tappable id={`note:${note.id}`} position={position}>
      <group ref={ref} position={[0, 0.32, 0]} rotation={[0, 0, 0.3]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.045, 0.045, 0.22, 10]} />
          <meshStandardMaterial color="#fff6e8" emissive="#fff0d6" emissiveIntensity={0.35} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.048, 0.008, 6, 14]} />
          <meshStandardMaterial color="#ff8fc4" />
        </mesh>
        <Glow ref={glow} color="#fff1c9" size={0.8} opacity={0.5} />
      </group>
    </Tappable>
  )
}

/**
 * After the main ending: a little star that wasn't there before, hovering by the Love Tree.
 * Touching it opens the secret ending ("The one thing I could never code").
 */
function SecretStar() {
  const ref = useRef()
  const halo = useRef()
  const available = useStore((s) => s.mainEndingSeen)
  const view = useStore((s) => s.view)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const reach = loveTree.clone().add(new THREE.Vector3(1.3, 0, 1.0))
  useInteractable('secret-star', {
    position: reach,
    radius: 2.2,
    label: 'Reach for the little star',
    priority: 0.5,
    enabled: () => available,
    onInteract: () => {
      if (useStore.getState().openSecret()) audio.sparkle()
    },
  })
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime
    ref.current.position.y = secretStarSpot.y + (reducedMotion ? 0 : Math.sin(t * 1.3) * 0.12)
    const pulse = reducedMotion ? 1 : 0.85 + 0.2 * Math.sin(t * 2.6)
    halo.current.scale.setScalar(1.1 * pulse)
  })
  if (!available || view === 'finalRoom') return null
  return (
    <group
      ref={ref}
      position={secretStarSpot}
      onClick={(e) => {
        if (useStore.getState().view !== 'explore' && useStore.getState().view !== 'ending') return
        e.stopPropagation()
        if (e.delta > 8) return
        if (useStore.getState().openSecret()) audio.sparkle()
      }}
    >
      <mesh scale={0.06}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={[3, 2.7, 1.8]} toneMapped={false} />
      </mesh>
      <Glow ref={halo} color="#fff1c9" size={1} opacity={0.9} />
      <mesh>
        <sphereGeometry args={[0.45, 10, 8]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

export default function Discoveries() {
  return (
    <group>
      {hiddenNotes.map((n) => (
        <Note key={n.id} note={n} />
      ))}
      <SecretStar />
    </group>
  )
}
