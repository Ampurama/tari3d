import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  BARISTA_SPOT,
  CAFE,
  CAFE_WALL_H,
  CAFE_WALL_T,
  CAFE_WINDOWS,
  CHAIRS,
  chairOf,
  chairWorld,
  COUNTER,
  cupAt,
  DOOR_W,
  DRINKS,
  MACHINE_X,
  ORDER_SPOT,
  putCup,
  ROOM,
  TABLES,
  takeCup,
  TERRACE,
  tickCafe,
  toCafe,
  toWorld,
  cafeFloor,
  useCafe,
  WAITER_HOME,
  WAITER_SPEED,
} from '../../lib/cafe'
import { useSeat } from '../../lib/actions'
import { useInteractable } from '../../lib/interactions'
import { partner } from '../../lib/couple'
import { player } from '../../lib/player'
import { atmosphere } from '../../lib/atmosphere'
import { withPaint } from '../../lib/paint'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'
import { B, C, mat, S } from './HomeFurniture'
import { Glow, LightPools } from './Bits'
import { Bubble, Gnome } from './Gnome'
import { pipHasJob, talkTo } from '../../lib/village'

/*
 * THE LITTLE GNOME CAFÉ — the building, its inside, and the two gnomes who run it
 * (the logic — ordering, cups, walls — is in lib/cafe.js). Everything inside the group below is in
 * café-local metres: x across, z toward the front (the door), y up from the floor.
 */

const WOOD = '#c8915f'
const WOOD_DARK = '#9a6b4a'
const STONE = '#cfc6d6'
const PLASTER = '#fff3e2'
const ROOF = '#e8798f'
const ROOF_SPOT = '#fff4f0'

/* ───────── the shell ───────── */

/** A wall: pieces around its openings (the door, the windows), along its length u. */
function wallPieces(len, openings) {
  // openings: [centre, width, y0, y1]
  const out = []
  const sorted = [...openings].sort((a, b) => a[0] - b[0])
  let u = -len / 2
  for (const [c, w, y0, y1] of sorted) {
    const a = c - w / 2
    const b = c + w / 2
    if (a > u) out.push([u, a, 0, CAFE_WALL_H])
    if (y0 > 0) out.push([a, b, 0, y0])
    if (y1 < CAFE_WALL_H) out.push([a, b, y1, CAFE_WALL_H])
    u = b
  }
  if (u < len / 2) out.push([u, len / 2, 0, CAFE_WALL_H])
  return out
}

const WIN_Y = [0.9, 1.75]
const WALLS = {
  front: { pos: [0, 0, ROOM.hd], rot: 0, len: ROOM.hw * 2 + CAFE_WALL_T, sign: 1, normal: [0, 1] },
  back: { pos: [0, 0, -ROOM.hd], rot: Math.PI, len: ROOM.hw * 2 + CAFE_WALL_T, sign: -1, normal: [0, -1] },
  left: { pos: [-ROOM.hw, 0, 0], rot: -Math.PI / 2, len: ROOM.hd * 2 - CAFE_WALL_T, sign: 1, normal: [-1, 0] },
  right: { pos: [ROOM.hw, 0, 0], rot: Math.PI / 2, len: ROOM.hd * 2 - CAFE_WALL_T, sign: -1, normal: [1, 0] },
}

function Wall({ side, innerRef, glow }) {
  const w = WALLS[side]
  const openings = CAFE_WINDOWS.filter(([s]) => s === side).map(([, c, width]) => [c * w.sign, width, WIN_Y[0], WIN_Y[1]])
  if (side === 'front') openings.push([0, DOOR_W, 0, 1.85])
  const pieces = wallPieces(w.len, openings)
  return (
    <group position={w.pos} rotation={[0, w.rot, 0]}>
      <group ref={innerRef}>
        {pieces.map(([u0, u1, y0, y1], i) => (
          <B key={i} p={[(u0 + u1) / 2, (y0 + y1) / 2, 0]} s={[u1 - u0, y1 - y0, CAFE_WALL_T]} c={PLASTER} />
        ))}
        {/* timber frame: corner posts and a beam */}
        {[-w.len / 2, w.len / 2].map((u) => (
          <B key={u} p={[u, (CAFE_WALL_H + 0.03) / 2, 0]} s={[0.14, CAFE_WALL_H + 0.03, CAFE_WALL_T + 0.04]} c={WOOD_DARK} />
        ))}
        <B p={[0, CAFE_WALL_H - 0.045, 0]} s={[w.len - 0.15, 0.12, CAFE_WALL_T + 0.04]} c={WOOD_DARK} />
        {/* a stone skirt along the bottom */}
        <B p={[0, 0.16, 0]} s={[w.len + 0.04, 0.32, CAFE_WALL_T + 0.08]} c={STONE} />
        {/* the windows: frames, warm glass, flower boxes on the outside */}
        <group name="decor">
        {openings
          .filter(([, , y0]) => y0 > 0)
          .map(([u, width]) => (
            <group key={u} position={[u, (WIN_Y[0] + WIN_Y[1]) / 2, 0]}>
              {/* a frame of four bars around the glass (not a solid box over it) */}
              {[-1, 1].map((k) => (
                <group key={k}>
                  <B p={[0, k * ((WIN_Y[1] - WIN_Y[0]) / 2 + 0.03), 0]} s={[width + 0.12, 0.06, CAFE_WALL_T + 0.05]} c="#ffffff" />
                  <B p={[k * (width / 2 + 0.03), 0, 0]} s={[0.06, WIN_Y[1] - WIN_Y[0], CAFE_WALL_T + 0.05]} c="#ffffff" />
                </group>
              ))}
              <mesh>
                <boxGeometry args={[width, WIN_Y[1] - WIN_Y[0], 0.02]} />
                <meshStandardMaterial color="#ffe6b8" emissive="#ffc77a" emissiveIntensity={glow} transparent opacity={0.4} roughness={0.15} />
              </mesh>
              <B p={[0, 0, 0]} s={[0.04, WIN_Y[1] - WIN_Y[0], CAFE_WALL_T + 0.07]} c="#ffffff" />
              <group position={[0, -(WIN_Y[1] - WIN_Y[0]) / 2 - 0.1, CAFE_WALL_T / 2 + 0.1]}>
                <B p={[0, 0, 0]} s={[width + 0.1, 0.13, 0.18]} c={WOOD} />
                {[-0.35, -0.12, 0.12, 0.35].map((x, i) => (
                  <S key={x} p={[x * width, 0.11, 0]} s={0.06} c={['#ff8fbf', '#ffd27f', '#f7f2ff', '#b9a5e8'][i]} />
                ))}
              </group>
            </group>
          ))}
        {side === 'front' && <Door />}
        </group>
      </group>
    </group>
  )
}

