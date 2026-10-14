import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { addCollider, HOP_PLATFORMS, seeded, SKY, skyDistance, skyIslandHeight } from '../../lib/terrain'
import { player, walkTo } from '../../lib/player'
import { useInteractable } from '../../lib/interactions'
import { useSeat, emote } from '../../lib/actions'
import { withPaint } from '../../lib/paint'
import { atmosphere } from '../../lib/atmosphere'
import { useCouple } from '../../lib/couple'
import { useHome } from '../../lib/home'
import { findStar, grabHopStar, myCheckpoint, reachCheckpoint, retryFinish, startHop, useSky, visitSky } from '../../lib/sky'
import {
  AREAS,
  BALLOON_PAD,
  checkpointAt,
  checkpointPos,
  CHECKPOINTS,
  DOCK,
  GAZEBO,
  GOAL_CP,
  HOP_START,
  HOP_STAR_IDS,
  hopStarPos,
  MOMENT,
  OBS_IDS,
  OBSERVATORY,
  obsStarPos,
  sky,
  skyPoint,
  SKY_PATHS,
  SUNSET_BENCH,
  WATERFALL,
} from '../../lib/skyLayout'
import { useStore } from '../../store'
import { count } from '../../lib/device'
import { audio } from '../../audio/engine'
import { B, C, mat, S } from './HomeFurniture'
import { Glow, HeartMesh } from './Bits'
import { DriftParticles, Fireflies } from './Particles'

/*
 * SKY ISLAND — the island above the clouds, east of the main island, reached only by the hot air
 * balloon (components/three/Balloon.jsx). Five places: Sky Dock, Cloud Garden (a gazebo and the
 * sunset bench), Star Observatory (a telescope and eight hidden stars), Cloud Hop (jumping along
 * cloud platforms together) and, hidden behind hedges, Our Little Moment.
 * It's part of the same world as everything else: no loading, no new scene, the same characters.
 */

const tmp = new THREE.Vector3()
const connected = () => useCouple.getState().status === 'connected' && useSky.getState().status === 'ready'

function tapWalk(e) {
  const s = useStore.getState()
  if (s.view !== 'explore' || s.phase !== 'world' || e.delta > 8) return
  walkTo(e.point.x, e.point.z, 0.2)
  player.onArrive = null
}

/* ───────── the island ───────── */

function SkyGround() {
  const { top, under } = useMemo(() => {
    const rows = 20
    const segs = 80
    const pos = []
    const col = []
    const idx = []
    const c = new THREE.Color()
    const grass = new THREE.Color('#8fcc66')
    const light = new THREE.Color('#c4e58a')
    const gold = new THREE.Color('#e8d98a')
    for (let r = 0; r <= rows + 1; r++) {
      const f = r <= rows ? Math.max(0.0001, r / rows) : 1.03
      for (let s = 0; s <= segs; s++) {
        const a = (s / segs) * Math.PI * 2
        let R = SKY.r * 1.2
        for (let k = 0; k < 4; k++) R = (R / skyDistance(SKY.x + Math.cos(a) * R, SKY.z + Math.sin(a) * R)) * 0.999
        const x = SKY.x + Math.cos(a) * R * f
        const z = SKY.z + Math.sin(a) * R * f
        pos.push(x, r <= rows ? skyIslandHeight(x, z) : skyIslandHeight(x, z) - 0.3, z)
        const n = 0.5 + 0.5 * Math.sin(x * 1.1) * Math.cos(z * 1.3)
        c.copy(grass).lerp(light, (1 - f) * 0.4 + n * 0.2).lerp(gold, Math.max(0, f - 0.8) * 0.6)
        col.push(c.r, c.g, c.b)
      }
    }
    for (let r = 0; r <= rows; r++)
      for (let s = 0; s < segs; s++) {
        const a = r * (segs + 1) + s
        const b = a + segs + 1
        idx.push(a, a + 1, b, b, a + 1, b + 1)
      }
    const top = new THREE.BufferGeometry()
    top.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    top.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    top.setIndex(idx)
    top.computeVertexNormals()

    const profile = [
      [1.03, -0.3],
      [0.94, -1.3],
      [0.78, -2.6],
      [0.56, -4.0],
      [0.34, -5.4],
      [0.14, -6.8],
      [0.0001, -7.8],
    ]
    const upos = []
    const ucol = []
    const uidx = []
    const a0 = new THREE.Color('#d4a87c')
    const a1 = new THREE.Color('#8a6a5a')
    profile.forEach(([f, y], row) => {
      for (let s = 0; s <= 44; s++) {
        const a = (s / 44) * Math.PI * 2
        const j = row === 0 || row === profile.length - 1 ? 0 : 0.09 * Math.sin(a * 5 + row * 1.3)
        const R = SKY.r * f * (1 + j)
        upos.push(SKY.x + Math.cos(a) * R, SKY.level + y, SKY.z + Math.sin(a) * R)
        c.copy(a0).lerp(a1, row / (profile.length - 1))
        ucol.push(c.r, c.g, c.b)
      }
    })
    for (let r = 0; r < profile.length - 1; r++)
      for (let s = 0; s < 44; s++) {
        const a = r * 45 + s
        const b = a + 45
        uidx.push(a, a + 1, b, b, a + 1, b + 1)
      }
    const under = new THREE.BufferGeometry()
    under.setAttribute('position', new THREE.Float32BufferAttribute(upos, 3))
    under.setAttribute('color', new THREE.Float32BufferAttribute(ucol, 3))
    under.setIndex(uidx)
    under.computeVertexNormals()
    return { top, under }
  }, [])
  const materials = useMemo(
    () => ({
      top: withPaint(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), 'foliage'),
      under: withPaint(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), 'earth'),
    }),
    [],
  )
  useEffect(
    () => () => {
      top.dispose()
      under.dispose()
    },
    [top, under],
  )
  return (
    <group>
      <mesh geometry={top} material={materials.top} onClick={tapWalk} />
      <mesh geometry={under} material={materials.under} />
    </group>
  )
}

