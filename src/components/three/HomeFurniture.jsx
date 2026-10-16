import * as THREE from 'three'
import { Glow, HeartMesh } from './Bits'
import { CATALOG, WALL_STYLES } from '../../lib/homeLayout'
import { useHome } from '../../lib/home'

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

/* ───────── plants that show how they're doing (lib/home.js plantNeeds) ───────── */

const FRESH = { mood: 'segar', growth: 'sedang' }
const tint = new THREE.Color()
const DRY = { haus: ['#c3c46a', 0.45], layu: ['#b39a5e', 0.72], kering: ['#9c7a55', 0.92] }
/** A leaf colour for how thirsty the plant is (a little yellow, then brown). */
const leafFor = (base, mood) => (DRY[mood] ? '#' + tint.set(base).lerp(tint.clone().set(DRY[mood][0]), DRY[mood][1]).getHexString() : base)
/** A flower colour: paler when thirsty, faded and brownish when wilting. */
const petalFor = (base, mood) =>
  mood === 'segar' ? base : '#' + tint.set(base).lerp(tint.clone().set(mood === 'haus' ? '#ffffff' : '#b9958a'), mood === 'haus' ? 0.25 : 0.65).getHexString()
/** How many of a plant's flowers are still open. */
const openFor = (n, mood) => Math.round(n * { segar: 1, haus: 0.7, layu: 0.35, kering: 0 }[mood])

/** A lighter (k > 0) or darker (k < 0) shade of a colour, as hex. */
const shadeCache = new Map()
export function shade(hex, k) {
  const key = hex + k
  if (!shadeCache.has(key)) {
    const c = new THREE.Color(hex)
    shadeCache.set(key, '#' + (k > 0 ? c.lerp(new THREE.Color('#ffffff'), k) : c.multiplyScalar(1 + k)).getHexString())
  }
  return shadeCache.get(key)
}

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

function Bed({ color = '#f7a8c4' }) {
  return (
    <group>
      <B p={[0, 0.15, 0]} s={[1.2, 0.3, 1.9]} c={WOOD} />
      <B p={[0, 0.39, 0.03]} s={[1.1, 0.18, 1.78]} c={CREAM} />
      <B p={[0, 0.5, 0.33]} s={[1.14, 0.07, 1.12]} c={color} />
      <B p={[0, 0.54, 0.33]} s={[1.15, 0.02, 0.18]} c={shade(color, 0.45)} />
      <B p={[0, 0.54, -0.62]} s={[0.78, 0.12, 0.34]} c="#ffffff" />
      <B p={[0, 0.55, -0.9]} s={[1.2, 0.9, 0.1]} c={WOOD_DARK} />
      <S p={[0, 1.0, -0.9]} s={[0.12, 0.11, 0.05]} c="#ff8fbf" />
    </group>
  )
}

function Sofa({ color = '#b9a5e8' }) {
  const dark = shade(color, -0.1)
  const light = shade(color, 0.35)
  return (
    <group>
      <B p={[0, 0.18, 0]} s={[1.6, 0.32, 0.75]} c={color} />
      <B p={[0, 0.52, -0.29]} s={[1.6, 0.5, 0.18]} c={dark} />
      <B p={[-0.72, 0.34, 0]} s={[0.16, 0.36, 0.75]} c={dark} />
      <B p={[0.72, 0.34, 0]} s={[0.16, 0.36, 0.75]} c={dark} />
      <B p={[-0.32, 0.39, 0.05]} s={[0.6, 0.1, 0.52]} c={light} />
      <B p={[0.32, 0.39, 0.05]} s={[0.6, 0.1, 0.52]} c={light} />
      <B p={[0.42, 0.56, -0.12]} s={[0.3, 0.28, 0.1]} c="#ffc2d9" r={[0, 0, 0.15]} />
    </group>
  )
}

function Table({ color = WOOD }) {
  return (
    <group>
      <B p={[0, 0.62, 0]} s={[1.0, 0.06, 0.7]} c={color} />
      {legs(0.9, 0.6, 0.6, shade(color, -0.2))}
      <C p={[0.2, 0.7, 0.05]} rt={0.06} rb={0.05} h={0.1} c="#ffffff" />
    </group>
  )
}

