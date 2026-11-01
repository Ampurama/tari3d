import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { B, C, mat, S } from './HomeFurniture'
import { Glow } from './Bits'
import MansionGhosts, { Chickens } from './MansionGhosts'
import {
  act,
  ATTIC,
  ATTIC_STAIRS,
  CANDLE_MARK,
  CELLAR_STAIRS,
  doStep,
  doorOpen,
  FENCE,
  FL,
  floorY,
  FURNITURE,
  GATE,
  GRAVES,
  groundLevel,
  has,
  hasCookie,
  hasItem,
  HD,
  hideIn,
  HW,
  LANDING,
  LANTERNS,
  lastAct,
  leaveHide,
  MIRROR_SPOT,
  MX,
  MZ,
  openPanel,
  pressLever,
  PUMPKINS,
  roomAt,
  ROOM_H,
  ROOMS,
  STAIRS,
  takeCookie,
  tickMansion,
  toWorld,
  useMansion,
  wallsOf,
  WALK,
  YARD_LAMPS,
  YARD_TREES,
} from '../../lib/mansion'
import { boss, bubble, gramophone, guardAway, lanternLit, lightLantern, mirrorLit, openedCloset, roomLight, SCARE_WINDOWS, shown, SWING_DOORS, fx, tickGhosts } from '../../lib/mansionGhosts'
import { BOSS, CHICKENS, CHOICE, DIARY, DIARY_SPOTS, LINES, PAINTING_TEXT, WALL_SCRAWL } from '../../lib/mansionStory'
import { useInteractable } from '../../lib/interactions'
import { player } from '../../lib/player'
import { partner } from '../../lib/couple'
import { say } from '../../lib/village'
import { rig } from '../../lib/iso'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'

/*
 * THE HAUNTED GNOME MANSION — the house and its grounds, everything in it you can use, and how it
 * opens up to the camera (the logic is lib/mansion.js; the ghosts are MansionGhosts.jsx).
 *
 * Everything is placed in building-local metres (lx west→east, lz north→front) and turned into the
 * world by toWorld(). Each storey is its own group: while she's inside, the storeys above hers lift
 * away and the walls between her and the camera fold down (like the café), so her floor is always in
 * view. Three lamps follow whoever is inside from room to room (always there, so nothing recompiles).
 */

const WALL_T = 0.16
const PLUM = '#5b4a6e'
const PLUM_DARK = '#3d3352'
const TRIM = '#2e2436'
const WOOD = '#6b4a3a'
const WOOD_DARK = '#4a3328'
const STONE = '#7d7488'
const STONE_DARK = '#5e5868'
const PAPER = { G: '#8a6f8f', B: '#6e6878', A: '#8b6f5a' }
const FLOOR = { G: '#7a5a46', B: '#5d5864', A: '#8a6a4e' }
const GLASS = '#2b2f4a'
const toast = (t, ms = 3200) => useStore.getState().showToast(t, ms)
const pick = (list) => list[Math.floor(Math.random() * list.length)]
const W = (lx, lz) => toWorld(lx, lz)
/** a world Vector3 for a building-local point on a storey (for interactables) */
const at = (lx, lz, f) => {
  const [x, z] = W(lx, lz)
  return new THREE.Vector3(x, floorY(f), z)
}

/* ───────── which way each piece of furniture faces (its front, local +z) ───────── */

const FACE = {
  fireplace: Math.PI / 2,
  sofa: Math.PI,
  armchair: Math.PI * 0.8,
  chicken_cupboard: Math.PI,
  icebox: Math.PI,
  doll_shelf: Math.PI / 2,
  doll_bed: Math.PI,
  doll_house: -Math.PI / 2,
  dolls_wardrobe: -Math.PI / 2,
  shelves_e: -Math.PI / 2,
  gramophone: -Math.PI * 0.75,
  reading_chair: 2.36,
  vault_wardrobe: Math.PI / 2,
  trunk: Math.PI,
  rocking_chair: Math.PI,
}

/* ───────── the models (front +z, standing on y = 0, w × d in their own axes) ───────── */

function Wardrobe({ w, d, open = 0, color = WOOD }) {
  return (
    <group>
      <B p={[0, 0.95, 0]} s={[w, 1.9, d]} c={color} />
      <B p={[0, 1.93, 0]} s={[w + 0.08, 0.08, d + 0.06]} c={WOOD_DARK} />
      {[-1, 1].map((k) => (
        <group key={k} position={[(k * w) / 2, 0.95, d / 2 + 0.01]} rotation={[0, k * open * 1.2, 0]}>
          <B p={[(-k * w) / 4, 0, 0]} s={[w / 2 - 0.02, 1.75, 0.03]} c={WOOD_DARK} />
          <S p={[(-k * w) / 2 + k * 0.06, 0, 0.03]} s={0.025} c="#d9b26a" />
        </group>
      ))}
    </group>
  )
}

function Model({ f }) {
  const rot = Math.abs(Math.sin(FACE[f.id] ?? 0)) > 0.7
  const w = rot ? f.d : f.w
  const d = rot ? f.w : f.d
  switch (f.kind) {
    case 'side_table':
      return (
        <group>
          <B p={[0, 0.7, 0]} s={[w, 0.05, d]} c={WOOD} />
          {[-1, 1].map((k) => (
            <B key={k} p={[k * (w / 2 - 0.05), 0.35, 0]} s={[0.05, 0.7, d - 0.06]} c={WOOD_DARK} />
          ))}
          <C p={[w * 0.3, 0.8, 0]} rt={0.03} h={0.16} c="#fff4e4" glow={0.4} />
          <Glow position={[w * 0.3, 0.95, 0]} color="#ffcf8a" size={0.5} opacity={0.5} />
        </group>
      )
    case 'closet':
    case 'wardrobe':
      return <Wardrobe w={w} d={d} />
    case 'locker':
      return <Wardrobe w={w} d={d} color="#5a6a6e" />
    case 'umbrellas':
      return (
        <group>
          <C p={[0, 0.3, 0]} rt={0.12} h={0.6} c="#3a2a3e" />
          {[0, 1, 2].map((i) => (
            <C key={i} p={[Math.sin(i * 2) * 0.04, 0.75, Math.cos(i * 2) * 0.04]} rt={0.01} h={0.5} c={['#e8566f', '#2e2436', '#6f8f6a'][i]} r={[0.1 * (i - 1), 0, 0.1]} />
          ))}
        </group>
      )
    case 'fireplace':
      return (
        <group>
          <B p={[0, 0.55, 0]} s={[w, 1.1, d]} c={STONE} />
          <B p={[0, 0.4, d / 2 - 0.05]} s={[w * 0.55, 0.65, 0.12]} c="#1c1620" />
          <B p={[0, 1.14, 0.03]} s={[w + 0.14, 0.08, d + 0.08]} c={WOOD_DARK} />
          <B p={[0, 1.9, -0.1]} s={[w * 0.7, 1.5, d * 0.5]} c={STONE_DARK} />
          <Glow position={[0, 0.3, d / 2]} color="#7fe0c8" size={0.9} opacity={0.6} />
          {/* the ghostly green fire */}
          <mesh position={[0, 0.28, d / 2 - 0.05]} material={mat('#9ff0d0', 1.4)}>
            <coneGeometry args={[0.14, 0.32, 8]} />
          </mesh>
        </group>
      )
    case 'sofa':
      return (
        <group>
          <B p={[0, 0.25, 0]} s={[w, 0.3, d]} c="#7a3f5a" />
          <B p={[0, 0.55, -d / 2 + 0.1]} s={[w, 0.55, 0.2]} c="#6a3550" />
          {[-1, 1].map((k) => (
            <B key={k} p={[k * (w / 2 - 0.09), 0.4, 0]} s={[0.18, 0.4, d]} c="#6a3550" />
          ))}
          <S p={[-w * 0.25, 0.48, 0.05]} s={[0.16, 0.12, 0.08]} c="#d9c6e8" />
        </group>
      )
    case 'armchair':
      return (
        <group>
          <B p={[0, 0.25, 0]} s={[w, 0.3, d]} c="#5a4a7a" />
          <B p={[0, 0.65, -d / 2 + 0.08]} s={[w, 0.8, 0.16]} c="#4a3a6a" />
          {[-1, 1].map((k) => (
            <B key={k} p={[k * (w / 2 - 0.06), 0.42, 0]} s={[0.12, 0.34, d]} c="#4a3a6a" />
          ))}
        </group>
      )
    case 'coffee_table':
    case 'kitchen_table':
    case 'desk':
    case 'party_table': {
      const h = f.kind === 'coffee_table' ? 0.42 : 0.74
      return (
        <group>
          <B p={[0, h, 0]} s={[w, 0.06, d]} c={f.kind === 'party_table' ? '#8a5a7a' : WOOD} />
          {[
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ].map(([a, b]) => (
            <B key={`${a}${b}`} p={[a * (w / 2 - 0.06), h / 2, b * (d / 2 - 0.06)]} s={[0.05, h, 0.05]} c={WOOD_DARK} />
          ))}
          {f.kind === 'party_table' && (
            <group>
              <C p={[0, h + 0.12, 0]} rt={0.2} rb={0.22} h={0.2} c="#ffd6ea" />
              <C p={[0, h + 0.27, 0]} rt={0.12} rb={0.14} h={0.1} c="#fff4e4" />
              <C p={[0, h + 0.36, 0]} rt={0.008} h={0.08} c="#ffd27f" glow={1.2} />
              {[-0.45, 0.45].map((x) => (
                <mesh key={x} position={[x, h + 0.1, 0.2]} rotation={[0, 0, 0.2]} material={mat('#b9a5ff', 0.3)}>
                  <coneGeometry args={[0.06, 0.16, 10]} />
                </mesh>
              ))}
            </group>
          )}
        </group>
      )
    }
    case 'piano':
      return (
        <group>
          <B p={[0, 0.65, -0.05]} s={[w, 1.3, d - 0.1]} c="#1f1824" />
          <B p={[0, 0.72, d / 2 - 0.08]} s={[w - 0.1, 0.06, 0.2]} c="#f4f0ea" />
          {Array.from({ length: 9 }, (_, i) => (
            <B key={i} p={[-w / 2 + 0.15 + i * ((w - 0.3) / 8), 0.76, d / 2 - 0.12]} s={[0.04, 0.02, 0.1]} c="#1f1824" />
          ))}
          <C p={[w * 0.35, 1.38, 0]} rt={0.03} h={0.14} c="#fff4e4" glow={0.4} />
        </group>
      )
    case 'oven':
      return (
        <group>
          <B p={[0, 0.45, 0]} s={[w, 0.9, d]} c="#3a3a44" />
          <B p={[0, 0.4, d / 2 + 0.005]} s={[w * 0.6, 0.4, 0.02]} c="#1c1620" />
          <B p={[0, 0.93, 0]} s={[w, 0.04, d]} c="#2a2a30" />
          <B p={[0, 1.5, -d / 2 + 0.05]} s={[w * 0.5, 1.1, 0.12]} c="#3a3a44" />
        </group>
      )
    case 'cupboard':
      return (
        <group>
          <B p={[0, 0.9, 0]} s={[w, 1.8, d]} c="#6f8f6a" />
          {[-1, 1].map((k) => (
            <B key={k} p={[(k * w) / 4, 0.95, d / 2 + 0.01]} s={[w / 2 - 0.04, 1.5, 0.03]} c="#5a7a56" />
          ))}
          <B p={[0, 1.85, 0]} s={[w + 0.06, 0.08, d + 0.04]} c="#4a6a46" />
        </group>
      )
    case 'icebox':
      return (
        <group>
          <B p={[0, 0.75, 0]} s={[w, 1.5, d]} c="#cfd8e6" />
          <B p={[0, 1.05, d / 2 + 0.01]} s={[w - 0.08, 0.02, 0.02]} c="#8a94a6" />
        </group>
      )
    case 'shelf':
      return (
        <group>
          {[0.9, 1.4].map((y) => (
            <B key={y} p={[0, y, 0]} s={[w, 0.04, d]} c={WOOD} />
          ))}
          {[0, 1, 2, 3, 4].map((i) => (
            <C key={i} p={[-w / 2 + 0.12 + i * 0.18, 1.0, 0]} rt={0.04} h={0.16} c={['#e8566f', '#ffd27f', '#9fd0ff', '#6f8f6a', '#b9a5ff'][i]} />
          ))}
        </group>
      )
    case 'doll_shelf':
      return (
        <group>
          <B p={[0, 1.0, -d / 2 + 0.04]} s={[w, 2.0, 0.06]} c={WOOD_DARK} />
          {[0.45, 0.95, 1.45].map((y) => (
            <B key={y} p={[0, y, 0]} s={[w, 0.04, d]} c={WOOD} />
          ))}
        </group>
      )
    case 'mirror':
      return null // drawn by <Mirror/> (it needs to know when it's lit)
    case 'doll_bed':
      return (
        <group>
          <B p={[0, 0.2, 0]} s={[w, 0.2, d]} c="#e8c6d8" />
          <B p={[0, 0.45, -d / 2 + 0.04]} s={[w, 0.6, 0.06]} c={WOOD} />
          <S p={[w * 0.3, 0.34, -0.15]} s={[0.15, 0.06, 0.12]} c="#fff4fa" />
        </group>
      )
    case 'doll_house':
      return (
        <group>
          <B p={[0, 0.3, 0]} s={[w, 0.6, d]} c="#f2a8d8" />
          <mesh position={[0, 0.78, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1, 0.6, 1]} material={mat('#7a3f5a')}>
            <coneGeometry args={[w * 0.72, 0.6, 4]} />
          </mesh>
          <B p={[0, 0.22, d / 2 + 0.005]} s={[0.14, 0.24, 0.02]} c="#3a2a3e" />
          <B p={[w * 0.25, 0.42, d / 2 + 0.005]} s={[0.12, 0.1, 0.02]} c="#ffd27f" glow={0.6} />
        </group>
      )
    case 'bookshelf':
    case 'bookshelf_side':
      return (
        <group>
          <B p={[0, 1.1, -d / 2 + 0.03]} s={[w, 2.2, 0.05]} c={WOOD_DARK} />
          {[0.3, 0.8, 1.3, 1.8].map((y, j) => (
            <group key={y}>
              <B p={[0, y - 0.04, 0]} s={[w, 0.04, d]} c={WOOD} />
              {Array.from({ length: Math.floor(w / 0.12) }, (_, i) => (
                <B key={i} p={[-w / 2 + 0.07 + i * 0.12, y + 0.14, 0.02]} s={[0.09, 0.28 - ((i * 7 + j) % 3) * 0.04, d - 0.12]} c={['#7a3f5a', '#3f5a7a', '#6f8f6a', '#a0643f', '#5a4a7a'][(i + j * 2) % 5]} />
              ))}
            </group>
          ))}
        </group>
      )
    case 'gramophone':
      return null // <Gramophone/>
    case 'dial':
      return null // <Dial/>
    case 'boiler':
      return (
        <group>
          <C p={[0, 0.8, 0]} rt={0.62} h={1.6} c="#7a5a3a" seg={18} />
          <C p={[0, 1.65, 0]} rt={0.5} rb={0.62} h={0.1} c="#5a3a2a" seg={18} />
          <C p={[0, 1.95, 0]} rt={0.1} h={0.5} c="#4a3a30" />
          <C p={[0, 0.5, 0.6]} rt={0.16} h={0.04} c="#ff7a3a" glow={1.3} r={[Math.PI / 2, 0, 0]} />
          <Glow position={[0, 0.5, 0.7]} color="#ff9a6b" size={1.4} opacity={0.6} />
          {[-0.4, 0.4].map((x) => (
            <C key={x} p={[x, 1.2, -0.62]} rt={0.05} h={1.0} c="#8a7a6a" />
          ))}
        </group>
      )
    case 'crates':
      return (
        <group>
          <B p={[-w * 0.2, 0.25, 0]} s={[w * 0.55, 0.5, d * 0.9]} c="#8a6a4a" />
          <B p={[w * 0.25, 0.22, -0.05]} s={[w * 0.4, 0.44, d * 0.7]} c="#7a5a3a" />
          <B p={[-w * 0.1, 0.68, 0.05]} s={[w * 0.4, 0.36, d * 0.6]} c="#9a7a5a" />
        </group>
      )
    case 'barrels':
      return (
        <group>
          {[
            [-0.2, 0.2],
            [0.22, -0.15],
          ].map(([x, z]) => (
            <group key={x}>
              <C p={[x, 0.38, z]} rt={0.24} rb={0.26} h={0.76} c="#7a4a3a" seg={14} />
              <C p={[x, 0.2, z]} rt={0.265} h={0.04} c="#4a4048" seg={14} />
              <C p={[x, 0.58, z]} rt={0.255} h={0.04} c="#4a4048" seg={14} />
            </group>
          ))}
        </group>
      )
    case 'safe':
      return null // <Safe/>
    case 'cuckoo_clock':
      return null // <CuckooClock/>
    case 'trunk':
      return (
        <group>
          <B p={[0, 0.25, 0]} s={[w, 0.5, d]} c="#6a4a3a" />
          <mesh position={[0, 0.5, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, w / 0.6, 1]} material={mat('#5a3a2a')}>
            <cylinderGeometry args={[d / 2, d / 2, 0.6, 12, 1, false, 0, Math.PI]} />
          </mesh>
          <B p={[0, 0.4, d / 2 + 0.01]} s={[0.1, 0.12, 0.02]} c="#d9b26a" />
        </group>
      )
    case 'rocking_chair':
      return <RockingChair w={w} d={d} />
    case 'party_button':
      return null // <PartyButton/>
    default:
      return <B p={[0, 0.4, 0]} s={[w, 0.8, d]} c={WOOD} />
  }
}

