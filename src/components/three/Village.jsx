import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import {
  BERRIES,
  COOP,
  canDeliver,
  deliverCoffee,
  findGlasses,
  FLOWER_BEDS,
  FOUNTAIN,
  gnomeAt,
  gnomeShown,
  GLASSES_SPOT,
  GROVE_HEDGES,
  INGREDIENT_SPOTS,
  INTERIORS,
  LAMP_POSTS,
  LANTERN_STONES,
  NOTICE_BOARD,
  NPC_IDS,
  NPCS,
  pickIngredient,
  QUESTS,
  SHOP_DOOR_W,
  SHOP_WALL_H,
  SHOP_WALL_T,
  SIGNPOST,
  SQUARE_BENCHES,
  STUMPS,
  talkTo,
  tickVillage,
  useVillage,
  VB,
  VEG_PATCH,
  VILLAGE_TREES,
  wantsGlasses,
  wantsIngredient,
  wantsWater,
  waterBed,
  WHEAT,
  canOffer,
} from '../../lib/village'
import { BROOK_HALF_WIDTH, HIDDEN_GROVE, LILY_POND, meadowHeight, VILLAGE_BRIDGE, VILLAGE_BROOK, VILLAGE_BUILDINGS, VILLAGE_PATHS, VILLAGE_SQUARE, villageBridgeAt, villageToLocal, villageToWorld } from '../../lib/meadow'
import { useSeat } from '../../lib/actions'
import { useInteractable } from '../../lib/interactions'
import { partner } from '../../lib/couple'
import { player } from '../../lib/player'
import { atmosphere } from '../../lib/atmosphere'
import { createWater } from '../../lib/water'
import { withPaint } from '../../lib/paint'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'
import { B, C, mat, S } from './HomeFurniture'
import { Glow, LightPools } from './Bits'
import { Gnome } from './Gnome'

/*
 * GNOME VILLAGE — what you see (the logic is lib/village.js, the ground lib/meadow.js): the little
 * houses and the two shops you can walk into, the cobbled square with its fountain, notice board and
 * twin lanterns, the gardens, the brook with its footbridge and lily pond, the hidden grove, and the
 * gnomes going about their day.
 */

const SQ = VILLAGE_SQUARE
const groundY = (x, z) => meadowHeight(x, z)

/** How much the warm lights glow (more in the evening and at night). */
const glowNow = () => 0.25 + 0.95 * Math.max(1 - atmosphere.day, atmosphere.sunset * 0.6)

/* ───────── a canvas label (signs, the notice board) ───────── */

function useLabel(draw, w = 512, h = 192, deps = []) {
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
      g.clearRect(0, 0, w, h)
      draw(g, w, h)
      texture.needsUpdate = true
    }
    paint()
    document.fonts?.ready.then(paint)
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}
function signDraw(title, sub, colors = {}) {
  return (g, w, h) => {
    g.fillStyle = colors.bg || '#fff6ea'
    g.fillRect(0, 0, w, h)
    g.strokeStyle = colors.edge || '#e8798f'
    g.lineWidth = 10
    g.strokeRect(10, 10, w - 20, h - 20)
    g.textAlign = 'center'
    g.fillStyle = colors.ink || '#6b4a5e'
    g.font = "700 50px 'Cormorant Garamond', Georgia, serif"
    g.fillText(title, w / 2, sub ? h * 0.52 : h * 0.62)
    if (sub) {
      g.fillStyle = colors.sub || '#c47a52'
      g.font = "500 24px 'Quicksand', system-ui, sans-serif"
      g.fillText(sub, w / 2, h * 0.8)
    }
  }
}

/* ───────── the buildings ───────── */

/** Pieces of a wall around its openings: [centre, width, y0, y1] → [u0, u1, y0, y1]. */
function wallPieces(len, openings, H) {
  const out = []
  let u = -len / 2
  for (const [c, w, y0, y1] of [...openings].sort((a, b) => a[0] - b[0])) {
    const a = c - w / 2
    const b = c + w / 2
    if (a > u) out.push([u, a, 0, H])
    if (y0 > 0) out.push([a, b, 0, y0])
    if (y1 < H) out.push([a, b, y1, H])
    u = b
  }
  if (u < len / 2) out.push([u, len / 2, 0, H])
  return out
}

const LOOKS = {
  bakery: { wall: '#ffeede', trim: '#a5714a', roof: '#e9a066', spot: '#fff1dc', door: '#c8915f', sign: ['Toko Roti Remah', 'roti · kue · pastry'], chimney: true },
  shop: { wall: '#eef6ef', trim: '#5f8f86', roof: '#5fb3a8', spot: '#fff9e8', door: '#e8798f', sign: ['Pernak-Pernik Kenop', 'dekorasi untuk rumahmu'] },
  elder: { wall: '#f4eefc', trim: '#7a6aae', roof: '#8d72d6', spot: '#fff4fb', door: '#7a5fc4', plate: 'Rumah Tetua Lumut', chimney: true, tall: 1.25 },
  pip: { wall: '#fff3e2', trim: '#9a6b4a', roof: '#e8566f', spot: '#ffffff', door: '#7fae8a', plate: 'Rumah Pip' },
  pim: { wall: '#fff0f6', trim: '#b98aa8', roof: '#c9a5e8', spot: '#fff9ff', door: '#f4a9c4', plate: 'Rumah Nenek Pim' },
  gilo: { wall: '#f1f6e4', trim: '#7a8a52', roof: '#7fbf6a', spot: '#f6ffe8', door: '#c8794e', plate: 'Rumah Gilo' },
}
const WIN_Y = [0.8, 1.5]

function windowsOf(b) {
  if (b.enter) return INTERIORS[b.id].windows
  return [
    ['front', -b.hw * 0.55, 0.55],
    ['front', b.hw * 0.55, 0.55],
    ['left', 0, 0.6],
    ['right', 0, 0.6],
    ['back', 0, 0.6],
  ]
}

/** One wall of a building, with its windows (and the door, on the front). */
function Wall({ b, side, look, glow, innerRef, H, T }) {
  const W = {
    front: { pos: [0, 0, b.hd], rot: 0, len: b.hw * 2 + T, sign: 1 },
    back: { pos: [0, 0, -b.hd], rot: Math.PI, len: b.hw * 2 + T, sign: -1 },
    left: { pos: [-b.hw, 0, 0], rot: -Math.PI / 2, len: b.hd * 2 - T, sign: 1 },
    right: { pos: [b.hw, 0, 0], rot: Math.PI / 2, len: b.hd * 2 - T, sign: -1 },
  }[side]
  const openings = windowsOf(b)
    .filter(([s]) => s === side)
    .map(([, c, w]) => [c * W.sign, w, WIN_Y[0], WIN_Y[1]])
  const doorW = b.enter ? SHOP_DOOR_W : 0.78
  const doorH = b.enter ? 1.8 : 1.3
  if (side === 'front') openings.push([0, doorW, 0, doorH])
  const pieces = wallPieces(W.len, openings, H)
  // decorative houses: the windows are lit from inside (and you can't see in)
  const glass = b.enter ? 0.38 : 0.92
  return (
    <group position={W.pos} rotation={[0, W.rot, 0]}>
      <group ref={innerRef}>
        {pieces.map(([u0, u1, y0, y1], i) => (
          <B key={i} p={[(u0 + u1) / 2, (y0 + y1) / 2, 0]} s={[u1 - u0, y1 - y0, T]} c={look.wall} />
        ))}
        {[-W.len / 2, W.len / 2].map((u) => (
          <B key={u} p={[u, (H + 0.03) / 2, 0]} s={[0.12, H + 0.03, T + 0.04]} c={look.trim} />
        ))}
        <B p={[0, H - 0.045, 0]} s={[W.len - 0.13, 0.1, T + 0.04]} c={look.trim} />
        <B p={[0, 0.14, 0]} s={[W.len + 0.04, 0.28, T + 0.07]} c="#cfc6d6" />
        <group name="decor">
          {openings
            .filter(([, , y0]) => y0 > 0)
            .map(([u, width]) => (
              <group key={u} position={[u, (WIN_Y[0] + WIN_Y[1]) / 2, 0]}>
                {[-1, 1].map((k) => (
                  <group key={k}>
                    <B p={[0, k * ((WIN_Y[1] - WIN_Y[0]) / 2 + 0.03), 0]} s={[width + 0.12, 0.06, T + 0.05]} c="#ffffff" />
                    <B p={[k * (width / 2 + 0.03), 0, 0]} s={[0.06, WIN_Y[1] - WIN_Y[0], T + 0.05]} c="#ffffff" />
                  </group>
                ))}
                <B p={[0, 0, 0]} s={[0.035, WIN_Y[1] - WIN_Y[0], T + 0.03]} c="#ffffff" />
                <mesh>
                  <boxGeometry args={[width, WIN_Y[1] - WIN_Y[0], 0.02]} />
                  <meshStandardMaterial color="#ffe6b8" emissive="#ffc77a" emissiveIntensity={glow * (b.enter ? 1 : 1.3)} transparent opacity={glass} roughness={0.2} />
                </mesh>
                <group position={[0, -(WIN_Y[1] - WIN_Y[0]) / 2 - 0.09, T / 2 + 0.09]}>
                  <B p={[0, 0, 0]} s={[width + 0.08, 0.11, 0.16]} c={look.trim} />
                  {[-0.32, -0.1, 0.12, 0.34].map((x, i) => (
                    <S key={x} p={[x * width, 0.1, 0]} s={0.055} c={['#ff8fbf', '#ffd27f', '#f7f2ff', '#b9a5e8'][i]} />
                  ))}
                </group>
              </group>
            ))}
          {side === 'front' && <Door b={b} look={look} w={doorW} h={doorH} T={T} />}
        </group>
      </group>
    </group>
  )
}

