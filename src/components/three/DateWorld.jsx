import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { iAmReady, diningTable, distanceTo, meetingPoint, PLACES, READY_RADIUS, setReady, useDate } from '../../lib/date'
import { freeSibling, seats, sitAt, standUp, useSeat } from '../../lib/actions'
import { useHome } from '../../lib/home'
import { partner, presence, useCouple } from '../../lib/couple'
import { player } from '../../lib/player'
import { standHeight } from '../../lib/terrain'
import { CAMP, HOUSE, toWorld } from '../../lib/homeLayout'
import { useInteractable } from '../../lib/interactions'
import { useStore } from '../../store'
import { dates } from '../../content/config'
import { B, C, mat, PicnicBasket, S } from './HomeFurniture'
import { Glow, HeartMesh } from './Bits'
import { Fireflies } from './Particles'

/*
 * VIRTUAL DATE, in the world: a soft beacon over the meeting place, the things each date needs
 * (a picnic blanket on the cove beach, a tent and a campfire beside the house, a dinner set on
 * the table), and the little touches while you're together. Also keeps two people from sitting
 * on the same seat, and lets a few hearts float up when you sit side by side.
 */

const LIVE = ['accepted', 'preparing', 'active']
const useLive = (kind) => useDate((s) => s.session && s.session.kind === kind && LIVE.includes(s.session.status))

/** A seat that only exists during a date (world space). */
function DateSeat({ id, x, z, y, yaw, out, group, label }) {
  useSeat(id, { x, z, y, yaw, exit: [x + Math.sin(yaw) * out, z + Math.cos(yaw) * out], group, label })
  return null
}

/* ───────── the meeting place ───────── */

function Beacon() {
  const session = useDate((s) => s.session)
  const ring = useRef()
  const kind = session?.kind
  const show = session && ['accepted', 'preparing'].includes(session.status)
  const at = show ? meetingPoint(kind) : null
  useFrame(({ clock }) => {
    if (ring.current) ring.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 2.4) * 0.06)
  })
  // "Siap" right there, as an interaction, once she's close enough
  useInteractable('date-ready', {
    get position() {
      return meetingPoint(useDate.getState().session?.kind) || player.position
    },
    radius: READY_RADIUS,
    priority: -0.5,
    enabled: () => {
      const s = useDate.getState().session
      return Boolean(s && ['accepted', 'preparing'].includes(s.status) && !iAmReady(s) && distanceTo(s.kind) <= READY_RADIUS)
    },
    label: 'Siap (Mulai Aktivitas)',
    onInteract: () => setReady(true),
  })
  if (!at) return null
  const y = standHeight(at.x, at.z)
  return (
    <group position={[at.x, y, at.z]}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} renderOrder={3}>
        <ringGeometry args={[READY_RADIUS - 0.18, READY_RADIUS, 48]} />
        <meshBasicMaterial color={[2.2, 1.4, 1.9]} transparent opacity={0.45} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh position={[0, 3, 0]}>
        <cylinderGeometry args={[0.05, 0.25, 6, 10, 1, true]} />
        <meshBasicMaterial color="#ffc2dd" transparent opacity={0.22} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <Html position={[0, 2.4, 0]} center zIndexRange={[12, 0]} className="place-anchor">
        <span className="place-name">{dates[kind]?.title}</span>
      </Html>
    </group>
  )
}

/* ───────── Piknik Senja: on the cove beach ───────── */

function Picnic() {
  const live = useLive('sunset_picnic')
  const place = PLACES.sunset_picnic
  const seatsAt = useMemo(() => {
    const side = new THREE.Vector3(Math.cos(place.yaw), 0, -Math.sin(place.yaw))
    return [-0.42, 0.42].map((k) => place.at.clone().addScaledVector(side, k))
  }, [place])
  if (!live) return null
  const y = standHeight(place.at.x, place.at.z)
  return (
    <group>
      <group position={[place.at.x, y, place.at.z]} rotation={[0, place.yaw, 0]}>
        <B p={[0, 0.01, 0]} s={[1.9, 0.02, 1.4]} c="#ffd6e6" rough={1} />
        {[-0.6, -0.2, 0.2, 0.6].map((x) => (
          <B key={x} p={[x, 0.022, 0]} s={[0.16, 0.005, 1.4]} c="#f7a8c4" rough={1} />
        ))}
        <group position={[0.55, 0.02, -0.45]}>
          <PicnicBasket />
        </group>
        <C p={[-0.55, 0.06, -0.45]} rt={0.1} h={0.1} c="#fff4e4" />
        <S p={[-0.55, 0.13, -0.45]} s={[0.07, 0.04, 0.07]} c="#ff9f8f" />
      </group>
      {seatsAt.map((p, i) => (
        <DateSeat key={i} id={`picnic:${i}`} x={p.x} z={p.z} y={y + 0.03} yaw={place.yaw} out={-0.8} group="picnic" label="Duduk di tikar" />
      ))}
    </group>
  )
}

