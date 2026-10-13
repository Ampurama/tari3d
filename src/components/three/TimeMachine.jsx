import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { timeMachine } from '../../content/config'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'
import { Glow, Interactive } from './Bits'

const GOLD = '#e9c27a'

/**
 * TIME MACHINE — a brass gyroscope with a glowing clock at its heart.
 * It sleeps until Chapter Two; when she travels, the rings spin up and the core flares.
 */
export default function TimeMachine(props) {
  const rings = useRef([])
  const hourHand = useRef()
  const minuteHand = useRef()
  const core = useRef()
  const halo = useRef()
  const spin = useRef(0.25)
  const unlocked = true // an optional discovery now — always awake
  const view = useStore((s) => s.view)
  const travelling = useStore((s) => s.timeTravelling)
  const goTo = useStore((s) => s.goTo)
  const showToast = useStore((s) => s.showToast)
  const reducedMotion = useStore((s) => s.reducedMotion)

  const ticks = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2
        return [Math.sin(a) * 0.36, Math.cos(a) * 0.36]
      }),
    [],
  )

  useFrame((_, delta) => {
    const target = !unlocked ? 0.05 : travelling ? 9 : view === 'timemachine' ? 1.2 : 0.35
    spin.current = THREE.MathUtils.damp(spin.current, reducedMotion ? Math.min(target, 0.3) : target, 2, delta)
    const v = spin.current * delta
    rings.current.forEach((r, i) => {
      if (!r) return
      if (i === 0) r.rotation.y += v * 1.1
      if (i === 1) r.rotation.x += v * 0.8
      if (i === 2) r.rotation.z -= v * 0.6
    })
    // the clock hands run backwards while travelling
    hourHand.current.rotation.z -= v * (travelling ? -2 : 0.15)
    minuteHand.current.rotation.z -= v * (travelling ? -12 : 1.6)
    const glow = !unlocked ? 0.25 : travelling ? 4 : 1.4
    core.current.material.emissiveIntensity = THREE.MathUtils.damp(core.current.material.emissiveIntensity, glow, 3, delta)
    halo.current.material.opacity = THREE.MathUtils.damp(halo.current.material.opacity, unlocked ? (travelling ? 0.95 : 0.45) : 0.12, 3, delta)
    const s = travelling ? 3.2 : 1.6
    halo.current.scale.setScalar(THREE.MathUtils.damp(halo.current.scale.x, s, 3, delta))
  })

  return (
    <Interactive
      label={unlocked ? timeMachine.title : `${timeMachine.title} · sleeping`}
      onSelect={() => {
        if (!unlocked) {
          showToast('The Time Machine is still asleep. Finish Chapter One to wake it ♡')
          return
        }
        audio.sparkle()
        goTo('timemachine')
      }}
      sparkleOffset={[0, 1.75, 0]}
      sparkleColor={unlocked ? '#ffe3a3' : '#8f86b8'}
      {...props}
    >
      {/* pedestal */}
      <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.42, 0.5, 0.24, 24]} />
        <meshStandardMaterial color="#5f4b98" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.25, 0]}>
        <torusGeometry args={[0.43, 0.025, 8, 40]} />
        <meshStandardMaterial color={GOLD} metalness={0.9} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.48, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.08, 0.46, 12]} />
        <meshStandardMaterial color={GOLD} metalness={0.9} roughness={0.3} />
      </mesh>

      <group position={[0, 1.08, 0]}>
        {/* gyroscope rings */}
        {[0.62, 0.54, 0.46].map((r, i) => (
          <mesh key={r} ref={(el) => (rings.current[i] = el)} rotation={[i === 1 ? Math.PI / 2 : 0.3, i * 0.6, i === 2 ? Math.PI / 2 : 0]} castShadow>
            <torusGeometry args={[r, 0.022, 10, 64]} />
            <meshStandardMaterial color={i === 1 ? '#f3d9ec' : GOLD} metalness={0.85} roughness={0.22} />
          </mesh>
        ))}

        {/* clock face */}
        <group rotation={[0, 0, 0]}>
          <mesh>
            <circleGeometry args={[0.42, 40]} />
            <meshStandardMaterial color="#fff6ea" emissive="#ffe0b8" emissiveIntensity={unlocked ? 0.35 : 0.05} side={THREE.DoubleSide} roughness={0.5} />
          </mesh>
          {ticks.map(([x, y], i) => (
            <mesh key={i} position={[x, y, 0.006]} rotation={[0, 0, -Math.atan2(x, y)]}>
              <planeGeometry args={[0.018, i % 3 === 0 ? 0.08 : 0.045]} />
              <meshBasicMaterial color="#6f5a99" side={THREE.DoubleSide} />
            </mesh>
          ))}
          <group ref={hourHand} position={[0, 0, 0.012]}>
            <mesh position={[0, 0.1, 0]}>
              <planeGeometry args={[0.03, 0.2]} />
              <meshBasicMaterial color="#45325f" side={THREE.DoubleSide} />
            </mesh>
          </group>
          <group ref={minuteHand} position={[0, 0, 0.016]}>
            <mesh position={[0, 0.15, 0]}>
              <planeGeometry args={[0.018, 0.3]} />
              <meshBasicMaterial color="#c45588" side={THREE.DoubleSide} />
            </mesh>
          </group>
          <mesh ref={core} position={[0, 0, 0.03]}>
            <sphereGeometry args={[0.05, 16, 12]} />
            <meshStandardMaterial color="#ffd9a0" emissive="#ffb86b" emissiveIntensity={1.4} />
          </mesh>
        </group>
        <Glow ref={halo} color="#ffd9a0" size={1.6} opacity={0.45} />
      </group>
      {/* tap target */}
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.7, 0.7, 1.7, 10]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>
    </Interactive>
  )
}