function RockingChair({ w, d }) {
  const g = useRef()
  useFrame(({ clock }) => {
    // it rocks by itself, of course
    if (g.current) g.current.rotation.x = Math.sin(clock.elapsedTime * 1.3) * 0.12
  })
  return (
    <group ref={g}>
      <B p={[0, 0.42, 0]} s={[w, 0.06, d * 0.8]} c={WOOD} />
      <B p={[0, 0.85, -d * 0.38]} s={[w, 0.8, 0.06]} c={WOOD} />
      {[-1, 1].map((k) => (
        <mesh key={k} position={[k * (w / 2 - 0.04), 0.1, 0]} rotation={[0, Math.PI / 2, 0]} material={mat(WOOD_DARK)}>
          <torusGeometry args={[0.5, 0.02, 4, 16, 1.2]} />
        </mesh>
      ))}
    </group>
  )
}

/** One piece of furniture, in place. */
function Piece({ f }) {
  const [x, z] = [f.x, f.z]
  return (
    <group position={[x, FL[f.f], z]} rotation={[0, FACE[f.id] ?? 0, 0]}>
      <Model f={f} />
    </group>
  )
}

/* ───────── walls, floors, stairs ───────── */

const segLen = (s) => Math.hypot(s[2] - s[0], s[3] - s[1])
/** A wall segment (it can fold down toward the floor). */
function Wall({ s, f, h, color, innerRef }) {
  const len = segLen(s)
  const mx = (s[0] + s[2]) / 2
  const mz = (s[1] + s[3]) / 2
  const yaw = Math.atan2(s[2] - s[0], s[3] - s[1])
  if (s[5] === 'rail') {
    return (
      <group position={[mx, FL[f], mz]} rotation={[0, yaw, 0]}>
        <B p={[0, 0.9, 0]} s={[0.06, 0.06, len]} c={WOOD_DARK} />
        {Array.from({ length: Math.max(2, Math.round(len / 0.4)) }, (_, i, a) => (
          <B key={i} p={[0, 0.45, -len / 2 + (i * len) / (a.length - 1)]} s={[0.04, 0.9, 0.04]} c={WOOD} />
        ))}
      </group>
    )
  }
  return (
    <group ref={innerRef} position={[mx, FL[f], mz]} rotation={[0, yaw, 0]} userData={{ mx, mz }}>
      <B p={[0, h / 2, 0]} s={[WALL_T, h, len + WALL_T]} c={color} />
      <B p={[0, 0.06, 0]} s={[WALL_T + 0.02, 0.12, len + WALL_T]} c={TRIM} />
    </group>
  )
}

/** A floor slab with rectangular holes (stairwells): split into strips around them. */
function Slab({ y, rect, holes = [], color, t = 0.2 }) {
  const parts = useMemo(() => {
    // cut along x at every hole edge, then along z within each strip
    const xs = [rect.x0, rect.x1, ...holes.flatMap((h) => [h.x0, h.x1])].filter((v) => v >= rect.x0 && v <= rect.x1).sort((a, b) => a - b)
    const out = []
    for (let i = 0; i < xs.length - 1; i++) {
      const x0 = xs[i]
      const x1 = xs[i + 1]
      if (x1 - x0 < 1e-3) continue
      const cuts = holes.filter((h) => h.x0 < x1 - 1e-3 && h.x1 > x0 + 1e-3).sort((a, b) => a.z0 - b.z0)
      let z = rect.z0
      for (const h of cuts) {
        if (h.z0 > z) out.push([x0, x1, z, h.z0])
        z = Math.max(z, h.z1)
      }
      if (z < rect.z1) out.push([x0, x1, z, rect.z1])
    }
    return out
  }, [rect, holes])
  return (
    <group>
      {parts.map(([x0, x1, z0, z1], i) => (
        <B key={i} p={[(x0 + x1) / 2, y - t / 2, (z0 + z1) / 2]} s={[x1 - x0, t, z1 - z0]} c={color} />
      ))}
    </group>
  )
}

/** A flight of stairs from (rect, low end at `from`) rising `rise` toward +z (dir 1) or −z (dir −1). */
function Flight({ rect, y0, rise, dir, color = WOOD }) {
  const len = rect.z1 - rect.z0
  const n = Math.max(6, Math.round(rise / 0.2))
  const w = rect.x1 - rect.x0
  return (
    <group>
      {Array.from({ length: n }, (_, i) => {
        const k = (i + 0.5) / n
        const z = dir > 0 ? rect.z0 + k * len : rect.z1 - k * len
        const top = y0 + ((i + 1) / n) * rise
        return <B key={i} p={[(rect.x0 + rect.x1) / 2, (y0 + top) / 2 - 0.02, z]} s={[w, top - y0, len / n + 0.01]} c={i % 2 ? color : WOOD_DARK} />
      })}
    </group>
  )
}

