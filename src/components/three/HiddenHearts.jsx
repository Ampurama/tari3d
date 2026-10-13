import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { hiddenHeartSpots } from '../../lib/layout'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'
import { Glow, HeartMesh } from './Bits'

const COLORS = ['#ff8fc4', '#ffb3d6', '#d9b8ff', '#ffd7a8', '#ff9fd0']

/**
 * One tiny hidden heart. No sparkle, no label — it has to be discovered.
 * Tapping it records real progress in the store (persisted), then it bursts and fades away.
 */
function HiddenHeart({ id, position }) {
  const root = useRef()
  const heart = useRef()
  const flash = useRef()
  const burst = useRef(0)
  const [hovered, setHovered] = useState(false)
  const found = useStore((s) => s.foundHearts.includes(id))
  const phase = useStore((s) => s.phase)
  const curtain = useStore((s) => s.curtain)
  const findHeart = useStore((s) => s.findHeart)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const color = COLORS[id % COLORS.length]
  const [initiallyFound] = useState(found) // already-found hearts start hidden instead of shrinking on load
  useCursor(hovered && !found)

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime + id * 1.7
    burst.current = THREE.MathUtils.damp(burst.current, 0, 2.2, delta)
    const target = found ? 0 : 1
    const s = THREE.MathUtils.damp(root.current.scale.x, target, found ? 3 : 6, delta)
    root.current.scale.setScalar(Math.max(s, 0.0001))
    root.current.visible = s > 0.003 || burst.current > 0.01
    heart.current.rotation.y = reducedMotion ? 0.4 : t * 0.9
    heart.current.position.y = reducedMotion ? 0 : Math.sin(t * 1.8) * 0.03
    heart.current.material.emissiveIntensity = 0.5 + (reducedMotion ? 0 : 0.35 * Math.sin(t * 2.6)) + (hovered ? 0.6 : 0)
    if (flash.current) {
      const b = burst.current
      flash.current.scale.setScalar(0.2 + (1 - b) * 2.2)
      flash.current.material.opacity = b * 0.9
      flash.current.visible = b > 0.01
    }
  })

  const collect = (e) => {
    e.stopPropagation()
    if (found || phase !== 'world' || curtain || useStore.getState().view === 'cutscene' || e.delta > 8) return
    if (findHeart(id)) {
      burst.current = 1
      audio.sparkle()
    }
  }

  return (
    <group position={position}>
      <group ref={root} scale={initiallyFound ? 0.0001 : 1}>
        <group
          onClick={collect}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHovered(true)
          }}
          onPointerOut={() => setHovered(false)}
        >
          <HeartMesh ref={heart} scale={0.13} color={color} emissive={color} glow={0.5} />
          {/* generous invisible hit area so it's tappable on a phone */}
          <mesh>
            <sphereGeometry args={[0.32, 10, 8]} />
            <meshBasicMaterial colorWrite={false} depthWrite={false} />
          </mesh>
        </group>
        <Glow color={color} size={0.6} opacity={0.35} />
      </group>
      {/* the little "pop" when she finds it, rendered outside the shrinking group */}
      <Glow ref={flash} color={color} size={1} opacity={0} visible={false} />
    </group>
  )
}

/** Renders the hidden hearts that belong to one part of the scene. */
export default function HiddenHearts({ group }) {
  return (
    <>
      {hiddenHeartSpots.map((spot, id) =>
        spot.group === group ? (
          <group key={id}>
            {group === 'sky' && <TinyRock position={[spot.position.x, spot.position.y - 0.26, spot.position.z]} />}
            <HiddenHeart id={id} position={spot.position} />
          </group>
        ) : null,
      )}
    </>
  )
}

function TinyRock(props) {
  return (
    <group {...props}>
      <mesh scale={[0.32, 0.24, 0.3]} castShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#a690d6" roughness={0.7} flatShading />
      </mesh>
      <mesh scale={[0.3, 0.07, 0.28]} position={[0, 0.17, 0]}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial color="#b9dcc6" roughness={0.9} />
      </mesh>
    </group>
  )
}