/** A rounded door: shops' swing open as you come close; the little houses' stay shut. */
function Door({ b, look, w, h, T }) {
  const leaf = useRef()
  useFrame((_, delta) => {
    if (!b.enter) return
    const near = (x, z) => {
      const [lx, lz] = villageToLocal(b, x, z)
      return Math.abs(lx) < 1.3 && Math.abs(lz - b.hd) < 1.6
    }
    const open = near(player.position.x, player.position.z) || (partner.online && partner.shown.ok && near(partner.shown.x, partner.shown.z))
    leaf.current.rotation.y = THREE.MathUtils.damp(leaf.current.rotation.y, open ? 1.35 : 0.04, 5, delta)
  })
  return (
    <group>
      {[-1, 1].map((k) => (
        <B key={k} p={[k * (w / 2 + 0.05), h / 2, 0]} s={[0.1, h, T + 0.06]} c={look.trim} />
      ))}
      <mesh position={[0, h, 0]} scale={[1, 0.5, 1]} material={mat(look.trim)}>
        <torusGeometry args={[w / 2 + 0.05, 0.06, 6, 16, Math.PI]} />
      </mesh>
      <group ref={leaf} position={[-w / 2 + 0.02, 0, T / 2 - 0.02]}>
        <B p={[w / 2 - 0.02, h / 2 - 0.01, 0]} s={[w - 0.06, h - 0.02, 0.06]} c={look.door} />
        <mesh position={[w / 2 - 0.02, h - 0.02, 0]} scale={[1, 0.45, 1]} rotation={[Math.PI / 2, 0, 0]} material={mat(look.door)}>
          <cylinderGeometry args={[(w - 0.06) / 2, (w - 0.06) / 2, 0.06, 16, 1, false, 0, Math.PI]} />
        </mesh>
        <S p={[w - 0.16, h * 0.5, 0.05]} s={0.03} c="#ffd27f" glow={0.3} />
        {!b.enter && <S p={[w / 2 - 0.02, h * 0.75, 0.04]} s={[0.08, 0.08, 0.02]} c="#ffe6b8" glow={0.5} />}
      </group>
    </group>
  )
}

/** A soft mushroom-cap roof (a lathe), with spots, and maybe a crooked chimney. */
function Roof({ b, look, H }) {
  const tall = look.tall || 1
  const cap = useMemo(() => {
    const pts = []
    for (let i = 0; i <= 14; i++) {
      const t = i / 14
      const r = 1 - Math.pow(t, 1.5)
      const y = Math.sin(t * Math.PI * 0.5) * 1.6 * tall - 0.1 * Math.sin(t * Math.PI) * (1 - t)
      pts.push(new THREE.Vector2(Math.max(0.001, r), y))
    }
    const g = new THREE.LatheGeometry(pts, 36)
    g.scale(b.hw + 0.55, 1, b.hd + 0.5)
    return g
  }, [b, tall])
  const spots = useMemo(() => {
    const out = []
    for (let i = 0; i < 10; i++) {
      const a = i * 2.4 + b.x
      const t = 0.22 + ((i * 37) % 10) / 24
      const r = 1 - Math.pow(t, 1.5)
      out.push([Math.cos(a) * r * (b.hw + 0.55), Math.sin(t * Math.PI * 0.5) * 1.6 * tall + 0.02, Math.sin(a) * r * (b.hd + 0.5), 0.13 + (i % 3) * 0.04])
    }
    return out
  }, [b, tall])
  const roofMat = useMemo(() => withPaint(new THREE.MeshStandardMaterial({ color: look.roof, roughness: 0.75, side: THREE.DoubleSide }), 'foliage'), [look.roof])
  useEffect(
    () => () => {
      cap.dispose()
      roofMat.dispose()
    },
    [cap, roofMat],
  )
  return (
    <group position={[0, H - 0.02, 0]}>
      <mesh geometry={cap} material={roofMat} castShadow receiveShadow />
      {spots.map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} scale={[r, r * 0.35, r]} material={mat(look.spot, 0, 0.7)}>
          <sphereGeometry args={[1, 10, 6]} />
        </mesh>
      ))}
      {look.chimney && (
        <group position={[b.hw * 0.45, 0.9 * tall, -b.hd * 0.35]} rotation={[0, 0, -0.12]}>
          <B p={[0, 0.3, 0]} s={[0.32, 0.9, 0.32]} c="#cfc6d6" />
          <B p={[0, 0.78, 0]} s={[0.4, 0.08, 0.4]} c="#b9aecb" />
        </group>
      )}
    </group>
  )
}

/** A house or a shop: floor, walls, roof (the roof lifts and the near walls fold when you're inside). */
function Building({ b, children }) {
  const look = LOOKS[b.id]
  const H = b.enter ? SHOP_WALL_H : 1.7
  const T = b.enter ? SHOP_WALL_T : 0.14
  const camera = useThree((s) => s.camera)
  const walls = { front: useRef(), back: useRef(), left: useRef(), right: useRef() }
  const roof = useRef()
  const cut = useRef(0)
  const [glow, setGlow] = useState(0.4)
  const floor = groundY(b.x, b.z)
  const normals = { front: [0, 1], back: [0, -1], left: [-1, 0], right: [1, 0] }
  const sign = useLabel(signDraw(look.sign?.[0] || look.plate, look.sign?.[1], { edge: look.trim }), 512, look.sign ? 192 : 128)
  useFrame((_, delta) => {
    const k = glowNow()
    if (Math.abs(k - glow) > 0.08) setGlow(k)
    if (!b.enter) return
    const inside = useVillage.getState().inside === b.id
    cut.current = THREE.MathUtils.damp(cut.current, inside ? 1 : 0, 6, delta)
    roof.current.visible = cut.current < 0.5
    const [lx, lz] = villageToLocal(b, camera.position.x, camera.position.z)
    const l = Math.hypot(lx, lz) || 1
    for (const side of ['front', 'back', 'left', 'right']) {
      const [nx, nz] = normals[side]
      const facing = (nx * lx + nz * lz) / l > 0.2
      const g = walls[side].current
      g.scale.y = THREE.MathUtils.damp(g.scale.y, facing ? 1 - cut.current * 0.88 : 1, 10, delta)
      const decor = g.getObjectByName('decor')
      if (decor) decor.visible = g.scale.y > 0.7
    }
  })
  return (
    <group position={[b.x, floor, b.z]} rotation={[0, b.yaw, 0]}>
      {/* stone footing and the floor: each a little above the last, so nothing flickers */}
      <B p={[0, -0.135, 0]} s={[b.hw * 2 + 0.4, 0.3, b.hd * 2 + 0.4]} c="#cfc6d6" />
      <B p={[0, 0.0225, 0]} s={[b.hw * 2, 0.015, b.hd * 2]} c={b.enter ? '#e2b98a' : '#d9b48a'} />
      {/* the doorstep */}
      <B p={[0, 0.03, b.hd + 0.32]} s={[1.2, 0.06, 0.45]} c="#cfc6d6" />
      {['front', 'back', 'left', 'right'].map((side) => (
        <Wall key={side} b={b} side={side} look={look} glow={glow} innerRef={walls[side]} H={H} T={T} />
      ))}
      <group ref={roof}>
        <Roof b={b} look={look} H={H} />
      </group>
      {/* the sign over the door, or the name plate by it */}
      {look.sign ? (
        <group position={[0, H + 0.22, b.hd + 0.32]}>
          <B p={[0, 0, -0.03]} s={[1.5, 0.58, 0.05]} c={look.trim} />
          <mesh position={[0, 0, 0.0]}>
            <planeGeometry args={[1.4, 0.52]} />
            <meshStandardMaterial map={sign} roughness={0.85} />
          </mesh>
        </group>
      ) : (
        <mesh position={[0.75, 1.15, b.hd + T / 2 + 0.012]}>
          <planeGeometry args={[0.6, 0.15]} />
          <meshStandardMaterial map={sign} roughness={0.85} />
        </mesh>
      )}
      {/* a lantern by the door */}
      <group position={[-0.72, 1.35, b.hd + 0.16]}>
        <B p={[0, 0.12, -0.07]} s={[0.04, 0.04, 0.16]} c="#6d5a6e" />
        <C p={[0, 0, 0]} rt={0.06} h={0.14} c="#ffd27f" glow={0.4 + glow * 1.6} />
        <C p={[0, 0.09, 0]} rt={0.075} rb={0.03} h={0.05} c="#6d5a6e" />
      </group>
      {children}
    </group>
  )
}