/** Windows on a wall's outside (and inside): glowing panes with a cross, some boarded up. */
const WINDOWS = [
  // [lx, lz, storey, yaw (outward normal), width, height, boarded?]
  [-4.4, HD, 'G', 0, 1.0, 1.1],
  [4.4, HD, 'G', 0, 1.0, 1.1],
  [-2.0, HD, 'G', 0, 0.5, 0.9, true],
  [-HW, -2.4, 'G', -Math.PI / 2, 0.9, 1.0],
  [-HW, 2.6, 'G', -Math.PI / 2, 0.9, 1.0],
  [HW, -2.6, 'G', Math.PI / 2, 0.9, 1.0],
  [HW, 2.4, 'G', Math.PI / 2, 0.9, 1.0, true],
  [-4.5, -HD, 'G', Math.PI, 0.9, 1.0],
  [4.5, -HD, 'G', Math.PI, 0.9, 1.0],
  [-4.5, HD, 'B', 0, 0.7, 0.35],
  [4.5, HD, 'B', 0, 0.7, 0.35],
  [-HW, -2.5, 'B', -Math.PI / 2, 0.6, 0.35],
  [HW, 2.5, 'B', Math.PI / 2, 0.6, 0.35],
]
const ROOM_OF_WINDOW = WINDOWS.map(([lx, lz, f]) => {
  const ix = Math.abs(lx) >= HW - 0.01 ? lx - Math.sign(lx) * 0.5 : lx
  const iz = Math.abs(lz) >= HD - 0.01 ? lz - Math.sign(lz) * 0.5 : lz
  for (const [id, r] of Object.entries(ROOMS)) if (r.f === f && ix >= r.x0 && ix <= r.x1 && iz >= r.z0 && iz <= r.z1) return id
  return null
})
function Windows({ storey }) {
  const panes = useRef([])
  useFrame(() => {
    const ending = useMansion.getState().run.ending
    WINDOWS.forEach((w, i) => {
      const m = panes.current[i]
      if (!m) return
      const k = roomLight(ROOM_OF_WINDOW[i])
      m.material.emissiveIntensity = (ending === 'good' ? 1.4 : ending === 'funny' ? 1.6 : 0.9) * k
    })
  })
  return WINDOWS.map((w, i) => {
    const [lx, lz, f, yaw, ww, hh, boarded] = w
    if (f !== storey) return null
    const y = FL[f] + (f === 'B' ? ROOM_H.B - 0.4 : 1.45)
    const out = (WALL_T / 2 + 0.012) * 1
    return (
      <group key={i} position={[lx, y, lz]} rotation={[0, yaw, 0]}>
        {[1, -1].map((side) => (
          <group key={side} position={[0, 0, side * out]} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
            <mesh ref={side > 0 ? (el) => (panes.current[i] = el) : undefined}>
              <planeGeometry args={[ww, hh]} />
              <meshStandardMaterial color={GLASS} emissive={ROOMS[ROOM_OF_WINDOW[i]]?.light || '#ffcf8a'} emissiveIntensity={0.9} roughness={0.3} />
            </mesh>
            <B p={[0, 0, 0.01]} s={[ww + 0.1, 0.06, 0.03]} c={TRIM} />
            <B p={[0, 0, 0.01]} s={[0.06, hh + 0.1, 0.03]} c={TRIM} />
            <B p={[0, hh / 2 + 0.03, 0.01]} s={[ww + 0.14, 0.06, 0.04]} c={TRIM} />
            <B p={[0, -hh / 2 - 0.03, 0.02]} s={[ww + 0.18, 0.06, 0.06]} c={TRIM} />
            {boarded && side > 0 && (
              <group>
                <B p={[0, 0.15, 0.04]} s={[ww + 0.15, 0.1, 0.03]} c="#8a6a4a" r={[0, 0, 0.3]} />
                <B p={[0, -0.15, 0.04]} s={[ww + 0.15, 0.1, 0.03]} c="#7a5a3a" r={[0, 0, -0.25]} />
              </group>
            )}
          </group>
        ))}
      </group>
    )
  })
}

/** The doorways' lintels (above every gap in a wall). */
const LINTELS = {
  G: [
    [0, HD, 1.4, 'x'],
    [-2, 2.5, 1.2, 'z'],
    [2, 2.5, 1.2, 'z'],
    [-4.5, 0, 1.2, 'x'],
    [4.5, 0, 1.2, 'x'],
    [2, -2.5, 1.2, 'z'],
  ],
  B: [
    [2, 0, 1.2, 'z'],
    [-2, -2.5, 1.2, 'z'],
    [-2, 2.5, 1.2, 'z'],
  ],
}
function Lintels({ f }) {
  const h = ROOM_H[f]
  return LINTELS[f].map(([x, z, w, axis], i) => (
    <B key={i} p={[x, FL[f] + h - 0.25, z]} s={axis === 'x' ? [w, 0.5, WALL_T] : [WALL_T, 0.5, w]} c={PAPER[f]} />
  ))
}

/** The walls of one storey; they fold down when they stand between her and the camera. */
function Storey({ f, children }) {
  const camera = useThree((s) => s.camera)
  const refs = useRef([])
  const segs = wallsOf(f)
  const h = ROOM_H[f]
  useFrame((_, delta) => {
    const m = useMansion.getState()
    const mine = m.inside && m.floor === f
    const px = player.position.x - MX
    const pz = player.position.z - MZ
    const cx = camera.position.x - MX - px
    const cz = camera.position.z - MZ - pz
    const cl = Math.hypot(cx, cz) || 1
    refs.current.forEach((g) => {
      if (!g) return
      const { mx, mz } = g.userData
      // in front of her, toward the camera: down it folds (to a low stub)
      const toward = ((mx - px) * cx + (mz - pz) * cz) / cl
      const fold = mine && toward > 0.35
      g.scale.y = THREE.MathUtils.damp(g.scale.y, fold ? 0.14 : 1, 10, delta)
    })
  })
  let k = 0
  return (
    <group>
      {segs.map((s, i) => {
        if (s[4] && !s[5]) return null // the doors are drawn as doors
        const exterior = (Math.abs(s[0]) === HW && Math.abs(s[2]) === HW) || (Math.abs(s[1]) === HD && Math.abs(s[3]) === HD)
        const color = f === 'B' ? (exterior ? STONE_DARK : PAPER.B) : f === 'A' ? PAPER.A : exterior ? PLUM : PAPER.G
        const idx = s[5] === 'rail' ? -1 : k++
        return <Wall key={i} s={s} f={f} h={f === 'A' ? 1.0 : h} color={color} innerRef={idx >= 0 ? (el) => (refs.current[idx] = el) : undefined} />
      })}
      {children}
    </group>
  )
}

/* ───────── the doors that open with the story ───────── */