function Chair({ color = '#ffc2d9' }) {
  return (
    <group>
      <B p={[0, 0.42, 0]} s={[0.45, 0.06, 0.45]} c={WOOD} />
      {legs(0.42, 0.42, 0.4)}
      <B p={[0, 0.7, -0.2]} s={[0.45, 0.5, 0.05]} c={WOOD} />
      <B p={[0, 0.47, 0.02]} s={[0.36, 0.04, 0.36]} c={color} />
    </group>
  )
}

function Rug({ color = '#f5a9c6' }) {
  return (
    <group>
      <B p={[0, 0.008, 0]} s={[1.6, 0.016, 1.1]} c={color} rough={1} />
      <B p={[0, 0.012, 0]} s={[1.3, 0.016, 0.8]} c={shade(color, 0.82)} rough={1} />
      <B p={[0, 0.016, 0]} s={[0.9, 0.016, 0.4]} c={shade(color, 0.4)} rough={1} />
    </group>
  )
}

function FloorLamp({ color = '#ffe7b8' }) {
  return (
    <group>
      <C p={[0, 0.02, 0]} rt={0.15} h={0.04} c={WOOD_DARK} />
      <C p={[0, 0.67, 0]} rt={0.022} h={1.3} c={WOOD_DARK} seg={6} />
      <C p={[0, 1.38, 0]} rt={0.12} rb={0.2} h={0.26} c={color} glow={0.9} />
      <Glow position={[0, 1.36, 0]} color="#ffd9a0" size={1.3} opacity={0.5} />
    </group>
  )
}

function Plant({ needs = FRESH }) {
  const { mood, growth } = needs
  const blooms = growth === 'mekar' ? openFor(4, mood) : 0
  return (
    <group>
      <C p={[0, 0.15, 0]} rt={0.17} rb={0.13} h={0.3} c="#e08f6a" />
      <Blob p={[0, 0.5, 0]} s={[0.24, 0.26, 0.24]} c={leafFor('#6fb85a', mood)} />
      <Blob p={[0.1, 0.68, 0.04]} s={[0.15, 0.16, 0.15]} c={leafFor('#86c96b', mood)} />
      {growth !== 'kecil' && <Blob p={[-0.12, 0.62, -0.06]} s={[0.13, 0.14, 0.13]} c={leafFor('#7cc262', mood)} />}
      {[
        [0.05, 0.84, 0.05, '#ff9cc6'],
        [-0.14, 0.74, 0.08, '#ffffff'],
        [0.17, 0.72, -0.06, '#ffd27f'],
        [-0.04, 0.78, -0.15, '#ff9cc6'],
      ]
        .slice(0, blooms)
        .map(([x, y, z, c], i) => (
          <S key={i} p={[x, y, z]} s={0.045} c={petalFor(c, mood)} />
        ))}
    </group>
  )
}