/* ───────── inside the shops ───────── */

function Counter({ c, top = '#f1e4d3', body = '#c8915f' }) {
  const len = c.x1 - c.x0
  const cx = (c.x0 + c.x1) / 2
  return (
    <group>
      <B p={[cx, 0.48, c.z]} s={[len, 0.96, c.d]} c={body} />
      <B p={[cx, 0.99, c.z]} s={[len + 0.06, 0.05, c.d + 0.06]} c={top} />
      {Array.from({ length: Math.max(2, Math.round(len / 0.6)) }, (_, i, a) => (
        <B key={i} p={[c.x0 + 0.25 + (i * (len - 0.5)) / (a.length - 1), 0.48, c.z + c.d / 2 + 0.006]} s={[0.035, 0.84, 0.01]} c="#9a6b4a" />
      ))}
    </group>
  )
}

function BakeryInside({ glow }) {
  const I = INTERIORS.bakery
  const oven = useRef()
  useFrame(({ clock }) => {
    if (oven.current) oven.current.material.emissiveIntensity = 1.2 + Math.sin(clock.elapsedTime * 3) * 0.25
  })
  return (
    <group>
      <Counter c={I.counter} />
      {/* the glass case on the counter, full of pastries */}
      <group position={[(I.counter.x0 + I.counter.x1) / 2 - 0.4, 1.02, I.counter.z + 0.04]}>
        <mesh position={[0, 0.16, 0]}>
          <boxGeometry args={[0.9, 0.3, 0.36]} />
          <meshStandardMaterial color="#eaf6ff" transparent opacity={0.28} roughness={0.1} />
        </mesh>
        {[-0.3, -0.1, 0.1, 0.3].map((x, i) => (
          <S key={x} p={[x, 0.06, 0]} s={[0.07, 0.04, 0.06]} c={['#f7c08a', '#f7a8c4', '#e9c98b', '#d9a066'][i]} />
        ))}
      </group>
      {/* a bread board with dough */}
      <B p={[0.15, 1.035, I.counter.z - 0.08]} s={[0.5, 0.03, 0.3]} c="#d6a77a" />
      <S p={[0.15, 1.08, I.counter.z - 0.08]} s={[0.14, 0.05, 0.1]} c="#fff1dc" />
      {/* the dome oven, glowing */}
      <group position={[I.oven.x, 0, I.oven.z]}>
        <C p={[0, 0.25, 0]} rt={I.oven.r} h={0.5} c="#cfc6d6" />
        <mesh position={[0, 0.5, 0]} material={mat('#e0b48c')}>
          <sphereGeometry args={[I.oven.r, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <mesh ref={oven} position={[-I.oven.r + 0.01, 0.62, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <circleGeometry args={[0.16, 16, 0, Math.PI]} />
          <meshStandardMaterial color="#ff9a4a" emissive="#ff7a2a" emissiveIntensity={1.2} side={THREE.DoubleSide} />
        </mesh>
        <C p={[0.12, 1.4, 0.05]} rt={0.07} h={0.9} c="#9a8aa8" />
      </group>
      <Glow position={[I.oven.x - 0.4, 0.7, I.oven.z]} color="#ffb070" size={1.0} opacity={0.35} />
      {/* the bread rack on the left wall */}
      <group position={[I.rack.x, 0, I.rack.z]}>
        {[0.35, 0.8, 1.25].map((y) => (
          <group key={y}>
            <B p={[0, y, 0]} s={[I.rack.w, 0.04, I.rack.d]} c="#9a6b4a" />
            {[-0.45, -0.15, 0.15, 0.45].map((z, i) => (
              <S key={z} p={[0.02, y + 0.06, z]} s={[0.07, 0.05, 0.12]} c={['#d9a066', '#e9c98b', '#c98a52', '#f7c08a'][(i + Math.round(y * 10)) % 4]} />
            ))}
          </group>
        ))}
        {[-1, 1].map((k) => (
          <B key={k} p={[0, 0.75, k * (I.rack.d / 2 - 0.02)]} s={[I.rack.w, 1.5, 0.04]} c="#9a6b4a" />
        ))}
      </group>
      {/* a little table and stools */}
      <group position={[I.table.x, 0, I.table.z]}>
        <C p={[0, 0.36, 0]} rt={0.05} h={0.66} c="#9a6b4a" seg={8} />
        <C p={[0, 0.7, 0]} rt={I.table.r} h={0.04} c="#fff6ea" seg={20} />
        <C p={[0.12, 0.75, 0]} rt={0.09} h={0.03} c="#ffffff" />
        <S p={[0.12, 0.79, 0]} s={[0.05, 0.03, 0.05]} c="#f7a8c4" />
        {[-0.55, 0.55].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <C p={[0, 0.2, 0]} rt={0.04} h={0.4} c="#9a6b4a" seg={6} />
            <C p={[0, 0.42, 0]} rt={0.17} h={0.05} c="#e8798f" seg={14} />
          </group>
        ))}
      </group>
      {/* flour sacks */}
      {[
        [-1.95, -1.55],
        [-1.65, -1.62],
      ].map(([x, z], i) => (
        <S key={i} p={[x, 0.22, z]} s={[0.2, 0.24, 0.18]} c="#f5ecdc" />
      ))}
      <PendantLamp x={-0.2} z={0.3} glow={glow} />
    </group>
  )
}

function ShopInside({ glow }) {
  const I = INTERIORS.shop
  return (
    <group>
      <Counter c={I.counter} top="#fff6ea" body="#7fb8ae" />
      <B p={[1.2, 1.09, I.counter.z]} s={[0.24, 0.14, 0.2]} c="#a5714a" />
      <S p={[0.45, 1.06, I.counter.z + 0.12]} s={[0.05, 0.04, 0.05]} c="#ffd27f" glow={0.2} />
      {/* the back shelf: little lanterns, pots, gnome statues, toadstools */}
      <group position={[I.shelfBack.x, 0, I.shelfBack.z]}>
        {[0.45, 0.95, 1.45].map((y, row) => (
          <group key={y}>
            <B p={[0, y, 0]} s={[I.shelfBack.w, 0.04, I.shelfBack.d]} c="#9a6b4a" />
            {[-0.6, -0.2, 0.2, 0.6].map((x, i) => {
              const k = (i + row) % 4
              if (k === 0) return <C key={x} p={[x, y + 0.08, 0]} rt={0.05} h={0.12} c="#ffd27f" glow={0.3 + glow * 1.2} />
              if (k === 1)
                return (
                  <group key={x}>
                    <C p={[x, y + 0.07, 0]} rt={0.07} rb={0.05} h={0.11} c="#e08f6a" />
                    <S p={[x, y + 0.17, 0]} s={0.07} c="#79c27c" />
                  </group>
                )
              if (k === 2)
                return (
                  <group key={x}>
                    <C p={[x, y + 0.06, 0]} rt={0.04} rb={0.05} h={0.1} c="#7fae8a" />
                    <mesh position={[x, y + 0.17, 0]} material={mat('#e8566f')}>
                      <coneGeometry args={[0.045, 0.12, 8]} />
                    </mesh>
                  </group>
                )
              return (
                <group key={x}>
                  <C p={[x, y + 0.05, 0]} rt={0.015} h={0.08} c="#fff6ea" />
                  <mesh position={[x, y + 0.1, 0]} scale={[1, 0.55, 1]} material={mat('#f7a8c4')}>
                    <sphereGeometry args={[0.06, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
                  </mesh>
                </group>
              )
            })}
          </group>
        ))}
        {[-1, 1].map((k) => (
          <B key={k} p={[k * (I.shelfBack.w / 2 - 0.02), 0.8, 0]} s={[0.04, 1.6, I.shelfBack.d]} c="#9a6b4a" />
        ))}
      </group>
      {/* the left shelf: flower pots */}
      <group position={[I.shelfLeft.x, 0, I.shelfLeft.z]}>
        {[0.4, 0.9].map((y) => (
          <group key={y}>
            <B p={[0, y, 0]} s={[I.shelfLeft.w, 0.04, I.shelfLeft.d]} c="#9a6b4a" />
            {[-0.5, 0, 0.5].map((z, i) => (
              <group key={z}>
                <C p={[0, y + 0.07, z]} rt={0.07} rb={0.05} h={0.11} c={['#e08f6a', '#f4b6cc', '#bfe3d6'][i]} />
                <S p={[0, y + 0.16, z]} s={0.065} c={['#ff8fbf', '#ffd27f', '#b9a5e8'][i]} />
              </group>
            ))}
          </group>
        ))}
      </group>
      {/* the display table: a toadstool table and a mushroom lamp */}
      <group position={[I.display.x, 0, I.display.z]}>
        <B p={[0, 0.35, 0]} s={[I.display.w, 0.7, I.display.d]} c="#fff6ea" />
        <C p={[-0.2, 0.78, 0]} rt={0.03} h={0.12} c="#fff6ea" />
        <mesh position={[-0.2, 0.85, 0]} scale={[1, 0.55, 1]} material={mat('#e8566f')}>
          <sphereGeometry args={[0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <C p={[0.22, 0.78, 0]} rt={0.02} h={0.14} c="#fff6ea" />
        <mesh position={[0.22, 0.86, 0]} scale={[1, 0.7, 1]}>
          <sphereGeometry args={[0.08, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#ffd6ea" emissive="#ffb3cf" emissiveIntensity={0.4 + glow} />
        </mesh>
      </group>
      {/* bunting */}
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[-1.9 + i * 0.47, 1.85 - Math.sin((i / 8) * Math.PI) * 0.12, 1.2]} rotation={[0, 0, Math.PI]} material={mat(['#ff8fbf', '#ffd27f', '#8fc9b3', '#b9a5e8'][i % 4])}>
          <coneGeometry args={[0.07, 0.14, 3]} />
        </mesh>
      ))}
      <PendantLamp x={0.2} z={0.2} glow={glow} />
    </group>
  )
}

function PendantLamp({ x, z, glow }) {
  return (
    <group position={[x, 1.8, z]}>
      <C p={[0, 0.15, 0]} rt={0.008} h={0.3} c="#5d5363" />
      <mesh>
        <sphereGeometry args={[0.13, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
        <meshStandardMaterial color="#ffe2a8" emissive="#ffc77a" emissiveIntensity={0.4 + glow} side={THREE.DoubleSide} />
      </mesh>
      <Glow position={[0, -0.1, 0]} color="#ffd9a0" size={1.3} opacity={0.2 + glow * 0.2} />
    </group>
  )
}

/* ───────── the square ───────── */

function Square() {
  const y = groundY(SQ.x, SQ.z)
  const water = useMemo(() => createWater({ shape: 'round', center: [FOUNTAIN.x, FOUNTAIN.z], radius: 0.75, deep: '#2aa6b5', shallow: '#8fe3dc' }), [])
  useFrame((_, d) => water.tick(d))
  const cobbles = useMemo(() => {
    const m = new THREE.Matrix4()
    const list = []
    for (let i = 0; i < 150; i++) {
      const a = i * 2.39996
      const r = Math.sqrt((i + 0.5) / 150) * (SQ.r - 0.15)
      if (r < FOUNTAIN.r + 0.2) continue
      const s = 0.13 + ((i * 7) % 5) * 0.012
      m.compose(new THREE.Vector3(SQ.x + Math.cos(a) * r, y + 0.028, SQ.z + Math.sin(a) * r), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, 0)), new THREE.Vector3(s, 0.012, s * 0.8))
      list.push(m.clone())
    }
    return list
  }, [y])
  const cobbleRef = useRef()
  useEffect(() => {
    cobbles.forEach((m, i) => cobbleRef.current.setMatrixAt(i, m))
    cobbleRef.current.instanceMatrix.needsUpdate = true
    cobbleRef.current.computeBoundingSphere()
  }, [cobbles])
  return (
    <group>
      {/* the paved circle (a hair above the level pad) and its rim */}
      <mesh position={[SQ.x, y + 0.015, SQ.z]} rotation={[-Math.PI / 2, 0, 0]} material={mat('#e7dccf', 0, 0.9)}>
        <circleGeometry args={[SQ.r, 48]} />
      </mesh>
      <mesh position={[SQ.x, y + 0.02, SQ.z]} rotation={[-Math.PI / 2, 0, 0]} material={mat('#cfc2d6', 0, 0.9)}>
        <ringGeometry args={[SQ.r - 0.02, SQ.r + 0.16, 48]} />
      </mesh>
      <instancedMesh ref={cobbleRef} args={[null, mat('#d6c9d9', 0, 0.9), cobbles.length]}>
        <sphereGeometry args={[1, 8, 4]} />
      </instancedMesh>
      {/* the toadstool fountain */}
      <group position={[FOUNTAIN.x, y, FOUNTAIN.z]}>
        <C p={[0, 0.17, 0]} rt={FOUNTAIN.r} rb={FOUNTAIN.r + 0.05} h={0.34} c="#cfc6d6" seg={24} />
        <mesh position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]} material={water}>
          <circleGeometry args={[FOUNTAIN.r - 0.1, 32]} />
        </mesh>
        <C p={[0, 0.65, 0]} rt={0.1} rb={0.16} h={0.8} c="#fff6ea" />
        <mesh position={[0, 1.08, 0]} scale={[1, 0.5, 1]} material={mat('#e8798f')}>
          <sphereGeometry args={[0.42, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        {[0, 1.3, 2.6, 3.9, 5.2].map((a, i) => (
          <S key={i} p={[Math.cos(a) * 0.26, 1.2 - (i % 2) * 0.04, Math.sin(a) * 0.26]} s={[0.07, 0.025, 0.07]} c="#fff4f0" />
        ))}
        <FountainDrops />
      </group>
      <NoticeBoard />
      {LANTERN_STONES.map((s) => (
        <LanternStone key={s.id} s={s} />
      ))}
      {SQUARE_BENCHES.map((b) => (
        <Bench key={b.id} b={b} />
      ))}
      {/* lamp posts round the square */}
      {LAMP_POSTS.map((p, i) => (
        <LampPost key={i} x={p.x} z={p.z} />
      ))}
    </group>
  )
}

/** Little drops falling from the toadstool's rim into the basin. */
function FountainDrops() {
  const ref = useRef()
  useFrame(({ clock }) => {
    ref.current.children.forEach((m, i) => {
      const k = (clock.elapsedTime * 0.9 + i / 8) % 1
      const a = (i / 8) * Math.PI * 2
      const r = 0.42 + k * 0.12
      m.position.set(Math.cos(a) * r, 1.02 - k * k * 0.7, Math.sin(a) * r)
    })
  })
  return (
    <group ref={ref}>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} material={mat('#c9f3ff', 0.5, 0.2)}>
          <sphereGeometry args={[0.022, 6, 4]} />
        </mesh>
      ))}
    </group>
  )
}