/** The front door: it swings open when someone comes close. */
function Door() {
  const leaf = useRef()
  useFrame((_, delta) => {
    const near = (x, z) => {
      const [lx, lz] = toCafe(x, z)
      return Math.abs(lx) < 1.4 && Math.abs(lz - ROOM.hd) < 1.7
    }
    const open = near(player.position.x, player.position.z) || (partner.online && partner.shown.ok && near(partner.shown.x, partner.shown.z))
    leaf.current.rotation.y = THREE.MathUtils.damp(leaf.current.rotation.y, open ? 1.35 : 0.05, 5, delta)
  })
  return (
    <group>
      <B p={[-DOOR_W / 2 - 0.05, 0.95, 0]} s={[0.1, 1.9, CAFE_WALL_T + 0.06]} c={WOOD_DARK} />
      <B p={[DOOR_W / 2 + 0.05, 0.95, 0]} s={[0.1, 1.9, CAFE_WALL_T + 0.06]} c={WOOD_DARK} />
      <mesh position={[0, 1.88, 0]} scale={[1, 0.55, 1]} material={mat(WOOD_DARK)}>
        <torusGeometry args={[DOOR_W / 2 + 0.05, 0.06, 6, 16, Math.PI]} />
      </mesh>
      <group ref={leaf} position={[-DOOR_W / 2 + 0.03, 0, 0.02]}>
        <B p={[DOOR_W / 2 - 0.03, 0.92, 0]} s={[DOOR_W - 0.08, 1.82, 0.07]} c="#7fae8a" />
        <B p={[DOOR_W / 2 - 0.03, 1.35, 0.045]} s={[0.4, 0.34, 0.02]} c="#ffe6b8" glow={0.4} />
        <S p={[DOOR_W - 0.22, 0.95, 0.06]} s={0.035} c="#ffd27f" glow={0.3} />
      </group>
    </group>
  )
}

/** The roof: a soft, curving mushroom cap with white spots, a little chimney and a weather gnome. */
function Roof() {
  const cap = useMemo(() => {
    // a lathe: from the eaves (wide, a little turned up) curving up to a rounded peak
    const pts = []
    for (let i = 0; i <= 14; i++) {
      const t = i / 14
      const r = 1 - Math.pow(t, 1.6)
      const y = Math.sin(t * Math.PI * 0.5) * 2.1 - 0.12 * Math.sin(t * Math.PI) * (1 - t)
      pts.push(new THREE.Vector2(Math.max(0.001, r * 4.25), y))
    }
    const g = new THREE.LatheGeometry(pts, 40)
    g.scale(1, 1, (ROOM.hd + 0.7) / 4.25)
    g.scale((ROOM.hw + 0.75) / 4.25, 1, 1)
    return g
  }, [])
  const spots = useMemo(() => {
    const out = []
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4
      const t = 0.25 + ((i * 37) % 10) / 22
      const r = 1 - Math.pow(t, 1.6)
      out.push([Math.cos(a) * r * (ROOM.hw + 0.75), Math.sin(t * Math.PI * 0.5) * 2.1 + 0.02, Math.sin(a) * r * (ROOM.hd + 0.7), 0.16 + (i % 3) * 0.05])
    }
    return out
  }, [])
  const roofMat = useMemo(() => withPaint(new THREE.MeshStandardMaterial({ color: ROOF, roughness: 0.75, side: THREE.DoubleSide }), 'foliage'), [])
  useEffect(() => () => cap.dispose(), [cap])
  return (
    <group position={[0, CAFE_WALL_H - 0.02, 0]}>
      <mesh geometry={cap} material={roofMat} castShadow receiveShadow />
      {spots.map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} scale={[r, r * 0.35, r]} material={mat(ROOF_SPOT, 0, 0.7)}>
          <sphereGeometry args={[1, 12, 8]} />
        </mesh>
      ))}
      {/* the chimney, and a puff of smoke */}
      <B p={[1.4, 1.65, -0.9]} s={[0.4, 1.1, 0.4]} c={STONE} />
      <B p={[1.4, 2.24, -0.9]} s={[0.5, 0.1, 0.5]} c="#b9aecb" />
      {/* a tiny weather gnome on the peak */}
      <group position={[0, 2.12, 0]} scale={0.5}>
        <C p={[0, 0.2, 0]} rt={0.12} rb={0.18} h={0.4} c="#7fae8a" />
        <S p={[0, 0.48, 0]} s={0.13} c="#ffd7c2" />
        <mesh position={[0, 0.78, 0]} material={mat('#e8566f')}>
          <coneGeometry args={[0.15, 0.42, 10]} />
        </mesh>
      </group>
    </group>
  )
}