/* ───────── the five places ───────── */

function SkySeat({ id, at, yaw, h, group, label, out = 0.7 }) {
  const p = skyPoint(...at)
  useSeat(id, { x: p.x, z: p.z, y: p.y + h, yaw, exit: [p.x + Math.sin(yaw) * out, p.z + Math.cos(yaw) * out], group, label })
  return null
}

function Bench({ at, yaw, id, label }) {
  const p = skyPoint(...at)
  const side = [Math.cos(yaw), -Math.sin(yaw)]
  useEffect(() => addCollider(p.x, p.z, 0.45), []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <group>
      <group position={p} rotation={[0, yaw, 0]}>
        <B p={[0, 0.42, 0]} s={[1.3, 0.06, 0.42]} c="#d9a574" />
        <B p={[0, 0.68, -0.19]} s={[1.3, 0.32, 0.05]} c="#d9a574" />
        {[-0.58, 0.58].map((x) => (
          <B key={x} p={[x, 0.21, 0]} s={[0.06, 0.42, 0.38]} c="#8a6248" />
        ))}
      </group>
      {[-0.32, 0.32].map((k, i) => (
        <SkySeat key={i} id={`${id}:${i}`} at={[at[0] + side[0] * k, at[1] + side[1] * k]} yaw={yaw} h={0.45} group={id} label={label} />
      ))}
    </group>
  )
}

function Lantern({ at, h = 1.3 }) {
  const p = skyPoint(...at)
  return (
    <group position={p}>
      <C p={[0, h / 2, 0]} rt={0.035} rb={0.05} h={h} c="#6d5a6e" seg={6} />
      <B p={[0, h + 0.08, 0]} s={[0.16, 0.2, 0.16]} c="#ffe2a8" glow={1.1} />
      <Glow position={[0, h + 0.08, 0]} color="#ffd9a0" size={1.1} opacity={0.5} />
    </group>
  )
}

function Dock() {
  const p = skyPoint(...DOCK.at)
  return (
    <group>
      <group position={p}>
        <B p={[0, 0.03, 0]} s={[2.2, 0.06, 2.0]} c="#c8915f" />
        {/* the arch of clouds you walk through */}
        {[-0.95, 0.95].map((z) => (
          <C key={z} p={[0.5, 0.9, z]} rt={0.07} h={1.8} c="#ffffff" seg={8} />
        ))}
        <mesh position={[0.5, 1.8, 0]} rotation={[0, Math.PI / 2, 0]} material={mat('#ffffff')}>
          <torusGeometry args={[0.95, 0.07, 6, 20, Math.PI]} />
        </mesh>
        {Array.from({ length: 7 }, (_, i) => {
          const a = (i / 6) * Math.PI
          return <S key={i} p={[0.5, 1.8 + Math.sin(a) * 0.95, Math.cos(a) * 0.95]} s={0.16} c="#f4f8ff" />
        })}
      </group>
      <Lantern at={[DOCK.at[0] + 0.4, DOCK.at[1] - 1.4]} />
      <Lantern at={[DOCK.at[0] + 0.4, DOCK.at[1] + 1.4]} />
    </group>
  )
}

