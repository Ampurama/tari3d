import * as THREE from 'three'
import { Glow, HeartMesh } from './Bits'

/*
 * OUR LITTLE HOME — the furniture and garden things, as tiny low-poly models.
 * Every model faces +z, stands on y = 0 and fits the footprint in lib/homeLayout.js.
 * Geometries and materials are shared, so a house full of furniture stays light.
 */

const geoCache = new Map()
const geo = (key, make) => {
  if (!geoCache.has(key)) geoCache.set(key, make())
  return geoCache.get(key)
}
const BOX = new THREE.BoxGeometry(1, 1, 1)
const cyl = (rt, rb, seg = 12) => geo(`c${rt}:${rb}:${seg}`, () => new THREE.CylinderGeometry(rt, rb, 1, seg))
const ball = (seg = 12) => geo(`s${seg}`, () => new THREE.SphereGeometry(1, seg, Math.max(6, seg * 0.75)))
const blob = () => geo('ico', () => new THREE.IcosahedronGeometry(1, 1))

const matCache = new Map()
/** A shared, softly matte material. `glow` makes it shine (lamps). */
export function mat(color, glow = 0, rough = 0.75) {
  const key = `${color}:${glow}:${rough}`
  if (!matCache.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 })
    if (glow) {
      m.emissive = new THREE.Color(color)
      m.emissiveIntensity = glow
    }
    matCache.set(key, m)
  }
  return matCache.get(key)
}

/** A box: centre [x, y, z], size [w, h, d]. */
export const B = ({ p, s, c, glow, rough, r }) => <mesh geometry={BOX} material={mat(c, glow, rough)} position={p} scale={s} rotation={r} />
/** A cylinder: centre, radius top / bottom, height. */
export const C = ({ p, rt, rb = rt, h, c, glow, seg, r }) => <mesh geometry={cyl(rt, rb, seg)} material={mat(c, glow)} position={p} scale={[1, h, 1]} rotation={r} />
/** A sphere (or a squashed one): centre, radius or [rx, ry, rz]. */
export const S = ({ p, s, c, glow, seg }) => <mesh geometry={ball(seg)} material={mat(c, glow)} position={p} scale={s} />
/** A lumpy round bush. */
const Blob = ({ p, s, c }) => <mesh geometry={blob()} material={mat(c, 0, 0.9)} position={p} scale={s} />

const WOOD = '#c8915f'
const WOOD_DARK = '#a5714a'
const CREAM = '#fff4e4'

const legs = (w, d, h, c = WOOD_DARK, t = 0.06) =>
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].map(([sx, sz], i) => <B key={i} p={[(sx * (w - t)) / 2, h / 2, (sz * (d - t)) / 2]} s={[t, h, t]} c={c} />)

function Bed() {
  return (
    <group>
      <B p={[0, 0.15, 0]} s={[1.2, 0.3, 1.9]} c={WOOD} />
      <B p={[0, 0.39, 0.03]} s={[1.1, 0.18, 1.78]} c={CREAM} />
      <B p={[0, 0.5, 0.33]} s={[1.14, 0.07, 1.12]} c="#f7a8c4" />
      <B p={[0, 0.54, 0.33]} s={[1.15, 0.02, 0.18]} c="#ffd6e6" />
      <B p={[0, 0.54, -0.62]} s={[0.78, 0.12, 0.34]} c="#ffffff" />
      <B p={[0, 0.55, -0.9]} s={[1.2, 0.9, 0.1]} c={WOOD_DARK} />
      <S p={[0, 1.0, -0.9]} s={[0.12, 0.11, 0.05]} c="#ff8fbf" />
    </group>
  )
}

function Sofa() {
  return (
    <group>
      <B p={[0, 0.18, 0]} s={[1.6, 0.32, 0.75]} c="#b9a5e8" />
      <B p={[0, 0.52, -0.29]} s={[1.6, 0.5, 0.18]} c="#a88fe0" />
      <B p={[-0.72, 0.34, 0]} s={[0.16, 0.36, 0.75]} c="#a88fe0" />
      <B p={[0.72, 0.34, 0]} s={[0.16, 0.36, 0.75]} c="#a88fe0" />
      <B p={[-0.32, 0.39, 0.05]} s={[0.6, 0.1, 0.52]} c="#cfc0f2" />
      <B p={[0.32, 0.39, 0.05]} s={[0.6, 0.1, 0.52]} c="#cfc0f2" />
      <B p={[0.42, 0.56, -0.12]} s={[0.3, 0.28, 0.1]} c="#ffc2d9" r={[0, 0, 0.15]} />
    </group>
  )
}

