import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { addCollider, HOPE_BRIDGE, isleDistance, isleHeight, ISLE_A, ISLE_B, onWalkway, PIER, SEA, seeded, walkwayAt, WEST_BRIDGE } from '../../lib/terrain'
import { player, walkTo } from '../../lib/player'
import { moonPosition } from '../../lib/layout'
import { partner, useCouple } from '../../lib/couple'
import { SEAT_DROP, seats, useSeat } from '../../lib/actions'
import { useInteractable } from '../../lib/interactions'
import { atmosphere } from '../../lib/atmosphere'
import { openWish } from '../../lib/wish'
import { withPaint } from '../../lib/paint'
import { count } from '../../lib/device'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'
import { cutscenes, wishes } from '../../content/config'
import { along, BRIDGE_MID, GARDEN, hopeLight, PIER_TIP, SWING, swingBase, swingForward, swingSide, swingState, yawOf } from '../../lib/westLayout'
import { cut, playCutscene } from '../../lib/cutscene'
import Ghost, { useMateAvatar } from './Ghost'
import Furniture, { B, C, mat, PicnicBasket, S } from './HomeFurniture'
import { Glow, HeartMesh } from './Bits'
import { DriftParticles, Fireflies } from './Particles'

/*
 * THE WESTERN ISLES — three quiet places past the forest, over a calm sea:
 *   island A and its night pier, "The Place I Wish I Could Be" (a bench toward the moon, a letter);
 *   the arched bridge "Two Islands, One Destination" (its lights come on, end to end, when you're each
 *   at one end; a letter waits on the little platform at its top);
 *   island B's sunset garden, "The Little Things I Look Forward To" (a swing for two, small hopes).
 * Sitting (the bench, the swing) is the same shared sitting as everywhere; the sky turns to night on
 * the pier and to sunset in the garden, just for whoever is there. Letters open only for the reader.
 */

/** A point along a walkway (0 → 1), `side` metres to its left (+) or right (−). */

function tapWalk(e) {
  const s = useStore.getState()
  if (s.view !== 'explore' || s.phase !== 'world' || e.delta > 8) return
  walkTo(e.point.x, e.point.z, 0.2)
  player.onArrive = null
}

/* ───────── the sea ───────── */

const seaMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  uniforms: {
    uTime: { value: 0 },
    uNight: { value: 0 },
    uSunset: { value: 0 },
    uMoon: { value: new THREE.Vector2(-0.21, -0.98) },
    uPier: { value: new THREE.Vector2(PIER.bx, PIER.bz) },
    uCenter: { value: new THREE.Vector2(SEA.x, SEA.z) },
    uRadius: { value: SEA.r },
  },
  vertexShader: /* glsl */ `
    varying vec2 vWorld;
    void main() {
      vec4 w = modelMatrix * vec4(position, 1.0);
      vWorld = w.xz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }`,
  fragmentShader: /* glsl */ `
    uniform float uTime, uNight, uSunset, uRadius;
    uniform vec2 uMoon, uPier, uCenter;
    varying vec2 vWorld;
    void main() {
      // slow, overlapping swells
      float w = sin(vWorld.x * 0.9 + uTime * 0.7) * 0.5 + sin(vWorld.y * 1.3 - uTime * 0.5) * 0.35 + sin((vWorld.x + vWorld.y) * 2.3 + uTime * 1.1) * 0.15;
      vec3 day = vec3(0.2, 0.72, 0.78);
      vec3 night = vec3(0.04, 0.10, 0.24);
      vec3 col = mix(day, night, uNight);
      col = mix(col, vec3(0.95, 0.62, 0.52), uSunset * 0.35 * (1.0 - uNight));
      col += w * mix(0.025, 0.04, uNight);
      // the moon's path on the water, from the pier out toward the moon
      vec2 rel = vWorld - uPier;
      float ahead = dot(rel, uMoon);
      float off = abs(rel.x * uMoon.y - rel.y * uMoon.x);
      float width = 0.5 + max(ahead, 0.0) * 0.12;
      float glint = smoothstep(width, 0.0, off) * smoothstep(-2.0, 2.0, ahead) * (0.55 + 0.45 * sin(vWorld.x * 7.0 + vWorld.y * 5.0 + uTime * 2.0));
      col += vec3(0.95, 0.93, 0.78) * glint * uNight * 0.55;
      // the sea fades into the clouds at its edge
      float d = length(vWorld - uCenter) / uRadius;
      float a = 1.0 - smoothstep(0.8, 1.0, d);
      gl_FragColor = vec4(col, a * 0.94);
    }`,
})

function Sea() {
  useEffect(() => {
    const dx = moonPosition.x - PIER.bx
    const dz = moonPosition.z - PIER.bz
    const l = Math.hypot(dx, dz)
    seaMaterial.uniforms.uMoon.value.set(dx / l, dz / l)
  }, [])
  useFrame((_, delta) => {
    const u = seaMaterial.uniforms
    u.uTime.value += delta
    u.uNight.value = 1 - atmosphere.day
    u.uSunset.value = atmosphere.sunset
  })
  return (
    <mesh position={[SEA.x, SEA.level, SEA.z]} rotation={[-Math.PI / 2, 0, 0]} material={seaMaterial} renderOrder={1}>
      <circleGeometry args={[SEA.r, 72]} />
    </mesh>
  )
}

/* ───────── the two islands ───────── */