/** The notice board: what's going on in the village (her jobs). */
function NoticeBoard() {
  const quests = useVillage((s) => s.quests)
  const met = useVillage((s) => s.met)
  const lines = Object.keys(QUESTS).map((id) => {
    const st = quests[id]?.state
    const mark = st === 'done' ? '✓' : st ? '•' : canOffer(id) || !met ? '!' : '·'
    return `${mark} ${QUESTS[id].title}`
  })
  const texture = useLabel(
    (g, w, h) => {
      g.fillStyle = '#f6e7cf'
      g.fillRect(0, 0, w, h)
      g.strokeStyle = '#a5714a'
      g.lineWidth = 14
      g.strokeRect(7, 7, w - 14, h - 14)
      g.fillStyle = '#6b4a5e'
      g.textAlign = 'center'
      g.font = "700 40px 'Cormorant Garamond', Georgia, serif"
      g.fillText('Papan Pengumuman', w / 2, 56)
      g.textAlign = 'left'
      g.font = "500 22px 'Quicksand', system-ui, sans-serif"
      lines.forEach((l, i) => g.fillText(l, 34, 102 + i * 34))
      g.fillStyle = '#c47a52'
      g.font = "italic 500 19px 'Quicksand', system-ui, sans-serif"
      g.fillText('Tanya Tetua Lumut, Gilo, Bu Remah, atau Pip ♡', 34, h - 26)
    },
    512,
    340,
    [lines.join('|')],
  )
  const y = groundY(NOTICE_BOARD.x, NOTICE_BOARD.z)
  return (
    <group position={[NOTICE_BOARD.x, y, NOTICE_BOARD.z]} rotation={[0, NOTICE_BOARD.yaw, 0]}>
      {[-0.5, 0.5].map((x) => (
        <B key={x} p={[x, 0.75, 0]} s={[0.08, 1.5, 0.08]} c="#8a5a3c" />
      ))}
      <B p={[0, 1.08, -0.03]} s={[1.12, 0.78, 0.05]} c="#a5714a" />
      <mesh position={[0, 1.08, 0.0]}>
        <planeGeometry args={[1.04, 0.69]} />
        <meshStandardMaterial map={texture} roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.6, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1, 0.35, 1]} material={mat('#e8798f')}>
        <coneGeometry args={[0.85, 0.5, 4]} />
      </mesh>
    </group>
  )
}

