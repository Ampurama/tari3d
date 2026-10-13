import { useState } from 'react'
import { useCursor } from '@react-three/drei'
import { useStore } from '../../store'
import { approach } from '../../lib/interactions'

/**
 * Wraps a 3D object so tapping it walks the avatar over and interacts (or interacts right away
 * when she's already close). Works with mouse and touch; drags never trigger it.
 */
export default function Tappable({ id, children, ...props }) {
  const [hovered, setHovered] = useState(false)
  const view = useStore((s) => s.view)
  const live = view === 'explore'
  useCursor(hovered && live)
  return (
    <group
      {...props}
      onClick={(e) => {
        if (!live) return
        e.stopPropagation()
        if (e.delta > 8) return
        approach(id)
      }}
      onPointerOver={(e) => {
        if (!live) return
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
    >
      {children}
    </group>
  )
}
