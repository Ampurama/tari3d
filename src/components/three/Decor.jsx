import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSeat } from '../../lib/actions'
import { addCollider, BRIDGE, pathDistance, seeded, SPREAD, standHeight, walkable, WATER_LEVEL, ZONES } from '../../lib/terrain'
import { littleSpots } from '../../lib/layout'
import { tier } from '../../lib/device'
import { useStore } from '../../store'
import { Bench } from './Props'

/*
 * LITTLE DETAILS — the things that make each place feel like somewhere you'd want to come back to:
 * cute mushrooms in the forest, lily pads on the lake, a bench by the water and one at the
 * cliff's viewpoint, a flower arch at the entrance of the Memory Garden with stepping stones,
 * and a tiny mailbox. Low-poly, shared materials, instanced where there are many.
 */

const HIGH = tier === 'high'
const g = (x, z, lift = 0) => new THREE.Vector3(x, standHeight(x, z) + lift, z)
/** A point on the base map, spread out with the island. */
const sg = (x, z, lift = 0) => g(x * SPREAD, z * SPREAD, lift)

/** Red- and peach-capped mushrooms with white dots, tucked between the forest trees. */
function Mushrooms() {
  const stems = useRef()
  const caps = useRef()
  const items = useMemo(() => {
    const rand = seeded(616)
    const out = []
    for (let i = 0; i < 80 && out.length < (HIGH ? 14 : 8); i++) {
      const a = rand() * Math.PI * 2
      const r = 1 + rand() * (ZONES.forest.r + 0.8)
      const x = ZONES.forest.x + Math.cos(a) * r
      const z = ZONES.forest.z + Math.sin(a) * r
      if (!walkable(x, z) || pathDistance(x, z) < 0.55) continue
      out.push({ x, z, s: 0.7 + rand() * 0.7, red: rand() > 0.4 })
    }
    return out
  }, [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const c = new THREE.Color()
    items.forEach((it, i) => {
      const y = standHeight(it.x, it.z)
      m.compose(new THREE.Vector3(it.x, y + 0.07 * it.s, it.z), new THREE.Quaternion(), new THREE.Vector3(0.035, 0.07, 0.035).multiplyScalar(it.s))
      stems.current.setMatrixAt(i, m)
      m.compose(new THREE.Vector3(it.x, y + 0.15 * it.s, it.z), new THREE.Quaternion(), new THREE.Vector3(0.1, 0.06, 0.1).multiplyScalar(it.s))
      caps.current.setMatrixAt(i, m)
      caps.current.setColorAt(i, c.set(it.red ? '#ff6f61' : '#ffb98a'))
    })
    stems.current.instanceMatrix.needsUpdate = true
    caps.current.instanceMatrix.needsUpdate = true
    caps.current.instanceColor.needsUpdate = true
  }, [items])
  return (
    <group>
      <instancedMesh ref={stems} args={[null, null, items.length]} castShadow>
        <cylinderGeometry args={[0.8, 1, 2, 8]} />
        <meshStandardMaterial color="#fff6e8" roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={caps} args={[null, null, items.length]} castShadow>
        <sphereGeometry args={[1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
    </group>
  )
}

/** Lily pads (a few with tiny pink flowers) floating on Reflection Lake, bobbing very slightly. */
function LilyPads() {
  const pads = useRef()
  const reducedMotion = useStore((s) => s.reducedMotion)
  const items = useMemo(() => {
    const rand = seeded(909)
    const bottle = littleSpots[1]
    const out = []
    for (let i = 0; i < 60 && out.length < (HIGH ? 11 : 7); i++) {
      const a = rand() * Math.PI * 2
      const r = 0.9 + rand() * 1.9
      const x = ZONES.lake.x + Math.cos(a) * r
      const z = ZONES.lake.z + Math.sin(a) * r
      // keep clear of the bridge and of the bottle she has to reach
      if (Math.abs(z - BRIDGE.z) < 0.85 || (bottle && Math.hypot(x - bottle.x, z - bottle.z) < 0.9)) continue
      out.push({ x, z, s: 0.16 + rand() * 0.12, r: rand() * 6, flower: rand() > 0.6, phase: rand() * 6 })
    }
    return out
  }, [])
  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const e = useMemo(() => new THREE.Euler(), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    items.forEach((it, i) => {
      e.set(0, it.r + (reducedMotion ? 0 : Math.sin(t * 0.4 + it.phase) * 0.15), 0)
      m.compose(new THREE.Vector3(it.x, WATER_LEVEL + 0.015, it.z), q.setFromEuler(e), new THREE.Vector3(it.s, 1, it.s))
      pads.current.setMatrixAt(i, m)
    })
    pads.current.instanceMatrix.needsUpdate = true
  })
  return (
    <group>
      <instancedMesh ref={pads} args={[null, null, items.length]}>
        {/* a pad with its little notch */}
        <cylinderGeometry args={[1, 1, 0.02, 16, 1, false, 0.35, Math.PI * 2 - 0.35]} />
        <meshStandardMaterial color="#6cc46a" roughness={0.6} />
      </instancedMesh>
      {items
        .filter((it) => it.flower)
        .map((it, i) => (
          <mesh key={i} position={[it.x, WATER_LEVEL + 0.06, it.z]} scale={[0.07, 0.05, 0.07]}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color="#ffb3cf" emissive="#ff9cc4" emissiveIntensity={0.25} />
          </mesh>
        ))}
    </group>
  )
}

/** A flower-covered arch over the path into the Memory Garden. */
function GardenArch() {
  const at = useMemo(() => sg(-4.35, 2.35), [])
  useEffect(() => {
    ;[-1, 1].forEach((s) => addCollider(at.x, at.z + s * 0.78, 0.12))
  }, [at])
  const flowers = useMemo(() => {
    const rand = seeded(31)
    return Array.from({ length: 16 }, (_, i) => {
      const a = (i / 15) * Math.PI
      return { p: [0, 1.25 + Math.sin(a) * 0.78 + (rand() - 0.5) * 0.08, Math.cos(a) * 0.78], c: ['#ff9cc4', '#fff0a6', '#ffffff', '#d9c2ff'][i % 4], s: 0.07 + rand() * 0.04 }
    })
  }, [])
  return (
    <group position={at}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0.62, s * 0.78]} castShadow>
          <cylinderGeometry args={[0.05, 0.06, 1.25, 8]} />
          <meshStandardMaterial color="#f4e7d6" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 1.25, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <torusGeometry args={[0.78, 0.045, 8, 28, Math.PI]} />
        <meshStandardMaterial color="#f4e7d6" roughness={0.6} />
      </mesh>
      {/* leaves and little flowers climbing the arch */}
      {flowers.map((f, i) => (
        <mesh key={i} position={f.p} scale={f.s}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={i % 3 === 0 ? '#79cf73' : f.c} roughness={0.7} />
        </mesh>
      ))}
    </group>
  )
}