/** A lantern stone: it lights up while someone stands on it; both lit, the twin lanterns blaze. */
function LanternStone({ s }) {
  const lit = useVillage((st) => st.lanterns[s.id])
  const both = useVillage((st) => st.lanterns.a && st.lanterns.b)
  const y = groundY(s.x, s.z)
  const glass = useRef()
  useFrame((_, d) => {
    const target = both ? 3 : lit ? 1.4 : 0.25 + glowNow() * 0.4
    glass.current.material.emissiveIntensity = THREE.MathUtils.damp(glass.current.material.emissiveIntensity, target, 4, d)
  })
  return (
    <group position={[s.x, y, s.z]}>
      <C p={[0, 0.035, 0]} rt={0.5} rb={0.53} h={0.05} c={lit ? '#fff0d0' : '#d9d0e2'} seg={20} />
      <mesh position={[0, 0.062, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mat('#ffd27f', lit ? 0.8 : 0.1)}>
        <ringGeometry args={[0.3, 0.36, 24]} />
      </mesh>
      <group position={[0.5, 0, -0.1]}>
        <C p={[0, 0.7, 0]} rt={0.04} h={1.4} c="#6d5a6e" seg={8} />
        <mesh ref={glass} position={[0, 1.5, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.2, 8]} />
          <meshStandardMaterial color="#ffe2a8" emissive="#ffb85c" emissiveIntensity={0.3} />
        </mesh>
        <C p={[0, 1.64, 0]} rt={0.13} rb={0.04} h={0.08} c="#6d5a6e" />
      </group>
      {both && <Glow position={[0.5, 1.5, -0.1]} color="#ffd27f" size={2.2} opacity={0.55} />}
    </group>
  )
}

function Bench({ b }) {
  const y = groundY(b.x, b.z)
  const [ex, ez] = [b.x + Math.sin(b.yaw) * 0.6, b.z + Math.cos(b.yaw) * 0.6]
  useSeat(b.id, { x: b.x, z: b.z, y: y + 0.45, yaw: b.yaw, exit: [ex, ez], group: b.id, label: 'Duduk' })
  return (
    <group position={[b.x, y, b.z]} rotation={[0, b.yaw, 0]}>
      <B p={[0, 0.42, 0]} s={[1.1, 0.06, 0.4]} c="#c8915f" />
      <B p={[0, 0.68, -0.18]} s={[1.1, 0.3, 0.05]} c="#c8915f" />
      {[-0.45, 0.45].map((x) => (
        <B key={x} p={[x, 0.2, 0]} s={[0.07, 0.4, 0.34]} c="#8a5a3c" />
      ))}
    </group>
  )
}

function LampPost({ x, z }) {
  const y = groundY(x, z)
  const glass = useRef()
  useFrame(() => {
    glass.current.material.emissiveIntensity = 0.3 + glowNow() * 1.6
  })
  return (
    <group position={[x, y, z]}>
      <C p={[0, 0.8, 0]} rt={0.035} rb={0.05} h={1.6} c="#6d5a6e" seg={8} />
      <mesh ref={glass} position={[0, 1.72, 0]}>
        <sphereGeometry args={[0.11, 12, 8]} />
        <meshStandardMaterial color="#ffe2a8" emissive="#ffc77a" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, 1.84, 0]} scale={[1, 0.5, 1]} material={mat('#e8798f')}>
        <sphereGeometry args={[0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
    </group>
  )
}

/* ───────── paths, the brook and the bridge, the lily pond ───────── */

/** Stepping stones along the village footpaths. */
function PathStones() {
  const ref = useRef()
  const mats = useMemo(() => {
    const list = []
    const m = new THREE.Matrix4()
    let k = 0
    for (const p of VILLAGE_PATHS)
      for (let i = 0; i < p.length - 1; i++) {
        const [ax, az] = p[i]
        const [bx, bz] = p[i + 1]
        const l = Math.hypot(bx - ax, bz - az)
        const nx = -(bz - az) / l
        const nz = (bx - ax) / l
        for (let d = 0.3; d < l; d += 0.62) {
          k++
          const side = (k % 2 ? 1 : -1) * 0.16
          const x = ax + ((bx - ax) * d) / l + nx * side
          const z = az + ((bz - az) * d) / l + nz * side
          if (Math.hypot(x - SQ.x, z - SQ.z) < SQ.r + 0.1) continue
          const s = 0.2 + (k % 3) * 0.03
          m.compose(new THREE.Vector3(x, groundY(x, z) + 0.012, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, k * 1.7, 0)), new THREE.Vector3(s, 0.035, s * 0.78))
          list.push(m.clone())
        }
      }
    return list
  }, [])
  useEffect(() => {
    mats.forEach((m, i) => ref.current.setMatrixAt(i, m))
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [mats])
  return (
    <instancedMesh ref={ref} args={[null, mat('#ddd2e0', 0, 0.9), mats.length]}>
      <sphereGeometry args={[1, 9, 5]} />
    </instancedMesh>
  )
}

/** The brook: a ribbon of water following the ground, lined with pebbles; and the lily pond. */
function Brook() {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(VILLAGE_BROOK.map(([x, z]) => new THREE.Vector3(x, 0, z))), [])
  const geometry = useMemo(() => {
    const n = 90
    const pts = curve.getSpacedPoints(n)
    const positions = []
    const uvs = []
    const index = []
    pts.forEach((p, i) => {
      const q = pts[Math.min(n, i + 1)]
      const o = pts[Math.max(0, i - 1)]
      const dx = q.x - o.x
      const dz = q.z - o.z
      const l = Math.hypot(dx, dz) || 1
      const nx = -dz / l
      const nz = dx / l
      // the end widens into the lily pond
      const w = BROOK_HALF_WIDTH * (i > n - 6 ? 1 + (i - (n - 6)) * 0.25 : 1)
      for (const side of [-1, 1]) {
        const x = p.x + nx * w * side
        const z = p.z + nz * w * side
        positions.push(x, groundY(p.x, p.z) + 0.07, z)
        uvs.push(side < 0 ? 0 : 1, (i / n) * 14)
      }
      if (i < n) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    g.setIndex(index)
    g.computeVertexNormals()
    return g
  }, [curve])
  const water = useMemo(() => createWater({ shape: 'ribbon', flow: [0, 0.35], deep: '#1f9fb0', shallow: '#7fdcd4' }), [])
  const pond = useMemo(() => createWater({ shape: 'round', center: [LILY_POND.x, LILY_POND.z], radius: LILY_POND.r, deep: '#1d97a6', shallow: '#78d8cf' }), [])
  useFrame((_, d) => {
    water.tick(d)
    pond.tick(d)
  })
  // pebbles along both banks, and round the pond
  const pebbleRef = useRef()
  const pebbles = useMemo(() => {
    const list = []
    const m = new THREE.Matrix4()
    const pts = curve.getSpacedPoints(120)
    pts.forEach((p, i) => {
      if (i % 2) return
      const q = pts[Math.min(120, i + 1)]
      const dx = q.x - p.x
      const dz = q.z - p.z
      const l = Math.hypot(dx, dz) || 1
      for (const side of [-1, 1]) {
        const x = p.x + (-dz / l) * (BROOK_HALF_WIDTH + 0.08) * side
        const z = p.z + (dx / l) * (BROOK_HALF_WIDTH + 0.08) * side
        if (villageBridgeAt(x, z)) continue
        const s = 0.09 + ((i * 3 + (side > 0 ? 1 : 0)) % 4) * 0.02
        m.compose(new THREE.Vector3(x, groundY(x, z) + 0.03, z), new THREE.Quaternion(), new THREE.Vector3(s, s * 0.6, s))
        list.push(m.clone())
      }
    })
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2
      const x = LILY_POND.x + Math.cos(a) * (LILY_POND.r + 0.1)
      const z = LILY_POND.z + Math.sin(a) * (LILY_POND.r + 0.1)
      const s = 0.12 + (i % 3) * 0.03
      m.compose(new THREE.Vector3(x, groundY(x, z) + 0.04, z), new THREE.Quaternion(), new THREE.Vector3(s, s * 0.6, s))
      list.push(m.clone())
    }
    return list
  }, [curve])
  useEffect(() => {
    pebbles.forEach((m, i) => pebbleRef.current.setMatrixAt(i, m))
    pebbleRef.current.instanceMatrix.needsUpdate = true
    pebbleRef.current.computeBoundingSphere()
  }, [pebbles])
  const pondY = groundY(LILY_POND.x, LILY_POND.z) + 0.07
  const [sx, sz] = VILLAGE_BROOK[0]
  return (
    <group>
      <mesh geometry={geometry} material={water} />
      <instancedMesh ref={pebbleRef} args={[null, mat('#d3cadc', 0, 0.85), pebbles.length]}>
        <sphereGeometry args={[1, 8, 5]} />
      </instancedMesh>
      {/* the spring: a mossy rock the water comes from */}
      <group position={[sx - 0.3, groundY(sx, sz), sz - 0.1]}>
        <mesh scale={[0.9, 0.55, 0.75]} material={mat('#b9aecb', 0, 0.95)}>
          <icosahedronGeometry args={[1, 1]} />
        </mesh>
        <mesh position={[0, 0.42, 0]} scale={[0.7, 0.22, 0.55]} material={mat('#79c27c', 0, 0.95)}>
          <icosahedronGeometry args={[1, 1]} />
        </mesh>
      </group>
      {/* the lily pond */}
      <mesh position={[LILY_POND.x, pondY, LILY_POND.z]} rotation={[-Math.PI / 2, 0, 0]} material={pond}>
        <circleGeometry args={[LILY_POND.r + 0.05, 40]} />
      </mesh>
      {[
        [-0.6, 0.4, '#ff9cc6'],
        [0.5, -0.5, '#ffffff'],
        [0.9, 0.6, null],
        [-0.2, -0.9, '#ffd6ea'],
        [-1.1, -0.2, null],
      ].map(([dx, dz, flower], i) => (
        <group key={i} position={[LILY_POND.x + dx, pondY + 0.01, LILY_POND.z + dz]}>
          <mesh rotation={[-Math.PI / 2, 0, i]} material={mat('#5fae6a', 0, 0.8)}>
            <circleGeometry args={[0.22, 14, 0.3, Math.PI * 1.8]} />
          </mesh>
          {flower && (
            <mesh position={[0, 0.05, 0]} material={mat(flower, 0.15)}>
              <coneGeometry args={[0.07, 0.08, 6]} />
            </mesh>
          )}
        </group>
      ))}
      {/* reeds */}
      {[0.3, 1.1, 2.0, 4.4, 5.3].map((a) => (
        <group key={a} position={[LILY_POND.x + Math.cos(a) * (LILY_POND.r + 0.35), groundY(LILY_POND.x, LILY_POND.z), LILY_POND.z + Math.sin(a) * (LILY_POND.r + 0.35)]}>
          {[-0.06, 0, 0.07].map((x, i) => (
            <C key={x} p={[x, 0.25 + i * 0.05, (i - 1) * 0.04]} rt={0.012} h={0.5 + i * 0.1} c="#79a86a" seg={5} />
          ))}
          <C p={[0, 0.62, -0.04]} rt={0.025} h={0.12} c="#8a5a3c" seg={6} />
        </group>
      ))}
      <Bridge />
    </group>
  )
}

/** The footbridge: a little arched wooden deck with rails (the deck is where she walks, lib/meadow.js). */
function Bridge() {
  const b = VILLAGE_BRIDGE
  const info = villageBridgeAt(b.x, b.z)
  const yaw = Math.atan2(info.ux, info.uz)
  const g0 = groundY(b.x, b.z)
  const planks = []
  for (let i = -6; i <= 6; i++) {
    const t = i / 6
    planks.push([t * b.half, 0.12 + 0.16 * (1 - t * t), t])
  }
  return (
    <group position={[b.x, g0, b.z]} rotation={[0, yaw, 0]}>
      {planks.map(([along, h, t], i) => (
        <B key={i} p={[0, h - 0.03, along]} s={[b.width * 2 + 0.1, 0.06, 0.2]} c={i % 2 ? '#c8915f' : '#b98455'} r={[-Math.atan(-0.32 * t / b.half), 0, 0]} />
      ))}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (b.width + 0.05), 0, 0]}>
          {[-1, -0.33, 0.33, 1].map((t) => (
            <C key={t} p={[0, 0.12 + 0.16 * (1 - t * t) + 0.25, t * b.half]} rt={0.03} h={0.5} c="#9a6b4a" seg={6} />
          ))}
          {[-1, 0, 1].slice(0, 2).map((k, i) => {
            const t0 = i ? 0 : -1
            const t1 = i ? 1 : 0
            const a = t0 * b.half
            const c = t1 * b.half
            const ha = 0.12 + 0.16 * (1 - t0 * t0) + 0.48
            const hc = 0.12 + 0.16 * (1 - t1 * t1) + 0.48
            const len = Math.hypot(c - a, hc - ha)
            return <B key={k} p={[0, (ha + hc) / 2, (a + c) / 2]} s={[0.05, 0.05, len]} c="#c8915f" r={[-Math.atan2(hc - ha, c - a), 0, 0]} />
          })}
        </group>
      ))}
    </group>
  )
}

