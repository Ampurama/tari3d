import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { EMOTES } from '../../lib/actions'
import { HeartMesh } from './Bits'

/**
 * What floats over a character during a gesture: a glowing heart that rises and fades,
 * or a little bubble (👋 📣 ✨ 📸). `get()` returns the current gesture { kind, t0 } or null.
 */
export default function EmoteFx({ get }) {
  const heart = useRef()
  const [kind, setKind] = useState(null)
  useFrame(() => {
    const e = get()
    const now = e ? e.kind : null
    if (now !== kind) setKind(now)
    if (heart.current) {
      const et = e ? performance.now() / 1000 - e.t0 : 0
      heart.current.position.y = 1.55 + et * 0.35
      heart.current.scale.setScalar(Math.min(0.16, et * 0.6) * Math.max(0, 1 - et / 2.6))
      heart.current.rotation.y = et * 2
    }
  })
  if (!kind) return null
  if (kind === 'heart') return <HeartMesh ref={heart} position={[0, 1.55, 0]} scale={0.01} color="#ff9cc8" emissive="#ff5fa2" glow={1.4} />
  return (
    <Html position={[0, 1.6, 0]} center zIndexRange={[14, 0]} className="mochi-anchor">
      <span className="emote-bubble">{EMOTES[kind]?.icon}</span>
    </Html>
  )
}
