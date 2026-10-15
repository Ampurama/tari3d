import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { grassGeometry, heightAt, ISLAND_RADIUS, rockGeometry, seeded } from '../../lib/island'
import { count } from '../../lib/device'
import { useStore } from '../../store'
import { Glow } from './Bits'

/** The floating landmass itself: meadow on top, layered warm earth beneath. */
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
            <meshStandardMaterial color={c.color} emissive={c.color} emissiveIntensity={0.5} roughness={0.2} />
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