/* ───────── gardens, the coop, the wheat, the berries, the trees ───────── */

function FlowerBed({ bed }) {
  const thirsty = useVillage((s) => s.quests.siram?.state === 'active' && !s.quests.siram.got.includes(bed.id))
  const y = groundY(bed.x, bed.z)
  const flowers = useRef()
  const [splash, setSplash] = useState(0)
  useFrame((_, d) => {
    const target = thirsty ? 0.55 : 1
    flowers.current.scale.y = THREE.MathUtils.damp(flowers.current.scale.y, target, 3, d)
    flowers.current.rotation.z = THREE.MathUtils.damp(flowers.current.rotation.z, thirsty ? 0.25 : 0, 3, d)
  })
  const position = useMemo(() => new THREE.Vector3(bed.x, y, bed.z), [bed, y])
  useInteractable('village-bed:' + bed.id, {
    position,
    radius: 1.35,
    priority: 0.45,
    hold: 1.0,
    enabled: () => wantsWater(bed.id) && !player.act,
    label: 'Siram bunga 💧 (tahan)',
    onInteract: () => {
      if (waterBed(bed.id)) {
        audio.sparkle()
        setSplash((n) => n + 1)
      }
    },
  })
  return (
    <group position={[bed.x, y, bed.z]}>
      <mesh position={[0, 0.08, 0]} rotation={[Math.PI / 2, 0, 0]} material={mat('#cfc6d6', 0, 0.9)}>
        <torusGeometry args={[bed.r, 0.07, 6, 22]} />
      </mesh>
      <C p={[0, 0.06, 0]} rt={bed.r - 0.02} h={0.06} c="#8a6a52" seg={22} />
      <group ref={flowers}>
        {Array.from({ length: 9 }, (_, i) => {
          const a = i * 2.39996
          const r = Math.sqrt((i + 0.5) / 9) * (bed.r - 0.15)
          return (
            <group key={i} position={[Math.cos(a) * r, 0.09, Math.sin(a) * r]}>
              <C p={[0, 0.1, 0]} rt={0.012} h={0.2} c="#6fae5f" seg={5} />
              <S p={[0, 0.22, 0]} s={0.06} c={thirsty ? '#c9b7a0' : i % 3 ? bed.color : '#fff6ea'} />
            </group>
          )
        })}
      </group>
      {thirsty && <Glow position={[0, 0.5, 0]} color="#9fd8ff" size={0.9} opacity={0.35} />}
      {splash > 0 && <Splash key={splash} />}
    </group>
  )
}

/** A little burst of water drops (watering). */
function Splash() {
  const ref = useRef()
  const t0 = useRef(null)
  useFrame(({ clock }) => {
    if (t0.current === null) t0.current = clock.elapsedTime
    const k = (clock.elapsedTime - t0.current) / 0.9
    ref.current.visible = k < 1
    ref.current.children.forEach((m, i) => {
      const a = (i / 10) * Math.PI * 2
      m.position.set(Math.cos(a) * k * 0.5, 0.4 + k * 0.6 - k * k * 0.9, Math.sin(a) * k * 0.5)
    })
  })
  return (
    <group ref={ref}>
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} material={mat('#9fd8ff', 0.6, 0.2)}>
          <sphereGeometry args={[0.03, 6, 4]} />
        </mesh>
      ))}
    </group>
  )
}

function VegPatch() {
  const { x0, x1, z0, z1 } = VEG_PATCH
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  const y = groundY(cx, cz)
  const rows = []
  for (let z = z0 + 0.35; z < z1 - 0.2; z += 0.55)
    for (let x = x0 + 0.3; x < x1 - 0.2; x += 0.45) rows.push([x - cx, z - cz, Math.round((z - z0) / 0.55) % 2])
  return (
    <group position={[cx, y, cz]}>
      <B p={[0, 0.05, 0]} s={[x1 - x0, 0.1, z1 - z0]} c="#8a6a52" />
      {rows.map(([x, z, kind], i) =>
        kind ? (
          <S key={i} p={[x, 0.17, z]} s={[0.12, 0.09, 0.12]} c={i % 2 ? '#8fc97a' : '#a8d98f'} />
        ) : (
          <group key={i} position={[x, 0.1, z]}>
            <mesh position={[0, 0.02, 0]} rotation={[Math.PI, 0, 0]} material={mat('#f29c4a')}>
              <coneGeometry args={[0.035, 0.08, 8]} />
            </mesh>
            {[-0.03, 0.03].map((dx) => (
              <C key={dx} p={[dx, 0.12, 0]} rt={0.008} h={0.14} c="#6fae5f" seg={4} r={[0, 0, dx * 8]} />
            ))}
          </group>
        ),
      )}
      {/* a little picket fence along the front */}
      {Array.from({ length: Math.round((x1 - x0) / 0.25) + 1 }, (_, i) => (
        <B key={i} p={[x0 - cx + i * 0.25, 0.18, z0 - cz - 0.08]} s={[0.05, 0.36, 0.03]} c="#fff6ea" />
      ))}
      <B p={[0, 0.27, z0 - cz - 0.08]} s={[x1 - x0, 0.04, 0.025]} c="#fff6ea" />
    </group>
  )
}