function Table() {
  return (
    <group>
      <B p={[0, 0.62, 0]} s={[1.0, 0.06, 0.7]} c={WOOD} />
      {legs(0.9, 0.6, 0.6)}
      <C p={[0.2, 0.7, 0.05]} rt={0.06} rb={0.05} h={0.1} c="#ffffff" />
    </group>
  )
}

function Chair() {
  return (
    <group>
      <B p={[0, 0.42, 0]} s={[0.45, 0.06, 0.45]} c={WOOD} />
      {legs(0.42, 0.42, 0.4)}
      <B p={[0, 0.7, -0.2]} s={[0.45, 0.5, 0.05]} c={WOOD} />
      <B p={[0, 0.47, 0.02]} s={[0.36, 0.04, 0.36]} c="#ffc2d9" />
    </group>
  )
}

function Rug() {
  return (
    <group>
      <B p={[0, 0.008, 0]} s={[1.6, 0.016, 1.1]} c="#f5a9c6" rough={1} />
      <B p={[0, 0.012, 0]} s={[1.3, 0.016, 0.8]} c="#fff0f5" rough={1} />
      <B p={[0, 0.016, 0]} s={[0.9, 0.016, 0.4]} c="#f9c9db" rough={1} />
    </group>
  )
}

function FloorLamp() {
  return (
    <group>
      <C p={[0, 0.02, 0]} rt={0.15} h={0.04} c={WOOD_DARK} />
      <C p={[0, 0.67, 0]} rt={0.022} h={1.3} c={WOOD_DARK} seg={6} />
      <C p={[0, 1.38, 0]} rt={0.12} rb={0.2} h={0.26} c="#ffe7b8" glow={0.9} />
      <Glow position={[0, 1.36, 0]} color="#ffd9a0" size={1.3} opacity={0.5} />
    </group>
  )
}

function Plant() {
  return (
    <group>
      <C p={[0, 0.15, 0]} rt={0.17} rb={0.13} h={0.3} c="#e08f6a" />
      <Blob p={[0, 0.5, 0]} s={[0.24, 0.26, 0.24]} c="#6fb85a" />
      <Blob p={[0.1, 0.68, 0.04]} s={[0.15, 0.16, 0.15]} c="#86c96b" />
    </group>
  )
}

const BOOK = ['#f7a8c4', '#9ec8f0', '#ffd27f', '#b9a5e8', '#8fd1a5', '#ffffff']
function Bookshelf() {
  return (
    <group>
      <B p={[0, 0.65, -0.17]} s={[1.0, 1.3, 0.05]} c={WOOD_DARK} />
      <B p={[-0.475, 0.65, 0]} s={[0.05, 1.3, 0.4]} c={WOOD} />
      <B p={[0.475, 0.65, 0]} s={[0.05, 1.3, 0.4]} c={WOOD} />
      {[0.02, 0.44, 0.86, 1.28].map((y) => (
        <B key={y} p={[0, y, 0]} s={[1.0, 0.04, 0.4]} c={WOOD} />
      ))}
      {[0.04, 0.46, 0.88].map((y, row) =>
        [0, 1, 2, 3, 4].map((i) => {
          const w = 0.09 + ((i + row) % 3) * 0.02
          const h = 0.28 + ((i * 2 + row) % 3) * 0.04
          return <B key={`${row}${i}`} p={[-0.36 + i * 0.13 + row * 0.04, y + h / 2 + 0.02, 0.02]} s={[w, h, 0.28]} c={BOOK[(i + row * 2) % BOOK.length]} />
        }),
      )}
    </group>
  )
}

function Picture() {
  return (
    <group position={[0, 1.25, 0]}>
      <B p={[0, 0, 0.02]} s={[0.7, 0.55, 0.04]} c="#e9c98b" />
      <B p={[0, 0, 0.042]} s={[0.58, 0.43, 0.01]} c="#cfeaff" />
      <B p={[0, -0.13, 0.05]} s={[0.58, 0.17, 0.01]} c="#9fd08a" />
      <S p={[0.15, 0.08, 0.05]} s={[0.06, 0.06, 0.01]} c="#ffb3cf" />
    </group>
  )
}