function StoryDoors() {
  const lib = useRef()
  const shelf = useRef()
  const cellar = useRef()
  const hatch = useRef()
  const lock1 = useRef()
  const lock2 = useRef()
  useFrame((_, delta) => {
    const o = (d) => (doorOpen(d) ? 1 : 0)
    if (lib.current) lib.current.rotation.y = THREE.MathUtils.damp(lib.current.rotation.y, o('library') * -1.6, 3, delta)
    if (shelf.current) shelf.current.position.z = THREE.MathUtils.damp(shelf.current.position.z, -2.5 + o('bookcase') * -1.25, 2, delta)
    if (cellar.current) cellar.current.rotation.y = THREE.MathUtils.damp(cellar.current.rotation.y, o('cellar') * 1.6, 3, delta)
    if (hatch.current) hatch.current.rotation.x = THREE.MathUtils.damp(hatch.current.rotation.x, o('hatch') * -1.5, 3, delta)
    if (lock1.current) lock1.current.material = mat(has('dial_open') ? '#9ff0d0' : '#5a4a6e', has('dial_open') ? 1 : 0)
    if (lock2.current) lock2.current.material = mat(has('safe') ? '#9ff0d0' : '#5a4a6e', has('safe') ? 1 : 0)
  })
  const G = FL.G
  return (
    <group>
      {/* the library door (hinged at its west end) */}
      <group ref={lib} position={[3.9, G, 0]}>
        <B p={[0.6, 1.05, 0]} s={[1.2, 2.1, 0.07]} c={WOOD_DARK} />
        <S p={[1.05, 1.0, 0.06]} s={0.035} c="#d9b26a" />
        <B p={[0.6, 1.5, 0.04]} s={[0.5, 0.5, 0.02]} c="#3f5a7a" />
      </group>
      {/* the bookcase that slides away */}
      <group ref={shelf} position={[2.0, G, -2.5]}>
        <group rotation={[0, Math.PI / 2, 0]}>
          <Model f={{ id: 'x', kind: 'bookshelf', w: 1.2, d: 0.3 }} />
        </group>
      </group>
      {/* the cellar door at the top of its stairs */}
      <group ref={cellar} position={[CELLAR_STAIRS.x0, G, CELLAR_STAIRS.z1]}>
        <B p={[0.5, 1.0, 0]} s={[1.0, 2.0, 0.06]} c="#4a3a30" />
        <B p={[0.5, 1.2, 0.04]} s={[0.12, 0.2, 0.02]} c="#d9b26a" />
      </group>
      {/* the attic hatch: a gate across the bottom of the stairs, with two padlocks */}
      <group position={[ATTIC_STAIRS.x0, G, ATTIC_STAIRS.z0]}>
        <group ref={hatch} position={[0, 2.2, 0]}>
          <B p={[0.5, -1.0, 0]} s={[1.0, 2.0, 0.05]} c="#2e2436" />
          {[0.15, 0.5, 0.85].map((x) => (
            <B key={x} p={[x, -1.0, 0.03]} s={[0.03, 1.9, 0.03]} c="#5a4a6e" />
          ))}
          <mesh ref={lock1} position={[0.3, -1.1, 0.07]} material={mat('#5a4a6e')}>
            <boxGeometry args={[0.14, 0.14, 0.06]} />
          </mesh>
          <mesh ref={lock2} position={[0.7, -1.1, 0.07]} material={mat('#5a4a6e')}>
            <boxGeometry args={[0.14, 0.14, 0.06]} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

/** Doors that swing by themselves (a scare); only ever drawn, never in the way. */
function SwingDoors({ storey }) {
  const refs = useRef({})
  useFrame(() => {
    const t = performance.now() / 1000
    const e = fx.door
    for (const [id, g] of Object.entries(refs.current)) {
      if (!g) continue
      const on = e && t < e.until && e.seat === id
      const k = on ? Math.sin(((t - e.t0) / (e.until - e.t0)) * Math.PI) : 0
      g.rotation.y = (SWING_DOORS[id][3] === 'x' ? 1 : 1) * (0.25 + k * (e?.soft ? 0.4 : 1.1))
    }
  })
  return Object.entries(SWING_DOORS).map(([id, [x, z, f, axis]]) => {
    if (f !== storey) return null
    // hinged at one side of the 1.2 m gap, standing mostly open
    const hinge = axis === 'x' ? [x, z - 0.6] : [x - 0.6, z]
    return (
      <group key={id} ref={(el) => (refs.current[id] = el)} position={[hinge[0], FL[f], hinge[1]]}>
        <B p={axis === 'x' ? [0, 1.0, 0.55] : [0.55, 1.0, 0]} s={axis === 'x' ? [0.05, 2.0, 1.1] : [1.1, 2.0, 0.05]} c={WOOD} />
      </group>
    )
  })
}

/* ───────── the special pieces ───────── */

function Mirror() {
  const glass = useRef()
  const doll = useRef()
  useFrame(() => {
    const lit = Boolean(mirrorLit())
    glass.current.material.emissiveIntensity = THREE.MathUtils.lerp(glass.current.material.emissiveIntensity, lit ? 0.9 : 0.08, 0.1)
    doll.current.visible = lit
  })
  const f = FURNITURE.find((x) => x.id === 'mirror')
  return (
    <group position={[f.x, FL.G, f.z + 0.02]}>
      <B p={[0, 1.2, 0]} s={[f.w + 0.16, 1.9, 0.06]} c="#a0843a" />
      <mesh ref={glass} position={[0, 1.2, 0.035]}>
        <planeGeometry args={[f.w - 0.1, 1.7]} />
        <meshStandardMaterial color="#9aa8c8" emissive="#c9d6ff" emissiveIntensity={0.08} roughness={0.05} metalness={0.4} />
      </mesh>
      {/* what only the mirror shows: the doll with the purple ribbon, holding the key */}
      <group ref={doll} position={[0.25, 0.65, 0.045]} visible={false}>
        <S p={[0, 0.12, 0]} s={[0.08, 0.1, 0.01]} c="#f2c6d8" glow={0.4} />
        <S p={[0, 0.27, 0]} s={[0.06, 0.06, 0.01]} c="#ffe0d0" glow={0.4} />
        <B p={[0, 0.34, 0]} s={[0.12, 0.03, 0.01]} c="#9a5ad6" glow={0.8} />
        <B p={[0.09, 0.12, 0]} s={[0.12, 0.025, 0.01]} c="#ffd27f" glow={1.2} />
      </group>
    </group>
  )
}

function Gramophone() {
  const horn = useRef()
  useFrame((_, delta) => {
    if (gramophone()) horn.current.rotation.y += delta * 3
  })
  const f = FURNITURE.find((x) => x.id === 'gramophone')
  return (
    <group position={[f.x, FL.G, f.z]} rotation={[0, FACE.gramophone, 0]}>
      <B p={[0, 0.4, 0]} s={[0.5, 0.8, 0.5]} c={WOOD} />
      <B p={[0, 0.88, 0]} s={[0.36, 0.14, 0.36]} c={WOOD_DARK} />
      <group ref={horn} position={[0, 0.95, 0]}>
        <C p={[0, 0.02, 0]} rt={0.15} h={0.01} c="#1c1620" />
        <C p={[0.08, 0.25, 0.08]} rt={0.02} h={0.4} c="#d9b26a" r={[0.4, 0, -0.4]} />
        <mesh position={[0.2, 0.5, 0.2]} rotation={[0.8, 0, -0.8]} material={mat('#d9b26a', 0.1, 0.4)}>
          <coneGeometry args={[0.22, 0.4, 16, 1, true]} />
        </mesh>
      </group>
    </group>
  )
}

function Dial() {
  useMansion((st) => st.run)
  const wheels = useRef([])
  useFrame((_, delta) => {
    const dial = useMansion.getState().run.dial
    wheels.current.forEach((w, i) => {
      if (w) w.rotation.z = THREE.MathUtils.damp(w.rotation.z, (dial[i] / 6) * Math.PI * 2, 6, delta)
    })
  })
  const f = FURNITURE.find((x) => x.id === 'dial')
  return (
    <group position={[f.x, FL.G + 1.25, f.z + 0.05]}>
      <B p={[0, 0, -0.02]} s={[1.15, 0.55, 0.06]} c="#3d3352" />
      {[0, 1, 2, 3].map((i) => (
        <group key={i} ref={(el) => (wheels.current[i] = el)} position={[-0.42 + i * 0.28, 0, 0.03]}>
          <C p={[0, 0, 0]} rt={0.11} h={0.05} c="#b9a5ff" r={[Math.PI / 2, 0, 0]} glow={has('dial_open') ? 0.8 : 0.1} />
          <B p={[0, 0.07, 0.03]} s={[0.03, 0.06, 0.01]} c="#fff4e4" />
        </group>
      ))}
    </group>
  )
}

function Safe() {
  useMansion((st) => st.run)
  const door = useRef()
  useFrame((_, delta) => {
    door.current.rotation.y = THREE.MathUtils.damp(door.current.rotation.y, has('safe') ? -1.4 : 0, 3, delta)
  })
  const f = FURNITURE.find((x) => x.id === 'safe')
  return (
    <group position={[f.x, FL.B, f.z]}>
      <B p={[0, 0.4, 0]} s={[f.w, 0.8, f.d]} c="#3a3a48" />
      <group ref={door} position={[-f.w / 2 + 0.04, 0.4, f.d / 2]}>
        <B p={[f.w / 2 - 0.04, 0, 0.02]} s={[f.w - 0.1, 0.7, 0.04]} c="#4a4a5a" />
        <C p={[f.w / 2 - 0.04, 0.05, 0.05]} rt={0.08} h={0.03} c="#d9b26a" r={[Math.PI / 2, 0, 0]} />
      </group>
      {!hasItem('candle') && has('safe') && (
        <group position={[0, 0.3, 0]}>
          <C p={[0, 0.1, 0]} rt={0.04} h={0.2} c="#7fb8ff" glow={0.8} />
          <Glow position={[0, 0.25, 0]} color="#9fd0ff" size={0.6} opacity={0.7} />
        </group>
      )}
    </group>
  )
}

function CuckooClock() {
  const ending = useMansion((st) => st.run.ending)
  const bird = useRef()
  const hand = useRef()
  useFrame(({ clock }) => {
    const ending = useMansion.getState().run.ending
    const t = clock.elapsedTime
    // stopped at a quarter past three, until the heirlooms go back in
    if (hand.current) hand.current.rotation.z = ending === 'good' ? -t * 0.5 : -Math.PI * 0.6 + Math.sin(t * 7) * (boss.phase === 2 ? 0.05 : 0)
    if (bird.current) bird.current.position.z = 0.32 + (ending === 'good' && t % 12 < 1.4 ? 0.22 * Math.sin(((t % 12) / 1.4) * Math.PI) : 0)
  })
  const f = FURNITURE.find((x) => x.id === 'cuckoo_clock')
  return (
    <group position={[f.x, FL.A, f.z]}>
      <B p={[0, 0.9, 0]} s={[0.9, 1.8, 0.5]} c="#4a3328" />
      <mesh position={[0, 2.0, 0]} rotation={[0, 0, Math.PI / 4]} scale={[1, 1, 1]} material={mat('#3a2a20')}>
        <boxGeometry args={[0.75, 0.75, 0.5]} />
      </mesh>
      <C p={[0, 1.35, 0.26]} rt={0.3} h={0.03} c="#e8dcc0" r={[Math.PI / 2, 0, 0]} />
      <group ref={hand} position={[0, 1.35, 0.29]}>
        <B p={[0, 0.1, 0]} s={[0.025, 0.22, 0.01]} c="#2e2436" />
      </group>
      <B p={[0, 2.0, 0.26]} s={[0.22, 0.22, 0.02]} c="#1c1620" />
      <group ref={bird} position={[0, 2.0, 0.32]}>
        <S p={[0, 0, 0]} s={[0.07, 0.06, 0.08]} c="#ffd27f" />
        <mesh position={[0, 0, 0.08]} rotation={[Math.PI / 2, 0, 0]} material={mat('#ff8a3a')}>
          <coneGeometry args={[0.02, 0.05, 6]} />
        </mesh>
      </group>
      {/* the four empty niches for the heirlooms */}
      {[0, 1, 2, 3].map((i) => (
        <B key={i} p={[-0.3 + i * 0.2, 0.55, 0.26]} s={[0.14, 0.14, 0.02]} c={ending === 'good' ? '#ffd27f' : '#1c1620'} glow={ending === 'good' ? 0.8 : 0} />
      ))}
    </group>
  )
}

function PartyButton() {
  const top = useRef()
  useFrame(({ clock }) => {
    if (top.current) top.current.material.emissiveIntensity = 0.6 + Math.sin(clock.elapsedTime * 4) * 0.4
  })
  const f = FURNITURE.find((x) => x.id === 'party_button')
  return (
    <group position={[f.x, FL.A, f.z]}>
      <C p={[0, 0.45, 0]} rt={0.16} rb={0.22} h={0.9} c="#3d3352" />
      <mesh ref={top} position={[0, 0.95, 0]}>
        <sphereGeometry args={[0.14, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#ff3a6a" emissive="#ff3a6a" emissiveIntensity={0.8} />
      </mesh>
      <Glow position={[0, 1.0, 0]} color="#ff8fbf" size={0.9} opacity={0.6} />
    </group>
  )
}

/** The boss's lanterns: dark until someone lights them (and he blows them out again). */
function Lanterns() {
  const flames = useRef([])
  useFrame(() => {
    const ending = useMansion.getState().run.ending
    flames.current.forEach((m, i) => {
      if (!m) return
      const on = ending || boss.phase === 4 || lanternLit(i)
      m.visible = on
    })
  })
  return LANTERNS.map(([x, z], i) => (
    <group key={i} position={[x, FL.A, z]}>
      <C p={[0, 0.5, 0]} rt={0.04} rb={0.07} h={1.0} c="#2e2436" />
      <B p={[0, 1.15, 0]} s={[0.26, 0.32, 0.26]} c="#3d3352" />
      <group ref={(el) => (flames.current[i] = el)} visible={false}>
        <mesh position={[0, 1.15, 0]} material={mat('#ffcf8a', 1.6)}>
          <sphereGeometry args={[0.1, 10, 8]} />
        </mesh>
        <Glow position={[0, 1.15, 0]} color="#ffcf8a" size={1.6} opacity={0.8} />
      </group>
    </group>
  ))
}

/** The dolls (they move when nobody's looking: the trickster's count says where each one sits). */
const DOLL_SLOTS = [
  [-6.62, 0.47, -3.7],
  [-6.62, 0.47, -2.6],
  [-6.62, 0.47, -1.5],
  [-6.62, 0.97, -3.7],
  [-6.62, 0.97, -2.6],
  [-6.62, 0.97, -1.5],
  [-6.62, 1.47, -3.3],
  [-6.62, 1.47, -1.9],
  [-5.5, 0.32, -0.6],
  [-4.8, 0, -1.4],
  [-3.6, 0, -3.0],
  [-5.6, 0, -4.2],
]
export const PURPLE_DOLL = 6
const DOLL_COLORS = ['#f2c6d8', '#c9e6f2', '#fff0c8', '#d8f2c9', '#f2d8c9', '#e6c9f2', '#f4e6ff', '#c9f2e6', '#f2f2c9']
function dollSlots(k) {
  // a shuffle of the slots, the same for the same count
  const idx = DOLL_SLOTS.map((_, i) => i)
  let seed = (k + 1) * 9301
  for (let i = idx.length - 1; i > 0; i--) {
    seed = (seed * 49297 + 233280) % 233280
    const j = Math.floor((seed / 233280) * (i + 1))
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  return idx
}
export const dollPos = (i, k) => {
  const [x, y, z] = DOLL_SLOTS[dollSlots(k)[i]]
  return [x, y, z]
}
function Doll({ i }) {
  const g = useRef()
  const world = useMemo(() => new THREE.Vector3(), [])
  useInteractable('mansion:doll:' + i, {
    get position() {
      const [x, , z] = dollPos(i, shown.usil.k)
      const [wx, wz] = W(x, z)
      return world.set(wx, floorY('G'), wz)
    },
    useY: true,
    radius: 0.85,
    label: i === PURPLE_DOLL ? 'Periksa boneka berpita ungu' : 'Periksa boneka',
    enabled: () => has('diary'),
    onInteract: () => {
      audio.hauntSfx?.('squeal', { gain: 0.4 })
      if (i !== PURPLE_DOLL) return toast(pick(['Boneka ini cuma menatap balik. Lama. Banget.', '"Bukan aku~" (bonekanya nggak bicara. Kayaknya.)', 'Bonekanya wangi kapur barus dan rahasia.']))
      if (!has('mirror')) return toast('Boneka berpita ungu ini tersenyum. Tangannya kosong… atau kelihatannya kosong.')
      if (has('key_b')) return toast('Boneka berpita ungu melambai pelan. Sudah, sudah, kuncinya sudah kamu ambil.')
      doStep('key_b')
    },
  })
  useFrame(() => {
    const [x, y, z] = dollPos(i, shown.usil.k)
    g.current.position.set(x, FL.G + y, z)
    g.current.rotation.y = i * 1.3 + (x < -6 ? Math.PI / 2 : 0)
  })
  const c = DOLL_COLORS[i]
  return (
    <group ref={g}>
      <S p={[0, 0.1, 0]} s={[0.08, 0.1, 0.07]} c={c} />
      <S p={[0, 0.24, 0]} s={0.06} c="#ffe8dc" />
      <S p={[-0.02, 0.25, 0.05]} s={0.01} c="#1c1620" />
      <S p={[0.02, 0.25, 0.05]} s={0.01} c="#1c1620" />
      <B p={[0, 0.31, 0]} s={[0.12, 0.03, 0.05]} c={i === PURPLE_DOLL ? '#9a5ad6' : '#e8566f'} />
    </group>
  )
}

/* ───────── the grounds ───────── */

function DeadTree({ s = 1 }) {
  return (
    <group scale={s}>
      <C p={[0, 0.9, 0]} rt={0.1} rb={0.2} h={1.8} c="#3a2e36" seg={7} />
      {[
        [0.5, 1.6, 0.6, -0.8],
        [-0.4, 1.9, -0.3, 0.9],
        [0.2, 2.2, 0.9, -0.3],
        [-0.3, 1.4, 0.5, 1.2],
      ].map(([x, y, a, b], i) => (
        <C key={i} p={[x * 0.6, y, x * 0.2]} rt={0.02} rb={0.06} h={0.9} c="#3a2e36" seg={5} r={[a * 0.4, 0, b]} />
      ))}
    </group>
  )
}
function Pumpkin({ s = 1 }) {
  return (
    <group scale={s}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={i} position={[Math.cos(i) * 0.06, 0.15, Math.sin(i) * 0.06]} scale={[0.9, 0.75, 0.9]} material={mat('#ff8a3a')}>
          <sphereGeometry args={[0.16, 10, 8]} />
        </mesh>
      ))}
      <C p={[0, 0.32, 0]} rt={0.02} h={0.08} c="#4a6a36" />
      <B p={[0, 0.16, 0.2]} s={[0.12, 0.05, 0.01]} c="#ffd27f" glow={1.2} />
      <B p={[-0.05, 0.22, 0.2]} s={[0.04, 0.04, 0.01]} c="#ffd27f" glow={1.2} />
      <B p={[0.05, 0.22, 0.2]} s={[0.04, 0.04, 0.01]} c="#ffd27f" glow={1.2} />
    </group>
  )
}
function Yard() {
  const L = groundLevel()
  const gateL = useRef()
  const gateR = useRef()
  useFrame((_, delta) => {
    // the gate stands open, creaking a little in the wind
    const t = performance.now() / 1000
    if (gateL.current) gateL.current.rotation.y = THREE.MathUtils.damp(gateL.current.rotation.y, 1.2 + Math.sin(t * 0.7) * 0.05, 2, delta)
    if (gateR.current) gateR.current.rotation.y = THREE.MathUtils.damp(gateR.current.rotation.y, -1.25 - Math.sin(t * 0.6 + 1) * 0.05, 2, delta)
  })
  const fence = useMemo(() => {
    const posts = []
    const run = (ax, az, bx, bz) => {
      const n = Math.round(Math.hypot(bx - ax, bz - az) / 0.6)
      for (let i = 0; i <= n; i++) posts.push([ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n, i % 5 === 0])
    }
    run(FENCE.x0, FENCE.z0, FENCE.x1, FENCE.z0)
    run(FENCE.x1, FENCE.z0, FENCE.x1, FENCE.z1)
    run(FENCE.x0, FENCE.z1, FENCE.x1, FENCE.z1)
    run(FENCE.x0, FENCE.z0, FENCE.x0, GATE.z - GATE.half)
    run(FENCE.x0, GATE.z + GATE.half, FENCE.x0, FENCE.z1)
    return posts
  }, [])
  const rails = [
    [FENCE.x0, FENCE.z0, FENCE.x1, FENCE.z0],
    [FENCE.x1, FENCE.z0, FENCE.x1, FENCE.z1],
    [FENCE.x0, FENCE.z1, FENCE.x1, FENCE.z1],
    [FENCE.x0, FENCE.z0, FENCE.x0, GATE.z - GATE.half],
    [FENCE.x0, GATE.z + GATE.half, FENCE.x0, FENCE.z1],
  ]
  const pavers = useMemo(() => {
    const out = []
    for (let i = 0; i < WALK.length - 1; i++) {
      const [ax, az] = WALK[i]
      const [bx, bz] = WALK[i + 1]
      const n = Math.round(Math.hypot(bx - ax, bz - az) / 0.55)
      for (let k = 0; k < n; k++) out.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n, (k * 37) % 7])
    }
    return out
  }, [])
  return (
    <group position={[0, L, 0]}>
      {/* the yard's ground: dark, mossy */}
      <mesh position={[(FENCE.x0 + FENCE.x1) / 2, 0.012, (FENCE.z0 + FENCE.z1) / 2]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <planeGeometry args={[FENCE.x1 - FENCE.x0, FENCE.z1 - FENCE.z0]} />
        <meshStandardMaterial color="#4a5a46" roughness={1} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      {fence.map(([x, z, big], i) => (
        <group key={i} position={[x, 0, z]}>
          <C p={[0, big ? 0.7 : 0.55, 0]} rt={big ? 0.05 : 0.025} h={big ? 1.4 : 1.1} c="#1f1824" seg={5} />
          <mesh position={[0, big ? 1.45 : 1.15, 0]} material={mat('#1f1824')}>
            <coneGeometry args={[big ? 0.07 : 0.04, 0.14, 5]} />
          </mesh>
        </group>
      ))}
      {rails.map(([ax, az, bx, bz], i) => (
        <group key={i} position={[(ax + bx) / 2, 0, (az + bz) / 2]} rotation={[0, Math.atan2(bx - ax, bz - az), 0]}>
          {[0.3, 0.95].map((y) => (
            <B key={y} p={[0, y, 0]} s={[0.03, 0.03, Math.hypot(bx - ax, bz - az)]} c="#1f1824" />
          ))}
        </group>
      ))}
      {/* the gate */}
      <group position={[FENCE.x0, 0, GATE.z]}>
        {[-1, 1].map((k) => (
          <group key={k} position={[0, 0, k * GATE.half]}>
            <C p={[0, 0.9, 0]} rt={0.09} h={1.8} c={STONE_DARK} />
            <S p={[0, 1.88, 0]} s={0.13} c={STONE} />
          </group>
        ))}
        <group ref={gateL} position={[0, 0, -GATE.half]}>
          <B p={[0, 0.8, GATE.half / 2]} s={[0.04, 1.3, GATE.half - 0.05]} c="#1f1824" />
        </group>
        <group ref={gateR} position={[0, 0, GATE.half]}>
          <B p={[0, 0.8, -GATE.half / 2]} s={[0.04, 1.3, GATE.half - 0.05]} c="#1f1824" />
        </group>
        <Html position={[-0.6, 2.1, -GATE.half - 0.5]} center zIndexRange={[12, 0]} className="place-anchor">
          <span className="place-name">Rumah Kurcaci Berhantu</span>
        </Html>
        {/* the sign */}
        <group position={[-0.6, 0, -GATE.half - 0.5]} rotation={[0, -Math.PI / 2, 0]}>
          <C p={[0, 0.6, 0]} rt={0.04} h={1.2} c={WOOD_DARK} />
          <B p={[0, 1.15, 0]} s={[0.9, 0.36, 0.04]} c="#6b4a3a" r={[0, 0, 0.08]} />
          <B p={[0, 1.15, 0.025]} s={[0.7, 0.05, 0.01]} c="#ffd27f" glow={0.5} r={[0, 0, 0.08]} />
        </group>
      </group>
      {pavers.map(([x, z, j], i) => (
        <mesh key={i} position={[x, 0.03, z]} rotation={[-Math.PI / 2, 0, j]} renderOrder={1}>
          <circleGeometry args={[0.24, 7]} />
          <meshStandardMaterial color="#8a8494" roughness={1} polygonOffset polygonOffsetFactor={-3} />
        </mesh>
      ))}
      {YARD_TREES.map(([x, z, s], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, i * 1.7, 0]}>
          <DeadTree s={s} />
        </group>
      ))}
      {PUMPKINS.map(([x, z, s], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, i * 0.9 + 0.5, 0]}>
          <Pumpkin s={s} />
          <Glow position={[0, 0.2, 0.25]} color="#ffb347" size={0.7 * s} opacity={0.45} />
        </group>
      ))}
      {YARD_LAMPS.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0.05 * (i % 2 ? 1 : -1), 0, 0.08 * (i % 3 - 1)]}>
          <C p={[0, 0.9, 0]} rt={0.035} h={1.8} c="#1f1824" />
          <B p={[0, 1.9, 0]} s={[0.2, 0.26, 0.2]} c="#2e2436" />
          <mesh position={[0, 1.9, 0]} material={mat('#9ff0d0', 1.2)}>
            <sphereGeometry args={[0.07, 8, 6]} />
          </mesh>
          <Glow position={[0, 1.9, 0]} color="#9ff0d0" size={1.4} opacity={0.55} />
        </group>
      ))}
      {GRAVES.map(([x, z, r], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, -Math.PI / 2, r]}>
          <B p={[0, 0.3, 0]} s={[0.4, 0.6, 0.1]} c={STONE} />
          <mesh position={[0, 0.6, 0]} rotation={[Math.PI / 2, 0, 0]} material={mat(STONE)}>
            <cylinderGeometry args={[0.2, 0.2, 0.1, 12, 1, false, 0, Math.PI]} />
          </mesh>
          {/* a little mushroom growing on it */}
          <mesh position={[0.12, 0.72, 0]} material={mat('#e8566f')}>
            <sphereGeometry args={[0.06, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/* ───────── the house ───────── */

function Roof() {
  const R = FL.A + 1.0 // the eaves (on the attic's knee walls)
  const ridge = 3.0
  const half = HD + 0.45
  const slope = Math.hypot(half, ridge)
  const ang = Math.atan2(ridge, half)
  const gable = useMemo(() => {
    const sh = new THREE.Shape()
    sh.moveTo(-HD, 0)
    sh.lineTo(HD, 0)
    sh.lineTo(0, ridge * (HD / half))
    sh.closePath()
    return new THREE.ShapeGeometry(sh)
  }, [half])
  return (
    <group>
      {/* the band between the ground floor and the roof (the attic, from outside) */}
      {[
        [0, -HD, 2 * HW, 'x'],
        [0, HD, 2 * HW, 'x'],
        [-HW, 0, 2 * HD, 'z'],
        [HW, 0, 2 * HD, 'z'],
      ].map(([x, z, l, a], i) => (
        <B key={i} p={[x, FL.A - 0.2 + 0.6, z]} s={a === 'x' ? [l + WALL_T, 1.2, WALL_T] : [WALL_T, 1.2, l]} c={PLUM_DARK} />
      ))}
      {[-1, 1].map((k) => (
        <group key={k} position={[0, R + ridge / 2, (k * half) / 2]} rotation={[k * ang, 0, 0]}>
          <B p={[0, 0, 0]} s={[2 * HW + 0.9, 0.14, slope]} c="#3d3352" />
          {/* shingles: a few dark rows */}
          {[-0.3, 0, 0.3].map((r) => (
            <B key={r} p={[0, 0.08, r * slope]} s={[2 * HW + 0.9, 0.02, 0.05]} c="#2e2436" />
          ))}
        </group>
      ))}
      {[-1, 1].map((k) => (
        <mesh key={k} geometry={gable} position={[k * HW, R, 0]} rotation={[0, (k * Math.PI) / 2, 0]} material={mat(PLUM_DARK)} />
      ))}
      {/* the round attic windows in the gables */}
      {[-1, 1].map((k) => (
        <group key={k} position={[k * (HW + 0.02), R + 1.0, 0]} rotation={[0, (k * Math.PI) / 2, 0]}>
          <C p={[0, 0, 0]} rt={0.36} h={0.05} c={TRIM} r={[Math.PI / 2, 0, 0]} />
          <C p={[0, 0, 0.02]} rt={0.3} h={0.02} c="#c9a5ff" glow={0.8} r={[Math.PI / 2, 0, 0]} />
        </group>
      ))}
      {/* the chimney (crooked), and the witch-hat tower at the front corner */}
      <group position={[-4.6, R + 1.6, -1.6]} rotation={[0, 0, 0.08]}>
        <B p={[0, 0.6, 0]} s={[0.6, 1.8, 0.6]} c={STONE_DARK} />
        <B p={[0, 1.55, 0]} s={[0.7, 0.12, 0.7]} c={STONE} />
      </group>
      <group position={[HW - 0.4, 0, HD - 0.4]}>
        <C p={[0, R + 0.6, 0]} rt={0.75} h={1.4} c={PLUM} seg={10} />
        <mesh position={[0, R + 2.1, 0]} rotation={[0.08, 0, -0.12]} material={mat('#3d3352')}>
          <coneGeometry args={[1.0, 1.9, 10]} />
        </mesh>
        <mesh position={[-0.12, R + 3.1, 0.02]} rotation={[0.2, 0, -0.6]} material={mat('#3d3352')}>
          <coneGeometry args={[0.18, 0.5, 8]} />
        </mesh>
        <C p={[0, R + 0.7, 0.74]} rt={0.18} h={0.03} c="#ffd27f" glow={0.9} r={[Math.PI / 2, 0, 0]} />
      </group>
    </group>
  )
}

function Porch() {
  return (
    <group>
      <B p={[0, FL.G - 0.1, (LANDING.z0 + LANDING.z1) / 2]} s={[LANDING.x1 - LANDING.x0, 0.2, LANDING.z1 - LANDING.z0]} c={WOOD} />
      <B p={[0, FL.G / 2 - 0.1, (LANDING.z0 + LANDING.z1) / 2]} s={[LANDING.x1 - LANDING.x0 - 0.1, FL.G - 0.2, LANDING.z1 - LANDING.z0 - 0.05]} c={STONE_DARK} />
      <Flight rect={STAIRS} y0={0} rise={FL.G} dir={-1} color="#7a6a5a" />
      {/* the porch roof on two posts, and its lamp */}
      {[-1, 1].map((k) => (
        <C key={k} p={[k * 1.4, FL.G + 1.2, LANDING.z1 - 0.1]} rt={0.05} h={2.4} c={TRIM} />
      ))}
      <B p={[0, FL.G + 2.45, (LANDING.z0 + LANDING.z1) / 2 + 0.1]} s={[3.3, 0.1, 1.4]} c="#3d3352" r={[-0.2, 0, 0]} />
      <S p={[0, FL.G + 2.1, HD + 0.25]} s={0.08} c="#9ff0d0" glow={1.4} />
      <Glow position={[0, FL.G + 2.1, HD + 0.3]} color="#9ff0d0" size={1.5} opacity={0.5} />
      {/* the front door, ajar */}
      <group position={[0.7, FL.G, HD]} rotation={[0, 1.15, 0]}>
        <B p={[-0.7, 1.1, 0]} s={[1.4, 2.2, 0.08]} c={WOOD_DARK} />
        <C p={[-0.7, 1.5, 0.05]} rt={0.12} h={0.02} c="#d9b26a" r={[Math.PI / 2, 0, 0]} />
      </group>
    </group>
  )
}

/** The cobwebs (gone in the good ending). */
function Cobwebs({ f }) {
  const spots = f === 'G' ? [[-6.8, -4.8], [6.8, -4.8], [-1.85, 4.8], [6.8, 4.8], [-6.8, 0.2]] : f === 'B' ? [[6.8, -4.8], [-6.8, 4.8], [-1.85, -4.8]] : [[-5.3, -4.6], [5.3, -4.6]]
  const h = f === 'A' ? 0.95 : ROOM_H[f] - 0.05
  return spots.map(([x, z], i) => (
    <mesh key={i} position={[x, FL[f] + h - 0.2, z]} rotation={[0, Math.atan2(-x, -z), 0]}>
      <circleGeometry args={[0.32, 6, 0, Math.PI / 2]} />
      <meshBasicMaterial color="#e8e4f0" transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  ))
}

/** The paintings (each with its symbol and Roman numeral, for the wheels). */
const PAINTING_SPOTS = {
  living: [-5.6, 0.09, 'G', 0, '#4a5a8a', '🌙'],
  dolls: [-2.09, -1.2, 'G', -Math.PI / 2, '#8a5a7a', '🍄'],
  kitchen: [6.91, 1.0, 'G', -Math.PI / 2, '#8a6a3a', '🐔'],
  library: [2.09, -0.9, 'G', Math.PI / 2, '#5a4a3a', '🕯️'],
}
function Paintings() {
  const refs = useRef({})
  useFrame(() => {
    // Usil turns one round to face the wall now and then (the "dolls" count, again)
    const flipped = Object.keys(PAINTING_SPOTS)[shown.usil.k % 7]
    for (const [id, g] of Object.entries(refs.current)) if (g) g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, id === flipped && shown.usil.st === 2 ? Math.PI : 0, 0.1)
  })
  return Object.entries(PAINTING_SPOTS).map(([id, [x, z, f, yaw, color]]) => (
    <group key={id} position={[x, FL[f] + 1.45, z]} rotation={[0, yaw, 0]}>
      <group ref={(el) => (refs.current[id] = el)}>
        <B p={[0, 0, 0.02]} s={[0.8, 0.95, 0.04]} c="#a0843a" />
        <B p={[0, 0, 0.045]} s={[0.66, 0.8, 0.01]} c={color} />
        <S p={[0, 0.08, 0.05]} s={[0.14, 0.17, 0.01]} c="#e8d8c8" />
        {/* the eyes (they follow you a little) */}
        <S p={[-0.04, 0.12, 0.058]} s={0.015} c="#1c1620" />
        <S p={[0.04, 0.12, 0.058]} s={0.015} c="#1c1620" />
        <B p={[0.22, -0.3, 0.052]} s={[0.12, 0.08, 0.005]} c="#ffd27f" glow={0.4} />
      </group>
    </group>
  ))
}

/* ───────── everything you can use ───────── */

let cupboardOpened = false
const LEVERS = { hearth: [-6.3, 2.5], oven: [2.75, 1.05] }
function Interactions() {
  const V = (lx, lz, f = 'G') => at(lx, lz, f)
  const ok = () => useStore.getState().view === 'explore' && !player.hide
  const use = (id, def) => useInteractable('mansion:' + id, { useY: true, radius: 1.25, ...def, enabled: () => ok() && (def.enabled ? def.enabled() : true) })
  // the foyer
  use('diary', {
    position: V(-1.45, 0.95),
    label: 'Baca diari di meja',
    onInteract: () => {
      openPanel('diary', 0)
      if (!has('diary')) doStep('diary')
    },
  })
  use('coat_closet', {
    position: V(1.45, 0.95),
    label: 'Buka lemari mantel',
    onInteract: () => {
      audio.hauntSfx?.('door', { gain: 0.7 })
      if (!openedCloset('coat_closet')) toast(pick(['Cuma mantel tua bau kapur barus. Dan satu kaus kaki kiri.', 'Ada payung yang terbuka sendiri. Sial tujuh tahun, katanya.', 'Kosong. Lemarinya kelihatan kecewa.']))
    },
  })
  // the living room
  use('hearth', {
    position: V(...LEVERS.hearth),
    label: () => (has('library_open') ? 'Tuas perapian (sudah terbuka)' : 'Turunkan tuas perapian'),
    onInteract: () => leverPull('hearth'),
  })
  use('piano', {
    position: V(-3.0, 1.05),
    label: 'Main piano tua',
    onInteract: () => {
      audio.hauntSfx?.('musicbox', { gain: 0.8 })
      if (shown.mimi.st === 3) bubble('mimi', 'Lagunya bagus… aku suka.', 2400)
      else toast('Pianonya sumbang. Sebuah tuts menekan dirinya sendiri setelah kamu selesai. Ting.')
    },
  })
  // the kitchen
  use('oven', {
    position: V(...LEVERS.oven),
    label: () => (has('library_open') ? 'Kenop oven (sudah terbuka)' : 'Putar kenop oven'),
    onInteract: () => leverPull('oven'),
  })
  use('cupboard', {
    position: V(3.6, 3.95),
    label: () => (has('key_a') ? 'Lemari ayam (kosong, untuk sekarang)' : cupboardOpened || lastAct('chickens') ? 'Ambil kunci dari ayam terakhir' : 'Buka lemari dapur'),
    onInteract: () => {
      if (has('key_a')) return toast('Lemarinya kosong. Tapi kamu dengar suara "petok" kecil dari dalam. Nggak usah dipikirin.')
      if (!cupboardOpened && !lastAct('chickens')) {
        cupboardOpened = true
        act('chickens')
        audio.hauntSfx?.('cluck', { gain: 1 })
        setTimeout(() => audio.hauntSfx?.('cluck', { gain: 0.8 }), 700)
        toast(CHICKENS.open, 4200)
        setTimeout(() => toast(CHICKENS.last, 4800), 4400)
        return
      }
      cupboardOpened = true
      if (!has('diary')) return toast('Ayamnya menatapmu curiga. Mungkin baca diari di Foyer dulu?')
      toast(CHICKENS.took, 4000)
      doStep('key_a').then(() => doStep('hat'))
    },
  })
  use('cookies', {
    position: V(4.1, 2.0),
    label: () => (hasCookie() ? 'Kamu sudah bawa kue jahe' : 'Ambil kue jahe dari toples'),
    priority: -0.2,
    onInteract: () => {
      if (!takeCookie()) return toast('Satu saja, ya. Toplesnya menggeram pelan.')
      toast('🍪 Kamu bawa satu kue jahe. Siapa tahu ada hantu yang suka camilan.', 3600)
    },
  })
  use('cellar', {
    position: V(6.0, 4.15),
    label: () => (has('basement_open') ? 'Tangga ke ruang bawah tanah' : has('key_a') && has('key_b') ? 'Satukan kunci & buka pintu ruang bawah tanah' : 'Pintu ruang bawah tanah (terkunci)'),
    enabled: () => !has('basement_open'),
    onInteract: () => {
      if (has('key_a') && has('key_b')) {
        audio.hauntSfx?.('unlock')
        return doStep('basement_open')
      }
      toast(`Terkunci. Lubang kuncinya aneh, seperti untuk kunci yang patah jadi dua. (${(has('key_a') ? 1 : 0) + (has('key_b') ? 1 : 0)}/2 potongan)`)
    },
  })
  // the dolls' room
  use('mirror', {
    position: V(...MIRROR_SPOT),
    label: 'Lihat ke cermin',
    onInteract: () => {
      const lit = mirrorLit()
      if (!lit) return toast('Cerminnya terlalu gelap. Kata diari, cermin ini cuma jujur dengan cahaya lilin di lingkaran lantai.', 4200)
      openPanel('mirror')
      if (!has('mirror') && has('diary')) doStep('mirror')
    },
  })
  use('candle_stand', {
    position: V(CANDLE_MARK[0] + 1.3, CANDLE_MARK[1]),
    label: () => (lastAct('candle', null, 15000) ? 'Lilinnya sedang menyala di dudukan' : 'Taruh lilin di dudukan (15 detik)'),
    onInteract: () => {
      if (lastAct('candle', null, 15000)) return
      act('candle', null, 15)
      audio.hauntSfx?.('ignite')
      toast('🕯️ Lilin menyala di dudukan. Cepat, lihat cerminnya!', 3000)
    },
  })
  use('doll_house', {
    position: V(-3.45, -2.6),
    label: 'Intip rumah boneka',
    onInteract: () => {
      if (!has('diary')) return toast('Ada sesuatu yang berkilau di dalam rumah bonekanya.')
      if (hasItem('watch')) return toast('Para boneka kecil di dalamnya sedang minum teh. Nggak sopan mengintip lama-lama.')
      doStep('watch')
    },
  })
  // the library
  use('library_door', {
    position: V(4.5, 0.75),
    label: 'Pintu Perpustakaan (terkunci)',
    enabled: () => !has('library_open'),
    onInteract: () => toast('Terkunci rapat. Di gagangnya tertulis: "Dua tangan, dua tempat, satu waktu."', 3800),
  })
  use('gramophone', {
    position: V(5.7, -1.1),
    label: () => (gramophone() ? 'Gramofon sedang berputar…' : 'Putar gramofon'),
    onInteract: () => {
      if (gramophone()) return
      // alone (or the other person isn't in the house), the crank is wound longer
      const together = partner.online && partner.haunt?.in === 1
      act('gramo', null, together ? 8 : 20)
      audio.hauntSfx?.('gramophone')
      bubble('penjaga', pick(LINES.penjagaDance), 3000)
      toast(together ? '🎵 Gramofon berputar! Pak Penjaga mulai berdansa. Delapan detik, tarik tuasnya!' : '🎵 Engkolnya diputar penuh (20 detik). Cepat ke tuas di samping rak buku!', 3600)
    },
  })
  use('bookcase_lever', {
    position: V(2.55, -3.75),
    label: () => (has('bookcase') ? 'Tuas rak buku (sudah ditarik)' : 'Tarik tuas rak buku'),
    enabled: () => has('library_open'),
    onInteract: () => {
      if (has('bookcase')) return
      audio.hauntSfx?.('lever')
      if (!guardAway()) {
        bubble('penjaga', pick(LINES.penjagaCaught), 2400)
        return toast('Pak Penjaga menghalangi tuasnya. Alihkan perhatiannya dulu…', 3000)
      }
      doStep('bookcase')
    },
  })
  use('book', {
    position: V(4.6, -1.65),
    label: 'Baca buku bersampul ungu',
    onInteract: () => openPanel('book', 0),
  })
  use('musicbox', {
    position: V(2.75, -1.2),
    label: 'Ambil kotak musik mungil',
    enabled: () => has('bookcase') && !hasItem('musicbox'),
    onInteract: () => doStep('musicbox'),
  })
  // the secret corridor
  use('dial', {
    position: V(0.8, -4.2),
    label: () => (has('dial_open') ? 'Roda simbol (menyala)' : 'Putar roda simbol'),
    onInteract: () => openPanel('dial'),
  })
  use('hatch', {
    position: V(-1.4, -4.65),
    label: () => (has('attic_open') ? 'Naik ke loteng' : 'Palka loteng (dua gembok)'),
    enabled: () => !has('attic_open'),
    radius: 1.0,
    onInteract: () => {
      if (has('dial_open') && has('safe')) {
        audio.hauntSfx?.('unlock')
        return doStep('attic_open')
      }
      toast(`Gembok simbol: ${has('dial_open') ? '✓ terbuka' : '✗ terkunci'} · Gembok kunci: ${has('safe') ? '✓ terbuka' : '✗ terkunci (kuncinya di brankas basement)'}`, 4200)
    },
  })
  use('peephole', {
    position: V(1.6, -1.2),
    label: 'Intip lukisan berlubang',
    onInteract: () => toast(pick(['Ada mata yang balik mengintip dari lubangnya. Kalian saling kedip. Canggung.', 'Di balik lubang: Usil sedang mengupil. Dia pura-pura nggak lihat kamu.'])),
  })
  // the basement
  use('safe', {
    position: V(-4.5, -3.75, 'B'),
    label: () => (has('safe') ? (hasItem('candle') ? 'Brankas (kosong)' : 'Ambil lilin biru dari brankas') : 'Buka brankas (3 angka)'),
    onInteract: () => {
      if (!has('safe')) return openPanel('safe')
      if (!hasItem('candle')) doStep('candle')
    },
  })
  use('scrawl', {
    position: V(5.8, -4.3, 'B'),
    label: 'Baca coretan di tembok',
    onInteract: () => useStore.getState().showDiscovery({ kind: 'note', title: 'Coretan Opa di tembok ketel', text: `${WALL_SCRAWL}\n\n(tulisannya miring ke kiri, seperti harus dibaca dari kanan)` }, 8000),
  })
  use('party', {
    position: V(-4.6, 1.6, 'B'),
    label: 'Ngobrol dengan geng gudang anggur',
    onInteract: () => say({ npc: 'mansion:pesta', name: 'Geng Gudang Anggur', role: 'Hantu-hantu (katanya nggak lagi pesta)', text: pick(LINES.pesta), at: [...W(-4.6, 1.6)] }),
  })
  // the attic
  use('clock', {
    position: V(0.8, -3.6, 'A'),
    label: () => (useMansion.getState().run.ending ? 'Jam Kukuk keluarga Kenop' : has('boss_done') ? 'Kembalikan pusaka ke Jam Kukuk' : 'Jam Kukuk Kelam'),
    onInteract: () => {
      if (useMansion.getState().run.ending) return toast('Tik, tok. Waktunya berjalan dengan tenang sekarang.')
      if (!has('boss_done')) return toast('Jarumnya berhenti di pukul tiga lewat sedikit. Ada empat ceruk kosong di bawah wajah jamnya.')
      openPanel('ending')
    },
  })
  use('party_button', {
    position: V(3.2, 1.55, 'A'),
    label: 'Tombol besar yang berkilau',
    onInteract: () => {
      if (useMansion.getState().run.ending) return toast(useMansion.getState().run.ending === 'funny' ? 'Klik. Bola diskonya berputar lebih cepat. Ayam-ayam bersorak.' : 'Tombolnya sudah nggak berkilau. Opa mencabut kabelnya.')
      if (!has('boss_done')) {
        bubble('opa', 'JANGAN SENTUH ITU!', 2000)
        return toast('Tulisannya: "JANGAN DITEKAN". Kayaknya sekarang bukan waktu yang tepat.')
      }
      say({
        npc: 'mansion:button',
        name: 'Tombol besar yang berkilau',
        role: 'Tulisannya: JANGAN DITEKAN',
        text: CHOICE.ask,
        at: [...W(3.2, 1.55)],
        options: [
          { label: CHOICE.funny, kind: 'run', run: () => openPanel('ending') },
          { label: CHOICE.later, kind: 'close' },
        ],
      })
    },
  })
  // the diary's other pages
  DIARY_SPOTS.forEach((spot, i) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useInteractable('mansion:page:' + i, {
      position: spot ? at(spot.x, spot.z, spot.f) : new THREE.Vector3(0, -99, 0),
      useY: true,
      radius: 1.0,
      label: `Baca halaman diari #${i + 1}`,
      enabled: () => Boolean(spot) && ok() && has('diary'),
      onInteract: () => openPanel('diary', i),
    })
  })
  // the paintings
  Object.entries(PAINTING_SPOTS).forEach(([id, [x, z, f, yaw]]) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useInteractable('mansion:painting:' + id, {
      position: at(x + Math.sin(yaw) * 0.7, z + Math.cos(yaw) * 0.7, f),
      useY: true,
      radius: 1.0,
      label: 'Lihat lukisan',
      enabled: ok,
      onInteract: () => useStore.getState().showDiscovery({ kind: 'note', title: 'Lukisan tua', text: PAINTING_TEXT[id] }, 7000),
    })
  })
  // the wardrobes you can hide in
  FURNITURE.filter((f) => f.hide).forEach((f) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useInteractable('mansion:hide:' + f.id, {
      position: at(f.out[0], f.out[1], f.f),
      useY: true,
      radius: 1.0,
      label: 'Sembunyi di lemari',
      enabled: ok,
      onInteract: () => {
        hideIn(f.id)
        // the boiler room's locker is, unfortunately, Pak Dor's
        if (f.id === 'boiler_locker' && Math.random() < 0.3) {
          bubble('dor', LINES.dor[2], 2600)
          setTimeout(() => leaveHide(), 1300)
        } else if (partner.online && partner.hide?.seat === f.id) toast('Sempit, tapi hangat ♡', 2600)
      },
    })
  })
  // the lanterns (hold to light)
  LANTERNS.forEach(([x, z], i) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useInteractable('mansion:lantern:' + i, {
      position: at(x + (x > 0 ? -0.6 : 0.6), z + (z > 0 ? -0.5 : 0.5), 'A'),
      useY: true,
      radius: 1.1,
      priority: 0.5,
      hold: 1.2,
      label: 'Tahan untuk menyalakan lentera',
      enabled: () => ok() && boss.phase === 2 && !lanternLit(i),
      onInteract: () => lightLantern(i),
    })
  })
  return null
}
function leverPull(button) {
  if (has('library_open')) return toast('Tuasnya macet di bawah. Pintu Perpustakaan sudah terbuka, kok.')
  if (!has('diary')) return toast('Tuasnya berat. Mungkin ada petunjuk di Foyer tentang ini.')
  act('press', button)
  audio.hauntSfx?.('lever')
  pressLever(button).then((changed) => {
    if (!has('library_open')) toast(button === 'hearth' ? 'Tuas perapian turun… lalu naik lagi pelan-pelan. Kenop oven harus diputar bersamaan!' : 'Kenop oven berputar… lalu kembali. Tuas perapian harus ditarik bersamaan!', 3400)
    return changed
  })
}

