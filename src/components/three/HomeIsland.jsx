import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { HOME_ISLAND, homeDistance, homeHeight, onSkyBridge, SKY_BRIDGE, skyBridgeHeight } from '../../lib/terrain'
import { player, walkTo } from '../../lib/player'
import { useInteractable } from '../../lib/interactions'
import { withPaint } from '../../lib/paint'
import { coupleAvailable, partner, useCouple } from '../../lib/couple'
import { cancelDraft, moveDraft, nudgeDraft, pickItem, placeDraft, playerInHouse, removeDraft, rotateDraft, stopEditing, toggleLights, useHome } from '../../lib/home'
import { useSeat } from '../../lib/actions'
import {
  CATALOG,
  DOOR,
  DOOR_X,
  GARDEN_PATH,
  HOUSE,
  IN,
  LANDING,
  layerOf,
  MEMORY_CORNER,
  OUTER,
  PARTITION,
  PORCH,
  rectOf,
  toLocal,
  toWorld,
  WALL_H,
  WALL_T,
  WINDOW_Y,
  WINDOWS,
} from '../../lib/homeLayout'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'
import { couple } from '../../content/config'
import Furniture, { B, C, mat, S } from './HomeFurniture'
import { Glow, HeartMesh } from './Bits'
import Tappable from './Interact'

/*
 * OUR LITTLE HOME, in the world: a small island of its own north of the main island, a rope
 * bridge across the sky to reach it, and the house the two of you build and decorate together.
 * When she steps inside (or decorates), the roof lifts away and the walls between her and the
 * camera fold down, so the rooms can be seen from the usual camera without changing it.
 */

const FLOOR_Y = 0.025
const tmp = new THREE.Vector3()

/** Tap the home island (or the bridge, or the floor) to walk there, like the main island. */
function tapWalk(e) {
  const s = useStore.getState()
  if (s.view !== 'explore' || s.phase !== 'world' || e.delta > 8 || useHome.getState().editing) return
  walkTo(e.point.x, e.point.z, 0.2)
  player.onArrive = null
}

/* ───────── the island and the bridge ───────── */

function HomeGround() {
  const { top, under } = useMemo(() => {
    const rows = 18
    const segs = 72
    const pos = []
    const col = []
    const idx = []
    const c = new THREE.Color()
    const grass = new THREE.Color('#82c25c')
    const light = new THREE.Color('#a9d46a')
    for (let r = 0; r <= rows + 1; r++) {
      const f = r <= rows ? Math.max(0.0001, r / rows) : 1.03
      for (let s = 0; s <= segs; s++) {
        const a = (s / segs) * Math.PI * 2
        // walk out to the coast along this angle
        let R = HOME_ISLAND.r * 1.2
        for (let k = 0; k < 8; k++) R = (R / homeDistance(HOME_ISLAND.x + Math.cos(a) * R, HOME_ISLAND.z + Math.sin(a) * R)) * 0.999
        const x = HOME_ISLAND.x + Math.cos(a) * R * f
        const z = HOME_ISLAND.z + Math.sin(a) * R * f
        pos.push(x, r <= rows ? homeHeight(x, z) : homeHeight(x, z) - 0.25, z)
        const n = 0.5 + 0.5 * Math.sin(x * 1.3) * Math.cos(z * 1.1)
        c.copy(grass).lerp(light, (1 - f) * 0.5 + n * 0.15)
        col.push(c.r, c.g, c.b)
      }
    }
    for (let r = 0; r <= rows; r++)
      for (let s = 0; s < segs; s++) {
        const a = r * (segs + 1) + s
        const b = a + segs + 1
        idx.push(a, a + 1, b, b, a + 1, b + 1)
      }
    const top = new THREE.BufferGeometry()
    top.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    top.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    top.setIndex(idx)
    top.computeVertexNormals()

    // the rock underneath: a rough cone, warm soil on top, darker stone below
    const profile = [
      [1.03, -0.3],
      [0.95, -1.1],
      [0.8, -2.2],
      [0.6, -3.4],
      [0.38, -4.6],
      [0.16, -5.8],
      [0.0001, -6.6],
    ]
    const upos = []
    const ucol = []
    const uidx = []
    const topC = new THREE.Color('#c99b6c')
    const botC = new THREE.Color('#7a5c4b')
    profile.forEach(([f, y], row) => {
      for (let s = 0; s <= 40; s++) {
        const a = (s / 40) * Math.PI * 2
        const j = row === 0 || row === profile.length - 1 ? 0 : 0.08 * Math.sin(a * 5 + row * 1.7)
        const R = HOME_ISLAND.r * f * (1 + j)
        upos.push(HOME_ISLAND.x + Math.cos(a) * R, HOME_ISLAND.level + y, HOME_ISLAND.z + Math.sin(a) * R)
        c.copy(topC).lerp(botC, row / (profile.length - 1))
        ucol.push(c.r, c.g, c.b)
      }
    })
    for (let r = 0; r < profile.length - 1; r++)
      for (let s = 0; s < 40; s++) {
        const a = r * 41 + s
        const b = a + 41
        uidx.push(a, a + 1, b, b, a + 1, b + 1)
      }
    const under = new THREE.BufferGeometry()
    under.setAttribute('position', new THREE.Float32BufferAttribute(upos, 3))
    under.setAttribute('color', new THREE.Float32BufferAttribute(ucol, 3))
    under.setIndex(uidx)
    under.computeVertexNormals()
    return { top, under }
  }, [])
  const materials = useMemo(
    () => ({
      top: withPaint(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), 'foliage'),
      under: withPaint(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), 'earth'),
    }),
    [],
  )
  useEffect(
    () => () => {
      top.dispose()
      under.dispose()
    },
    [top, under],
  )
  return (
    <group>
      <mesh geometry={top} material={materials.top} onClick={tapWalk} receiveShadow />
      <mesh geometry={under} material={materials.under} />
    </group>
  )
}