function HeartLamp() {
  return (
    <group>
      <C p={[0, 0.04, 0]} rt={0.14} h={0.08} c={WOOD_DARK} />
      <C p={[0, 0.25, 0]} rt={0.02} h={0.36} c={WOOD_DARK} seg={6} />
      <HeartMesh position={[0, 0.58, 0]} scale={0.2} color="#ff9cc8" emissive="#ff5fa2" glow={1.4} />
      <Glow position={[0, 0.58, 0]} color="#ff9cc8" size={1.0} opacity={0.6} />
    </group>
  )
}

function Teddy() {
  const fur = '#c08a5c'
  const light = '#e8c39c'
  return (
    <group>
      <S p={[0, 0.19, 0]} s={0.17} c={fur} />
      <S p={[0, 0.44, 0.02]} s={0.13} c={fur} />
      <S p={[-0.1, 0.55, 0]} s={0.045} c={fur} />
      <S p={[0.1, 0.55, 0]} s={0.045} c={fur} />
      <S p={[0, 0.42, 0.12]} s={[0.06, 0.045, 0.04]} c={light} />
      <S p={[0, 0.19, 0.12]} s={[0.09, 0.1, 0.06]} c={light} />
      <S p={[-0.15, 0.25, 0.04]} s={0.06} c={fur} />
      <S p={[0.15, 0.25, 0.04]} s={0.06} c={fur} />
      <S p={[-0.08, 0.05, 0.1]} s={0.065} c={fur} />
      <S p={[0.08, 0.05, 0.1]} s={0.065} c={fur} />
      <S p={[0, 0.33, 0.12]} s={[0.05, 0.03, 0.02]} c="#ff8fbf" />
    </group>
  )
}

function Vase() {
  return (
    <group>
      <C p={[0, 0.22, 0]} rt={0.19} rb={0.15} h={0.04} c={WOOD} />
      <C p={[0, 0.11, 0]} rt={0.03} h={0.2} c={WOOD_DARK} seg={6} />
      <C p={[0, 0.02, 0]} rt={0.13} h={0.04} c={WOOD_DARK} />
      <C p={[0, 0.35, 0]} rt={0.06} rb={0.09} h={0.22} c="#9ec8f0" />
      {[
        [0, 0.58, 0, '#ff8fbf'],
        [-0.07, 0.53, 0.03, '#ffd27f'],
        [0.07, 0.54, -0.02, '#f7f2ff'],
      ].map(([x, y, z, c], i) => (
        <group key={i}>
          <C p={[x / 2, (y + 0.45) / 2, z / 2]} rt={0.008} h={y - 0.45} c="#6fb85a" seg={4} />
          <S p={[x, y, z]} s={0.045} c={c} />
        </group>
      ))}
    </group>
  )
}

const PETALS = ['#ff8fbf', '#ffd27f', '#f7f2ff', '#b9a5e8', '#ff9f8f']
function Flowers() {
  return (
    <group>
      <B p={[0, 0.05, 0]} s={[1.0, 0.1, 0.6]} c={WOOD_DARK} />
      <B p={[0, 0.07, 0]} s={[0.9, 0.08, 0.5]} c="#8a6248" />
      {Array.from({ length: 8 }, (_, i) => {
        const x = -0.36 + (i % 4) * 0.24
        const z = i < 4 ? -0.12 : 0.12
        return (
          <group key={i}>
            <S p={[x, 0.17, z]} s={[0.07, 0.05, 0.07]} c="#6fb85a" />
            <S p={[x, 0.24, z]} s={0.05} c={PETALS[i % PETALS.length]} />
          </group>
        )
      })}
    </group>
  )
}

function Bush() {
  return (
    <group>
      <Blob p={[0, 0.34, 0]} s={[0.4, 0.34, 0.4]} c="#6fb85a" />
      <Blob p={[0.15, 0.48, 0.1]} s={[0.2, 0.18, 0.2]} c="#86c96b" />
      {[
        [0.2, 0.45, 0.28],
        [-0.25, 0.4, 0.22],
        [0.05, 0.62, 0.15],
      ].map((p, i) => (
        <S key={i} p={p} s={0.04} c="#ffb3cf" />
      ))}
    </group>
  )
}

function Lantern() {
  return (
    <group>
      <C p={[0, 0.5, 0]} rt={0.035} rb={0.05} h={1.0} c="#6d5a6e" seg={6} />
      <B p={[0, 1.06, 0]} s={[0.17, 0.2, 0.17]} c="#ffe2a8" glow={1.1} />
      <B p={[0, 1.18, 0]} s={[0.22, 0.04, 0.22]} c="#6d5a6e" />
      <Glow position={[0, 1.06, 0]} color="#ffd9a0" size={1.2} opacity={0.55} />
    </group>
  )
}