/** The sign: "The Little Gnome Café", painted on a board by the path (and a little one over the door). */
function useSignTexture() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 192
    const g = canvas.getContext('2d')
    g.fillStyle = '#fff6ea'
    g.fillRect(0, 0, 512, 192)
    g.strokeStyle = '#e8798f'
    g.lineWidth = 10
    g.strokeRect(10, 10, 492, 172)
    g.textAlign = 'center'
    g.fillStyle = '#9a5a6e'
    g.font = "600 34px 'Quicksand', system-ui, sans-serif"
    g.fillText('The Little', 256, 66)
    g.fillStyle = '#6b4a5e'
    g.font = "700 54px 'Cormorant Garamond', Georgia, serif"
    g.fillText('Gnome Café', 256, 124)
    g.fillStyle = '#c47a52'
    g.font = "500 24px 'Quicksand', system-ui, sans-serif"
    g.fillText('☕  kopi · cokelat · pastry  🍓', 256, 162)
    const t = new THREE.CanvasTexture(canvas)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    document.fonts?.ready.then(() => (t.needsUpdate = true))
    return t
  }, [])
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

function Sign() {
  const texture = useSignTexture()
  return (
    <group position={[-2.55, 0, TERRACE.z1 + 0.35]} rotation={[0, 0.25, 0]}>
      {[-0.62, 0.62].map((x) => (
        <B key={x} p={[x, 0.75, 0]} s={[0.09, 1.5, 0.09]} c={WOOD_DARK} />
      ))}
      <B p={[0, 1.25, -0.03]} s={[1.42, 0.56, 0.06]} c={WOOD} />
      <mesh position={[0, 1.25, 0.012]}>
        <planeGeometry args={[1.32, 0.495]} />
        <meshStandardMaterial map={texture} roughness={0.85} />
      </mesh>
      {/* a little mushroom at its foot */}
      <C p={[0.45, 0.1, 0.15]} rt={0.04} rb={0.05} h={0.2} c="#fff6ea" />
      <mesh position={[0.45, 0.22, 0.15]} scale={[1, 0.6, 1]} material={mat('#e8566f')}>
        <sphereGeometry args={[0.11, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
    </group>
  )
}

/** The terrace: a wooden deck with steps, posts and strings of lights. */
function Terrace({ glow }) {
  return (
    <group>
      <B p={[0, 0.025, (TERRACE.z0 + TERRACE.z1) / 2]} s={[TERRACE.hw * 2, 0.05, TERRACE.z1 - TERRACE.z0]} c="#d6a77a" />
      {Array.from({ length: 9 }, (_, i) => (
        <B key={i} p={[-TERRACE.hw + 0.35 + i * ((TERRACE.hw * 2 - 0.7) / 8), 0.052, (TERRACE.z0 + TERRACE.z1) / 2]} s={[0.02, 0.004, TERRACE.z1 - TERRACE.z0]} c="#c4936a" />
      ))}
      <B p={[0, 0.012, TERRACE.z1 + 0.18]} s={[1.6, 0.024, 0.36]} c="#c8915f" />
      {[-TERRACE.hw + 0.1, TERRACE.hw - 0.1].map((x) => (
        <C key={x} p={[x, 0.95, TERRACE.z1 - 0.1]} rt={0.05} h={1.8} c={WOOD_DARK} seg={8} />
      ))}
      {/* string lights from the posts to the eaves */}
      {Array.from({ length: 11 }, (_, i) => {
        const t = i / 10
        const x = -TERRACE.hw + 0.1 + t * (TERRACE.hw * 2 - 0.2)
        return <S key={i} p={[x, 1.78 - Math.sin(t * Math.PI) * 0.18, TERRACE.z1 - 0.1]} s={0.045} c={i % 2 ? '#ffd6ea' : '#ffe2a8'} glow={0.6 + glow * 1.2} />
      })}
    </group>
  )
}

/** Mushrooms, flowers and vines around the café. */
function Garden() {
  const shrooms = useMemo(() => {
    const out = []
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.3
      const x = Math.cos(a) * (ROOM.hw + 0.55 + (i % 3) * 0.2)
      const z = Math.sin(a) * (ROOM.hd + 0.5 + (i % 2) * 0.25)
      if (z > ROOM.hd - 0.2 && Math.abs(x) < TERRACE.hw + 0.3) continue // not on the terrace
      out.push([x, z, 0.12 + (i % 4) * 0.06, ['#e8566f', '#f7a8c4', '#c9b6f4', '#ffd27f'][i % 4]])
    }
    return out
  }, [])
  const vines = useMemo(() => {
    const out = []
    for (const [side, x] of [
      [-1, -ROOM.hw - 0.11],
      [1, ROOM.hw + 0.11],
    ])
      for (let k = 0; k < 9; k++) out.push([x, 0.35 + k * 0.2, -ROOM.hd + 0.4 + Math.sin(k * 1.3) * 0.25 + (side > 0 ? 0.6 : 0), 0.09 + (k % 3) * 0.03])
    return out
  }, [])
  return (
    <group>
      {shrooms.map(([x, z, h, c], i) => (
        <group key={i} position={[x, 0, z]} scale={h * 4}>
          <C p={[0, 0.06, 0]} rt={0.025} rb={0.035} h={0.12} c="#fff6ea" />
          <mesh position={[0, 0.13, 0]} scale={[1, 0.6, 1]} material={mat(c)}>
            <sphereGeometry args={[0.07, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
        </group>
      ))}
      {vines.map(([x, y, z, r], i) => (
        <group key={i}>
          <mesh position={[x, y, z]} scale={r} material={mat('#79c27c', 0, 0.9)}>
            <icosahedronGeometry args={[1, 0]} />
          </mesh>
          {i % 3 === 0 && <S p={[x + Math.sign(x) * 0.04, y + 0.05, z + 0.05]} s={0.035} c="#ffb3cf" />}
        </group>
      ))}
    </group>
  )
}

/* ───────── inside ───────── */

/** The counter, the coffee machine, the cups, the beans, the pastries and the menu board. */
function Counter({ brewing }) {
  const steam = useRef()
  useFrame(({ clock }) => {
    const g = steam.current
    g.visible = brewing
    if (!brewing) return
    g.children.forEach((m, i) => {
      const k = (clock.elapsedTime * 0.6 + i / 4) % 1
      m.position.set(MACHINE_X + Math.sin(clock.elapsedTime * 2 + i) * 0.04, 1.45 + k * 0.5, COUNTER.z - 0.08)
      m.scale.setScalar(0.04 + k * 0.07)
      m.material.opacity = 0.45 * (1 - k)
    })
  })
  const len = COUNTER.x1 - COUNTER.x0
  const cx = (COUNTER.x0 + COUNTER.x1) / 2
  return (
    <group>
      <B p={[cx, 0.5, COUNTER.z]} s={[len, 1.0, COUNTER.d]} c={WOOD} />
      <B p={[cx, 1.03, COUNTER.z]} s={[len + 0.08, 0.06, COUNTER.d + 0.08]} c="#f1e4d3" />
      {Array.from({ length: 5 }, (_, i) => (
        <B key={i} p={[COUNTER.x0 + 0.35 + i * ((len - 0.7) / 4), 0.5, COUNTER.z + COUNTER.d / 2 + 0.005]} s={[0.04, 0.9, 0.01]} c={WOOD_DARK} />
      ))}
      {/* the espresso machine */}
      <group position={[MACHINE_X, 1.06, COUNTER.z - 0.08]}>
        <B p={[0, 0.22, 0]} s={[0.46, 0.44, 0.32]} c="#e8798f" />
        <B p={[0, 0.46, 0]} s={[0.5, 0.05, 0.36]} c="#f1e4d3" />
        <B p={[0, 0.2, 0.17]} s={[0.3, 0.1, 0.04]} c="#d9d2dd" />
        <C p={[-0.08, 0.1, 0.2]} rt={0.03} h={0.05} c="#5d5363" />
        <C p={[0.08, 0.1, 0.2]} rt={0.03} h={0.05} c="#5d5363" />
        <S p={[0.15, 0.32, 0.17]} s={0.03} c="#ffe2a8" glow={0.6} />
      </group>
      <group ref={steam}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.4} depthWrite={false} />
          </mesh>
        ))}
      </group>
      {/* a cash box and a little bell */}
      <B p={[0.5, 1.13, COUNTER.z]} s={[0.26, 0.14, 0.2]} c="#a5714a" />
      <S p={[0.78, 1.1, COUNTER.z + 0.12]} s={[0.05, 0.04, 0.05]} c="#ffd27f" glow={0.2} />
      {/* the pastry case */}
      <group position={[-0.25, 1.06, COUNTER.z + 0.05]}>
        <mesh position={[0, 0.16, 0]}>
          <boxGeometry args={[0.6, 0.32, 0.36]} />
          <meshStandardMaterial color="#eaf6ff" transparent opacity={0.3} roughness={0.1} />
        </mesh>
        {[
          [-0.18, '#f7c08a'],
          [0, '#f7a8c4'],
          [0.18, '#e9c98b'],
        ].map(([x, c]) => (
          <S key={x} p={[x, 0.08, 0]} s={[0.07, 0.045, 0.06]} c={c} />
        ))}
      </group>
      {/* shelves on the back wall: cups, jars of beans */}
      {[1.35, 1.75].map((y, row) => (
        <group key={y}>
          <B p={[-0.6, y, -ROOM.hd + 0.16]} s={[2.6, 0.04, 0.24]} c={WOOD_DARK} />
          {Array.from({ length: 7 }, (_, i) => {
            const x = -1.75 + i * 0.38
            return row === 0 ? (
              <C key={i} p={[x, y + 0.07, -ROOM.hd + 0.16]} rt={0.045} rb={0.038} h={0.1} c={['#fffaf2', '#ffd6e6', '#cfeae4'][i % 3]} />
            ) : (
              <group key={i}>
                <C p={[x, y + 0.1, -ROOM.hd + 0.16]} rt={0.06} h={0.18} c="#eef7ff" />
                <C p={[x, y + 0.07, -ROOM.hd + 0.16]} rt={0.052} h={0.11} c={i % 2 ? '#6b4532' : '#8a5a3c'} />
              </group>
            )
          })}
        </group>
      ))}
    </group>
  )
}