function CloudGarden() {
  const g = skyPoint(...GAZEBO.at)
  useEffect(() => {
    // the six posts of the gazebo
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6
      addCollider(g.x + Math.cos(a) * GAZEBO.r, g.z + Math.sin(a) * GAZEBO.r, 0.15)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const flowers = useMemo(() => {
    const list = []
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2
      const r = 2.5 + (i % 3) * 0.25
      list.push({ at: [GAZEBO.at[0] + Math.cos(a) * r, GAZEBO.at[1] + Math.sin(a) * r], c: ['#ff8fbf', '#ffd27f', '#f7f2ff', '#b9a5e8', '#ff9f8f'][i % 5] })
    }
    // leave the gazebo's doorway (south side) open
    return list.filter((f) => !(f.at[1] > GAZEBO.at[1] + 1.8 && Math.abs(f.at[0] - GAZEBO.at[0]) < 1.1))
  }, [])
  return (
    <group>
      <group position={g}>
        <C p={[0, 0.04, 0]} rt={GAZEBO.r + 0.2} h={0.08} c="#f4ece0" seg={6} r={[0, Math.PI / 6, 0]} />
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2 + Math.PI / 6
          return <C key={i} p={[Math.cos(a) * GAZEBO.r, 1.1, Math.sin(a) * GAZEBO.r]} rt={0.06} h={2.1} c="#ffffff" seg={8} />
        })}
        <mesh position={[0, 2.55, 0]} rotation={[0, Math.PI / 6, 0]} material={mat('#f7c6d0')}>
          <coneGeometry args={[GAZEBO.r + 0.45, 0.95, 6]} />
        </mesh>
        <S p={[0, 3.1, 0]} s={0.09} c="#ffe2a8" glow={1.4} />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2
          return <S key={i} p={[Math.cos(a) * (GAZEBO.r + 0.3), 2.1, Math.sin(a) * (GAZEBO.r + 0.3)]} s={0.04} c={i % 2 ? '#ffd6ea' : '#ffe2a8'} glow={1.6} />
        })}
        <Glow position={[0, 1.6, 0]} color="#ffd9a0" size={3} opacity={0.25} />
      </group>
      <Bench at={[GAZEBO.at[0], GAZEBO.at[1] - 0.9]} yaw={0} id="gazebo" label="Duduk di gazebo" />
      <Bench at={SUNSET_BENCH.at} yaw={SUNSET_BENCH.yaw} id="sunset" label="Lihat matahari terbenam" />
      {flowers.map((f, i) => {
        const p = skyPoint(...f.at)
        return (
          <group key={i} position={p}>
            <S p={[0, 0.1, 0]} s={[0.13, 0.09, 0.13]} c="#6fb85a" />
            <S p={[0, 0.2, 0]} s={0.055} c={f.c} />
          </group>
        )
      })}
      <Lantern at={[GAZEBO.at[0] - 2.6, GAZEBO.at[1] + 1.4]} />
      <Lantern at={[GAZEBO.at[0] + 2.6, GAZEBO.at[1] + 1.4]} />
      <Fireflies count={count(12, 6)} area={[6, 2, 6]} center={[g.x, g.y + 1.2, g.z]} seed={71} colors={['#ffe2a8', '#ffd6ea']} />
    </group>
  )
}

/** The observatory: a stone platform, a telescope ("Amati langit" turns the sky to night for a moment). */
function Observatory() {
  const o = skyPoint(...OBSERVATORY.at)
  const s = skyPoint(...OBSERVATORY.scope)
  const viewing = useRef(0)
  useEffect(() => addCollider(s.x, s.z, 0.35), []) // eslint-disable-line react-hooks/exhaustive-deps
  useInteractable('sky-telescope', {
    position: s,
    radius: 1.6,
    label: 'Amati langit',
    onInteract: () => {
      audio.sparkle()
      viewing.current = 10
      useStore.getState().showToast('Langit berubah jadi malam sebentar ✦ Bintang yang belum ketemu bersinar lebih terang.', 4000)
    },
  })
  useFrame((_, delta) => {
    if (viewing.current > 0) {
      viewing.current -= delta
      // a starry night while she looks, then back to the golden hour up here
      atmosphere.place = viewing.current > 0 ? { day: 0.15, sunset: 0.3 } : useSky.getState().onSky ? { sunset: 0.75 } : null
      observing.on = viewing.current > 0
    }
  })
  return (
    <group>
      <group position={o}>
        <C p={[0, 0.03, 0]} rt={2.0} h={0.06} c="#d9d2e8" seg={20} />
        <C p={[0, 0.05, 0]} rt={1.6} h={0.06} c="#c4bbdd" seg={20} />
        {/* a little star map on the floor */}
        {Array.from({ length: 9 }, (_, i) => {
          const a = i * 2.4
          const r = 0.3 + (i % 4) * 0.3
          return <S key={i} p={[Math.cos(a) * r, 0.09, Math.sin(a) * r]} s={[0.04, 0.01, 0.04]} c="#fff1c9" glow={1} />
        })}
      </group>
      <group position={s} rotation={[0, -0.6, 0]}>
        {[0, 2.1, 4.2].map((a) => (
          <C key={a} p={[Math.cos(a) * 0.2, 0.42, Math.sin(a) * 0.2]} rt={0.025} h={0.9} c="#6d5a6e" r={[Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25]} seg={5} />
        ))}
        <group position={[0, 0.95, 0]} rotation={[0.9, 0, 0]}>
          <C p={[0, 0.2, 0]} rt={0.09} rb={0.12} h={0.8} c="#b9a5e8" />
          <C p={[0, 0.62, 0]} rt={0.11} h={0.06} c="#e9c98b" />
        </group>
      </group>
    </group>
  )
}
/** While she's looking through the telescope, the hidden stars shine brighter. */
const observing = { on: false }

