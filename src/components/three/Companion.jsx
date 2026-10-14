import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { companion } from '../../content/config'
import { envelopeSpot, loveTree, mochiHome, PICNIC } from '../../lib/layout'
import { player } from '../../lib/player'
import { standHeight, walkable } from '../../lib/terrain'
import { useInteractable } from '../../lib/interactions'
import { chapterIndex, chapterStatus } from '../../lib/story'
import { isoBack, isoRight } from '../../lib/iso'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'
import { Glow, HeartMesh } from './Bits'

/*
 * MOCHI — a small fluffy heart that naps in the meadow until she wakes it, then follows her
 * everywhere, cheers far too hard, carries flowers that are far too big, rolls down hills it
 * didn't mean to roll down, and chases butterflies it will never catch.
 *
 * Everything is procedural and cheap: one heart, two eyes, two feet, a little sprout.
 * Its behaviour is a tiny state machine driven by `mochiCue` events from the store.
 */

const damp = THREE.MathUtils.damp
const tmp = new THREE.Vector3()
const pick = (list) => list[Math.floor(Math.random() * list.length)]

/** Where Mochi is right now (the hint guide and the finale read it). */
export const mochi = { position: mochiHome.clone(), yaw: 0 }

const FUR = new THREE.MeshStandardMaterial({ color: '#ffb8d6', roughness: 0.9, emissive: '#ff8fbf', emissiveIntensity: 0.12 })
const EYE = new THREE.MeshBasicMaterial({ color: '#2a1f3d' })
const SHINE = new THREE.MeshBasicMaterial({ color: '#ffffff' })
const BLUSH = new THREE.MeshBasicMaterial({ color: '#ff7aa8', transparent: true, opacity: 0.6, depthWrite: false })
const FOOT = new THREE.MeshStandardMaterial({ color: '#ff9cc4', roughness: 0.8 })
const LEAF = new THREE.MeshStandardMaterial({ color: '#8fd0a0', roughness: 0.7 })
const PETAL = new THREE.MeshStandardMaterial({ color: '#ffd1e8', emissive: '#ff8fbf', emissiveIntensity: 0.35 })

/** The look. `rig` gets the moving parts so a behaviour can animate them. */
export function MochiBody({ rig, bubble, sleeping = false }) {
  const parts = useRef({})
  useEffect(() => {
    rig.current = parts.current
  })
  const set = (k) => (el) => (parts.current[k] = el)
  return (
    <group ref={set('root')}>
      <group ref={set('body')} position={[0, 0.42, 0]}>
        {/* the fluffy heart (with a soft halo of fluff) */}
        <HeartMesh scale={0.26} color="#ffb8d6" emissive="#ff8fbf" glow={0.35} />
        <mesh position={[0, 0.27, -0.02]} scale={[0.36, 0.08, 0.12]} material={FUR}>
          <sphereGeometry args={[1, 10, 8]} />
        </mesh>
        <Glow position={[0, 0, -0.05]} color="#ffd6ea" size={1.1} opacity={0.35} />
        {/* eyes + shine */}
        {[-1, 1].map((s) => (
          <group key={s} ref={set(s < 0 ? 'eyeL' : 'eyeR')} position={[s * 0.1, 0.05, 0.12]}>
            <mesh scale={[0.045, 0.06, 0.03]} material={EYE}>
              <sphereGeometry args={[1, 10, 8]} />
            </mesh>
            <mesh position={[0.015, 0.02, 0.025]} scale={0.014} material={SHINE}>
              <sphereGeometry args={[1, 6, 4]} />
            </mesh>
          </group>
        ))}
        {/* blushing cheeks */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.17, -0.04, 0.11]} scale={[0.045, 0.025, 0.01]} material={BLUSH}>
            <sphereGeometry args={[1, 8, 6]} />
          </mesh>
        ))}
        {/* a tiny sprout on top */}
        <group position={[0.04, 0.33, 0]} rotation={[0, 0, -0.2]}>
          <mesh position={[0, 0.05, 0]} material={LEAF}>
            <cylinderGeometry args={[0.008, 0.01, 0.1, 5]} />
          </mesh>
          <mesh position={[0.03, 0.1, 0]} rotation={[0, 0, -0.8]} scale={[0.04, 0.018, 0.02]} material={LEAF}>
            <sphereGeometry args={[1, 8, 6]} />
          </mesh>
        </group>
      </group>
      {/* feet */}
      {[-1, 1].map((s) => (
        <mesh key={s} ref={set(s < 0 ? 'footL' : 'footR')} position={[s * 0.1, 0.05, 0.03]} scale={[0.06, 0.04, 0.08]} material={FOOT}>
          <sphereGeometry args={[1, 8, 6]} />
        </mesh>
      ))}
      {/* the flower that is far too big for it (only during the "carry" gag) */}
      <group ref={set('flower')} position={[0, 1.0, 0]} visible={false}>
        <mesh position={[0, -0.25, 0]} material={LEAF}>
          <cylinderGeometry args={[0.025, 0.03, 0.6, 6]} />
        </mesh>
        {Array.from({ length: 6 }, (_, i) => (
          <mesh key={i} position={[Math.cos((i / 6) * Math.PI * 2) * 0.16, 0.08, Math.sin((i / 6) * Math.PI * 2) * 0.16]} scale={[0.14, 0.05, 0.1]} material={PETAL}>
            <sphereGeometry args={[1, 8, 6]} />
          </mesh>
        ))}
        <mesh position={[0, 0.1, 0]} scale={0.08}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color="#ffd36e" emissive="#ffc04d" emissiveIntensity={0.8} />
        </mesh>
      </group>
      {(bubble || sleeping) && (
        <Html position={[0, 1.05, 0]} center zIndexRange={[14, 0]} className="mochi-anchor">
          {sleeping ? <span className="mochi-zzz">z z z</span> : <span className="mochi-bubble">{bubble}</span>}
        </Html>
      )}
    </group>
  )
}

