import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { avatars, couple } from '../../content/config'
import { bottleDock, bottleHarbour, RIVER_DIR, riverStart } from '../../lib/layout'
import { coupleAvailable, partner, useCouple } from '../../lib/couple'
import { useInteractable } from '../../lib/interactions'
import { standHeight, WATER_LEVEL } from '../../lib/terrain'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'
import Avatar from './Avatar'
import Tappable from './Interact'
import { Glow } from './Bits'
import EmoteFx from './EmoteFx'
import { partnerEmote, sitStyle } from '../../lib/actions'
import { canAskHand, inviteHand, mateHand, releaseHand, tickHand, useHand } from '../../lib/hand'
import { balloonPose, mateSeat, seatPosition } from '../../lib/balloon'

/*
 * PLAYING TOGETHER, in the world: the other person's character walking around the island
 * (driven by their own broadcasts — see lib/couple.js), the little river dock where letters
 * go into bottles, and the bottles that wash up for you in Reflection Lake.
 */

const damp = THREE.MathUtils.damp
/** Their name, from the role the server gave them (not from anything they typed). */
export const nameFor = (role) => (role === 'owner' ? couple.me.nickname || couple.me.name : couple.you.nickname || couple.you.name)

/** The other person's little character, smoothly following what they send. */
function Partner() {
  const group = useRef()
  const mate = useCouple((s) => s.mate)
  const online = useCouple((s) => s.mateOnline)
  const [avatarId, setAvatarId] = useState(null)
  const motion = useRef({ speed: 0, cheer: 0, sit: false, emote: null })

  useFrame((_, delta) => {
    const g = group.current
    if (!g) return
    const t = partner.target
    const view = useStore.getState().view
    // visible only when both of you are on the island
    const here = partner.online && ['explore', 'picnic'].includes(partner.view) && ['explore', 'picnic'].includes(view)
    g.visible = here
    partner.shown.ok = here
    if (!here) return
    if (g.userData.placed !== true) {
      g.position.set(t.x, t.y, t.z)
      g.userData.placed = true
    }
    const riding = mateSeat()
    if (riding) {
      // in the balloon: exactly in their spot in the basket, flown here the same as ours
      const pose = balloonPose()
      g.position.copy(seatPosition(riding, pose))
      g.rotation.y = pose.yaw
    } else {
      const k = 1 - Math.exp(-delta * 10)
      g.position.x += (t.x - g.position.x) * k
      g.position.z += (t.z - g.position.z) * k
      g.position.y = damp(g.position.y, t.y, 12, delta)
      let dy = t.yaw - g.rotation.y
      dy = Math.atan2(Math.sin(dy), Math.cos(dy))
      g.rotation.y += dy * Math.min(1, delta * 10)
    }
    motion.current.speed = damp(motion.current.speed, t.speed, 8, delta)
    motion.current.sit = partner.seat ? sitStyle(partner.seat.seat) : false
    motion.current.emote = partnerEmote()
    motion.current.hand = mateHand()
    // where they're drawn, for holding hands and for the pet
    partner.shown.x = g.position.x
    partner.shown.y = g.position.y
    partner.shown.z = g.position.z
    partner.shown.yaw = g.rotation.y
    partner.shown.speed = motion.current.speed
    if (partner.avatarId !== avatarId) setAvatarId(partner.avatarId)
  })

  const config = avatars.find((a) => a.id === avatarId) || avatars[1] || avatars[0]
  if (!mate) return null
  return (
    <group ref={group} visible={false}>
      <Avatar config={config} getMotion={() => motion.current} />
      <EmoteFx get={partnerEmote} />
      {online && (
        <Html position={[0, 1.75, 0]} center zIndexRange={[13, 0]} className="mochi-anchor">
          <span className="partner-tag">♡ {nameFor(mate.role)}</span>
        </Html>
      )}
    </group>
  )
}

/** The little dock on the riverbank: write a letter, put it in a bottle, let the river carry it. */
function BottleDock() {
  const status = useCouple((s) => s.status)
  const mate = useCouple((s) => s.mate)
  useInteractable('bottle-dock', {
    position: bottleDock,
    radius: 1.6,
    label: () => (useCouple.getState().status === 'connected' ? 'Kirim surat dalam botol' : 'Dermaga botol surat (main berdua dulu ♡)'),
    onInteract: () => {
      audio.sparkle()
      useStore.getState().setPanel(useCouple.getState().status === 'connected' ? 'letters' : 'couple')
    },
  })
  const ready = status === 'connected' && mate
  return (
    <Tappable id="bottle-dock" position={bottleDock}>
      {/* planks out over the water */}
      <group rotation={[0, Math.atan2(-RIVER_DIR.z, RIVER_DIR.x) + Math.PI / 2, 0]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[0, 0.06, -0.15 - i * 0.22]} castShadow receiveShadow>
            <boxGeometry args={[0.7, 0.05, 0.18]} />
            <meshStandardMaterial color={i % 2 ? '#b98a5e' : '#a87a50'} roughness={0.85} />
          </mesh>
        ))}
        {/* a post with a tiny sign and a bottle waiting on top */}
        <mesh position={[0.3, 0.45, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.05, 0.9, 6]} />
          <meshStandardMaterial color="#8a6248" />
        </mesh>
        <mesh position={[0.3, 0.75, 0.06]}>
          <boxGeometry args={[0.32, 0.18, 0.03]} />
          <meshStandardMaterial color="#f4e7d6" />
        </mesh>
        <group position={[0.3, 0.95, 0]} rotation={[0, 0, 0.3]}>
          <BottleMesh />
        </group>
      </group>
      {ready && <Glow position={[0, 0.9, 0]} color="#bfe6ff" size={1.2} opacity={0.5} />}
    </Tappable>
  )
}

