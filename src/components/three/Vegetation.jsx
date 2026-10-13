import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { addCollider, edgeRadius, isWater, pathDistance, seeded, slope, WATER_LEVEL, worldHeight, zoneDistance, ZONES } from '../../lib/terrain'
import { littleSpots, loveTree, noteSpots, plotSpots, seedSpots, spots } from '../../lib/layout'
import { tier } from '../../lib/device'
import { wind, windMaterial } from '../../lib/wind'
import { useStore } from '../../store'
import { Fireflies } from './Particles'

const HIGH = tier === 'high'

/* ───────── shared helpers ───────── */

/** Give a geometry a flat vertex colour and make it mergeable (non-indexed, no uv). */
function tint(geo, color, matrix) {
  let g = geo.index ? geo.toNonIndexed() : geo
  if (matrix) g.applyMatrix4(matrix)
  g.deleteAttribute('uv')
  const c = new THREE.Color(color)
  const arr = new Float32Array(g.attributes.position.count * 3)
  for (let i = 0; i < arr.length; i += 3) arr.set([c.r, c.g, c.b], i)
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return g
}
const M = (x, y, z, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz))

/** Everything that must stay clear of trees and rocks (paths are handled separately). */
const KEEP_CLEAR = [
  [loveTree.x, loveTree.z, 3.4],
  ...littleSpots.map((p) => [p.x, p.z, 1.6]),
  ...seedSpots.map((p) => [p.x, p.z, 1.2]),
  ...plotSpots.map((p) => [p.x, p.z, 0.9]),
  ...Object.values(noteSpots).map((p) => [p.x, p.z, 1.0]),
  ...Object.values(spots).map((p) => [p.x, p.z, 1.3]),
]
const clearOf = (x, z, extra = 0) => KEEP_CLEAR.every(([cx, cz, r]) => (x - cx) ** 2 + (z - cz) ** 2 > (r + extra) ** 2)
const onLand = (x, z, margin = 0.88) => Math.hypot(x, z) < edgeRadius(x, z) * margin && !isWater(x, z) && worldHeight(x, z) > WATER_LEVEL + 0.08

function useInstances(ref, items, apply) {
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const color = new THREE.Color()
    items.forEach((it, i) => {
      apply(m, it)
      mesh.setMatrixAt(i, m)
      if (it.color) mesh.setColorAt(i, color.set(it.color))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])
}

/* ───────── grass ───────── */

function bladeGeometry() {
  const w = 0.035
  const pos = [-w, 0, 0, w, 0, 0, -w * 0.7, 0.33, 0, w * 0.7, 0.33, 0, -w * 0.35, 0.66, 0, w * 0.35, 0.66, 0, 0, 1, 0]
  const col = []
  const base = new THREE.Color('#4f7f6a')
  const tip = new THREE.Color('#c9e6b8')
  for (let i = 0; i < pos.length; i += 3) {
    const c = base.clone().lerp(tip, pos[i + 1])
    col.push(c.r, c.g, c.b)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6])
  g.computeVertexNormals()
  return g
}

function Grass() {
  const ref = useRef()
  const geometry = useMemo(bladeGeometry, [])
  const material = useMemo(() => windMaterial({ bendFrom: 0, amount: 0.9, vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 }), [])
  const items = useMemo(() => {
    const rand = seeded(1201)
    const stepSize = HIGH ? 0.2 : 0.32
    const max = HIGH ? 11000 : 3800
    const tints = ['#ffffff', '#f0fff0', '#e9f7ff', '#fff0f6', '#f4ffe6']
    const list = []
    for (let x = -12.5; x < 12.5; x += stepSize) {
      for (let z = -12.5; z < 12.5; z += stepSize) {
        const px = x + (rand() - 0.5) * stepSize
        const pz = z + (rand() - 0.5) * stepSize
        if (!onLand(px, pz, 0.93) || slope(px, pz) > 0.85 || pathDistance(px, pz) < 0.42) continue
        const density =
          zoneDistance(px, pz, 'meadow') < 4.4 ? 1 : zoneDistance(px, pz, 'forest') < 4.2 ? 0.35 : zoneDistance(px, pz, 'cove') < 2.6 ? 0.3 : zoneDistance(px, pz, 'tree') < 2.2 ? 0.45 : 0.72
        if (rand() > density) continue
        list.push({ x: px, z: pz, y: worldHeight(px, pz), h: 0.22 + rand() * 0.3, r: rand() * Math.PI, color: tints[Math.floor(rand() * tints.length)] })
        if (list.length >= max) break
      }
      if (list.length >= max) break
    }
    return list
  }, [])
  useInstances(ref, items, (m, it) => m.compose(new THREE.Vector3(it.x, it.y, it.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, it.r, 0)), new THREE.Vector3(1, it.h, 1)))
  useEffect(() => () => geometry.dispose(), [geometry])
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} receiveShadow frustumCulled={false} />
}