/* ───────── Kemah di Bawah Bintang: beside the house ───────── */

function Flames() {
  const a = useRef()
  const b = useRef()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (a.current) a.current.scale.set(1, 1 + Math.sin(t * 9) * 0.15, 1)
    if (b.current) b.current.scale.set(1, 1 + Math.sin(t * 7 + 1) * 0.2, 1)
  })
  return (
    <group>
      <mesh ref={a} position={[0, 0.28, 0]} material={mat('#ffb347', 2.2)}>
        <coneGeometry args={[0.2, 0.5, 7]} />
      </mesh>
      <mesh ref={b} position={[0.05, 0.24, 0.04]} material={mat('#ffe27a', 2.6)}>
        <coneGeometry args={[0.11, 0.34, 6]} />
      </mesh>
      <Glow position={[0, 0.35, 0]} color="#ffb070" size={2.4} opacity={0.6} />
    </group>
  )
}

function Camp() {
  const live = useLive('camping')
  const active = useDate((s) => s.session?.kind === 'camping' && s.session.status === 'active')
  const { fire, tent, seatList } = useMemo(() => {
    const w = (lx, lz) => {
      const [x, z] = toWorld(lx, lz)
      return new THREE.Vector3(x, HOUSE.y, z)
    }
    const fire = w(...CAMP.fire)
    // two logs either side of the fire, facing it
    const seatList = [
      [-0.85, 0.35],
      [0.85, 0.35],
    ].map(([dx, dz]) => {
      const p = w(CAMP.fire[0] + dx, CAMP.fire[1] + dz)
      return { p, yaw: Math.atan2(fire.x - p.x, fire.z - p.z) }
    })
    return { fire, tent: w(...CAMP.tent), seatList }
  }, [])
  if (!live) return null
  return (
    <group>
      {/* the tent: two leaning panels and a door flap */}
      <group position={tent} rotation={[0, 0.2, 0]}>
        {[1, -1].map((s) => (
          <B key={s} p={[s * 0.42, 0.55, 0]} s={[0.05, 1.25, 1.5]} r={[0, 0, s * 0.72]} c={s > 0 ? '#9ec8f0' : '#b9d8f5'} />
        ))}
        <B p={[0, 1.0, 0]} s={[0.08, 0.08, 1.56]} c="#a5714a" />
        <mesh position={[0, 0.4, 0.74]} material={mat('#ffd6e6')}>
          <coneGeometry args={[0.32, 0.8, 3]} />
        </mesh>
      </group>
      {/* the fire: a ring of stones, crossed logs and the flames */}
      <group position={fire}>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2
          return <S key={i} p={[Math.cos(a) * 0.36, 0.05, Math.sin(a) * 0.36]} s={[0.09, 0.06, 0.08]} c="#bdb3a8" />
        })}
        <C p={[0, 0.07, 0]} rt={0.04} h={0.6} c="#8a6248" r={[0, 0.5, Math.PI / 2]} />
        <C p={[0, 0.09, 0]} rt={0.04} h={0.6} c="#9a6b4a" r={[0, -0.6, Math.PI / 2]} />
        <Flames />
      </group>
      {seatList.map(({ p, yaw }, i) => (
        <group key={i}>
          <C p={[p.x, p.y + 0.14, p.z]} rt={0.14} h={0.85} c="#9a6b4a" r={[0, yaw + Math.PI / 2, Math.PI / 2]} />
          <DateSeat id={`camp:${i}`} x={p.x} z={p.z} y={p.y + 0.3} yaw={yaw} out={-0.6} group="camp" label="Duduk dekat api unggun" />
        </group>
      ))}
      {active && <Fireflies count={18} area={[6, 2.5, 6]} center={[fire.x, fire.y + 1, fire.z]} seed={51} colors={['#ffe2a8', '#ffd6ea']} />}
    </group>
  )
}

/* ───────── Makan Malam di Rumah: plates and candles on the table ───────── */