function IsleGround({ isle, grass, light }) {
  const geometry = useMemo(() => {
    const rows = 16
    const segs = 64
    const pos = []
    const col = []
    const idx = []
    const c = new THREE.Color()
    const g = new THREE.Color(grass)
    const l = new THREE.Color(light)
    const sand = new THREE.Color('#e9d9b2')
    for (let r = 0; r <= rows; r++) {
      const f = Math.max(0.0001, (r / rows) * 1.06)
      for (let s = 0; s <= segs; s++) {
        const a = (s / segs) * Math.PI * 2
        let R = isle.r * 1.2
        for (let k = 0; k < 4; k++) R = (R / isleDistance(isle, isle.x + Math.cos(a) * R, isle.z + Math.sin(a) * R)) * 0.999
        const x = isle.x + Math.cos(a) * R * f
        const z = isle.z + Math.sin(a) * R * f
        pos.push(x, isleHeight(isle, x, z), z)
        const n = 0.5 + 0.5 * Math.sin(x * 1.4) * Math.cos(z * 1.2)
        c.copy(g).lerp(l, n * 0.35).lerp(sand, THREE.MathUtils.smoothstep(f, 0.74, 0.9))
        col.push(c.r, c.g, c.b)
      }
    }
    for (let r = 0; r < rows; r++)
      for (let s = 0; s < segs; s++) {
        const a = r * (segs + 1) + s
        const b = a + segs + 1
        idx.push(a, a + 1, b, b, a + 1, b + 1)
      }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    geo.setIndex(idx)
    geo.computeVertexNormals()
    return geo
  }, [isle, grass, light])
  const material = useMemo(() => withPaint(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), 'foliage'), [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} material={material} onClick={tapWalk} receiveShadow />
}

/* ───────── bridges ───────── */

/** A rope bridge along a walkway: planks, posts, rope rails, and little lights (they can be switched on in order). */
function RopeBridge({ w, lightsRef, lightColor = '#ffe2a8' }) {
  const planks = useRef()
  const posts = useRef()
  const { list, postList, ropes, lamps } = useMemo(() => {
    const n = Math.round(w.len / 0.28)
    const list = Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n
      const [x, z] = along(w, t)
      const tilt = -Math.atan2(w.height(t + 0.004) - w.height(t - 0.004), w.len * 0.008)
      const wide = w.wide && t > w.wide[0] && t < w.wide[1]
      return { x, z, y: w.height(t), tilt, width: (wide ? w.wide[2] : w.halfWidth) * 2 - 0.04 }
    })
    const postList = []
    const rails = [[], []]
    const lamps = []
    const steps = Math.max(4, Math.round(w.len / 1.4))
    for (let k = 0; k <= steps; k++) {
      const t = k / steps
      const wide = w.wide && t > w.wide[0] - 0.02 && t < w.wide[1] + 0.02
      const hw = (wide ? w.wide[2] : w.halfWidth) + 0.06
      ;[-1, 1].forEach((side, j) => {
        const [x, z] = along(w, t, side * hw)
        const y = w.height(t)
        postList.push({ x, y, z })
        rails[j].push(new THREE.Vector3(x, y + 0.82, z))
        if (k % 2 === 0 || k === steps) lamps.push({ x, y: y + 0.92, z, t })
      })
    }
    const ropes = rails.map((pts) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 6, 0.025, 5))
    return { list, postList, ropes, lamps: lamps.sort((a, b) => a.t - b.t) }
  }, [w])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const yaw = yawOf(w)
    list.forEach((p, i) => {
      m.compose(new THREE.Vector3(p.x, p.y - 0.03, p.z), q.setFromEuler(new THREE.Euler(p.tilt, yaw, ((i * 13) % 5) * 0.006 - 0.012, 'YXZ')), new THREE.Vector3(p.width, 0.06, 0.22))
      planks.current.setMatrixAt(i, m)
    })
    planks.current.instanceMatrix.needsUpdate = true
    planks.current.computeBoundingSphere()
    postList.forEach((p, i) => {
      m.compose(new THREE.Vector3(p.x, p.y + 0.4, p.z), q.identity(), new THREE.Vector3(1, 0.9, 1))
      posts.current.setMatrixAt(i, m)
    })
    posts.current.instanceMatrix.needsUpdate = true
    posts.current.computeBoundingSphere()
  }, [list, postList, w])
  useEffect(() => () => ropes.forEach((r) => r.dispose()), [ropes])
  return (
    <group>
      <instancedMesh ref={planks} args={[undefined, undefined, list.length]} material={mat('#c8915f', 0, 0.9)} onClick={tapWalk}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <instancedMesh ref={posts} args={[undefined, undefined, postList.length]} material={mat('#a5714a')}>
        <cylinderGeometry args={[0.05, 0.06, 1, 6]} />
      </instancedMesh>
      {ropes.map((g, i) => (
        <mesh key={i} geometry={g} material={mat('#e3c39b', 0, 1)} />
      ))}
      <group ref={lightsRef}>
        {lamps.map((l, i) => (
          <group key={i} position={[l.x, l.y, l.z]} userData={{ t: l.t }}>
            <mesh>
              <sphereGeometry args={[0.065, 10, 8]} />
              <meshBasicMaterial color={lightColor} toneMapped={false} />
            </mesh>
            <Glow color={lightColor} size={0.7} opacity={0.5} />
          </group>
        ))}
      </group>
    </group>
  )
}

/** The lights along the arched bridge: dim until you're each at one end, then they come on, end to end. */
function HopeBridge() {
  const lights = useRef()
  useFrame(() => {
    const g = lights.current
    if (!g) return
    const k = hopeLight.litAt ? Math.min(1, (performance.now() - hopeLight.litAt) / 4000) : 0
    g.children.forEach((lamp) => {
      const on = hopeLight.litAt && lamp.userData.t <= k + 0.001
      const sphere = lamp.children[0]
      sphere.material.color.set(on ? '#ffe2a8' : '#6d6a80')
      sphere.scale.setScalar(on ? 1.15 : 0.8)
      lamp.children[1].visible = Boolean(on)
    })
  })
  // the letter, on the little platform at the top of the arch
  const [lx, lz] = along(HOPE_BRIDGE, 0.5, 0.85)
  const at = useMemo(() => new THREE.Vector3(lx, HOPE_BRIDGE.height(0.5), lz), [lx, lz])
  useInteractable('wish-bridge', {
    position: at,
    radius: 1.3,
    priority: 0.3,
    label: 'Baca surat',
    onInteract: () => openWish(wishes.bridge),
  })
  return (
    <group>
      <RopeBridge w={HOPE_BRIDGE} lightsRef={lights} />
      <group position={at}>
        <C p={[0, 0.45, 0]} rt={0.04} h={0.9} c="#a5714a" seg={6} />
        <B p={[0, 0.95, 0]} s={[0.32, 0.22, 0.04]} r={[0, yawOf(HOPE_BRIDGE) + Math.PI / 2, 0]} c="#fff8ee" />
        <HeartMesh position={[0, 1.15, 0]} scale={0.07} color="#ff9cc8" emissive="#ff5fa2" glow={1} />
        <Glow position={[0, 1.0, 0]} color="#ffe2a8" size={0.9} opacity={0.45} />
      </group>
    </group>
  )
}

