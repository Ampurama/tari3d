import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { FIELD_COLORS, flowerField, MEADOW_PATHS, meadowHeight, meadowPathDistance, POND } from '../../lib/meadow'
import { addCollider, seeded } from '../../lib/terrain'
import { tier } from '../../lib/device'
import { windMaterial } from '../../lib/wind'
import { withPaint } from '../../lib/paint'
import { atmosphere } from '../../lib/atmosphere'
import { useStore } from '../../store'
import { TreeKind } from './Vegetation'
import { Glow, LightPools } from './Bits'
import { openMeadow } from './Meadow'

/*
 * MORE OF THE MEADOW — so the land never feels empty:
 *   flower fields carpeting the ground in colour (lib/meadow.js flowerField) with thousands of blooms,
 *   small woods here and there and a line of forest on the hills at the horizon,
 *   giant dreamcore flowers, a pastel windmill, a gazebo by the pond, a ring of standing stones with
 *   a crystal that glows at night, arches of flowers over the footpaths, and a wooden fence.
 * All scenery: the solid ones get colliders, nothing else changes how she walks.
 */

const HIGH = tier === 'high'
const LIMIT_CENTRE = { x: 8, z: -12 }

/** The nearest open spot to (x, z), searching outward (for landmarks that need room). */
function findOpen(x, z, room = 2, pathRoom = 3) {
  for (let r = 0; r < 24; r += 0.8)
    for (let a = 0; a < Math.PI * 2; a += r ? 0.8 / r : 7) {
      const px = x + Math.cos(a) * r
      const pz = z + Math.sin(a) * r
      let ok = meadowPathDistance(px, pz) > pathRoom
      for (let k = 0; ok && k < 8; k++) ok = openMeadow(px + Math.cos(k * 0.785) * room, pz + Math.sin(k * 0.785) * room, { tall: true, water: 0.8 })
      if (ok && openMeadow(px, pz, { tall: true, water: 0.8 })) return { x: px, z: pz, y: meadowHeight(px, pz) }
    }
  return null
}

const paint = (g, hex) => {
  const c = new THREE.Color(hex)
  const n = g.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  g.deleteAttribute('uv')
  return g.index ? g.toNonIndexed() : g
}
const merge = (parts) => {
  parts.forEach((g) => g.deleteAttribute('normal'))
  const m = mergeGeometries(parts)
  parts.forEach((g) => g.dispose())
  m.computeVertexNormals()
  return m
}

/* ───────── the flower fields' blooms ───────── */