/** The menu board on the back wall. */
function MenuBoard() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 320
    const g = canvas.getContext('2d')
    g.fillStyle = '#4b5a50'
    g.fillRect(0, 0, 256, 320)
    g.strokeStyle = '#c8915f'
    g.lineWidth = 12
    g.strokeRect(6, 6, 244, 308)
    g.fillStyle = '#fff6ea'
    g.textAlign = 'center'
    g.font = "700 30px 'Cormorant Garamond', Georgia, serif"
    g.fillText('Menu', 128, 48)
    g.font = "500 19px 'Quicksand', system-ui, sans-serif"
    g.textAlign = 'left'
    Object.values(DRINKS).forEach((d, i) => g.fillText(`${d.icon} ${d.label}`, 26, 92 + i * 36))
    const t = new THREE.CanvasTexture(canvas)
    t.colorSpace = THREE.SRGBColorSpace
    document.fonts?.ready.then(() => (t.needsUpdate = true))
    return t
  }, [])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <mesh position={[1.75, 1.45, -ROOM.hd + CAFE_WALL_T / 2 + 0.02]}>
      <planeGeometry args={[0.8, 1.0]} />
      <meshStandardMaterial map={texture} roughness={0.9} />
    </mesh>
  )
}

/** A round table and its two chairs (sitting works through lib/actions.js, like every seat). */
function Table({ t }) {
  return (
    <group>
      <group position={[t.x, 0, t.z]}>
        <C p={[0, 0.36, 0]} rt={0.05} h={0.72} c={WOOD_DARK} seg={8} />
        <C p={[0, 0.055, 0]} rt={0.22} h={0.04} c={WOOD_DARK} />
        <C p={[0, 0.73, 0]} rt={0.42} h={0.05} c={t.out ? '#fff6ea' : WOOD} seg={22} />
        {!t.out && <S p={[0, 0.8, 0]} s={[0.05, 0.06, 0.05]} c="#ff9cc6" />}
      </group>
      {CHAIRS.filter((c) => c.table === t.id).map((c) => (
        <Chair key={c.id} c={c} />
      ))}
    </group>
  )
}
function Chair({ c }) {
  const w = useMemo(() => chairWorld(c), [c])
  useSeat(c.id, { ...w, group: c.table, label: 'Duduk' })
  return (
    <group position={[c.x, 0, c.z]} rotation={[0, c.yaw, 0]}>
      <B p={[0, 0.43, 0]} s={[0.42, 0.05, 0.42]} c={WOOD} />
      {[
        [-0.17, -0.17],
        [0.17, -0.17],
        [-0.17, 0.17],
        [0.17, 0.17],
      ].map(([x, z], i) => (
        <B key={i} p={[x, 0.21, z]} s={[0.05, 0.42, 0.05]} c={WOOD_DARK} />
      ))}
      <B p={[0, 0.72, -0.19]} s={[0.42, 0.52, 0.05]} c={WOOD} />
      <B p={[0, 0.47, 0.01]} s={[0.34, 0.04, 0.34]} c="#ffc2d9" />
    </group>
  )
}

