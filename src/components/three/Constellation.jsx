import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line, useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { areas, starPositions } from '../../lib/layout'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'
import { Glow } from './Bits'
import HiddenHearts from './HiddenHearts'

function Star({ index, position }) {
  const core = useRef()
  const halo = useRef()
  const [hovered, setHovered] = useState(false)
  const lit = useStore((s) => s.starsFound.includes(index))
  const active = useStore((s) => s.activeStar === index)
  const view = useStore((s) => s.view)
  const goTo = useStore((s) => s.goTo)
  const lightStar = useStore((s) => s.lightStar)
  const reducedMotion = useStore((s) => s.reducedMotion)
  useCursor(hovered)

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime + index * 1.1
    const twinkle = reducedMotion ? 1 : 0.85 + 0.15 * Math.sin(t * 2.2)
    const size = (active ? 2.6 : lit ? 1.9 : 1.1) * (hovered ? 1.25 : 1) * twinkle
    const s = THREE.MathUtils.damp(halo.current.scale.x, size, 4, delta)
    halo.current.scale.set(s, s, 1)
    halo.current.material.opacity = THREE.MathUtils.damp(halo.current.material.opacity, lit ? 0.95 : 0.5, 3, delta)
    core.current.scale.setScalar(THREE.MathUtils.damp(core.current.scale.x, lit ? 1.4 : 0.8, 4, delta))
  })

  const select = (e) => {
    if (view === 'cutscene') return
    e.stopPropagation()
    if (e.delta > 8) return
    audio.sparkle()
    if (view !== 'constellation') goTo('constellation')
    else lightStar(index)
  }

  return (
    <group
      position={position}
      onClick={select}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
    >
      <mesh ref={core}>
        <sphereGeometry args={[0.13, 12, 10]} />
        <meshBasicMaterial color={lit ? [3, 2, 2.6] : [1.6, 1.5, 1.9]} toneMapped={false} />
      </mesh>
      <Glow ref={halo} color={lit ? '#ffb3d6' : '#d9ccff'} size={1.1} opacity={0.5} />
      <mesh>
        <sphereGeometry args={[0.85, 10, 8]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

function Segment({ a, b, visible }) {
  const ref = useRef()
  useFrame((_, delta) => {
    const m = ref.current?.material
    if (!m) return
    m.opacity = THREE.MathUtils.damp(m.opacity, visible ? 0.85 : 0, 2.5, delta)
    ref.current.visible = m.opacity > 0.01
  })
  return <Line ref={ref} points={[a, b]} color="#ffc9e3" lineWidth={2} transparent opacity={0} toneMapped={false} />
}

/** OUR CONSTELLATION — stars on a heart outline; light them all to complete the heart. */
export default function Constellation() {
  const view = useStore((s) => s.view)
  const starsFound = useStore((s) => s.starsFound)
  const heartGlow = useRef()
  const n = starPositions.length
  const complete = n > 0 && starsFound.length >= n

  useFrame(({ clock }, delta) => {
    const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 1.6)
    heartGlow.current.material.opacity = THREE.MathUtils.damp(
      heartGlow.current.material.opacity,
      complete ? 0.25 + 0.15 * pulse : 0,
      2,
      delta,
    )
  })

  if (!n) return null
  return (
    <group position={areas.constellation} visible={view !== 'finale' && view !== 'finalRoom'}>
      {starPositions.map((p, i) => {
        const j = (i + 1) % n
        return <Segment key={`s${i}`} a={p} b={starPositions[j]} visible={starsFound.includes(i) && starsFound.includes(j)} />
      })}
      {starPositions.map((p, i) => (
        <Star key={i} index={i} position={p} />
      ))}
      <Glow ref={heartGlow} position={[0, -0.6, -0.5]} color="#ff8fc4" size={16} opacity={0} />
      <HiddenHearts group="constellation" />
    </group>
  )
}