/** The levers' look: down while someone holds them (or for good once the library is open). */
function Levers() {
  useMansion((st) => st.run)
  const refs = useRef({})
  useFrame((_, delta) => {
    for (const id of ['hearth', 'oven']) {
      const g = refs.current[id]
      if (!g) continue
      const down = has('library_open') || lastAct('press', id, 3000)
      g.rotation.x = THREE.MathUtils.damp(g.rotation.x, down ? 0.9 : -0.5, 8, delta)
    }
  })
  return (
    <group>
      <group position={[-6.42, FL.G + 1.0, 3.3]} rotation={[0, Math.PI / 2, 0]}>
        <B p={[0, 0, 0]} s={[0.12, 0.2, 0.04]} c="#3a2a3e" />
        <group ref={(el) => (refs.current.hearth = el)}>
          <C p={[0, 0.15, 0.04]} rt={0.015} h={0.3} c="#d9b26a" />
          <S p={[0, 0.3, 0.04]} s={0.04} c="#e8566f" />
        </group>
      </group>
      <group position={[2.75, FL.G + 0.7, 0.72]}>
        <group ref={(el) => (refs.current.oven = el)}>
          <C p={[0, 0, 0]} rt={0.06} h={0.04} c="#d9b26a" r={[Math.PI / 2, 0, 0]} />
          <B p={[0, 0.03, 0.02]} s={[0.02, 0.06, 0.01]} c="#1c1620" />
        </group>
      </group>
      {/* the bookcase lever */}
      <group position={[2.12, FL.G + 1.1, -3.75]} rotation={[0, Math.PI / 2, 0]}>
        <B p={[0, 0, 0]} s={[0.12, 0.2, 0.04]} c="#3a2a3e" />
        <C p={[0, has('bookcase') ? -0.1 : 0.12, 0.04]} rt={0.015} h={0.26} c="#d9b26a" />
      </group>
    </group>
  )
}

