import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ZONES, standHeight } from '../../lib/terrain'
import { seeded } from '../../lib/island'
import { tier } from '../../lib/device'
import { useStore } from '../../store'
import { DriftParticles } from './Particles'
import { atmosphere } from '../../lib/atmosphere'

/*
 * LITTLE LIVES — butterflies over the flowers, a few bees, birds far away, leaves falling in the
 * forest. Each kind is one instanced mesh updated once per frame, so dozens of wings cost about
 * as much as a single object. Nothing here can be interacted with; it just makes the island breathe.
 */

const HIGH = tier === 'high'
const tmp = new THREE.Object3D()
const col = new THREE.Color()

/** Wing geometry: a flattened, rounded petal shape, hinged at the body. */
const wingGeometry = (() => {
  const g = new THREE.SphereGeometry(1, 10, 6)
  g.scale(1, 0.08, 0.75)
  g.translate(1, 0, 0)
  return g
})()

const ISLAND_HOMES = [ZONES.meadow, ZONES.meadow, ZONES.garden, ZONES.garden, ZONES.cliff, ZONES.cove, ZONES.lake, ZONES.gallery]

/**
 * Colourful butterflies looping lazily around flowers (by default the island's meadow, garden and
 * cliff). They're off to sleep at night.
 */
export function Butterflies({ homes = ISLAND_HOMES, amount = HIGH ? 12 : 7, seed = 404 }) {
  const wings = useRef()
  const reducedMotion = useStore((s) => s.reducedMotion)
  const list = useMemo(() => {
    const rand = seeded(seed)
    const colors = ['#ff9cc4', '#fff0a6', '#d9c2ff', '#ffb59e', '#ffffff', '#a8d8ff', '#ffd1e3', '#c9f2a0']
    return Array.from({ length: amount }, (_, i) => {
      const h = homes[i % homes.length]
      return { cx: h.x + (rand() - 0.5) * 3, cz: h.z + (rand() - 0.5) * 3, r: 0.8 + rand() * 1.6, speed: 0.25 + rand() * 0.25, phase: rand() * 10, flap: 14 + rand() * 6, color: colors[i % colors.length], size: 0.06 + rand() * 0.03 }
    })
  }, [homes, amount, seed])
  const material = useMemo(() => new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const w = wings.current
    w.visible = atmosphere.day > 0.45
    if (!w.visible) return
    list.forEach((b, i) => {
      const u = t * b.speed + b.phase
      const x = b.cx + Math.sin(u) * b.r
      const z = b.cz + Math.sin(u * 0.7 + 1.3) * b.r * 0.8
      const y = standHeight(b.cx, b.cz) + 0.6 + Math.sin(u * 2.3) * 0.25 + Math.abs(Math.sin(t * 3 + i)) * 0.05
      const heading = Math.atan2(Math.cos(u) * b.r, Math.cos(u * 0.7 + 1.3) * b.r * 0.56)
      const flap = reducedMotion ? 0.6 : 0.25 + Math.abs(Math.sin(t * b.flap)) * 1.1
      for (let side = 0; side < 2; side++) {
        tmp.position.set(x, y, z)
        tmp.rotation.set(0, heading + (side ? Math.PI : 0), side ? -flap : flap, 'YXZ')
        tmp.scale.setScalar(b.size)
        tmp.updateMatrix()
        w.setMatrixAt(i * 2 + side, tmp.matrix)
      }
    })
    w.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh
      ref={(el) => {
        wings.current = el
        if (el && !el.instanceColor) list.forEach((b, i) => [0, 1].forEach((s) => el.setColorAt(i * 2 + s, col.set(b.color))))
      }}
      args={[wingGeometry, material, list.length * 2]}
      frustumCulled={false}
    />
  )
}