/** A rope bridge across the sky: planks, posts with little lights, and two rope rails. */
function SkyBridge() {
  const planks = useRef()
  const posts = useRef()
  const { plankList, postList, ropes } = useMemo(() => {
    const len = SKY_BRIDGE.z0 - SKY_BRIDGE.z1 + 1.2
    const n = Math.round(len / 0.28)
    const plankList = Array.from({ length: n }, (_, i) => {
      const z = SKY_BRIDGE.z0 + 0.6 - i * 0.28
      const y = skyBridgeHeight(z)
      const tilt = Math.atan2(skyBridgeHeight(z - 0.05) - skyBridgeHeight(z + 0.05), 0.1)
      return { z, y, tilt, w: 1.15 + ((i * 7) % 3) * 0.04 }
    })
    const postList = []
    const rails = [[], []]
    for (let z = SKY_BRIDGE.z0; z >= SKY_BRIDGE.z1 - 0.01; z -= (SKY_BRIDGE.z0 - SKY_BRIDGE.z1) / 6) {
      ;[-1, 1].forEach((side, k) => {
        const x = SKY_BRIDGE.x + side * 0.66
        const y = skyBridgeHeight(z)
        postList.push({ x, y, z })
        rails[k].push(new THREE.Vector3(x, y + 0.82, z))
      })
    }
    // the ropes sag between the posts
    const ropes = rails.map((pts) => {
      const fine = []
      for (let i = 0; i < pts.length - 1; i++)
        for (let k = 0; k < 6; k++) {
          const t = k / 6
          fine.push(new THREE.Vector3().lerpVectors(pts[i], pts[i + 1], t).add(new THREE.Vector3(0, -Math.sin(Math.PI * t) * 0.12, 0)))
        }
      fine.push(pts[pts.length - 1])
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(fine), fine.length * 2, 0.025, 5)
    })
    return { plankList, postList, ropes }
  }, [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    plankList.forEach((p, i) => {
      m.compose(new THREE.Vector3(SKY_BRIDGE.x, p.y - 0.03, p.z), q.setFromEuler(new THREE.Euler(p.tilt, 0, ((i * 13) % 5) * 0.006 - 0.012)), new THREE.Vector3(p.w, 0.06, 0.22))
      planks.current.setMatrixAt(i, m)
    })
    planks.current.instanceMatrix.needsUpdate = true
    postList.forEach((p, i) => {
      m.compose(new THREE.Vector3(p.x, p.y + 0.4, p.z), q.identity(), new THREE.Vector3(1, 0.9, 1))
      posts.current.setMatrixAt(i, m)
    })
    posts.current.instanceMatrix.needsUpdate = true
  }, [plankList, postList])
  useEffect(() => () => ropes.forEach((r) => r.dispose()), [ropes])
  return (
    <group>
      <instancedMesh ref={planks} args={[undefined, undefined, plankList.length]} material={mat('#c8915f', 0, 0.9)} onClick={tapWalk}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <instancedMesh ref={posts} args={[undefined, undefined, postList.length]} material={mat('#a5714a')}>
        <cylinderGeometry args={[0.05, 0.06, 1, 6]} />
      </instancedMesh>
      {ropes.map((g, i) => (
        <mesh key={i} geometry={g} material={mat('#e3c39b', 0, 1)} />
      ))}
      {postList.map((p, i) => (
        <group key={i} position={[p.x, p.y + 0.9, p.z]}>
          <S p={[0, 0, 0]} s={0.06} c={i % 2 ? '#ffd6ea' : '#ffe2a8'} glow={1.2} />
          <Glow color={i % 2 ? '#ffb6d5' : '#ffd9a0'} size={0.55} opacity={0.5} />
        </group>
      ))}
    </group>
  )
}

/* ───────── the garden around the house ───────── */

function SteppingStones() {
  const stones = useMemo(() => {
    const [a, b] = GARDEN_PATH
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const n = Math.round(len / 0.62)
    return Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n
      const wob = Math.sin(i * 2.3) * 0.12
      return { x: a[0] + (b[0] - a[0]) * t + wob, z: a[1] + (b[1] - a[1]) * t, s: 0.26 + ((i * 5) % 3) * 0.03, r: i * 1.3 }
    })
  }, [])
  return stones.map((s, i) => <C key={i} p={[s.x, 0.02, s.z]} rt={s.s} h={0.05} c={i % 2 ? '#e7ddca' : '#d9cdb6'} seg={7} r={[0, s.r, 0]} />)
}

/** Stage 1: an empty plot with stakes and string, and a little pile of planks waiting. */
function Plot() {
  const corners = [
    [-OUTER.hw - 0.2, -OUTER.hd - 0.2],
    [OUTER.hw + 0.2, -OUTER.hd - 0.2],
    [OUTER.hw + 0.2, OUTER.hd + 0.2],
    [-OUTER.hw - 0.2, OUTER.hd + 0.2],
  ]
  return (
    <group>
      <B p={[0, 0.01, 0]} s={[OUTER.hw * 2 + 0.4, 0.02, OUTER.hd * 2 + 0.4]} c="#dcc195" rough={1} />
      {corners.map(([x, z], i) => {
        const [nx, nz] = corners[(i + 1) % 4]
        const len = Math.hypot(nx - x, nz - z)
        return (
          <group key={i}>
            <B p={[x, 0.25, z]} s={[0.07, 0.5, 0.07]} c="#a5714a" />
            <B p={[(x + nx) / 2, 0.38, (z + nz) / 2]} s={[len, 0.015, 0.015]} r={[0, -Math.atan2(nz - z, nx - x), 0]} c="#ffffff" />
          </group>
        )
      })}
      <group position={[2.0, 0, 1.2]} rotation={[0, 0.3, 0]}>
        {[0, 1, 2].map((i) => (
          <B key={i} p={[0, 0.05 + i * 0.09, (i % 2) * 0.05]} s={[1.4, 0.08, 0.22]} r={[0, i * 0.12, 0]} c={i % 2 ? '#c8915f' : '#d9a574'} />
        ))}
      </group>
      <Glow position={[0, 1.2, 0]} color="#ffe2a8" size={2.2} opacity={0.35} />
    </group>
  )
}

