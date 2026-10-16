import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { meadowHeight, WELL_SITE } from '../../lib/meadow'
import { addCollider, obstacles } from '../../lib/terrain'
import { useInteractable } from '../../lib/interactions'
import { finishDrop, partnerDropped, useDrops, WISH_KINDS } from '../../lib/wishes'
import { partner } from '../../lib/couple'
import { player } from '../../lib/player'
import { atmosphere } from '../../lib/atmosphere'
import { createWater } from '../../lib/water'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'
import { B, C, mat, S } from './HomeFurniture'
import { Glow, LightPools } from './Bits'

/*
 * THE WELL OF WISHES — what you see (the wishes themselves are lib/wishes.js and
 * components/ui/WellUI.jsx): a fairytale stone well with moss, wildflowers and vines, a little roof
 * crowned with a moon and a star, glowing water with ripples and rising sparkles, lanterns,
 * stepping stones and a ring of glowing flowers. A wish dropped in flies in as a folded paper star
 * and bursts into light — on both screens. Everything below is in well-local metres (front: +z).
 */

const W = WELL_SITE
const cos = Math.cos(W.yaw)
const sin = Math.sin(W.yaw)
const toWorld = (x, z) => [W.x + x * cos + z * sin, W.z - x * sin + z * cos]
const RIM = 0.86
const WATER_Y = 0.5
const LANTERNS = [
  [-1.55, 0.95],
  [1.55, 0.95],
]

// the well and its lanterns are solid
addCollider(W.x, W.z, 1.05)
for (const [x, z] of LANTERNS) addCollider(...toWorld(x, z), 0.13)
obstacles.version++

const glowNow = () => 0.3 + 0.9 * Math.max(1 - atmosphere.day, atmosphere.sunset * 0.6)

/** The stones of the well's wall (instanced, each a slightly different grey-lilac). */
function Stones() {
  const ref = useRef()
  const count = 3 * 16
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const c = new THREE.Color()
    let i = 0
    for (let row = 0; row < 3; row++)
      for (let k = 0; k < 16; k++) {
        const a = ((k + (row % 2) * 0.5) / 16) * Math.PI * 2
        q.setFromEuler(new THREE.Euler(0, -a, 0))
        m.compose(new THREE.Vector3(Math.cos(a) * RIM, 0.13 + row * 0.2, Math.sin(a) * RIM), q, new THREE.Vector3(0.17, 0.11, 0.2 + ((k * 7 + row) % 3) * 0.015))
        ref.current.setMatrixAt(i, m)
        ref.current.setColorAt(i, c.set(['#d3cadc', '#c6bcd2', '#dcd4e2', '#cbc6d8'][(k + row * 3) % 4]))
        i++
      }
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.instanceColor.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [])
  const material = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.92 }), [])
  return (
    <instancedMesh ref={ref} args={[null, material, count]} castShadow>
      <icosahedronGeometry args={[1, 1]} />
    </instancedMesh>
  )
}

