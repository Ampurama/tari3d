import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { buildMeadowGeometry, buildRiverGeometry, buildSkyCliffGeometry, CAFE_SITE, villageTaken, WELL_SITE, carnivalTaken, CROSSINGS, crossingAt, DISTANCE_SITE, GIANT_TREE, KNOLL, MEADOW_PATHS, meadowHeight, meadowPathDistance, POND, RIVER_HALF_WIDTH, riverAt } from '../../lib/meadow'
import { addCollider, edgeRadius, HOME_ISLAND, homeDistance, SEA, seeded, SKY, SKY_BRIDGE, skyDistance, standHeight, WEST_BRIDGE } from '../../lib/terrain'
import { player, walkTo } from '../../lib/player'
import { tier } from '../../lib/device'
import { windMaterial } from '../../lib/wind'
import { withGroundDetail, withPaint } from '../../lib/paint'
import { atmosphere } from '../../lib/atmosphere'
import { useStore } from '../../store'
import { bladeGeometry, FLOWER_SETS, grassTint, Rocks, TreeKind } from './Vegetation'

const tintColor = new THREE.Color()
import { Glow, LightPools } from './Bits'
import { createWater } from '../../lib/water'
import { Bench } from './Props'
import { Butterflies } from './Wildlife'
import { Fireflies } from './Particles'

/*
 * DREAMCORE MEADOW — the landscape all the places now stand in (see lib/meadow.js):
 * the ground itself, the river and the pond, flower fields, grass, copses of trees, river stones
 * and the giant tree on its knoll. Scenery only: nothing here changes where she can walk.
 */

const HIGH = tier === 'high'

/* ───────── where things may grow ───────── */

const segDist = (px, pz, ax, az, bx, bz) => {
  const vx = bx - ax
  const vz = bz - az
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz || 1)))
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t))
}
/** Open meadow: not on a place, not in water, not under a bridge. `tall`: also keep the island's camera side clear. */
export function openMeadow(x, z, { tall = false, water = 0.5 } = {}) {
  // grass and flowers grow right up to the main meadow and the home garden (it's all one land)
  if (Math.hypot(x, z) - edgeRadius(x, z) < (tall ? 2 : 0)) return false
  if ((homeDistance(x, z) - 1) * HOME_ISLAND.r < (tall ? 1.5 : 0)) return false
  if (crossingAt(x, z)) return false
  // The Little Gnome Café's level pad
  if (Math.hypot(x - CAFE_SITE.x, z - CAFE_SITE.z) < CAFE_SITE.r0 + (tall ? 2.5 : 0.3)) return false
  // the wishing well's little clearing
  if (Math.hypot(x - WELL_SITE.x, z - WELL_SITE.z) < WELL_SITE.r0 + (tall ? 2.5 : 0.2)) return false
  // the carnival's fairground
  if (carnivalTaken(x, z, tall ? 3 : 0)) return false
  // Gnome Village (its buildings, square, brook, gardens and grove)
  if (villageTaken(x, z, tall ? 1.6 : 0)) return false
  // the footpaths stay clear (flowers may line them; trees keep a step back)
  if (meadowPathDistance(x, z) < (tall ? 1.8 : 0.55)) return false
  // Chapter 2's hilltops and ravine stay as they are
  if (Math.abs(x - DISTANCE_SITE.x) < (tall ? 16 : 7) && Math.abs(z - DISTANCE_SITE.z) < (tall ? 13 : 11)) return false
  if ((skyDistance(x, z) - 1) * SKY.r < 3.5) return false
  if (Math.hypot(x - SEA.x, z - SEA.z) < SEA.r * 1.06 + water) return false
  if (Math.hypot(x - POND.x, z - POND.z) < POND.r * 1.08 + water) return false
  if (riverAt(x, z).d < RIVER_HALF_WIDTH + 0.4 + water) return false
  const nearBridge = Math.min(segDist(x, z, SKY_BRIDGE.x, SKY_BRIDGE.z0, SKY_BRIDGE.x, SKY_BRIDGE.z1), segDist(x, z, WEST_BRIDGE.ax, WEST_BRIDGE.az, WEST_BRIDGE.bx, WEST_BRIDGE.bz))
  if (nearBridge < (tall ? 5 : 1.5)) return false
  // tall things stay off the slope in front of the main meadow (it's where the camera looks from)
  if (tall && z > 4 && Math.abs(x) < 26 && Math.hypot(x, z) - edgeRadius(x, z) < 16) return false
  return true
}

/* ───────── the ground ───────── */