function ObsStar({ id }) {
  const found = useSky((s) => Boolean(s.stars[id]))
  const ref = useRef()
  const beam = useRef()
  const pos = useMemo(() => obsStarPos(id), [id])
  useInteractable(`sky-star:${id}`, {
    position: pos,
    radius: 1.2,
    priority: 0.5,
    enabled: () => !useSky.getState().stars[id] && useStore.getState().view === 'explore',
    label: () => (connected() ? 'Ambil bintang' : 'Bintang tersembunyi (main berdua dulu ♡)'),
    onInteract: () => {
      if (!connected()) return useStore.getState().setPanel('couple')
      audio.sparkle()
      findStar(id)
    },
  })
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime
    ref.current.rotation.y = t * 1.2
    ref.current.position.y = pos.y + Math.sin(t * 2 + pos.x) * 0.06
    if (beam.current) beam.current.visible = observing.on
  })
  if (found) return null
  return (
    <group>
      <group ref={ref} position={pos}>
        <mesh material={mat('#fff1c9', 1.6)} scale={0.11}>
          <octahedronGeometry args={[1, 0]} />
        </mesh>
        <Glow color="#ffe2a8" size={0.7} opacity={0.6} />
      </group>
      <mesh ref={beam} position={[pos.x, pos.y + 2, pos.z]} visible={false}>
        <cylinderGeometry args={[0.04, 0.12, 4, 8, 1, true]} />
        <meshBasicMaterial color="#fff1c9" transparent opacity={0.35} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** Cloud Hop: the start pad, the cloud platforms, flags at the checkpoints, and the round's stars. */
function CloudHop() {
  const round = useSky((s) => s.round)
  const pad = skyPoint(...HOP_START)
  useInteractable('hop-start', {
    position: pad,
    radius: 1.6,
    enabled: () => useStore.getState().view === 'explore' && !useSky.getState().round,
    label: () => (connected() ? 'Mulai Cloud Hop' : 'Cloud Hop (main berdua dulu ♡)'),
    onInteract: () => {
      if (!connected()) return useStore.getState().setPanel('couple')
      audio.sparkle()
      startHop()
    },
  })
  const mine = round ? myCheckpoint(round) : 0
  return (
    <group>
      <group position={pad}>
        <C p={[0, 0.04, 0]} rt={0.9} h={0.08} c="#f4ece0" seg={16} />
        <C p={[0.7, 0.7, -0.4]} rt={0.03} h={1.4} c="#ffffff" seg={6} />
        <B p={[0.95, 1.25, -0.4]} s={[0.45, 0.28, 0.02]} c="#ff8fbf" />
      </group>
      {HOP_PLATFORMS.map((p, i) => (
        <group key={i} position={[p.x, p.y, p.z]}>
          {/* a puffy cloud with a flat top to stand on */}
          <C p={[0, -0.06, 0]} rt={p.r} rb={p.r * 0.9} h={0.12} c="#ffffff" seg={14} />
          <S p={[0, -0.22, 0]} s={[p.r * 1.05, 0.28, p.r * 1.05]} c="#f2f6ff" />
          <S p={[p.r * 0.55, -0.3, p.r * 0.3]} s={[p.r * 0.55, 0.25, p.r * 0.55]} c="#e8eefc" />
          <S p={[-p.r * 0.5, -0.32, -p.r * 0.35]} s={[p.r * 0.5, 0.22, p.r * 0.5]} c="#e8eefc" />
        </group>
      ))}
      {CHECKPOINTS.map((cp, i) => {
        if (i === 0) return null
        const at = checkpointPos(i)
        const reached = round && mine >= i
        return (
          <group key={i} position={[at.x + 0.45, at.y, at.z - 0.35]}>
            <C p={[0, 0.55, 0]} rt={0.025} h={1.1} c="#ffffff" seg={6} />
            <B p={[0.2, 0.95, 0]} s={[0.36, 0.22, 0.02]} c={i === GOAL_CP ? '#ffd27f' : reached ? '#7dffb0' : '#9ec8f0'} glow={reached ? 0.6 : 0} />
            {i === GOAL_CP && <Glow position={[0, 1.2, 0]} color="#ffd27f" size={1.6} opacity={0.5} />}
          </group>
        )
      })}
      {round && HOP_STAR_IDS.filter((id) => !round.stars?.includes(id)).map((id) => <HopStar key={id} id={id} />)}
    </group>
  )
}

function HopStar({ id }) {
  const ref = useRef()
  const pos = useMemo(() => hopStarPos(id), [id])
  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.rotation.y = clock.elapsedTime * 2
    ref.current.position.y = pos.y + Math.sin(clock.elapsedTime * 3 + pos.x) * 0.05
  })
  return (
    <group ref={ref} position={pos}>
      <mesh material={mat('#ffd27f', 1.5)} scale={0.13}>
        <octahedronGeometry args={[1, 0]} />
      </mesh>
      <Glow color="#ffd27f" size={0.8} opacity={0.6} />
    </group>
  )
}