/** The water: the game's water shader, a soft glow over it, ripples and sparkles rising. */
function Water({ pulse }) {
  const water = useMemo(() => createWater({ shape: 'round', center: [W.x, W.z], radius: 0.7, deep: '#3a7fd6', shallow: '#9fe6f0' }), [])
  const glow = useRef()
  const ripples = useRef()
  const sparks = useRef()
  useEffect(() => () => water.dispose(), [water])
  useFrame(({ clock }, d) => {
    water.tick(d)
    const t = clock.elapsedTime
    const p = pulse.current
    pulse.current = Math.max(0, p - d * 0.8)
    glow.current.material.opacity = 0.28 + 0.12 * Math.sin(t * 1.6) + glowNow() * 0.2 + p * 0.6
    ripples.current.children.forEach((m, i) => {
      const k = (t * 0.35 + i / 3) % 1
      m.scale.setScalar(0.15 + k * 0.55)
      m.material.opacity = 0.35 * (1 - k)
    })
    sparks.current.children.forEach((m, i) => {
      const k = (t * 0.22 + i / sparks.current.children.length) % 1
      const a = i * 2.39996 + t * 0.3
      const r = 0.12 + (i % 5) * 0.11
      m.position.set(Math.cos(a) * r * (1 - k * 0.4), WATER_Y + k * (1.4 + (i % 3) * 0.3), Math.sin(a) * r * (1 - k * 0.4))
      m.scale.setScalar((0.6 + (i % 3) * 0.25) * Math.sin(k * Math.PI) + 0.001)
    })
  })
  return (
    <group>
      {/* the dark inside of the well */}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[RIM - 0.13, RIM - 0.13, 0.62, 28, 1, true]} />
        <meshStandardMaterial color="#3b3560" roughness={0.95} side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, WATER_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} material={water}>
        <circleGeometry args={[RIM - 0.12, 32]} />
      </mesh>
      <mesh ref={glow} position={[0, WATER_Y + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[RIM - 0.14, 32]} />
        <meshBasicMaterial color="#bfe9ff" transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={ripples} position={[0, WATER_Y + 0.015, 0]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.92, 1, 40]} />
            <meshBasicMaterial color="#e8f7ff" transparent opacity={0.3} depthWrite={false} />
          </mesh>
        ))}
      </group>
      <group ref={sparks}>
        {Array.from({ length: 18 }, (_, i) => (
          <mesh key={i} material={mat(['#fff1b8', '#d9c6ff', '#bfe9ff', '#ffd6ea'][i % 4], 1.6)}>
            <sphereGeometry args={[0.022, 6, 4]} />
          </mesh>
        ))}
      </group>
      <Glow position={[0, WATER_Y + 0.35, 0]} color="#bfe0ff" size={2.2} opacity={0.4} />
    </group>
  )
}

/** A five-pointed star (flat, a little thick), for the roof and the hanging charms. */
function useStarGeometry() {
  return useMemo(() => {
    const shape = new THREE.Shape()
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2
      const r = i % 2 ? 0.42 : 1
      const x = Math.cos(a) * r
      const y = Math.sin(a) * r
      if (i) shape.lineTo(x, y)
      else shape.moveTo(x, y)
    }
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 1 })
    g.center()
    return g
  }, [])
}

