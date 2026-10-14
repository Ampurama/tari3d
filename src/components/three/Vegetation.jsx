import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { addCollider, edgeRadius, MAIN_RADIUS, SKY_BRIDGE, SPREAD, isWater, pathDistance, seeded, slope, WATER_LEVEL, worldHeight, zoneDistance, ZONES } from '../../lib/terrain'
import { envelopeSpot, gallery, glowFlowerSpots, littleSpots, loveTree, mochiHome, noteSpots, PICNIC, picnicSpot, spots, viewpointSpot } from '../../lib/layout'
import { blocksView } from '../../lib/iso'
import { tier } from '../../lib/device'
import { wind, windMaterial } from '../../lib/wind'
import { withPaint } from '../../lib/paint'
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
  [ZONES.gallery.x, ZONES.gallery.z, ZONES.gallery.r + 0.6], // the memories plaza stays open
  ...littleSpots.map((p) => [p.x, p.z, 1.6]),
  ...glowFlowerSpots.map((p) => [p.x, p.z, 1.0]),
  [mochiHome.x, mochiHome.z, 1.0],
  [picnicSpot.x, picnicSpot.z, 3.2], // the picnic hill stays open (and the thief's bush path)
  [PICNIC.thiefFrom.x, PICNIC.thiefFrom.z, 0.9],
  [envelopeSpot.x, envelopeSpot.z, 0.9],
  ...Object.values(noteSpots).map((p) => [p.x, p.z, 1.0]),
  ...Object.values(spots).map((p) => [p.x, p.z, 1.3]),
  [SKY_BRIDGE.x, SKY_BRIDGE.z0, 2.4], // where the sky bridge to the home island starts
  [5.0, -1.0, 3.0], // the hot air balloon's landing pad (lib/balloon.js)
]
/**
 * Everything she has to find or use must stay visible from the 2.5D camera:
 * nothing tall may stand on the camera's side of it.
 */
const MUST_SEE = [
  ...littleSpots,
  ...glowFlowerSpots,
  mochiHome,
  picnicSpot,
  envelopeSpot,
  ...Object.values(noteSpots),
  ...Object.values(spots),
  viewpointSpot,
  gallery, // Our Memories: nothing tall in front of the arches
]
/** Would something of this height (world units) at (x, z) hide any of them? */
const hidesSomething = (x, z, height, half) => {
  const length = height / Math.tan((36 * Math.PI) / 180) + 0.6
  return MUST_SEE.some((p) => blocksView(x, z, p.x, p.z, length, half))
}
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

