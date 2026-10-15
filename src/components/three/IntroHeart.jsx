import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { areas } from '../../lib/layout'
import { useStore } from '../../store'
import { Glow, HeartMesh } from './Bits'
import { DriftParticles } from './Particles'

/** The glowing heart that greets her before the journey starts. */
export default function IntroHeart() {
  const root = useRef()
  const heart = useRef()
  const halo = useRef()
  const startedAt = useRef(null)
  const phase = useStore((s) => s.phase)
  const view = useStore((s) => s.view)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const showing = phase === 'intro' && view === 'intro'

  useFrame(({ clock }, delta) => {
    const now = clock.elapsedTime
    if (phase === 'intro' && startedAt.current === null) startedAt.current = now
    const since = startedAt.current === null ? 0 : now - startedAt.current
    const appear = showing && since > (reducedMotion ? 0 : 1.6)
    const target = appear ? 1 : 0
    const s = THREE.MathUtils.damp(root.current.scale.x, target, appear ? 1.6 : 3.5, delta)
    root.current.scale.setScalar(Math.max(s, 0.0001))
    root.current.visible = s > 0.002

    if (!root.current.visible) return
    const p = useStore.getState().pointer
    const beat = reducedMotion ? 0 : Math.max(0, Math.sin(now * 2.6)) ** 6 * 0.06
    // a gentle sway, never a full spin: seen edge-on the heart would turn into a pink pill
    heart.current.rotation.y = reducedMotion ? p.x * 0.3 : Math.sin(now * 0.5) * 0.5 + p.x * 0.35
    heart.current.rotation.x = THREE.MathUtils.damp(heart.current.rotation.x, -p.y * 0.25, 3, delta)
    heart.current.scale.setScalar(1 + beat)
    halo.current.material.opacity = 0.45 + beat * 4
  })

  return (
    <group position={areas.intro}>
      <group ref={root} scale={0.0001}>
        <group ref={heart}>
          <HeartMesh color="#ff9cc8" emissive="#ff4f9a" glow={0.9} scale={1.05} />
        </group>
        <Glow ref={halo} color="#ff8cc2" size={7} opacity={0.45} />
        <Glow color="#b892ff" size={13} opacity={0.22} />
        <pointLight position={[2, 2, 4]} intensity={30} color="#ffd6ea" distance={14} />
        <pointLight position={[-3, -1, 3]} intensity={18} color="#b892ff" distance={14} />
      </group>
      {showing && (
        <DriftParticles count={50} area={[10, 7, 6]} size={0.13} speed={0.18} intensity={1.4} seed={5} />
      )}
    </group>
  )
}
