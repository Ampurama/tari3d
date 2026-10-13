import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { loveCapsule } from '../../content/config'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'
import { Glow, Interactive } from './Bits'

/** One tiny envelope inside the jar. The chosen one floats up out of the jar. */
function MiniEnvelope({ letter, index, total }) {
  const ref = useRef()
  const view = useStore((s) => s.view)
  const open = useStore((s) => s.capsuleLetter === letter.id)
  const opened = useStore((s) => s.capsuleOpened.includes(letter.id))
  const reducedMotion = useStore((s) => s.reducedMotion)
  const a = (index / total) * Math.PI * 2
  // stable identity so re-renders don't snap the envelope back to its resting spot
  const base = useMemo(() => new THREE.Vector3(Math.cos(a) * 0.1, 0.16 + index * 0.075, Math.sin(a) * 0.1), [a, index])

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime + index
    const lively = view === 'capsule' && !reducedMotion ? 1 : 0.4
    const y = open ? 0.95 : base.y + Math.sin(t * 1.3) * 0.02 * lively
    ref.current.position.x = THREE.MathUtils.damp(ref.current.position.x, open ? 0 : base.x, 3, delta)
    ref.current.position.z = THREE.MathUtils.damp(ref.current.position.z, open ? 0.05 : base.z, 3, delta)
    ref.current.position.y = THREE.MathUtils.damp(ref.current.position.y, y, 3, delta)
    ref.current.rotation.y = reducedMotion ? a : a + t * 0.4 * lively
    ref.current.rotation.z = open ? 0 : Math.sin(t) * 0.2
  })

  return (
    <group ref={ref} position={base}>
      <mesh>
        <boxGeometry args={[0.13, 0.085, 0.012]} />
        <meshStandardMaterial color={letter.color} emissive={letter.color} emissiveIntensity={opened ? 0.25 : 0.7} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.012, 0.007]} rotation={[0, 0, Math.PI / 4]} scale={[0.06, 0.06, 0.002]}>
        <boxGeometry />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.3} />
      </mesh>
    </group>
  )
}

/** LOVE CAPSULE — a glass jar of "open when…" letters on the meadow. */
export default function LoveCapsule(props) {
  const goTo = useStore((s) => s.goTo)
  const letters = loveCapsule.letters
  return (
    <Interactive
      label={loveCapsule.title}
      onSelect={() => {
        audio.sparkle()
        goTo('capsule')
      }}
      sparkleOffset={[0, 0.95, 0]}
      sparkleColor="#ffc9e3"
      {...props}
    >
      {/* jar */}
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.22, 0.56, 28, 1, true]} />
        <meshPhysicalMaterial
          color="#f3e8ff"
          transparent
          opacity={0.28}
          roughness={0.05}
          metalness={0}
          clearcoat={1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.03, 28]} />
        <meshPhysicalMaterial color="#efe3ff" transparent opacity={0.5} roughness={0.1} />
      </mesh>
      {/* cork lid + ribbon */}
      <mesh position={[0, 0.61, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.15, 0.08, 20]} />
        <meshStandardMaterial color="#c9a27e" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.54, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.205, 0.014, 8, 32]} />
        <meshStandardMaterial color="#ff8fc4" emissive="#ff6fae" emissiveIntensity={0.5} />
      </mesh>
      {letters.map((l, i) => (
        <MiniEnvelope key={l.id} letter={l} index={i} total={letters.length} />
      ))}
      <Glow position={[0, 0.32, 0]} color="#ffc9e3" size={1.4} opacity={0.35} />
      {/* tap target */}
      <mesh position={[0, 0.32, 0]}>
        <cylinderGeometry args={[0.32, 0.32, 0.8, 10]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>
    </Interactive>
  )
}