/** Things lifting and settling, or falling (a scare), in the room it's in. */
function Poltergeist() {
  const refs = useRef([])
  const items = useMemo(
    () => [
      ['kitchen', 3.8, 2.6, 0.78, '#cfd8e6'],
      ['kitchen', 4.4, 2.5, 0.78, '#e8566f'],
      ['library', 4.3, -2.2, 0.78, '#7a3f5a'],
      ['library', 4.9, -2.4, 0.78, '#3f5a7a'],
      ['dolls', -5.5, -0.55, 0.32, '#f4e6ff'],
      ['living', -4.3, 3.0, 0.46, '#ffd27f'],
      ['foyer', -1.3, 0.45, 0.74, '#fff4e4'],
      ['corridor', 1.6, -2.0, 0.0, '#8a6a4a'],
    ],
    [],
  )
  useFrame(() => {
    const t = performance.now() / 1000
    const fl = fx.float
    const fa = fx.fall
    items.forEach(([room, x, z, y], i) => {
      const g = refs.current[i]
      if (!g) return
      let lift = 0
      let tilt = 0
      if (fl && t < fl.until && fl.seat === room) {
        const k = (t - fl.t0) / (fl.until - fl.t0)
        lift = Math.sin(Math.min(1, k * 1.25) * Math.PI) * (fl.soft ? 0.3 : 0.8) + Math.sin(t * 5 + i) * 0.03
        tilt = Math.sin(t * 3 + i) * 0.4 * lift
      }
      if (fa && t < fa.until && fa.seat === room && i % 2 === 0) tilt = Math.min(1, (t - fa.t0) * 4) * 1.4
      g.position.set(x, FL[ROOMS[room].f] + y + lift, z)
      g.rotation.set(tilt, i, tilt * 0.5)
    })
  })
  return items.map(([room, , , , c], i) => (
    <group key={i} ref={(el) => (refs.current[i] = el)}>
      {room === 'library' ? <B p={[0, 0.03, 0]} s={[0.22, 0.06, 0.3]} c={c} /> : room === 'kitchen' ? <C p={[0, 0.05, 0]} rt={0.12} rb={0.09} h={0.1} c={c} /> : <S p={[0, 0.06, 0]} s={0.07} c={c} />}
    </group>
  ))
}