/** A soft tuft: five wide, slightly curved blades fanned out (reads as lush grass, not as lines). */
function bladeGeometry() {
  const pos = []
  const col = []
  const idx = []
  const base = new THREE.Color('#5f9e45')
  const tip = new THREE.Color('#c4e27c')
  for (let b = 0; b < 5; b++) {
    const a = (b / 5) * Math.PI * 2 + 0.3
    const lean = 0.35 + (b % 2) * 0.15
    const w = 0.075
    const start = pos.length / 3
    // three rows: base, middle, tip — each blade leans outward
    ;[0, 0.55, 1].forEach((t, row) => {
      const out = lean * t * t
      const half = w * (1 - t * 0.85)
      const cx = Math.cos(a) * out
      const cz = Math.sin(a) * out
      const px = -Math.sin(a) * half
      const pz = Math.cos(a) * half
      pos.push(cx - px, t, cz - pz, cx + px, t, cz + pz)
      const c = base.clone().lerp(tip, t)
      col.push(c.r, c.g, c.b, c.r, c.g, c.b)
      if (row < 2) {
        const i = start + row * 2
        idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2)
      }
    })
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function Grass() {
  const ref = useRef()
  const geometry = useMemo(bladeGeometry, [])
  const material = useMemo(() => windMaterial({ bendFrom: 0, amount: 0.6, vertexColors: true, side: THREE.DoubleSide, roughness: 0.95 }), [])
  const items = useMemo(() => {
    const rand = seeded(1201)
    const stepSize = HIGH ? 0.38 : 0.52
    const max = HIGH ? 4200 : 1900
    const tints = ['#ffffff', '#f0fff0', '#e9f7ff', '#fff0f6', '#f4ffe6']
    const list = []
    const R = MAIN_RADIUS + 0.5
    for (let x = -R; x < R; x += stepSize) {
      for (let z = -R; z < R; z += stepSize) {
        const px = x + (rand() - 0.5) * stepSize
        const pz = z + (rand() - 0.5) * stepSize
        if (!onLand(px, pz, 0.93) || slope(px, pz) > 0.85 || pathDistance(px, pz) < 0.42) continue
        if (zoneDistance(px, pz, 'gallery') < ZONES.gallery.r + 0.2) continue // paved
        const density =
          zoneDistance(px, pz, 'meadow') < 4.4 ? 0.7 : zoneDistance(px, pz, 'forest') < 4.2 ? 0.25 : zoneDistance(px, pz, 'cove') < 2.6 ? 0.2 : zoneDistance(px, pz, 'tree') < 3.2 ? 0.1 : 0.4
        if (rand() > density) continue
        list.push({ x: px, z: pz, y: worldHeight(px, pz), h: 0.2 + rand() * 0.16, r: rand() * Math.PI, color: tints[Math.floor(rand() * tints.length)] })
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
  meadow: ['#ff9cc4', '#fff0a6', '#ffffff', '#d9c2ff', '#ff9f8a', '#ffcf9e', '#ffd1e3'],
  garden: ['#ff8fb8', '#ffc4dc', '#e6cfff', '#ffffff', '#fff1a8', '#ffb59e'],
  forest: ['#c9b5ff', '#fff0a6', '#ffffff', '#ffc4dc'],
  cliff: ['#ffe2a8', '#ffd1e3', '#c9e8ff', '#ffffff'],
}

function Flowers() {
  const petals = useRef()
  const centres = useRef()
  const petalMat = useMemo(() => windMaterial({ bendFrom: -0.5, amount: 0.05, roughness: 0.55, emissive: '#ff9cc6', emissiveIntensity: 0.06 }), [])
  const centreMat = useMemo(() => windMaterial({ bendFrom: -0.5, amount: 0.05, color: '#ffd36e', emissive: '#ffc04d', emissiveIntensity: 0.9 }), [])
  const items = useMemo(() => {
    const rand = seeded(733)
    const list = []
    // a few dozen flower patches, each one or two colours, denser in the garden and the meadow
    const patches = []
    for (let i = 0; i < 300 && patches.length < (HIGH ? 48 : 30); i++) {
      const x = (rand() - 0.5) * MAIN_RADIUS * 2
      const z = (rand() - 0.5) * MAIN_RADIUS * 2
      if (!onLand(x, z, 0.86) || slope(x, z) > 0.6 || pathDistance(x, z) < 0.8 || !clearOf(x, z, -0.3)) continue
      const zone = zoneDistance(x, z, 'garden') < 3.8 ? 'garden' : zoneDistance(x, z, 'meadow') < 4.6 ? 'meadow' : zoneDistance(x, z, 'forest') < 4.2 ? 'forest' : zoneDistance(x, z, 'cliff') < 2.6 ? 'cliff' : null
      if (!zone && rand() > 0.35) continue
      const set = FLOWER_SETS[zone || 'meadow']
      patches.push({ x, z, zone, r: 0.45 + rand() * 0.6, a: set[Math.floor(rand() * set.length)], b: set[Math.floor(rand() * set.length)], n: zone === 'garden' ? 18 : 11 })
    }
    for (const p of patches) {
      for (let k = 0; k < p.n; k++) {
        const ang = rand() * Math.PI * 2
        const rr = Math.sqrt(rand()) * p.r
        const x = p.x + Math.cos(ang) * rr
        const z = p.z + Math.sin(ang) * rr
        if (!onLand(x, z, 0.9) || pathDistance(x, z) < 0.4) continue
        const s = (p.zone === 'garden' ? 0.05 : 0.04) + rand() * 0.025
        list.push({ x, z, y: worldHeight(x, z), s, color: rand() > 0.35 ? p.a : p.b, rot: rand() * Math.PI })
      }
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

/** Canopy blobs coloured from a shaded underside to a sunlit top (and lighter toward the sun). */
const SUN = new THREE.Vector3(0.55, 0.62, 0.56).normalize()
function canopy(blobs, dark, light) {
  const lo = Math.min(...blobs.map(([, y, , s]) => y - s))
  const hi = Math.max(...blobs.map(([, y, , s]) => y + s))
  const cx = blobs.reduce((a, b) => a + b[0], 0) / blobs.length
  const cy = (lo + hi) / 2
  const cz = blobs.reduce((a, b) => a + b[2], 0) / blobs.length
  const d = new THREE.Color(dark)
  const l = new THREE.Color(light)
  return blobs.map(([x, y, z, s, sy = 1]) => {
    const g = new THREE.IcosahedronGeometry(1, 2).toNonIndexed()
    g.applyMatrix4(M(x, y, z, s, s * sy, s))
    g.deleteAttribute('uv')
    const p = g.attributes.position
    const arr = new Float32Array(p.count * 3)
    const c = new THREE.Color()
    const v = new THREE.Vector3()
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i) - cx, p.getY(i) - cy, p.getZ(i) - cz).normalize()
      const t = THREE.MathUtils.clamp(((p.getY(i) - lo) / (hi - lo)) * 0.7 + v.dot(SUN) * 0.3 + 0.1, 0, 1)
      c.copy(d).lerp(l, t)
      arr.set([c.r, c.g, c.b], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
    return g
  })
}

function treeGeometry(kind) {
  const parts = []
  const trunkColor = kind === 'blossom' ? '#9a6e58' : '#8a6248'
  const trunkH = kind === 'tall' ? 2.6 : 1.5
  parts.push(tint(new THREE.CylinderGeometry(0.11, 0.2, trunkH, 8, 3), trunkColor, M(0, trunkH / 2, 0)))
  if (kind === 'tall') {
    parts.push(
      ...canopy(
        [
          [0, 2.45, 0, 1.15, 0.9],
          [0.55, 2.75, 0.2, 0.8, 0.85],
          [-0.5, 2.8, -0.15, 0.85, 0.85],
          [0.1, 3.3, -0.35, 0.8, 0.85],
          [-0.1, 3.55, 0.25, 0.75, 0.8],
          [0.05, 4.05, 0, 0.55, 0.8],
        ],
        '#2f6f40',
        '#a6d466',
      ),
    )
  } else if (kind === 'round') {
    parts.push(
      ...canopy(
        [
          [0, 1.85, 0, 0.85],
          [0.5, 1.65, 0.15, 0.62],
          [-0.45, 1.7, -0.1, 0.64],
          [0.1, 1.75, -0.48, 0.6],
          [0.05, 2.3, 0.1, 0.58],
        ],
        '#3a7d45',
        '#b8de74',
      ),
    )
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
    if (hidesSomething(x, z, (kind === 'tall' ? 4.6 : 2.6) * s, 1.0 + s * 0.6)) return false
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
    ...[[-4.6, 7.4], [-5.4, 5.8], [4.6, 5.2], [-3.4, 9.0], [9.4, 4.6], [6.6, 0.4], [-2.6, -1.8], [3.4, 3.6], [-8.6, -1.2], [9.9, -1.6]].map(([x, z]) => [x * SPREAD, z * SPREAD]),
  ]
  ringSpots.forEach(([x, z]) => tryPlace('round', x + (rand() - 0.5) * 0.6, z + (rand() - 0.5) * 0.6, 0.85 + rand() * 0.4, 1.6))
  // blossom trees in the Memory Garden
  ;[
    [-8.4, 0.2], [-7.9, 4.9], [-4.6, 5.0], [-4.3, -0.2], [-9.4, 2.6],
  ].forEach(([x, z]) => tryPlace('blossom', x * SPREAD, z * SPREAD, 0.85 + rand() * 0.3, 1.4))
  // little groves in the wider outer ring of the island (never in front of anything she needs)
  for (let i = 0, placed = 0; i < 400 && placed < (HIGH ? 22 : 14); i++) {
    const a = rand() * Math.PI * 2
    const r = (0.62 + rand() * 0.2) * MAIN_RADIUS
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    if (tryPlace(rand() > 0.4 ? 'round' : 'tall', x, z, 0.75 + rand() * 0.45, 1.8)) placed++
  }
  return out
}

function TreeKind({ kind, items }) {
  const ref = useRef()
  const geometry = useMemo(() => treeGeometry(kind), [kind])
  const material = useMemo(() => withPaint(windMaterial({ bendFrom: kind === 'tall' ? 2.0 : 1.2, amount: 0.018, vertexColors: true, roughness: 0.8, flatShading: false }), 'foliage'), [kind])
  useInstances(ref, items, (m, t) => m.compose(new THREE.Vector3(t.x, t.y, t.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, t.r, 0)), new THREE.Vector3(t.s, t.s, t.s)))
  useEffect(() => () => geometry.dispose(), [geometry])
  if (!items.length) return null
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow receiveShadow frustumCulled={false} />
}

/* ───────── rocks, ferns, bushes ───────── */

function placeRocks() {
  const rand = seeded(919)
  const list = []
  const add = (x, z, s, color = '#d6cfc0', sink = 0.35, collide = true) => {
    list.push({ x, z, y: worldHeight(x, z) - s * sink, s, r: rand() * 6, color })
    if (collide && s > 0.35) addCollider(x, z, s * 0.85)
  }
  // around the foot of Starfall Cliff
  for (let i = 0; i < 7; i++) {
    const a = rand() * Math.PI * 2
    const r = ZONES.cliff.r + 1.0 + rand() * 1.2
    const x = ZONES.cliff.x + Math.cos(a) * r
    const z = ZONES.cliff.z + Math.sin(a) * r
    const s = 0.3 + rand() * 0.3
    if (onLand(x, z, 0.92) && pathDistance(x, z) > 1.1 && clearOf(x, z) && !hidesSomething(x, z, s * 1.2, 0.8)) add(x, z, s)
  }
  // mossy forest rocks and lake shore stones
  for (let i = 0; i < 8; i++) {
    const a = rand() * Math.PI * 2
    const forest = i < 4
    const c = forest ? ZONES.forest : ZONES.lake
    const r = forest ? rand() * (c.r + 0.8) : c.r + 0.9 + rand() * 0.8
    const x = c.x + Math.cos(a) * r
    const z = c.z + Math.sin(a) * r
    if (onLand(x, z) && pathDistance(x, z) > 0.8 && clearOf(x, z)) add(x, z, 0.18 + rand() * 0.3, forest ? '#8fcf7e' : '#ddd6ca', 0.4, false)
  }
  return list
}

function Rocks({ items }) {
  const ref = useRef()
  const material = useMemo(() => withPaint(new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }), 'rock'), [])
  useInstances(ref, items, (m, r) => m.compose(new THREE.Vector3(r.x, r.y, r.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(r.r * 0.3, r.r, r.r * 0.2)), new THREE.Vector3(r.s * (r.sx || 1), r.s * (r.sy || 0.8), r.s)))
  return (
    <instancedMesh ref={ref} args={[null, material, items.length]} castShadow receiveShadow frustumCulled={false}>
      <dodecahedronGeometry args={[1, 0]} />
    </instancedMesh>
  )
}

function Ferns() {
  const ref = useRef()
  const material = useMemo(() => withPaint(windMaterial({ bendFrom: 0, amount: 0.25, color: '#7cc684', roughness: 0.8, side: THREE.DoubleSide }), 'foliage'), [])
  const items = useMemo(() => {
    const rand = seeded(57)
    const list = []
    for (let i = 0; i < (HIGH ? 80 : 40); i++) {
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
  const material = useMemo(() => withPaint(windMaterial({ bendFrom: 0, amount: 0.04, roughness: 0.8 }), 'foliage'), [])
  const items = useMemo(() => {
    const rand = seeded(88)
    const list = []
    const greens = ['#80c684', '#9cd48c', '#f4b6cc', '#b2dc96']
    const centres = [ZONES.garden, ZONES.meadow, ZONES.cove]
    for (let i = 0; i < (HIGH ? 26 : 14); i++) {
      const c = centres[i % centres.length]
      const a = rand() * Math.PI * 2
      const r = c.r * (0.7 + rand() * 0.6)
      const x = c.x + Math.cos(a) * r
      const z = c.z + Math.sin(a) * r
      if (onLand(x, z, 0.88) && pathDistance(x, z) > 0.75 && clearOf(x, z) && !hidesSomething(x, z, 0.7, 0.7)) list.push({ x, z, y: worldHeight(x, z), s: 0.25 + rand() * 0.3, r: rand() * 6, color: greens[Math.floor(rand() * greens.length)] })
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