/** Painterly ground: sunny and shady patches and soft brush strokes, in world space (no texture). */
const meadowMaterial = (() => {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 })
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMeadow;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvMeadow = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vMeadow;
        float mHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float mNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(mHash(i), mHash(i + vec2(1.0, 0.0)), u.x), mix(mHash(i + vec2(0.0, 1.0)), mHash(i + vec2(1.0, 1.0)), u.x), u.y);
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec2 q = vMeadow.xz;
          float patches = mNoise(q * 0.18) * 0.6 + mNoise(q * 0.55) * 0.4;
          diffuseColor.rgb = mix(diffuseColor.rgb * 0.9, diffuseColor.rgb * vec3(1.08, 1.07, 0.86), smoothstep(0.32, 0.78, patches));
          float stroke = mNoise(vec2(q.x * 2.4 + q.y * 0.8, q.y * 0.6 - q.x * 0.2));
          diffuseColor.rgb *= 0.96 + (stroke - 0.5) * 0.1;
        }`,
      )
  }
  m.customProgramCacheKey = () => 'meadow-ground'
  // clumps of grass that catch the light (lib/paint.js)
  return withGroundDetail(m)
})()

function MeadowGround() {
  const geometry = useMemo(() => buildMeadowGeometry(HIGH ? {} : { segments: 256, step: 1.0, growth: 0.02 }), [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh
      geometry={geometry}
      material={meadowMaterial}
      receiveShadow
      onClick={(e) => {
        const s = useStore.getState()
        if (s.view !== 'explore' || s.phase !== 'world' || e.delta > 8) return
        // tap-to-walk works out in the meadow too (drags orbit the camera instead)
        walkTo(e.point.x, e.point.z, 0.2)
        player.onArrive = null
      }}
    />
  )
}

/** Sky Island's sheer stone cliff over the valley, on the side Cloud Hop leaves from. */
function SkyCliff() {
  const geometry = useMemo(buildSkyCliffGeometry, [])
  const material = useMemo(() => withPaint(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }), 'rock'), [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} material={material} castShadow receiveShadow />
}

/* ───────── water ───────── */

/** A water material that follows the time of day (lib/water.js). */
function useWater(options) {
  const material = useMemo(() => createWater(options), []) // eslint-disable-line react-hooks/exhaustive-deps
  const reducedMotion = useStore((s) => s.reducedMotion)
  useFrame((_, delta) => material.tick(delta, reducedMotion))
  useEffect(() => () => material.dispose(), [material])
  return material
}

function River() {
  const geometry = useMemo(buildRiverGeometry, [])
  // it flows from the western lake down to the pond
  const material = useWater({ shape: 'ribbon', flow: [0, 0.55], deep: '#128a96', shallow: '#5fd2c6' })
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} material={material} renderOrder={1} />
}

function Pond() {
  const material = useWater({ shape: 'round', center: [POND.x, POND.z], radius: POND.r, deep: '#127f95', shallow: '#62d6cc' })
  return (
    <mesh position={[POND.x, POND.level, POND.z]} rotation={[-Math.PI / 2, 0, 0]} material={material} renderOrder={1}>
      <circleGeometry args={[POND.r * 1.02, 48]} />
    </mesh>
  )
}

/* ───────── what grows on it ───────── */

/** Flower fields: drifts of a colour or two, thickest in a few places so they read as landmarks. */
function MeadowFlowers() {
  const petals = useRef()
  const centres = useRef()
  const petalMat = useMemo(() => windMaterial({ bendFrom: -0.5, amount: 0.05, roughness: 0.55, emissive: '#ff9cc6', emissiveIntensity: 0.06 }), [])
  const centreMat = useMemo(() => windMaterial({ bendFrom: -0.5, amount: 0.05, color: '#ffd36e', emissive: '#ffc04d', emissiveIntensity: 0.9 }), [])
  const items = useMemo(() => {
    const rand = seeded(4242)
    const sets = [FLOWER_SETS.meadow, FLOWER_SETS.garden, FLOWER_SETS.forest, ['#ffd6e7', '#e6cfff', '#ffffff', '#c9b5ff']]
    const patches = []
    const addPatch = (x, z, r, dense) => {
      if (!openMeadow(x, z, { water: 0.3 })) return
      const set = sets[Math.floor(rand() * sets.length)]
      patches.push({ x, z, r, n: Math.round(r * r * (dense ? 9 : 5)), a: set[Math.floor(rand() * set.length)], b: set[Math.floor(rand() * set.length)] })
    }
    // landmark fields: around the giant tree's knoll and around the pond
    for (let i = 0; i < 9; i++) addPatch(KNOLL.x + (rand() - 0.5) * 18, KNOLL.z + (rand() - 0.5) * 18, 2 + rand() * 1.5, true)
    for (let i = 0; i < 7; i++) {
      const a = rand() * Math.PI * 2
      addPatch(POND.x + Math.cos(a) * (POND.r + 2.5 + rand() * 3), POND.z + Math.sin(a) * (POND.r + 2.5 + rand() * 3), 1.6 + rand(), true)
    }
    // drifts all over the meadow around the places
    for (let i = 0; i < (HIGH ? 130 : 70); i++) {
      const a = rand() * Math.PI * 2
      const r = 17 + rand() * 50
      addPatch(Math.cos(a) * r + 6, Math.sin(a) * r - 10, 1 + rand() * 2, rand() < 0.35)
    }
    // borders of flowers along the footpaths
    for (const path of MEADOW_PATHS)
      for (let i = 0; i < path.length - 1; i++) {
        const [ax, az] = path[i]
        const [bx, bz] = path[i + 1]
        const l = Math.hypot(bx - ax, bz - az)
        for (let d = 1; d < l; d += 2.6) {
          const t = d / l
          const side = rand() < 0.5 ? -1 : 1
          const off = 1.2 + rand() * 0.6
          addPatch(ax + (bx - ax) * t - ((bz - az) / l) * off * side, az + (bz - az) * t + ((bx - ax) / l) * off * side, 0.7 + rand() * 0.5, true)
        }
      }
    const list = []
    for (const p of patches)
      for (let k = 0; k < p.n; k++) {
        const ang = rand() * Math.PI * 2
        const rr = Math.sqrt(rand()) * p.r
        const x = p.x + Math.cos(ang) * rr
        const z = p.z + Math.sin(ang) * rr
        if (!openMeadow(x, z, { water: 0.1 })) continue
        const s = 0.05 + rand() * 0.035
        list.push({ x, z, y: meadowHeight(x, z), s, color: rand() > 0.35 ? p.a : p.b, rot: rand() * Math.PI })
      }
    return list.slice(0, HIGH ? 5000 : 2200)
  }, [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const c = new THREE.Color()
    items.forEach((f, i) => {
      m.compose(new THREE.Vector3(f.x, f.y + f.s * 0.9, f.z), q.setFromEuler(new THREE.Euler(0, f.rot, 0)), new THREE.Vector3(f.s * 1.6, f.s * 0.7, f.s * 1.6))
      petals.current.setMatrixAt(i, m)
      petals.current.setColorAt(i, c.set(f.color))
      m.compose(new THREE.Vector3(f.x, f.y + f.s * 1.3, f.z), q.identity(), new THREE.Vector3(f.s * 0.5, f.s * 0.4, f.s * 0.5))
      centres.current.setMatrixAt(i, m)
    })
    ;[petals.current, centres.current].forEach((mesh) => {
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.computeBoundingSphere()
    })
  }, [items])
  return (
    <group>
      {/* low-poly blooms: twice as many flowers for the same cost */}
      <instancedMesh ref={petals} args={[null, petalMat, items.length]}>
        <icosahedronGeometry args={[1, 0]} />
      </instancedMesh>
      <instancedMesh ref={centres} args={[null, centreMat, items.length]}>
        <octahedronGeometry args={[1, 0]} />
      </instancedMesh>
    </group>
  )
}

/** Soft tufts of grass across the near meadow (the same tufts as on the places themselves). */
function MeadowGrass() {
  const ref = useRef()
  const geometry = useMemo(bladeGeometry, [])
  const material = useMemo(() => windMaterial({ bendFrom: 0, amount: 0.6, vertexColors: true, side: THREE.DoubleSide, roughness: 0.95, litBothSides: true }), [])
  const items = useMemo(() => {
    const rand = seeded(9090)
    const list = []
    const max = HIGH ? 6500 : 2400
    for (let i = 0; i < max * 3 && list.length < max; i++) {
      const a = rand() * Math.PI * 2
      const r = 15 + Math.sqrt(rand()) * 50
      const x = Math.cos(a) * r + 4
      const z = Math.sin(a) * r - 8
      if (!openMeadow(x, z, { water: 0.2 })) continue
      // patches of taller, wilder grass out in the meadow
      const wild = Math.sin(x * 0.19 + 0.8) * Math.cos(z * 0.23 - 1.1) > 0.55
      list.push({ x, z, y: meadowHeight(x, z), h: wild ? 0.42 + rand() * 0.28 : 0.24 + rand() * 0.2, r: rand() * Math.PI, color: grassTint(x, z) })
    }
    return list
  }, [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    items.forEach((it, i) => {
      const spread = 0.45 + it.h
      m.compose(new THREE.Vector3(it.x, it.y, it.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, it.r, 0)), new THREE.Vector3(spread, it.h, spread))
      ref.current.setMatrixAt(i, m)
      ref.current.setColorAt(i, tintColor.set(it.color))
    })
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.instanceColor.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [items])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} receiveShadow />
}

/** Copses of trees out in the meadow, and smooth stones along the river. */
function useMeadowTrees() {
  return useMemo(() => {
    const rand = seeded(5151)
    const kinds = { round: [], tall: [], blossom: [] }
    const copses = HIGH ? 22 : 13
    for (let c = 0; c < copses; c++) {
      const a = rand() * Math.PI * 2
      const r = 24 + rand() * 60
      const cx = Math.cos(a) * r + 6
      const cz = Math.sin(a) * r - 10
      const n = 2 + Math.floor(rand() * 4)
      for (let k = 0; k < n; k++) {
        const x = cx + (rand() - 0.5) * 7
        const z = cz + (rand() - 0.5) * 7
        if (!openMeadow(x, z, { tall: true, water: 1.2 })) continue
        const kind = rand() < 0.3 ? 'blossom' : rand() < 0.5 ? 'tall' : 'round'
        const s = 1.1 + rand() * 0.7
        kinds[kind].push({ x, z, y: meadowHeight(x, z) - 0.05, s, r: rand() * 6 })
        addCollider(x, z, 0.28 * s)
      }
    }
    return kinds
  }, [])
}

function RiverStones() {
  const items = useMemo(() => {
    const rand = seeded(616)
    const list = []
    for (let i = 0; i < (HIGH ? 70 : 36); i++) {
      // along the banks of the river, and around the pond
      const onPond = i % 5 === 0
      let x
      let z
      if (onPond) {
        const a = rand() * Math.PI * 2
        x = POND.x + Math.cos(a) * POND.r * (1.0 + rand() * 0.15)
        z = POND.z + Math.sin(a) * POND.r * (1.0 + rand() * 0.15)
      } else {
        const seg = Math.floor(rand() * 9)
        const t = rand()
        const pts = [
          [-19.8, -16.6], [-14.5, -19.8], [-8.0, -21.5], [0.0, -21.0], [7.0, -19.0], [14.0, -13.6], [19.0, -8.0], [23.0, 2.0], [27.0, 14.0], [31.0, 25.0],
        ]
        const [ax, az] = pts[seg]
        const [bx, bz] = pts[seg + 1]
        const dx = bx - ax
        const dz = bz - az
        const l = Math.hypot(dx, dz)
        const side = (rand() < 0.5 ? -1 : 1) * (RIVER_HALF_WIDTH + 0.1 + rand() * 0.6)
        x = ax + dx * t - (dz / l) * side
        z = az + dz * t + (dx / l) * side
      }
      if (Math.hypot(x, z) - edgeRadius(x, z) < 1) continue
      const s = 0.18 + rand() * 0.32
      list.push({ x, z, y: meadowHeight(x, z) - s * 0.35, s, r: rand() * 6, color: ['#d9d0e0', '#cdc4d8', '#e2dace', '#c8c0cf'][i % 4] })
    }
    return list
  }, [])
  return <Rocks items={items} />
}

/* ───────── the giant tree ───────── */

/** A tree so big it's a landmark from anywhere: a flared, twisting trunk, great limbs, a cloud of blossom. */
function giantTreeGeometry() {
  const parts = []
  const color = new THREE.Color()
  const paint = (g, hex, vary = 0.1, seed = 1) => {
    const n = g.attributes.position.count
    const arr = new Float32Array(n * 3)
    const base = new THREE.Color(hex)
    for (let i = 0; i < n; i++) {
      const y = g.attributes.position.getY(i)
      color.copy(base).multiplyScalar(1 - vary + vary * 2 * (0.5 + 0.5 * Math.sin(i * 1.7 + seed + y)))
      arr.set([color.r, color.g, color.b], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
    g.deleteAttribute('uv')
    return g.index ? g.toNonIndexed() : g
  }
  // the trunk: wide at the foot, twisting a little as it rises
  const trunk = new THREE.CylinderGeometry(0.85, 1.7, 8, 14, 10)
  const p = trunk.attributes.position
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) + 4
    const twist = y * 0.09
    const x = p.getX(i)
    const z = p.getZ(i)
    const flare = 1 + Math.max(0, 1.4 - y) * 0.35 + 0.08 * Math.sin(Math.atan2(z, x) * 5 + y)
    p.setXYZ(i, (x * Math.cos(twist) - z * Math.sin(twist)) * flare, y, (x * Math.sin(twist) + z * Math.cos(twist)) * flare)
  }
  parts.push(paint(trunk, '#9a7462', 0.12, 2))
  // roots spreading over the knoll
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.3
    const root = new THREE.ConeGeometry(0.42, 3.2, 7)
    root.rotateZ(Math.PI / 2 - 0.25)
    root.rotateY(-a)
    root.translate(Math.cos(a) * 1.7, 0.25, Math.sin(a) * 1.7)
    parts.push(paint(root, '#8d6a58', 0.1, k))
  }
  // great limbs reaching out and up
  const limbs = [
    [0.4, 6.4, 0.9],
    [2.3, 6.8, 0.8],
    [3.9, 6.2, 0.95],
    [5.3, 7.0, 0.75],
  ]
  limbs.forEach(([a, y, tilt], k) => {
    const limb = new THREE.CylinderGeometry(0.28, 0.55, 4.2, 8)
    limb.translate(0, 2.1, 0)
    limb.rotateZ(-tilt)
    limb.rotateY(-a)
    limb.translate(0, y, 0)
    parts.push(paint(limb, '#9a7462', 0.1, k + 9))
  })
  // the crown: big soft clouds of blossom, lavender and mint, layered into a dome
  const rand = seeded(777)
  const crown = []
  for (let k = 0; k < 18; k++) {
    const a = rand() * Math.PI * 2
    const r = k < 6 ? 1.5 + rand() : 3 + rand() * 2.6
    const y = 9 + (k < 6 ? 2.6 : rand() * 2.2) + (r < 3 ? 1.2 : 0)
    crown.push([Math.cos(a) * r, y, Math.sin(a) * r, 1.9 + rand() * 1.3])
  }
  crown.forEach(([x, y, z, s], k) => {
    const blob = new THREE.IcosahedronGeometry(1, 2)
    blob.scale(s, s * 0.82, s)
    blob.translate(x, y, z)
    parts.push(paint(blob, ['#f7b6d2', '#f9c9de', '#dcc6f4', '#f4a9c9', '#bfe6c4'][k % 5], 0.08, k * 3))
  })
  const merged = mergeGeometries(parts.map((g) => (g.attributes.normal ? (g.deleteAttribute('normal'), g) : g)))
  parts.forEach((g) => g.dispose())
  merged.computeVertexNormals()
  return merged
}

function GiantTree() {
  const lanterns = useRef()
  const geometry = useMemo(giantTreeGeometry, [])
  const material = useMemo(() => withPaint(windMaterial({ bendFrom: 8, amount: 0.004, vertexColors: true, roughness: 0.8 }), 'foliage'), [])
  useEffect(() => () => geometry.dispose(), [geometry])
  const base = useMemo(() => {
    addCollider(GIANT_TREE.x, GIANT_TREE.z, 2.1) // its trunk and roots
    return new THREE.Vector3(GIANT_TREE.x, meadowHeight(GIANT_TREE.x, GIANT_TREE.z) - 0.2, GIANT_TREE.z)
  }, [])
  // a few little lights hanging in the crown (they glow brighter as the sky darkens)
  const lights = useMemo(() => {
    const rand = seeded(31)
    return Array.from({ length: 9 }, () => {
      const a = rand() * Math.PI * 2
      const r = 2.4 + rand() * 3
      return [Math.cos(a) * r, 7.6 + rand() * 1.6, Math.sin(a) * r]
    })
  }, [])
  useFrame(() => {
    const k = 0.35 + 0.65 * (1 - atmosphere.day) + atmosphere.sunset * 0.3
    lanterns.current.children.forEach((c) => (c.material.opacity = Math.min(1, k)))
  })
  return (
    <group position={base}>
      <mesh geometry={geometry} material={material} castShadow receiveShadow />
      <group ref={lanterns}>
        {lights.map((p, i) => (
          <Glow key={i} position={p} color={i % 2 ? '#ffd9a0' : '#ffc2e0'} size={1.1} opacity={0.6} />
        ))}
      </group>
    </group>
  )
}

/** The ways across the river: little arched footbridges and lines of flat stepping stones. */
function Crossings() {
  const parts = useMemo(() => {
    const planks = []
    const stones = []
    const rails = []
    for (const c of CROSSINGS) {
      const yaw = Math.atan2(c.ux, c.uz)
      if (c.kind === 'bridge') {
        const n = Math.round((c.half * 2) / 0.3)
        for (let i = 0; i <= n; i++) {
          const t = -1 + (2 * i) / n
          const x = c.x + c.ux * c.half * t
          const z = c.z + c.uz * c.half * t
          planks.push({ x, y: standHeight(x, z) - 0.04, z, yaw, w: c.width * 2 })
        }
        for (const side of [-1, 1])
          for (let i = 0; i <= 4; i++) {
            const t = -1 + i / 2
            const x = c.x + c.ux * c.half * t - c.uz * c.width * side
            const z = c.z + c.uz * c.half * t + c.ux * c.width * side
            rails.push({ x, y: standHeight(c.x + c.ux * c.half * t, c.z + c.uz * c.half * t), z })
          }
      } else {
        for (let i = 0; i < 6; i++) {
          const t = -0.9 + (1.8 * i) / 5
          const x = c.x + c.ux * c.half * t + (i % 2 ? 0.08 : -0.08) * c.uz
          const z = c.z + c.uz * c.half * t - (i % 2 ? 0.08 : -0.08) * c.ux
          stones.push({ x, y: standHeight(x, z) - 0.06, z, r: i * 1.3 })
        }
      }
    }
    return { planks, stones, rails }
  }, [])
  return (
    <group>
      {parts.planks.map((p, i) => (
        <mesh key={'p' + i} position={[p.x, p.y, p.z]} rotation={[0, p.yaw, 0]} castShadow receiveShadow>
          <boxGeometry args={[p.w, 0.08, 0.26]} />
          <meshStandardMaterial color={i % 3 ? '#c9a07c' : '#b88f6c'} roughness={0.85} />
        </mesh>
      ))}
      {parts.rails.map((p, i) => (
        <mesh key={'r' + i} position={[p.x, p.y + 0.3, p.z]} castShadow>
          <cylinderGeometry args={[0.04, 0.05, 0.62, 6]} />
          <meshStandardMaterial color="#a77f5f" roughness={0.85} />
        </mesh>
      ))}
      {parts.stones.map((p, i) => (
        <mesh key={'s' + i} position={[p.x, p.y, p.z]} rotation={[0, p.r, 0]} scale={[0.42, 0.12, 0.34]} castShadow receiveShadow>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={['#d9d0e0', '#cfc6d8', '#e0d8cc'][i % 3]} roughness={0.8} flatShading />
        </mesh>
      ))}
    </group>
  )
}

/* ───────── more life: lanterns, lupins, bushes, mushrooms, benches, butterflies, fireflies ───────── */

/** Little lanterns along the footpaths: a soft bulb by day, warm and bright as evening and night come. */
function MeadowLanterns() {
  const posts = useRef()
  const bulbs = useRef()
  const reducedMotion = useStore((s) => s.reducedMotion)
  const items = useMemo(() => {
    const list = []
    MEADOW_PATHS.forEach((path, k) => {
      for (let i = 0; i < path.length - 1; i++) {
        const [ax, az] = path[i]
        const [bx, bz] = path[i + 1]
        const l = Math.hypot(bx - ax, bz - az)
        for (let d = 1.5; d < l; d += 5) {
          const t = d / l
          const side = (i + k + Math.round(d)) % 2 ? 0.85 : -0.85
          const x = ax + (bx - ax) * t - ((bz - az) / l) * side
          const z = az + (bz - az) * t + ((bx - ax) / l) * side
          if (riverAt(x, z).d < RIVER_HALF_WIDTH + 0.6 || crossingAt(x, z)) continue
          list.push({ x, z, y: meadowHeight(x, z), phase: list.length * 1.7 })
        }
      }
    })
    return list
  }, [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    items.forEach((l, i) => {
      m.compose(new THREE.Vector3(l.x, l.y + 0.45, l.z), q, new THREE.Vector3(1, 1, 1))
      posts.current.setMatrixAt(i, m)
      m.compose(new THREE.Vector3(l.x, l.y + 0.98, l.z), q, new THREE.Vector3(1, 1, 1))
      bulbs.current.setMatrixAt(i, m)
    })
    posts.current.instanceMatrix.needsUpdate = true
    bulbs.current.instanceMatrix.needsUpdate = true
    posts.current.computeBoundingSphere()
    bulbs.current.computeBoundingSphere()
  }, [items])
  const color = useMemo(() => new THREE.Color(), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const glow = 0.4 + 0.6 * Math.max(atmosphere.sunset * 0.8, 1 - atmosphere.day)
    items.forEach((l, i) => {
      const flicker = reducedMotion ? 1 : 0.9 + 0.1 * Math.sin(t * 3 + l.phase)
      const k = glow * flicker
      bulbs.current.setColorAt(i, color.setRGB(2.8 * k, 1.9 * k, 1.1 * k))
    })
    bulbs.current.instanceColor.needsUpdate = true
  })
  return (
    <group>
      <instancedMesh ref={posts} args={[null, null, items.length]} castShadow>
        <cylinderGeometry args={[0.035, 0.05, 0.9, 6]} />
        <meshStandardMaterial color="#8d6a58" roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={bulbs} args={[null, null, items.length]}>
        <sphereGeometry args={[0.09, 10, 8]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <LightPools points={items} />
    </group>
  )
}

/** Tall spires of lupins: lavender, pink and white, in a few dense, dreamy drifts. */
function Lupins() {
  const ref = useRef()
  const material = useMemo(() => windMaterial({ bendFrom: 0, amount: 0.16, roughness: 0.6, emissive: '#c9a8ff', emissiveIntensity: 0.05 }), [])
  const items = useMemo(() => {
    const rand = seeded(1717)
    const colors = ['#c9b0ff', '#e3c6ff', '#ffb3d6', '#ffffff', '#b59cf2', '#ffd1e8']
    const centres = [
      [KNOLL.x - 9, KNOLL.z + 6],
      [KNOLL.x + 7, KNOLL.z + 8],
      [POND.x - 9, POND.z - 6],
      [POND.x + 3, POND.z - 10],
      [18, 26],
      [-20, -28],
      [38, 10],
      [-22, 14],
      [30, -18],
      [8, 30],
    ]
    const list = []
    for (const [cx, cz] of centres)
      for (let k = 0; k < (HIGH ? 40 : 20); k++) {
        const a = rand() * Math.PI * 2
        const rr = Math.sqrt(rand()) * 3.2
        const x = cx + Math.cos(a) * rr
        const z = cz + Math.sin(a) * rr
        if (!openMeadow(x, z, { water: 0.3 })) continue
        list.push({ x, z, y: meadowHeight(x, z), h: 0.35 + rand() * 0.4, color: colors[Math.floor(rand() * colors.length)] })
      }
    return list
  }, [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const c = new THREE.Color()
    items.forEach((it, i) => {
      m.compose(new THREE.Vector3(it.x, it.y + it.h * 0.5 + 0.12, it.z), q, new THREE.Vector3(it.h * 0.16, it.h, it.h * 0.16))
      ref.current.setMatrixAt(i, m)
      ref.current.setColorAt(i, c.set(it.color))
    })
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.instanceColor.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [items])
  return (
    <instancedMesh ref={ref} args={[null, material, items.length]}>
      <coneGeometry args={[1, 1, 6]} />
    </instancedMesh>
  )
}

/** Round bushes, some of them in blossom, scattered through the meadow and along the paths. */
function Bushes() {
  const ref = useRef()
  const material = useMemo(() => withPaint(new THREE.MeshStandardMaterial({ roughness: 0.85 }), 'foliage'), [])
  const items = useMemo(() => {
    const rand = seeded(2323)
    const colors = ['#79c27c', '#8fd18a', '#6db382', '#a6d98c', '#f4b6cf', '#e6c6f2']
    const list = []
    for (let i = 0; i < (HIGH ? 400 : 200) && list.length < (HIGH ? 100 : 50); i++) {
      const a = rand() * Math.PI * 2
      const r = 17 + rand() * 52
      const x = Math.cos(a) * r + 6
      const z = Math.sin(a) * r - 10
      if (!openMeadow(x, z, { water: 0.6 }) || meadowPathDistance(x, z) < 1.2) continue
      const sz = 0.35 + rand() * 0.45
      // a bush is two or three soft blobs
      const n = 2 + Math.floor(rand() * 2)
      const color = colors[Math.floor(rand() * colors.length)]
      for (let k = 0; k < n; k++)
        list.push({ x: x + (rand() - 0.5) * sz, z: z + (rand() - 0.5) * sz, y: meadowHeight(x, z) + sz * 0.45, s: sz * (0.7 + rand() * 0.4), color })
      addCollider(x, z, sz * 0.8)
    }
    return list
  }, [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const c = new THREE.Color()
    items.forEach((it, i) => {
      m.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.s, it.s * 0.82, it.s))
      ref.current.setMatrixAt(i, m)
      ref.current.setColorAt(i, c.set(it.color))
    })
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.instanceColor.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [items])
  return (
    <instancedMesh ref={ref} args={[null, material, items.length]} castShadow receiveShadow>
      <icosahedronGeometry args={[1, 1]} />
    </instancedMesh>
  )
}

/** Little rings of mushrooms in the shade (soft pinks, lilac and cream). */
function Mushrooms() {
  const stems = useRef()
  const caps = useRef()
  const items = useMemo(() => {
    const rand = seeded(3131)
    const caps = ['#ff9fbf', '#f7c6dd', '#d9c2ff', '#fff1d6', '#ff8fa8']
    const list = []
    const rings = HIGH ? 18 : 10
    for (let i = 0; i < rings * 4 && list.length < rings * 6; i++) {
      const a = rand() * Math.PI * 2
      const r = 18 + rand() * 48
      const cx = Math.cos(a) * r + 6
      const cz = Math.sin(a) * r - 10
      if (!openMeadow(cx, cz, { water: 0.3 })) continue
      const n = 3 + Math.floor(rand() * 5)
      const color = caps[Math.floor(rand() * caps.length)]
      for (let k = 0; k < n; k++) {
        const b = (k / n) * Math.PI * 2 + rand() * 0.4
        const x = cx + Math.cos(b) * 0.35
        const z = cz + Math.sin(b) * 0.35
        list.push({ x, z, y: meadowHeight(x, z), s: 0.06 + rand() * 0.07, color })
      }
    }
    return list
  }, [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const c = new THREE.Color()
    items.forEach((it, i) => {
      m.compose(new THREE.Vector3(it.x, it.y + it.s * 0.9, it.z), q, new THREE.Vector3(it.s * 0.35, it.s * 1.8, it.s * 0.35))
      stems.current.setMatrixAt(i, m)
      m.compose(new THREE.Vector3(it.x, it.y + it.s * 1.8, it.z), q, new THREE.Vector3(it.s, it.s * 0.7, it.s))
      caps.current.setMatrixAt(i, m)
      caps.current.setColorAt(i, c.set(it.color))
    })
    ;[stems.current, caps.current].forEach((mesh) => {
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.computeBoundingSphere()
    })
  }, [items])
  return (
    <group>
      <instancedMesh ref={stems} args={[null, null, items.length]}>
        <cylinderGeometry args={[1, 1, 1, 6]} />
        <meshStandardMaterial color="#fff6ea" roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={caps} args={[null, null, items.length]}>
        <sphereGeometry args={[1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial roughness={0.5} emissive="#ff9fc8" emissiveIntensity={0.06} />
      </instancedMesh>
    </group>
  )
}

/** Benches to sit and look: by the pond, under the giant tree, and where a path meets the river. */
function MeadowBenches() {
  const benches = useMemo(() => {
    const at = (x, z, faceX, faceZ) => ({ x, z, y: meadowHeight(x, z), yaw: Math.atan2(faceX - x, faceZ - z) })
    const list = [
      at(POND.x - POND.r - 1.6, POND.z - 1.5, POND.x, POND.z),
      at(POND.x + 0.5, POND.z - POND.r - 1.7, POND.x, POND.z),
      at(GIANT_TREE.x - 2.8, GIANT_TREE.z + 3.2, GIANT_TREE.x - 8, GIANT_TREE.z + 10),
      at(GIANT_TREE.x + 3.4, GIANT_TREE.z + 2.4, GIANT_TREE.x + 9, GIANT_TREE.z + 9),
    ]
    list.forEach((b) => addCollider(b.x, b.z, 0.55))
    return list
  }, [])
  return benches.map((b, i) => <Bench key={i} position={[b.x, b.y, b.z]} rotation={[0, b.yaw, 0]} />)
}

/** Fireflies over the meadow once the sun is down: by the pond, the river, the giant tree, the paths. */
function NightFireflies() {
  const night = useNight()
  if (!night) return null
  const spots = [
    [POND.x, meadowHeight(POND.x, POND.z) + 0.8, POND.z, 16],
    [GIANT_TREE.x, meadowHeight(GIANT_TREE.x, GIANT_TREE.z) + 1.2, GIANT_TREE.z, 18],
    [7, -1.2, -19, 20],
    [21, -1.2, -3, 14],
    [-11, -1, -21, 14],
    [18, -0.8, 18, 18],
  ]
  return spots.map(([x, y, z, size], i) => (
    <Fireflies key={i} count={HIGH ? 40 : 18} area={[size, 3, size]} center={[x, y, z]} size={0.14} seed={700 + i} colors={['#fff1a8', '#ffe0f0', '#d8ffcf']} />
  ))
}
/** True while it's night (read from the shared time of day; re-renders only when that changes). */
function useNight() {
  const [night, setNight] = useState(false)
  const last = useRef(false)
  useFrame(() => {
    const n = atmosphere.day < 0.45
    if (n !== last.current) {
      last.current = n
      setNight(n)
    }
  })
  return night
}

/** Butterflies over the flower fields (asleep at night). */
function MeadowButterflies() {
  const homes = useMemo(
    () => [
      { x: KNOLL.x - 8, z: KNOLL.z + 6 },
      { x: KNOLL.x + 6, z: KNOLL.z + 7 },
      { x: POND.x - 8, z: POND.z - 5 },
      { x: POND.x + 2, z: POND.z - 9 },
      { x: 18, z: 24 },
      { x: -18, z: -27 },
      { x: 36, z: 8 },
      { x: 26, z: -8 },
      { x: -20, z: 12 },
      { x: 10, z: 28 },
    ],
    [],
  )
  return <Butterflies homes={homes} amount={HIGH ? 22 : 11} seed={909} />
}

/** The whole meadow. */
export default function Meadow() {
  const trees = useMeadowTrees()
  return (
    <group>
      <MeadowGround />
      <SkyCliff />
      <River />
      <Crossings />
      <Pond />
      <MeadowGrass />
      <MeadowFlowers />
      <RiverStones />
      <TreeKind kind="round" items={trees.round} />
      <TreeKind kind="tall" items={trees.tall} />
      <TreeKind kind="blossom" items={trees.blossom} />
      <GiantTree />
      <MeadowLanterns />
      <Lupins />
      <Bushes />
      <Mushrooms />
      <MeadowBenches />
      <MeadowButterflies />
      <NightFireflies />
    </group>
  )
}