/** A spot where an ingredient waits (only sparkling while Bu Remah needs it). */
function Ingredient({ what, children }) {
  const wanted = useVillage((s) => s.quests.bahan?.state === 'active' && !s.quests.bahan.got.includes(what))
  const spot = INGREDIENT_SPOTS[what]
  const position = useMemo(() => new THREE.Vector3(spot.x, groundY(spot.x, spot.z), spot.z), [spot])
  useInteractable('village-ingredient:' + what, {
    position,
    radius: 1.2,
    priority: 0.4,
    enabled: () => wantsIngredient(what) && !player.act,
    label: { telur: 'Ambil telur 🥚', gandum: 'Petik gandum 🌾', stroberi: 'Petik stroberi 🍓' }[what],
    onInteract: () => {
      if (pickIngredient(what)) audio.sparkle()
    },
  })
  return (
    <group position={[spot.x, groundY(spot.x, spot.z), spot.z]}>
      {wanted && (
        <>
          {children}
          <Sparkle />
        </>
      )}
    </group>
  )
}
/** A soft twinkle, to say "here!". */
function Sparkle({ y = 0.45 }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    const k = 0.75 + Math.sin(clock.elapsedTime * 4) * 0.25
    ref.current.scale.setScalar(k)
  })
  return (
    <group ref={ref} position={[0, y, 0]}>
      <Glow color="#fff1b8" size={0.8} opacity={0.6} />
    </group>
  )
}