/* ───────── island A: the night pier ───────── */

function Lamp({ x, z, y = 0, h = 1.2, color = '#ffd9a0' }) {
  useEffect(() => addCollider(x, z, 0.12), []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <group position={[x, y, z]}>
      <C p={[0, h / 2, 0]} rt={0.035} rb={0.05} h={h} c="#5b4a5e" seg={6} />
      <B p={[0, h + 0.08, 0]} s={[0.16, 0.2, 0.16]} c="#ffe2a8" glow={1.3} />
      <Glow position={[0, h + 0.08, 0]} color={color} size={1.3} opacity={0.55} />
    </group>
  )
}

function Bench({ id, x, z, y, yaw, label, out = 0.85 }) {
  const side = [Math.cos(yaw), -Math.sin(yaw)]
  useEffect(() => addCollider(x, z, 0.45), []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <group>
      <group position={[x, y, z]} rotation={[0, yaw, 0]}>
        <B p={[0, 0.42, 0]} s={[1.3, 0.06, 0.42]} c="#c8915f" />
        <B p={[0, 0.68, -0.19]} s={[1.3, 0.32, 0.05]} c="#c8915f" />
        {[-0.58, 0.58].map((dx) => (
          <B key={dx} p={[dx, 0.21, 0]} s={[0.06, 0.42, 0.38]} c="#8a6248" />
        ))}
      </group>
      {[-0.32, 0.32].map((k, i) => (
        <BenchSeat key={i} id={`${id}:${i}`} x={x + side[0] * k} z={z + side[1] * k} y={y + 0.45} yaw={yaw} out={out} group={id} label={label} />
      ))}
    </group>
  )
}
function BenchSeat({ id, x, z, y, yaw, out, group, label }) {
  // she gets up behind the bench (in front could be the edge of the pier)
  useSeat(id, { x, z, y, yaw, exit: [x - Math.sin(yaw) * out, z - Math.cos(yaw) * out], group, label })
  return null
}

function Pier() {
  const planks = useRef()
  const posts = useRef()
  const yaw = yawOf(PIER)
  const deck = PIER.height(0)
  const { boards, piles } = useMemo(() => {
    const n = Math.round(PIER.len / 0.24)
    const boards = Array.from({ length: n + 1 }, (_, i) => along(PIER, i / n))
    const piles = []
    for (let k = 1; k <= 5; k++) [-1, 1].forEach((s) => piles.push(along(PIER, k / 5.2, s * (PIER.halfWidth - 0.05))))
    return { boards, piles }
  }, [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0))
    boards.forEach(([x, z], i) => {
      m.compose(new THREE.Vector3(x, deck - 0.03, z), q, new THREE.Vector3(PIER.halfWidth * 2, 0.06, 0.2))
      planks.current.setMatrixAt(i, m)
    })
    planks.current.instanceMatrix.needsUpdate = true
    planks.current.computeBoundingSphere()
    piles.forEach(([x, z], i) => {
      m.compose(new THREE.Vector3(x, (deck + SEA.level - 0.8) / 2, z), q, new THREE.Vector3(1, deck - SEA.level + 0.8, 1))
      posts.current.setMatrixAt(i, m)
    })
    posts.current.instanceMatrix.needsUpdate = true
    posts.current.computeBoundingSphere()
  }, [boards, piles, deck, yaw])
  const [bx, bz] = along(PIER, 0.86)
  const [px, pz] = along(PIER, 0.62, -0.62)
  const letterAt = useMemo(() => new THREE.Vector3(px, deck, pz), [px, pz, deck])
  useInteractable('wish-pier', {
    position: letterAt,
    radius: 1.2,
    priority: 0.3,
    label: 'Baca surat',
    onInteract: () => openWish(wishes.pier),
  })
  const [l1x, l1z] = along(PIER, 0.05, 0.62)
  const [l2x, l2z] = along(PIER, 0.05, -0.62)
  const [l3x, l3z] = along(PIER, 0.98, 0.62)
  const [l4x, l4z] = along(PIER, 0.98, -0.62)
  return (
    <group>
      <instancedMesh ref={planks} args={[undefined, undefined, boards.length]} material={mat('#b98a5e', 0, 0.9)} onClick={tapWalk}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <instancedMesh ref={posts} args={[undefined, undefined, piles.length]} material={mat('#7d5a40')}>
        <cylinderGeometry args={[0.07, 0.08, 1, 6]} />
      </instancedMesh>
      <Lamp x={l1x} z={l1z} y={deck} />
      <Lamp x={l2x} z={l2z} y={deck} />
      <Lamp x={l3x} z={l3z} y={deck} />
      <Lamp x={l4x} z={l4z} y={deck} />
      <Bench id="pier" x={bx} z={bz} y={deck} yaw={yaw} label="Duduk sebentar" />
      {/* the letter, tucked in a little box on a post */}
      <group position={letterAt}>
        <C p={[0, 0.5, 0]} rt={0.04} h={1.0} c="#a5714a" seg={6} />
        <B p={[0, 1.02, 0]} s={[0.26, 0.2, 0.18]} c="#f4e7d6" />
        <B p={[0, 1.04, 0.095]} s={[0.18, 0.1, 0.01]} c="#ff9cc8" glow={0.5} />
        <Glow position={[0, 1.05, 0]} color="#ffe2a8" size={0.8} opacity={0.45} />
      </group>
    </group>
  )
}