function DinnerSet() {
  const on = useDate((s) => s.session?.kind === 'dinner_home' && ['preparing', 'active'].includes(s.session.status))
  useHome((s) => s.items) // follow the table if it's moved
  if (!on) return null
  const table = diningTable()
  if (!table) return null
  const a = (table.item.rot * Math.PI) / 2
  return (
    <group position={[table.at.x, HOUSE.y + 0.025 + 0.65, table.at.z]} rotation={[0, a, 0]}>
      {[-0.2, 0.2].map((z) => (
        <group key={z} position={[0, 0, z]}>
          <C p={[0, 0.01, 0]} rt={0.13} h={0.02} c="#ffffff" />
          <S p={[0, 0.04, 0]} s={[0.07, 0.03, 0.07]} c="#ffb38a" />
        </group>
      ))}
      <C p={[-0.32, 0.08, 0]} rt={0.025} h={0.16} c="#fff4e4" seg={8} />
      <S p={[-0.32, 0.18, 0]} s={[0.016, 0.03, 0.016]} c="#ffcf7a" glow={2} />
      <Glow position={[-0.32, 0.2, 0]} color="#ffd9a0" size={0.8} opacity={0.55} />
      <C p={[0.32, 0.07, 0]} rt={0.04} rb={0.05} h={0.14} c="#9ec8f0" />
      <S p={[0.32, 0.17, 0]} s={0.04} c="#ff8fbf" />
    </group>
  )
}

/* ───────── Kencan di Tepi Danau: a letter on the bench, if the owner wrote one ───────── */

function LakeLetter() {
  const active = useDate((s) => s.session?.kind === 'lakeside' && s.session.status === 'active')
  const at = PLACES.lakeside.at
  useInteractable('date-lake-letter', {
    position: at,
    radius: 1.4,
    priority: 0.3,
    enabled: () => Boolean(dates.lakeLetter) && useDate.getState().session?.kind === 'lakeside' && useDate.getState().session?.status === 'active',
    label: 'Baca surat di bangku',
    onInteract: () => useStore.getState().setPanel('date-letter'),
  })
  if (!active || !dates.lakeLetter) return null
  return (
    <group position={[at.x + 0.25, standHeight(at.x, at.z) + 0.45, at.z]}>
      <B p={[0, 0, 0]} s={[0.26, 0.015, 0.18]} c="#fff8ee" />
      <HeartMesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={0.04} color="#ff9cc8" emissive="#ff5fa2" glow={0.8} />
      <Glow color="#ffe2a8" size={0.7} opacity={0.5} />
    </group>
  )
}

/* ───────── sitting together ───────── */

/**
 * If you both sat on the same seat at the same moment, the one who sat a little later moves to the
 * seat next to it (or stands up). Both sides compare the same two timestamps, so they always agree.
 * If her seat disappears (furniture moved away), she stands up.
 */
function SeatKeeper() {
  const hearts = useRef()
  useFrame(({ clock }) => {
    if (player.seat && !seats.has(player.seat)) standUp()
    const mineSeat = presence.seat
    const theirs = partner.online ? partner.seat : null
    if (player.seat && mineSeat && theirs && theirs.seat === player.seat) {
      const myId = useCouple.getState().me?.id || ''
      const mateId = useCouple.getState().mate?.id || ''
      const iYield = mineSeat.at > theirs.at || (mineSeat.at === theirs.at && myId > mateId)
      if (iYield) {
        const other = freeSibling(player.seat)
        if (!(other && sitAt(other))) standUp()
      }
    }
    // side by side on the same piece of furniture: a few hearts drift up between you
    const g = hearts.current
    if (!g) return
    const together = player.seat && theirs?.seat && seats.get(player.seat)?.def.group && seats.get(player.seat)?.def.group === seats.get(theirs.seat)?.def.group
    g.visible = Boolean(together)
    if (together) {
      const other = seats.get(theirs.seat).def
      g.position.set((player.position.x + other.x) / 2, Math.max(player.position.y, other.y - 0.33) + 1.3, (player.position.z + other.z) / 2)
      g.children.forEach((h, i) => {
        const t = (clock.elapsedTime * 0.4 + i / 3) % 1
        h.position.set(Math.sin(t * 6 + i) * 0.12, t * 0.9, 0)
        h.scale.setScalar(0.07 * Math.sin(Math.PI * t) + 0.001)
      })
    }
  })
  return (
    <group ref={hearts} visible={false}>
      {[0, 1, 2].map((i) => (
        <HeartMesh key={i} scale={0.05} color="#ff9cc8" emissive="#ff5fa2" glow={1.2} />
      ))}
    </group>
  )
}

/** Fireflies around the picnic or the lake bench while the date is on (camping has its own). */
function Sparkle() {
  const session = useDate((s) => s.session)
  if (!session || session.status !== 'active' || !['sunset_picnic', 'lakeside'].includes(session.kind)) return null
  const at = PLACES[session.kind].at
  return <Fireflies count={14} area={[5, 2, 5]} center={[at.x, at.y + 1, at.z]} seed={61} colors={['#ffe2a8', '#ffd6ea']} />
}

/** Everything about dates and sitting together that lives in the 3D world. */
export default function DateWorld() {
  const status = useCouple((s) => s.status)
  if (status !== 'connected') return <SeatKeeper />
  return (
    <group>
      <SeatKeeper />
      <Beacon />
      <Picnic />
      <Camp />
      <DinnerSet />
      <LakeLetter />
      <Sparkle />
    </group>
  )
}
