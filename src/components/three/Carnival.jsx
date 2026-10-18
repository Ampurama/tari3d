import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import {
  announcement,
  BENCHES,
  board,
  BOOTH_HALF,
  boothSpot,
  BOOTHS,
  BUMPER,
  bumps,
  canGetOff,
  car,
  CAROUSEL,
  carS,
  coasterState,
  CREW,
  CREW_IDS,
  crewAt,
  crewTalk,
  cupPose,
  FENCE,
  GAMES,
  GATE,
  getOff,
  gnomeCar,
  gondolaAngle,
  gondolaPose,
  groundLevel,
  KIOSK,
  LAMPS,
  mateRide,
  mountPose,
  OFFICE,
  onPhotoMark,
  openGame,
  PHOTO,
  photoPose,
  rideName,
  spinnerState,
  STAGE,
  STATION,
  TEACUPS,
  TICKET_BOOTH,
  tickCarnival,
  TOADSTOOLS,
  TRACK,
  TRACK_LENGTH,
  trackPose,
  useFair,
  useScores,
  WALKS,
  WHEEL,
} from '../../lib/carnival'
import { closeTalk, say, useVillage } from '../../lib/village'
import { emote, useSeat } from '../../lib/actions'
import { useInteractable } from '../../lib/interactions'
import { partner, useCouple } from '../../lib/couple'
import { player } from '../../lib/player'
import { atmosphere } from '../../lib/atmosphere'
import { heartGeometry } from '../../lib/heart'
import { nameOf } from '../../lib/wishes'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'
import { B, C, mat, S } from './HomeFurniture'
import { LightPools } from './Bits'
import { Bubble, Gnome } from './Gnome'
import { Building } from './Village'

/*
 * GNOME CARNIVAL — DREAMLIGHT FUNFAIR, what you see (the rides' timing, the seats, the booth games
 * and the gnomes are lib/carnival.js; the screens are components/ui/CarnivalUI.jsx). Rides are
 * moved every frame from the shared clock, so they look the same on both screens. Repeated things
 * (pavers, fence posts, bulbs, track ties and supports, flowers) are instanced.
 */

const Y = () => groundLevel()
const TAU = Math.PI * 2
const glowNow = () => 0.25 + 0.95 * Math.max(1 - atmosphere.day, atmosphere.sunset * 0.6)
const PASTEL = ['#ff8fbf', '#ffd27f', '#c9b6f4', '#8fe3dc', '#ffb3a0', '#b9e8ff']

/* ───────── small helpers ───────── */

/** Fill an instanced mesh once: matrices (and colours). */
function useInstances(ref, list, colors) {
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    list.forEach((mx, i) => m.setMatrixAt(i, mx))
    if (colors) {
      const c = new THREE.Color()
      colors.forEach((col, i) => m.setColorAt(i, c.set(col)))
      m.instanceColor.needsUpdate = true
    }
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [ref, list, colors])
}
const mx = (x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0, 'YXZ')), new THREE.Vector3(sx, sy, sz))

/** A canvas sign. */
function useSign(lines, w = 512, h = 160, colors = {}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const t = new THREE.CanvasTexture(canvas)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  }, [w, h])
  useEffect(() => {
    const g = texture.image.getContext('2d')
    const paint = () => {
      g.fillStyle = colors.bg || '#fff6ea'
      g.fillRect(0, 0, w, h)
      g.strokeStyle = colors.edge || '#e8798f'
      g.lineWidth = 10
      g.strokeRect(8, 8, w - 16, h - 16)
      g.textAlign = 'center'
      g.fillStyle = colors.ink || '#6b4a5e'
      g.font = `700 ${lines[1] ? Math.round(h * 0.32) : Math.round(h * 0.42)}px 'Cormorant Garamond', Georgia, serif`
      g.fillText(lines[0], w / 2, lines[1] ? h * 0.48 : h * 0.62)
      if (lines[1]) {
        g.fillStyle = colors.sub || '#c47a52'
        g.font = `500 ${Math.round(h * 0.16)}px 'Quicksand', system-ui, sans-serif`
        g.fillText(lines[1], w / 2, h * 0.78)
      }
      texture.needsUpdate = true
    }
    paint()
    document.fonts?.ready.then(paint)
  }, [texture, w, h, lines[0], lines[1]]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}
function SignBoard({ lines, w = 1.6, h = 0.5, position, rotation, colors, both }) {
  const tex = useSign(lines, 512, Math.round((512 * h) / w), colors)
  return (
    <group position={position} rotation={rotation}>
      <B p={[0, 0, -0.03]} s={[w + 0.1, h + 0.1, 0.05]} c={colors?.frame || '#a5714a'} />
      <mesh position={[0, 0, 0.001]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={tex} roughness={0.85} />
      </mesh>
      {both && (
        <mesh position={[0, 0, -0.061]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial map={tex} roughness={0.85} />
        </mesh>
      )}
    </group>
  )
}

/** Bulbs that glow more at night (an instanced set; `phase` lets two sets twinkle in turn). */
function Bulbs({ points, size = 0.05, colors, phase = 0, speed = 0 }) {
  const ref = useRef()
  const list = useMemo(() => points.map(([x, y, z]) => mx(x, y, z, size, size, size)), [points, size])
  const cols = useMemo(() => points.map((_, i) => (colors ? colors[i % colors.length] : '#ffe2a8')), [points, colors])
  useInstances(ref, list, cols)
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), [])
  useEffect(() => () => material.dispose(), [material])
  useFrame(({ clock }) => {
    const twinkle = speed ? 0.5 + 0.5 * Math.sin(clock.elapsedTime * speed + phase) : 1
    material.color.setScalar(0.55 + glowNow() * (0.9 + 0.8 * twinkle))
  })
  return (
    <instancedMesh ref={ref} args={[null, material, list.length]}>
      <sphereGeometry args={[1, 8, 6]} />
    </instancedMesh>
  )
}
/** A string of bulbs hanging between two points. */
const sag = (a, b, n, drop = 0.35) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * drop, a[2] + (b[2] - a[2]) * t]
  })

/* ───────── the ground: paved walks, the plaza round the carousel, flowers ───────── */

function Paving() {
  const ref = useRef()
  const { list, cols } = useMemo(() => {
    const list = []
    const cols = []
    const y = Y() + 0.012
    for (const w of WALKS)
      for (let i = 0; i < w.length - 1; i++) {
        const [ax, az] = w[i]
        const [bx, bz] = w[i + 1]
        const l = Math.hypot(bx - ax, bz - az)
        const yaw = Math.atan2(bx - ax, bz - az)
        const nx = Math.cos(yaw)
        const nz = -Math.sin(yaw)
        for (let d = 0.25; d < l; d += 0.52)
          for (const side of [-0.5, 0, 0.5]) {
            const x = ax + ((bx - ax) * d) / l + nx * side
            const z = az + ((bz - az) * d) / l + nz * side
            list.push(mx(x, y, z, 0.48, 0.012, 0.48, yaw))
            cols.push(['#f3e6d8', '#ead9e8', '#f6e9cf'][(list.length * 7) % 3])
          }
      }
    return { list, cols }
  }, [])
  useInstances(ref, list, cols)
  const material = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.9 }), [])
  return (
    <group>
      <instancedMesh ref={ref} args={[null, material, list.length]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      {/* the plaza round the carousel */}
      <mesh position={[CAROUSEL.x, Y() + 0.011, CAROUSEL.z]} rotation={[-Math.PI / 2, 0, 0]} material={mat('#efe3d6', 0, 0.9)}>
        <ringGeometry args={[CAROUSEL.r + 0.1, CAROUSEL.r + 1.6, 48]} />
      </mesh>
      <mesh position={[TEACUPS.x, Y() + 0.011, TEACUPS.z]} rotation={[-Math.PI / 2, 0, 0]} material={mat('#e9dff0', 0, 0.9)}>
        <ringGeometry args={[TEACUPS.r + 0.1, TEACUPS.r + 0.9, 48]} />
      </mesh>
    </group>
  )
}