/* ───────── flowers ───────── */

const FLOWER_SETS = {
  meadow: ['#ffd1e3', '#ffffff', '#e2d4ff', '#ffb3cf', '#fff1c9', '#f6a8c8', '#b9d8ff'],
  garden: ['#ff7aa8', '#ff5c8a', '#ffc4dc', '#ffffff', '#ffe2ef'],
  forest: ['#b9a8ff', '#9fb4ff', '#e2d4ff'],
  cliff: ['#fff1c9', '#ffe2a8', '#c9a8ff'],
}

function Flowers() {
  const petals = useRef()
  const centres = useRef()
  const petalMat = useMemo(() => windMaterial({ bendFrom: -0.5, amount: 0.05, roughness: 0.55, emissive: '#ff9cc6', emissiveIntensity: 0.06 }), [])
  const centreMat = useMemo(() => windMaterial({ bendFrom: -0.5, amount: 0.05, color: '#ffd36e', emissive: '#ffc04d', emissiveIntensity: 0.9 }), [])
  const items = useMemo(() => {
    const rand = seeded(733)
    const max = HIGH ? 1300 : 520
    const list = []
    let guard = 0
    while (list.length < max && guard++ < max * 30) {
      const x = (rand() - 0.5) * 24
      const z = (rand() - 0.5) * 24
      if (!onLand(x, z, 0.9) || slope(x, z) > 0.8 || pathDistance(x, z) < 0.4 || !clearOf(x, z, -0.6)) continue
      const zone = zoneDistance(x, z, 'garden') < 3.8 ? 'garden' : zoneDistance(x, z, 'meadow') < 4.6 ? 'meadow' : zoneDistance(x, z, 'forest') < 4.2 ? 'forest' : zoneDistance(x, z, 'cliff') < 2.6 ? 'cliff' : null
      const chance = zone === 'garden' ? 0.9 : zone === 'meadow' ? 0.85 : zone === 'forest' ? 0.25 : zone === 'cliff' ? 0.6 : 0.12
      if (rand() > chance) continue
      const set = FLOWER_SETS[zone || 'meadow']
      const s = (zone === 'garden' ? 0.05 : 0.032) + rand() * 0.03
      list.push({ x, z, y: worldHeight(x, z), s, color: set[Math.floor(rand() * set.length)], rot: rand() * Math.PI, glow: zone === 'cliff' })
    }
    return list
  }, [])
  useInstances(petals, items, (m, f) => m.compose(new THREE.Vector3(f.x, f.y + f.s * 0.9, f.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, f.rot, 0)), new THREE.Vector3(f.s * 1.6, f.s * 0.7, f.s * 1.6)))
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    items.forEach((f, i) => {
      m.compose(new THREE.Vector3(f.x, f.y + f.s * 1.3, f.z), new THREE.Quaternion(), new THREE.Vector3(f.s * 0.5, f.s * 0.4, f.s * 0.5))
      centres.current.setMatrixAt(i, m)
    })
    centres.current.instanceMatrix.needsUpdate = true
    centres.current.computeBoundingSphere()
  }, [items])
  return (
    <group>
      <instancedMesh ref={petals} args={[null, petalMat, items.length]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 1]} />
      </instancedMesh>
      <instancedMesh ref={centres} args={[null, centreMat, items.length]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 6]} />
      </instancedMesh>
    </group>
  )
}

/* ───────── trees ───────── */