/** A few quiet touches on island A: night flowers, rocks, one tree, lamps by the paths. */
function IsleADecor() {
  const flowers = useRef()
  const spots = useMemo(() => {
    const rand = seeded(4111)
    const list = []
    for (let i = 0; i < 200 && list.length < count(60, 30); i++) {
      const a = rand() * Math.PI * 2
      const r = Math.sqrt(rand()) * ISLE_A.r * 0.8
      const x = ISLE_A.x + Math.cos(a) * r
      const z = ISLE_A.z + Math.sin(a) * r
      if (onWalkway(PIER, x, z) || nearPath(x, z, 0.7)) continue
      list.push({ x, z, y: isleHeight(ISLE_A, x, z), c: ['#cfe3ff', '#ffffff', '#b9a5e8', '#9ec8f0'][list.length % 4], s: 0.6 + rand() * 0.5 })
    }
    return list
  }, [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const c = new THREE.Color()
    spots.forEach((f, i) => {
      m.compose(new THREE.Vector3(f.x, f.y + 0.12 * f.s, f.z), q, new THREE.Vector3(0.06 * f.s, 0.05 * f.s, 0.06 * f.s))
      flowers.current.setMatrixAt(i, m)
      flowers.current.setColorAt(i, c.set(f.c).multiplyScalar(1.3))
    })
    flowers.current.instanceMatrix.needsUpdate = true
    if (flowers.current.instanceColor) flowers.current.instanceColor.needsUpdate = true
    flowers.current.computeBoundingSphere()
  }, [spots])
  const tree = [ISLE_A.x + 2.6, ISLE_A.z + 1.9]
  useEffect(() => addCollider(tree[0], tree[1], 0.3), []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <group>
      <instancedMesh ref={flowers} args={[undefined, undefined, spots.length]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={0.6} emissive="#3a4a7a" emissiveIntensity={0.4} />
      </instancedMesh>
      <group position={[tree[0], isleHeight(ISLE_A, tree[0], tree[1]), tree[1]]}>
        <C p={[0, 0.6, 0]} rt={0.08} rb={0.12} h={1.2} c="#7d5a40" seg={7} />
        <S p={[0, 1.5, 0]} s={[0.65, 0.55, 0.65]} c="#8fb8d9" />
        <S p={[0.3, 1.8, 0.1]} s={[0.4, 0.35, 0.4]} c="#a9c9e6" />
      </group>
      {[
        [-1.6, 1.4],
        [1.4, -1.9],
      ].map(([dx, dz], i) => (
        <S key={i} p={[ISLE_A.x + dx, isleHeight(ISLE_A, ISLE_A.x + dx, ISLE_A.z + dz) + 0.1, ISLE_A.z + dz]} s={[0.35, 0.22, 0.3]} c="#9a94a8" />
      ))}
      <Lamp x={WEST_BRIDGE.bx - 0.9} z={WEST_BRIDGE.bz + 0.9} y={isleHeight(ISLE_A, WEST_BRIDGE.bx - 0.9, WEST_BRIDGE.bz + 0.9)} />
      <Lamp x={HOPE_BRIDGE.ax + 0.6} z={HOPE_BRIDGE.az + 0.9} y={isleHeight(ISLE_A, HOPE_BRIDGE.ax + 0.6, HOPE_BRIDGE.az + 0.9)} />
      <Fireflies count={count(10, 5)} area={[6, 1.5, 8]} center={[PIER.bx, PIER.height(1) + 1.0, PIER.bz]} seed={23} colors={['#fff1c9', '#cfe3ff']} />
    </group>
  )
}

/* ───────── island B: the sunset garden ───────── */

/** The four little hopes in the garden (and where they are). */
const HOPES = [
  { id: 'basket', at: [ISLE_B.x + 1.3, ISLE_B.z - 2.3] },
  { id: 'lantern', at: [ISLE_B.x + 1.9, ISLE_B.z + 2.4] },
  { id: 'flower', at: [ISLE_B.x - 2.6, ISLE_B.z - 2.6] },
  { id: 'sign', at: [ISLE_B.x + 2.7, ISLE_B.z - 0.2] },
]
/** Paths of stepping stones: bridge ends ↔ islands. */
const PATHS = [
  [
    [WEST_BRIDGE.bx, WEST_BRIDGE.bz],
    [ISLE_A.x + 0.6, ISLE_A.z + 0.4],
    [HOPE_BRIDGE.ax, HOPE_BRIDGE.az],
  ],
  [
    [ISLE_A.x + 0.6, ISLE_A.z + 0.4],
    [PIER.ax, PIER.az],
  ],
  [
    [HOPE_BRIDGE.bx, HOPE_BRIDGE.bz],
    [ISLE_B.x + 0.8, ISLE_B.z + 0.4],
    [SWING.x + 0.4, SWING.z - 2.0],
    [ISLE_B.x - 4.4, ISLE_B.z - 0.3],
  ],
]
const segDist = (px, pz, [ax, az], [bx, bz]) => {
  const vx = bx - ax
  const vz = bz - az
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz || 1)))
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t))
}
const nearPath = (x, z, d) => PATHS.some((p) => p.slice(1).some((b, i) => segDist(x, z, p[i], b) < d))

function SwingSeat({ index }) {
  const k = index === 0 ? -0.32 : 0.32
  const def = useMemo(
    () => ({
      get x() {
        return SWING.x + swingSide[0] * k + swingForward[0] * Math.sin(swingState.angle) * SWING.rope
      },
      get z() {
        return SWING.z + swingSide[1] * k + swingForward[1] * Math.sin(swingState.angle) * SWING.rope
      },
      get y() {
        return swingBase() + SWING.top - Math.cos(swingState.angle) * SWING.rope + 0.06
      },
      yaw: SWING.yaw,
      exit: [SWING.x + swingSide[0] * k + swingForward[0] * 1.0, SWING.z + swingSide[1] * k + swingForward[1] * 1.0],
      group: 'swing',
      label: 'Duduk di ayunan',
    }),
    [k],
  )
  useSeat(`swing:${index}`, def)
  return null
}