/** The fence round the fair (open at the gate), with flowers along the inside. */
function Fence() {
  const posts = useRef()
  const flowers = useRef()
  const { postList, flowerList, flowerCols, rails } = useMemo(() => {
    const y = Y()
    const segs = [
      [FENCE.x0, FENCE.z0, FENCE.x1, FENCE.z0],
      [FENCE.x1, FENCE.z0, FENCE.x1, FENCE.z1],
      [FENCE.x0, FENCE.z1, FENCE.x1, FENCE.z1],
      [FENCE.x0, FENCE.z0, FENCE.x0, GATE.z - GATE.half],
      [FENCE.x0, GATE.z + GATE.half, FENCE.x0, FENCE.z1],
    ]
    const postList = []
    const flowerList = []
    const flowerCols = []
    const rails = []
    segs.forEach(([ax, az, bx, bz], si) => {
      const l = Math.hypot(bx - ax, bz - az)
      const n = Math.max(1, Math.round(l / 1.2))
      for (let i = 0; i <= n; i++) {
        const x = ax + ((bx - ax) * i) / n
        const z = az + ((bz - az) * i) / n
        postList.push(mx(x, y + 0.45, z, 0.07, 0.9, 0.07))
      }
      const yaw = Math.atan2(bx - ax, bz - az)
      rails.push({ x: (ax + bx) / 2, z: (az + bz) / 2, l, yaw })
      // flowers just inside
      const inx = si === 1 ? -0.45 : si >= 3 ? 0.45 : 0
      const inz = si === 0 ? 0.45 : si === 2 ? -0.45 : 0
      for (let d = 0.6; d < l; d += 0.7) {
        const x = ax + ((bx - ax) * d) / l + inx
        const z = az + ((bz - az) * d) / l + inz
        flowerList.push(mx(x, y + 0.12, z, 0.07, 0.07, 0.07))
        flowerCols.push(PASTEL[flowerList.length % PASTEL.length])
      }
    })
    return { postList, flowerList, flowerCols, rails }
  }, [])
  useInstances(posts, postList)
  useInstances(flowers, flowerList, flowerCols)
  const flowerMat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.6 }), [])
  return (
    <group>
      <instancedMesh ref={posts} args={[null, mat('#fff6ea'), postList.length]}>
        <cylinderGeometry args={[1, 1, 1, 6]} />
      </instancedMesh>
      {rails.map((r, i) => (
        <group key={i} position={[r.x, Y(), r.z]} rotation={[0, r.yaw, 0]}>
          <B p={[0, 0.72, 0]} s={[0.05, 0.06, r.l]} c="#fff6ea" />
          <B p={[0, 0.38, 0]} s={[0.05, 0.06, r.l]} c="#f4c6d6" />
        </group>
      ))}
      <instancedMesh ref={flowers} args={[null, flowerMat, flowerList.length]}>
        <sphereGeometry args={[1, 8, 6]} />
      </instancedMesh>
    </group>
  )
}

/* ───────── the gate and the ticket booth ───────── */

