import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { grassGeometry, heightAt, ISLAND_RADIUS, rockGeometry, seeded } from '../../lib/island'
import { paths, spots } from '../../lib/layout'
import { count } from '../../lib/device'
import { useStore } from '../../store'
import { Glow } from './Bits'

/** The floating landmass itself: meadow on top, faceted lavender rock beneath. */
export function IslandBody({ radius = ISLAND_RADIUS, seed = 1, crystals = true }) {
  const grass = useMemo(() => grassGeometry({ radius, seed, segments: radius > 3 ? 96 : 48 }), [radius, seed])
  const rock = useMemo(() => rockGeometry({ radius, seed, segments: radius > 3 ? 40 : 24 }), [radius, seed])
  const crystalData = useMemo(() => {
    if (!crystals) return []
    const rand = seeded(seed * 31)
    return Array.from({ length: 7 }, (_, i) => {
      const a = (i / 7) * Math.PI * 2 + rand()
      const r = radius * (0.25 + rand() * 0.35)
      return {
        position: [Math.cos(a) * r, -radius * (0.62 + rand() * 0.35), Math.sin(a) * r],
        scale: radius * (0.04 + rand() * 0.05),
        color: i % 2 ? '#c9a8ff' : '#ffb3d6',
      }
    })
  }, [crystals, radius, seed])

  return (
    <group>
      <mesh geometry={grass} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.92} metalness={0} />
      </mesh>
      <mesh geometry={rock} castShadow>
        <meshStandardMaterial vertexColors roughness={0.75} metalness={0.05} flatShading />
      </mesh>
      {crystalData.map((c, i) => (
        <group key={i} position={c.position}>
          <mesh scale={[c.scale, c.scale * 2.4, c.scale]}>
            <octahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color={c.color} emissive={c.color} emissiveIntensity={1.6} roughness={0.2} />
          </mesh>
          <Glow color={c.color} size={c.scale * 9} opacity={0.5} />
        </group>
      ))}
    </group>
  )
}

const FLOWER_COLORS = ['#ffd1e3', '#ffffff', '#e2d4ff', '#ffb3cf', '#fff1c9', '#f6a8c8']

/** Hundreds of little blooms as two instanced meshes (petal puffs + golden centres). */
export function Flowers({ radius = ISLAND_RADIUS, amount = count(420, 200), seed = 5, avoid = [] }) {
  const petals = useRef()
  const centres = useRef()
  const data = useMemo(() => {
    const rand = seeded(seed)
    const list = []
    let guard = 0
    while (list.length < amount && guard++ < amount * 20) {
      // cluster flowers toward the edges, where they frame the meadow
      const a = rand() * Math.PI * 2
      const r = radius * (0.2 + Math.pow(rand(), 0.55) * 0.74)
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      if (avoid.some(([ax, az, ar]) => (x - ax) ** 2 + (z - az) ** 2 < ar * ar)) continue
      list.push({ x, z, y: heightAt(x, z, radius), s: 0.028 + rand() * 0.034, c: FLOWER_COLORS[Math.floor(rand() * FLOWER_COLORS.length)], rot: rand() * Math.PI })
    }
    return list
  }, [radius, amount, seed, avoid])

  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const color = new THREE.Color()
    data.forEach((f, i) => {
      q.setFromEuler(new THREE.Euler(0, f.rot, 0))
      m.compose(new THREE.Vector3(f.x, f.y + f.s * 0.7, f.z), q, new THREE.Vector3(f.s * 1.6, f.s * 0.7, f.s * 1.6))
      petals.current.setMatrixAt(i, m)
      petals.current.setColorAt(i, color.set(f.c))
      m.compose(new THREE.Vector3(f.x, f.y + f.s * 1.1, f.z), q, new THREE.Vector3(f.s * 0.5, f.s * 0.4, f.s * 0.5))
      centres.current.setMatrixAt(i, m)
    })
    petals.current.instanceMatrix.needsUpdate = true
    if (petals.current.instanceColor) petals.current.instanceColor.needsUpdate = true
    centres.current.instanceMatrix.needsUpdate = true
  }, [data])

  return (
    <group>
      <instancedMesh ref={petals} args={[null, null, data.length]} castShadow={false}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={0.55} emissive="#ff9cc6" emissiveIntensity={0.08} />
      </instancedMesh>
      <instancedMesh ref={centres} args={[null, null, data.length]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#ffd36e" emissive="#ffc04d" emissiveIntensity={0.9} />
      </instancedMesh>
    </group>
  )
}