/* ───────── the cottage ───────── */

const WALLS = {
  front: { pos: [0, 0, OUTER.hd], rot: 0, len: OUTER.hw * 2 + WALL_T, sign: 1, normal: [0, 1] },
  back: { pos: [0, 0, -OUTER.hd], rot: Math.PI, len: OUTER.hw * 2 + WALL_T, sign: -1, normal: [0, -1] },
  left: { pos: [-OUTER.hw, 0, 0], rot: -Math.PI / 2, len: OUTER.hd * 2 - WALL_T, sign: 1, normal: [-1, 0] },
  right: { pos: [OUTER.hw, 0, 0], rot: Math.PI / 2, len: OUTER.hd * 2 - WALL_T, sign: -1, normal: [1, 0] },
}
const WALL_COLOR = '#fff1dc'
const TRIM = '#f7c6d0'

/** Solid pieces of a wall, along its length (u), leaving the door open in the front wall. */
function wallPieces(side) {
  const { len } = WALLS[side]
  if (side !== 'front') return [[-len / 2, len / 2, 0, WALL_H]]
  return [
    [-len / 2, DOOR.x0, 0, WALL_H],
    [DOOR.x1, len / 2, 0, WALL_H],
    [DOOR.x0, DOOR.x1, DOOR.h, WALL_H],
  ]
}

function Wall({ side, stage, innerRef, decorRef, children }) {
  const w = WALLS[side]
  const lit = useHome((s) => s.lights.on)
  const glass = stage >= 3 && lit ? ['#ffe3b0', 0.55] : ['#cfeaff', 0]
  return (
    <group position={w.pos} rotation={[0, w.rot, 0]}>
      <group ref={innerRef}>
        {wallPieces(side).map(([u0, u1, y0, y1], i) => (
          <B key={i} p={[(u0 + u1) / 2, (y0 + y1) / 2, 0]} s={[u1 - u0, y1 - y0, WALL_T]} c={WALL_COLOR} />
        ))}
        {/* a pink skirting board outside and in */}
        <B p={[0, 0.06, 0]} s={[w.len + 0.02, 0.12, WALL_T + 0.04]} c={TRIM} />
        <group ref={decorRef}>
          {WINDOWS.filter(([s]) => s === side).map(([, c, width]) => {
            const u = c * w.sign
            const h = WINDOW_Y[1] - WINDOW_Y[0]
            const y = (WINDOW_Y[0] + WINDOW_Y[1]) / 2
            return (
              <group key={c} position={[u, y, 0]}>
                <B p={[0, 0, 0]} s={[width + 0.12, h + 0.12, WALL_T + 0.06]} c="#ffffff" />
                <B p={[0, 0, 0]} s={[width, h, WALL_T + 0.08]} c={glass[0]} glow={glass[1]} rough={0.2} />
                <B p={[0, 0, 0]} s={[0.04, h, WALL_T + 0.1]} c="#ffffff" />
                <B p={[0, 0, 0]} s={[width, 0.04, WALL_T + 0.1]} c="#ffffff" />
                {/* shutters, and a flower box under the front windows */}
                <B p={[-(width / 2 + 0.14), 0, WALL_T / 2 + 0.03]} s={[0.16, h + 0.06, 0.03]} c="#9ec8f0" />
                <B p={[width / 2 + 0.14, 0, WALL_T / 2 + 0.03]} s={[0.16, h + 0.06, 0.03]} c="#9ec8f0" />
                {side === 'front' && (
                  <group position={[0, -h / 2 - 0.1, WALL_T / 2 + 0.1]}>
                    <B p={[0, 0, 0]} s={[width + 0.1, 0.14, 0.18]} c="#c8915f" />
                    {[-0.3, -0.1, 0.1, 0.3].map((x, i) => (
                      <S key={x} p={[x * width, 0.11, 0]} s={0.06} c={['#ff8fbf', '#ffd27f', '#f7f2ff', '#b9a5e8'][i]} />
                    ))}
                  </group>
                )}
                {stage >= 3 && (
                  <>
                    <B p={[-width / 2 + 0.1, 0.02, -WALL_T / 2 - 0.04]} s={[0.2, h + 0.08, 0.03]} c="#f7a8c4" />
                    <B p={[width / 2 - 0.1, 0.02, -WALL_T / 2 - 0.04]} s={[0.2, h + 0.08, 0.03]} c="#f7a8c4" />
                  </>
                )}
              </group>
            )
          })}
          {children}
        </group>
      </group>
    </group>
  )
}

