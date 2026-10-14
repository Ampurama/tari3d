import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { loveTree } from '../../lib/layout'
import { addCollider, seeded } from '../../lib/terrain'
import { journeyProgress } from '../../lib/story'
import { heartPoint } from '../../lib/heart'
import { glowTexture } from '../../lib/textures'
import { CINE, cineTime, windowAt } from '../../lib/cinematic'
import { tier } from '../../lib/device'
import { FACE_CAMERA } from '../../lib/iso'
import { withPaint } from '../../lib/paint'
import { useStore } from '../../store'
import { Glow } from './Bits'
import { DriftParticles } from './Particles'

/*
 * THE CENTRAL LOVE TREE — the island's signature landmark.
 * A twisting trunk splits into spiralling branches. Its blossom, lanterns and glow grow with
 * the whole journey (flowers, little things, the bridge, the picnic). After the ending its
 * branch tips are joined by faint lines of light, like a constellation.
 */

const BRANCHES = 9
/** The Love Tree is the island's landmark: a little larger than life. */
const TREE_SCALE = 1.15

function buildTree() {
  const rand = seeded(777)
  const tubes = []
  const tips = []
  // the trunk: two strands twisting around each other
  const trunkPts = (phase) =>
    Array.from({ length: 9 }, (_, i) => {
      const t = i / 8
      const a = phase + t * 2.4
      const r = 0.22 * (1 - t * 0.6)
      return new THREE.Vector3(Math.cos(a) * r, t * 3.0, Math.sin(a) * r)
    })
  ;[0, Math.PI].forEach((ph) => {
    const curve = new THREE.CatmullRomCurve3(trunkPts(ph))
    tubes.push(new THREE.TubeGeometry(curve, 40, 0.24, 10, false))
  })
  // branches spiral out from the top of the trunk
  for (let i = 0; i < BRANCHES; i++) {
    const a = (i / BRANCHES) * Math.PI * 2 + rand() * 0.4
    const startY = 2.3 + rand() * 0.8
    const len = 1.9 + rand() * 1.1
    const lift = 1.0 + rand() * 1.0
    const pts = [
      new THREE.Vector3(Math.cos(a) * 0.12, startY, Math.sin(a) * 0.12),
      new THREE.Vector3(Math.cos(a + 0.25) * len * 0.45, startY + lift * 0.55, Math.sin(a + 0.25) * len * 0.45),
      new THREE.Vector3(Math.cos(a + 0.45) * len * 0.85, startY + lift * 0.85, Math.sin(a + 0.45) * len * 0.85),
      new THREE.Vector3(Math.cos(a + 0.6) * len, startY + lift * 0.7, Math.sin(a + 0.6) * len),
    ]
    const curve = new THREE.CatmullRomCurve3(pts)
    tubes.push(new THREE.TubeGeometry(curve, 16, 0.075, 6, false))
    tips.push(pts[3].clone())
    // a small twig near each tip
    const twig = new THREE.CatmullRomCurve3([pts[2], pts[2].clone().add(new THREE.Vector3(Math.cos(a - 0.8) * 0.5, 0.5, Math.sin(a - 0.8) * 0.5))])
    tubes.push(new THREE.TubeGeometry(twig, 6, 0.035, 5, false))
    tips.push(twig.getPoint(1))
  }
  // roots spreading over the hill
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.2, 0.25, Math.sin(a) * 0.2),
      new THREE.Vector3(Math.cos(a) * 0.7, 0.02, Math.sin(a) * 0.7),
      new THREE.Vector3(Math.cos(a + 0.2) * 1.3, -0.08, Math.sin(a + 0.2) * 1.3),
    ])
    tubes.push(new THREE.TubeGeometry(curve, 10, 0.08, 6, false))
  }
  const wood = mergeGeometries(tubes.map((t) => t.toNonIndexed()), false)
  tubes.forEach((t) => t.dispose())
  wood.computeVertexNormals()

  // blossom clusters around every tip (revealed progressively)
  const blossoms = []
  tips.forEach((tip, k) => {
    for (let j = 0; j < 9; j++) {
      const u = rand() * 2 - 1
      const a = rand() * Math.PI * 2
      const r = 0.25 + rand() * 0.55
      const s = Math.sqrt(1 - u * u)
      blossoms.push({ p: tip.clone().add(new THREE.Vector3(Math.cos(a) * s * r, u * r * 0.7 + 0.1, Math.sin(a) * s * r)), s: 0.1 + rand() * 0.12, order: rand(), tip: k })
    }
  })
  blossoms.sort((x, y) => x.order - y.order)
  // soft green leaf clouds around every tip (they fill out as the journey goes on)
  const leaves = []
  tips.forEach((tip) => {
    for (let j = 0; j < 4; j++) {
      const a = rand() * Math.PI * 2
      const r = 0.15 + rand() * 0.35
      leaves.push({ p: tip.clone().add(new THREE.Vector3(Math.cos(a) * r, -0.05 + rand() * 0.35, Math.sin(a) * r)), s: 0.32 + rand() * 0.24, shade: rand() })
    }
  })
  return { wood, tips, blossoms, leaves }
}

