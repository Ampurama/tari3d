import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { attach, balloonPose, board, callBalloon, detach, leaveBalloon, mySeat, PADS, ROUTE_POINTS, trackDock, useBalloon } from '../../lib/balloon'
import { edgeRadius, seeded } from '../../lib/terrain'
import { count } from '../../lib/device'
import { coupleAvailable, useCouple } from '../../lib/couple'
import { player } from '../../lib/player'
import { useInteractable } from '../../lib/interactions'
import { atmosphere } from '../../lib/atmosphere'
import { standUp } from '../../lib/actions'
import { releaseHand } from '../../lib/hand'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'
import { B, C, mat, S } from './HomeFurniture'
import { Glow, HeartMesh } from './Bits'

/*
 * HOT AIR BALLOON, in the world: the balloon itself (flown from the shared row in lib/balloon.js),
 * a landing pad on each island, "Naik Balon Udara" / "Turun dari Balon" / "Panggil balon udara",
 * a few clouds along the way, and the golden light while you're up there.
 */

const STRIPES = ['#ffc2d9', '#fff1dc', '#cfe3ff', '#fff1dc', '#ffd6a8', '#fff1dc', '#d9c6ff', '#fff1dc']

/** The envelope: a soft teardrop, in pastel stripes (vertex colours, one draw call). */
function useEnvelope() {
  return useMemo(() => {
    const pts = []
    for (let i = 0; i <= 16; i++) {
      const t = i / 16
      const a = t * Math.PI
      // wide at the top, narrowing to the mouth above the basket
      const r = Math.sin(a) * (1.75 - 0.55 * (1 - t) ** 2) * (t < 0.18 ? 0.45 + t * 3 : 1)
      pts.push(new THREE.Vector2(Math.max(0.28, r), -Math.cos(a) * 2.0))
    }
    const g = new THREE.LatheGeometry(pts, 24)
    const colors = []
    const c = new THREE.Color()
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const ang = Math.atan2(p.getZ(i), p.getX(i)) + Math.PI
      c.set(STRIPES[Math.floor((ang / (Math.PI * 2)) * STRIPES.length) % STRIPES.length])
      colors.push(c.r, c.g, c.b)
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    g.computeVertexNormals()
    return g
  }, [])
}
const envelopeMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, flatShading: true })

function BalloonModel({ envelopeRef, flameRef }) {
  const envelope = useEnvelope()
  return (
    <group>
      {/* the basket (open at the top, so two little people fit inside) */}
      <C p={[0, 0.3, 0]} rt={0.72} rb={0.62} h={0.6} c="#c8915f" seg={12} />
      <C p={[0, 0.62, 0]} rt={0.76} h={0.07} c="#a5714a" seg={12} />
      <C p={[0, 0.04, 0]} rt={0.6} h={0.06} c="#8a6248" seg={12} />
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2
        return <HeartMesh key={i} position={[Math.cos(a) * 0.74, 0.38, Math.sin(a) * 0.74]} rotation={[0, -a + Math.PI / 2, 0]} scale={0.06} color="#ff9cc8" emissive="#ff5fa2" glow={0.5} />
      })}
      {/* ropes up to the envelope */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4
        return <C key={i} p={[Math.cos(a) * 0.62, 1.55, Math.sin(a) * 0.62]} rt={0.012} h={1.9} c="#e3c39b" seg={4} r={[Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12]} />
      })}
      {/* the burner and its warm flame */}
      <C p={[0, 2.35, 0]} rt={0.16} rb={0.2} h={0.18} c="#6d5a6e" />
      <group ref={flameRef} position={[0, 2.55, 0]}>
        <mesh material={mat('#ffb347', 2.4)}>
          <coneGeometry args={[0.12, 0.34, 7]} />
        </mesh>
        <Glow color="#ffb070" size={1.6} opacity={0.6} />
      </group>
      {/* the envelope, swaying a little */}
      <group ref={envelopeRef} position={[0, 4.65, 0]}>
        <mesh geometry={envelope} material={envelopeMaterial} castShadow />
        {Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2
          return <S key={i} p={[Math.cos(a) * 1.25, -1.5, Math.sin(a) * 1.25]} s={0.045} c={i % 2 ? '#ffd6ea' : '#ffe2a8'} glow={1.6} />
        })}
        <HeartMesh position={[0, 2.12, 0]} scale={0.22} color="#ff9cc8" emissive="#ff5fa2" glow={0.9} />
      </group>
    </group>
  )
}