function treeGeometry(kind) {
  const parts = []
  const trunkColor = kind === 'blossom' ? '#8f6e9e' : '#7a5a6e'
  const trunkH = kind === 'tall' ? 2.6 : 1.5
  parts.push(tint(new THREE.CylinderGeometry(0.11, 0.2, trunkH, 8, 3), trunkColor, M(0, trunkH / 2, 0)))
  if (kind === 'tall') {
    const greens = ['#4d8a75', '#5c9c84', '#6aa78e', '#4a7f72']
    ;[
      [0, 2.5, 0, 1.15, 0.95],
      [0.25, 3.15, 0.1, 0.95, 0.85],
      [-0.2, 3.7, -0.1, 0.75, 0.75],
      [0.1, 4.15, 0.05, 0.5, 0.6],
    ].forEach(([x, y, z, s, sy], i) => parts.push(tint(new THREE.IcosahedronGeometry(1, 1), greens[i % greens.length], M(x, y, z, s, s * sy, s))))
  } else if (kind === 'round') {
    const greens = ['#7fb98f', '#8fc79a', '#6fae86']
    ;[
      [0, 1.85, 0, 0.85],
      [0.45, 1.6, 0.15, 0.6],
      [-0.4, 1.65, -0.1, 0.62],
      [0.05, 2.25, 0.1, 0.55],
    ].forEach(([x, y, z, s], i) => parts.push(tint(new THREE.IcosahedronGeometry(1, 1), greens[i % greens.length], M(x, y, z, s))))
  } else {
    const pinks = ['#f7a8c8', '#fbc4da', '#f490bb', '#ffd6e7']
    ;[
      [0, 1.9, 0, 0.8],
      [0.5, 1.7, 0.2, 0.55],
      [-0.45, 1.75, -0.15, 0.6],
      [0.1, 2.3, 0.05, 0.5],
      [-0.1, 1.55, 0.45, 0.45],
    ].forEach(([x, y, z, s], i) => parts.push(tint(new THREE.IcosahedronGeometry(1, 1), pinks[i % pinks.length], M(x, y, z, s))))
  }
  const merged = mergeGeometries(parts, false)
  parts.forEach((p) => p.dispose())
  merged.computeVertexNormals()
  return merged
}

function placeTrees() {
  const rand = seeded(4242)
  const out = { tall: [], round: [], blossom: [] }
  const all = []
  const tryPlace = (kind, x, z, s, minGap) => {
    if (!onLand(x, z, 0.86) || slope(x, z) > 0.7 || pathDistance(x, z) < 0.95 || !clearOf(x, z)) return false
    if (all.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < minGap * minGap)) return false
    const t = { x, z, y: worldHeight(x, z) - 0.05, s, r: rand() * Math.PI * 2 }
    out[kind].push(t)
    all.push(t)
    return true
  }
  // Heartwood Forest — dense, tall, varied
  for (let i = 0, placed = 0; i < 600 && placed < (HIGH ? 34 : 22); i++) {
    const a = rand() * Math.PI * 2
    const r = Math.sqrt(rand()) * (ZONES.forest.r + 1.4)
    if (tryPlace('tall', ZONES.forest.x + Math.cos(a) * r, ZONES.forest.z + Math.sin(a) * r, 0.75 + rand() * 0.6, 1.05)) placed++
  }
  // round trees around the lake, the meadow edges and the cliff
  const ringSpots = [
    ...Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2 + 0.3
      return [ZONES.lake.x + Math.cos(a) * 4.6, ZONES.lake.z + Math.sin(a) * 4.6]
    }),
    [-4.6, 7.4], [-5.4, 5.8], [4.6, 5.2], [-3.4, 9.0], [9.4, 4.6], [6.6, 0.4], [-2.6, -1.8], [3.4, 3.6], [-8.6, -1.2], [9.9, -1.6],
  ]
  ringSpots.forEach(([x, z]) => tryPlace('round', x + (rand() - 0.5) * 0.6, z + (rand() - 0.5) * 0.6, 0.85 + rand() * 0.4, 1.6))
  // blossom trees in the Memory Garden
  ;[
    [-8.4, 0.2], [-7.9, 4.9], [-4.6, 5.0], [-4.3, -0.2], [-9.4, 2.6],
  ].forEach(([x, z]) => tryPlace('blossom', x, z, 0.85 + rand() * 0.3, 1.4))
  return out
}

function TreeKind({ kind, items }) {
  const ref = useRef()
  const geometry = useMemo(() => treeGeometry(kind), [kind])
  const material = useMemo(() => windMaterial({ bendFrom: kind === 'tall' ? 2.0 : 1.2, amount: 0.018, vertexColors: true, roughness: 0.8, flatShading: false }), [kind])
  useInstances(ref, items, (m, t) => m.compose(new THREE.Vector3(t.x, t.y, t.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, t.r, 0)), new THREE.Vector3(t.s, t.s, t.s)))
  useEffect(() => () => geometry.dispose(), [geometry])
  if (!items.length) return null
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow receiveShadow frustumCulled={false} />
}