/** The front door (standing open, so the way in is easy to see), with a heart once the home is finished. */
function Door({ stage }) {
  const w = DOOR.x1 - DOOR.x0
  return (
    <group>
      <B p={[DOOR.x0 - 0.05, DOOR.h / 2, 0]} s={[0.1, DOOR.h + 0.05, WALL_T + 0.06]} c="#ffffff" />
      <B p={[DOOR.x1 + 0.05, DOOR.h / 2, 0]} s={[0.1, DOOR.h + 0.05, WALL_T + 0.06]} c="#ffffff" />
      <B p={[DOOR_X, DOOR.h + 0.04, 0]} s={[w + 0.2, 0.1, WALL_T + 0.06]} c="#ffffff" />
      <group position={[DOOR.x0 + 0.02, 0, -0.02]} rotation={[0, 1.25, 0]}>
        <B p={[w / 2 - 0.05, DOOR.h / 2, 0]} s={[w - 0.1, DOOR.h - 0.04, 0.06]} c="#f29bb3" />
        <S p={[w - 0.2, DOOR.h / 2, 0.05]} s={0.035} c="#ffe2a8" glow={0.4} />
      </group>
      {stage >= 5 && <HeartMesh position={[DOOR_X, DOOR.h + 0.3, 0.12]} scale={0.13} color="#ff9cc8" emissive="#ff5fa2" glow={1.1} />}
      {/* a doormat */}
      <B p={[DOOR_X, 0.01, 0.45]} s={[0.8, 0.02, 0.4]} c="#e8b07f" rough={1} />
    </group>
  )
}

/** The gable roof, the chimney, the porch awning, and (when finished) fairy lights along the eaves. */
function Roof({ stage }) {
  const rise = 1.25
  const over = 0.35
  const halfD = OUTER.hd + over
  const slab = Math.hypot(halfD, rise)
  const tilt = Math.atan2(rise, halfD)
  const width = OUTER.hw * 2 + over * 2
  const gable = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-OUTER.hd, 0)
    s.lineTo(OUTER.hd, 0)
    s.lineTo(0, rise * (OUTER.hd / halfD))
    s.closePath()
    return new THREE.ShapeGeometry(s)
  }, [halfD])
  const gableMat = useMemo(() => new THREE.MeshStandardMaterial({ color: WALL_COLOR, roughness: 0.8, side: THREE.DoubleSide }), [])
  const heart = useRef()
  useFrame(({ clock }) => {
    if (!heart.current) return
    const t = (clock.elapsedTime * 0.35) % 1
    heart.current.position.y = WALL_H + rise + 0.6 + t * 1.2
    heart.current.scale.setScalar(0.12 * Math.sin(Math.PI * t) + 0.01)
  })
  const fairy = useHome((s) => s.lights.fairy)
  const lights = stage >= 5 && fairy ? Array.from({ length: 15 }, (_, i) => -width / 2 + 0.2 + (i * (width - 0.4)) / 14) : []
  return (
    <group>
      {[1, -1].map((side) => (
        <group key={side}>
          <B p={[0, WALL_H + rise / 2, (side * halfD) / 2]} s={[width, 0.12, slab + 0.04]} r={[side * tilt, 0, 0]} c="#c8794e" />
          {/* rows of shingles */}
          {[0.25, 0.5, 0.75].map((f) => (
            <B key={f} p={[0, WALL_H + rise * (1 - f) + 0.075, side * halfD * f]} s={[width + 0.02, 0.04, 0.06]} r={[side * tilt, 0, 0]} c="#b0653f" />
          ))}
        </group>
      ))}
      <C p={[0, WALL_H + rise + 0.03, 0]} rt={0.09} h={width + 0.04} c="#b0653f" r={[0, 0, Math.PI / 2]} seg={8} />
      {[-1, 1].map((side) => (
        <mesh key={side} geometry={gable} material={gableMat} position={[side * OUTER.hw, WALL_H, 0]} rotation={[0, Math.PI / 2, 0]} />
      ))}
      <B p={[1.8, WALL_H + rise * 0.75, -0.7]} s={[0.36, 0.9, 0.36]} c="#e8a38a" />
      <B p={[1.8, WALL_H + rise * 0.75 + 0.47, -0.7]} s={[0.44, 0.08, 0.44]} c="#c8794e" />
      {stage >= 5 && <HeartMesh ref={heart} position={[1.8, WALL_H + rise + 0.6, -0.7]} scale={0.1} color="#ff9cc8" emissive="#ff5fa2" glow={1} />}
      {/* the porch: posts and a little awning */}
      {[PORCH.x0 + 0.12, PORCH.x1 - 0.12].map((x) => (
        <C key={x} p={[x, 0.85, PORCH.z1 - 0.12]} rt={0.05} h={1.6} c="#ffffff" seg={8} />
      ))}
      <B p={[(PORCH.x0 + PORCH.x1) / 2, 1.68, (PORCH.z0 + PORCH.z1) / 2 + 0.05]} s={[PORCH.x1 - PORCH.x0 + 0.2, 0.08, PORCH.z1 - PORCH.z0 + 0.3]} r={[0.18, 0, 0]} c="#c8794e" />
      {lights.map((x, i) =>
        [1, -1].map((side) => (
          <S key={`${i}${side}`} p={[x, WALL_H - 0.02 + Math.sin((i / 14) * Math.PI * 7) * 0.03, side * (halfD - 0.02)]} s={0.045} c={i % 2 ? '#ffd6ea' : '#ffe2a8'} glow={1.6} />
        )),
      )}
    </group>
  )
}