/** A glass bottle with a rolled letter inside. */
function BottleMesh({ glow = false }) {
  return (
    <group scale={0.9}>
      <mesh>
        <cylinderGeometry args={[0.06, 0.07, 0.22, 10]} />
        <meshStandardMaterial color="#cfeee6" transparent opacity={0.75} roughness={0.15} />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.025, 0.04, 0.08, 8]} />
        <meshStandardMaterial color="#cfeee6" transparent opacity={0.75} roughness={0.15} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.027, 0.027, 0.03, 8]} />
        <meshStandardMaterial color="#a8794f" />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.03, 0.03, 0.16, 8]} />
        <meshStandardMaterial color="#fff4e2" emissive={glow ? '#ffe2a8' : '#000000'} emissiveIntensity={glow ? 0.6 : 0} />
      </mesh>
    </group>
  )
}

/** One letter for her, bobbing in the lake until she picks it up. */
function FloatingBottle({ letter, index }) {
  const ref = useRef()
  const position = useMemo(() => bottleHarbour(index), [index])
  const reducedMotion = useStore((s) => s.reducedMotion)
  useInteractable(`bottle:${letter.id}`, {
    position,
    radius: 1.8,
    priority: 0.4,
    label: 'Ambil botol surat',
    onInteract: () => {
      audio.sfx('water')
      useCouple.setState({ reading: letter.id })
      useStore.getState().setPanel('letters')
    },
  })
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + index
    ref.current.position.y = WATER_LEVEL + 0.05 + (reducedMotion ? 0 : Math.sin(t * 1.6) * 0.03)
    ref.current.rotation.z = reducedMotion ? 1.2 : 1.2 + Math.sin(t * 1.2) * 0.12
    ref.current.rotation.y = t * 0.2
  })
  return (
    <Tappable id={`bottle:${letter.id}`}>
      <group ref={ref} position={position}>
        <BottleMesh glow />
        <Glow color="#ffe2a8" size={0.8} opacity={0.6} />
      </group>
    </Tappable>
  )
}

/** After sending: the bottle floats from the dock down the river and over the waterfall. */
function DriftingBottle() {
  const ref = useRef()
  const t0 = useRef(-1)
  const [run, setRun] = useState(0)
  useEffect(() => {
    const go = () => setRun((n) => n + 1)
    window.addEventListener('couple:sent', go)
    return () => window.removeEventListener('couple:sent', go)
  }, [])
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    if (run && t0.current < 0) t0.current = clock.elapsedTime
    const k = t0.current < 0 ? -1 : (clock.elapsedTime - t0.current) / 7
    g.visible = k >= 0 && k < 1
    if (!g.visible) {
      if (k >= 1) t0.current = -1
      return
    }
    const d = k * 5.5
    const x = riverStart.x + RIVER_DIR.x * d
    const z = riverStart.z + RIVER_DIR.z * d
    g.position.set(x, Math.max(WATER_LEVEL, standHeight(x, z)) + 0.08 - Math.max(0, k - 0.85) * 6, z)
    g.rotation.set(0, clock.elapsedTime * 0.6, 1.3)
  })
  return (
    <group ref={ref} visible={false}>
      <BottleMesh glow />
    </group>
  )
}

/**
 * Holding hands: keeps the state in step with the other person every frame (even with a menu open),
 * lets go when she leaves the island for a story moment, and puts "Ajak Gandengan" /
 * "Lepas Gandengan" on the other person's character.
 */
function HandKeeper() {
  const view = useStore((s) => s.view)
  const at = useRef(new THREE.Vector3())
  useEffect(() => {
    if (view !== 'explore') releaseHand('self')
  }, [view])
  // leaving the room (signed out, disconnected): let go, and forget where they were drawn
  useEffect(
    () => () => {
      releaseHand('self')
      partner.shown.ok = false
    },
    [],
  )
  useFrame((_, delta) => tickHand(Math.min(delta, 0.1)))
  useInteractable('hand', {
    get position() {
      return at.current.set(partner.shown.x, partner.shown.y, partner.shown.z)
    },
    radius: 2.2,
    priority: 0.25,
    enabled: () => (useHand.getState().state === 'holding' ? true : useHand.getState().state === 'none' && !useHand.getState().incoming && canAskHand()),
    label: () => (useHand.getState().state === 'holding' ? 'Lepas Gandengan' : 'Ajak Gandengan'),
    onInteract: () => (useHand.getState().state === 'holding' ? releaseHand('self') : inviteHand()),
  })
  return null
}

/** Everything about playing together that lives in the 3D world. */
export default function CoupleWorld() {
  const status = useCouple((s) => s.status)
  const me = useCouple((s) => s.me)
  const letters = useCouple((s) => s.letters)
  const waiting = useMemo(() => letters.filter((l) => me && l.recipient === me.id && !l.opened_at).slice(0, 8), [letters, me])
  if (!coupleAvailable) return null
  return (
    <group>
      <BottleDock />
      {status === 'connected' && (
        <>
          <Partner />
          <HandKeeper />
          {waiting.map((l, i) => (
            <FloatingBottle key={l.id} letter={l} index={i} />
          ))}
          <DriftingBottle />
        </>
      )}
    </group>
  )
}