/** The little roof on two posts: a crank, a rope and a bucket; a moon and a star on top. */
function Roof() {
  const star = useStarGeometry()
  const charms = useRef()
  const moonMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffe7a3', emissive: '#ffd27f', emissiveIntensity: 0.8, roughness: 0.35 }), [])
  const starMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fff4c2', emissive: '#ffe27a', emissiveIntensity: 1.0, roughness: 0.3 }), [])
  useEffect(
    () => () => {
      star.dispose()
      moonMat.dispose()
      starMat.dispose()
    },
    [star, moonMat, starMat],
  )
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const g = glowNow()
    moonMat.emissiveIntensity = 0.5 + g * 1.1
    starMat.emissiveIntensity = 0.7 + g * 1.3 + Math.sin(t * 2.2) * 0.2
    charms.current.children.forEach((m, i) => {
      m.rotation.y = t * (0.6 + i * 0.15)
      m.position.y = -0.18 - i * 0.04 + Math.sin(t * 1.4 + i) * 0.03
    })
  })
  return (
    <group>
      {[-1, 1].map((k) => (
        <group key={k} position={[k * 0.98, 0, 0]}>
          <C p={[0, 1.05, 0]} rt={0.065} rb={0.08} h={2.1} c="#9a6b4a" seg={8} />
          {/* vines winding up the post */}
          {Array.from({ length: 7 }, (_, i) => (
            <mesh key={i} position={[Math.cos(i * 1.9) * 0.08, 0.35 + i * 0.24, Math.sin(i * 1.9) * 0.08]} scale={0.06 + (i % 2) * 0.02} material={mat('#79c27c', 0, 0.9)}>
              <icosahedronGeometry args={[1, 0]} />
            </mesh>
          ))}
          <S p={[Math.cos(4) * 0.09, 1.1, Math.sin(4) * 0.09]} s={0.035} c="#ffb3cf" />
          <S p={[Math.cos(1) * 0.09, 1.6, Math.sin(1) * 0.09]} s={0.03} c="#fff6ea" />
        </group>
      ))}
      {/* the beam, the crank, the rope and the bucket */}
      <B p={[0, 1.95, 0]} s={[2.1, 0.1, 0.12]} c="#a5714a" />
      <C p={[0, 1.7, 0]} rt={0.05} h={1.9} c="#c8915f" r={[0, 0, Math.PI / 2]} />
      <group position={[1.08, 1.7, 0]}>
        <B p={[0.05, -0.1, 0]} s={[0.04, 0.22, 0.04]} c="#8a5a3c" />
        <C p={[0.12, -0.2, 0]} rt={0.025} h={0.14} c="#8a5a3c" r={[0, 0, Math.PI / 2]} />
      </group>
      <C p={[0, 1.38, 0]} rt={0.012} h={0.6} c="#e9dcc4" seg={5} />
      <group position={[0, 1.02, 0]}>
        <C p={[0, 0, 0]} rt={0.12} rb={0.1} h={0.18} c="#a5714a" />
        <mesh position={[0, 0.06, 0]} rotation={[0, 0, 0]} material={mat('#6d5a6e')}>
          <torusGeometry args={[0.12, 0.012, 5, 18, Math.PI]} />
        </mesh>
      </group>
      {/* the roof: two soft slopes, moss along the ridge */}
      <group position={[0, 2.18, 0]}>
        {[-1, 1].map((k) => (
          <B key={k} p={[0, 0.17, k * 0.38]} s={[2.4, 0.07, 0.92]} c={k > 0 ? '#c9b6f4' : '#b9a5e8'} r={[k * 0.62, 0, 0]} />
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <mesh key={i} position={[-1.05 + i * 0.26, 0.42, 0]} scale={[0.12, 0.07, 0.12]} material={mat('#8fcf7f', 0, 0.9)}>
            <icosahedronGeometry args={[1, 0]} />
          </mesh>
        ))}
        {/* the crescent moon over the front, and the star on top */}
        <mesh position={[-0.55, 0.62, 0.05]} rotation={[0, 0, 0.5]} material={moonMat}>
          <torusGeometry args={[0.16, 0.05, 8, 20, Math.PI * 1.25]} />
        </mesh>
        <mesh geometry={star} material={starMat} position={[0.35, 0.72, 0]} scale={0.16} />
        <Glow position={[0.35, 0.72, 0]} color="#ffe7a3" size={0.9} opacity={0.5} />
        {/* little stars hanging from the eaves */}
        <group ref={charms} position={[0, 0, 0.8]}>
          {[-0.9, -0.3, 0.3, 0.9].map((x, i) => (
            <mesh key={x} geometry={star} material={starMat} position={[x, -0.2, 0]} scale={0.055 + (i % 2) * 0.015} />
          ))}
        </group>
      </group>
    </group>
  )
}

/** Moss on the rim, wildflowers at the foot, stepping stones round it and on toward the path. */
function Dressing() {
  const flowers = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => {
        const a = i * 2.39996
        const r = 0.98 + (i % 4) * 0.08
        return [Math.cos(a) * r, Math.sin(a) * r, ['#ff8fbf', '#ffd27f', '#fff6ea', '#b9a5e8', '#9fd8ff'][i % 5], 0.045 + (i % 3) * 0.012]
      }),
    [],
  )
  return (
    <group>
      <mesh position={[0, 0.74, 0]} rotation={[Math.PI / 2, 0, 0]} material={mat('#d9d0e2', 0, 0.85)}>
        <torusGeometry args={[RIM, 0.12, 8, 32]} />
      </mesh>
      {[0.3, 1.4, 2.5, 3.3, 4.4, 5.6].map((a, i) => (
        <mesh key={a} position={[Math.cos(a) * RIM, 0.8, Math.sin(a) * RIM]} scale={[0.16 + (i % 2) * 0.05, 0.06, 0.12]} material={mat('#8fcf7f', 0, 0.95)}>
          <icosahedronGeometry args={[1, 1]} />
        </mesh>
      ))}
      {/* vines hanging over the rim */}
      {[0.9, 2.2, 3.9, 5.1].map((a) => (
        <group key={a} position={[Math.cos(a) * (RIM + 0.1), 0.62, Math.sin(a) * (RIM + 0.1)]}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[0, -i * 0.13, 0]} scale={0.05} material={mat('#6fb85a', 0, 0.9)}>
              <icosahedronGeometry args={[1, 0]} />
            </mesh>
          ))}
        </group>
      ))}
      {flowers.map(([x, z, c, s], i) => (
        <group key={i} position={[x, 0, z]}>
          <C p={[0, 0.06, 0]} rt={0.008} h={0.12} c="#6fae5f" seg={4} />
          <S p={[0, 0.13, 0]} s={s} c={c} />
        </group>
      ))}
      {/* stepping stones round the well, and three on toward the path */}
      {[...Array.from({ length: 9 }, (_, i) => [Math.cos((i / 9) * Math.PI * 2 + 0.3) * 1.42, Math.sin((i / 9) * Math.PI * 2 + 0.3) * 1.42]), [0.1, 2.05], [-0.15, 2.65], [0.2, 3.25]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.015, z]} scale={[0.22 + (i % 3) * 0.03, 0.035, 0.18]} material={mat('#ddd2e0', 0, 0.9)}>
          <sphereGeometry args={[1, 9, 5]} />
        </mesh>
      ))}
    </group>
  )
}