function Swing() {
  const seat = useRef()
  const y0 = swingBase()
  useEffect(() => {
    ;[-1, 1].forEach((s) =>
      [-0.45, 0.45].forEach((f) => addCollider(SWING.x + swingSide[0] * s * 1.0 + swingForward[0] * f, SWING.z + swingSide[1] * s * 1.0 + swingForward[1] * f, 0.1)),
    )
  }, [])
  useFrame(({ clock }, delta) => {
    // two on the swing: a gentle shared swing; one: barely moving; nobody: still
    const mine = player.seat?.startsWith('swing:')
    const theirs = partner.online && partner.seat?.seat?.startsWith('swing:')
    const target = mine && theirs ? 0.2 : mine || theirs ? 0.06 : 0
    swingState.amp = THREE.MathUtils.damp(swingState.amp, target, 1.2, delta)
    swingState.angle = useStore.getState().reducedMotion ? 0 : swingState.amp * Math.sin(clock.elapsedTime * 1.9)
    // (a positive angle carries the seat forward, the same way the riders are placed)
    if (seat.current) seat.current.rotation.x = -swingState.angle
  })
  return (
    <group position={[SWING.x, y0, SWING.z]} rotation={[0, SWING.yaw, 0]}>
      {/* the A-frames and the beam (local x runs along the swing, z is forward) */}
      {[-1, 1].map((s) =>
        [-1, 1].map((f) => <C key={`${s}${f}`} p={[s * 1.0, SWING.top / 2, f * 0.23]} rt={0.045} rb={0.06} h={SWING.top + 0.05} c="#b98a5e" seg={7} r={[f * -0.2, 0, 0]} />),
      )}
      <C p={[0, SWING.top, 0]} rt={0.06} h={2.2} c="#a5714a" seg={8} r={[0, 0, Math.PI / 2]} />
      {/* the seat, hanging from the beam (it swings around it) */}
      <group ref={seat} position={[0, SWING.top, 0]}>
        {[-0.62, 0.62].map((x) => (
          <C key={x} p={[x, -SWING.rope / 2, 0]} rt={0.012} h={SWING.rope} c="#f1dcc0" seg={4} />
        ))}
        <B p={[0, -SWING.rope, 0]} s={[1.35, 0.06, 0.4]} c="#d9a574" />
        {Array.from({ length: 9 }, (_, i) => (
          <S key={i} p={[-0.62 + (i % 2 ? 0.04 : -0.04), -0.2 - i * 0.17, 0.02]} s={0.035} c={['#ff8fbf', '#ffd6ea', '#ffd27f'][i % 3]} />
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <S key={`r${i}`} p={[0.62 + (i % 2 ? 0.04 : -0.04), -0.2 - i * 0.17, 0.02]} s={0.035} c={['#ff8fbf', '#ffd6ea', '#ffd27f'][(i + 1) % 3]} />
        ))}
      </group>
      <SwingSeat index={0} />
      <SwingSeat index={1} />
    </group>
  )
}

/** A small hope: an object that, when she looks at it, shows its message. */
function Hope({ id, at, children }) {
  const [x, z] = at
  const y = isleHeight(ISLE_B, x, z)
  const pos = useMemo(() => new THREE.Vector3(x, y, z), [x, y, z])
  const msg = wishes.garden[id]
  useEffect(() => addCollider(x, z, 0.22), []) // eslint-disable-line react-hooks/exhaustive-deps
  useInteractable(`hope:${id}`, {
    position: pos,
    radius: 1.3,
    priority: 0.2,
    label: msg.label,
    onInteract: () => {
      audio.sparkle()
      useStore.getState().showDiscovery({ kind: 'view', title: msg.label, text: msg.text }, 9000)
    },
  })
  return <group position={pos}>{children}</group>
}