/** Shared per-frame animation of the parts: breathing, blinking, hopping feet. */
function animateParts(p, t, { hop = 0, squash = 0, sleeping = false, wink = false }) {
  if (!p.body) return
  const breathe = 1 + Math.sin(t * 2.2) * 0.03
  p.body.scale.set(breathe * (1 + squash * 0.25), breathe * (1 - squash * 0.3), 1)
  p.body.position.y = 0.42 + hop - squash * 0.08
  const blink = sleeping ? 0.12 : (t % 3.6) < 0.12 ? 0.15 : 1
  p.eyeL.scale.y = wink ? 1 : blink
  p.eyeR.scale.y = blink
  const f = Math.sin(t * 14) * (hop > 0.01 ? 0.04 : 0)
  p.footL.position.y = 0.05 + Math.max(0, f)
  p.footR.position.y = 0.05 + Math.max(0, -f)
}

/**
 * Mochi on the main island: sleeps, wakes, follows, and acts out its little gags.
 * During the picnic it sits on the blanket; in the finale it sits beside her at the Love Tree.
 */
export default function Companion() {
  const group = useRef()
  const rig = useRef(null)
  const butterfly = useRef()
  const view = useStore((s) => s.view)
  const phase = useStore((s) => s.phase)
  const awake = useStore((s) => s.mochiAwake)
  const line = useStore((s) => s.mochiLine)
  const cue = useStore((s) => s.mochiCue)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const st = useRef({ mode: 'follow', t: 0, idle: 0, cooldown: 20, rollDir: new THREE.Vector3(), chase: new THREE.Vector3(), hop: 0 })

  // start where it naps (or right next to her if it's already awake)
  useEffect(() => {
    if (!awake) mochi.position.copy(mochiHome)
    else mochi.position.set(player.position.x + 0.8, player.position.y, player.position.z + 0.6)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // react to cues from the story
  useEffect(() => {
    if (!cue.kind) return
    const s = st.current
    if (cue.kind === 'carry' || cue.kind === 'roll' || cue.kind === 'wake' || cue.kind === 'celebrate' || cue.kind === 'pet' || cue.kind === 'oops') {
      s.mode = cue.kind
      s.t = 0
      if (cue.kind === 'roll') s.rollDir.set(Math.sin(mochi.yaw), 0, Math.cos(mochi.yaw))
      audio.sfx(cue.kind === 'roll' || cue.kind === 'oops' ? 'boing' : 'squeak', cue.n)
    }
    if (cue.kind === 'envelope') {
      s.mode = 'envelope'
      s.t = 0
    }
  }, [cue])

  // it can be woken up, and petted afterwards
  useInteractable('mochi', {
    position: mochi.position,
    radius: 1.5,
    priority: awake ? -0.6 : 0.4,
    label: () => {
      const store = useStore.getState()
      if (!store.mochiAwake) return 'Wake the sleeping fluffy heart'
      return store.mochiStay ? `Ajak ${companion.name} ikut lagi` : `Suruh ${companion.name} tunggu di sini`
    },
    enabled: () => useStore.getState().view === 'explore',
    onInteract: () => {
      const store = useStore.getState()
      if (!store.mochiAwake) return store.wakeMochi()
      // each time she talks to it, it gets a pat, and it either stays or comes along
      const stay = !store.mochiStay
      store.setMochiStay(stay)
      store.cueMochi('pet')
      store.mochiSay(pick(stay ? companion.stay : companion.comeBack), 2800)
    },
  })

  useFrame(({ clock }, rawDelta) => {
    const g = group.current
    const p = rig.current
    if (!g || !p) return
    const delta = Math.min(rawDelta, 0.05)
    const t = clock.elapsedTime
    const s = st.current
    const store = useStore.getState()
    s.t += delta
    let hop = 0
    let squash = 0
    let spin = 0
    let wink = false

    if (!store.mochiAwake) {
      // napping in the meadow (with one eye that is definitely not peeking)
      mochi.position.copy(mochiHome)
      mochi.yaw = 0.4
      squash = 0.35 + Math.sin(t * 1.4) * 0.05
    } else if (store.view === 'picnic') {
      const seat = PICNIC.seatPet
      mochi.position.x = damp(mochi.position.x, seat.x, 4, delta)
      mochi.position.z = damp(mochi.position.z, seat.z, 4, delta)
      mochi.position.y = standHeight(mochi.position.x, mochi.position.z) + 0.02
      mochi.yaw = Math.atan2(isoBack.x, isoBack.z)
      if (store.picnicStage === 'sunset') squash = 0.25
    } else if (store.view === 'cinematic' || store.view === 'ending') {
      // beside her at the foot of the Love Tree
      tmp.copy(player.position).addScaledVector(isoRight, 0.75)
      mochi.position.set(tmp.x, standHeight(tmp.x, tmp.z), tmp.z)
      mochi.yaw = Math.atan2(loveTree.x - tmp.x, loveTree.z - tmp.z)
      squash = 0.22
    } else {
      // ── gags first, then following
      if (s.mode === 'wake') {
        wink = s.t < 1.1
        if (s.t > 1.1) hop = Math.max(0, Math.sin((s.t - 1.1) * 6)) * 0.5
        if (s.t > 1.1 && s.t < 1.6) spin = (s.t - 1.1) * 12.6
        if (s.t > 2.2) s.mode = 'follow'
      } else if (s.mode === 'celebrate' || s.mode === 'pet') {
        const n = s.mode === 'pet' ? 1 : 2
        hop = Math.abs(Math.sin(s.t * 7)) * (s.mode === 'pet' ? 0.18 : 0.38)
        spin = s.mode === 'celebrate' ? s.t * 7 : 0
        if (s.t > (n * Math.PI) / 7 + 0.2) s.mode = 'follow'
      } else if (s.mode === 'carry') {
        // proudly carrying a flower that is far too big… until it isn't
        p.flower.visible = true
        const wobble = Math.sin(t * 6) * (0.15 + s.t * 0.05)
        p.flower.rotation.z = s.t < 4.4 ? wobble : damp(p.flower.rotation.z, 1.6, 6, delta)
        p.flower.position.y = s.t < 4.4 ? 1.0 : damp(p.flower.position.y, 0.15, 6, delta)
        hop = s.t < 4.4 ? Math.abs(Math.sin(t * 9)) * 0.05 : 0
        squash = s.t >= 4.4 && s.t < 5.4 ? 0.5 : 0.1
        if (s.t > 6) {
          p.flower.visible = false
          p.flower.rotation.z = 0
          p.flower.position.y = 1.0
          s.mode = 'follow'
        }
      } else if (s.mode === 'roll') {
        // trips and rolls a little way downhill ("I meant to do that")
        const k = Math.min(1, s.t / 1.6)
        if (k < 1) {
          tmp.copy(mochi.position).addScaledVector(s.rollDir, delta * 2.2)
          if (walkable(tmp.x, tmp.z)) mochi.position.set(tmp.x, standHeight(tmp.x, tmp.z), tmp.z)
          p.root.rotation.x = s.t * 9
        } else {
          p.root.rotation.x = 0
          spin = Math.sin(t * 10) * 0.3 * Math.max(0, 1 - (s.t - 1.6)) // dizzy
        }
        if (s.t > 2.8) s.mode = 'follow'
      } else if (s.mode === 'oops') {
        spin = Math.sin(s.t * 18) * 0.4 * Math.max(0, 1 - s.t)
        if (s.t > 1) s.mode = 'follow'
      } else if (s.mode === 'chase') {
        // chasing a butterfly it will never catch
        const a = s.t * 2.2
        s.chase.set(mochi.position.x + Math.cos(a) * 0.04, 0, mochi.position.z + Math.sin(a) * 0.04)
        tmp.set(s.chase.x + Math.cos(a) * 0.6, 0, s.chase.z + Math.sin(a) * 0.6)
        if (walkable(tmp.x, tmp.z)) mochi.position.set(tmp.x, standHeight(tmp.x, tmp.z), tmp.z)
        mochi.yaw = a + Math.PI / 2
        hop = Math.abs(Math.sin(t * 10)) * 0.12
        if (s.t > 5) {
          s.mode = 'follow'
          s.cooldown = 45
          store.mochiSay(companion.butterfly[1], 3000)
        }
      }

      // the envelope: run to the Love Tree and wait there, waving, until she opens it
      const envelopeWaiting = s.mode === 'envelope' || (chapterStatus(store)[chapterIndex('letter')]?.unlocked && !store.envelopeOpened)
      if (envelopeWaiting && ['follow', 'envelope'].includes(s.mode)) {
        const goal = envelopeSpot
        const dx = goal.x + 0.6 - mochi.position.x
        const dz = goal.z + 0.2 - mochi.position.z
        const d = Math.hypot(dx, dz)
        if (d > 0.2) {
          const step = Math.min(d, delta * 3)
          mochi.position.x += (dx / d) * step
          mochi.position.z += (dz / d) * step
          mochi.position.y = standHeight(mochi.position.x, mochi.position.z)
          mochi.yaw = Math.atan2(dx, dz)
          hop = Math.abs(Math.sin(t * 12)) * 0.12
        } else {
          mochi.yaw = Math.atan2(player.position.x - mochi.position.x, player.position.z - mochi.position.z)
          hop = Math.abs(Math.sin(t * 4)) * 0.15
          if (Math.hypot(player.position.x - mochi.position.x, player.position.z - mochi.position.z) > 5 && s.t > 8) {
            s.t = 0
            store.mochiSay(companion.envelope, 3200)
          }
        }
      } else if (s.mode === 'follow' && (store.mochiStay || player.balloon)) {
        // waiting where she left it: looks around, and turns to watch her
        let dy = Math.atan2(player.position.x - mochi.position.x, player.position.z - mochi.position.z) - mochi.yaw
        dy = Math.atan2(Math.sin(dy), Math.cos(dy))
        mochi.yaw += dy * Math.min(1, delta * 2)
        mochi.position.y = standHeight(mochi.position.x, mochi.position.z)
        squash = 0.12 + Math.sin(t * 1.6) * 0.03
      } else if (s.mode === 'follow') {
        // follow a little behind and to the side, hopping
        const fx = Math.sin(player.yaw)
        const fz = Math.cos(player.yaw)
        tmp.set(player.position.x - fx * 0.9 + fz * 0.55, 0, player.position.z - fz * 0.9 - fx * 0.55)
        const dx = tmp.x - mochi.position.x
        const dz = tmp.z - mochi.position.z
        const d = Math.hypot(dx, dz)
        if (d > 9) {
          // too far behind: a little "poof" and it's back
          mochi.position.set(tmp.x, standHeight(tmp.x, tmp.z), tmp.z)
        } else if (d > 0.25) {
          const step = Math.min(d, delta * Math.min(6, 1.5 + d * 2.2))
          const nx = mochi.position.x + (dx / d) * step
          const nz = mochi.position.z + (dz / d) * step
          if (walkable(nx, nz) || d > 3) mochi.position.set(nx, standHeight(nx, nz), nz)
          mochi.yaw = Math.atan2(dx, dz)
          hop = Math.abs(Math.sin(t * 11)) * 0.13
        } else {
          let dy = Math.atan2(player.position.x - mochi.position.x, player.position.z - mochi.position.z) - mochi.yaw
          dy = Math.atan2(Math.sin(dy), Math.cos(dy))
          mochi.yaw += dy * Math.min(1, delta * 4)
        }
        // left alone for a while → a butterfly appears, and it simply has to chase it
        s.idle = player.speed < 0.05 && store.view === 'explore' && !store.dialog ? s.idle + delta : 0
        s.cooldown -= delta
        if (s.idle > 9 && s.cooldown <= 0 && !reducedMotion) {
          s.mode = 'chase'
          s.t = 0
          s.idle = 0
          store.mochiSay(companion.butterfly[0], 3200)
          audio.sfx('squeak', 2)
        }
      }
    }

    // place it and animate the parts
    g.position.copy(mochi.position)
    g.rotation.y = mochi.yaw + spin
    animateParts(p, t, { hop: reducedMotion ? hop * 0.4 : hop, squash, sleeping: !store.mochiAwake, wink })
    // the butterfly (only while being chased)
    const b = butterfly.current
    b.visible = s.mode === 'chase'
    if (b.visible) {
      const a = s.t * 2.2 + 0.9
      b.position.set(mochi.position.x + Math.cos(a) * 0.9, mochi.position.y + 0.8 + Math.sin(t * 3) * 0.15, mochi.position.z + Math.sin(a) * 0.9)
      b.rotation.y = -a
      const flap = Math.sin(t * 22) * 0.9
      b.children[0].rotation.z = flap
      b.children[1].rotation.z = -flap
    }
  })

  if (phase !== 'world') return null
  const visible = ['explore', 'picnic', 'cinematic', 'ending', 'memories', 'letter', 'capsule', 'timemachine'].includes(view)
  return (
    <group visible={visible}>
      <group ref={group}>
        <MochiBody rig={rig} bubble={view === 'explore' || view === 'picnic' ? line?.text : null} sleeping={!awake && view === 'explore'} />
      </group>
      <group ref={butterfly} visible={false}>
        {[-1, 1].map((sd) => (
          <mesh key={sd} position={[sd * 0.07, 0, 0]} scale={[0.08, 0.005, 0.06]}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshBasicMaterial color={[2.2, 1.6, 2.4]} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** A Mochi standing on her island in Chapter 3, cheering (and occasionally getting it wrong). */
export function BridgeMochi({ position }) {
  const group = useRef()
  const rig = useRef(null)
  const line = useStore((s) => s.mochiLine)
  const cue = useStore((s) => s.mochiCue)
  const view = useStore((s) => s.view)
  const st = useRef({ mode: 'idle', t: 0 })
  const base = useMemo(() => position.clone(), [position])
  useEffect(() => {
    if (cue.kind === 'celebrate' || cue.kind === 'oops') {
      st.current = { mode: cue.kind, t: 0 }
      audio.sfx(cue.kind === 'oops' ? 'boing' : 'squeak', cue.n)
    }
  }, [cue])
  useFrame(({ clock }, delta) => {
    const p = rig.current
    if (!p || !group.current) return
    const s = st.current
    s.t += delta
    const t = clock.elapsedTime
    let hop = Math.abs(Math.sin(t * 3)) * 0.06
    let spin = 0
    if (s.mode === 'celebrate') {
      hop = Math.abs(Math.sin(s.t * 7)) * 0.35
      spin = s.t * 7
      if (s.t > 1.1) s.mode = 'idle'
    } else if (s.mode === 'oops') {
      spin = Math.sin(s.t * 18) * 0.4 * Math.max(0, 1 - s.t)
      if (s.t > 1) s.mode = 'idle'
    }
    group.current.position.copy(base)
    group.current.rotation.y = 0.5 + spin
    animateParts(p, t, { hop })
  })
  return (
    <group ref={group}>
      <MochiBody rig={rig} bubble={view === 'distance' ? line?.text : null} />
    </group>
  )
}