/** Our Little Moment: hedges with one small gap, a bench toward the sunset, a photo spot, and (once unlocked) a heart arch. */
function Moment() {
  const unlocked = useSky((s) => Boolean(s.progress?.moment_unlocked))
  const memory = useHome((s) => s.memory)
  const hedges = useMemo(() => {
    const list = []
    for (let i = 0; i < 14; i++) {
      const a = -0.9 + (i / 13) * 4.6 // a ring open toward the island's middle (the gap) and the west (the view)
      if (a > 0.15 && a < 0.6) continue
      list.push([MOMENT.at[0] + Math.cos(a) * 2.3, MOMENT.at[1] + Math.sin(a) * 2.3])
    }
    return list.filter(([x]) => x > MOMENT.at[0] - 1.6)
  }, [])
  useEffect(() => {
    hedges.forEach((h) => {
      const p = skyPoint(...h)
      addCollider(p.x, p.z, 0.38)
    })
  }, [hedges])
  const photo = skyPoint(...MOMENT.photo)
  useInteractable('sky-photo', {
    position: photo,
    radius: 1.3,
    label: 'Foto berdua',
    onInteract: () => {
      emote('photo')
      audio.sparkle()
      useStore.getState().showToast('Cekrek! 📸 Ajak dia berdiri di sebelahmu, ya.', 3000)
    },
  })
  const board = skyPoint(...MOMENT.board)
  const text = memory?.title || memory?.note ? [memory.title, memory.note].filter(Boolean).join(' — ') : 'Sudut kecil untuk kita berdua.'
  return (
    <group>
      {hedges.map((h, i) => {
        const p = skyPoint(...h)
        return (
          <group key={i} position={p}>
            <S p={[0, 0.45, 0]} s={[0.45, 0.5, 0.45]} c="#5fa85a" />
            <S p={[0.12, 0.75, 0.05]} s={[0.25, 0.25, 0.25]} c="#7dc06a" />
          </group>
        )
      })}
      <Bench at={MOMENT.bench} yaw={MOMENT.benchYaw} id="moment" label="Duduk berdua" />
      <group position={photo}>
        <C p={[0, 0.02, 0]} rt={0.45} h={0.03} c="#ffd6ea" seg={20} />
        <HeartMesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={0.12} color="#ff9cc8" emissive="#ff5fa2" glow={0.6} />
      </group>
      <group position={board}>
        <B p={[0, 0.5, 0]} s={[0.07, 1.0, 0.07]} c="#a5714a" />
        <B p={[0, 1.05, 0]} s={[0.8, 0.45, 0.05]} c="#fff8ee" />
        <Html position={[0, 1.05, 0.04]} center transform scale={0.18} zIndexRange={[12, 0]} className="mochi-anchor">
          <span className="moment-board">{text}</span>
        </Html>
      </group>
      {unlocked && (
        <group position={skyPoint(MOMENT.at[0] - 1.4, MOMENT.at[1] - 0.2)}>
          {[-0.75, 0.75].map((z) => (
            <C key={z} p={[0, 0.8, z]} rt={0.05} h={1.6} c="#ffffff" seg={6} />
          ))}
          <mesh position={[0, 1.6, 0]} rotation={[0, Math.PI / 2, 0]} material={mat('#ffffff')}>
            <torusGeometry args={[0.75, 0.05, 6, 20, Math.PI]} />
          </mesh>
          {Array.from({ length: 11 }, (_, i) => {
            const a = (i / 10) * Math.PI
            return <S key={i} p={[0, 1.6 + Math.sin(a) * 0.75, Math.cos(a) * 0.75]} s={0.05} c={i % 2 ? '#ffd6ea' : '#ffe2a8'} glow={1.8} />
          })}
          <HeartMesh position={[0, 2.45, 0]} scale={0.16} color="#ff9cc8" emissive="#ff5fa2" glow={1.3} />
          <Glow position={[0, 1.8, 0]} color="#ffc2dd" size={2.2} opacity={0.4} />
        </group>
      )}
    </group>
  )
}