/** Two little lanterns at the front; brighter as evening comes. */
function Lanterns() {
  const glass = useRef([])
  useFrame(({ clock }) => {
    const g = glowNow()
    glass.current.forEach((m, i) => m && (m.material.emissiveIntensity = 0.4 + g * 1.5 + Math.sin(clock.elapsedTime * 3 + i * 2) * 0.08))
  })
  return LANTERNS.map(([x, z], i) => (
    <group key={i} position={[x, 0, z]}>
      <C p={[0, 0.5, 0]} rt={0.03} rb={0.045} h={1.0} c="#6d5a6e" seg={8} />
      <mesh ref={(el) => (glass.current[i] = el)} position={[0, 1.08, 0]}>
        <cylinderGeometry args={[0.075, 0.075, 0.16, 8]} />
        <meshStandardMaterial color="#ffe2a8" emissive="#ffc77a" emissiveIntensity={0.6} />
      </mesh>
      <C p={[0, 1.2, 0]} rt={0.1} rb={0.03} h={0.07} c="#6d5a6e" />
      <Glow position={[0, 1.08, 0]} color="#ffd9a0" size={1.0} opacity={0.45} />
    </group>
  ))
}

/** A ring of glowing bell-flowers in the grass, twinkling softly. */
function GlowFlowers() {
  const ref = useRef()
  const list = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2 + 0.2
        const r = 2.0 + (i % 3) * 0.25
        return [Math.cos(a) * r, Math.sin(a) * r, ['#d9c6ff', '#bfe9ff', '#ffd6ea', '#fff1b8'][i % 4]]
      }).filter(([x, z]) => !(Math.abs(x) < 0.6 && z > 1.6)), // (not on the stepping stones)
    [],
  )
  const mats = useMemo(() => list.map(([, , c]) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1, roughness: 0.4 })), [list])
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats])
  useFrame(({ clock }) => {
    const g = glowNow()
    mats.forEach((m, i) => (m.emissiveIntensity = 0.5 + g * 1.4 + Math.sin(clock.elapsedTime * 1.7 + i * 1.3) * 0.3))
  })
  return (
    <group ref={ref}>
      {list.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <C p={[0, 0.12, 0]} rt={0.01} h={0.24} c="#6fae5f" seg={4} />
          <mesh position={[0, 0.26, 0]} rotation={[Math.PI, 0, 0]} material={mats[i]}>
            <coneGeometry args={[0.06, 0.09, 7, 1, true]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/* ───────── a wish flying in ───────── */

/** A folded paper star flying in an arc from the person who made it into the water, then a burst of light. */
function Flight({ drop, onLand, waterAt }) {
  const paper = useRef()
  const burst = useRef()
  const from = useRef(null)
  const landed = useRef(false)
  const color = WISH_KINDS[drop.kind]?.color || '#ffd6ea'
  const paperMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fffaf2', emissive: color, emissiveIntensity: 0.5, roughness: 0.6 }), [color])
  useEffect(() => () => paperMat.dispose(), [paperMat])
  useFrame(() => {
    if (!from.current) {
      const p = drop.from === 'mate' && partner.shown.ok ? partner.shown : player.position
      from.current = new THREE.Vector3(p.x, (p.y ?? meadowHeight(p.x, p.z)) + 1.05, p.z)
    }
    const t = (performance.now() - drop.at) / 1000
    const fly = Math.min(1, t / 1.5)
    const a = from.current
    const b = waterAt
    const e = fly * fly * (3 - 2 * fly)
    paper.current.visible = fly < 1
    paper.current.position.set(a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e + Math.sin(fly * Math.PI) * 1.3, a.z + (b.z - a.z) * e)
    paper.current.rotation.set(t * 4, t * 6, t * 3)
    if (fly >= 1 && !landed.current) {
      landed.current = true
      onLand()
    }
    // the burst: sparks out and up, fading
    const k = Math.max(0, (t - 1.5) / 1.2)
    burst.current.visible = t > 1.5 && k < 1
    burst.current.children.forEach((m, i) => {
      const ang = (i / burst.current.children.length) * Math.PI * 2
      m.position.set(b.x + Math.cos(ang) * k * 0.9, b.y + k * 1.4 - k * k * 0.6 + (i % 3) * 0.08 * k, b.z + Math.sin(ang) * k * 0.9)
      m.scale.setScalar(Math.max(0.001, 1 - k))
    })
    if (t > 2.9) finishDrop(drop.id)
  })
  return (
    <group>
      <mesh ref={paper} material={paperMat} scale={[0.09, 0.05, 0.09]}>
        <octahedronGeometry args={[1, 0]} />
      </mesh>
      <group ref={burst} visible={false}>
        {Array.from({ length: 14 }, (_, i) => (
          <mesh key={i} material={mat(['#fff1b8', color, '#bfe9ff', '#ffffff'][i % 4], 1.8)}>
            <sphereGeometry args={[0.035, 6, 4]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export default function WishingWell() {
  const view = useStore((s) => s.view)
  const drops = useDrops((s) => s.list)
  const root = useRef()
  const pulse = useRef(0)
  const y = useMemo(() => meadowHeight(W.x, W.z), [])
  const waterAt = useMemo(() => new THREE.Vector3(W.x, y + WATER_Y + 0.05, W.z), [y])
  const front = useMemo(() => {
    const [x, z] = toWorld(0, 1.35)
    return new THREE.Vector3(x, y, z)
  }, [y])
  const pools = useMemo(() => {
    const [x, z] = toWorld(0, 0.9)
    return [{ x, y, z }]
  }, [y])
  useInteractable('wishing-well', {
    position: front,
    radius: 2.1,
    priority: 0.3,
    enabled: () => !player.act && useStore.getState().view === 'explore',
    label: 'Sumur Harapan ✨',
    onInteract: () => {
      audio.sparkle()
      useStore.getState().setPanel('well')
    },
  })
  useFrame(() => {
    // only drawn when she's around
    root.current.visible = Math.hypot(player.position.x - W.x, player.position.z - W.z) < 50
    // the other person dropped a wish: the paper flies on this screen too
    if (partner.online && partner.wish?.id) partnerDropped(partner.wish)
  })
  if (['finale', 'finalRoom'].includes(view)) return null
  return (
    <group ref={root}>
      <group position={[W.x, y, W.z]} rotation={[0, W.yaw, 0]}>
        {/* a soft mossy floor for the clearing, a hair above the level pad */}
        <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mat('#a6dc9a', 0, 0.95)}>
          <circleGeometry args={[1.75, 36]} />
        </mesh>
        <Stones />
        <Dressing />
        <Water pulse={pulse} />
        <Roof />
        <Lanterns />
        <GlowFlowers />
      </group>
      {drops.map((d) => (
        <Flight
          key={d.id}
          drop={d}
          waterAt={waterAt}
          onLand={() => {
            pulse.current = 1
            audio.sparkle()
          }}
        />
      ))}
      <LightPools points={pools} size={4.5} color="#cfe3ff" strength={0.55} />
    </group>
  )
}
