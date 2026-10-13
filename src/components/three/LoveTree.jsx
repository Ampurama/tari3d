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
import { cineTime } from '../../lib/cinematic'
import { tier } from '../../lib/device'
import { useStore } from '../../store'
import { Glow } from './Bits'
import { DriftParticles } from './Particles'

/*
 * THE CENTRAL LOVE TREE — the island's signature landmark.
 * A twisting trunk splits into spiralling branches. Its blossom, lanterns and glow grow with
 * the whole journey (memories found, connections restored, seeds grown). After the ending its
 * branch tips are joined by faint lines of light, like a constellation.
 */

const BRANCHES = 9

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
  return { wood, tips, blossoms }
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
      targets.set([hx * 3.2 * r, 9 + hy * 3.2 * r, (rand() - 0.5) * 0.6], i * 3)
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
    const k = THREE.MathUtils.clamp((t - 19) / 6, 0, 1)
    const pos = geometry.attributes.position
    for (let i = 0; i < N; i++) {
      const d = Math.min(1, Math.max(0, k * 1.4 - (i / N) * 0.4))
      const e = d * d * (3 - 2 * d)
      pos.setXYZ(i, starts[i * 3] + (targets[i * 3] - starts[i * 3]) * e, starts[i * 3 + 1] + (targets[i * 3 + 1] - starts[i * 3 + 1]) * e, starts[i * 3 + 2] + (targets[i * 3 + 2] - starts[i * 3 + 2]) * e)
    }
    pos.needsUpdate = true
    material.opacity = view === 'cinematic' ? Math.min(1, Math.max(0, (t - 18.5) / 1.5)) : formed ? 0.85 : 0
  })
  if (view !== 'cinematic' && !formed) return null
  return <points geometry={geometry} material={material} frustumCulled={false} />
}

const PINKS = ['#ffb3d6', '#ffd6ea', '#f490bb', '#fff0f6', '#e9b3f0'].map((c) => new THREE.Color(c))

export default function LoveTree() {
  const { wood, tips, blossoms } = useMemo(buildTree, [])
  const bloomRef = useRef()
  const lanterns = useRef([])
  const halo = useRef()
  const light = useRef()
  const shown = useRef(-1)
  const progress = useStore(journeyProgress)
  const ending = useStore((s) => s.mainEndingSeen || s.view === 'cinematic' || s.view === 'ending' || s.view === 'epilogue')
  const reducedMotion = useStore((s) => s.reducedMotion)
  const level = ending ? 1 : progress
  const maxBloom = blossoms.length
  const lanternSpots = useMemo(() => tips.filter((_, i) => i % 2 === 0).map((p) => p.clone().add(new THREE.Vector3(0, -0.35, 0))), [tips])

  useEffect(() => {
    addCollider(loveTree.x, loveTree.z, 0.75)
  }, [])
  useEffect(() => () => wood.dispose(), [wood])

  // place every blossom once; growth is done by scaling them in
  useLayoutEffect(() => {
    const color = new THREE.Color()
    blossoms.forEach((b, i) => bloomRef.current.setColorAt(i, color.copy(PINKS[i % PINKS.length])))
    bloomRef.current.instanceColor.needsUpdate = true
  }, [blossoms])

  const m = useMemo(() => new THREE.Matrix4(), [])
  const scales = useMemo(() => new Float32Array(blossoms.length), [blossoms])
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    // at the start the tree is peaceful but already a little magical (25% bloom)
    const target = Math.round(maxBloom * (0.25 + 0.75 * level))
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
    shown.current = target
    bloomRef.current.material.emissiveIntensity = 0.15 + level * 0.9 + (ending ? 0.3 * (0.5 + 0.5 * Math.sin(t * 1.2)) : 0)
    lanterns.current.forEach((l, i) => {
      if (!l) return
      const on = i / lanternSpots.length < level
      l.material.color.setScalar(THREE.MathUtils.damp(l.material.color.r, on ? 2.6 : 0.35, 2, delta))
      l.position.y = lanternSpots[i].y + (reducedMotion ? 0 : Math.sin(t * 1.4 + i) * 0.04)
    })
    halo.current.material.opacity = 0.12 + level * 0.45
    light.current.intensity = 2 + level * 14
  })

  return (
    <group position={loveTree}>
      <mesh geometry={wood} castShadow receiveShadow>
        <meshStandardMaterial color="#a585b8" roughness={0.75} emissive="#5b3a7a" emissiveIntensity={0.18} />
      </mesh>
      <instancedMesh ref={bloomRef} args={[null, null, maxBloom]} castShadow frustumCulled={false}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={0.55} emissive="#ff7fb2" emissiveIntensity={0.2} />
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
      <DriftParticles position={[0, 2.4, 0]} count={tier === 'high' ? 40 : 18} area={[6, 5, 6]} size={0.1} speed={0.28} direction={-1} texture="petal" intensity={0.6 + level} seed={71} />
    </group>
  )
}