function Garden() {
  const beds = useRef()
  const flowers = useMemo(() => {
    const rand = seeded(5150)
    const list = []
    const colors = ['#ff8fbf', '#ffd27f', '#f7f2ff', '#b9a5e8', '#ff9f8f', '#ffc2d9']
    for (let i = 0; i < 600 && list.length < count(140, 70); i++) {
      const a = rand() * Math.PI * 2
      const r = Math.sqrt(rand()) * ISLE_B.r * 0.82
      const x = ISLE_B.x + Math.cos(a) * r
      const z = ISLE_B.z + Math.sin(a) * r
      if (nearPath(x, z, 0.65) || Math.hypot(x - SWING.x, z - SWING.z) < 1.9 || HOPES.some((h) => Math.hypot(x - h.at[0], z - h.at[1]) < 0.9)) continue
      if (Math.hypot(x - (ISLE_B.x - 5.0), z - ISLE_B.z) < 1.6) continue // the viewing spot
      list.push({ x, z, y: isleHeight(ISLE_B, x, z), c: colors[Math.floor(rand() * colors.length)], s: 0.6 + rand() * 0.6 })
    }
    return list
  }, [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const c = new THREE.Color()
    flowers.forEach((f, i) => {
      m.compose(new THREE.Vector3(f.x, f.y + 0.16 * f.s, f.z), q, new THREE.Vector3(0.065 * f.s, 0.055 * f.s, 0.065 * f.s))
      beds.current.setMatrixAt(i, m)
      beds.current.setColorAt(i, c.set(f.c))
    })
    beds.current.instanceMatrix.needsUpdate = true
    if (beds.current.instanceColor) beds.current.instanceColor.needsUpdate = true
    beds.current.computeBoundingSphere()
  }, [flowers])
  const trees = useMemo(
    () => [
      [-3.6, -4.4, 1.0],
      [3.6, -4.0, 0.9],
      [3.9, 3.8, 1.05],
      [-3.4, 4.6, 0.9],
    ],
    [],
  )
  useEffect(() => trees.forEach(([dx, dz]) => addCollider(ISLE_B.x + dx, ISLE_B.z + dz, 0.32)), [trees])
  const view = [ISLE_B.x - 5.0, ISLE_B.z]
  return (
    <group>
      <instancedMesh ref={beds} args={[undefined, undefined, flowers.length]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      {trees.map(([dx, dz, s], i) => {
        const x = ISLE_B.x + dx
        const z = ISLE_B.z + dz
        return (
          <group key={i} position={[x, isleHeight(ISLE_B, x, z), z]} scale={s}>
            <C p={[0, 0.65, 0]} rt={0.08} rb={0.13} h={1.3} c="#9a6b4a" seg={7} />
            <S p={[0, 1.65, 0]} s={[0.75, 0.62, 0.75]} c={i % 2 ? '#ffc2d9' : '#ffd6a8'} />
            <S p={[0.35, 1.95, 0.12]} s={[0.42, 0.38, 0.42]} c={i % 2 ? '#ffd6e6' : '#ffe2c2'} />
          </group>
        )
      })}
      <Swing />
      <Hope id="basket" at={HOPES[0].at}>
        <PicnicBasket />
      </Hope>
      <Hope id="lantern" at={HOPES[1].at}>
        <Furniture kind="lantern" />
      </Hope>
      <Hope id="flower" at={HOPES[2].at}>
        <C p={[0, 0.3, 0]} rt={0.015} h={0.6} c="#6fb85a" seg={5} />
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2
          return <S key={i} p={[Math.cos(a) * 0.09, 0.64, Math.sin(a) * 0.09]} s={[0.07, 0.025, 0.07]} c="#ff9cc8" />
        })}
        <S p={[0, 0.65, 0]} s={0.05} c="#ffd27f" />
      </Hope>
      <Hope id="sign" at={HOPES[3].at}>
        <B p={[0, 0.45, 0]} s={[0.07, 0.9, 0.07]} c="#a5714a" />
        <B p={[0, 0.85, 0]} s={[0.6, 0.3, 0.05]} r={[0, Math.PI / 2, 0]} c="#f4e7d6" />
        <HeartMesh position={[0.04, 0.85, 0]} rotation={[0, Math.PI / 2, 0]} scale={0.06} color="#ff9cc8" emissive="#ff5fa2" glow={0.6} />
      </Hope>
      {/* the viewing spot at the west shore: a curved rail and a bench toward the sea */}
      {Array.from({ length: 7 }, (_, i) => {
        const a = Math.PI - 0.6 + (i / 6) * 1.2
        const x = ISLE_B.x + Math.cos(a) * 6.05
        const z = ISLE_B.z + Math.sin(a) * 6.05
        return <C key={i} p={[x, isleHeight(ISLE_B, x, z) + 0.45, z]} rt={0.04} h={0.9} c="#fbf6ef" seg={6} />
      })}
      <Bench id="view" x={view[0]} z={view[1]} y={isleHeight(ISLE_B, view[0], view[1])} yaw={-Math.PI / 2} label="Duduk & lihat laut" />
      <Lamp x={HOPE_BRIDGE.bx - 0.5} z={HOPE_BRIDGE.bz + 1.0} y={isleHeight(ISLE_B, HOPE_BRIDGE.bx - 0.5, HOPE_BRIDGE.bz + 1.0)} />
      <Lamp x={SWING.x + 1.2} z={SWING.z + 1.6} y={isleHeight(ISLE_B, SWING.x + 1.2, SWING.z + 1.6)} />
      <DriftParticles position={[GARDEN.x, ISLE_B.level + 2.2, GARDEN.z]} count={count(22, 10)} area={[11, 4, 11]} size={0.12} speed={0.12} direction={-1} texture="petal" seed={808} intensity={0.85} />
      <Fireflies count={count(14, 7)} area={[9, 2, 9]} center={[GARDEN.x, ISLE_B.level + 1.0, GARDEN.z]} seed={47} colors={['#ffe2a8', '#ffd6ea']} />
    </group>
  )
}

/** Stepping stones on both islands (one instanced draw). */
function Stones() {
  const ref = useRef()
  const stones = useMemo(() => {
    const list = []
    PATHS.forEach((path) => {
      for (let i = 0; i < path.length - 1; i++) {
        const [ax, az] = path[i]
        const [bx, bz] = path[i + 1]
        const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 0.6))
        for (let j = 1; j < n; j++) {
          const x = ax + ((bx - ax) * j) / n + Math.sin(list.length * 2.1) * 0.08
          const z = az + ((bz - az) * j) / n
          const isle = isleDistance(ISLE_A, x, z) < 0.85 ? ISLE_A : isleDistance(ISLE_B, x, z) < 0.85 ? ISLE_B : null
          if (isle) list.push({ x, z, y: isleHeight(isle, x, z) + 0.02, s: 0.2 + ((list.length * 7) % 4) * 0.02 })
        }
      }
    })
    return list
  }, [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    stones.forEach((s, i) => {
      m.compose(new THREE.Vector3(s.x, s.y, s.z), q.setFromEuler(new THREE.Euler(0, i * 1.3, 0)), new THREE.Vector3(s.s, 0.04, s.s))
      ref.current.setMatrixAt(i, m)
    })
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [stones])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, stones.length]} material={mat('#efe6d6', 0, 0.9)} onClick={tapWalk}>
      <cylinderGeometry args={[1, 1, 1, 7]} />
    </instancedMesh>
  )
}

/* ───────── more feeling: the dream at the pier's tip, the one who isn't here, lanterns, falling stars ───────── */

/** "Pejamkan mata sebentar" at the tip of the pier: the dreamed beach. */
function DreamSpot() {
  useInteractable('pier-dream', {
    position: PIER_TIP,
    radius: 1.0,
    priority: 0.35,
    enabled: () => !player.seat,
    label: 'Pejamkan mata sebentar',
    onInteract: () => playCutscene('beach'),
  })
  return (
    <group position={PIER_TIP}>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.32, 0.4, 32]} />
        <meshBasicMaterial color={[1.8, 1.6, 2.2]} toneMapped={false} transparent opacity={0.45} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** How long she has been sitting there alone (seconds), per place. Read by the tracker too. */
const aloneFor = { swing: 0, pier: 0 }

/**
 * When she sits alone on the swing or the pier bench, after a little while the other one appears
 * beside her, in light, on the other seat. They fade away when she gets up, or when the real one arrives.
 */