/* ───────── rocks, ferns, bushes ───────── */

function placeRocks() {
  const rand = seeded(919)
  const list = []
  const add = (x, z, s, color = '#9d8fb8', sink = 0.35, collide = true) => {
    list.push({ x, z, y: worldHeight(x, z) - s * sink, s, r: rand() * 6, color })
    if (collide && s > 0.35) addCollider(x, z, s * 0.85)
  }
  // around the foot of Starfall Cliff
  for (let i = 0; i < 16; i++) {
    const a = rand() * Math.PI * 2
    const r = ZONES.cliff.r + 1.0 + rand() * 1.2
    const x = ZONES.cliff.x + Math.cos(a) * r
    const z = ZONES.cliff.z + Math.sin(a) * r
    if (onLand(x, z, 0.92) && pathDistance(x, z) > 1.1 && clearOf(x, z)) add(x, z, 0.35 + rand() * 0.5)
  }
  // the natural arch that hides the Secret Cove (the path passes underneath)
  const archC = new THREE.Vector2(4.25, 8.62)
  const across = new THREE.Vector2(0.31, 0.95)
  ;[-1, 1].forEach((s) => {
    const x = archC.x + across.x * 1.05 * s
    const z = archC.y + across.y * 1.05 * s
    list.push({ x, z, y: worldHeight(x, z) + 0.6, s: 0.75, sy: 1.6, r: s, color: '#8f80b0' })
    addCollider(x, z, 0.62)
  })
  list.push({ x: archC.x, z: archC.y, y: worldHeight(archC.x, archC.y) + 2.25, s: 1.25, sy: 0.55, sx: 1.6, r: 0.4, color: '#9d8fb8' })
  // rocks screening the cove from the meadow
  ;[[5.6, 9.6], [3.0, 10.0], [5.9, 6.6], [3.6, 7.3]].forEach(([x, z]) => onLand(x, z, 0.95) && add(x, z, 0.5 + rand() * 0.35))
  // mossy forest rocks and lake shore stones
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2
    const forest = i < 8
    const c = forest ? ZONES.forest : ZONES.lake
    const r = forest ? rand() * (c.r + 0.8) : c.r + 0.9 + rand() * 0.8
    const x = c.x + Math.cos(a) * r
    const z = c.z + Math.sin(a) * r
    if (onLand(x, z) && pathDistance(x, z) > 0.8 && clearOf(x, z)) add(x, z, 0.18 + rand() * 0.3, forest ? '#7f9a86' : '#b3a6cf', 0.4, false)
  }
  return list
}

function Rocks({ items }) {
  const ref = useRef()
  const material = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }), [])
  useInstances(ref, items, (m, r) => m.compose(new THREE.Vector3(r.x, r.y, r.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(r.r * 0.3, r.r, r.r * 0.2)), new THREE.Vector3(r.s * (r.sx || 1), r.s * (r.sy || 0.8), r.s)))
  return (
    <instancedMesh ref={ref} args={[null, material, items.length]} castShadow receiveShadow frustumCulled={false}>
      <dodecahedronGeometry args={[1, 0]} />
    </instancedMesh>
  )
}

function Ferns() {
  const ref = useRef()
  const material = useMemo(() => windMaterial({ bendFrom: 0, amount: 0.25, color: '#5f9c7d', roughness: 0.8, side: THREE.DoubleSide }), [])
  const items = useMemo(() => {
    const rand = seeded(57)
    const list = []
    for (let i = 0; i < (HIGH ? 160 : 70); i++) {
      const a = rand() * Math.PI * 2
      const r = Math.sqrt(rand()) * (ZONES.forest.r + 1)
      const x = ZONES.forest.x + Math.cos(a) * r
      const z = ZONES.forest.z + Math.sin(a) * r
      if (onLand(x, z) && pathDistance(x, z) > 0.5 && clearOf(x, z, -0.5)) list.push({ x, z, y: worldHeight(x, z), s: 0.2 + rand() * 0.25, r: rand() * 6 })
    }
    return list
  }, [])
  useInstances(ref, items, (m, f) => m.compose(new THREE.Vector3(f.x, f.y + f.s * 0.35, f.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, f.r, 0)), new THREE.Vector3(f.s * 1.6, f.s, f.s * 1.6)))
  return (
    <instancedMesh ref={ref} args={[null, material, items.length]} frustumCulled={false}>
      <coneGeometry args={[1, 0.8, 6, 1, true]} />
    </instancedMesh>
  )
}