const BOOK = ['#f7a8c4', '#9ec8f0', '#ffd27f', '#b9a5e8', '#8fd1a5', '#ffffff']
function Bookshelf({ color = WOOD }) {
  return (
    <group>
      <B p={[0, 0.65, -0.17]} s={[1.0, 1.3, 0.05]} c={shade(color, -0.2)} />
      <B p={[-0.475, 0.65, 0]} s={[0.05, 1.3, 0.4]} c={color} />
      <B p={[0.475, 0.65, 0]} s={[0.05, 1.3, 0.4]} c={color} />
      {[0.02, 0.44, 0.86, 1.28].map((y) => (
        <B key={y} p={[0, y, 0]} s={[1.0, 0.04, 0.4]} c={color} />
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

function Vase({ needs = FRESH }) {
  const { mood } = needs
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
          <C p={[x / 2, (y + 0.45) / 2, z / 2]} rt={0.008} h={y - 0.45} c={leafFor('#6fb85a', mood)} seg={4} />
          <S p={[x, y - (mood === 'layu' || mood === 'kering' ? 0.04 : 0), z]} s={mood === 'kering' ? 0.03 : 0.045} c={petalFor(c, mood)} />
        </group>
      ))}
    </group>
  )
}

const PETALS = ['#ff8fbf', '#ffd27f', '#f7f2ff', '#b9a5e8', '#ff9f8f']
function Flowers({ needs = FRESH }) {
  const { mood, growth } = needs
  const total = growth === 'mekar' ? 12 : growth === 'kecil' ? 6 : 8
  const open = openFor(total, mood)
  return (
    <group>
      <B p={[0, 0.05, 0]} s={[1.0, 0.1, 0.6]} c={WOOD_DARK} />
      <B p={[0, 0.07, 0]} s={[0.9, 0.08, 0.5]} c={mood === 'kering' ? '#a07a5a' : '#8a6248'} />
      {Array.from({ length: total }, (_, i) => {
        const row = Math.floor(i / 4)
        const x = -0.36 + (i % 4) * 0.24 + (row === 2 ? 0.12 : 0)
        const z = row === 0 ? -0.12 : row === 1 ? 0.12 : 0
        return (
          <group key={i}>
            <S p={[x, 0.17, z]} s={[0.07, 0.05, 0.07]} c={leafFor('#6fb85a', mood)} />
            {i < open && <S p={[x, growth === 'kecil' ? 0.22 : 0.25, z]} s={growth === 'mekar' ? 0.058 : 0.05} c={petalFor(PETALS[i % PETALS.length], mood)} />}
          </group>
        )
      })}
    </group>
  )
}

function Bush({ needs = FRESH }) {
  const { mood, growth } = needs
  const spots = [
    [0.2, 0.45, 0.28],
    [-0.25, 0.4, 0.22],
    [0.05, 0.62, 0.15],
    [-0.1, 0.55, -0.25],
    [0.28, 0.35, -0.12],
    [-0.3, 0.3, -0.05],
    [0.12, 0.66, -0.1],
  ]
  const blossoms = openFor(growth === 'mekar' ? 7 : growth === 'kecil' ? 1 : 3, mood)
  return (
    <group>
      <Blob p={[0, 0.34, 0]} s={[0.4, 0.34, 0.4]} c={leafFor('#6fb85a', mood)} />
      <Blob p={[0.15, 0.48, 0.1]} s={[0.2, 0.18, 0.2]} c={leafFor('#86c96b', mood)} />
      {spots.slice(0, blossoms).map((p, i) => (
        <S key={i} p={p} s={0.04} c={petalFor('#ffb3cf', mood)} />
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

function GardenBench({ color = WOOD }) {
  return (
    <group>
      <B p={[0, 0.42, 0]} s={[1.3, 0.06, 0.45]} c={color} />
      <B p={[0, 0.7, -0.2]} s={[1.3, 0.3, 0.05]} c={color} />
      {legs(1.2, 0.4, 0.4, '#6d5a6e', 0.05)}
    </group>
  )
}

function SmallTree({ needs = FRESH }) {
  const { mood, growth } = needs
  // the blossom canopy thins out as it gets thirsty
  const k = { segar: 1, haus: 0.92, layu: 0.78, kering: 0.62 }[mood]
  return (
    <group>
      <C p={[0, 0.45, 0]} rt={0.06} rb={0.09} h={0.9} c="#9a6b4a" seg={7} />
      <Blob p={[0, 1.15, 0]} s={[0.45 * k, 0.38 * k, 0.45 * k]} c={petalFor('#ffc2d9', mood)} />
      <Blob p={[0.22, 1.32, 0.08]} s={[0.26 * k, 0.22 * k, 0.26 * k]} c={petalFor('#ffd6e6', mood)} />
      <Blob p={[-0.2, 1.05, 0.12]} s={[0.24 * k, 0.2 * k, 0.24 * k]} c={petalFor('#f7a8c4', mood)} />
      {growth === 'mekar' && mood !== 'kering' && (
        <>
          <Blob p={[-0.1, 1.42, -0.15]} s={[0.22, 0.18, 0.22]} c={petalFor('#ffe0ec', mood)} />
          <Blob p={[0.28, 1.08, -0.18]} s={[0.18, 0.16, 0.18]} c={petalFor('#ffb3cf', mood)} />
        </>
      )}
    </group>
  )
}

/* ───────── kitchen, bathroom, entertainment ───────── */

/** A little stove with an oven door, two rings and a pot. `cooking`: steam rises, the rings glow. */
function Stove({ color = '#f6e3c6' }) {
  return (
    <group>
      <B p={[0, 0.42, 0]} s={[0.7, 0.84, 0.6]} c={color} />
      <B p={[0, 0.86, 0]} s={[0.72, 0.04, 0.62]} c="#5d5363" />
      <B p={[0, 0.36, 0.305]} s={[0.5, 0.36, 0.02]} c={shade(color, -0.25)} />
      <B p={[0, 0.36, 0.317]} s={[0.36, 0.22, 0.01]} c="#3b3346" rough={0.3} />
      <B p={[0, 0.6, 0.313]} s={[0.4, 0.03, 0.02]} c="#d9d2dd" />
      {[-0.17, 0.17].map((x) => (
        <C key={x} p={[x, 0.885, -0.05]} rt={0.11} h={0.012} c="#2e2836" />
      ))}
      <C p={[-0.17, 0.95, -0.05]} rt={0.1} rb={0.09} h={0.13} c="#f29bb3" />
      <B p={[0.09, 0.95, -0.05]} s={[0.16, 0.02, 0.03]} c="#5d5363" />
      {[-0.2, 0, 0.2].map((x) => (
        <S key={x} p={[x, 0.78, 0.31]} s={0.025} c="#d9d2dd" />
      ))}
    </group>
  )
}

/** A rounded retro fridge. */
function Fridge({ color = '#bfe3d6' }) {
  return (
    <group>
      <B p={[0, 0.82, 0]} s={[0.66, 1.64, 0.62]} c={color} rough={0.45} />
      <B p={[0, 1.18, 0.312]} s={[0.6, 0.02, 0.01]} c={shade(color, -0.25)} />
      <B p={[-0.24, 1.42, 0.33]} s={[0.04, 0.22, 0.04]} c="#e8e2ea" rough={0.3} />
      <B p={[-0.24, 0.85, 0.33]} s={[0.04, 0.34, 0.04]} c="#e8e2ea" rough={0.3} />
      {/* a few magnets and a little heart note */}
      <S p={[0.12, 1.45, 0.32]} s={0.03} c="#ff8fbf" />
      <S p={[0.2, 1.35, 0.32]} s={0.025} c="#ffd27f" />
      <B p={[0.12, 0.95, 0.315]} s={[0.16, 0.18, 0.01]} c="#fffaf0" />
      <S p={[0.12, 0.98, 0.322]} s={[0.03, 0.03, 0.01]} c="#ff8fbf" />
    </group>
  )
}

/** A clawfoot bathtub. `bathing`: it's full of bubbles. */
function Bathtub({ color = '#ffffff' }) {
  return (
    <group>
      <B p={[0, 0.36, 0]} s={[0.8, 0.5, 1.5]} c={color} rough={0.3} />
      <B p={[0, 0.58, 0]} s={[0.66, 0.06, 1.34]} c="#cdeaf3" rough={0.2} />
      {[
        [-0.32, -0.62],
        [0.32, -0.62],
        [-0.32, 0.62],
        [0.32, 0.62],
      ].map(([x, z], i) => (
        <S key={i} p={[x, 0.07, z]} s={[0.06, 0.07, 0.06]} c="#e0b85c" />
      ))}
      <C p={[0, 0.78, -0.72]} rt={0.025} h={0.32} c="#d9d2dd" />
      <B p={[0, 0.92, -0.64]} s={[0.04, 0.03, 0.18]} c="#d9d2dd" />
      {/* a little stack of towels and a rubber duck */}
      <S p={[0.28, 0.66, 0.55]} s={[0.07, 0.05, 0.06]} c="#ffe36e" />
    </group>
  )
}

/** A small TV on a low cabinet. `on`: the screen glows. */
function Tv({ color = '#a88fe0', on = false }) {
  return (
    <group>
      <B p={[0, 0.22, 0]} s={[1.0, 0.44, 0.4]} c={color} />
      <B p={[0, 0.22, 0.201]} s={[0.9, 0.02, 0.01]} c={shade(color, -0.2)} />
      <B p={[0, 0.82, -0.02]} s={[0.86, 0.54, 0.06]} c="#3b3346" rough={0.4} />
      <B p={[0, 0.82, 0.012]} s={[0.78, 0.46, 0.01]} c={on ? '#bde6ff' : '#2a2433'} glow={on ? 1.1 : 0} rough={0.2} />
      <B p={[0, 0.48, -0.02]} s={[0.12, 0.1, 0.06]} c="#3b3346" />
    </group>
  )
}

/* ───────── structure: build your own rooms ───────── */

/** The walls' colour (wallpaper), so wall pieces match the house. */
const useWallColor = () => useHome((s) => WALL_STYLES[s.style.wall]?.color || '#fff1dc')
const PIECE_H = 1.45

/** A straight piece of wall (1.5 m), in the colour of the walls, with a pink skirting board. */
function WallPanel() {
  const c = useWallColor()
  return (
    <group>
      <B p={[0, PIECE_H / 2, 0]} s={[1.5, PIECE_H, 0.12]} c={c} />
      <B p={[0, 0.06, 0]} s={[1.52, 0.12, 0.15]} c="#f7c6d0" />
      <B p={[0, PIECE_H + 0.02, 0]} s={[1.54, 0.04, 0.16]} c={shade(c, -0.06)} />
    </group>
  )
}

/** A piece of wall with an arched doorway in the middle (you walk through it). */
function WallArch() {
  const c = useWallColor()
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.6, 0, 0]}>
          <B p={[0, PIECE_H / 2, 0]} s={[0.3, PIECE_H, 0.12]} c={c} />
          <B p={[0, 0.06, 0]} s={[0.32, 0.12, 0.15]} c="#f7c6d0" />
        </group>
      ))}
      <B p={[0, PIECE_H - 0.12, 0]} s={[1.5, 0.24, 0.12]} c={c} />
      <B p={[0, PIECE_H + 0.02, 0]} s={[1.54, 0.04, 0.16]} c={shade(c, -0.06)} />
      <mesh position={[0, 1.08, 0]} material={mat('#ffffff')}>
        <torusGeometry args={[0.43, 0.035, 6, 18, Math.PI]} />
      </mesh>
    </group>
  )
}