/**
 * Stars rising from the tree and gathering into a heart-shaped constellation above it —
 * animated during the final cinematic, and staying in the sky afterwards.
 */
function TreeConstellation({ tips }) {
  const N = tier === 'high' ? 260 : 140
  const view = useStore((s) => s.view)
  const formed = useStore((s) => s.mainEndingSeen)
  const { geometry, starts, targets } = useMemo(() => {
    const rand = seeded(1313)
    const starts = new Float32Array(N * 3)
    const targets = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      const tip = tips[i % tips.length]
      starts.set([tip.x + (rand() - 0.5) * 0.6, tip.y + (rand() - 0.5) * 0.6, tip.z + (rand() - 0.5) * 0.6], i * 3)
      const [hx, hy] = heartPoint((i / N) * Math.PI * 2)
      const r = i % 4 === 0 ? 0.55 + rand() * 0.4 : 1
      // the heart of stars faces the 2.5D camera
      const x = hx * 3.2 * r
      const z = (rand() - 0.5) * 0.6
      targets.set([x * Math.cos(FACE_CAMERA) + z * Math.sin(FACE_CAMERA), 9 + hy * 3.2 * r, -x * Math.sin(FACE_CAMERA) + z * Math.cos(FACE_CAMERA)], i * 3)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(starts.slice(), 3))
    return { geometry, starts, targets }
  }, [N, tips])
  const material = useMemo(
    () =>
      new THREE.PointsMaterial({ size: 0.16, map: glowTexture(), color: new THREE.Color(2.6, 2.2, 2.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    [],
  )
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )
  useFrame(({ clock }) => {
    // scene 3 of the cinematic runs from 18s to 27s
    const t = view === 'cinematic' ? cineTime(clock.elapsedTime) : formed ? 99 : 0
    const k = windowAt(CINE.bloom, t)
    const pos = geometry.attributes.position
    for (let i = 0; i < N; i++) {
      const d = Math.min(1, Math.max(0, k * 1.4 - (i / N) * 0.4))
      const e = d * d * (3 - 2 * d)
      pos.setXYZ(i, starts[i * 3] + (targets[i * 3] - starts[i * 3]) * e, starts[i * 3 + 1] + (targets[i * 3 + 1] - starts[i * 3 + 1]) * e, starts[i * 3 + 2] + (targets[i * 3 + 2] - starts[i * 3 + 2]) * e)
    }
    pos.needsUpdate = true
    material.opacity = view === 'cinematic' ? windowAt([CINE.bloom[0] - 0.5, CINE.bloom[0] + 1.5], t) : formed ? 0.85 : 0
  })
  if (view !== 'cinematic' && !formed) return null
  return <points geometry={geometry} material={material} frustumCulled={false} />
}

const GREENS = ['#7cc683', '#90d18d', '#6db97a', '#a3d995'].map((c) => new THREE.Color(c))
const PINKS = ['#ffb3d6', '#ffd6ea', '#f490bb', '#fff0f6', '#e9b3f0'].map((c) => new THREE.Color(c))

export default function LoveTree() {
  const { wood, tips, blossoms, leaves } = useMemo(buildTree, [])
  const bloomRef = useRef()
  const leafRef = useRef()
  const leafLevel = useRef(-1)
  const lanterns = useRef([])
  const halo = useRef()
  const light = useRef()
  const shown = useRef(-1)
  const progress = useStore(journeyProgress)
  const ending = useStore((s) => s.mainEndingSeen || s.view === 'epilogue')
  const inFinale = useStore((s) => s.view === 'cinematic')
  const reducedMotion = useStore((s) => s.reducedMotion)
  const baseLevel = ending ? 1 : progress
  const maxBloom = blossoms.length
  const woodMat = useMemo(() => withPaint(new THREE.MeshStandardMaterial({ color: '#9b6b4f', roughness: 0.8, emissive: '#5a3520', emissiveIntensity: 0.08 }), 'rock'), [])
  const bloomMat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.55, emissive: '#ff7fb2', emissiveIntensity: 0.2 }), [])
  const leafMat = useMemo(() => withPaint(new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true }), 'foliage'), [])
  const lanternSpots = useMemo(() => tips.filter((_, i) => i % 2 === 0).map((p) => p.clone().add(new THREE.Vector3(0, -0.35, 0))), [tips])

  useEffect(() => {
    addCollider(loveTree.x, loveTree.z, 0.75 * TREE_SCALE)
  }, [])
  useEffect(() => () => wood.dispose(), [wood])
  useEffect(
    () => () => {
      woodMat.dispose()
      bloomMat.dispose()
      leafMat.dispose()
    },
    [woodMat, bloomMat, leafMat],
  )

  // place every blossom once; growth is done by scaling them in
  useLayoutEffect(() => {
    const color = new THREE.Color()
    blossoms.forEach((b, i) => bloomRef.current.setColorAt(i, color.copy(PINKS[i % PINKS.length])))
    bloomRef.current.instanceColor.needsUpdate = true
    leaves.forEach((l, i) => leafRef.current.setColorAt(i, color.copy(GREENS[Math.floor(l.shade * GREENS.length)])))
    leafRef.current.instanceColor.needsUpdate = true
  }, [blossoms, leaves])

  const m = useMemo(() => new THREE.Matrix4(), [])
  const scales = useMemo(() => new Float32Array(blossoms.length), [blossoms])
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    // in the finale it blooms completely at the moment the hearts rise
    const level = inFinale ? Math.max(baseLevel, windowAt(CINE.bloom, cineTime(t))) : baseLevel
    // at the start the tree is peaceful but already in leaf-and-blossom (so it reads as a tree from above)
    const target = Math.round(maxBloom * (0.45 + 0.55 * level))
    let dirty = false
    for (let i = 0; i < maxBloom; i++) {
      const goal = i < target ? 1 : 0
      const next = THREE.MathUtils.damp(scales[i], goal, 2.2, delta)
      if (Math.abs(next - scales[i]) > 0.001 || shown.current < 0) {
        scales[i] = next
        const b = blossoms[i]
        const sway = reducedMotion ? 0 : Math.sin(t * 1.3 + i) * 0.01
        m.compose(b.p.clone().setX(b.p.x + sway), new THREE.Quaternion(), new THREE.Vector3(b.s, b.s * 0.85, b.s).multiplyScalar(next))
        bloomRef.current.setMatrixAt(i, m)
        dirty = true
      }
    }
    if (dirty) bloomRef.current.instanceMatrix.needsUpdate = true
    // the leaves fill out with the journey (only re-laid when that changes)
    if (Math.abs(level - leafLevel.current) > 0.01) {
      leafLevel.current = level
      const k = 0.62 + 0.38 * level
      leaves.forEach((l, i) => {
        m.compose(l.p, new THREE.Quaternion(), new THREE.Vector3(l.s, l.s * 0.8, l.s).multiplyScalar(k))
        leafRef.current.setMatrixAt(i, m)
      })
      leafRef.current.instanceMatrix.needsUpdate = true
    }
    shown.current = target
    bloomRef.current.material.emissiveIntensity = 0.15 + level * 0.9 + (ending ? 0.3 * (0.5 + 0.5 * Math.sin(t * 1.2)) : 0)
    lanterns.current.forEach((l, i) => {
      if (!l) return
      const on = i / lanternSpots.length < level
      l.material.color.setScalar(THREE.MathUtils.damp(l.material.color.r, on ? 2.6 : 0.35, 2, delta))
      l.position.y = lanternSpots[i].y + (reducedMotion ? 0 : Math.sin(t * 1.4 + i) * 0.04)
    })
    halo.current.material.opacity = 0.05 + level * 0.25
    light.current.intensity = 1.5 + level * 7
  })

  return (
    <group position={loveTree} scale={TREE_SCALE}>
      <mesh geometry={wood} material={woodMat} castShadow receiveShadow />
      <instancedMesh ref={leafRef} args={[null, leafMat, leaves.length]} castShadow receiveShadow frustumCulled={false}>
        <icosahedronGeometry args={[1, 1]} />
      </instancedMesh>
      <instancedMesh ref={bloomRef} args={[null, bloomMat, maxBloom]} castShadow frustumCulled={false}>
        <icosahedronGeometry args={[1, 1]} />
      </instancedMesh>
      {lanternSpots.map((p, i) => (
        <mesh key={i} ref={(el) => (lanterns.current[i] = el)} position={p}>
          <sphereGeometry args={[0.07, 10, 8]} />
          <meshBasicMaterial color={[0.35, 0.35, 0.35]} toneMapped={false} />
        </mesh>
      ))}
      <Glow ref={halo} position={[0, 3.4, 0]} color="#ffb3d6" size={9} opacity={0.12} />
      <pointLight ref={light} position={[0, 3.2, 0.8]} color="#ffc8e2" intensity={2} distance={11} decay={1.6} />
      {ending && (
        <group>
          {tips.slice(0, -1).map((p, i) => (i % 2 === 0 ? <Line key={i} points={[p, tips[(i + 2) % tips.length]]} color="#ffe2f0" lineWidth={1.2} transparent opacity={0.55} toneMapped={false} /> : null))}
        </group>
      )}
      <TreeConstellation tips={tips} />
      <DriftParticles position={[0, 2.4, 0]} count={tier === 'high' ? 40 : 18} area={[6, 5, 6]} size={0.1} speed={0.28} direction={-1} texture="petal" intensity={0.6 + baseLevel} seed={71} />
    </group>
  )
}