function AloneGhost({ group, seatA, seatB }) {
  const mate = useMateAvatar()
  const ref = useRef()
  const opacity = useRef(0)
  const told = useRef(false)
  useFrame((_, delta) => {
    const mine = player.seat
    const here = mine === seatA || mine === seatB
    // (only when the real one isn't sitting there, or anywhere near)
    const nearby = partner.online && partner.shown.ok && Math.hypot(partner.shown.x - player.position.x, partner.shown.z - player.position.z) < 10
    const real = partner.online && (partner.seat?.seat === seatA || partner.seat?.seat === seatB)
    aloneFor[group] = here && !real && !nearby ? aloneFor[group] + delta : 0
    const show = aloneFor[group] > 6
    opacity.current = THREE.MathUtils.damp(opacity.current, show ? 0.85 : 0, show ? 0.7 : 3, delta)
    const def = seats.get(mine === seatA ? seatB : seatA)?.def
    if (ref.current && def) {
      ref.current.position.set(def.x, def.y - SEAT_DROP, def.z)
      ref.current.rotation.y = def.yaw
    }
    if (aloneFor[group] > 7.5 && !told.current) {
      told.current = true
      useStore.getState().showDiscovery({ kind: 'view', title: '♡', text: cutscenes.alone }, 9000)
    }
  })
  return (
    <group ref={ref}>
      <Ghost config={mate} getOpacity={() => opacity.current} getMotion={() => ({ speed: 0, cheer: 0, sit: 'chair' })} />
    </group>
  )
}

/** Paper lanterns drifting up from the sea around the pier, all night. */
function RisingLanterns() {
  const ref = useRef()
  const list = useMemo(() => {
    const rand = seeded(6262)
    return Array.from({ length: count(26, 14) }, () => {
      const a = -Math.PI / 2 - 0.9 + rand() * 1.8 // north and around, out over the water
      const r = 9 + rand() * 9
      return { x: ISLE_A.x + Math.cos(a) * r, z: ISLE_A.z + Math.sin(a) * r, phase: rand() * 40, speed: 0.18 + rand() * 0.12, s: 0.18 + rand() * 0.1 }
    })
  }, [])
  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const p = useMemo(() => new THREE.Vector3(), [])
  const sc = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    // they only show at night
    g.visible = atmosphere.day < 0.6
    if (!g.visible) return
    const t = clock.elapsedTime
    list.forEach((l, i) => {
      const life = (t * l.speed + l.phase) % 9 // rise 9 m, then start again from the water
      const fade = Math.min(1, life * 2) * Math.min(1, (9 - life) * 0.8)
      p.set(l.x + Math.sin(t * 0.25 + i) * 0.4, SEA.level + 0.2 + life, l.z)
      sc.set(l.s * fade, l.s * 1.3 * fade, l.s * fade)
      m.compose(p, q, sc)
      g.setMatrixAt(i, m)
    })
    g.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, list.length]} frustumCulled={false}>
      <cylinderGeometry args={[0.8, 1, 1.2, 6]} />
      <meshBasicMaterial color={[2.4, 1.45, 0.75]} toneMapped={false} />
    </instancedMesh>
  )
}

/** Now and then, a falling star over the sea north of the pier (only at night). */
function FallingStars() {
  const ref = useRef()
  const st = useRef({ next: 4, t: -1, from: new THREE.Vector3(), to: new THREE.Vector3() })
  useFrame((_, delta) => {
    const g = ref.current
    const s = st.current
    if (!g) return
    if (atmosphere.day > 0.5) {
      g.visible = false
      return
    }
    if (s.t < 0) {
      s.next -= delta
      if (s.next <= 0) {
        const x = PIER.bx - 25 + Math.random() * 50
        s.from.set(x, 26 + Math.random() * 8, PIER.bz - 55 - Math.random() * 20)
        s.to.copy(s.from).add(new THREE.Vector3(-14 - Math.random() * 10, -7, 0))
        s.t = 0
      }
      g.visible = false
      return
    }
    s.t += delta / 1.3
    g.visible = s.t < 1
    g.position.lerpVectors(s.from, s.to, Math.min(1, s.t))
    g.children[0].material.opacity = Math.sin(Math.PI * Math.min(1, s.t)) * 0.9
    if (s.t >= 1) {
      s.t = -1
      s.next = 7 + Math.random() * 9
    }
  })
  return (
    <group ref={ref} visible={false}>
      <Glow color="#fff6d8" size={2.4} opacity={0} />
    </group>
  )
}

/** Tiny blue lights twinkling along island A's shore at night. */
function ShoreGlow() {
  const ref = useRef()
  const dots = useMemo(() => {
    const rand = seeded(3131)
    return Array.from({ length: count(70, 36) }, () => {
      const a = rand() * Math.PI * 2
      const r = ISLE_A.r * (0.93 + rand() * 0.12)
      return { x: ISLE_A.x + Math.cos(a) * r, z: ISLE_A.z + Math.sin(a) * r, ph: rand() * 6 }
    })
  }, [])
  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const p = useMemo(() => new THREE.Vector3(), [])
  const sc = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    g.visible = atmosphere.day < 0.6
    if (!g.visible) return
    const t = clock.elapsedTime
    dots.forEach((d, i) => {
      const k = 0.5 + 0.5 * Math.sin(t * 1.6 + d.ph)
      p.set(d.x, SEA.level + 0.04, d.z)
      sc.setScalar(0.035 + k * 0.035)
      m.compose(p, q, sc)
      g.setMatrixAt(i, m)
    })
    g.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, dots.length]} frustumCulled={false}>
      <sphereGeometry args={[1, 6, 4]} />
      <meshBasicMaterial color={[0.6, 1.6, 2.4]} toneMapped={false} />
    </instancedMesh>
  )
}

/* ───────── what happens as she walks around ───────── */

const HOPE_A = new THREE.Vector2(HOPE_BRIDGE.ax, HOPE_BRIDGE.az)
const HOPE_B = new THREE.Vector2(HOPE_BRIDGE.bx, HOPE_BRIDGE.bz)
const nearEnd = (x, z, end) => Math.hypot(x - end.x, z - end.y) < 2.6

