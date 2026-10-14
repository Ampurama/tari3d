import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { connections, couple } from '../../content/config'
import { areas, connectionSpots, ISLAND_LIFT, ISLAND_SPREAD } from '../../lib/layout'
import { count } from '../../lib/device'
import { currentAvatar, useChapterUnlocked, useStore } from '../../store'
import { audio } from '../../audio/engine'
import { Flowers, IslandBody } from './Island'
import { Glow, HeartMesh } from './Bits'
import { DriftParticles, Fireflies } from './Particles'
import HiddenHearts from './HiddenHearts'
import Avatar from './Avatar'

/*
 * CHAPTER 2 — MILES BETWEEN US.
 * Two islands a whole sky apart. Five connections — trust, communication, patience,
 * understanding, effort — each restore one part of the bridge between them.
 * Every one changes the world: more stars, lanterns on, brighter islands, warmer music.
 */

const damp = THREE.MathUtils.damp
const L = ISLAND_LIFT
const S = ISLAND_SPREAD
const BRIDGE_START = -S + 2.0
const BRIDGE_END = S - 2.0
export const bridgeY = (x) => L + 0.55 + 0.55 * Math.sin(((x - BRIDGE_START) / (BRIDGE_END - BRIDGE_START)) * Math.PI)
const say = (t, ms) => useStore.getState().showToast(t, ms)
const idx = (id) => connections.findIndex((c) => c.id === id)

function useConnection(id) {
  const done = useStore((s) => s.connectionsDone.includes(id))
  const unlocked = useChapterUnlocked(1)
  const view = useStore((s) => s.view)
  const live = unlocked && !done && view === 'distance'
  const complete = () => {
    if (useStore.getState().completeConnection(id)) audio.sfx('complete')
  }
  return { done, live, complete }
}

/** Tap handling for 3D objects (cursor + drag protection). */
function usePress(onTap, live = true) {
  const [hover, setHover] = useState(false)
  useCursor(hover && live)
  return {
    hover,
    handlers: {
      onClick: (e) => {
        if (!live) return
        e.stopPropagation()
        if (e.delta > 8) return
        onTap?.(e)
      },
      onPointerOver: (e) => {
        if (!live) return
        e.stopPropagation()
        setHover(true)
      },
      onPointerOut: () => setHover(false),
    },
  }
}

const HitSphere = ({ r = 0.55, ...p }) => (
  <mesh {...p}>
    <sphereGeometry args={[r, 10, 8]} />
    <meshBasicMaterial colorWrite={false} depthWrite={false} />
  </mesh>
)

/* ───────── the islands ───────── */

function Island({ side }) {
  const key = side < 0 ? 'me' : 'you'
  const who = couple[key]
  const orb = useRef()
  const light = useRef()
  const view = useStore((s) => s.view)
  const doneCount = useStore((s) => s.connectionsDone.length)
  const communicated = useStore((s) => s.connectionsDone.includes('communication'))
  const read = useStore((s) => s.threadRead.includes(key))
  const reducedMotion = useStore((s) => s.reducedMotion)
  const openMessage = () => {
    if (!communicated) return say('Restore Communication first — then each island has a message for you ♡', 3600)
    audio.sparkle()
    useStore.getState().openThreadMessage(key)
  }
  const { handlers } = usePress(openMessage, view === 'distance')
  useFrame(({ clock }, delta) => {
    orb.current.position.y = 1 + (reducedMotion ? 0 : Math.sin(clock.elapsedTime * 1.2 + side) * 0.08)
    // the islands get brighter with every connection restored
    light.current.intensity = damp(light.current.intensity, 3 + doneCount * 2.2, 2, delta)
  })
  const color = side < 0 ? '#ffb3d1' : '#cdb3ff'
  return (
    <group position={[side * S, L, 0]}>
      <IslandBody radius={2.6} seed={side < 0 ? 3 : 8} />
      <Flowers radius={2.6} amount={count(80, 40)} seed={side < 0 ? 4 : 9} avoid={[[0, 0, 0.7], [side * 0.9, -0.9, 0.6], [side * -1.2, 0.9, 0.6], [side * -1.4, -0.9, 0.6]]} />
      <group ref={orb} position={[side * 0.9, 1, -0.9]} {...handlers}>
        <mesh>
          <sphereGeometry args={[0.24, 28, 20]} />
          <meshBasicMaterial color={new THREE.Color(color).multiplyScalar(2.2)} toneMapped={false} />
        </mesh>
        <Glow color={color} size={2.2} opacity={0.65} />
        <pointLight ref={light} color={color} intensity={3} distance={6} />
        <HitSphere r={0.85} />
      </group>
      {view === 'distance' && (
        <Html center position={[side * 0.9, 2.25, -0.9]} zIndexRange={[20, 0]}>
          <button
            type="button"
            className={`person-tag ${side < 0 ? 'is-me' : 'is-you'}`}
            onClick={(e) => {
              e.stopPropagation()
              openMessage()
            }}
          >
            <span className="person-icon" aria-hidden="true">
              {who.icon}
            </span>
            <strong>{who.name}</strong>
            <small>{who.place}</small>
            {communicated && <em className="person-hint">{read ? 'message read ♡' : 'a message for you'}</em>}
          </button>
        </Html>
      )}
    </group>
  )
}