/** Flat stepping stones from the garden path to the bench. */
function SteppingStones() {
  const stones = useMemo(() => [[0.6, -0.1], [0.45, 0.3], [0.3, 0.7]].map(([x, z], i) => ({ p: g(ZONES.garden.x + 1.0 + x, ZONES.garden.z + 0.2 + z, 0.01), r: i * 0.7 })), [])
  return stones.map((s, i) => (
    <mesh key={i} position={s.p} rotation={[0, s.r, 0]} scale={[0.22, 0.03, 0.17]} receiveShadow>
      <cylinderGeometry args={[1, 1, 1, 10]} />
      <meshStandardMaterial color="#efe6d6" roughness={0.9} />
    </mesh>
  ))
}

/** A tiny pink mailbox by the garden, with its little flag up. */
function Mailbox() {
  const at = useMemo(() => sg(-4.3, 3.95), [])
  useEffect(() => addCollider(at.x, at.z, 0.14), [at])
  return (
    <group position={at} rotation={[0, 0.5, 0]}>
      <mesh position={[0, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.035, 0.7, 6]} />
        <meshStandardMaterial color="#c9a07a" />
      </mesh>
      <mesh position={[0, 0.74, 0]} castShadow>
        <boxGeometry args={[0.2, 0.16, 0.3]} />
        <meshStandardMaterial color="#ffb3cf" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.82, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.3, 12, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color="#ffb3cf" roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0.11, 0.85, 0.05]}>
        <boxGeometry args={[0.015, 0.14, 0.06]} />
        <meshStandardMaterial color="#ff6f61" />
      </mesh>
    </group>
  )
}