/** A round landing pad with a little flag (on both islands). */
function Pad({ at, name }) {
  return (
    <group position={at}>
      <C p={[0, 0.02, 0]} rt={1.25} h={0.04} c="#f4ece0" seg={20} />
      <C p={[0, 0.03, 0]} rt={1.0} h={0.04} c="#ffd6e6" seg={20} />
      <group position={[1.15, 0, -0.9]}>
        <C p={[0, 0.7, 0]} rt={0.03} h={1.4} c="#ffffff" seg={6} />
        <B p={[0.2, 1.25, 0]} s={[0.38, 0.24, 0.02]} c="#ff8fbf" />
      </group>
      <Glow position={[0, 0.3, 0]} color="#ffd6ea" size={2.4} opacity={0.18} />
      <group name={name} />
    </group>
  )
}

/**
 * Clouds along the way: some at the balloon's height to drift past (never right on the path),
 * and a soft layer far below, so the flight feels high above everything.
 */
function RouteClouds() {
  const ref = useRef()
  const clouds = useMemo(() => {
    const list = []
    const rand = seeded(919)
    const near = count(26, 16)
    for (let i = 0; i < near; i++) {
      const t = 0.12 + (i / (near - 1)) * 0.76
      const p = ROUTE_CURVE.getPointAt(t)
      const side = i % 2 ? 1 : -1
      // beside the route (3–7 m off it), a little above or below
      list.push([p.x + side * (3 + rand() * 4), p.y + (rand() - 0.5) * 5, p.z + (rand() - 0.5) * 6, 1.2 + rand() * 1.4])
    }
    const below = count(22, 12)
    for (let i = 0; i < below; i++) {
      const t = i / (below - 1)
      const p = ROUTE_CURVE.getPointAt(0.15 + t * 0.7)
      list.push([p.x + (rand() - 0.5) * 16, 1.5 + rand() * 3, p.z + (rand() - 0.5) * 16, 2.2 + rand() * 2])
    }
    // never over the main island: from the high three-quarter camera a cloud there would sit on
    // top of the lake and the paths (the higher it floats, the more of the island it can cover)
    return list.filter(([x, y, z, s]) => Math.hypot(x, z) - s * 1.1 > edgeRadius(x, z) + 2 + Math.max(0, y) * 0.55)
  }, [])
  // every puff of every cloud in one instanced draw (light on phones)
  const puffsRef = useRef()
  const PUFFS = [
    [0, 0, 0, 1.1, 0.45, 0.8],
    [0.8, 0.12, 0.1, 0.7, 0.38, 0.6],
    [-0.75, 0.05, -0.1, 0.65, 0.32, 0.55],
  ]
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    let i = 0
    clouds.forEach(([x, y, z, s]) =>
      PUFFS.forEach(([px, py, pz, sx, sy, sz]) => {
        m.compose(new THREE.Vector3(x + px * s, y + py * s, z + pz * s), q, new THREE.Vector3(sx * s, sy * s, sz * s))
        puffsRef.current.setMatrixAt(i++, m)
      }),
    )
    puffsRef.current.instanceMatrix.needsUpdate = true
    puffsRef.current.computeBoundingSphere()
  }, [clouds]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.x = Math.sin(clock.elapsedTime * 0.05) * 0.8
  })
  return (
    <group ref={ref}>
      <instancedMesh ref={puffsRef} args={[undefined, undefined, clouds.length * PUFFS.length]} material={mat('#ffffff', 0.06, 1)}>
        <icosahedronGeometry args={[1, 1]} />
      </instancedMesh>
    </group>
  )
}
const ROUTE_CURVE = new THREE.CatmullRomCurve3(ROUTE_POINTS, false, 'centripetal')

