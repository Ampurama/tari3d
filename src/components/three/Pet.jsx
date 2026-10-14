import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { partner, presence, useCouple } from '../../lib/couple'
import { player } from '../../lib/player'
import { seeded, standHeight, walkable } from '../../lib/terrain'
import { findPath } from '../../lib/path'
import { useInteractable } from '../../lib/interactions'
import { petAct, petHome, usePet } from '../../lib/pet'
import { useHome } from '../../lib/home'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'
import { B, C, mat, PetBed, S } from './HomeFurniture'
import { HeartMesh } from './Bits'

/*
 * THE PET — a small low-poly cat or dog that lives by your house.
 *
 * A tiny state machine, run the same way in both games from the shared state in Supabase:
 *   idle / wandering   at home: every few seconds a new spot near its bed, picked from the clock
 *                      (so both of you see it wander to the same places)
 *   following          trotting after whoever asked it to come along ("Ajak Ikut")
 *   returning_home     back to its bed ("Kembali ke Rumah", or when the one it follows leaves)
 *   interacting        a pat ("Elus": a hop and a heart) or "Duduk", seen by both of you
 * It walks with the island's own rules (walls, furniture, the edge); when it's stuck it asks the
 * island's pathfinding for a way, and if it's truly stuck it simply goes home.
 */

const WANDER_MS = 8000

/* ───────── the models ───────── */

const LOOK = {
  cat: { fur: '#f2b36d', light: '#fff1de', dark: '#d98c48' },
  dog: { fur: '#c99467', light: '#f6e2c8', dark: '#8a5f3e' },
}

function Accessory({ kind }) {
  if (kind === 'ribbon') {
    return (
      <group position={[0.07, 0.47, 0.17]} rotation={[0, 0, -0.4]}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.035, 0, 0]} rotation={[0, 0, (s * Math.PI) / 2]} material={mat('#ff8fbf')}>
            <coneGeometry args={[0.03, 0.06, 8]} />
          </mesh>
        ))}
      </group>
    )
  }
  if (kind === 'bell' || kind === 'scarf') {
    return (
      <group position={[0, 0.27, 0.17]}>
        <mesh rotation={[Math.PI / 2 - 0.3, 0, 0]} material={mat(kind === 'bell' ? '#e2465b' : '#9ec8f0')}>
          <torusGeometry args={[0.085, kind === 'bell' ? 0.014 : 0.03, 6, 16]} />
        </mesh>
        {kind === 'bell' && <S p={[0, -0.07, 0.07]} s={0.028} c="#ffd27f" glow={0.3} />}
      </group>
    )
  }
  return null
}

/** The body, with refs for the legs, tail and head so it can trot, wag and sit. */
function PetModel({ kind, accessory, rig }) {
  const look = LOOK[kind] || LOOK.cat
  const legs = [useRef(), useRef(), useRef(), useRef()]
  const tail = useRef()
  const body = useRef()
  const head = useRef()
  rig.current = { legs, tail, body, head }
  const dog = kind === 'dog'
  return (
    <group ref={body}>
      {/* legs: front left/right, back left/right */}
      {[
        [-0.07, 0.11],
        [0.07, 0.11],
        [-0.07, -0.11],
        [0.07, -0.11],
      ].map(([x, z], i) => (
        <group key={i} ref={legs[i]} position={[x, 0.17, z]}>
          <C p={[0, -0.08, 0]} rt={0.028} h={0.17} c={look.fur} seg={6} />
          <S p={[0, -0.165, 0.01]} s={[0.032, 0.022, 0.04]} c={look.light} />
        </group>
      ))}
      <mesh position={[0, 0.22, 0]} rotation={[Math.PI / 2, 0, 0]} material={mat(look.fur)} scale={dog ? [1.12, 1.1, 1.1] : 1}>
        <capsuleGeometry args={[0.1, 0.2, 4, 10]} />
      </mesh>
      <S p={[0, 0.17, 0.02]} s={[0.075, 0.06, 0.15]} c={look.light} />
      <group ref={tail} position={[0, 0.27, -0.17]}>
        <C p={[0, 0.08, -0.03]} rt={dog ? 0.025 : 0.018} rb={dog ? 0.035 : 0.022} h={dog ? 0.14 : 0.22} c={look.dark} seg={6} r={[-0.5, 0, 0]} />
      </group>
      <group ref={head} position={[0, 0.36, 0.17]}>
        <S p={[0, 0, 0]} s={dog ? [0.12, 0.11, 0.12] : 0.11} c={look.fur} />
        {dog ? (
          <>
            <S p={[0, -0.03, 0.1]} s={[0.06, 0.05, 0.06]} c={look.light} />
            <S p={[0, -0.01, 0.155]} s={0.02} c="#3a2a33" />
            {[-1, 1].map((s) => (
              <B key={s} p={[s * 0.1, -0.02, -0.01]} s={[0.035, 0.12, 0.07]} r={[0, 0, s * 0.25]} c={look.dark} />
            ))}
          </>
        ) : (
          <>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * 0.06, 0.1, -0.01]} rotation={[0, 0, -s * 0.25]} material={mat(look.fur)}>
                <coneGeometry args={[0.04, 0.08, 4]} />
              </mesh>
            ))}
            <S p={[0, -0.025, 0.1]} s={[0.04, 0.03, 0.03]} c={look.light} />
            <S p={[0, -0.01, 0.112]} s={0.012} c="#ff8fa8" />
          </>
        )}
        {[-1, 1].map((s) => (
          <S key={s} p={[s * 0.045, 0.02, 0.095]} s={0.016} c="#2a1f3d" />
        ))}
      </group>
      <Accessory kind={accessory} />
    </group>
  )
}