function Coop() {
  const y = groundY(COOP.x, COOP.z)
  return (
    <group position={[COOP.x, y, COOP.z]} rotation={[0, 0.6, 0]}>
      <B p={[0, 0.3, 0]} s={[0.9, 0.5, 0.7]} c="#f1d6b0" />
      <mesh position={[0, 0.72, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1, 0.45, 1]} material={mat('#e8566f')}>
        <coneGeometry args={[0.75, 0.6, 4]} />
      </mesh>
      <B p={[0, 0.22, 0.36]} s={[0.26, 0.28, 0.02]} c="#6d5a6e" />
      {[
        [0.75, 0.25],
        [0.55, 0.65],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, i * 2, 0]}>
          <S p={[0, 0.14, 0]} s={[0.1, 0.09, 0.12]} c="#fffaf2" />
          <S p={[0, 0.24, 0.08]} s={0.05} c="#fffaf2" />
          <S p={[0, 0.3, 0.08]} s={[0.015, 0.025, 0.03]} c="#e8566f" />
          <mesh position={[0, 0.24, 0.135]} rotation={[Math.PI / 2, 0, 0]} material={mat('#ffb347')}>
            <coneGeometry args={[0.015, 0.03, 5]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Wheat() {
  const y = groundY(WHEAT.x, WHEAT.z)
  const stalks = useMemo(() => {
    const out = []
    for (let i = 0; i < 46; i++) {
      const a = i * 2.39996
      const r = Math.sqrt((i + 0.5) / 46) * 0.9
      out.push([Math.cos(a) * r, Math.sin(a) * r, 0.45 + (i % 4) * 0.06])
    }
    return out
  }, [])
  return (
    <group position={[WHEAT.x, y, WHEAT.z]}>
      {stalks.map(([x, z, h], i) => (
        <group key={i} position={[x, 0, z]}>
          <C p={[0, h / 2, 0]} rt={0.01} h={h} c="#d8c06a" seg={4} />
          <S p={[0, h + 0.04, 0]} s={[0.022, 0.06, 0.022]} c="#e9cf7a" />
        </group>
      ))}
    </group>
  )
}

function Berries() {
  const y = groundY(BERRIES.x, BERRIES.z)
  return (
    <group position={[BERRIES.x, y, BERRIES.z]}>
      <mesh position={[0, 0.35, 0]} scale={[0.55, 0.4, 0.5]} material={mat('#5fae6a', 0, 0.9)}>
        <icosahedronGeometry args={[1, 1]} />
      </mesh>
      {Array.from({ length: 10 }, (_, i) => {
        const a = i * 2.39996
        return <S key={i} p={[Math.cos(a) * 0.48, 0.3 + (i % 3) * 0.1, Math.sin(a) * 0.44]} s={0.04} c="#e8566f" />
      })}
    </group>
  )
}

function Trees() {
  return (
    <group>
      {VILLAGE_TREES.map((t, i) => {
        const y = groundY(t.x, t.z)
        return (
          <group key={i} position={[t.x, y, t.z]} scale={t.s}>
            <C p={[0, 0.7, 0]} rt={0.12} rb={0.18} h={1.4} c="#9a6b4a" seg={8} />
            <mesh position={[0, 1.75, 0]} scale={[1, 0.85, 1]} material={mat(t.c, 0, 0.9)}>
              <icosahedronGeometry args={[0.95, 1]} />
            </mesh>
            <mesh position={[0.45, 1.45, 0.25]} scale={0.55} material={mat(t.c, 0, 0.9)}>
              <icosahedronGeometry args={[0.95, 1]} />
            </mesh>
            {t.fruit &&
              [0, 1.6, 3.2, 4.6].map((a) => <S key={a} p={[Math.cos(a) * 0.8, 1.6 + (a % 2) * 0.3, Math.sin(a) * 0.75]} s={0.07} c={t.fruit} />)}
          </group>
        )
      })}
    </group>
  )
}

function Signpost() {
  const y = groundY(SIGNPOST.x, SIGNPOST.z)
  const tex = useLabel(signDraw('Desa Kurcaci →', null, { edge: '#a5714a' }), 384, 96)
  // pointing from the café path toward the square
  const yaw = Math.atan2(SQ.x - SIGNPOST.x, SQ.z - SIGNPOST.z) - Math.PI / 2
  return (
    <group position={[SIGNPOST.x, y, SIGNPOST.z]}>
      <C p={[0, 0.65, 0]} rt={0.04} h={1.3} c="#8a5a3c" seg={8} />
      <group position={[0, 1.1, 0]} rotation={[0, yaw, 0]}>
        <B p={[0.3, 0, -0.025]} s={[0.78, 0.22, 0.04]} c="#a5714a" />
        {[1, -1].map((side) => (
          <mesh key={side} position={[0.3, 0, side * 0.0]} rotation={[0, side < 0 ? Math.PI : 0, 0]}>
            <planeGeometry args={[0.72, 0.18]} />
            <meshStandardMaterial map={tex} roughness={0.9} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/* ───────── the hidden grove ───────── */

function Grove() {
  const found = useVillage((s) => s.quests.rahasia?.state === 'done')
  const y = groundY(HIDDEN_GROVE.x, HIDDEN_GROVE.z)
  const crystals = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => {
        const a = i * 2.39996
        const r = 0.6 + (i % 3) * 0.55
        return [Math.cos(a) * r, Math.sin(a) * r, 0.18 + (i % 4) * 0.07, ['#b9e8ff', '#d9c6ff', '#ffc6e8'][i % 3]]
      }),
    [],
  )
  const flies = useRef()
  useFrame(({ clock }) => {
    flies.current.children.forEach((m, i) => {
      const t = clock.elapsedTime * 0.4 + i * 1.7
      m.position.set(Math.cos(t) * (1.2 + (i % 3) * 0.4), 0.7 + Math.sin(t * 1.3) * 0.25, Math.sin(t * 0.8) * (1.1 + (i % 2) * 0.5))
    })
  })
  return (
    <group>
      {GROVE_HEDGES.map((h, i) => (
        <mesh key={i} position={[h.x, groundY(h.x, h.z) + 0.55 * (h.r / 0.6), h.z]} scale={[h.r, h.r * 1.05, h.r]} material={mat(i % 2 ? '#5fae6a' : '#6fbf74', 0, 0.9)}>
          <icosahedronGeometry args={[1, 1]} />
        </mesh>
      ))}
      <group position={[HIDDEN_GROVE.x, y, HIDDEN_GROVE.z]}>
        {/* a soft mossy floor */}
        <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mat('#9fd89a', 0, 0.95)}>
          <circleGeometry args={[HIDDEN_GROVE.r - 0.5, 32]} />
        </mesh>
        {crystals.map(([x, z, h, c], i) => (
          <group key={i} position={[x, 0, z]}>
            <C p={[0, h / 2, 0]} rt={0.03} h={h} c="#fff6ea" />
            <mesh position={[0, h + 0.02, 0]} scale={[1, 0.6, 1]}>
              <sphereGeometry args={[0.1 + h * 0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color={c} emissive={c} emissiveIntensity={found ? 1.4 : 0.8} roughness={0.25} />
            </mesh>
          </group>
        ))}
        {/* a little stone with a heart */}
        <mesh position={[0, 0.25, -0.2]} scale={[0.35, 0.5, 0.25]} material={mat('#e0d8ea', 0, 0.9)}>
          <icosahedronGeometry args={[1, 1]} />
        </mesh>
        <S p={[0, 0.42, 0.03]} s={[0.07, 0.06, 0.02]} c="#ff8fbf" glow={0.8} />
        <group ref={flies}>
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={i} material={mat('#fff1a8', 1.5)}>
              <sphereGeometry args={[0.025, 6, 4]} />
            </mesh>
          ))}
        </group>
        <Glow position={[0, 0.6, 0]} color="#d9c6ff" size={3} opacity={found ? 0.35 : 0.2} />
      </group>
    </group>
  )
}

/* ───────── the elder's spectacles, and Nenek Pim's door ───────── */

function Glasses() {
  const wanted = useVillage((s) => s.quests.kacamata?.state === 'active' && s.quests.kacamata.n === 0)
  const y = groundY(GLASSES_SPOT.x, GLASSES_SPOT.z)
  const position = useMemo(() => new THREE.Vector3(GLASSES_SPOT.x, y, GLASSES_SPOT.z), [y])
  useInteractable('village-glasses', {
    position,
    radius: 1.2,
    priority: 0.5,
    enabled: () => wantsGlasses() && !player.act,
    label: 'Ambil kacamata 👓',
    onInteract: () => {
      findGlasses()
      audio.sparkle()
    },
  })
  return (
    <group position={[GLASSES_SPOT.x, y, GLASSES_SPOT.z]}>
      {/* the big toadstool it's under */}
      <group position={[0.15, 0, -0.3]}>
        <C p={[0, 0.35, 0]} rt={0.12} rb={0.16} h={0.7} c="#fff6ea" />
        <mesh position={[0, 0.72, 0]} scale={[1, 0.55, 1]} material={mat('#e8566f')}>
          <sphereGeometry args={[0.48, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        {[0, 1.5, 3, 4.5].map((a) => (
          <S key={a} p={[Math.cos(a) * 0.3, 0.88, Math.sin(a) * 0.3]} s={[0.07, 0.025, 0.07]} c="#ffffff" />
        ))}
      </group>
      {wanted && (
        <group position={[-0.1, 0.05, 0.1]}>
          {[-0.05, 0.05].map((x) => (
            <mesh key={x} position={[x, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mat('#e8c46a', 0.4)}>
              <torusGeometry args={[0.035, 0.008, 6, 14]} />
            </mesh>
          ))}
          <Sparkle y={0.3} />
        </group>
      )}
    </group>
  )
}

function PimDoor() {
  const b = VB.pim
  const position = useMemo(() => {
    const [x, z] = villageToWorld(b, 0, b.hd + 0.5)
    return new THREE.Vector3(x, groundY(x, z), z)
  }, [b])
  useInteractable('village-pim-door', {
    position,
    radius: 1.4,
    priority: 0.6,
    enabled: canDeliver,
    label: 'Antar kopi untuk Nenek Pim ☕',
    onInteract: () => {
      if (deliverCoffee()) audio.sparkle()
    },
  })
  return null
}

/* ───────── the gnomes ───────── */

/** Is there something for her from this gnome? '!' a job to take, '?' a job to hand in. */
function useMarker(id) {
  return useVillage((s) => {
    const ids = Object.keys(QUESTS).filter((q) => QUESTS[q].giver === id)
    if (ids.some((q) => s.quests[q]?.state === 'ready')) return '?'
    if (id === 'lumut' && !s.met) return '!'
    if (ids.some((q) => !s.quests[q] && (!QUESTS[q].after || s.quests[QUESTS[q].after]?.state === 'done') && (q !== 'kacamata' || s.met))) return '!'
    return null
  })
}

const SEATED = new Set(['sit', 'sleep'])
function VillageGnome({ id }) {
  const npc = NPCS[id]
  const group = useRef()
  const pos = useRef(null)
  const pose = useRef({ mode: 'idle' })
  const world = useMemo(() => new THREE.Vector3(), [])
  const marker = useMarker(id)
  const glasses = useVillage((s) => (id === 'lumut' ? ['ready', 'done'].includes(s.quests.kacamata?.state) : null))
  const look = useMemo(() => ({ ...npc.look, glasses: id === 'lumut' ? glasses : npc.look.glasses }), [npc, id, glasses])
  useInteractable('gnome:' + id, {
    get position() {
      const g = gnomeShown[id]
      return world.set(g.x, g.y, g.z)
    },
    radius: 1.45,
    priority: 0.3,
    enabled: () => gnomeShown[id].ok && !player.act && useStore.getState().view === 'explore',
    label: () => `Ngobrol dengan ${npc.name}${marker === '!' ? ' ❗' : marker === '?' ? ' ❓' : ''}`,
    onInteract: () => {
      audio.sparkle()
      talkTo(id)
    },
  })
  useFrame((_, delta) => {
    const g = gnomeAt(id)
    const talking = useVillage.getState().talk?.npc === id
    if (!pos.current) pos.current = { x: g.x, z: g.z, yaw: g.yaw }
    const p = pos.current
    let mode = g.mode
    let yaw = g.yaw
    if (talking) {
      // stop and turn to her (on her screen only; the other person's village carries on)
      yaw = Math.atan2(player.position.x - p.x, player.position.z - p.z)
      if (!SEATED.has(mode)) mode = 'talk'
      else if (mode === 'sleep') mode = 'sit'
    } else {
      const dx = g.x - p.x
      const dz = g.z - p.z
      const d = Math.hypot(dx, dz)
      if (d > 5) {
        p.x = g.x
        p.z = g.z
      } else if (d > 0.001) {
        const step = Math.min(d, Math.max(1.2, d * 2) * delta)
        p.x += (dx / d) * step
        p.z += (dz / d) * step
        if (!g.walking && d > 0.15) {
          mode = 'walk'
          yaw = Math.atan2(dx, dz)
        }
      }
    }
    let dy = yaw - p.yaw
    dy = Math.atan2(Math.sin(dy), Math.cos(dy))
    p.yaw += dy * Math.min(1, delta * 8)
    let y = groundY(p.x, p.z)
    if (npc.inside) y += 0.03
    if (SEATED.has(mode) || (mode === 'read' && id === 'pim')) y += 0.22
    group.current.position.set(p.x, y, p.z)
    group.current.rotation.y = p.yaw
    const shown = gnomeShown[id]
    shown.x = p.x
    shown.z = p.z
    shown.y = y
    shown.ok = true
    pose.current = { mode: mode === 'read' && id === 'pim' ? 'read' : mode, tool: g.tool }
  })
  useEffect(() => () => (gnomeShown[id].ok = false), [id])
  return (
    <group>
      <group ref={group}>
        <group scale={npc.scale}>
          <Gnome look={look} pose={() => pose.current} />
        </group>
        {marker && (
          <Html position={[0, 1.45 * npc.scale, 0]} center zIndexRange={[14, 0]} className="plant-anchor">
            <span className={`gnome-mark${marker === '?' ? ' is-ready' : ''}`}>{marker}</span>
          </Html>
        )}
      </group>
    </group>
  )
}

/** The stumps the gnomes sit on. */
function Stumps() {
  return (
    <group>
      {STUMPS.map((s) => (
        <group key={s.id} position={[s.x, groundY(s.x, s.z), s.z]}>
          <C p={[0, 0.11, 0]} rt={0.19} rb={0.22} h={0.22} c="#a5714a" seg={12} />
          <C p={[0, 0.222, 0]} rt={0.17} h={0.006} c="#e2b98a" seg={12} />
        </group>
      ))}
    </group>
  )
}

/* ───────── the village ───────── */

export default function Village() {
  const view = useStore((s) => s.view)
  const near = useVillage((s) => s.near)
  const root = useRef()
  const [glow, setGlow] = useState(0.4)
  useFrame((_, delta) => {
    tickVillage(Math.min(delta, 0.1))
    const k = glowNow()
    if (Math.abs(k - glow) > 0.1) setGlow(k)
  })
  const pools = useMemo(() => {
    const list = LAMP_POSTS.map(({ x, z }) => ({ x, y: groundY(x, z), z }))
    for (const b of VILLAGE_BUILDINGS) {
      const [x, z] = villageToWorld(b, -0.6, b.hd + 0.7)
      list.push({ x, y: groundY(x, z), z })
    }
    return list
  }, [])
  if (['finale', 'finalRoom'].includes(view)) return null
  return (
    <group ref={root} visible={near}>
      {VILLAGE_BUILDINGS.map((b) => (
        <Building key={b.id} b={b}>
          {b.id === 'bakery' && <BakeryInside glow={glow} />}
          {b.id === 'shop' && <ShopInside glow={glow} />}
        </Building>
      ))}
      <Square />
      <PathStones />
      <Brook />
      {FLOWER_BEDS.map((bed) => (
        <FlowerBed key={bed.id} bed={bed} />
      ))}
      <VegPatch />
      <Berries />
      <Coop />
      <Wheat />
      <Trees />
      <Signpost />
      <Grove />
      <Glasses />
      <PimDoor />
      <Stumps />
      <Ingredient what="telur">
        <S p={[0, 0.06, 0]} s={[0.05, 0.065, 0.05]} c="#fffaf2" />
      </Ingredient>
      <Ingredient what="gandum">
        <group>
          {[-0.04, 0, 0.04].map((x) => (
            <C key={x} p={[x, 0.15, 0]} rt={0.01} h={0.3} c="#e9cf7a" seg={4} r={[0, 0, x * 3]} />
          ))}
        </group>
      </Ingredient>
      <Ingredient what="stroberi">
        <mesh position={[0, 0.06, 0]} rotation={[Math.PI, 0, 0]} material={mat('#e8566f')}>
          <coneGeometry args={[0.05, 0.09, 8]} />
        </mesh>
      </Ingredient>
      {near && NPC_IDS.map((id) => <VillageGnome key={id} id={id} />)}
      <LightPools points={pools} size={4} />
    </group>
  )
}