/* ───────── the bridge ───────── */

function Bridge() {
  const sections = useRef([])
  const lanterns = useRef([])
  const done = useStore((s) => s.connectionsDone)
  const n = connections.length
  const width = (BRIDGE_END - BRIDGE_START) / n
  useFrame((_, delta) => {
    sections.current.forEach((g, i) => {
      if (!g) return
      const on = done.includes(connections[i].id)
      const s = damp(g.scale.y, on ? 1 : 0.0001, 2.4, delta)
      g.scale.set(1, s, 1)
      g.visible = s > 0.01
    })
    lanterns.current.forEach((l, i) => {
      if (!l) return
      const on = done.length > 0 && i <= done.length
      l.material.color.setScalar(damp(l.material.color.r, on ? 2.6 : 0.3, 2, delta))
    })
  })
  const rails = useMemo(
    () =>
      connections.map((_, i) => {
        const x0 = BRIDGE_START + i * width
        return [-0.45, 0.45].map((z) => new THREE.CatmullRomCurve3(Array.from({ length: 8 }, (__, k) => new THREE.Vector3(x0 + (k / 7) * width, bridgeY(x0 + (k / 7) * width) + 0.45, z))))
      }),
    [width],
  )
  return (
    <group>
      {connections.map((c, i) => {
        const x0 = BRIDGE_START + i * width
        return (
          <group key={c.id} ref={(el) => (sections.current[i] = el)} scale={[1, 0.0001, 1]}>
            {Array.from({ length: 6 }, (_, k) => {
              const x = x0 + (k + 0.5) * (width / 6)
              const tilt = Math.atan2(bridgeY(x + 0.05) - bridgeY(x - 0.05), 0.1)
              return (
                <mesh key={k} position={[x, bridgeY(x), 0]} rotation={[0, 0, tilt]} castShadow>
                  <boxGeometry args={[width / 6 - 0.04, 0.06, 0.9]} />
                  <meshStandardMaterial color="#f3e6ef" emissive="#ffb3d6" emissiveIntensity={0.35} roughness={0.5} />
                </mesh>
              )
            })}
            {rails[i].map((curve, k) => (
              <mesh key={k}>
                <tubeGeometry args={[curve, 16, 0.02, 6, false]} />
                <meshBasicMaterial color={[2.2, 1.1, 1.6]} toneMapped={false} />
              </mesh>
            ))}
          </group>
        )
      })}
      {/* lantern posts along the bridge line — they wake up one by one */}
      {Array.from({ length: n + 1 }, (_, i) => {
        const x = BRIDGE_START + i * width
        return (
          <group key={i} position={[x, bridgeY(x), -0.55]}>
            <mesh position={[0, 0.35, 0]}>
              <cylinderGeometry args={[0.025, 0.03, 0.7, 6]} />
              <meshStandardMaterial color="#cdb4d6" />
            </mesh>
            <mesh ref={(el) => (lanterns.current[i] = el)} position={[0, 0.75, 0]}>
              <sphereGeometry args={[0.07, 10, 8]} />
              <meshBasicMaterial color={[0.3, 0.3, 0.3]} toneMapped={false} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

/* ───────── 1 · Trust: hold the lantern until its light stays ───────── */

function Trust() {
  const { done, live, complete } = useConnection('trust')
  const held = useRef(false)
  const progress = useRef(0)
  const flame = useRef()
  const halo = useRef()
  const [hover, setHover] = useState(false)
  useCursor(hover && live)
  useFrame((_, delta) => {
    if (live) {
      progress.current = held.current ? Math.min(1, progress.current + delta / 1.6) : Math.max(0, progress.current - delta * 0.8)
      if (progress.current >= 1) {
        held.current = false
        complete()
      }
    }
    const p = done ? 1 : progress.current
    flame.current.scale.setScalar(0.4 + p * 0.8)
    flame.current.material.color.setRGB(1 + p * 2, 0.7 + p * 1.5, 0.4 + p * 0.6)
    halo.current.material.opacity = damp(halo.current.material.opacity, done ? 0.85 : 0.15 + p * 0.6, 4, delta)
    halo.current.scale.setScalar(0.8 + p * 1.6)
  })
  const release = () => (held.current = false)
  // a finger may slide off the lantern: always release on the window too (and if the touch is cancelled)
  useEffect(() => {
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    window.addEventListener('blur', release)
    return () => {
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
      window.removeEventListener('blur', release)
    }
  }, [])
  return (
    <group
      position={connectionSpots[idx('trust')]}
      onPointerDown={(e) => {
        if (!live) return
        e.stopPropagation()
        held.current = true
      }}
      onPointerOver={(e) => {
        if (!live) return
        e.stopPropagation()
        setHover(true)
      }}
      onPointerOut={() => setHover(false)}
    >
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.03, 0.04, 0.8, 8]} />
        <meshStandardMaterial color="#cdb4d6" />
      </mesh>
      <mesh position={[0, 0.88, 0]}>
        <cylinderGeometry args={[0.12, 0.14, 0.24, 12, 1, true]} />
        <meshStandardMaterial color="#ffe2a8" emissive="#ffc46b" emissiveIntensity={0.4} transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={flame} position={[0, 0.88, 0]} scale={0.4}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshBasicMaterial color={[1, 0.7, 0.4]} toneMapped={false} />
      </mesh>
      <Glow ref={halo} position={[0, 0.9, 0]} color="#ffe2a8" size={1} opacity={0.15} />
      <HitSphere r={0.9} position={[0, 0.7, 0]} />
    </group>
  )
}

/* ───────── 2 · Communication: send a light, answer it from the other side ───────── */

function Shell({ position, glowing, onTap, live, color }) {
  const halo = useRef()
  const { handlers } = usePress(onTap, live)
  useFrame(({ clock }, delta) => {
    const pulse = glowing ? 0.75 + 0.25 * Math.sin(clock.elapsedTime * 5) : 0.2
    halo.current.material.opacity = damp(halo.current.material.opacity, pulse, 6, delta)
  })
  return (
    <group position={position} {...handlers}>
      <mesh position={[0, 0.16, 0]} rotation={[0.3, 0, 0]} scale={[1, 0.7, 1]}>
        <sphereGeometry args={[0.2, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#fff0f6" emissive={color} emissiveIntensity={0.3} side={THREE.DoubleSide} />
      </mesh>
      <Glow ref={halo} position={[0, 0.25, 0]} color={color} size={1.1} opacity={0.2} />
      <HitSphere r={0.8} position={[0, 0.25, 0]} />
    </group>
  )
}

function Communication() {
  const { done, live, complete } = useConnection('communication')
  const [stage, setStage] = useState('idle') // idle → toYou → waiting → toMe
  const pulse = useRef()
  const t0 = useRef(null)
  const a = connectionSpots[idx('communication')]
  const b = useMemo(() => new THREE.Vector3(-a.x, a.y, a.z), [a])
  const curve = useMemo(
    () => new THREE.QuadraticBezierCurve3(a.clone().add(new THREE.Vector3(0, 0.3, 0)), new THREE.Vector3(0, L + 4.5, -1.2), b.clone().add(new THREE.Vector3(0, 0.3, 0))),
    [a, b],
  )
  const reducedMotion = useStore((s) => s.reducedMotion)
  useFrame(({ clock }) => {
    const travelling = stage === 'toYou' || stage === 'toMe'
    pulse.current.visible = travelling
    if (!travelling) return
    if (t0.current === null) t0.current = clock.elapsedTime
    const t = Math.min(1, (clock.elapsedTime - t0.current) / (reducedMotion ? 0.6 : 2.4))
    curve.getPoint(stage === 'toYou' ? t : 1 - t, pulse.current.position)
    if (t >= 1) {
      t0.current = null
      if (stage === 'toYou') setStage('waiting')
      else {
        setStage('idle')
        complete()
      }
    }
  })
  const begin = (next) => {
    t0.current = null
    setStage(next)
    audio.sfx('light')
  }
  return (
    <group>
      <Shell position={a} live={live && stage === 'idle'} glowing={live && stage === 'idle'} color="#ffb3d1" onTap={() => begin('toYou')} />
      <Shell position={b} live={live && stage === 'waiting'} glowing={done || (live && stage === 'waiting')} color="#cdb3ff" onTap={() => begin('toMe')} />
      <group ref={pulse} visible={false}>
        <mesh>
          <sphereGeometry args={[0.1, 12, 10]} />
          <meshBasicMaterial color={[2.8, 1.6, 2.2]} toneMapped={false} />
        </mesh>
        <Glow color="#ffc4dc" size={1.2} opacity={0.9} />
      </group>
    </group>
  )
}

/* ───────── 3 · Patience: wait for the drifting light to reach the gap ───────── */

/** How close to the middle counts as "in the gap" (generous: about 1.7 s per pass). */
const GAP = 1.3

function Patience() {
  const { done, live, complete } = useConnection('patience')
  const orb = useRef()
  const gap = useRef()
  const x = useRef(-5)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const spot = connectionSpots[idx('patience')]
  useFrame(({ clock }, delta) => {
    // a slow, steady drift back and forth (about eleven seconds each way)
    x.current = done ? 0 : Math.sin(clock.elapsedTime * (reducedMotion ? 0.22 : 0.28)) * 5.4
    orb.current.position.set(x.current, spot.y + 0.4, spot.z)
    const inGap = Math.abs(x.current) < GAP
    gap.current.material.opacity = damp(gap.current.material.opacity, done ? 0.9 : live ? (inGap ? 0.95 : 0.35) : 0.1, 6, delta)
    gap.current.rotation.z += delta * 0.4
  })
  const tap = () => {
    if (Math.abs(x.current) < GAP) complete()
    else say('Patience… wait until the light reaches the glowing gap ✦', 2600)
  }
  const { handlers } = usePress(tap, live)
  return (
    <group>
      <group position={[spot.x, spot.y + 0.4, spot.z]} {...handlers}>
        <mesh ref={gap}>
          <torusGeometry args={[GAP * 0.6, 0.035, 8, 40]} />
          <meshBasicMaterial color={[2.4, 1.9, 1.1]} transparent opacity={0.3} toneMapped={false} depthWrite={false} />
        </mesh>
        <HitSphere r={1.2} />
      </group>
      <group ref={orb} {...handlers}>
        <HitSphere r={0.6} />
        <mesh>
          <sphereGeometry args={[0.12, 14, 10]} />
          <meshBasicMaterial color={[2.6, 2.3, 1.4]} toneMapped={false} />
        </mesh>
        <Glow color="#ffe2a8" size={1.3} opacity={0.85} />
      </group>
    </group>
  )
}

/* ───────── 4 · Understanding: watch the stars, then light them in the same order ───────── */

const ORDER = [2, 0, 3, 1]

function UnderstandingStar({ position, on, live, onTap }) {
  const halo = useRef()
  const { hover, handlers } = usePress(onTap, live)
  useFrame((_, delta) => {
    halo.current.material.opacity = damp(halo.current.material.opacity, on ? 0.95 : live ? 0.3 : 0.12, 8, delta)
    halo.current.scale.setScalar(damp(halo.current.scale.x, on ? 1.6 : hover ? 1.2 : 0.9, 8, delta))
  })
  return (
    <group position={position} {...handlers}>
      <mesh scale={0.08}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={[2.6, 2.4, 2.8]} toneMapped={false} />
      </mesh>
      <Glow ref={halo} color="#d9ccff" size={1} opacity={0.3} />
      <HitSphere r={0.58} />
    </group>
  )
}

function Understanding() {
  const { done, live, complete } = useConnection('understanding')
  const [phase, setPhase] = useState('idle') // idle | showing | input
  const [lit, setLit] = useState(-1)
  const [entered, setEntered] = useState([])
  const timers = useRef([])
  const center = connectionSpots[idx('understanding')]
  const stars = useMemo(() => [-1.8, -0.6, 0.6, 1.8].map((x, i) => new THREE.Vector3(center.x + x, center.y + (i % 2 ? 0.45 : -0.15), center.z)), [center])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const show = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setEntered([])
    setPhase('showing')
    ORDER.forEach((s, k) => {
      timers.current.push(
        setTimeout(() => {
          setLit(s)
          audio.sfx('note', s)
        }, 650 + k * 850),
      )
      timers.current.push(setTimeout(() => setLit(-1), 650 + k * 850 + 550))
    })
    timers.current.push(setTimeout(() => setPhase('input'), 650 + ORDER.length * 850))
  }
  const tapStar = (i) => {
    if (phase === 'idle') return show()
    if (phase !== 'input') return
    audio.sfx('note', i)
    const next = [...entered, i]
    if (ORDER[next.length - 1] !== i) {
      say('Almost — watch once more ♡', 2200)
      setEntered([])
      timers.current.push(setTimeout(show, 900))
      return
    }
    setEntered(next)
    if (next.length === ORDER.length) {
      setPhase('idle')
      complete()
    }
  }
  return (
    <group>
      {stars.map((p, i) => (
        <UnderstandingStar key={i} position={p} on={done || lit === i || entered.includes(i)} live={live} onTap={() => tapStar(i)} />
      ))}
      {done &&
        stars.slice(0, -1).map((p, i) => (
          <mesh key={i} position={p.clone().lerp(stars[i + 1], 0.5)} rotation={[0, 0, Math.atan2(stars[i + 1].y - p.y, stars[i + 1].x - p.x)]}>
            <boxGeometry args={[p.distanceTo(stars[i + 1]), 0.015, 0.015]} />
            <meshBasicMaterial color={[2.2, 1.6, 2.2]} toneMapped={false} />
          </mesh>
        ))}
    </group>
  )
}

/* ───────── 5 · Effort: turn the wheel until the bridge is whole ───────── */

function Effort() {
  const { done, live, complete } = useConnection('effort')
  const wheel = useRef()
  const fill = useRef()
  const turns = useRef(0)
  const spin = useRef(0)
  const NEED = 10
  const { handlers } = usePress(() => {
    spin.current += Math.PI / 5
    turns.current += 1
    audio.sfx('tick')
    if (turns.current >= NEED) complete()
  }, live)
  useFrame((_, delta) => {
    wheel.current.rotation.z = damp(wheel.current.rotation.z, -spin.current, 8, delta)
    const p = done ? 1 : turns.current / NEED
    fill.current.scale.x = damp(fill.current.scale.x, Math.max(0.0001, p), 6, delta)
  })
  return (
    <group position={connectionSpots[idx('effort')]} rotation={[0, 0.5, 0]} {...handlers}>
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[0.12, 0.7, 0.12]} />
        <meshStandardMaterial color="#cdb4d6" />
      </mesh>
      <group ref={wheel} position={[0, 0.78, 0.08]}>
        <mesh>
          <torusGeometry args={[0.32, 0.035, 8, 32]} />
          <meshStandardMaterial color="#e9c27a" metalness={0.8} roughness={0.3} />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} rotation={[0, 0, (i * Math.PI) / 4]}>
            <boxGeometry args={[0.62, 0.025, 0.025]} />
            <meshStandardMaterial color="#e9c27a" metalness={0.8} roughness={0.3} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 0.25, 0.1]}>
        <boxGeometry args={[0.6, 0.06, 0.02]} />
        <meshBasicMaterial color="#3b2e6e" />
      </mesh>
      <group position={[-0.3, 0.25, 0.115]}>
        <mesh ref={fill} position={[0.3, 0, 0]} scale={[0.0001, 1, 1]}>
          <boxGeometry args={[0.6, 0.05, 0.02]} />
          <meshBasicMaterial color={[2.4, 1.4, 1.8]} toneMapped={false} />
        </mesh>
      </group>
      <HitSphere r={0.9} position={[0, 0.6, 0]} />
    </group>
  )
}

/* ───────── the crossing: once the bridge is whole, the avatar walks across ───────── */

function Traveller() {
  const group = useRef()
  const avatar = useStore(currentAvatar)
  const complete = useStore((s) => s.connectionsDone.length >= connections.length)
  const x = useRef(complete ? S - 1.2 : -S + 1.3)
  const speed = useRef(0)
  useFrame((_, delta) => {
    const goal = complete ? S - 1.2 : -S + 1.3
    const dx = goal - x.current
    const v = Math.abs(dx) > 0.05 ? Math.sign(dx) * 1.3 : 0
    speed.current = damp(speed.current, Math.abs(v), 4, delta)
    x.current = Math.abs(dx) <= Math.abs(v * delta) ? goal : x.current + v * delta
    const onBridge = x.current > BRIDGE_START && x.current < BRIDGE_END
    group.current.position.set(x.current, onBridge ? bridgeY(x.current) + 0.04 : L + 0.25, 0)
    group.current.rotation.y = v > 0 ? Math.PI / 2 : v < 0 ? -Math.PI / 2 : 0.4
  })
  return (
    <group ref={group}>
      <Avatar config={avatar} getMotion={() => ({ speed: speed.current, cheer: 0 })} castShadow={false} />
    </group>
  )
}

export default function DistanceWorld() {
  const doneCount = useStore((s) => s.connectionsDone.length)
  const view = useStore((s) => s.view)
  const active = view === 'distance' || view === 'cinematic'
  // far away from the main island: not drawn (and its lights not counted) unless she's there
  return (
    <group position={areas.distance} visible={active}>
      <Island side={-1} />
      <Island side={1} />
      <Bridge />
      {active && (
        <>
          <Trust />
          <Communication />
          <Patience />
          <Understanding />
          <Effort />
          <Traveller />
        </>
      )}
      <HiddenHearts group="distance" />
      {/* the sea of stars between us — more of it with every connection */}
      <DriftParticles
        key={doneCount}
        position={[0, -1.6, 0]}
        count={count(140 + doneCount * 50, 70 + doneCount * 25)}
        area={[32, 1.6, 12]}
        shape="box"
        texture="glow"
        colors={['#ffffff', '#ffd6ea', '#d8c8ff', '#ffe8b8']}
        size={0.16}
        speed={0.05}
        intensity={1 + doneCount * 0.15}
        seed={61}
      />
      <Fireflies count={count(30 + doneCount * 6, 16 + doneCount * 3)} area={[28, 5, 8]} center={[0, -1, 0]} size={0.12} seed={17} colors={['#ffe0f0', '#e4d6ff']} />
      {doneCount >= connections.length && <HeartMesh position={[0, L + 3.6, -1]} scale={0.35} color="#ffb3d6" emissive="#ff6fae" glow={1.4} />}
    </group>
  )
}