/** A few bees buzzing from flower to flower in the garden and the meadow. */
function Bees() {
  const bodies = useRef()
  const wings = useRef()
  const reducedMotion = useStore((s) => s.reducedMotion)
  const list = useMemo(() => {
    const rand = seeded(77)
    return Array.from({ length: HIGH ? 4 : 2 }, (_, i) => {
      const h = i % 2 ? ZONES.garden : ZONES.meadow
      return { cx: h.x, cz: h.z, phase: rand() * 20, hop: 2.5 + rand() * 2 }
    })
  }, [])
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffd24d', roughness: 0.6 }), [])
  const wingMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    list.forEach((b, i) => {
      // hover over one flower, then dart to the next
      const step = Math.floor((t + b.phase) / b.hop)
      const k = ((t + b.phase) % b.hop) / b.hop
      const spot = (n) => {
        const a = n * 2.39996 + i
        const r = 0.6 + ((n * 7) % 5) * 0.45
        return [b.cx + Math.cos(a) * r, b.cz + Math.sin(a) * r]
      }
      const [ax, az] = spot(step)
      const [bx, bz] = spot(step + 1)
      const move = THREE.MathUtils.smoothstep(k, 0.75, 1)
      const x = THREE.MathUtils.lerp(ax, bx, move)
      const z = THREE.MathUtils.lerp(az, bz, move)
      const y = standHeight(x, z) + 0.35 + Math.sin(t * 9 + i) * 0.03 + move * (1 - move) * 0.6
      tmp.position.set(x, y, z)
      tmp.rotation.set(0, Math.atan2(bx - ax, bz - az), 0)
      tmp.scale.set(0.035, 0.03, 0.05)
      tmp.updateMatrix()
      bodies.current.setMatrixAt(i, tmp.matrix)
      for (let side = 0; side < 2; side++) {
        tmp.position.set(x, y + 0.03, z)
        tmp.rotation.set(0, Math.atan2(bx - ax, bz - az) + (side ? Math.PI : 0), (side ? -1 : 1) * (reducedMotion ? 0.4 : 0.3 + Math.abs(Math.sin(t * 40)) * 0.8), 'YXZ')
        tmp.scale.setScalar(0.035)
        tmp.updateMatrix()
        wings.current.setMatrixAt(i * 2 + side, tmp.matrix)
      }
    })
    bodies.current.instanceMatrix.needsUpdate = true
    wings.current.instanceMatrix.needsUpdate = true
  })
  return (
    <group>
      <instancedMesh ref={bodies} args={[null, bodyMat, list.length]} frustumCulled={false}>
        <sphereGeometry args={[1, 10, 8]} />
      </instancedMesh>
      <instancedMesh ref={wings} args={[wingGeometry, wingMat, list.length * 2]} frustumCulled={false} />
    </group>
  )
}

/** Small birds gliding in a slow circle far off in the sky. */
function Birds() {
  const wings = useRef()
  const reducedMotion = useStore((s) => s.reducedMotion)
  const list = useMemo(() => [0, 1, 2, 3].slice(0, HIGH ? 4 : 3).map((i) => ({ offset: i * 0.08, lag: i * 1.6, side: i % 2 ? 1 : -1 })), [])
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: '#6b7fa8', side: THREE.DoubleSide }), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    list.forEach((b, i) => {
      const a = t * 0.05 + b.offset
      const r = 34 + i * 1.2
      const x = Math.cos(a) * r + b.side * i * 0.6
      const z = Math.sin(a) * r
      const y = 13 + Math.sin(t * 0.4 + b.lag) * 1.2 + i * 0.5
      const heading = Math.atan2(-Math.sin(a), Math.cos(a))
      const flap = reducedMotion ? 0.3 : Math.sin(t * 5 + b.lag) * 0.6
      for (let side = 0; side < 2; side++) {
        tmp.position.set(x, y, z)
        tmp.rotation.set(0, heading + (side ? Math.PI : 0), side ? -flap : flap, 'YXZ')
        tmp.scale.set(0.45, 0.45, 0.18)
        tmp.updateMatrix()
        wings.current.setMatrixAt(i * 2 + side, tmp.matrix)
      }
    })
    wings.current.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={wings} args={[wingGeometry, material, list.length * 2]} frustumCulled={false} />
}

/** All the island's little lives (only while she's on the island). */
export default function Wildlife() {
  const view = useStore((s) => s.view)
  const phase = useStore((s) => s.phase)
  if (phase !== 'world' || ['finale', 'finalRoom', 'constellation', 'distance'].includes(view)) return null
  return (
    <group>
      <Butterflies />
      <Bees />
      <Birds />
      {/* leaves drifting down in the forest */}
      <DriftParticles
        position={[ZONES.forest.x, 2.2, ZONES.forest.z]}
        count={HIGH ? 18 : 9}
        area={[7, 4, 7]}
        size={0.13}
        speed={0.22}
        direction={-1}
        texture="petal"
        colors={['#8fd47a', '#c9e07a', '#f4b46a']}
        intensity={0.8}
        seed={203}
      />
    </group>
  )
}