function FieldFlowers() {
  const ref = useRef()
  const material = useMemo(() => windMaterial({ bendFrom: -0.5, amount: 0.05, roughness: 0.55, emissive: '#ffd6ea', emissiveIntensity: 0.05 }), [])
  const items = useMemo(() => {
    const rand = seeded(8080)
    const list = []
    const max = HIGH ? 3500 : 1500
    for (let i = 0; i < max * 6 && list.length < max; i++) {
      const a = rand() * Math.PI * 2
      const r = Math.sqrt(rand()) * 84
      const x = LIMIT_CENTRE.x + Math.cos(a) * r
      const z = LIMIT_CENTRE.z + Math.sin(a) * r
      const f = flowerField(x, z)
      if (f.k <= 0 || rand() > f.k) continue
      if (!openMeadow(x, z, { water: 0.2 })) continue
      // mostly the field's own colour, now and then a different one
      const color = rand() < 0.8 ? FIELD_COLORS[f.color] : FIELD_COLORS[Math.floor(rand() * FIELD_COLORS.length)]
      list.push({ x, z, y: meadowHeight(x, z), s: 0.055 + rand() * 0.04, color, rot: rand() * 6 })
    }
    return list
  }, [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const c = new THREE.Color()
    items.forEach((f, i) => {
      m.compose(new THREE.Vector3(f.x, f.y + f.s * 1.4, f.z), q.setFromEuler(new THREE.Euler(0, f.rot, 0)), new THREE.Vector3(f.s * 1.5, f.s * 0.8, f.s * 1.5))
      ref.current.setMatrixAt(i, m)
      ref.current.setColorAt(i, c.set(f.color))
    })
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.instanceColor.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [items])
  return (
    <instancedMesh ref={ref} args={[null, material, items.length]}>
      <icosahedronGeometry args={[1, 0]} />
    </instancedMesh>
  )
}

/* ───────── woods, and the forest on the hills ───────── */

function useWoods() {
  return useMemo(() => {
    const rand = seeded(6161)
    const near = { round: [], tall: [], blossom: [] }
    const far = { round: [], tall: [], blossom: [] }
    const pick = () => (rand() < 0.25 ? 'blossom' : rand() < 0.55 ? 'tall' : 'round')
    // small woods out in the meadow (well away from the main meadow, so they frame it)
    const woods = HIGH ? 8 : 5
    for (let w = 0; w < woods; w++) {
      const a = (w / woods) * Math.PI * 2 + rand() * 0.4
      const r = 36 + rand() * 42
      const cx = LIMIT_CENTRE.x + Math.cos(a) * r
      const cz = LIMIT_CENTRE.z + Math.sin(a) * r
      const n = HIGH ? 8 + Math.floor(rand() * 7) : 5 + Math.floor(rand() * 4)
      for (let k = 0; k < n; k++) {
        const x = cx + (rand() - 0.5) * 14
        const z = cz + (rand() - 0.5) * 14
        if (!openMeadow(x, z, { tall: true, water: 1.2 }) || flowerField(x, z).k > 0.4) continue
        const s = 1.1 + rand() * 0.8
        near[pick()].push({ x, z, y: meadowHeight(x, z) - 0.05, s, r: rand() * 6 })
        addCollider(x, z, 0.28 * s)
      }
    }
    // a forest along the hills at the horizon (no shadows: it's far)
    const ring = HIGH ? 300 : 140
    for (let i = 0; i < ring; i++) {
      const a = rand() * Math.PI * 2
      const r = 96 + Math.pow(rand(), 0.7) * 110
      const x = LIMIT_CENTRE.x + Math.cos(a) * r
      const z = LIMIT_CENTRE.z + Math.sin(a) * r
      const s = 2 + rand() * 1.8
      far[pick()].push({ x, z, y: meadowHeight(x, z) - 0.1, s, r: rand() * 6 })
    }
    return { near, far }
  }, [])
}

/* ───────── giant dreamcore flowers ───────── */

function giantFlowerGeometry(variant) {
  const [petal, centre, leaf] = [
    ['#f7a9cb', '#ffe08a', '#7fc98a'],
    ['#c8b2f7', '#fff3b0', '#79c4a0'],
    ['#fbe17c', '#ff9f7a', '#86c97a'],
    ['#fdf6f0', '#ffd36e', '#7fc98a'],
  ][variant]
  const parts = []
  const stem = new THREE.CylinderGeometry(0.07, 0.11, 1, 8)
  stem.translate(0, 0.5, 0)
  parts.push(paint(stem, leaf))
  for (const side of [-1, 1]) {
    const l = new THREE.SphereGeometry(0.22, 10, 6)
    l.scale(1.6, 0.18, 0.6)
    l.rotateZ(side * 0.6)
    l.translate(side * 0.22, 0.32 + (side > 0 ? 0.1 : 0), 0)
    parts.push(paint(l, leaf))
  }
  const petals = variant === 1 ? 6 : 8
  for (let k = 0; k < petals; k++) {
    const a = (k / petals) * Math.PI * 2
    const p = new THREE.SphereGeometry(0.2, 10, 6)
    p.scale(1.3, 0.25, 0.65)
    p.rotateY(-a)
    p.rotateX(-0.25)
    p.translate(Math.cos(a) * 0.24, 1.02, Math.sin(a) * 0.24)
    parts.push(paint(p, petal))
  }
  const c = new THREE.SphereGeometry(0.13, 12, 8)
  c.scale(1, 0.6, 1)
  c.translate(0, 1.06, 0)
  parts.push(paint(c, centre))
  return merge(parts)
}

function GiantFlowers() {
  const refs = useRef([])
  const variants = useMemo(() => [0, 1, 2, 3].map(giantFlowerGeometry), [])
  const material = useMemo(() => windMaterial({ bendFrom: 0.2, amount: 0.012, vertexColors: true, roughness: 0.6, emissive: '#ffd6ea', emissiveIntensity: 0.04 }), [])
  const groups = useMemo(() => {
    const rand = seeded(4444)
    const out = [[], [], [], []]
    const n = HIGH ? 18 : 10
    for (let i = 0; i < n * 5 && out.flat().length < n; i++) {
      const a = rand() * Math.PI * 2
      const r = 22 + rand() * 58
      const x = LIMIT_CENTRE.x + Math.cos(a) * r
      const z = LIMIT_CENTRE.z + Math.sin(a) * r
      // they grow in the flower fields, a few on their own
      if (flowerField(x, z).k < 0.3 && rand() < 0.7) continue
      if (!openMeadow(x, z, { tall: true, water: 0.8 })) continue
      const h = 2.4 + rand() * 2.2
      out[Math.floor(rand() * 4)].push({ x, z, y: meadowHeight(x, z), h, r: rand() * 6, lean: (rand() - 0.5) * 0.25 })
      addCollider(x, z, 0.3)
    }
    return out
  }, [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    groups.forEach((list, v) => {
      const mesh = refs.current[v]
      if (!mesh) return
      list.forEach((f, i) => {
        m.compose(new THREE.Vector3(f.x, f.y, f.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(f.lean, f.r, f.lean * 0.5)), new THREE.Vector3(f.h * 0.9, f.h, f.h * 0.9))
        mesh.setMatrixAt(i, m)
      })
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    })
  }, [groups])
  return groups.map((list, v) =>
    list.length ? <instancedMesh key={v} ref={(el) => (refs.current[v] = el)} args={[variants[v], material, list.length]} castShadow receiveShadow /> : null,
  )
}

/* ───────── landmarks ───────── */

/** A pastel windmill on a rise, its sails turning slowly. */
function Windmill({ at }) {
  const sails = useRef()
  const reducedMotion = useStore((s) => s.reducedMotion)
  useFrame((_, delta) => {
    if (!reducedMotion) sails.current.rotation.z += delta * 0.35
  })
  useMemo(() => addCollider(at.x, at.z, 1.7), [at])
  return (
    <group position={[at.x, at.y - 0.1, at.z]} rotation={[0, 0.6, 0]}>
      <mesh position={[0, 2.4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.05, 1.5, 4.8, 12]} />
        <meshStandardMaterial color="#fbf1e6" roughness={0.8} />
      </mesh>
      <mesh position={[0, 5.4, 0]} castShadow>
        <coneGeometry args={[1.35, 1.6, 12]} />
        <meshStandardMaterial color="#f2a7c4" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.7, 1.34]}>
        <boxGeometry args={[0.7, 1.3, 0.12]} />
        <meshStandardMaterial color="#b98d6e" roughness={0.8} />
      </mesh>
      {[2.6, 3.8].map((y) => (
        <mesh key={y} position={[0, y, 1.18]}>
          <circleGeometry args={[0.26, 16]} />
          <meshStandardMaterial color="#ffe9b0" emissive="#ffcf7a" emissiveIntensity={0.4} />
        </mesh>
      ))}
      <group ref={sails} position={[0, 4.4, 1.25]}>
        <mesh>
          <cylinderGeometry args={[0.16, 0.16, 0.3, 10]} />
          <meshStandardMaterial color="#b98d6e" />
        </mesh>
        {[0, 1, 2, 3].map((k) => (
          <group key={k} rotation={[0, 0, (k * Math.PI) / 2]}>
            <mesh position={[0, 1.55, 0.05]} castShadow>
              <boxGeometry args={[0.62, 2.7, 0.04]} />
              <meshStandardMaterial color={k % 2 ? '#fff6ee' : '#ffd9e8'} roughness={0.8} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}

/** A white gazebo by the pond, with a lavender roof and a lantern hanging inside. */
function Gazebo({ at }) {
  useMemo(() => addCollider(at.x, at.z, 1.9), [at])
  const posts = Array.from({ length: 6 }, (_, k) => (k / 6) * Math.PI * 2)
  return (
    <group position={[at.x, at.y, at.z]}>
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <cylinderGeometry args={[1.9, 2.0, 0.18, 6]} />
        <meshStandardMaterial color="#efe4dc" roughness={0.8} />
      </mesh>
      {posts.map((a) => (
        <mesh key={a} position={[Math.cos(a) * 1.65, 1.25, Math.sin(a) * 1.65]} castShadow>
          <cylinderGeometry args={[0.07, 0.08, 2.2, 8]} />
          <meshStandardMaterial color="#fffaf4" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 2.75, 0]} castShadow>
        <coneGeometry args={[2.25, 1.3, 6]} />
        <meshStandardMaterial color="#c9b2f2" roughness={0.7} />
      </mesh>
      <mesh position={[0, 3.5, 0]}>
        <sphereGeometry args={[0.12, 10, 8]} />
        <meshStandardMaterial color="#ffd36e" emissive="#ffc04d" emissiveIntensity={0.6} />
      </mesh>
      <Glow position={[0, 2.0, 0]} color="#ffd9a0" size={1.4} opacity={0.6} />
    </group>
  )
}

/** A ring of standing stones with a crystal in the middle that glows as night falls. */
function StoneCircle({ at }) {
  const crystal = useRef()
  const halo = useRef()
  const stones = useMemo(() => {
    const rand = seeded(9191)
    return Array.from({ length: 9 }, (_, k) => {
      const a = (k / 9) * Math.PI * 2
      const x = at.x + Math.cos(a) * 4
      const z = at.z + Math.sin(a) * 4
      addCollider(x, z, 0.45)
      return { x, z, y: meadowHeight(x, z), h: 1.4 + rand() * 0.9, r: rand() * 6 }
    })
  }, [at])
  useMemo(() => addCollider(at.x, at.z, 0.6), [at])
  useFrame(({ clock }) => {
    const night = Math.max(1 - atmosphere.day, atmosphere.sunset * 0.4)
    crystal.current.material.emissiveIntensity = 0.3 + night * 1.6
    halo.current.material.opacity = 0.15 + night * 0.55
    crystal.current.rotation.y = clock.elapsedTime * 0.3
  })
  return (
    <group>
      {stones.map((s, i) => (
        <mesh key={i} position={[s.x, s.y + s.h * 0.45, s.z]} rotation={[0, s.r, 0]} scale={[0.5, s.h, 0.38]} castShadow receiveShadow>
          <dodecahedronGeometry args={[0.7, 0]} />
          <meshStandardMaterial color="#cfc6dc" roughness={0.85} flatShading />
        </mesh>
      ))}
      <mesh ref={crystal} position={[at.x, at.y + 1.2, at.z]} scale={[0.35, 0.9, 0.35]} castShadow>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#e6d8ff" emissive="#b892ff" emissiveIntensity={0.4} roughness={0.2} />
      </mesh>
      <Glow ref={halo} position={[at.x, at.y + 1.2, at.z]} color="#c9a8ff" size={4} opacity={0.2} />
      <LightPools points={[{ x: at.x, y: at.y, z: at.z }]} size={7} color="#c9a8ff" strength={0.6} />
    </group>
  )
}

/** Arches covered in flowers, standing over the footpaths. */
function FlowerArches() {
  const arches = useMemo(() => {
    const out = []
    // over the path to the pond and the path east toward Chapter 2's hills
    for (const [p, i, t] of [
      [0, 1, 0.5],
      [2, 2, 0.5],
      [4, 0, 0.6],
    ]) {
      const [ax, az] = MEADOW_PATHS[p][i]
      const [bx, bz] = MEADOW_PATHS[p][i + 1]
      const x = ax + (bx - ax) * t
      const z = az + (bz - az) * t
      const yaw = Math.atan2(bx - ax, bz - az)
      const side = [Math.cos(yaw), -Math.sin(yaw)]
      for (const s of [-1, 1]) addCollider(x + side[0] * 0.9 * s, z + side[1] * 0.9 * s, 0.18)
      out.push({ x, z, y: meadowHeight(x, z), yaw })
    }
    return out
  }, [])
  const blooms = useMemo(() => {
    const rand = seeded(1212)
    return Array.from({ length: 26 }, (_, k) => {
      const a = (k / 25) * Math.PI
      return { p: [Math.cos(a) * 0.9, 1.5 + Math.sin(a) * 0.9, (rand() - 0.5) * 0.12], c: ['#ffb3d1', '#ffffff', '#d9c2ff', '#ffe08a'][k % 4], s: 0.1 + rand() * 0.06 }
    })
  }, [])
  return arches.map((a, i) => (
    <group key={i} position={[a.x, a.y, a.z]} rotation={[0, a.yaw, 0]}>
      {[-0.9, 0.9].map((x) => (
        <mesh key={x} position={[x, 0.75, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.06, 1.5, 8]} />
          <meshStandardMaterial color="#fffaf4" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 1.5, 0]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.9, 0.05, 8, 24, Math.PI]} />
        <meshStandardMaterial color="#fffaf4" roughness={0.6} />
      </mesh>
      {blooms.map((b, k) => (
        <mesh key={k} position={b.p} scale={b.s}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={b.c} roughness={0.6} emissive={b.c} emissiveIntensity={0.08} />
        </mesh>
      ))}
    </group>
  ))
}

/** A low wooden fence along the path down to the pond. */
function Fence() {
  const posts = useRef()
  const rails = useRef()
  const { postList, railList } = useMemo(() => {
    const postList = []
    const railList = []
    const path = MEADOW_PATHS[0]
    for (let i = 0; i < path.length - 1; i++) {
      const [ax, az] = path[i]
      const [bx, bz] = path[i + 1]
      const l = Math.hypot(bx - ax, bz - az)
      const nx = -(bz - az) / l
      const nz = (bx - ax) / l
      for (let d = 0.5; d < l; d += 2) {
        const x = ax + ((bx - ax) * d) / l + nx * 1.5
        const z = az + ((bz - az) * d) / l + nz * 1.5
        postList.push({ x, z, y: meadowHeight(x, z) })
        addCollider(x, z, 0.15)
      }
    }
    for (let i = 0; i < postList.length - 1; i++) {
      const a = postList[i]
      const b = postList[i + 1]
      const l = Math.hypot(b.x - a.x, b.z - a.z)
      if (l > 2.6) continue
      for (const h of [0.35, 0.65]) railList.push({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, y: (a.y + b.y) / 2 + h, l, yaw: Math.atan2(b.x - a.x, b.z - a.z) })
    }
    return { postList, railList }
  }, [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    postList.forEach((p, i) => {
      m.compose(new THREE.Vector3(p.x, p.y + 0.4, p.z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1))
      posts.current.setMatrixAt(i, m)
    })
    railList.forEach((r, i) => {
      m.compose(new THREE.Vector3(r.x, r.y, r.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r.yaw, 0)), new THREE.Vector3(1, 1, r.l))
      rails.current.setMatrixAt(i, m)
    })
    posts.current.instanceMatrix.needsUpdate = true
    rails.current.instanceMatrix.needsUpdate = true
    posts.current.computeBoundingSphere()
    rails.current.computeBoundingSphere()
  }, [postList, railList])
  const wood = useMemo(() => withPaint(new THREE.MeshStandardMaterial({ color: '#c9a07c', roughness: 0.85 }), 'rock'), [])
  return (
    <group>
      <instancedMesh ref={posts} args={[null, wood, postList.length]} castShadow>
        <boxGeometry args={[0.1, 0.8, 0.1]} />
      </instancedMesh>
      <instancedMesh ref={rails} args={[null, wood, railList.length]} castShadow>
        <boxGeometry args={[0.05, 0.06, 1]} />
      </instancedMesh>
    </group>
  )
}

/** Everything that fills the meadow out. */
export default function MeadowExtras() {
  const woods = useWoods()
  const spots = useMemo(
    () => ({
      windmill: findOpen(-30, 26, 2.5),
      gazebo: findOpen(POND.x + POND.r + 4, POND.z + 3, 2.2),
      stones: findOpen(46, 10, 4.6),
    }),
    [],
  )
  return (
    <group>
      <FieldFlowers />
      {['round', 'tall', 'blossom'].map((k) => (
        <TreeKind key={'n' + k} kind={k} items={woods.near[k]} />
      ))}
      {['round', 'tall', 'blossom'].map((k) => (
        <TreeKind key={'f' + k} kind={k} items={woods.far[k]} shadows={false} />
      ))}
      <GiantFlowers />
      {spots.windmill && <Windmill at={spots.windmill} />}
      {spots.gazebo && <Gazebo at={spots.gazebo} />}
      {spots.stones && <StoneCircle at={spots.stones} />}
      <FlowerArches />
      <Fence />
    </group>
  )
}