/** Keeps her in (or out of) the basket exactly as the server says, flies the balloon, lights the sky. */
function BalloonActor() {
  const group = useRef()
  const envelopeRef = useRef()
  const flameRef = useRef()
  const row = useBalloon((s) => s.row)

  useFrame(({ clock }) => {
    const pose = balloonPose(row)
    const g = group.current
    if (!g) return
    const t = clock.elapsedTime
    const flying = pose.phase !== 'docked'
    g.position.copy(pose.pos)
    g.position.y += flying ? Math.sin(t * 1.3) * 0.07 : 0
    g.rotation.y = pose.yaw
    if (envelopeRef.current) {
      envelopeRef.current.rotation.z = Math.sin(t * 0.7) * (flying ? 0.035 : 0.015)
      envelopeRef.current.rotation.x = Math.sin(t * 0.55 + 1) * (flying ? 0.03 : 0.012)
    }
    if (flameRef.current) {
      flameRef.current.visible = flying || Boolean(row?.seat_a || row?.seat_b)
      flameRef.current.scale.setScalar(1 + Math.sin(t * 13) * 0.12 + (pose.phase === 'takeoff' ? 0.4 : 0))
    }
    trackDock()

    // the server's row decides who's in the basket; her character follows that
    const seat = useCouple.getState().status === 'connected' ? mySeat(row) : null
    if (seat && player.balloon !== seat) {
      standUp()
      releaseHand('self')
      attach(seat)
    } else if (!seat && player.balloon) detach()

    // golden light while she's up in the air
    atmosphere.travel = player.balloon && flying ? { sunset: 0.85 } : null
  })

  // "Naik Balon Udara" / "Turun dari Balon" at the basket (only while it's on the ground)
  const at = useRef(new THREE.Vector3())
  useInteractable('balloon', {
    get position() {
      return at.current.copy(balloonPose().pos)
    },
    radius: 1.9,
    priority: 0.4,
    enabled: () => balloonPose().phase === 'docked' && useStore.getState().view === 'explore',
    label: () => {
      if (!coupleAvailable || useCouple.getState().status !== 'connected') return 'Balon udara (main berdua dulu ♡)'
      if (player.balloon) return 'Turun dari Balon'
      const r = useBalloon.getState().row
      return r?.seat_a && r?.seat_b ? 'Balon penuh' : 'Naik Balon Udara'
    },
    onInteract: () => {
      if (!coupleAvailable) return useStore.getState().showToast('Balon udara butuh fitur "Main berdua".', 4000)
      if (useCouple.getState().status !== 'connected') return useStore.getState().setPanel('couple')
      audio.sparkle()
      return player.balloon ? leaveBalloon() : board()
    },
  })
  return (
    <group ref={group}>
      <BalloonModel envelopeRef={envelopeRef} flameRef={flameRef} />
    </group>
  )
}

/** "Panggil balon udara" at an empty pad, when the balloon is waiting at the other island. */
function CallSpot({ name }) {
  useInteractable(`balloon-call:${name}`, {
    position: PADS[name],
    radius: 1.8,
    priority: 0.3,
    enabled: () => {
      const r = useBalloon.getState().row
      const pose = balloonPose()
      return Boolean(r) && pose.phase === 'docked' && pose.at !== name && !r.seat_a && !r.seat_b && useStore.getState().view === 'explore'
    },
    label: 'Panggil balon udara',
    onInteract: () => {
      audio.sparkle()
      callBalloon(name)
      useStore.getState().showToast('Balonnya sedang dalam perjalanan ke sini 🎈', 4000)
    },
  })
  return null
}

/** Everything about the hot air balloon in the 3D world. */
export default function Balloon() {
  return (
    <group>
      <Pad at={PADS.main} name="main" />
      <Pad at={PADS.sky} name="sky" />
      <CallSpot name="main" />
      <CallSpot name="sky" />
      <RouteClouds />
      <BalloonActor />
    </group>
  )
}