/** A cup on a table, in front of a chair. */
function TableCup({ seat, drink }) {
  const c = chairOf(seat)
  const d = DRINKS[drink]
  if (!c || !d) return null
  return (
    <group position={[c.cup[0], 0.76, c.cup[1]]}>
      <C p={[0, 0.045, 0]} rt={0.05} rb={0.042} h={0.09} c="#fffaf2" />
      <mesh position={[0, 0.088, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mat(d.foam)}>
        <circleGeometry args={[0.045, 14]} />
      </mesh>
      <C p={[0, 0.005, 0]} rt={0.08} h={0.01} c="#fffaf2" />
    </group>
  )
}

/** A cup's place on each table: put mine down, or pick it up. */
function CupSpot({ c }) {
  const position = useMemo(() => {
    const [x, z] = toWorld(c.cup[0], c.cup[1])
    return new THREE.Vector3(x, cafeFloor() + 0.75, z)
  }, [c])
  useInteractable('cafe-cup:' + c.id, {
    position,
    radius: 0.95,
    priority: 0.35,
    enabled: () => {
      const cup = useCafe.getState().cup
      if (!cup || player.act) return false
      return (cup.where === 'hand' && !cupAt(c.id)) || (cup.where === 'table' && cup.seat === c.id && player.seat !== c.id)
    },
    label: () => (useCafe.getState().cup?.where === 'hand' ? 'Taruh cangkir di sini ☕' : 'Ambil cangkirmu ☕'),
    onInteract: () => {
      const cup = useCafe.getState().cup
      if (cup?.where === 'hand') putCup(c.id)
      else takeCup()
      audio.sparkle()
    },
  })
  return null
}

/* ───────── the gnomes ───────── */

const BARISTA_LOOK = { skin: '#ffd7c2', nose: '#ffb3a0', shirt: '#7fae8a', apron: '#fff4e4', apronDark: '#e8798f', pants: '#6d5a6e', hat: '#e8566f', band: '#ffd27f', beard: '#fffaf6', hair: '#fffaf6' }
const WAITER_LOOK = { skin: '#ffe0cc', nose: '#ffb8a6', shirt: '#c9b6f4', apron: '#ffe0ec', apronDark: '#9a6b4a', pants: '#7a6a8e', hat: '#5fb3a8', band: '#fff4e4', beard: null, hair: '#c8794e' }

const LINES = {
  welcome: ['Selamat datang di The Little Gnome Café! ☕', 'Hai! Silakan duduk, aku bawakan menunya ♡', 'Wah, tamu kesayangan datang lagi ✦'],
  waiter: ['Latte di sini pakai latte art berbentuk hati, lho ♡', 'Kalau duduk dulu, pesanannya aku antar ke meja ☕', 'Pastry stroberinya baru keluar dari oven 🍓', 'Ngopi berdua itu paling enak, ya ✦'],
}

/** Orders being made right now: mine and the other person's (the barista makes both). */
function liveOrders() {
  const out = []
  const mine = useCafe.getState().order
  if (mine) out.push({ drink: mine.drink, state: mine.state, seat: mine.seat })
  const theirs = partner.online ? partner.order : null
  if (theirs?.kind && DRINKS[theirs.kind]) out.push({ drink: theirs.kind, state: theirs.state, seat: theirs.seat || null })
  return out
}

/** Bram the barista: behind the counter, making drinks and handing them over. */
function Barista({ onBrewing }) {
  const group = useRef()
  const [say, setSay] = useState(null)
  const last = useRef(null)
  const pose = useRef({ mode: 'idle' })
  useFrame(({ clock }, delta) => {
    const orders = liveOrders()
    const brewing = orders.find((o) => o.state === 'brewing')
    const serving = orders.find((o) => o.state === 'serving')
    let x = -0.4 + Math.sin(clock.elapsedTime * 0.25) * 0.9
    let mode = 'wipe'
    if (brewing) {
      x = MACHINE_X
      mode = 'brew'
    } else if (serving) {
      x = ORDER_SPOT.x
      mode = 'hand'
    }
    const g = group.current
    const step = THREE.MathUtils.clamp(x - g.position.x, -delta * 1.2, delta * 1.2)
    g.position.x += step
    if (Math.abs(step) > delta * 0.3 && mode === 'wipe') mode = 'walk'
    g.position.z = BARISTA_SPOT.z
    g.position.y = 0.35
    g.rotation.y = 0
    pose.current = { mode, cupColor: (brewing || serving) && DRINKS[(brewing || serving).drink].foam }
    onBrewing(Boolean(brewing))
    // a word when something starts
    const key = brewing ? 'b:' + brewing.drink : serving ? 's' : null
    if (key !== last.current) {
      last.current = key
      if (brewing) setSay(`Satu ${DRINKS[brewing.drink].label}, segera! ☕`)
      else if (serving) setSay('Ini dia, selamat menikmati ♡')
      else setSay(null)
    }
  })
  useEffect(() => {
    if (!say) return
    const id = setTimeout(() => setSay(null), 2600)
    return () => clearTimeout(id)
  }, [say])
  return (
    <group>
      <Gnome look={BARISTA_LOOK} pose={() => pose.current} groupRef={group} />
      <group position={[0, 0, 0]}>
        <BubbleFollow target={group} text={say} />
      </group>
    </group>
  )
}

/** A bubble that follows a moving gnome. */
function BubbleFollow({ target, text }) {
  const ref = useRef()
  useFrame(() => {
    if (ref.current && target.current) ref.current.position.copy(target.current.position)
  })
  return (
    <group ref={ref}>
      <Bubble text={text} />
    </group>
  )
}

/** Where the waiter stands to serve a chair's table (beside it, not on the chair). */
function serveSpot(seat) {
  const c = chairOf(seat)
  if (!c) return null
  const t = TABLES.find((x) => x.id === c.table)
  return t.axis === 'x' ? { x: t.x, z: t.z + 0.62 } : { x: t.x - 0.62, z: t.z }
}
const PICKUP = { x: ORDER_SPOT.x + 0.5, z: COUNTER.z + 0.75 }

/** Pip the waiter: greets you at the door, waits by the counter while drinks are made, carries them to your table. */
function Waiter() {
  const group = useRef()
  const pos = useRef(new THREE.Vector3(WAITER_HOME.x, 0, WAITER_HOME.z))
  const pose = useRef({ mode: 'idle' })
  const [say, setSay] = useState(null)
  const greeted = useRef(false)
  const talkUntil = useRef(0)
  const world = useMemo(() => new THREE.Vector3(), [])
  useInteractable('cafe-waiter', {
    get position() {
      const [x, z] = toWorld(pos.current.x, pos.current.z)
      return world.set(x, cafeFloor(), z)
    },
    radius: 1.2,
    priority: 0.2,
    enabled: () => !player.act,
    label: () => (pipHasJob() ? 'Ngobrol dengan Pip ❗' : 'Ngobrol dengan Pip 💬'),
    onInteract: () => {
      // a job for Gnome Village (coffee for Nenek Pim): through the village's talk card
      if (pipHasJob()) {
        talkTo('pip')
        talkUntil.current = performance.now() / 1000 + 3
        return audio.sparkle()
      }
      const lines = LINES.waiter
      setSay(lines[Math.floor(Math.random() * lines.length)])
      talkUntil.current = performance.now() / 1000 + 3
      audio.sparkle()
    },
  })
  useFrame((_, delta) => {
    const orders = liveOrders()
    const carrying = orders.find((o) => o.state === 'carrying' && o.seat)
    const brewingToTable = orders.find((o) => o.state === 'brewing' && o.seat)
    // where to be
    let target = WAITER_HOME
    let mode = 'idle'
    if (carrying) {
      target = serveSpot(carrying.seat) || WAITER_HOME
      mode = 'carry'
    } else if (brewingToTable) {
      target = PICKUP
    }
    const p = pos.current
    const outNow = p.z > ROOM.hd
    if (outNow !== target.z > ROOM.hd) {
      // line up with the door on this side, then step through to the other
      const side = (out) => ({ x: 0, z: out ? ROOM.hd + 0.55 : ROOM.hd - 0.55 })
      target = Math.abs(p.x) > 0.2 ? side(outNow) : side(!outNow)
    }
    const dx = target.x - p.x
    const dz = target.z - p.z
    const d = Math.hypot(dx, dz)
    if (d > 0.05) {
      const step = Math.min(d, WAITER_SPEED * delta)
      p.x += (dx / d) * step
      p.z += (dz / d) * step
      group.current.rotation.y = Math.atan2(dx, dz)
      if (mode !== 'carry') mode = 'walk'
    } else if (carrying) {
      mode = 'serve'
      const c = chairOf(carrying.seat)
      if (c) group.current.rotation.y = Math.atan2(c.cup[0] - p.x, c.cup[1] - p.z)
    } else {
      // at rest: face the door, and greet whoever comes in
      group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, Math.PI * 0.85, 3, delta)
    }
    const [lx, lz] = toCafe(player.position.x, player.position.z)
    const entering = Math.abs(lx) < 1.2 && lz > ROOM.hd - 1.2 && lz < ROOM.hd + 0.6
    if (entering && !greeted.current) {
      greeted.current = true
      setSay(LINES.welcome[Math.floor(Math.random() * LINES.welcome.length)])
      talkUntil.current = performance.now() / 1000 + 2.5
    } else if (!entering && Math.hypot(lx, lz) > 7) greeted.current = false
    const talking = performance.now() / 1000 < talkUntil.current
    if (talking && mode === 'idle') mode = say && LINES.welcome.includes(say) ? 'wave' : 'talk'
    group.current.position.set(p.x, 0, p.z)
    pose.current = { mode, cupColor: carrying && DRINKS[carrying.drink].foam }
  })
  useEffect(() => {
    if (!say) return
    const id = setTimeout(() => setSay(null), 3200)
    return () => clearTimeout(id)
  }, [say])
  return (
    <group>
      <Gnome look={WAITER_LOOK} pose={() => pose.current} groupRef={group} />
      <BubbleFollow target={group} text={say} />
    </group>
  )
}