/** A shadow crossing the far end of a corridor (a scare). */
function Shadow() {
  const g = useRef()
  useFrame(() => {
    const e = fx.shadow
    const t = performance.now() / 1000
    const on = e && t < e.until && !e.soft
    g.current.visible = Boolean(on)
    if (!on) return
    const k = (t - e.t0) / (e.until - e.t0)
    const r = ROOMS[e.seat] || ROOMS.corridor
    const f = r.f
    g.current.position.set(r.x0 + (r.x1 - r.x0) * k, FL[f] + 0.05, r.z0 + 0.6)
  })
  return (
    <group ref={g} visible={false}>
      <mesh position={[0, 0.8, 0]}>
        <capsuleGeometry args={[0.25, 0.9, 4, 10]} />
        <meshBasicMaterial color="#120c18" transparent opacity={0.75} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.65, 0]}>
        <coneGeometry args={[0.24, 0.6, 8]} />
        <meshBasicMaterial color="#120c18" transparent opacity={0.75} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** A face at a window (a scare): a pale ghost peeking in, for a moment (a friendly wave if gentle). */
function WindowFace() {
  const g = useRef()
  const mouth = useRef()
  useFrame(() => {
    const e = fx.window
    const t = performance.now() / 1000
    const on = e && t < e.until
    g.current.visible = Boolean(on)
    if (!on) return
    const [lx, lz, f, yaw] = SCARE_WINDOWS[e.n] || SCARE_WINDOWS[0]
    const out = 0.25
    g.current.position.set(lx + Math.sin(yaw) * out, FL[f] + 1.45, lz + Math.cos(yaw) * out)
    g.current.rotation.y = yaw + Math.PI
    mouth.current.scale.y = e.soft ? 0.3 : 1
  })
  return (
    <group ref={g} visible={false}>
      <mesh>
        <sphereGeometry args={[0.32, 16, 12]} />
        <meshBasicMaterial color="#e8f0ff" transparent opacity={0.85} toneMapped={false} />
      </mesh>
      <mesh position={[-0.1, 0.06, 0.28]}>
        <sphereGeometry args={[0.06, 8, 6]} />
        <meshBasicMaterial color="#1c1620" />
      </mesh>
      <mesh position={[0.1, 0.06, 0.28]}>
        <sphereGeometry args={[0.06, 8, 6]} />
        <meshBasicMaterial color="#1c1620" />
      </mesh>
      <mesh ref={mouth} position={[0, -0.12, 0.29]}>
        <sphereGeometry args={[0.07, 8, 6]} />
        <meshBasicMaterial color="#1c1620" />
      </mesh>
    </group>
  )
}