function GardenBench() {
  return (
    <group>
      <B p={[0, 0.42, 0]} s={[1.3, 0.06, 0.45]} c={WOOD} />
      <B p={[0, 0.7, -0.2]} s={[1.3, 0.3, 0.05]} c={WOOD} />
      {legs(1.2, 0.4, 0.4, '#6d5a6e', 0.05)}
    </group>
  )
}

function SmallTree() {
  return (
    <group>
      <C p={[0, 0.45, 0]} rt={0.06} rb={0.09} h={0.9} c="#9a6b4a" seg={7} />
      <Blob p={[0, 1.15, 0]} s={[0.45, 0.38, 0.45]} c="#ffc2d9" />
      <Blob p={[0.22, 1.32, 0.08]} s={[0.26, 0.22, 0.26]} c="#ffd6e6" />
      <Blob p={[-0.2, 1.05, 0.12]} s={[0.24, 0.2, 0.24]} c="#f7a8c4" />
    </group>
  )
}

/* ───────── keepsakes from dates ───────── */

export function PicnicBasket() {
  return (
    <group>
      <B p={[0, 0.13, 0]} s={[0.46, 0.26, 0.34]} c="#d9a574" />
      <B p={[0, 0.27, 0]} s={[0.48, 0.03, 0.36]} c="#f7a8c4" />
      <B p={[0, 0.2, 0.175]} s={[0.46, 0.06, 0.01]} c="#ffffff" />
      <mesh position={[0, 0.27, 0]} material={mat('#a5714a')}>
        <torusGeometry args={[0.16, 0.018, 5, 14, Math.PI]} />
      </mesh>
    </group>
  )
}

function Candles() {
  return (
    <group>
      <C p={[0, 0.02, 0]} rt={0.17} h={0.04} c="#e9c98b" />
      {[
        [-0.07, 0.16, 0],
        [0.07, 0.12, 0.04],
        [0.02, 0.1, -0.08],
      ].map(([x, h, z], i) => (
        <group key={i}>
          <C p={[x, 0.04 + h / 2, z]} rt={0.03} h={h} c="#fff4e4" seg={8} />
          <S p={[x, 0.07 + h, z]} s={[0.018, 0.035, 0.018]} c="#ffcf7a" glow={2} />
        </group>
      ))}
      <Glow position={[0, 0.25, 0]} color="#ffd9a0" size={0.8} opacity={0.5} />
    </group>
  )
}

function CampLantern() {
  return (
    <group>
      <C p={[0, 0.03, 0]} rt={0.12} h={0.06} c="#6d5a6e" />
      <C p={[0, 0.2, 0]} rt={0.09} h={0.28} c="#ffe2a8" glow={1.1} />
      <C p={[0, 0.37, 0]} rt={0.05} rb={0.12} h={0.07} c="#6d5a6e" />
      <mesh position={[0, 0.42, 0]} material={mat('#6d5a6e')}>
        <torusGeometry args={[0.05, 0.01, 4, 10]} />
      </mesh>
      <Glow position={[0, 0.2, 0]} color="#ffd9a0" size={1.0} opacity={0.5} />
    </group>
  )
}

function Postcard() {
  return (
    <group position={[0, 1.3, 0]}>
      <B p={[0, 0, 0.012]} s={[0.5, 0.34, 0.02]} c="#fffaf0" />
      <B p={[-0.08, 0.02, 0.024]} s={[0.28, 0.22, 0.01]} c="#9fd6e8" />
      <B p={[-0.08, -0.06, 0.026]} s={[0.28, 0.06, 0.01]} c="#7fc59a" />
      <B p={[0.16, 0.09, 0.024]} s={[0.07, 0.08, 0.01]} c="#ff8fbf" />
    </group>
  )
}

const MODELS = {
  bed: Bed,
  sofa: Sofa,
  table: Table,
  chair: Chair,
  rug: Rug,
  floor_lamp: FloorLamp,
  plant: Plant,
  bookshelf: Bookshelf,
  picture: Picture,
  heart_lamp: HeartLamp,
  teddy: Teddy,
  vase: Vase,
  picnic_basket: PicnicBasket,
  candles: Candles,
  camp_lantern: CampLantern,
  postcard: Postcard,
  flowers: Flowers,
  bush: Bush,
  lantern: Lantern,
  garden_bench: GardenBench,
  small_tree: SmallTree,
}

/** One piece of furniture by kind. */
export default function Furniture({ kind }) {
  const Model = MODELS[kind]
  return Model ? <Model /> : null
}