function Tower({ x, z }) {
  return (
    <group position={[x, Y(), z]}>
      {[0, 1, 2, 3, 4].map((i) => (
        <C key={i} p={[0, 0.4 + i * 0.8, 0]} rt={0.42} h={0.8} c={i % 2 ? '#fff6ea' : '#ff8fbf'} seg={16} />
      ))}
      <mesh position={[0, 4.35, 0]} scale={[1, 0.6, 1]} material={mat('#c9a5e8')}>
        <sphereGeometry args={[0.72, 18, 10, 0, TAU, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[0, 4.95, 0]} material={mat('#ffd27f', 0.6)}>
        <coneGeometry args={[0.1, 0.4, 8]} />
      </mesh>
      {/* a little flag */}
      <C p={[0, 5.4, 0]} rt={0.015} h={0.7} c="#6d5a6e" seg={4} />
      <mesh position={[0.18, 5.62, 0]} rotation={[0, 0, -Math.PI / 2]} material={mat('#e8566f')}>
        <coneGeometry args={[0.1, 0.34, 3]} />
      </mesh>
      {/* balloons tied on */}
      {[0, 1, 2].map((i) => (
        <group key={i}>
          <C p={[Math.cos(i * 2.1) * 0.3, 3.3, Math.sin(i * 2.1) * 0.3]} rt={0.004} h={1.2} c="#fff6ea" seg={3} />
          <mesh position={[Math.cos(i * 2.1) * 0.35, 3.95 + i * 0.12, Math.sin(i * 2.1) * 0.35]} scale={[1, 1.15, 1]} material={mat(PASTEL[i + 1], 0.2, 0.35)}>
            <sphereGeometry args={[0.16, 12, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Gate() {
  const za = GATE.z - GATE.half - 0.45
  const zb = GATE.z + GATE.half + 0.45
  const bulbs = useMemo(() => {
    const y = Y()
    return Array.from({ length: 19 }, (_, i) => {
      const t = i / 18
      return [GATE.x - 0.2, y + 3.6 + Math.sin(t * Math.PI) * 0.7, za + (zb - za) * t]
    })
  }, [za, zb])
  return (
    <group>
      <Tower x={GATE.x} z={za} />
      <Tower x={GATE.x} z={zb} />
      {/* the arch, curving over the way in */}
      <group position={[GATE.x, Y(), GATE.z]}>
        <mesh position={[0, 3.6, 0]} rotation={[0, Math.PI / 2, 0]} scale={[1, 0.42, 1]} material={mat('#c9a5e8')}>
          <torusGeometry args={[(zb - za) / 2, 0.16, 8, 30, Math.PI]} />
        </mesh>
        {/* the name, on both sides of a marquee block (and one face toward the camera) */}
        <group position={[0, 4.35, 0]}>
          <B p={[0, 0, 0]} s={[0.3, 0.95, 3.1]} c="#a5714a" />
          <SignBoard lines={['Dreamlight Funfair', 'Karnaval Kurcaci']} w={2.9} h={0.8} position={[-0.17, 0, 0]} rotation={[0, -Math.PI / 2, 0]} colors={{ edge: '#e8566f', frame: '#e8566f' }} />
          <SignBoard lines={['Dreamlight Funfair', 'Karnaval Kurcaci']} w={2.9} h={0.8} position={[0.17, 0, 0]} rotation={[0, Math.PI / 2, 0]} colors={{ edge: '#e8566f', frame: '#e8566f' }} />
          <SignBoard lines={['Dreamlight Funfair']} w={0.26} h={0.08} position={[0, 0, 1.56]} colors={{ edge: '#e8566f', frame: '#e8566f' }} />
          <mesh position={[0, 0.72, 0]} material={mat('#ffd27f', 0.8)}>
            <octahedronGeometry args={[0.22, 0]} />
          </mesh>
        </group>
      </group>
      <Bulbs points={bulbs} colors={['#ffe2a8', '#ffd6ea', '#d9c6ff']} speed={2.4} />
    </group>
  )
}

function TicketBooth() {
  const { x, z } = TICKET_BOOTH
  return (
    <group position={[x, Y(), z]}>
      {[-0.7, -0.35, 0, 0.35, 0.7].map((dx, i) => (
        <B key={dx} p={[dx, 0.95, 0]} s={[0.36, 1.9, 1.3]} c={i % 2 ? '#fff6ea' : '#ff8fbf'} />
      ))}
      {/* the window and its little counter */}
      <B p={[0, 1.15, 0.66]} s={[0.9, 0.6, 0.02]} c="#3b3560" />
      <B p={[0, 0.83, 0.75]} s={[1.0, 0.06, 0.25]} c="#c8915f" />
      <mesh position={[0, 2.2, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1, 0.5, 1]} material={mat('#c9a5e8')}>
        <coneGeometry args={[1.25, 0.9, 4]} />
      </mesh>
      <SignBoard lines={['Loket', 'gelang gratis 🎟️']} w={1.0} h={0.32} position={[0, 1.65, 0.68]} />
    </group>
  )
}

/* ───────── the roller coaster ───────── */

function Coaster() {
  const level = Y()
  const { rails, spine, ties, supports } = useMemo(() => {
    const n = 420
    const left = []
    const right = []
    const mid = []
    const ties = []
    const supports = []
    const P = new THREE.Vector3()
    const T = new THREE.Vector3()
    const up = new THREE.Vector3(0, 1, 0)
    const R = new THREE.Vector3()
    const U = new THREE.Vector3()
    const m = new THREE.Matrix4()
    for (let i = 0; i < n; i++) {
      const u = i / n
      TRACK.getPointAt(u, P)
      TRACK.getTangentAt(u, T)
      R.crossVectors(T, up).normalize()
      U.crossVectors(R, T).normalize()
      const base = new THREE.Vector3(P.x, P.y + level, P.z)
      left.push(base.clone().addScaledVector(R, -0.3))
      right.push(base.clone().addScaledVector(R, 0.3))
      mid.push(base.clone().addScaledVector(U, -0.16))
      if (i % 4 === 0) {
        m.makeBasis(R, U, T)
        m.setPosition(base.clone().addScaledVector(U, -0.05))
        ties.push(m.clone().multiply(new THREE.Matrix4().makeScale(0.72, 0.05, 0.1)))
      }
      if (i % 14 === 0 && P.y > 0.55) supports.push(mx(P.x, level + (P.y - 0.16) / 2, P.z, 0.07, P.y - 0.16, 0.07))
    }
    const tube = (pts, r) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, 'centripetal'), 600, r, 6, true)
    return { rails: [tube(left, 0.045), tube(right, 0.045)], spine: tube(mid, 0.075), ties, supports }
  }, [level])
  useEffect(() => () => [...rails, spine].forEach((g) => g.dispose()), [rails, spine])
  const tieRef = useRef()
  const supRef = useRef()
  useInstances(tieRef, ties)
  useInstances(supRef, supports)
  // the tunnel: a mushroom cap over the low stretch after the drop
  const tunnel = useMemo(() => {
    let best = 0
    let bd = Infinity
    const p = {}
    for (let s = 0; s < TRACK_LENGTH; s += 0.2) {
      trackPose(s, p)
      const d = Math.hypot(p.x - 71.8, p.z - 33.4)
      if (d < bd) {
        bd = d
        best = s
      }
    }
    return trackPose(best, {})
  }, [])
  // the train: two cars, moved along the track by the shared clock
  const cars = [useRef(), useRef()]
  const lever = useRef()
  useFrame(() => {
    const st = coasterState()
    const p = {}
    cars.forEach((ref, i) => {
      if (!ref.current) return
      trackPose(carS(st.s, i), p)
      ref.current.position.set(p.x, p.y, p.z)
      ref.current.rotation.set(-p.pitch, p.yaw, 0, 'YXZ')
    })
    if (lever.current) lever.current.rotation.x = st.phase === 'board' && st.left < 2 ? -0.9 : 0.2
  })
  const { deck } = STATION
  return (
    <group>
      {rails.map((g, i) => (
        <mesh key={i} geometry={g} material={mat('#ff8fbf', 0, 0.4)} />
      ))}
      <mesh geometry={spine} material={mat('#c9a5e8', 0, 0.5)} />
      <instancedMesh ref={tieRef} args={[null, mat('#a5714a'), ties.length]}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <instancedMesh ref={supRef} args={[null, mat('#fff6ea'), supports.length]}>
        <cylinderGeometry args={[1, 1.3, 1, 8]} />
      </instancedMesh>
      {/* the tunnel */}
      <group position={[tunnel.x, level, tunnel.z]} rotation={[0, tunnel.yaw, 0]}>
        <group scale={[1.55, 2.75, 1]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={mat('#e8798f', 0, 0.7)}>
            <cylinderGeometry args={[1, 1, 2.6, 22, 1, true, Math.PI / 2, Math.PI]} />
          </mesh>
        </group>
        {[-0.8, 0, 0.8].map((z, i) => (
          <S key={z} p={[(i - 1) * 0.55, 2.72 - Math.abs(i - 1) * 0.12, z]} s={[0.2, 0.07, 0.2]} c="#fff4f0" />
        ))}
      </group>
      {/* the station: a deck by the track, a striped roof, the operator's lever */}
      <group>
        <B p={[(deck.x0 + deck.x1) / 2, level + 0.015, (deck.z0 + deck.z1) / 2]} s={[deck.x1 - deck.x0, 0.03, deck.z1 - deck.z0]} c="#d6a77a" />
        {[deck.z0, deck.z1].flatMap((z) =>
          [deck.x0, 68.3].map((x) => <C key={x + ':' + z} p={[x, level + 1.3, z]} rt={0.06} h={2.6} c="#fff6ea" seg={8} />),
        )}
        {Array.from({ length: 6 }, (_, i) => (
          <B key={i} p={[(deck.x0 + 68.3) / 2, level + 2.65, deck.z0 + (i + 0.5) * ((deck.z1 - deck.z0) / 6)]} s={[68.3 - deck.x0 + 0.4, 0.06, (deck.z1 - deck.z0) / 6]} c={i % 2 ? '#fff6ea' : '#5fb3a8'} />
        ))}
        <SignBoard lines={['Roller Coaster', 'Dreamlight Express']} w={1.6} h={0.42} position={[deck.x0 - 0.05, level + 2.2, (deck.z0 + deck.z1) / 2]} rotation={[0, -Math.PI / 2, 0]} both />
        <group position={[66.0, level + 0.5, 29.9]}>
          <B p={[0, 0, 0]} s={[0.3, 0.9, 0.3]} c="#6d5a6e" />
          <group ref={lever} position={[0, 0.45, 0]}>
            <C p={[0, 0.25, 0]} rt={0.02} h={0.5} c="#c9c3d2" seg={6} />
            <S p={[0, 0.52, 0]} s={0.05} c="#e8566f" />
          </group>
        </group>
      </group>
      {cars.map((ref, i) => (
        <group key={i} ref={ref}>
          <CoasterCar front={i === 0} />
        </group>
      ))}
    </group>
  )
}
function CoasterCar({ front }) {
  return (
    <group>
      <B p={[0, 0.16, 0]} s={[0.78, 0.3, 1.2]} c={front ? '#ff8fbf' : '#c9a5e8'} />
      <B p={[0, 0.34, -0.5]} s={[0.78, 0.42, 0.14]} c={front ? '#ff8fbf' : '#c9a5e8'} />
      <B p={[0, 0.36, 0.0]} s={[0.66, 0.06, 0.6]} c="#fff6ea" />
      {/* the lap bar */}
      <B p={[0, 0.62, 0.3]} s={[0.7, 0.05, 0.05]} c="#ffd27f" />
      {front && (
        <group position={[0, 0.25, 0.66]}>
          <S p={[0, 0, 0]} s={[0.36, 0.22, 0.12]} c="#ff8fbf" />
          <S p={[0, 0.02, 0.1]} s={0.07} c="#ffae9c" />
          <mesh position={[0, 0.32, -0.02]} material={mat('#e8566f')}>
            <coneGeometry args={[0.18, 0.4, 10]} />
          </mesh>
          <S p={[0.22, 0.02, 0.06]} s={0.04} c="#fff1b8" glow={1.2} />
          <S p={[-0.22, 0.02, 0.06]} s={0.04} c="#fff1b8" glow={1.2} />
        </group>
      )}
      {[-0.42, 0.42].flatMap((z) => [-0.3, 0.3].map((x) => <C key={x + ':' + z} p={[x, 0.02, z]} rt={0.07} h={0.08} c="#6d5a6e" r={[0, 0, Math.PI / 2]} />))}
    </group>
  )
}

/* ───────── the big wheel ───────── */

function Wheel() {
  const level = Y()
  const rim = useRef()
  const gondolas = useRef([])
  const legs = useMemo(() => {
    const out = []
    for (const zf of [-0.75, 0.75])
      for (const side of [-1, 1]) {
        const ax = side * 2.8
        const len = Math.hypot(ax, WHEEL.hub)
        out.push({ x: ax / 2, y: WHEEL.hub / 2, z: zf, len, rot: Math.atan2(ax, WHEEL.hub) })
      }
    return out
  }, [])
  const bulbs = useMemo(() => {
    const out = [[], []]
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * TAU
      for (const z of [-0.36, 0.36]) out[i % 2].push([Math.sin(a) * (WHEEL.r + 0.12), -Math.cos(a) * (WHEEL.r + 0.12), z])
    }
    return out
  }, [])
  useFrame(() => {
    if (rim.current) rim.current.rotation.z = gondolaAngle(0)
    const p = {}
    gondolas.current.forEach((g, k) => {
      if (!g) return
      gondolaPose(k, undefined, p)
      g.position.set(p.x, p.y, p.z)
    })
  })
  return (
    <group>
      <group position={[WHEEL.x, level, WHEEL.z]}>
        {legs.map((l, i) => (
          <mesh key={i} position={[l.x, l.y, l.z]} rotation={[0, 0, l.rot]} material={mat('#fff6ea')}>
            <cylinderGeometry args={[0.09, 0.13, l.len, 8]} />
          </mesh>
        ))}
        <C p={[0, WHEEL.hub, 0]} rt={0.18} h={1.8} c="#c9a5e8" r={[Math.PI / 2, 0, 0]} />
        {/* the turning part: two rims, spokes, bulbs */}
        <group ref={rim} position={[0, WHEEL.hub, 0]}>
          {[-0.36, 0.36].map((z) => (
            <mesh key={z} position={[0, 0, z]} material={mat('#ff8fbf', 0, 0.45)}>
              <torusGeometry args={[WHEEL.r, 0.07, 8, 64]} />
            </mesh>
          ))}
          {Array.from({ length: WHEEL.n * 2 }, (_, i) => {
            const a = (i / (WHEEL.n * 2)) * TAU
            return [-0.36, 0.36].map((z) => <B key={i + ':' + z} p={[(Math.sin(a) * WHEEL.r) / 2, (-Math.cos(a) * WHEEL.r) / 2, z]} s={[0.05, WHEEL.r, 0.05]} c="#fff6ea" r={[0, 0, a]} />)
          }).flat()}
          <mesh material={mat('#ffd27f', 0.4)}>
            <torusGeometry args={[0.6, 0.12, 8, 20]} />
          </mesh>
          <Bulbs points={bulbs[0]} colors={['#ffe2a8', '#ffd6ea']} speed={3} phase={0} />
          <Bulbs points={bulbs[1]} colors={['#d9c6ff', '#b9e8ff']} speed={3} phase={Math.PI} />
        </group>
        {/* the boarding platform in front */}
        <B p={[WHEEL.board[0] - WHEEL.x, 0.015, WHEEL.board[1] - WHEEL.z]} s={[3.2, 0.03, 1.4]} c="#d6a77a" />
        <SignBoard lines={['Bianglala', 'Dreamlight Wheel']} w={1.4} h={0.4} position={[2.6, 1.2, 2.0]} both />
      </group>
      {Array.from({ length: WHEEL.n }, (_, k) => (
        <group key={k} ref={(el) => (gondolas.current[k] = el)}>
          <Gondola color={PASTEL[k % PASTEL.length]} />
        </group>
      ))}
    </group>
  )
}
function Gondola({ color }) {
  return (
    <group>
      <C p={[0, 0.03, 0]} rt={0.62} h={0.06} c={color} seg={18} />
      {/* the back and sides: a half shell, open toward the view */}
      <mesh position={[0, 0.42, 0]} material={mat(color)}>
        <cylinderGeometry args={[0.62, 0.62, 0.78, 18, 1, true, Math.PI / 2, Math.PI]} />
      </mesh>
      <B p={[0, 0.42, -0.05]} s={[0.9, 0.06, 0.4]} c="#fff6ea" />
      <mesh position={[0, 0.82, 0]} scale={[1, 0.45, 1]} material={mat('#fff6ea')}>
        <sphereGeometry args={[0.66, 16, 8, 0, TAU, 0, Math.PI / 2]} />
      </mesh>
      <C p={[0, 0.98, 0]} rt={0.03} h={0.1} c="#6d5a6e" seg={6} />
      {/* a safety bar across the front */}
      <B p={[0, 0.62, 0.55]} s={[1.0, 0.04, 0.04]} c="#ffd27f" />
    </group>
  )
}

/* ───────── the carousel ───────── */

function stripedCone(radius, height, segments, colors) {
  const g = new THREE.ConeGeometry(radius, height, segments, 1, true).toNonIndexed()
  const n = g.attributes.position.count
  const col = new Float32Array(n * 3)
  const c = new THREE.Color()
  const pos = g.attributes.position
  for (let i = 0; i < n; i += 3) {
    // which wedge this triangle is in
    const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3
    const z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3
    const w = Math.floor(((Math.atan2(x, z) + Math.PI) / TAU) * segments) % colors.length
    c.set(colors[w])
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}
function Mount({ kind }) {
  // a horse, a unicorn, a swan, or a little mushroom chair
  if (kind === 2)
    return (
      <group>
        <S p={[0, 0, 0]} s={[0.26, 0.2, 0.36]} c="#fffaf6" />
        <mesh position={[0, 0.26, 0.24]} rotation={[0.5, 0, 0]} material={mat('#fffaf6')}>
          <torusGeometry args={[0.16, 0.05, 6, 12, Math.PI]} />
        </mesh>
        <S p={[0, 0.3, 0.42]} s={0.07} c="#fffaf6" />
        <mesh position={[0, 0.29, 0.5]} rotation={[Math.PI / 2, 0, 0]} material={mat('#ffb347')}>
          <coneGeometry args={[0.025, 0.08, 6]} />
        </mesh>
        <S p={[0, 0.05, -0.3]} s={[0.18, 0.12, 0.08]} c="#ffd6ea" />
      </group>
    )
  if (kind === 3)
    return (
      <group>
        <C p={[0, -0.05, 0]} rt={0.12} rb={0.16} h={0.2} c="#fff6ea" />
        <mesh position={[0, 0.06, 0]} scale={[1, 0.5, 1]} material={mat('#e8566f')}>
          <sphereGeometry args={[0.3, 14, 8, 0, TAU, 0, Math.PI / 2]} />
        </mesh>
      </group>
    )
  const body = kind === 1 ? '#fffaf6' : '#ffd6ea'
  const mane = kind === 1 ? '#c9b6f4' : '#e8798f'
  return (
    <group>
      <S p={[0, 0, 0]} s={[0.17, 0.17, 0.38]} c={body} />
      <mesh position={[0, 0.2, 0.32]} rotation={[0.6, 0, 0]} material={mat(body)}>
        <cylinderGeometry args={[0.07, 0.09, 0.3, 8]} />
      </mesh>
      <S p={[0, 0.34, 0.44]} s={[0.08, 0.08, 0.14]} c={body} />
      <S p={[0, 0.3, 0.3]} s={[0.04, 0.12, 0.1]} c={mane} />
      {kind === 1 && (
        <mesh position={[0, 0.47, 0.5]} rotation={[0.5, 0, 0]} material={mat('#ffd27f', 0.4)}>
          <coneGeometry args={[0.025, 0.16, 6]} />
        </mesh>
      )}
      {[-0.08, 0.08].flatMap((x) =>
        [-0.22, 0.22].map((z) => (
          <C key={x + ':' + z} p={[x, -0.2, z]} rt={0.025} h={0.24} c={body} seg={5} r={[z > 0 ? -0.5 : 0.4, 0, 0]} />
        )),
      )}
      <S p={[0, 0.1, -0.38]} s={[0.04, 0.1, 0.06]} c={mane} />
      <B p={[0, 0.17, -0.02]} s={[0.24, 0.04, 0.2]} c="#ffd27f" />
    </group>
  )
}
function Carousel() {
  const level = Y()
  const turning = useRef()
  const mounts = useRef([])
  const canopy = useMemo(() => stripedCone(CAROUSEL.r + 0.35, 1.3, 16, ['#ff8fbf', '#fff6ea', '#c9b6f4', '#fff6ea']), [])
  useEffect(() => () => canopy.dispose(), [canopy])
  const canopyMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }), [])
  const bulbs = useMemo(() => Array.from({ length: 32 }, (_, i) => [Math.sin((i / 32) * TAU) * (CAROUSEL.r + 0.3), 3.05, Math.cos((i / 32) * TAU) * (CAROUSEL.r + 0.3)]), [])
  const tune = useRef({ next: 0, i: 0 })
  useFrame(() => {
    const p = {}
    mountPose(0, undefined, p)
    if (turning.current) turning.current.rotation.y = p.angle
    mounts.current.forEach((g, m) => {
      if (!g) return
      mountPose(m, undefined, p)
      g.position.y = 0.97 + p.bob
    })
    // a little music-box tune while it turns (only when she's close)
    const st = spinnerState('carousel')
    const near = Math.hypot(player.position.x - CAROUSEL.x, player.position.z - CAROUSEL.z) < 11
    const t = performance.now()
    if (st.phase === 'spin' && near && t > tune.current.next) {
      const SONG = [0, 2, 4, 2, 3, 1, 4, 0, 2, 3, 4, 3, 2, 1, 0, 1]
      audio.sfx('note', SONG[tune.current.i++ % SONG.length])
      tune.current.next = t + 420
    }
  })
  return (
    <group position={[CAROUSEL.x, level, CAROUSEL.z]}>
      <C p={[0, 0.06, 0]} rt={CAROUSEL.r + 0.12} h={0.12} c="#c8915f" seg={36} />
      <group ref={turning}>
        <C p={[0, 0.25, 0]} rt={CAROUSEL.r} h={0.2} c="#fff6ea" seg={36} />
        {Array.from({ length: 12 }, (_, i) => (
          <mesh key={i} position={[Math.sin((i / 12) * TAU) * (CAROUSEL.r - 0.3), 0.36, Math.cos((i / 12) * TAU) * (CAROUSEL.r - 0.3)]} rotation={[-Math.PI / 2, 0, 0]} material={mat(i % 2 ? '#ffd6ea' : '#d9c6ff')}>
            <circleGeometry args={[0.18, 12]} />
          </mesh>
        ))}
        {/* the middle column (with mirrors), the canopy, its bulbs */}
        <C p={[0, 1.7, 0]} rt={0.5} h={2.7} c="#c9a5e8" seg={16} />
        {Array.from({ length: 8 }, (_, i) => (
          <B key={i} p={[Math.sin((i / 8) * TAU) * 0.5, 1.7, Math.cos((i / 8) * TAU) * 0.5]} s={[0.22, 0.5, 0.02]} c="#eaf6ff" glow={0.3} r={[0, (i / 8) * TAU, 0]} />
        ))}
        <mesh geometry={canopy} material={canopyMat} position={[0, 3.7, 0]} />
        <C p={[0, 3.05, 0]} rt={CAROUSEL.r + 0.35} h={0.2} c="#ffd27f" seg={36} />
        <mesh position={[0, 4.55, 0]} material={mat('#ffd27f', 0.7)}>
          <octahedronGeometry args={[0.24, 0]} />
        </mesh>
        <Bulbs points={bulbs} colors={['#ffe2a8', '#ffd6ea', '#d9c6ff']} speed={2} />
        {Array.from({ length: CAROUSEL.n }, (_, m) => {
          const a = (m / CAROUSEL.n) * TAU
          return (
            <group key={m} position={[Math.sin(a) * CAROUSEL.mountR, 0, Math.cos(a) * CAROUSEL.mountR]} rotation={[0, a + Math.PI / 2, 0]}>
              <C p={[0, 1.65, 0]} rt={0.025} h={2.7} c="#ffd27f" seg={6} />
              <group ref={(el) => (mounts.current[m] = el)} position={[0, 0.97, 0]}>
                <Mount kind={m % 4} />
              </group>
            </group>
          )
        })}
      </group>
      <SignBoard lines={['Komidi Putar']} w={1.2} h={0.32} position={[0, 0.75, CAROUSEL.r + 0.7]} />
    </group>
  )
}

/* ───────── the teacups ───────── */

function teacupGeometry() {
  const pts = []
  for (let i = 0; i <= 12; i++) {
    const t = i / 12
    pts.push(new THREE.Vector2(0.38 + Math.sin(t * Math.PI * 0.5) * 0.26 + t * t * 0.02, t * 0.62))
  }
  return new THREE.LatheGeometry(pts, 28)
}
function Teacups() {
  const level = Y()
  const platform = useRef()
  const cups = useRef([])
  const cupGeo = useMemo(teacupGeometry, [])
  useEffect(() => () => cupGeo.dispose(), [cupGeo])
  const cupMats = useMemo(() => ['#ffb3cf', '#b9e8ff', '#ffe2a8', '#c9b6f4'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, side: THREE.DoubleSide })), [])
  useEffect(() => () => cupMats.forEach((m) => m.dispose()), [cupMats])
  useFrame(() => {
    const p = {}
    cups.current.forEach((g, c) => {
      if (!g) return
      cupPose(c, undefined, p)
      g.position.set(p.x, p.y, p.z)
      g.rotation.y = p.spin
      if (c === 0 && platform.current) platform.current.rotation.y = p.platform
    })
  })
  return (
    <group>
      <group position={[TEACUPS.x, level, TEACUPS.z]}>
        <C p={[0, 0.06, 0]} rt={TEACUPS.r + 0.1} h={0.12} c="#c8915f" seg={36} />
        <group ref={platform}>
          <C p={[0, 0.17, 0]} rt={TEACUPS.r} h={0.1} c="#e9dff0" seg={36} />
          {Array.from({ length: 8 }, (_, i) => (
            <B key={i} p={[0, 0.225, 0]} s={[0.12, 0.01, TEACUPS.r * 2 - 0.2]} c="#fff6ea" r={[0, (i / 8) * Math.PI, 0]} />
          ))}
          {/* the big teapot in the middle */}
          <S p={[0, 0.75, 0]} s={[0.62, 0.52, 0.62]} c="#fff6ea" />
          <mesh position={[0.62, 0.86, 0]} rotation={[0, 0, -0.9]} material={mat('#fff6ea')}>
            <cylinderGeometry args={[0.06, 0.12, 0.6, 8]} />
          </mesh>
          <mesh position={[-0.62, 0.8, 0]} rotation={[0, 0, 0]} material={mat('#ff8fbf')}>
            <torusGeometry args={[0.2, 0.05, 6, 14, Math.PI * 1.2]} />
          </mesh>
          <S p={[0, 1.28, 0]} s={[0.3, 0.12, 0.3]} c="#ff8fbf" />
          <S p={[0, 1.42, 0]} s={0.08} c="#ffd27f" />
        </group>
        <SignBoard lines={['Cangkir Ajaib']} w={1.2} h={0.32} position={[TEACUPS.r + 0.6, 0.75, 0]} rotation={[0, Math.PI / 2, 0]} />
      </group>
      {Array.from({ length: TEACUPS.n }, (_, c) => (
        <group key={c} ref={(el) => (cups.current[c] = el)}>
          <C p={[0, -0.04, 0]} rt={0.78} h={0.06} c="#fff6ea" seg={24} />
          <mesh geometry={cupGeo} material={cupMats[c]} />
          <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} material={cupMats[c]}>
            <circleGeometry args={[0.38, 24]} />
          </mesh>
          <mesh position={[0.66, 0.34, 0]} material={cupMats[c]}>
            <torusGeometry args={[0.15, 0.04, 6, 14]} />
          </mesh>
          {/* the bench round the inside, and the little wheel in the middle */}
          <mesh position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]} material={mat('#fff6ea')}>
            <torusGeometry args={[0.36, 0.08, 6, 20]} />
          </mesh>
          <C p={[0, 0.3, 0]} rt={0.03} h={0.4} c="#c9c3d2" />
          <mesh position={[0, 0.52, 0]} rotation={[Math.PI / 2, 0, 0]} material={mat('#ffd27f')}>
            <torusGeometry args={[0.13, 0.02, 6, 16]} />
          </mesh>
          {Array.from({ length: 6 }, (_, i) => (
            <S key={i} p={[Math.sin((i / 6) * TAU) * 0.62, 0.38, Math.cos((i / 6) * TAU) * 0.62]} s={[0.05, 0.05, 0.02]} c="#ffffff" />
          ))}
        </group>
      ))}
    </group>
  )
}