/** Benches where she can stop and look: by the lake, and at the viewpoint on Starfall Cliff. */
function ViewBenches() {
  const spots = useMemo(
    () => [
      // facing the water from the lake's south shore
      { p: g(ZONES.lake.x + 0.6, ZONES.lake.z + 3.3), r: Math.PI },
      // looking out over the sea of clouds from the cliff
      { p: g(ZONES.cliff.x + 1.3, ZONES.cliff.z + 1.3), r: 0.9 },
    ],
    [],
  )
  useEffect(() => spots.forEach((s) => addCollider(s.p.x, s.p.z, 0.45)), [spots])
  return spots.map((s, i) => (
    <group key={i}>
      <Bench position={s.p} rotation={[0, s.r, 0]} scale={0.85} />
      {[-0.3, 0.3].map((x, k) => (
        <BenchSeat key={k} id={`bench:${i}:${k}`} bench={s} x={x} group={`bench:${i}`} />
      ))}
    </group>
  ))
}

/** One place to sit on a view bench (she gets up to the side of it). */
function BenchSeat({ id, bench, x, group }) {
  const c = Math.cos(bench.r)
  const s = Math.sin(bench.r)
  const at = (lx, lz) => [bench.p.x + lx * c + lz * s, bench.p.z - lx * s + lz * c]
  const [wx, wz] = at(x, 0.02)
  useSeat(id, { x: wx, z: wz, y: bench.p.y + 0.41, yaw: bench.r, exit: at(Math.sign(x) * 1.05, 0.1), group, label: 'Duduk di bangku' })
  return null
}

/** The little wooden bridge across Reflection Lake (the one she walks over to reach the bottle). */
function LakeBridge() {
  const planks = useRef()
  const n = 18
  const len = BRIDGE.x1 - BRIDGE.x0
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const c = new THREE.Color()
    for (let i = 0; i < n; i++) {
      const x = BRIDGE.x0 + ((i + 0.5) / n) * len
      m.compose(new THREE.Vector3(x, BRIDGE.deck - 0.03, BRIDGE.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (i % 3) * 0.02 - 0.02, 0)), new THREE.Vector3((len / n) * 0.9, 0.06, BRIDGE.halfWidth * 2.1))
      planks.current.setMatrixAt(i, m)
      planks.current.setColorAt(i, c.set(i % 2 ? '#b98a5e' : '#a87a50'))
    }
    planks.current.instanceMatrix.needsUpdate = true
    planks.current.instanceColor.needsUpdate = true
  }, [len])
  const posts = useMemo(() => {
    const out = []
    for (let i = 0; i <= 6; i++) [-1, 1].forEach((s) => out.push([BRIDGE.x0 + (i / 6) * len, BRIDGE.z + s * (BRIDGE.halfWidth + 0.04)]))
    return out
  }, [len])
  return (
    <group>
      <instancedMesh ref={planks} args={[null, null, n]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      {posts.map(([x, z], i) => (
        <mesh key={i} position={[x, BRIDGE.deck + 0.2, z]} castShadow>
          <cylinderGeometry args={[0.04, 0.05, 0.6, 6]} />
          <meshStandardMaterial color="#8a6248" roughness={0.8} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[BRIDGE.x0 + len / 2, BRIDGE.deck + 0.46, BRIDGE.z + s * (BRIDGE.halfWidth + 0.04)]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.025, 0.025, len, 6]} />
          <meshStandardMaterial color="#c49a72" roughness={0.7} />
        </mesh>
      ))}
    </group>
  )
}

export default function Decor() {
  const view = useStore((s) => s.view)
  if (view === 'finale' || view === 'finalRoom') return null
  return (
    <group>
      <Mushrooms />
      <LilyPads />
      <GardenArch />
      <SteppingStones />
      <Mailbox />
      <ViewBenches />
      <LakeBridge />
    </group>
  )
}