/** The funny ending: disco balls, coloured light, bunting. */
function PartyDecor() {
  const balls = useRef([])
  useFrame(({ clock }) => {
    balls.current.forEach((b) => b && (b.rotation.y = clock.elapsedTime * 0.9))
  })
  const spots = [
    [0, FL.G + 2.25, 2.5],
    [0.5, FL.A + 1.9, -0.6],
    [-4.6, FL.B + 1.9, 2.6],
  ]
  return (
    <group>
      {spots.map(([x, y, z], i) => (
        <group key={i} ref={(el) => (balls.current[i] = el)} position={[x, y, z]}>
          <mesh material={mat('#d8d4ec', 0.6, 0.2)}>
            <icosahedronGeometry args={[0.28, 1]} />
          </mesh>
          <Glow color={['#ff8fd0', '#9fd0ff', '#ffe08a'][i]} size={2.4} opacity={0.6} />
        </group>
      ))}
      {[-1, 1].map((k) => (
        <group key={k}>
          {Array.from({ length: 12 }, (_, i) => (
            <mesh key={i} position={[-6.5 + i * 1.18, FL.G + 2.3 - Math.sin((i / 11) * Math.PI) * 0.3, k * 2.4 + 0.1]} rotation={[0, 0, Math.PI]} material={mat(['#ff8fd0', '#ffe08a', '#9fd0ff', '#b9a5ff'][i % 4], 0.6)}>
              <coneGeometry args={[0.1, 0.18, 3]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

/* ───────── the lamps that follow whoever is inside ───────── */

const roomCenter = (id) => {
  const r = ROOMS[id]
  const [x, z] = W((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2)
  return [x, floorY(r.f) + (r.f === 'A' ? 1.8 : ROOM_H[r.f] - 0.35), z]
}
const PARTY = ['#ff8fd0', '#9fd0ff', '#ffe08a', '#b9a5ff']
function HouseLights() {
  const a = useRef()
  const b = useRef()
  const c = useRef()
  const col = useMemo(() => new THREE.Color(), [])
  useFrame(() => {
    const m = useMansion.getState()
    const ending = m.run.ending
    const t = performance.now() / 1000
    // her room's lamp, the other person's room's lamp, and a little glow round her (her lantern)
    const place = (light, room, strength) => {
      if (!light) return
      if (!room) {
        light.intensity = 0
        return
      }
      const [x, y, z] = roomCenter(room)
      light.position.set(x, y, z)
      const k = roomLight(room)
      light.intensity = strength * k * (ending === 'good' ? 1.5 : 1)
      col.set(ending === 'funny' ? PARTY[Math.floor(t * 1.5) % 4] : ending === 'good' ? '#ffd9a0' : ROOMS[room].light)
      light.color.copy(col)
    }
    place(a.current, m.inside ? m.room : null, 9)
    const mateRoom = partner.online && partner.shown.ok && m.onGrounds ? roomAt(partner.shown.x, partner.shown.y, partner.shown.z) : null
    place(b.current, mateRoom && mateRoom !== m.room ? mateRoom : null, 7)
    if (c.current) {
      c.current.position.set(player.position.x, player.position.y + 1.7, player.position.z + 0.2)
      c.current.intensity = m.inside ? 2.2 : 0
    }
  })
  return (
    <group>
      <pointLight ref={a} intensity={0} distance={8} decay={1.6} />
      <pointLight ref={b} intensity={0} distance={8} decay={1.6} />
      <pointLight ref={c} intensity={0} distance={4.5} decay={1.6} color="#ffe2b8" />
    </group>
  )
}

/* ───────── the mansion ───────── */

const CAMERA_IN = 15
export default function Mansion() {
  const view = useStore((s) => s.view)
  const near = useMansion((s) => s.near)
  const ending = useMansion((s) => s.run.ending)
  const controls = useThree((s) => s.controls)
  const camera = useThree((s) => s.camera)
  const ground = useRef()
  const attic = useRef()
  const roof = useRef()
  const cam = useRef({ inside: false, before: null })
  const asked = useRef({})
  const right = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, delta) => {
    tickMansion()
    tickGhosts(delta)
    const m = useMansion.getState()
    // where she hears the house from
    right.setFromMatrixColumn(camera.matrixWorld, 0)
    audio.hauntEar.x = player.position.x
    audio.hauntEar.z = player.position.z
    audio.hauntEar.rx = right.x
    audio.hauntEar.rz = right.z
    const ambience = useStore.getState().view === 'explore' && m.onGrounds ? (m.run.ending === 'funny' ? 'party' : m.run.ending === 'good' ? 'good' : m.room || 'yard') : null
    audio.setHaunt(ambience)
    // the boss's music, while he's up and she's up there with him
    const bossOn = m.floor === 'A' && m.inside && (boss.phase === 1 || boss.phase === 2)
    if (bossOn !== Boolean(cam.current.music)) {
      cam.current.music = bossOn
      audio.setHauntMusic(bossOn)
    }
    // the story moments that only need someone to arrive (asked once; the server keeps them once)
    const once = (step) => {
      if (asked.current[step] || has(step)) return
      asked.current[step] = true
      doStep(step).finally(() => setTimeout(() => (asked.current[step] = false), 2000))
    }
    if (m.inside && !has('enter')) once('enter')
    if (m.inside && m.floor === 'A' && has('attic_open') && !has('boss_seen')) once('boss_seen')
    // storeys above her lift away
    const f = m.floor
    if (ground.current) ground.current.visible = !(m.inside && f === 'B')
    if (attic.current) attic.current.visible = !m.inside || f === 'A'
    if (roof.current) roof.current.visible = !m.inside
    // the camera comes in closer inside, and goes back to where it was outside
    if (controls && m.inside !== cam.current.inside) {
      cam.current.inside = m.inside
      if (m.inside) {
        cam.current.before = controls.distance
        controls.minDistance = Math.min(rig.minDist, 7)
        if (controls.distance > CAMERA_IN) controls.dollyTo(CAMERA_IN, true)
      } else {
        controls.minDistance = rig.minDist
        if (cam.current.before) controls.dollyTo(Math.max(rig.minDist, cam.current.before), true)
        cam.current.before = null
      }
    }
  })
  if (['finale', 'finalRoom'].includes(view)) return null
  return (
    <group>
      <HouseLights />
      {near && (
        <group>
          <Yard />
          <group position={[MX, groundLevel(), MZ]}>
            {/* the basement (its outer walls are the stone foundation) */}
            <group>
              <Slab y={0.02} rect={{ x0: -HW, x1: HW, z0: -HD, z1: HD }} color={FLOOR.B} t={0.04} />
              <Storey f="B">
                <Lintels f="B" />
                <Windows storey="B" />
                <SwingDoors storey="B" />
                {FURNITURE.filter((x) => x.f === 'B').map((x) => (
                  <Piece key={x.id} f={x} />
                ))}
                <Safe />
                <Flight rect={CELLAR_STAIRS} y0={0} rise={FL.G} dir={1} />
                {ending !== 'good' && <Cobwebs f="B" />}
                {/* the boiler room wall's scrawl */}
                <B p={[5.8, 1.4, -HD + 0.1]} s={[1.1, 0.28, 0.01]} c="#e8e4f0" glow={0.3} />
              </Storey>
            </group>
            {/* the ground floor */}
            <group ref={ground}>
              <Slab y={FL.G} rect={{ x0: -HW, x1: HW, z0: -HD, z1: HD }} holes={[CELLAR_STAIRS]} color={FLOOR.G} />
              <Storey f="G">
                <Lintels f="G" />
                <Windows storey="G" />
                <SwingDoors storey="G" />
                <StoryDoors />
                {FURNITURE.filter((x) => x.f === 'G').map((x) => (
                  <Piece key={x.id} f={x} />
                ))}
                <Mirror />
                <Gramophone />
                <Dial />
                <Levers />
                <Paintings />
                {Array.from({ length: 9 }, (_, i) => (
                  <Doll key={i} i={i} />
                ))}
                <Flight rect={ATTIC_STAIRS} y0={FL.G} rise={FL.A - FL.G} dir={1} />
                {/* the candle mark on the dolls' room floor, and the stand beside it */}
                <mesh position={[CANDLE_MARK[0], FL.G + 0.012, CANDLE_MARK[1]]} rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[0.38, 0.46, 24]} />
                  <meshBasicMaterial color="#ffd27f" transparent opacity={0.7} toneMapped={false} />
                </mesh>
                <group position={[CANDLE_MARK[0] + 1.3, FL.G, CANDLE_MARK[1] - 0.4]}>
                  <C p={[0, 0.45, 0]} rt={0.03} rb={0.08} h={0.9} c="#a0843a" />
                  <C p={[0, 0.98, 0]} rt={0.03} h={0.16} c="#fff4e4" />
                </group>
                {/* the rug in the foyer, the chandelier */}
                <B p={[0, FL.G + 0.01, 2.6]} s={[2.4, 0.01, 3.2]} c="#6a3550" />
                <group position={[0, FL.G + 2.2, 2.6]}>
                  <C p={[0, 0.2, 0]} rt={0.01} h={0.4} c="#2e2436" />
                  {[0, 1, 2, 3, 4].map((i) => (
                    <group key={i} position={[Math.cos(i * 1.256) * 0.35, 0, Math.sin(i * 1.256) * 0.35]}>
                      <C p={[0, 0.05, 0]} rt={0.02} h={0.1} c="#fff4e4" glow={0.6} />
                    </group>
                  ))}
                  <Glow color="#ffcf8a" size={1.4} opacity={0.4} />
                </group>
                {ending !== 'good' && <Cobwebs f="G" />}
                <Poltergeist />
                <Chickens />
              </Storey>
            </group>
            {/* the attic */}
            <group ref={attic}>
              <Slab y={FL.A} rect={ATTIC} holes={[ATTIC_STAIRS]} color={FLOOR.A} />
              <Storey f="A">
                {FURNITURE.filter((x) => x.f === 'A').map((x) => (
                  <Piece key={x.id} f={x} />
                ))}
                <CuckooClock />
                <PartyButton />
                <Lanterns />
                {ending !== 'good' && <Cobwebs f="A" />}
              </Storey>
            </group>
            <group ref={roof}>
              <Roof />
            </group>
            <Porch />
            <Shadow />
            <WindowFace />
            {ending === 'funny' && <PartyDecor />}
          </group>
          <Interactions />
          <MansionGhosts />
        </group>
      )}
    </group>
  )
}