/** A thin waterfall off the north-east edge (a scrolling ribbon), fed by a little spring. */
const fallMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  uniforms: { uTime: { value: 0 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform float uTime; varying vec2 vUv;
    void main() {
      float streak = 0.55 + 0.45 * sin(vUv.x * 40.0 + sin(vUv.x * 7.0) * 3.0);
      float flow = fract(vUv.y * 3.0 + uTime * 1.4);
      float a = (0.55 + 0.35 * streak * smoothstep(0.0, 0.6, flow)) * smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.85, 1.0, abs(vUv.x - 0.5) * 2.0));
      gl_FragColor = vec4(mix(vec3(0.78, 0.92, 1.0), vec3(1.0), streak * 0.5), a * 0.8);
    }`,
})
function Waterfall() {
  const [wx, wz] = sky(...WATERFALL.at)
  const dir = WATERFALL.dir
  useFrame((_, delta) => (fallMaterial.uniforms.uTime.value += delta))
  return (
    <group>
      <group position={[wx, SKY.level - 0.05, wz]} rotation={[0, dir, 0]}>
        <mesh position={[0, -3.2, 0.5]} material={fallMaterial}>
          <planeGeometry args={[0.9, 6.4]} />
        </mesh>
      </group>
      <group position={skyPoint(WATERFALL.at[0] * 0.8, WATERFALL.at[1] * 0.8)}>
        <C p={[0, 0.02, 0]} rt={0.75} h={0.04} c="#9fd6e8" seg={18} />
        {Array.from({ length: 7 }, (_, i) => {
          const a = (i / 7) * Math.PI * 2
          return <S key={i} p={[Math.cos(a) * 0.82, 0.06, Math.sin(a) * 0.82]} s={[0.14, 0.09, 0.12]} c="#cfc6b8" />
        })}
      </group>
    </group>
  )
}

/** A few trees and rocks around the edges (with colliders), away from the five places. */
function Scenery() {
  const trees = useMemo(
    () => [
      [-3.6, 1.6, 1.0],
      [0.6, -2.4, 0.9],
      [3.4, -5.2, 1.1],
      [-7.0, -3.0, 0.85],
      [6.8, 4.6, 0.9],
      [-2.4, 7.6, 0.8],
      [2.2, 2.0, 0.75],
    ],
    [],
  )
  useEffect(() => {
    trees.forEach(([x, z]) => {
      const p = skyPoint(x, z)
      addCollider(p.x, p.z, 0.35)
    })
  }, [trees])
  return trees.map(([x, z, s], i) => {
    const p = skyPoint(x, z)
    return (
      <group key={i} position={p} scale={s}>
        <C p={[0, 0.55, 0]} rt={0.09} rb={0.13} h={1.1} c="#9a6b4a" seg={7} />
        <S p={[0, 1.45, 0]} s={[0.6, 0.55, 0.6]} c={i % 3 === 0 ? '#ffc2d9' : '#7dc06a'} />
        <S p={[0.25, 1.75, 0.1]} s={[0.35, 0.32, 0.35]} c={i % 3 === 0 ? '#ffd6e6' : '#93cf7c'} />
      </group>
    )
  })
}

/* ───────── making it lovely: clouds, little islands, flowers, paths, a rainbow ───────── */

const segDist = (px, pz, [ax, az], [bx, bz]) => {
  const vx = bx - ax
  const vz = bz - az
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz || 1)))
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t))
}
const pathDist = (x, z) => Math.min(...SKY_PATHS.flatMap((p) => p.slice(1).map((b, i) => segDist(x, z, p[i], b))))
/** Places on the island where nothing decorative should grow (island-local). */
const CLEAR = [
  ...AREAS.map((a) => [a.at[0], a.at[1], a.r * 0.75]),
  [GAZEBO.at[0], GAZEBO.at[1], GAZEBO.r + 0.6],
  [OBSERVATORY.at[0], OBSERVATORY.at[1], 2.3],
  [BALLOON_PAD[0], BALLOON_PAD[1], 2.0],
  [HOP_START[0], HOP_START[1], 1.4],
  [MOMENT.at[0], MOMENT.at[1], 2.7],
  [WATERFALL.at[0] * 0.8, WATERFALL.at[1] * 0.8, 1.2],
]
const isClear = (x, z, pad = 0) => CLEAR.every(([cx, cz, r]) => Math.hypot(x - cx, z - cz) > r + pad) && pathDist(x, z) > 0.55 + pad

/** A soft sea of clouds below and around the island (one instanced draw). */
function CloudSea() {
  const ref = useRef()
  const puffs = useMemo(() => {
    const rand = seeded(5150)
    const n = count(70, 36)
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + rand() * 0.2
      const r = SKY.r * (1.0 + rand() * 1.4)
      return { x: Math.cos(a) * r, z: Math.sin(a) * r, y: -5.5 + rand() * 2.5 - (r - SKY.r) * 0.1, s: 1.6 + rand() * 2.4 }
    })
  }, [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    puffs.forEach((p, i) => {
      m.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(p.s * 1.4, p.s * 0.5, p.s))
      ref.current.setMatrixAt(i, m)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [puffs])
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.elapsedTime * 0.006
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, puffs.length]} position={[SKY.x, SKY.level, SKY.z]} material={mat('#ffffff', 0.08, 1)}>
      <icosahedronGeometry args={[1, 1]} />
    </instancedMesh>
  )
}

const ISLETS = [
  { a: 0.6, r: 15.5, y: 1.2, s: 1.0, tree: true },
  { a: 1.9, r: 17.5, y: -1.4, s: 0.8, tree: false },
  { a: 2.9, r: 14.5, y: 2.6, s: 0.7, tree: true },
  { a: 4.1, r: 16.5, y: -0.6, s: 1.1, tree: false },
  { a: 5.3, r: 15.0, y: 1.9, s: 0.85, tree: true },
]
/** Little floating islands drifting around Sky Island, each with a tree or a few flowers. */
function Islets() {
  const ref = useRef()
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    g.rotation.y = clock.elapsedTime * 0.01
    g.children.forEach((c, i) => (c.position.y = SKY.level + ISLETS[i].y + Math.sin(clock.elapsedTime * 0.4 + i) * 0.25))
  })
  return (
    <group ref={ref} position={[SKY.x, 0, SKY.z]}>
      {ISLETS.map((it, i) => (
        <group key={i} position={[Math.cos(it.a) * it.r, SKY.level + it.y, Math.sin(it.a) * it.r]} scale={it.s}>
          <mesh position={[0, -0.9, 0]} rotation={[Math.PI, 0, 0]} material={mat('#b58a68', 0, 1)}>
            <coneGeometry args={[1.3, 2.0, 7]} />
          </mesh>
          <C p={[0, 0.05, 0]} rt={1.32} rb={1.3} h={0.16} c="#8fcc66" seg={10} />
          {it.tree ? (
            <group>
              <C p={[0, 0.6, 0]} rt={0.07} rb={0.1} h={0.9} c="#9a6b4a" seg={6} />
              <S p={[0, 1.25, 0]} s={[0.55, 0.48, 0.55]} c={i % 2 ? '#ffc2d9' : '#93cf7c'} />
            </group>
          ) : (
            [0, 1, 2, 3].map((k) => <S key={k} p={[Math.cos(k * 1.6) * 0.6, 0.2, Math.sin(k * 1.6) * 0.6]} s={0.08} c={['#ff8fbf', '#ffd27f', '#f7f2ff', '#b9a5e8'][k]} />)
          )}
        </group>
      ))}
    </group>
  )
}

/** Flowers and tufts of grass all over the island, kept off the paths and the five places (two instanced draws). */
function Meadow() {
  const flowersRef = useRef()
  const grassRef = useRef()
  const { flowers, grass } = useMemo(() => {
    const rand = seeded(2024)
    const flowers = []
    const grass = []
    const colors = ['#ff8fbf', '#ffd27f', '#f7f2ff', '#b9a5e8', '#ff9f8f', '#9ec8f0']
    const maxF = count(170, 90)
    const maxG = count(150, 70)
    for (let i = 0; i < 900 && (flowers.length < maxF || grass.length < maxG); i++) {
      const a = rand() * Math.PI * 2
      const r = Math.sqrt(rand()) * SKY.r * 0.92
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      if (!isClear(x, z) || skyDistance(SKY.x + x, SKY.z + z) > 0.9) continue
      const p = { x: SKY.x + x, y: skyIslandHeight(SKY.x + x, SKY.z + z), z: SKY.z + z, s: 0.6 + rand() * 0.6, c: colors[Math.floor(rand() * colors.length)], r: rand() * 6 }
      if (rand() < 0.55 && flowers.length < maxF) flowers.push(p)
      else if (grass.length < maxG) grass.push(p)
    }
    return { flowers, grass }
  }, [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const c = new THREE.Color()
    flowers.forEach((f, i) => {
      m.compose(new THREE.Vector3(f.x, f.y + 0.16 * f.s, f.z), q.identity(), new THREE.Vector3(0.06 * f.s, 0.05 * f.s, 0.06 * f.s))
      flowersRef.current.setMatrixAt(i, m)
      flowersRef.current.setColorAt(i, c.set(f.c))
    })
    flowersRef.current.instanceMatrix.needsUpdate = true
    if (flowersRef.current.instanceColor) flowersRef.current.instanceColor.needsUpdate = true
    grass.forEach((g, i) => {
      m.compose(new THREE.Vector3(g.x, g.y + 0.09 * g.s, g.z), q.setFromEuler(new THREE.Euler(0, g.r, 0)), new THREE.Vector3(0.09 * g.s, 0.2 * g.s, 0.09 * g.s))
      grassRef.current.setMatrixAt(i, m)
    })
    grassRef.current.instanceMatrix.needsUpdate = true
  }, [flowers, grass])
  return (
    <group>
      <instancedMesh ref={flowersRef} args={[undefined, undefined, flowers.length]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={grassRef} args={[undefined, undefined, grass.length]} material={mat('#79bd5b', 0, 0.9)}>
        <coneGeometry args={[1, 1, 4]} />
      </instancedMesh>
    </group>
  )
}

/** Pale stepping stones along the paths, and a lantern beside each one. */
function SkyPaths() {
  const ref = useRef()
  const { stones, lanterns } = useMemo(() => {
    const stones = []
    const lanterns = []
    SKY_PATHS.forEach((path, k) => {
      for (let i = 0; i < path.length - 1; i++) {
        const [ax, az] = path[i]
        const [bx, bz] = path[i + 1]
        const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 0.55))
        for (let j = i === 0 ? 1 : 0; j < n; j++) {
          const t = j / n
          const wob = Math.sin((stones.length + 1) * 2.1) * 0.08
          stones.push({ x: ax + (bx - ax) * t + wob, z: az + (bz - az) * t - wob, s: 0.2 + ((stones.length * 7) % 4) * 0.02 })
        }
      }
      const mid = path[Math.floor(path.length / 2)]
      lanterns.push([mid[0] + 0.55, mid[1] + (k % 2 ? 0.4 : -0.4)])
    })
    return { stones, lanterns }
  }, [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    stones.forEach((s, i) => {
      const x = SKY.x + s.x
      const z = SKY.z + s.z
      m.compose(new THREE.Vector3(x, skyIslandHeight(x, z) + 0.02, z), q.setFromEuler(new THREE.Euler(0, i * 1.3, 0)), new THREE.Vector3(s.s, 0.04, s.s))
      ref.current.setMatrixAt(i, m)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [stones])
  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, stones.length]} material={mat('#efe6d6', 0, 0.9)} onClick={tapWalk}>
        <cylinderGeometry args={[1, 1, 1, 7]} />
      </instancedMesh>
      {lanterns.map((at, i) => (
        <Lantern key={i} at={at} h={1.05} />
      ))}
    </group>
  )
}

const noRaycast = () => null
/** A pastel rainbow over the waterfall. */
function Rainbow() {
  const [wx, wz] = sky(WATERFALL.at[0] * 1.15, WATERFALL.at[1] * 1.15)
  const bands = ['#ff9f9f', '#ffc98a', '#fff1a0', '#b8f0b0', '#a8d8ff', '#c9b6ff']
  return (
    <group position={[wx, SKY.level - 1.5, wz]} rotation={[0, WATERFALL.dir + Math.PI / 2, 0]}>
      {bands.map((c, i) => (
        <mesh key={c} raycast={noRaycast}>
          <torusGeometry args={[3.2 - i * 0.16, 0.08, 6, 40, Math.PI]} />
          <meshBasicMaterial color={c} transparent opacity={0.38} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

/** More blossom trees around the edges (with colliders), only where nothing else is. */
function BlossomTrees() {
  const trees = useMemo(() => {
    const rand = seeded(777)
    const list = []
    const max = count(11, 7)
    for (let i = 0; i < 400 && list.length < max; i++) {
      const a = rand() * Math.PI * 2
      const r = SKY.r * (0.55 + rand() * 0.3)
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      if (!isClear(x, z, 0.7) || list.some((t) => Math.hypot(t.x - x, t.z - z) < 2.2)) continue
      list.push({ x, z, s: 0.85 + rand() * 0.4, pink: rand() < 0.7 })
    }
    return list
  }, [])
  useEffect(() => {
    trees.forEach((t) => addCollider(SKY.x + t.x, SKY.z + t.z, 0.32))
  }, [trees])
  return trees.map((t, i) => {
    const p = skyPoint(t.x, t.z)
    return (
      <group key={i} position={p} scale={t.s}>
        <C p={[0, 0.6, 0]} rt={0.08} rb={0.13} h={1.2} c="#9a6b4a" seg={7} />
        <S p={[0, 1.55, 0]} s={[0.7, 0.6, 0.7]} c={t.pink ? '#ffc2d9' : '#fff0f6'} />
        <S p={[0.35, 1.85, 0.12]} s={[0.4, 0.36, 0.4]} c={t.pink ? '#ffd6e6' : '#ffe3ef'} />
        <S p={[-0.3, 1.4, -0.2]} s={[0.38, 0.34, 0.38]} c={t.pink ? '#f7a8c4' : '#ffd6e6'} />
      </group>
    )
  })
}

/* ───────── what happens as she walks around ───────── */

/**
 * Every frame: which place she's in (the name appears once as she walks in), opening the island
 * on the first visit, the golden-hour sky up here, and Cloud Hop (checkpoints, stars, the goal).
 */
function SkyTracker() {
  const lastArea = useRef(null)
  const hinted = useRef(false)
  const retry = useRef(0)
  useFrame((_, delta) => {
    const s = useStore.getState()
    const { x, z } = player.position
    const onSky = s.phase === 'world' && s.view === 'explore' && (skyDistance(x, z) < 1.05 || HOP_PLATFORMS.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + 2))
    const sk = useSky.getState()
    if (onSky !== sk.onSky) {
      useSky.setState({ onSky })
      atmosphere.place = onSky ? { sunset: 0.75 } : null // golden hour above the clouds
      if (onSky && !hinted.current) {
        hinted.current = true
        s.showToast('✦ Sky Island · Spasi (atau tombol Lompat) untuk melompat di sini.', 4500)
      }
      if (onSky && connected() && !sk.progress?.unlocked_at) visitSky()
    }
    // the name of the place, once as she walks in
    let area = null
    if (onSky) for (const a of AREAS) if (Math.hypot(x - (SKY.x + a.at[0]), z - (SKY.z + a.at[1])) < a.r) area = a
    if ((area?.id || null) !== lastArea.current) {
      lastArea.current = area?.id || null
      useSky.setState({ area: area?.id || null })
      if (area) s.showToast(`✦ ${area.name}`, 2200)
    }
    // Cloud Hop
    const round = sk.round
    if (!round || !onSky) return
    if (!player.air) {
      const cp = checkpointAt(x, z)
      if (cp > 0) {
        // checkpoints in order (the goal only counts after the second one)
        const mine = myCheckpoint(round)
        if (cp === mine + 1 || (cp > mine && cp < GOAL_CP)) reachCheckpoint(cp)
      }
    }
    for (const id of HOP_STAR_IDS) {
      if (round.stars?.includes(id)) continue
      const p = hopStarPos(id)
      if (tmp.set(x, player.position.y + 0.6, z).distanceTo(p) < 0.75) {
        audio.sparkle()
        grabHopStar(id)
      }
    }
    retry.current -= delta
    if (retry.current <= 0) {
      retry.current = 4
      retryFinish()
    }
  })
  return null
}

/** Everything about Sky Island in the 3D world. */
export default function SkyIsland() {
  const view = useStore((s) => s.view)
  const phase = useStore((s) => s.phase)
  const [ready, setReady] = useState(false)
  // the island is built once (after the first frame), so arriving in the world stays smooth
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 600)
    return () => clearTimeout(t)
  }, [])
  if (!ready) return null
  return (
    <group>
      <SkyGround />
      <Dock />
      <CloudGarden />
      <Observatory />
      {OBS_IDS.map((id) => (
        <ObsStar key={id} id={id} />
      ))}
      <CloudHop />
      <Moment />
      <Waterfall />
      <Scenery />
      <CloudSea />
      <Islets />
      <Meadow />
      <SkyPaths />
      <Rainbow />
      <BlossomTrees />
      <SkyTracker />
      <DriftParticles position={[SKY.x, SKY.level + 2, SKY.z]} count={count(18, 8)} area={[18, 5, 18]} size={0.12} speed={0.1} direction={1} texture="petal" seed={88} intensity={0.8} />
      {phase === 'world' && view === 'explore' && (
        <Html position={[SKY.x, SKY.level + 5, SKY.z - 1]} center zIndexRange={[12, 0]} className="place-anchor">
          <span className="place-name">Sky Island</span>
        </Html>
      )}
    </group>
  )
}