/* ───────── keepsakes from dates ───────── */

export { PetBed }

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

/** A round, soft pet bed (lies flat like a rug, so it never blocks the way). */
function PetBed() {
  return (
    <group>
      <C p={[0, 0.05, 0]} rt={0.32} rb={0.34} h={0.1} c="#f7a8c4" seg={16} />
      <C p={[0, 0.075, 0]} rt={0.24} h={0.06} c="#fff0f5" seg={16} />
      <S p={[0.12, 0.12, 0.08]} s={[0.05, 0.04, 0.05]} c="#ffd27f" />
    </group>
  )
}

/** Rewards from Sky Island: a lamp with a star on top, and a paper lantern with a cloud. */
function StarLamp() {
  return (
    <group>
      <C p={[0, 0.03, 0]} rt={0.14} h={0.06} c="#6d5a6e" />
      <C p={[0, 0.35, 0]} rt={0.02} h={0.6} c="#6d5a6e" seg={6} />
      <mesh position={[0, 0.75, 0]} material={mat('#ffe27a', 1.6)} scale={0.13}>
        <octahedronGeometry args={[1, 0]} />
      </mesh>
      <Glow position={[0, 0.75, 0]} color="#ffe2a8" size={1.1} opacity={0.55} />
    </group>
  )
}