/** Glowing stepping stones following the paths across the meadow. */
export function GlowPaths() {
  const ref = useRef()
  const letterRead = useStore((s) => s.letterRead)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const stones = useMemo(() => {
    const list = []
    paths.forEach((pts, pathIndex) => {
      const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)))
      const n = Math.round(curve.getLength() / 0.48)
      for (let i = 0; i <= n; i++) {
        const p = curve.getPointAt(i / n)
        list.push({ x: p.x, z: p.z, y: heightAt(p.x, p.z) + 0.015, path: pathIndex, t: i / n, s: 0.085 + ((i * 7) % 5) * 0.01 })
      }
    })
    return list
  }, [])

  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    stones.forEach((s, i) => {
      m.compose(
        new THREE.Vector3(s.x, s.y, s.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, i * 1.7, 0)),
        new THREE.Vector3(s.s * 1.25, 0.03, s.s),
      )
      ref.current.setMatrixAt(i, m)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [stones])

  // a slow wave of light travelling along the stones; stronger once the secret is unlocked
  const color = useMemo(() => new THREE.Color(), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    stones.forEach((s, i) => {
      const wave = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(s.t * 9 - t * 1.6 + s.path)
      const base = s.path === 0 && letterRead ? 1.35 : 1
      color.setRGB(1.25 * base, (0.86 + 0.2 * wave) * base, (0.62 + 0.3 * wave) * base)
      color.multiplyScalar(0.6 + 0.45 * wave)
      ref.current.setColorAt(i, color)
    })
    ref.current.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[null, null, stones.length]} receiveShadow>
      <cylinderGeometry args={[1, 1, 1, 14]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}

/** Small rocks orbiting the island lazily. */
export function FloatingRocks({ amount = 7 }) {
  const ref = useRef()
  const reducedMotion = useStore((s) => s.reducedMotion)
  const rocks = useMemo(() => {
    const rand = seeded(77)
    return Array.from({ length: amount }, (_, i) => ({
      a: (i / amount) * Math.PI * 2,
      r: 7.6 + rand() * 2.5,
      y: -1.5 + rand() * 3,
      s: 0.18 + rand() * 0.35,
    }))
  }, [amount])
  useFrame((_, delta) => {
    if (!reducedMotion) ref.current.rotation.y += delta * 0.02
  })
  return (
    <group ref={ref}>
      {rocks.map((r, i) => (
        <group key={i} position={[Math.cos(r.a) * r.r, r.y, Math.sin(r.a) * r.r]}>
          <mesh scale={r.s} rotation={[i, i * 2, 0]} castShadow>
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#a690d6" roughness={0.7} flatShading />
          </mesh>
          <mesh scale={[r.s * 1.05, r.s * 0.35, r.s * 1.05]} position={[0, r.s * 0.55, 0]}>
            <sphereGeometry args={[1, 12, 8]} />
            <meshStandardMaterial color="#b9dcc6" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// keep flowers off the paths and props
export const mainIslandAvoid = [
  [spots.tree.x, spots.tree.z, 0.75],
  [spots.bench.x, spots.bench.z, 0.95],
  [spots.table.x, spots.table.z, 0.85],
  [spots.telescope.x, spots.telescope.z, 0.75],
  [spots.arch.x, spots.arch.z, 1.0],
  ...paths.flatMap((pts) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)))
    return curve.getSpacedPoints(Math.ceil(curve.getLength() / 0.35)).map((p) => [p.x, p.z, 0.36])
  }),
]