/* ───────── the café ───────── */

/** Ordering at the counter: opens the menu. */
function OrderPoint() {
  const position = useMemo(() => {
    const [x, z] = toWorld(ORDER_SPOT.x, ORDER_SPOT.z)
    return new THREE.Vector3(x, cafeFloor(), z)
  }, [])
  useInteractable('cafe-order', {
    position,
    radius: 1.3,
    priority: 0.4,
    enabled: () => !player.act,
    label: () => {
      const { order, cup } = useCafe.getState()
      if (order) return 'Pesananmu sedang dibuat ☕'
      if (cup) return 'Pesan lagi setelah minumanmu habis ☕'
      return 'Pesan kopi ke Bram ☕'
    },
    onInteract: () => {
      const { order, cup } = useCafe.getState()
      if (order || cup) return
      audio.sparkle()
      useStore.getState().setPanel('cafe')
    },
  })
  return null
}

export default function Cafe() {
  const camera = useThree((s) => s.camera)
  const view = useStore((s) => s.view)
  const myCup = useCafe((s) => s.cup)
  const [theirCup, setTheirCup] = useState(null)
  const [brewing, setBrewing] = useState(false)
  const wallRefs = { front: useRef(), back: useRef(), left: useRef(), right: useRef() }
  const roof = useRef()
  const lamps = useRef()
  const cut = useRef(0)
  const [glow, setGlow] = useState(0.3)
  const tmp = useMemo(() => new THREE.Vector3(), [])
  const floor = cafeFloor()

  useFrame((_, delta) => {
    tickCafe()
    // inside: the roof lifts away and the walls toward the camera fold down (like at home)
    const inside = useCafe.getState().inside
    cut.current = THREE.MathUtils.damp(cut.current, inside ? 1 : 0, 6, delta)
    roof.current.visible = cut.current < 0.5
    tmp.set(camera.position.x - CAFE.x, 0, camera.position.z - CAFE.z)
    // the camera's direction in café-local terms
    const [lx, lz] = [tmp.x * Math.cos(CAFE.yaw) - tmp.z * Math.sin(CAFE.yaw), tmp.x * Math.sin(CAFE.yaw) + tmp.z * Math.cos(CAFE.yaw)]
    const l = Math.hypot(lx, lz) || 1
    for (const side of ['front', 'back', 'left', 'right']) {
      const [nx, nz] = WALLS[side].normal
      const facing = (nx * lx + nz * lz) / l > 0.2
      const g = wallRefs[side].current
      g.scale.y = THREE.MathUtils.damp(g.scale.y, facing ? 1 - cut.current * 0.88 : 1, 10, delta)
      const decor = g.getObjectByName('decor')
      if (decor) decor.visible = g.scale.y > 0.7
    }
    // the other person's cup on a table (seen from here)
    const pc = partner.online && partner.cup?.state === 'table' && partner.cup.seat ? `${partner.cup.seat}|${partner.cup.kind}` : null
    if (pc !== theirCup) setTheirCup(pc)
    // the lamps and windows glow more as evening comes
    const k = 0.3 + 0.9 * Math.max(1 - atmosphere.day, atmosphere.sunset * 0.6)
    if (Math.abs(k - glow) > 0.08) setGlow(k)
    if (lamps.current) lamps.current.children.forEach((m) => m.material && (m.material.emissiveIntensity = k * 1.4))
  })

  const pools = useMemo(() => [{ x: 0, y: 0, z: 0 }].map(() => {
    const [x, z] = toWorld(0, TERRACE.z1 - 0.6)
    return { x, y: floor, z }
  }), [floor])

  if (['finale', 'finalRoom'].includes(view)) return null
  const [tseat, tdrink] = theirCup ? theirCup.split('|') : []
  return (
    <group>
      <group position={[CAFE.x, floor, CAFE.z]} rotation={[0, CAFE.yaw, 0]}>
        {/* the stone foundation and the floor */}
        <B p={[0, -0.135, 0]} s={[ROOM.hw * 2 + 0.5, 0.3, ROOM.hd * 2 + 0.5]} c={STONE} />
        <B p={[0, 0.0225, 0]} s={[ROOM.hw * 2, 0.015, ROOM.hd * 2]} c="#e2b98a" />
        {/* the barista's step behind the counter (gnomes are small) */}
        <B p={[(COUNTER.x0 + COUNTER.x1) / 2, 0.19, (COUNTER.z - COUNTER.d / 2 - ROOM.hd + CAFE_WALL_T / 2) / 2]} s={[COUNTER.x1 - COUNTER.x0, 0.32, COUNTER.z - COUNTER.d / 2 + ROOM.hd - CAFE_WALL_T / 2 - 0.01]} c={WOOD_DARK} />
        {Array.from({ length: 11 }, (_, i) => (
          <B key={i} p={[-ROOM.hw + 0.27 + i * 0.55, 0.031, 0]} s={[0.015, 0.004, ROOM.hd * 2]} c="#d2a676" />
        ))}
        <B p={[0.6, 0.036, 0.6]} s={[2.2, 0.008, 1.6]} c="#f4c6d6" />
        {Object.keys(WALLS).map((side) => (
          <Wall key={side} side={side} innerRef={wallRefs[side]} glow={glow} />
        ))}
        <group ref={roof}>
          <Roof />
        </group>
        <Terrace glow={glow} />
        <Sign />
        <Garden />
        <Counter brewing={brewing} />
        <MenuBoard />
        {TABLES.map((t) => (
          <Table key={t.id} t={t} />
        ))}
        {/* pendant lamps over the tables and the counter */}
        <group ref={lamps}>
          {[...TABLES.filter((t) => !t.out).map((t) => [t.x, t.z]), [-0.6, COUNTER.z]].map(([x, z], i) => (
            <mesh key={i} position={[x, 1.95, z]}>
              <sphereGeometry args={[0.12, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
              <meshStandardMaterial color="#ffe2a8" emissive="#ffc77a" emissiveIntensity={0.5} side={THREE.DoubleSide} />
            </mesh>
          ))}
        </group>
        {TABLES.filter((t) => !t.out).map((t) => (
          <Glow key={t.id} position={[t.x, 1.85, t.z]} color="#ffd9a0" size={1.2} opacity={0.25 + glow * 0.25} />
        ))}
        {/* plants in the corners */}
        {[
          [-ROOM.hw + 0.35, ROOM.hd - 0.35],
          [ROOM.hw - 0.35, -ROOM.hd + 0.4],
        ].map(([x, z]) => (
          <group key={x} position={[x, 0, z]}>
            <C p={[0, 0.15, 0]} rt={0.16} rb={0.12} h={0.3} c="#e08f6a" />
            <mesh position={[0, 0.5, 0]} scale={[0.26, 0.3, 0.26]} material={mat('#79c27c', 0, 0.9)}>
              <icosahedronGeometry args={[1, 1]} />
            </mesh>
          </group>
        ))}
        <Barista onBrewing={setBrewing} />
        <Waiter />
        {myCup?.where === 'table' && myCup.seat && <TableCup seat={myCup.seat} drink={myCup.drink} />}
        {tseat && <TableCup seat={tseat} drink={tdrink} />}
      </group>
      <LightPools points={pools} size={5} />
      <OrderPoint />
      {CHAIRS.map((c) => (
        <CupSpot key={c.id} c={c} />
      ))}
    </group>
  )
}