/* ───────── behaviour ───────── */

/** The newest pat / "Duduk" from either of you, with when it reached this game. */
const acts = new Map()
function currentAct() {
  const now = performance.now()
  let best = null
  for (const a of [presence.pet, partner.online ? partner.pet : null]) {
    if (!a?.id) continue
    if (!acts.has(a.id)) acts.set(a.id, now)
    const age = (now - acts.get(a.id)) / 1000
    const life = a.kind === 'sit' ? 6.5 : 2.6
    if (age < life && (!best || a.at > best.at)) best = { ...a, age }
  }
  if (acts.size > 20) acts.clear()
  return best
}

function PetActor({ pet }) {
  const group = useRef()
  const rig = useRef(null)
  const heart = useRef()
  const nameTag = useRef()
  const st = useRef(null)
  const myId = useCouple((s) => s.me?.id)
  if (!st.current) {
    const h = petHome().at
    st.current = { pos: h.clone(), yaw: 0, speed: 0, mode: 'idle', phase: 0, path: null, repath: 0, stuck: 0 }
  }

  useInteractable('pet', {
    get position() {
      return st.current.pos
    },
    radius: 1.4,
    priority: 0.35,
    enabled: () => useStore.getState().view === 'explore',
    label: () => `Elus ${usePet.getState().pet?.name || ''}`.trim(),
    onInteract: () => {
      audio.sfx('squeak', 1)
      petAct('pet')
    },
  })

  useFrame(({ clock }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const s = st.current
    const g = group.current
    const r = rig.current
    if (!g || !r) return
    const home = petHome()
    const act = currentAct()

    // what's it trying to do?
    let goal = null
    let speed = 0
    if (act) {
      s.mode = 'interacting'
    } else if (pet.mode === 'follow') {
      const mine = pet.follow_target === myId
      const t = mine ? { x: player.position.x, z: player.position.z, yaw: player.yaw } : partner.online && partner.shown.ok && pet.follow_target ? partner.shown : null
      if (t) {
        s.mode = 'following'
        // a little behind and to the left (the right side is for holding hands)
        goal = [t.x - Math.sin(t.yaw) * 0.85 - Math.cos(t.yaw) * 0.45, t.z - Math.cos(t.yaw) * 0.85 + Math.sin(t.yaw) * 0.45]
        const d = Math.hypot(goal[0] - s.pos.x, goal[1] - s.pos.z)
        speed = d < 0.35 ? 0 : Math.min(5.2, 1.2 + d * 1.6)
        if (speed === 0) goal = null
      } else s.mode = 'returning_home'
    } else if (Math.hypot(s.pos.x - home.at.x, s.pos.z - home.at.z) > home.radius + 1) {
      s.mode = 'returning_home'
    } else {
      // at home: the clock picks the next spot, the same in both games
      const bucket = Math.floor(Date.now() / WANDER_MS)
      const into = (Date.now() % WANDER_MS) / 1000
      if (into < 3) s.mode = 'idle'
      else {
        const rand = seeded(bucket * 7919 + 101)
        const a = rand() * Math.PI * 2
        const d = Math.sqrt(rand()) * home.radius
        const wx = home.at.x + Math.cos(a) * d
        const wz = home.at.z + Math.sin(a) * d
        if (walkable(wx, wz) && Math.hypot(wx - s.pos.x, wz - s.pos.z) > 0.15) {
          s.mode = 'wandering'
          goal = [wx, wz]
          speed = 1.1
        } else s.mode = 'idle'
      }
    }
    if (s.mode === 'returning_home') {
      goal = [home.at.x, home.at.z]
      speed = Math.hypot(home.at.x - s.pos.x, home.at.z - s.pos.z) < 0.3 ? 0 : 2.4
      if (!speed) goal = null
    }

    // walk there (island rules; a path when blocked; home if hopelessly stuck)
    s.speed = THREE.MathUtils.damp(s.speed, goal ? speed : 0, 6, delta)
    if (goal && s.speed > 0.02) {
      let [tx, tz] = goal
      while (s.path?.length && Math.hypot(s.path[0][0] - s.pos.x, s.path[0][1] - s.pos.z) < 0.3) s.path.shift()
      if (s.path?.length) [tx, tz] = s.path[0]
      const dx = tx - s.pos.x
      const dz = tz - s.pos.z
      const d = Math.hypot(dx, dz) || 1
      const stepLen = Math.min(d, s.speed * delta)
      const fromOk = walkable(s.pos.x, s.pos.z)
      const ok = (x, z) => walkable(x, z) || !fromOk // never trapped inside something
      const nx = s.pos.x + (dx / d) * stepLen
      const nz = s.pos.z + (dz / d) * stepLen
      if (ok(nx, nz)) s.pos.set(nx, 0, nz)
      else if (ok(nx, s.pos.z)) s.pos.x = nx
      else if (ok(s.pos.x, nz)) s.pos.z = nz
      else s.stuck += delta
      if (ok(nx, nz)) s.stuck = Math.max(0, s.stuck - delta)
      s.repath -= delta
      if (s.stuck > 0.6 && s.repath <= 0) {
        s.path = findPath(s.pos.x, s.pos.z, goal[0], goal[1])
        s.repath = 1.5
      }
      if (s.stuck > 6) {
        // truly stuck: it finds its own way home
        s.pos.copy(home.at)
        s.stuck = 0
        s.path = null
      }
      let dy = Math.atan2(dx, dz) - s.yaw
      dy = Math.atan2(Math.sin(dy), Math.cos(dy))
      s.yaw += dy * Math.min(1, delta * 8)
    } else {
      s.path = null
      s.stuck = 0
    }
    // when someone is close (or it's being petted), it looks at them
    const near = Math.hypot(player.position.x - s.pos.x, player.position.z - s.pos.z)
    if ((act || (!goal && near < 2.5)) && near > 0.05) {
      let dy = Math.atan2(player.position.x - s.pos.x, player.position.z - s.pos.z) - s.yaw
      dy = Math.atan2(Math.sin(dy), Math.cos(dy))
      s.yaw += dy * Math.min(1, delta * 4)
    }
    s.pos.y = standHeight(s.pos.x, s.pos.z)
    const isNear = near < 2.4 && useStore.getState().view === 'explore'
    if (isNear !== usePet.getState().near) usePet.setState({ near: isNear })

    // pose: trot, wag, sit, hop
    const t = clock.elapsedTime
    s.phase += delta * (4 + s.speed * 5)
    const swing = Math.min(1, s.speed / 1.5) * 0.7
    const sitting = act?.kind === 'sit' || (s.mode === 'idle' && pet.mode === 'home' && Math.floor(Date.now() / WANDER_MS) % 3 === 0)
    r.legs.forEach((l, i) => {
      const front = i < 2
      l.current.rotation.x = sitting ? (front ? 0 : -1.3) : Math.sin(s.phase + (i === 0 || i === 3 ? 0 : Math.PI)) * swing
    })
    r.body.current.rotation.x = sitting ? -0.35 : 0
    r.body.current.position.y = sitting ? -0.04 : act?.kind === 'pet' ? Math.abs(Math.sin(act.age * 9)) * 0.12 : Math.abs(Math.cos(s.phase)) * 0.02 * swing
    r.tail.current.rotation.y = Math.sin(t * (act || s.mode === 'following' ? 14 : 4)) * (pet.kind === 'dog' ? 0.6 : 0.3)
    r.head.current.rotation.z = act?.kind === 'pet' ? Math.sin(act.age * 6) * 0.2 : 0
    g.position.copy(s.pos)
    g.rotation.y = s.yaw
    // a heart floats up when it's petted
    const h = heart.current
    h.visible = act?.kind === 'pet'
    if (h.visible) {
      h.position.y = 0.6 + act.age * 0.3
      h.scale.setScalar(0.09 * Math.sin(Math.PI * Math.min(1, act.age / 2.6)) + 0.001)
    }
    if (nameTag.current) nameTag.current.style.opacity = near < 6 ? '1' : '0'
  })

  return (
    <group ref={group}>
      <PetModel kind={pet.kind} accessory={pet.accessory} rig={rig} />
      <HeartMesh ref={heart} position={[0, 0.6, 0]} scale={0.01} color="#ff9cc8" emissive="#ff5fa2" glow={1.3} />
      <Html position={[0, 0.75, 0]} center zIndexRange={[12, 0]} className="mochi-anchor">
        <span ref={nameTag} className="pet-tag">
          {pet.name}
        </span>
      </Html>
    </group>
  )
}

/** Its cushion in the garden, until a pet bed is placed in the house. */
function GardenCushion() {
  const hasBed = useHome((s) => Object.values(s.items).some((it) => it.kind === 'pet_bed'))
  const at = useMemo(() => petHome().at, [hasBed]) // eslint-disable-line react-hooks/exhaustive-deps
  if (hasBed) return null
  return (
    <group position={at}>
      <PetBed />
    </group>
  )
}

/** The shared pet, once you've adopted one (and only while you're in "Main berdua"). */
export default function Pet() {
  const status = usePet((s) => s.status)
  const pet = usePet((s) => s.pet)
  if (status !== 'ready' || !pet) return null
  return (
    <group>
      <GardenCushion />
      <PetActor key={pet.kind} pet={pet} />
    </group>
  )
}
