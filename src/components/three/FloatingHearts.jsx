import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sweetNotes } from '../../content/config'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'
import { Glow, HeartMesh, Interactive } from './Bits'

const HEARTS = [
  { position: [-3.4, 3.6, -0.6], scale: 0.32, color: '#ff9cc6' },
  { position: [2.6, 4.3, -1.8], scale: 0.26, color: '#d9b8ff' },
  { position: [4.4, 2.4, 2.4], scale: 0.22, color: '#ffc0d9' },
  { position: [-1.8, 5.2, 2.2], scale: 0.2, color: '#ffd7a8' },
  { position: [0.9, 2.7, 4.4], scale: 0.17, color: '#ffb0d0' },
]

function FloatingHeart({ position, scale, color, index, onTap }) {
  const ref = useRef()
  const pop = useRef(0)
  const reducedMotion = useStore((s) => s.reducedMotion)
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime + index * 2.1
    const m = reducedMotion ? 0.2 : 1
    ref.current.position.y = Math.sin(t * 0.9) * 0.25 * m
    ref.current.rotation.y = reducedMotion ? 0.3 : t * 0.6
    ref.current.rotation.z = Math.sin(t * 0.7) * 0.1 * m
    pop.current = THREE.MathUtils.damp(pop.current, 0, 5, delta)
    ref.current.scale.setScalar(scale * (1 + pop.current * 0.6))
  })
  return (
    <group position={position}>
      <Interactive
        onSelect={() => {
          pop.current = 1
          onTap()
        }}
        sparkleOffset={[0, scale * 1.6, 0]}
        sparkleColor={color}
      >
        <group ref={ref}>
          <HeartMesh color={color} emissive={color} glow={0.55} />
        </group>
        <Glow color={color} size={scale * 6} opacity={0.35} />
      </Interactive>
    </group>
  )
}

/** Glossy hearts drifting around the island. Tap one for a little note. */
export default function FloatingHearts() {
  const showToast = useStore((s) => s.showToast)
  const order = useMemo(() => [...sweetNotes].sort(() => Math.random() - 0.5), [])
  const next = useRef(0)
  const tap = () => {
    if (!order.length) return
    showToast(order[next.current % order.length], 4800)
    next.current++
    audio.sparkle()
  }
  return (
    <group>
      {HEARTS.map((h, i) => (
        <FloatingHeart key={i} index={i} {...h} onTap={tap} />
      ))}
    </group>
  )
}