/**
 * Every frame: which of the three places she's in (its name appears as she arrives), the sky for it
 * (night on the pier, sunset in the garden, a gradient across the bridges), the bridge lights (on when
 * you're each at one end of it, as both games see it), and the shared sunset when you're both on the swing.
 */
function WestTracker({ onNear }) {
  const last = useRef(null)
  const near = useRef(false)
  const shown = useRef({ sunset: false, swing: false, meet: false })
  const swingTogether = useRef(0)
  useFrame((_, delta) => {
    const s = useStore.getState()
    const { x, z } = player.position
    const exploring = s.phase === 'world' && s.view === 'explore'
    let region = null
    let place = null
    if (exploring) {
      if (onWalkway(HOPE_BRIDGE, x, z)) {
        const t = walkwayAt(HOPE_BRIDGE, x, z).t
        region = 'hope'
        place = { day: 0.2 + 0.7 * t, sunset: 0.2 + 0.68 * t }
      } else if (isleDistance(ISLE_A, x, z) < 1.2 || onWalkway(PIER, x, z)) {
        region = 'pier'
        place = { day: 0.18, sunset: 0.22 }
      } else if (isleDistance(ISLE_B, x, z) < 1.2) {
        region = 'garden'
        const both = player.seat?.startsWith('swing:') && partner.online && partner.seat?.seat?.startsWith('swing:')
        place = both ? { day: 0.72, sunset: 1 } : { day: 0.92, sunset: 0.88 }
      } else if (onWalkway(WEST_BRIDGE, x, z)) {
        const t = walkwayAt(WEST_BRIDGE, x, z).t
        region = 'west'
        place = { day: 1 - 0.8 * t, sunset: 0.25 * t }
      }
    }
    if (region) atmosphere.place = place
    else if (last.current) atmosphere.place = null
    if (region !== last.current) {
      const names = { pier: wishes.pier.place, hope: wishes.bridge.place, garden: wishes.garden.place }
      if (names[region]) s.showToast(`✦ ${names[region]}`, 2600)
      last.current = region
    }
    const isNear = Math.hypot(x - SEA.x, z - SEA.z) < SEA.r + 10
    if (isNear !== near.current) {
      near.current = isNear
      onNear(isNear)
    }

    if (!exploring || cut.id) return
    const together = useCouple.getState().status === 'connected' && partner.online && partner.shown.ok
    const px = partner.shown.x
    const pz = partner.shown.z

    // the bridge lights: you at one end, the other person at the other (as both games see it);
    // the cutscene runs along the bridge as they come on (and if it can't play, they simply come on)
    if (!hopeLight.litAt && together && ((nearEnd(x, z, HOPE_A) && nearEnd(px, pz, HOPE_B)) || (nearEnd(x, z, HOPE_B) && nearEnd(px, pz, HOPE_A)))) {
      if (!playCutscene('bridge')) {
        hopeLight.litAt = performance.now()
        audio.sparkle()
        s.showToast(wishes.bridge.lit, 5000)
      }
      return
    }

    // you meet in the middle of the lit bridge (once each time you play)
    if (hopeLight.litAt && together && !shown.current.meet && Math.hypot(x - BRIDGE_MID.x, z - BRIDGE_MID.z) < 1.5 && Math.hypot(px - BRIDGE_MID.x, pz - BRIDGE_MID.z) < 1.5) {
      shown.current.meet = true
      playCutscene('meet')
      return
    }

    // the swing: its little note the first time she sits; the sunset when you're both on it
    // (or, alone, once the glowing one has been sitting beside her for a while)
    const onSwing = player.seat?.startsWith('swing:')
    if (onSwing && !shown.current.swing) {
      shown.current.swing = true
      s.showDiscovery({ kind: 'view', title: wishes.garden.swing.label, text: wishes.garden.swing.text }, 9000)
    }
    const both = onSwing && partner.online && partner.seat?.seat?.startsWith('swing:')
    swingTogether.current = both ? swingTogether.current + delta : 0
    if (!shown.current.sunset && ((both && swingTogether.current > 3) || (onSwing && aloneFor.swing > 11))) {
      shown.current.sunset = true
      playCutscene('sunset')
    }
  })
  return null
}

function Labels() {
  const view = useStore((s) => s.view)
  const phase = useStore((s) => s.phase)
  if (phase !== 'world' || view !== 'explore') return null
  const [hx, hz] = along(HOPE_BRIDGE, 0.5)
  return (
    <>
      <Html position={[PIER.bx, PIER.height(1) + 2.2, PIER.bz]} center zIndexRange={[12, 0]} className="place-anchor">
        <span className="place-name">{wishes.pier.place}</span>
      </Html>
      <Html position={[hx, HOPE_BRIDGE.height(0.5) + 2.4, hz]} center zIndexRange={[12, 0]} className="place-anchor">
        <span className="place-name">{wishes.bridge.place}</span>
      </Html>
      <Html position={[GARDEN.x, ISLE_B.level + 3.4, GARDEN.z]} center zIndexRange={[12, 0]} className="place-anchor">
        <span className="place-name">{wishes.garden.place}</span>
      </Html>
    </>
  )
}

/** Everything in the western isles. */
export default function WestIsles() {
  const [near, setNear] = useState(false)
  return (
    <group>
      <Sea />
      <IsleGround isle={ISLE_A} grass="#5f8f6a" light="#7fa88a" />
      <IsleGround isle={ISLE_B} grass="#88c45e" light="#b5d978" />
      <RopeBridge w={WEST_BRIDGE} />
      <HopeBridge />
      <Pier />
      <IsleADecor />
      <Garden />
      <Stones />
      <DreamSpot />
      <AloneGhost group="swing" seatA="swing:0" seatB="swing:1" />
      <AloneGhost group="pier" seatA="pier:0" seatB="pier:1" />
      <RisingLanterns />
      <FallingStars />
      <ShoreGlow />
      <WestTracker onNear={setNear} />
      {near && <Labels />}
    </group>
  )
}