/* ───────── bumper cars ───────── */

function BumperCarModel({ color, driver }) {
  return (
    <group>
      <mesh position={[0, 0.22, 0]} rotation={[Math.PI / 2, 0, 0]} material={mat('#3b3560')}>
        <torusGeometry args={[BUMPER.car - 0.06, 0.09, 8, 22]} />
      </mesh>
      <mesh position={[0, 0.26, 0]} scale={[0.85, 0.42, 1]} material={mat(color, 0, 0.35)}>
        <sphereGeometry args={[0.5, 18, 12]} />
      </mesh>
      <B p={[0, 0.45, -0.12]} s={[0.46, 0.08, 0.4]} c="#fff6ea" />
      <B p={[0, 0.62, -0.32]} s={[0.46, 0.36, 0.08]} c={color} />
      <C p={[0, 0.58, 0.22]} rt={0.02} h={0.22} c="#6d5a6e" r={[0.6, 0, 0]} />
      <mesh position={[0, 0.68, 0.28]} rotation={[0.9, 0, 0]} material={mat('#ffd27f')}>
        <torusGeometry args={[0.1, 0.018, 6, 14]} />
      </mesh>
      <C p={[0, 1.4, -0.38]} rt={0.015} h={1.6} c="#c9c3d2" seg={5} />
      <S p={[0, 2.2, -0.38]} s={0.05} c="#fff1b8" glow={1.6} />
      {driver && (
        <group position={[0, 0.17, -0.12]} scale={0.8}>
          <Gnome look={driver} pose={() => DRIVING} />
        </group>
      )}
    </group>
  )
}
const DRIVING = { mode: 'sit' }
const GNOME_DRIVERS = [
  { skin: '#ffd9c4', nose: '#ffae9c', pants: '#6d5a6e', shirt: '#79c27c', apron: '#fff6ea', apronDark: '#5f8f86', hat: '#e8566f', band: '#ffd27f', beard: '#fffaf6', hair: '#fffaf6' },
  { skin: '#ffe0cc', nose: '#ffb8a6', pants: '#7a6a8e', shirt: '#ffb347', apron: '#ffe0ec', apronDark: '#9a6b4a', hat: '#5fb3a8', band: '#fff4e4', beard: null, hair: '#c8794e' },
]
function Bumpers() {
  const level = Y()
  const gnomes = [useRef(), useRef()]
  const mine = useRef()
  const theirs = useRef()
  const stars = useRef()
  useFrame(() => {
    gnomes.forEach((ref, i) => {
      if (!ref.current) return
      const g = gnomeCar(i)
      ref.current.position.set(g.x, level + 0.12, g.z)
      ref.current.rotation.y = g.yaw
    })
    if (mine.current) {
      const on = player.ride?.kind === 'bumper'
      mine.current.visible = on
      if (on) {
        mine.current.position.set(car.x, level + 0.12, car.z)
        mine.current.rotation.set(0, car.yaw, Math.sin(performance.now() / 45) * car.wobble * 0.12)
      }
    }
    if (theirs.current) {
      const r = mateRide()
      const on = r?.kind === 'bumper' && partner.shown.ok
      theirs.current.visible = on
      if (on) {
        theirs.current.position.set(partner.shown.x, level + 0.12, partner.shown.z)
        theirs.current.rotation.y = partner.shown.yaw
      }
    }
    // bump stars: a little ring of them, fading
    if (stars.current) {
      const now = performance.now()
      stars.current.children.forEach((m, i) => {
        const b = bumps[bumps.length - 1 - Math.floor(i / 6)]
        const k = b ? (now - b.t) / 700 : 1
        m.visible = Boolean(b) && k < 1
        if (m.visible) {
          const a = (i % 6) * (TAU / 6) + k * 2
          m.position.set(b.x + Math.cos(a) * (0.2 + k * 0.5), level + 0.9 + k * 0.5, b.z + Math.sin(a) * (0.2 + k * 0.5))
          m.scale.setScalar(0.06 * (1 - k) + 0.001)
        }
      })
    }
  })
  const { x0, x1, z0, z1 } = BUMPER
  const lights = useMemo(() => {
    const pts = []
    for (const [a, b] of [
      [[x0, 2.6, z0], [x1, 2.6, z0]],
      [[x1, 2.6, z0], [x1, 2.6, z1]],
      [[x1, 2.6, z1], [x0, 2.6, z1]],
      [[x0, 2.6, z1], [x0, 2.6, z0]],
    ])
      pts.push(...sag([a[0], level + a[1], a[2]], [b[0], level + b[1], b[2]], 14, 0.25).slice(1))
    return pts
  }, [x0, x1, z0, z1, level])
  return (
    <group>
      <B p={[(x0 + x1) / 2, level + 0.06, (z0 + z1) / 2]} s={[x1 - x0, 0.12, z1 - z0]} c="#5d4f7a" />
      {/* padded walls all round */}
      {[
        [(x0 + x1) / 2, z0, x1 - x0, 0],
        [(x0 + x1) / 2, z1, x1 - x0, 0],
        [x0, (z0 + z1) / 2, z1 - z0, 1],
        [x1, (z0 + z1) / 2, z1 - z0, 1],
      ].map(([x, z, l, along], i) => (
        <group key={i}>
          <B p={[x, level + 0.32, z]} s={along ? [0.3, 0.4, l] : [l, 0.4, 0.3]} c="#ffd27f" />
          <B p={[x, level + 0.54, z]} s={along ? [0.32, 0.06, l] : [l, 0.06, 0.32]} c="#e8566f" />
        </group>
      ))}
      {[
        [x0, z0],
        [x1, z0],
        [x0, z1],
        [x1, z1],
      ].map(([x, z]) => (
        <C key={x + ':' + z} p={[x, level + 1.35, z]} rt={0.06} h={2.7} c="#fff6ea" seg={8} />
      ))}
      <Bulbs points={lights} colors={['#ffe2a8', '#ffd6ea', '#b9e8ff']} speed={2.6} />
      <SignBoard lines={['Bom-bom Car', 'pegang setir, tabrak gnome!']} w={1.6} h={0.42} position={[BUMPER.gate[0], level + 1.2, z1 + 0.25]} />
      {gnomes.map((ref, i) => (
        <group key={i} ref={ref}>
          <BumperCarModel color={i ? '#5fb3a8' : '#ffb347'} driver={GNOME_DRIVERS[i]} />
        </group>
      ))}
      <group ref={mine} visible={false}>
        <BumperCarModel color="#ff8fbf" />
      </group>
      <group ref={theirs} visible={false}>
        <BumperCarModel color="#c9a5e8" />
      </group>
      <group ref={stars}>
        {Array.from({ length: 12 }, (_, i) => (
          <mesh key={i} material={mat('#fff1a8', 1.6)} visible={false}>
            <octahedronGeometry args={[1, 0]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/* ───────── the booths, the kiosk, the stage, the photo spot ───────── */

function Booth({ b }) {
  const level = Y()
  const best = useScores((s) => s.best[b.id])
  const mateId = useCouple((s) => s.mate?.id)
  const [live, setLive] = useState(null)
  const props = useRef()
  useFrame(({ clock }) => {
    // what the other person is playing here right now (from their character)
    const g = partner.online ? partner.game : null
    const text = g?.kind === b.id && Date.now() - (g.at || 0) < 60000 ? `${nameOf(mateId)} ${g.state === 'done' ? 'dapat' : 'sedang main:'} ${g.n ?? 0} poin` : null
    if (text !== live) setLive(text)
    // the shooting gallery's targets glide even when nobody plays
    if (b.id === 'shooting' && props.current)
      props.current.children.forEach((m, i) => {
        const row = Math.floor(i / 3)
        m.position.x = ((((i % 3) * 0.8 + clock.elapsedTime * (row % 2 ? -0.4 : 0.3)) % 2.4) + 2.4) % 2.4 - 1.2
      })
  })
  const [sx, sz] = boothSpot(b)
  const position = useMemo(() => new THREE.Vector3(sx, level, sz), [sx, sz, level])
  const g = GAMES[b.id]
  useInteractable('carnival-booth:' + b.id, {
    position,
    radius: 1.6,
    priority: 0.4,
    enabled: () => !player.act && !player.ride,
    label: `Main ${g.title} ${g.icon}`,
    onInteract: () => {
      audio.sparkle()
      openGame(b.id)
    },
  })
  const stripe = { ringtoss: '#ff8fbf', cans: '#5fb3a8', shooting: '#c9a5e8' }[b.id]
  return (
    <group position={[b.x, level, b.z]}>
      {/* the tent: striped walls, an open front with a counter, a pointed roof */}
      {Array.from({ length: 6 }, (_, i) => (
        <B key={i} p={[-BOOTH_HALF + (i + 0.5) * ((BOOTH_HALF * 2) / 6), 1.1, -1.05]} s={[(BOOTH_HALF * 2) / 6, 2.2, 0.06]} c={i % 2 ? '#fff6ea' : stripe} />
      ))}
      {[-1, 1].map((k) => (
        <B key={k} p={[k * BOOTH_HALF, 1.1, 0]} s={[0.06, 2.2, 2.1]} c={stripe} />
      ))}
      <B p={[0, 0.5, 0.95]} s={[BOOTH_HALF * 2, 1.0, 0.3]} c="#c8915f" />
      <B p={[0, 1.02, 0.95]} s={[BOOTH_HALF * 2 + 0.06, 0.05, 0.36]} c="#fff6ea" />
      <mesh position={[0, 2.6, 0]} rotation={[0, Math.PI / 4, 0]} scale={[BOOTH_HALF * 1.0, 0.6, 1.05]} material={mat(stripe)}>
        <coneGeometry args={[1.45, 1.1, 4]} />
      </mesh>
      {/* scalloped valance */}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[-BOOTH_HALF + 0.19 + i * 0.37, 2.12, 1.08]} rotation={[0, 0, Math.PI]} material={mat(i % 2 ? '#fff6ea' : stripe)}>
          <coneGeometry args={[0.19, 0.24, 3]} />
        </mesh>
      ))}
      <SignBoard lines={[g.title, `hadiah: ${g.prizeName}`]} w={1.9} h={0.5} position={[0, 2.45, 1.12]} colors={{ edge: stripe }} />
      {/* prizes along the back */}
      {[-1, -0.35, 0.35, 1].map((x, i) => (
        <group key={x} position={[x, 1.7, -0.9]}>
          <S p={[0, 0, 0]} s={[0.13, 0.14, 0.1]} c={PASTEL[i]} />
          <S p={[0, 0.17, 0]} s={0.08} c="#ffd9c4" />
          <mesh position={[0, 0.3, 0]} material={mat('#e8566f')}>
            <coneGeometry args={[0.08, 0.18, 8]} />
          </mesh>
        </group>
      ))}
      {/* the game itself, at the back of the booth */}
      {b.id === 'ringtoss' && (
        <group position={[0, 0.85, -0.3]}>
          <B p={[0, 0, 0]} s={[1.6, 0.06, 0.9]} c="#a5714a" />
          {[-0.5, 0, 0.5].flatMap((x) =>
            [-0.25, 0.1].map((z) => (
              <group key={x + ':' + z} position={[x, 0.03, z]}>
                <C p={[0, 0.12, 0]} rt={0.05} rb={0.06} h={0.24} c="#8fe3b0" />
                <C p={[0, 0.3, 0]} rt={0.02} h={0.14} c="#8fe3b0" />
              </group>
            )),
          )}
        </group>
      )}
      {b.id === 'cans' && (
        <group position={[0, 0.9, -0.4]}>
          <B p={[0, 0, 0]} s={[1.2, 0.06, 0.5]} c="#a5714a" />
          {[
            [-0.25, 0],
            [0, 0],
            [0.25, 0],
            [-0.125, 1],
            [0.125, 1],
            [0, 2],
          ].map(([x, row], i) => (
            <C key={i} p={[x, 0.17 + row * 0.28, 0]} rt={0.1} h={0.27} c={['#e8566f', '#ffd27f', '#5fb3a8'][i % 3]} />
          ))}
        </group>
      )}
      {b.id === 'shooting' && (
        <group ref={props} position={[0, 0, -0.75]}>
          {Array.from({ length: 9 }, (_, i) => {
            const row = Math.floor(i / 3)
            return (
              <mesh key={i} position={[0, 1.15 + row * 0.35, 0]} material={mat(['#e8566f', '#ffd27f', '#fff1b8'][row], row === 2 ? 0.5 : 0)}>
                {row === 2 ? <octahedronGeometry args={[0.1, 0]} /> : <sphereGeometry args={[0.1, 10, 8]} />}
              </mesh>
            )
          })}
        </group>
      )}
      {/* the scoreboard: both of your best scores, and what the other person is doing now */}
      <Html position={[0, 3.35, 1.0]} center zIndexRange={[12, 0]} className="plant-anchor">
        <div className="booth-board">
          <strong>
            {g.icon} {g.title}
          </strong>
          <span>
            Kamu: {best?.mine ?? '–'} · {nameOf(mateId)}: {best?.mate ?? '–'}
          </span>
          {live && <em>{live}</em>}
        </div>
      </Html>
    </group>
  )
}

function Kiosk() {
  const level = Y()
  return (
    <group position={[KIOSK.x, level, KIOSK.z]}>
      <B p={[0, 0.5, 0]} s={[2.2, 1.0, 1.2]} c="#fff6ea" />
      <B p={[0, 1.02, 0.1]} s={[2.3, 0.05, 1.4]} c="#c8915f" />
      {/* cotton candy machine and a pink cloud */}
      <C p={[-0.55, 1.2, 0.1]} rt={0.24} h={0.3} c="#d9d2dd" />
      <S p={[-0.55, 1.5, 0.1]} s={[0.3, 0.22, 0.3]} c="#ffc2dd" />
      {/* jars of juice */}
      {[0.25, 0.55, 0.85].map((x, i) => (
        <C key={x} p={[x, 1.18, 0.15]} rt={0.09} h={0.28} c={['#ff8fbf', '#ffd27f', '#8fe3b0'][i]} />
      ))}
      {[-1.05, 1.05].map((x) => (
        <C key={x} p={[x, 1.6, 0.55]} rt={0.04} h={1.2} c="#fff6ea" seg={6} />
      ))}
      {Array.from({ length: 7 }, (_, i) => (
        <B key={i} p={[-1.05 + (i + 0.5) * 0.3, 2.22, 0.15]} s={[0.3, 0.05, 1.35]} c={i % 2 ? '#fff6ea' : '#ff8fbf'} r={[0.18, 0, 0]} />
      ))}
      <SignBoard lines={['Jajanan Manis', 'permen kapas · jus']} w={1.5} h={0.4} position={[0, 0.55, 0.62]} colors={{ edge: '#ff8fbf' }} />
    </group>
  )
}

function Stage() {
  const level = Y()
  return (
    <group position={[STAGE.x, level, STAGE.z]}>
      <C p={[0, 0.15, 0]} rt={STAGE.r} h={0.3} c="#c9a5e8" seg={24} />
      <C p={[0, 0.31, 0]} rt={STAGE.r - 0.05} h={0.02} c="#fff6ea" seg={24} />
      <C p={[-0.55, 1.1, -0.4]} rt={0.03} h={1.6} c="#fff6ea" seg={6} />
      <mesh position={[-0.55, 1.9, -0.4]} rotation={[0, 0, -1.2]} material={mat('#ffd27f')}>
        <coneGeometry args={[0.16, 0.35, 10, 1, true]} />
      </mesh>
    </group>
  )
}

function PhotoSpot() {
  const level = Y()
  const flash = useRef()
  const flashAt = useRef(-10)
  const heart = useMemo(() => heartGeometry(), [])
  const position = useMemo(() => new THREE.Vector3(PHOTO.x, level, PHOTO.z + 1.0), [level])
  useInteractable('carnival-photo', {
    position,
    radius: 1.5,
    priority: 0.35,
    enabled: () => !player.ride && !player.act,
    label: 'Pose foto berdua 📸',
    onInteract: () => {
      const me = onPhotoMark(player.position.x, player.position.z)
      const them = partner.online && partner.shown.ok ? onPhotoMark(partner.shown.x, partner.shown.z) : -1
      emote('photo')
      photoPose(me >= 0 && them >= 0 && me !== them)
      flashAt.current = performance.now()
      audio.sfx('pop', 3)
    },
  })
  useFrame(() => {
    const k = (performance.now() - flashAt.current) / 450
    if (flash.current) {
      flash.current.visible = k < 1
      flash.current.material.opacity = 0.7 * (1 - k)
    }
  })
  return (
    <group position={[PHOTO.x, level, PHOTO.z]}>
      {/* a heart-shaped arch on two posts, with the fair's name */}
      {[-1.1, 1.1].map((x) => (
        <C key={x} p={[x, 1.0, 0]} rt={0.06} h={2.0} c="#fff6ea" seg={8} />
      ))}
      <mesh geometry={heart} position={[0, 2.25, 0]} scale={0.55} material={mat('#ff8fbf', 0.3, 0.4)} />
      <SignBoard lines={['Dreamlight Funfair ♡']} w={1.8} h={0.3} position={[0, 1.65, 0.04]} colors={{ edge: '#ff8fbf' }} />
      {PHOTO.marks.map(([mx2, mz]) => (
        <mesh key={mx2} position={[mx2 - PHOTO.x, 0.016, mz - PHOTO.z]} rotation={[-Math.PI / 2, 0, 0]} material={mat('#ffd6ea', 0.2)}>
          <ringGeometry args={[0.24, 0.32, 24]} />
        </mesh>
      ))}
      <mesh ref={flash} position={[0, 1.3, 2.2]} visible={false}>
        <planeGeometry args={[4, 3]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

function Benches() {
  return BENCHES.map((b) => <Bench key={b.id} b={b} />)
}
function Bench({ b }) {
  const level = Y()
  const [ex, ez] = [b.x + Math.sin(b.yaw) * 0.6, b.z + Math.cos(b.yaw) * 0.6]
  useSeat(b.id, { x: b.x, z: b.z, y: level + 0.45, yaw: b.yaw, exit: [ex, ez], group: b.id, label: 'Duduk', enabled: () => !player.ride })
  return (
    <group position={[b.x, level, b.z]} rotation={[0, b.yaw, 0]}>
      <B p={[0, 0.42, 0]} s={[1.1, 0.06, 0.4]} c="#c8915f" />
      <B p={[0, 0.7, -0.18]} s={[1.1, 0.32, 0.05]} c="#ff8fbf" />
      {[-0.45, 0.45].map((x) => (
        <B key={x} p={[x, 0.2, 0]} s={[0.07, 0.4, 0.34]} c="#6d5a6e" />
      ))}
    </group>
  )
}

/** Lamp posts, giant toadstools, strings of lights and bunting over the walks. */
function Decorations() {
  const level = Y()
  const strings = useMemo(() => {
    const pts = []
    for (let i = 0; i < LAMPS.length - 1; i++) {
      const [ax, az] = LAMPS[i]
      const [bx, bz] = LAMPS[i + 1]
      if (Math.hypot(bx - ax, bz - az) > 7) continue
      pts.push(...sag([ax, level + 2.25, az], [bx, level + 2.25, bz], 10, 0.4).slice(1, -1))
    }
    return pts
  }, [level])
  const flags = useRef()
  const flagList = useMemo(() => {
    const list = []
    for (let i = 0; i < strings.length; i += 2) {
      const [x, y, z] = strings[i]
      list.push(mx(x, y - 0.12, z, 0.09, 0.16, 0.09, i * 0.7, Math.PI))
    }
    return list
  }, [strings])
  const flagCols = useMemo(() => flagList.map((_, i) => PASTEL[i % PASTEL.length]), [flagList])
  useInstances(flags, flagList, flagCols)
  const flagMat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.7, side: THREE.DoubleSide }), [])
  return (
    <group>
      {LAMPS.map(([x, z], i) => (
        <group key={i} position={[x, level, z]}>
          <C p={[0, 1.15, 0]} rt={0.04} rb={0.06} h={2.3} c="#6d5a6e" seg={8} />
          <S p={[0, 2.35, 0]} s={0.12} c="#ffe2a8" glow={0.9} />
          <mesh position={[0, 2.47, 0]} scale={[1, 0.5, 1]} material={mat(PASTEL[i % PASTEL.length])}>
            <sphereGeometry args={[0.17, 12, 8, 0, TAU, 0, Math.PI / 2]} />
          </mesh>
        </group>
      ))}
      <Bulbs points={strings} colors={['#ffe2a8', '#ffd6ea', '#d9c6ff', '#b9e8ff']} speed={1.6} />
      <instancedMesh ref={flags} args={[null, flagMat, flagList.length]}>
        <coneGeometry args={[1, 1, 3]} />
      </instancedMesh>
      {TOADSTOOLS.map(([x, z, s, c], i) => (
        <group key={i} position={[x, level, z]} scale={s}>
          <C p={[0, 0.55, 0]} rt={0.18} rb={0.26} h={1.1} c="#fff6ea" />
          <mesh position={[0, 1.08, 0]} scale={[1, 0.55, 1]} material={mat(c)}>
            <sphereGeometry args={[0.75, 18, 10, 0, TAU, 0, Math.PI / 2]} />
          </mesh>
          {[0, 1.3, 2.6, 3.9, 5.2].map((a) => (
            <S key={a} p={[Math.cos(a) * 0.45, 1.32, Math.sin(a) * 0.45]} s={[0.1, 0.035, 0.1]} c="#ffffff" />
          ))}
        </group>
      ))}
    </group>
  )
}

/* ───────── the rides' entrances, and getting off ───────── */

function Entrance({ kind, at }) {
  const level = Y()
  const position = useMemo(() => new THREE.Vector3(at[0], level, at[1]), [at, level])
  useInteractable('carnival-enter:' + kind, {
    position,
    radius: 1.5,
    priority: 0.45,
    enabled: () => !player.ride && !player.act && !player.seat,
    label: () => `Naik ${rideName(kind)} ✨`,
    onInteract: () => board(kind),
  })
  return null
}
/** While she's on a ride: the interact key gets her off (when the ride is standing still). */
function RideExit() {
  const position = useMemo(() => new THREE.Vector3(), [])
  useInteractable('carnival-ride', {
    get position() {
      return position.copy(player.position)
    },
    radius: 99,
    enabled: () => Boolean(player.ride) && canGetOff(),
    label: () => (player.ride?.kind === 'bumper' ? 'Keluar dari bom-bom car' : `Turun dari ${rideName(player.ride?.kind)}`),
    onInteract: () => getOff(),
  })
  return null
}

/* ───────── the gnomes ───────── */

const SEATED_MODES = new Set(['sit', 'sleep'])
function CrewGnome({ id }) {
  const g = CREW[id]
  const group = useRef()
  const pose = useRef({ mode: 'idle' })
  const world = useMemo(() => new THREE.Vector3(), [])
  const [line, setLine] = useState(null)
  const level = Y()
  useInteractable('carnival-gnome:' + id, {
    get position() {
      const p = group.current?.position
      return world.set(p?.x ?? 0, level, p?.z ?? 0)
    },
    radius: 1.5,
    priority: 0.3,
    enabled: () => !player.ride && !player.act && useStore.getState().view === 'explore',
    label: `Ngobrol dengan ${g.name}`,
    onInteract: () => {
      audio.sparkle()
      const { text, options } = crewTalk(id)
      const p = group.current.position
      say({ npc: 'carnival:' + id, name: g.name, role: g.role, text, options, at: [p.x, p.z] })
    },
  })
  useFrame(() => {
    const at = crewAt(id)
    const gr = group.current
    if (!gr) return
    const talking = useVillage.getState().talk?.npc === 'carnival:' + id
    let yaw = at.yaw
    let mode = at.walking ? 'walk' : 'idle'
    // their work, when they're at their post
    if (!at.walking) {
      if (id === 'roda') {
        const st = coasterState()
        mode = st.phase === 'board' && st.left < 2 ? 'arrange' : st.phase === 'ride' ? 'wave' : 'idle'
      } else if (id === 'manis') mode = 'brew'
      else if (id === 'toto') mode = 'talk'
      else if (id === 'pita') mode = Math.hypot(player.position.x - at.x, player.position.z - at.z) < 4 ? 'wave' : 'idle'
      else if (['tara', 'bumbum', 'jepret'].includes(id)) {
        const game = { tara: 'ringtoss', bumbum: 'cans', jepret: 'shooting' }[id]
        const playing = useStore.getState().panel === 'carnival-game' || (partner.online && partner.game?.kind === game && partner.game.state === 'playing')
        mode = playing ? 'talk' : 'idle'
      }
    }
    if (talking) {
      yaw = Math.atan2(player.position.x - gr.position.x, player.position.z - gr.position.z)
      if (!SEATED_MODES.has(mode)) mode = 'talk'
    }
    const onStage = id === 'toto' && Math.hypot(at.x - STAGE.x, at.z - STAGE.z) < STAGE.r
    gr.position.set(at.x, level + (onStage ? 0.32 : 0), at.z)
    let dy = yaw - gr.rotation.y
    dy = Math.atan2(Math.sin(dy), Math.cos(dy))
    gr.rotation.y += dy * 0.15
    pose.current = { mode, tool: id === 'roda' && mode === 'arrange' ? null : undefined }
    // Toto's announcements (the same words on both screens)
    if (id === 'toto') {
      const a = announcement()
      if (a !== line) setLine(a)
    }
  })
  return (
    <group ref={group}>
      <Gnome look={g.look} pose={() => pose.current} />
      {id === 'toto' && <Bubble text={line} y={1.35} />}
    </group>
  )
}

/* ───────── the fair ───────── */

export default function Carnival() {
  const view = useStore((s) => s.view)
  const near = useFair((s) => s.near)
  const root = useRef()
  useFrame(() => {
    tickCarnival()
    // the talk card closes when she walks away from a gnome of the fair
    const talk = useVillage.getState().talk
    if (talk?.at && String(talk.npc).startsWith('carnival:') && Math.hypot(player.position.x - talk.at[0], player.position.z - talk.at[1]) > 3.8) closeTalk()
  })
  const pools = useMemo(() => {
    const y = Y()
    return [...LAMPS.map(([x, z]) => ({ x, y, z })), { x: GATE.x + 1, y, z: GATE.z }, { x: CAROUSEL.x, y, z: CAROUSEL.z + 4 }]
  }, [])
  if (['finale', 'finalRoom'].includes(view)) return null
  return (
    <group ref={root} visible={near}>
      {near && (
        <>
          <Paving />
          <Fence />
          <Gate />
          <TicketBooth />
          <Coaster />
          <Wheel />
          <Carousel />
          <Teacups />
          <Bumpers />
          {BOOTHS.map((b) => (
            <Booth key={b.id} b={b} />
          ))}
          <Kiosk />
          <Stage />
          <PhotoSpot />
          <Benches />
          <Decorations />
          <Building b={OFFICE} look={{ wall: '#fff0f6', trim: '#b98aa8', roof: '#ffb347', spot: '#fff9ee', door: '#5fb3a8', plate: 'Kantor Karnaval' }} />
          {CREW_IDS.map((id) => (
            <CrewGnome key={id} id={id} />
          ))}
          <Entrance kind="coaster" at={STATION.board} />
          <Entrance kind="wheel" at={WHEEL.board} />
          <Entrance kind="carousel" at={CAROUSEL.entry} />
          <Entrance kind="teacups" at={TEACUPS.entry} />
          <Entrance kind="bumper" at={BUMPER.gate} />
          <LightPools points={pools} size={4} />
        </>
      )}
      <RideExit />
    </group>
  )
}