/** The canvas for the memory frame: title, the special date and a little message (or gentle placeholders). */
function useMemoryTexture(memory) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 340
    const t = new THREE.CanvasTexture(canvas)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  }, [])
  useEffect(() => {
    const draw = () => {
      const g = texture.image.getContext('2d')
      const { width: w, height: h } = texture.image
      g.fillStyle = '#fff8ee'
      g.fillRect(0, 0, w, h)
      g.strokeStyle = '#f7c6d0'
      g.lineWidth = 10
      g.strokeRect(14, 14, w - 28, h - 28)
      g.textAlign = 'center'
      const line = (text, y, font, color) => {
        g.font = font
        g.fillStyle = color
        g.fillText(text, w / 2, y, w - 70)
      }
      const empty = '#b8a9b4'
      line(memory.title || 'Judul kenangan kita', 92, `600 46px 'Cormorant Garamond', Georgia, serif`, memory.title ? '#6b4a5e' : empty)
      const date = memory.date ? new Date(`${memory.date}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Tanggal spesial belum dipilih'
      line(`♡ ${date} ♡`, 145, `500 26px 'Quicksand', system-ui, sans-serif`, memory.date ? '#d16f98' : empty)
      // the message, wrapped
      g.font = `32px 'Caveat', 'Segoe Script', cursive`
      g.fillStyle = memory.note ? '#5d4a57' : empty
      const words = (memory.note || 'Tulis pesan kecil di sini…').split(/\s+/)
      const lines = []
      let cur = ''
      for (const word of words) {
        const next = cur ? `${cur} ${word}` : word
        if (g.measureText(next).width > w - 90 && cur) {
          lines.push(cur)
          cur = word
        } else cur = next
      }
      if (cur) lines.push(cur)
      lines.slice(0, 4).forEach((l, i) => g.fillText(l, w / 2, 205 + i * 36, w - 80))
      texture.needsUpdate = true
    }
    draw()
    document.fonts?.ready.then(draw)
  }, [texture, memory.title, memory.date, memory.note])
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

/** The memory corner: a shelf against the back wall, the frame above it, keepsakes once finished. */
function MemoryShelf({ stage }) {
  const cx = (MEMORY_CORNER.x0 + MEMORY_CORNER.x1) / 2
  return (
    <group position={[cx, FLOOR_Y, IN.z0 + 0.2]}>
      <B p={[0, 0.45, -0.13]} s={[1.15, 0.9, 0.05]} c="#a5714a" />
      {[0.03, 0.45, 0.88].map((y) => (
        <B key={y} p={[0, y, 0]} s={[1.15, 0.05, 0.3]} c="#c8915f" />
      ))}
      <B p={[-0.555, 0.45, 0]} s={[0.04, 0.9, 0.3]} c="#c8915f" />
      <B p={[0.555, 0.45, 0]} s={[0.04, 0.9, 0.3]} c="#c8915f" />
      {stage >= 5 && (
        <>
          {/* keepsakes: a little gift box, a jar with a star, a heart */}
          <B p={[-0.32, 0.56, 0]} s={[0.18, 0.16, 0.16]} c="#f7a8c4" />
          <B p={[-0.32, 0.56, 0]} s={[0.04, 0.17, 0.17]} c="#ffe2a8" />
          <C p={[0.05, 0.6, 0]} rt={0.08} h={0.24} c="#d8f0ff" />
          <S p={[0.05, 0.6, 0]} s={0.04} c="#ffe2a8" glow={1.4} />
          <HeartMesh position={[0.36, 0.98, 0]} scale={0.08} color="#ff9cc8" emissive="#ff5fa2" glow={0.8} />
          <B p={[-0.2, 0.18, 0]} s={[0.5, 0.25, 0.22]} c="#b9a5e8" />
        </>
      )}
    </group>
  )
}

/** The frame above the shelf (hangs on the back wall, so it folds away with it). */
function MemoryFrame() {
  const memory = useHome((s) => s.memory)
  const texture = useMemoryTexture(memory)
  // wall-local: the back wall is turned around, so its "along" runs the other way
  const u = -(MEMORY_CORNER.x0 + MEMORY_CORNER.x1) / 2
  return (
    <group position={[u, 1.38, -WALL_T / 2 - 0.03]} rotation={[0, Math.PI, 0]}>
      <B p={[0, 0, -0.01]} s={[1.18, 0.8, 0.04]} c="#e9c98b" />
      <mesh position={[0, 0, 0.012]}>
        <planeGeometry args={[1.06, 0.7]} />
        <meshStandardMaterial map={texture} roughness={0.9} />
      </mesh>
    </group>
  )
}

function Cottage({ stage }) {
  const camera = useThree((s) => s.camera)
  const editing = useHome((s) => s.editing)
  const lit = useHome((s) => s.lights.on)
  const wallRefs = { front: useRef(), back: useRef(), left: useRef(), right: useRef() }
  const decorRefs = { front: useRef(), back: useRef(), left: useRef(), right: useRef() }
  const partition = useRef()
  const roof = useRef()
  const cut = useRef(0)

  useFrame((_, delta) => {
    // inside (or decorating): the roof lifts away and the walls facing the camera fold down
    const open = editing || playerInHouse()
    cut.current = THREE.MathUtils.damp(cut.current, open ? 1 : 0, 6, delta)
    roof.current.visible = cut.current < 0.5
    tmp.set(camera.position.x - HOUSE.x, 0, camera.position.z - HOUSE.z).normalize()
    for (const side of Object.keys(WALLS)) {
      const [nx, nz] = WALLS[side].normal
      const facing = nx * tmp.x + nz * tmp.z > 0.2
      const target = facing ? 1 - cut.current * 0.9 : 1
      const g = wallRefs[side].current
      g.scale.y = THREE.MathUtils.damp(g.scale.y, target, 10, delta)
      decorRefs[side].current.visible = g.scale.y > 0.7
    }
    partition.current.scale.y = 1 - cut.current * 0.65
  })

  return (
    <group>
      {/* the floor, and the porch */}
      <B p={[0, FLOOR_Y / 2, 0]} s={[OUTER.hw * 2, FLOOR_Y, OUTER.hd * 2]} c="#e2b98a" />
      <B p={[(IN.x0 + PARTITION.x) / 2, FLOOR_Y + 0.002, -0.1]} s={[0.02, 0.003, 3.8]} c="#d2a676" />
      <B p={[(PORCH.x0 + PORCH.x1) / 2, 0.06, (PORCH.z0 + PORCH.z1) / 2]} s={[PORCH.x1 - PORCH.x0, 0.12, PORCH.z1 - PORCH.z0]} c="#c8915f" />
      <B p={[DOOR_X, 0.03, PORCH.z1 + 0.15]} s={[1.0, 0.06, 0.3]} c="#c8915f" />
      <group onClick={tapWalk}>
        <Wall side="front" stage={stage} innerRef={wallRefs.front} decorRef={decorRefs.front}>
          <Door stage={stage} />
        </Wall>
        <Wall side="back" stage={stage} innerRef={wallRefs.back} decorRef={decorRefs.back}>
          {stage >= 4 && <MemoryFrame />}
        </Wall>
        <Wall side="left" stage={stage} innerRef={wallRefs.left} decorRef={decorRefs.left} />
        <Wall side="right" stage={stage} innerRef={wallRefs.right} decorRef={decorRefs.right} />
      </group>
      <group ref={partition} position={[PARTITION.x, 0, (PARTITION.z0 + PARTITION.z1) / 2]}>
        <B p={[0, WALL_H / 2, 0]} s={[0.12, WALL_H, PARTITION.z1 - PARTITION.z0]} c="#fde6ef" />
      </group>
      {stage >= 4 && <MemoryShelf stage={stage} />}
      {stage >= 3 && lit && (
        <>
          <Glow position={[-1.2, 1.6, -0.3]} color="#ffd9a0" size={2.6} opacity={0.32} />
          <Glow position={[2.0, 1.6, -0.6]} color="#ffc2dd" size={2.0} opacity={0.3} />
        </>
      )}
      <group ref={roof}>
        <Roof stage={stage} />
      </group>
      <PorchSeats />
      <LightSwitches stage={stage} />
    </group>
  )
}

/** Stage 4: flowers all around the house, and a flowery arch where the bridge arrives. */
function GardenDressing() {
  const flowers = useMemo(() => {
    const list = []
    const add = (x, z, i) => list.push({ x, z, c: ['#ff8fbf', '#ffd27f', '#f7f2ff', '#b9a5e8', '#ff9f8f'][i % 5] })
    let i = 0
    for (let x = PORCH.x1 + 0.4; x < OUTER.hw + 0.2; x += 0.32) add(x, OUTER.hd + 0.32, i++)
    for (let x = -OUTER.hw - 0.2; x < PORCH.x0 - 0.3; x += 0.32) add(x, OUTER.hd + 0.32, i++)
    for (let z = -OUTER.hd; z < OUTER.hd; z += 0.36) {
      add(-OUTER.hw - 0.32, z, i++)
      add(OUTER.hw + 0.32, z, i++)
    }
    return list
  }, [])
  return (
    <group>
      {flowers.map((f, i) => (
        <group key={i} position={[f.x, 0, f.z]}>
          <S p={[0, 0.1, 0]} s={[0.12, 0.09, 0.12]} c="#6fb85a" />
          <S p={[0, 0.2, 0]} s={0.055} c={f.c} />
        </group>
      ))}
      {/* the arch */}
      <group position={[LANDING.x, 0, LANDING.z - 0.5]}>
        {[-0.75, 0.75].map((x) => (
          <B key={x} p={[x, 0.75, 0]} s={[0.1, 1.5, 0.1]} c="#ffffff" />
        ))}
        <mesh position={[0, 1.5, 0]} material={mat('#ffffff')}>
          <torusGeometry args={[0.75, 0.05, 6, 20, Math.PI]} />
        </mesh>
        {Array.from({ length: 9 }, (_, i) => {
          const a = (i / 8) * Math.PI
          return <S key={i} p={[Math.cos(a) * 0.75, 1.5 + Math.sin(a) * 0.75, 0.04]} s={0.08} c={['#ff8fbf', '#ffd6ea', '#ffd27f'][i % 3]} />
        })}
      </group>
    </group>
  )
}

/* ───────── sitting down, and the light switches ───────── */

/** Where you can sit on each kind of furniture (item-local; the seat faces the item's front). */
const SEATS = {
  sofa: { h: 0.44, spots: [[-0.38, 0.08], [0.38, 0.08]], out: 0.75, label: 'Duduk di sofa' },
  chair: { h: 0.47, spots: [[0, 0.02]], out: 0.6, label: 'Duduk' },
  bed: { h: 0.52, spots: [[-0.3, 0.6], [0.3, 0.6]], out: 0.8, label: 'Bersantai' },
  garden_bench: { h: 0.45, spots: [[-0.35, 0.02], [0.35, 0.02]], out: 0.65, label: 'Duduk di bangku' },
}

/** One seat, given in house-local coordinates. */
function HouseSeat({ id, x, z, y, yaw, out, group, label }) {
  const [wx, wz] = toWorld(x, z)
  const [ex, ez] = toWorld(x + Math.sin(yaw) * out, z + Math.cos(yaw) * out)
  useSeat(id, { x: wx, z: wz, y: HOUSE.y + y, yaw, exit: [ex, ez], group, label, enabled: () => !useHome.getState().editing })
  return null
}

function ItemSeats({ item }) {
  const def = SEATS[item.kind]
  const a = (item.rot * Math.PI) / 2
  const base = item.area === 'inside' ? FLOOR_Y : 0
  return def.spots.map(([sx, sz], i) => (
    <HouseSeat
      key={i}
      id={`item:${item.id}:${i}`}
      x={item.x + sx * Math.cos(a) + sz * Math.sin(a)}
      z={item.z - sx * Math.sin(a) + sz * Math.cos(a)}
      y={base + def.h}
      yaw={a}
      out={def.out}
      group={item.id}
      label={def.label}
    />
  ))
}

/** Sit on the edge of the porch and look at the garden. */
function PorchSeats() {
  return [PORCH.x0 + 0.35, PORCH.x1 - 0.45].map((x, i) => (
    <HouseSeat key={i} id={`porch:${i}`} x={x} z={PORCH.z1 - 0.12} y={0.13} yaw={0} out={0.7} group="porch" label="Duduk di teras" />
  ))
}

/** The light switch by the door (from stage 3) and the fairy lights' switch on the porch (stage 5). */
function LightSwitches({ stage }) {
  const switchAt = useMemo(() => at(DOOR.x0 - 0.55, OUTER.hd - 0.55), [])
  const fairyAt = useMemo(() => at(PORCH.x1 - 0.2, PORCH.z0 + 0.45), [])
  useInteractable('home-lights', {
    position: switchAt,
    radius: 0.95,
    enabled: () => stage >= 3 && useHome.getState().status === 'ready' && !useHome.getState().editing,
    label: () => (useHome.getState().lights.on ? 'Matikan lampu' : 'Nyalakan lampu'),
    onInteract: () => toggleLights('on'),
  })
  useInteractable('home-fairy', {
    position: fairyAt,
    radius: 0.9,
    priority: -0.2,
    enabled: () => stage >= 5 && useHome.getState().status === 'ready' && !useHome.getState().editing,
    label: () => (useHome.getState().lights.fairy ? 'Matikan lampu hias' : 'Nyalakan lampu hias'),
    onInteract: () => toggleLights('fairy'),
  })
  return stage >= 3 ? (
    <group position={[DOOR.x0 - 0.55, 1.05, OUTER.hd - WALL_T / 2 - 0.02]}>
      <B p={[0, 0, 0]} s={[0.12, 0.18, 0.02]} c="#ffffff" />
      <B p={[0, 0, -0.012]} s={[0.04, 0.07, 0.02]} c="#f29bb3" />
    </group>
  ) : null
}

/* ───────── furniture, and decorating ───────── */

function Footprint({ kind, ok }) {
  const r = rectOf(kind, 0, 0, 0)
  const wall = layerOf(kind) === 'wall'
  return (
    <mesh position={[0, wall ? 0.03 : 0.035, wall ? 0.25 : 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
      <planeGeometry args={[r.x1 - r.x0 + 0.08, wall ? 0.5 : r.z1 - r.z0 + 0.08]} />
      <meshBasicMaterial color={ok ? '#7dffb0' : '#ff7d8f'} transparent opacity={0.45} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

function PlacedItem({ item, editing, held }) {
  const y = item.area === 'inside' ? FLOOR_Y : 0
  return (
    <group
      position={[item.x, y, item.z]}
      rotation={[0, (item.rot * Math.PI) / 2, 0]}
      onClick={
        editing
          ? (e) => {
              e.stopPropagation()
              if (e.delta > 8) return
              audio.sparkle()
              pickItem(item.id)
            }
          : undefined
      }
    >
      <Furniture kind={item.kind} />
      {!editing && SEATS[item.kind] && <ItemSeats item={item} />}
      {held && <Glow position={[0, 0.9, 0]} color="#ffe2a8" size={1.4} opacity={0.6} />}
    </group>
  )
}

function Items() {
  const items = useHome((s) => s.items)
  const editing = useHome((s) => s.editing)
  const draftId = useHome((s) => s.draft?.id)
  // what the other person is holding right now glows softly
  const [held, setHeld] = useState(null)
  useFrame(() => {
    const now = partner.online ? partner.editing : null
    if (now !== held) setHeld(now)
  })
  return Object.values(items).map((it) => (it.id === draftId ? null : <PlacedItem key={it.id} item={it} editing={editing} held={held === it.id} />))
}

function Draft() {
  const draft = useHome((s) => s.draft)
  const ref = useRef()
  // it hovers a little while it's being placed
  useFrame(({ clock }) => {
    if (ref.current && draft) ref.current.position.y = (layerOf(draft.kind) === 'wall' ? 0 : 0.06) + Math.sin(clock.elapsedTime * 4) * 0.02
  })
  if (!draft) return null
  const y = CATALOG[draft.kind].area === 'inside' ? FLOOR_Y : 0
  return (
    <group position={[draft.x, y, draft.z]} rotation={[0, (draft.rot * Math.PI) / 2, 0]}>
      <Footprint kind={draft.kind} ok={draft.ok} />
      <group ref={ref}>
        <Furniture kind={draft.kind} />
      </group>
    </group>
  )
}

/** While decorating: an invisible floor that follows the pointer (desktop) or the tap (touch). */
function EditSurface() {
  const toHouse = (e) => toLocal(e.point.x, e.point.z)
  return (
    <mesh
      position={[0, 0.02, 2.5]}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerMove={(e) => {
        if (e.pointerType === 'mouse' && e.buttons === 0) moveDraft(...toHouse(e))
      }}
      onClick={(e) => {
        if (e.delta > 8) return
        moveDraft(...toHouse(e))
      }}
    >
      <planeGeometry args={[19, 19]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

/** Keys while decorating: arrows / WASD move (as seen from the camera), R turns, Enter places, Esc backs out. */
function EditKeys() {
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return
      const s = useHome.getState()
      if (!s.editing) return
      const fwd = camera.getWorldDirection(tmp)
      const along = (v) => (Math.abs(v.x) > Math.abs(v.z) ? [Math.sign(v.x) * 0.25, 0] : [0, Math.sign(v.z) * 0.25])
      const f = along(fwd)
      const r = along({ x: -fwd.z, z: fwd.x })
      const moves = { ArrowUp: f, KeyW: f, ArrowDown: [-f[0], -f[1]], KeyS: [-f[0], -f[1]], ArrowRight: r, KeyD: r, ArrowLeft: [-r[0], -r[1]], KeyA: [-r[0], -r[1]] }
      let handled = true
      if (moves[e.code] && s.draft) nudgeDraft(...moves[e.code])
      else if (e.code === 'KeyR' && s.draft) rotateDraft()
      else if (e.code === 'Enter' && s.draft) placeDraft()
      else if ((e.code === 'Delete' || e.code === 'Backspace') && s.draft && !s.draft.isNew) removeDraft()
      else if (e.code === 'Escape') s.draft ? cancelDraft() : stopEditing()
      else handled = moves[e.code] !== undefined
      if (handled) {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [camera])
  return null
}

/* ───────── the way in ───────── */

const at = (x, z) => {
  const [wx, wz] = toWorld(x, z)
  return new THREE.Vector3(wx, HOUSE.y, wz)
}
const signSpot = at(LANDING.x + 1.1, LANDING.z - 0.9)
const doorSpot = at(DOOR_X, OUTER.hd)

function HomeSign() {
  const status = useCouple((s) => s.status)
  useInteractable('home-sign', {
    position: signSpot,
    radius: 1.7,
    label: () => {
      if (useCouple.getState().status !== 'connected') return 'Rumah Kita (main berdua dulu ♡)'
      return useHome.getState().stage < 2 ? 'Bangun Rumah' : 'Rumah Kita'
    },
    onInteract: () => {
      audio.sparkle()
      if (!coupleAvailable) return useStore.getState().showToast('Rumah Kita dibangun berdua: fitur "Main berdua" belum dipasang di sini.', 5000)
      useStore.getState().setPanel(useCouple.getState().status === 'connected' ? 'home' : 'couple')
    },
  })
  return (
    <Tappable id="home-sign" position={signSpot}>
      <B p={[0, 0.45, 0]} s={[0.08, 0.9, 0.08]} c="#a5714a" />
      <B p={[0, 0.85, 0.02]} s={[0.75, 0.36, 0.05]} c="#f4e7d6" />
      <HeartMesh position={[0, 0.85, 0.07]} scale={0.09} color="#ff9cc8" emissive="#ff5fa2" glow={status === 'connected' ? 1 : 0.4} />
    </Tappable>
  )
}

function DoorWay() {
  useInteractable('home-door', {
    position: doorSpot,
    radius: 1.25,
    enabled: () => useHome.getState().stage >= 2 && useHome.getState().status === 'ready' && !useHome.getState().editing,
    label: () => (playerInHouse() ? 'Keluar Rumah' : 'Masuk Rumah'),
    onInteract: () => {
      const [x, z] = toWorld(DOOR_X, playerInHouse() ? PORCH.z1 + 0.5 : 0.9)
      walkTo(x, z, 0.15)
      player.onArrive = null
    },
  })
  return null
}

/** Keeps the "you're at home" flag up to date, and stops decorating if she leaves the island view. */
function HomeTracker() {
  const view = useStore((s) => s.view)
  useEffect(() => {
    if (view !== 'explore') stopEditing()
  }, [view])
  useFrame(() => {
    const s = useStore.getState()
    const p = player.position
    const near = s.phase === 'world' && s.view === 'explore' && (homeDistance(p.x, p.z) < 1.02 || (onSkyBridge(p.x, p.z) && p.z < SKY_BRIDGE.z1 + 3))
    if (near !== useHome.getState().near) useHome.setState({ near })
  })
  return null
}

function HomeLabel() {
  const view = useStore((s) => s.view)
  const phase = useStore((s) => s.phase)
  if (phase !== 'world' || view !== 'explore') return null
  return (
    <Html position={[HOME_ISLAND.x, HOME_ISLAND.level + 3.6, HOME_ISLAND.z - 1]} center zIndexRange={[12, 0]} className="place-anchor">
      <span className="place-name">Rumah Kita</span>
    </Html>
  )
}

/** Everything about Our Little Home that lives in the 3D world. */
export default function HomeIsland() {
  const status = useHome((s) => s.status)
  const stage = useHome((s) => s.stage)
  const editing = useHome((s) => s.editing)
  const built = status === 'ready' ? stage : 1
  return (
    <group>
      <HomeGround />
      <SkyBridge />
      <group position={[HOUSE.x, HOUSE.y, HOUSE.z]}>
        <SteppingStones />
        {built < 2 ? <Plot /> : <Cottage stage={built} />}
        {built >= 4 && <GardenDressing />}
        {status === 'ready' && <Items />}
        {editing && (
          <>
            <Draft />
            <EditSurface />
          </>
        )}
      </group>
      <HomeSign />
      <DoorWay />
      <HomeTracker />
      <EditKeys />
      <HomeLabel />
      {/* the two of you, written on the sign by the arch */}
      <Html position={[signSpot.x, signSpot.y + 1.35, signSpot.z]} center zIndexRange={[12, 0]} className="place-anchor">
        <span className="home-sign-text">
          {couple.me.nickname || couple.me.name} & {couple.you.nickname || couple.you.name}
        </span>
      </Html>
    </group>
  )
}