function Bushes() {
  const ref = useRef()
  const material = useMemo(() => windMaterial({ bendFrom: 0, amount: 0.04, roughness: 0.8 }), [])
  const items = useMemo(() => {
    const rand = seeded(88)
    const list = []
    const greens = ['#6fae86', '#7fb98f', '#d98fb4', '#8fc79a']
    const centres = [ZONES.garden, ZONES.meadow, ZONES.cove]
    for (let i = 0; i < (HIGH ? 70 : 34); i++) {
      const c = centres[i % centres.length]
      const a = rand() * Math.PI * 2
      const r = c.r * (0.7 + rand() * 0.6)
      const x = c.x + Math.cos(a) * r
      const z = c.z + Math.sin(a) * r
      if (onLand(x, z, 0.88) && pathDistance(x, z) > 0.75 && clearOf(x, z)) list.push({ x, z, y: worldHeight(x, z), s: 0.25 + rand() * 0.3, r: rand() * 6, color: greens[Math.floor(rand() * greens.length)] })
    }
    return list
  }, [])
  useInstances(ref, items, (m, b) => m.compose(new THREE.Vector3(b.x, b.y + b.s * 0.45, b.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, b.r, 0)), new THREE.Vector3(b.s * 1.3, b.s * 0.85, b.s * 1.2)))
  return (
    <instancedMesh ref={ref} args={[null, material, items.length]} castShadow frustumCulled={false}>
      <icosahedronGeometry args={[1, 1]} />
    </instancedMesh>
  )
}

/** Soft shafts of light falling through the forest canopy. */
function Sunbeams() {
  const group = useRef()
  const reducedMotion = useStore((s) => s.reducedMotion)
  const beams = useMemo(() => {
    const rand = seeded(5)
    return Array.from({ length: 5 }, () => {
      const a = rand() * Math.PI * 2
      const r = rand() * 2.6
      const x = ZONES.forest.x + Math.cos(a) * r
      const z = ZONES.forest.z + Math.sin(a) * r
      return { x, z, y: worldHeight(x, z) + 2.4, s: 0.6 + rand() * 0.5 }
    })
  }, [])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader:
          'uniform float uTime; varying vec2 vUv; void main(){ float edge = smoothstep(0.0,0.35,vUv.x)*smoothstep(1.0,0.65,vUv.x); float fade = smoothstep(0.0,0.6,vUv.y)*smoothstep(1.0,0.75,vUv.y); float flick = 0.75 + 0.25*sin(uTime*0.6 + vUv.y*3.0); gl_FragColor = vec4(vec3(1.0,0.93,0.8)*0.35, edge*fade*flick*0.5); }',
      }),
    [],
  )
  useFrame((_, delta) => {
    material.uniforms.uTime.value += delta * (reducedMotion ? 0.1 : 1)
  })
  return (
    <group ref={group}>
      {beams.map((b, i) => (
        <mesh key={i} position={[b.x, b.y, b.z]} rotation={[0, i * 0.9, 0.18]} material={material}>
          <planeGeometry args={[b.s, 5]} />
        </mesh>
      ))}
    </group>
  )
}

/** All the island's plants and stones, with one shared wind clock. */
export default function Vegetation() {
  const reducedMotion = useStore((s) => s.reducedMotion)
  const trees = useMemo(() => {
    const t = placeTrees()
    ;[...t.tall, ...t.round, ...t.blossom].forEach((tr) => addCollider(tr.x, tr.z, 0.3 * tr.s))
    return t
  }, [])
  const rocks = useMemo(placeRocks, [])

  useFrame((_, delta) => {
    wind.uTime.value += delta
    wind.uStrength.value = reducedMotion ? 0.25 : 1
  })

  return (
    <group>
      <Grass />
      <Flowers />
      <TreeKind kind="tall" items={trees.tall} />
      <TreeKind kind="round" items={trees.round} />
      <TreeKind kind="blossom" items={trees.blossom} />
      <Rocks items={rocks} />
      <Ferns />
      <Bushes />
      <Sunbeams />
      <Fireflies count={HIGH ? 60 : 26} area={[8, 3, 8]} center={[ZONES.forest.x, 0.6, ZONES.forest.z]} seed={31} />
      <Fireflies count={HIGH ? 30 : 14} area={[7, 2, 7]} center={[ZONES.lake.x, 0.2, ZONES.lake.z]} seed={32} colors={['#c9e0ff', '#ffe0f0']} />
    </group>
  )
}