function SkyLantern() {
  return (
    <group>
      <C p={[0, 0.03, 0]} rt={0.12} h={0.06} c="#a5714a" />
      <C p={[0, 0.3, 0]} rt={0.12} rb={0.15} h={0.42} c="#ffd6ea" glow={0.9} />
      <S p={[0, 0.3, 0.14]} s={[0.07, 0.04, 0.02]} c="#ffffff" />
      <C p={[0, 0.53, 0]} rt={0.05} rb={0.12} h={0.05} c="#a5714a" />
      <Glow position={[0, 0.3, 0]} color="#ffc2dd" size={1.0} opacity={0.5} />
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
  pet_bed: PetBed,
  star_lamp: StarLamp,
  sky_lantern: SkyLantern,
  flowers: Flowers,
  bush: Bush,
  lantern: Lantern,
  garden_bench: GardenBench,
  small_tree: SmallTree,
  stove: Stove,
  fridge: Fridge,
  bathtub: Bathtub,
  tv: Tv,
  wall_panel: WallPanel,
  wall_arch: WallArch,
}

/**
 * One piece of furniture by kind, in its colour (`variant`, from the catalog's colours). Plants also
 * show how they're doing (`needs`); `on` lights up what's in use (the TV).
 */
export default function Furniture({ kind, needs, variant = 0, on }) {
  const Model = MODELS[kind]
  const color = CATALOG[kind]?.colors?.[variant]
  return Model ? <Model needs={needs} on={on} {...(color ? { color } : {})} /> : null
}
