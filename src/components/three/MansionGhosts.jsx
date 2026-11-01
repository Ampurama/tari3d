import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Gnome, Bubble } from './Gnome'
import { mat } from './HomeFurniture'
import { aboveMe, floorY, FL, giveCookie, has, hasCookie, lastAct, MX, MZ, toWorld, useMansion } from '../../lib/mansion'
import { boss, bubbles, GHOST_IDS, partyFrozen, shown } from '../../lib/mansionGhosts'
import { GHOSTS, HINTS, LINES, CHAPTERS } from '../../lib/mansionStory'
import { useInteractable } from '../../lib/interactions'
import { player } from '../../lib/player'
import { say } from '../../lib/village'
import { serverNow } from '../../lib/clock'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'

/*
 * THE MANSION'S GHOSTS, drawn: little gnome-shaped ghosts (a round body that ends in a wisp, a
 * floppy pointed hat, big dark eyes), each animated by what lib/mansionGhosts.js says it's doing —
 * floating, fading away, popping up, leaning into a chase, tumbling over, dizzy after a wall, dancing.
 * Also: the party in the wine cellar, the chickens, and the Kenop family once the curse is broken.
 */

function ghostMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uOpacity: { value: 1 }, uColor: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uColor;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 1.6);
        float a = (0.32 + rim * 0.8) * uOpacity;
        gl_FragColor = vec4(uColor * (0.7 + rim * 0.8), a);
      }`,
  })
}

const EYE = new THREE.MeshBasicMaterial({ color: '#1c1620', transparent: true })
const CHEEK = new THREE.MeshBasicMaterial({ color: '#ff8fbf', transparent: true, opacity: 0.6, depthWrite: false })

/**
 * One ghost. `get()` → { x, y, z, yaw, st, op }; `look`: { color, hat, size, beard, crown };
 * `mode(st)` → how it moves for that state: 'float' | 'chase' | 'tumble' | 'dizzy' | 'dance' | 'cower' | 'blush' | 'pop' | 'puff'.
 */
function GhostGnome({ get, look, mode, children }) {
  const g = useRef()
  const body = useRef()
  const stars = useRef()
  const cheeks = useRef()
  const material = useMemo(() => ghostMaterial(look.color), [look.color])
  const eyes = useMemo(() => EYE.clone(), [])
  useEffect(() => () => (material.dispose(), eyes.dispose()), [material, eyes])
  useFrame(({ clock }) => {
    const s = get()
    const gr = g.current
    if (!gr) return
    const t = clock.elapsedTime + (look.phase || 0)
    const m = mode(s.st)
    const hide = aboveMe(s.x, s.y, s.z)
    gr.visible = s.op > 0.02 && !hide
    if (!gr.visible) return
    gr.position.set(s.x, s.y, s.z)
    gr.rotation.y = s.yaw
    const b = body.current
    let bob = Math.sin(t * 2.2) * 0.06
    let lean = 0
    let spin = 0
    let squash = 1
    if (m === 'chase') lean = 0.35
    if (m === 'tumble') spin = t * 9
    if (m === 'dizzy') lean = Math.sin(t * 6) * 0.3
    if (m === 'dance') {
      bob = Math.abs(Math.sin(t * 6)) * 0.18
      lean = Math.sin(t * 3) * 0.3
    }
    if (m === 'cower') {
      bob = Math.sin(t * 22) * 0.015
      squash = 0.86
    }
    if (m === 'pop') squash = 1 + Math.max(0, 0.4 - (t % 1.3) * 0.6)
    if (m === 'puff') squash = 1 + boss.wind * 0.35
    b.position.y = bob
    b.rotation.set(spin ? spin : lean, 0, m === 'dizzy' ? Math.sin(t * 6) * 0.2 : 0)
    b.scale.set(squash, m === 'cower' ? 0.9 : 1 / Math.sqrt(squash), squash)
    material.uniforms.uOpacity.value = s.op
    eyes.opacity = Math.min(1, s.op * 1.2)
    if (stars.current) {
      stars.current.visible = m === 'dizzy'
      stars.current.rotation.y = t * 4
    }
    if (cheeks.current) cheeks.current.visible = m === 'blush'
  })
  const k = look.size || 1
  return (
    <group ref={g}>
      <group ref={body} scale={k}>
        {/* the body, ending in a wisp */}
        <mesh position={[0, 0.5, 0]} scale={[0.32, 0.36, 0.3]} material={material}>
          <sphereGeometry args={[1, 18, 14]} />
        </mesh>
        <mesh position={[0, 0.18, -0.04]} rotation={[Math.PI + 0.25, 0, 0]} material={material}>
          <coneGeometry args={[0.24, 0.42, 14]} />
        </mesh>
        {/* the head and its big round eyes */}
        <mesh position={[0, 0.9, 0.02]} scale={0.24} material={material}>
          <sphereGeometry args={[1, 16, 12]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.085, 0.92, 0.22]} scale={[0.045, 0.06, 0.02]} material={eyes}>
            <sphereGeometry args={[1, 10, 8]} />
          </mesh>
        ))}
        <mesh position={[0, 0.82, 0.235]} scale={[0.04, 0.03, 0.02]} material={eyes}>
          <sphereGeometry args={[1, 8, 6]} />
        </mesh>
        <group ref={cheeks} visible={false}>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.15, 0.86, 0.19]} scale={[0.05, 0.03, 0.02]} material={CHEEK}>
              <sphereGeometry args={[1, 8, 6]} />
            </mesh>
          ))}
        </group>
        {/* the floppy hat */}
        <group position={[0, 1.08, -0.02]} rotation={[-0.15, 0, 0]}>
          <mesh position={[0, 0.16, 0]} material={material}>
            <coneGeometry args={[0.2, 0.36, 14]} />
          </mesh>
          <mesh position={[0.07, 0.38, -0.04]} rotation={[0, 0, -0.9]} material={material}>
            <coneGeometry args={[0.07, 0.18, 10]} />
          </mesh>
        </group>
        {/* little arms */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.33, 0.55, 0.06]} scale={[0.07, 0.11, 0.07]} rotation={[0, 0, s * 0.6]} material={material}>
            <sphereGeometry args={[1, 10, 8]} />
          </mesh>
        ))}
        {look.beard && (
          <mesh position={[0, 0.76, 0.17]} scale={[0.17, 0.2, 0.1]} material={material}>
            <sphereGeometry args={[1, 12, 10]} />
          </mesh>
        )}
        {look.crown && (
          <mesh position={[0, 1.17, 0]} material={mat('#ffd27f', 0.8)}>
            <cylinderGeometry args={[0.16, 0.18, 0.1, 6, 1, true]} />
          </mesh>
        )}
        {/* dizzy stars */}
        <group ref={stars} position={[0, 1.35, 0]} visible={false}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[Math.cos(i * 2.1) * 0.25, 0, Math.sin(i * 2.1) * 0.25]} material={mat('#ffe08a', 1.2)}>
              <octahedronGeometry args={[0.05, 0]} />
            </mesh>
          ))}
        </group>
        {children}
      </group>
    </group>
  )
}

/** A ghost's speech bubble (lines said by lib/mansionGhosts.js, for a few seconds). */
function GhostBubble({ id, y = 1.5 }) {
  const [text, setText] = useState(null)
  useEffect(() => {
    const iv = setInterval(() => {
      const b = bubbles[id]
      const next = b && performance.now() < b.until ? b.text : null
      setText((cur) => (cur === next ? cur : next))
    }, 200)
    return () => clearInterval(iv)
  }, [id])
  return <Bubble text={text} y={y} />
}

const LOOKS = {
  mimi: { color: '#f7c6ff', phase: 0.3 },
  buntut: { color: '#9fe0c8', phase: 1.1 },
  dor: { color: '#ffffff', phase: 2.2, size: 1.15 },
  usil: { color: '#ffe08a', phase: 0.7 },
  cici: { color: '#b8d6ff', phase: 1.7, size: 0.85 },
  penjaga: { color: '#c9b6f4', phase: 0.2, beard: true },
  opa: { color: '#b9a5ff', phase: 0.9, size: 1.7, beard: true, crown: true },
}
const MODES = {
  mimi: (st) => (st === 3 ? 'blush' : 'float'),
  buntut: (st) => (st === 1 ? 'chase' : st === 3 ? 'tumble' : st === 4 ? 'dizzy' : 'float'),
  dor: () => 'pop',
  usil: (st) => (st === 1 ? 'dance' : 'float'),
  cici: (st) => (st === 1 || st === 2 ? 'cower' : 'float'),
  penjaga: (st) => (st === 1 ? 'dance' : 'float'),
  opa: (st) => (boss.phase === 2 && boss.aim >= 0 ? 'puff' : boss.phase === 3 || boss.phase === 4 ? 'cower' : 'float'),
}
const LOST = (st) => st === 5

/** Talking with a ghost (through the village's talk card). */
function talk(id) {
  const g = GHOSTS[id]
  const s = shown[id]
  const at = [s.x, s.z]
  const pick = (list) => list[Math.floor(Math.random() * list.length)]
  const hint = () => {
    for (const ch of CHAPTERS) for (const goal of ch.goals) if (!has(goal.step)) return HINTS[goal.step]
    return HINTS.done
  }
  audio.sparkle()
  let text = pick(LINES[id] || ['…'])
  const options = []
  if (id === 'cici') {
    if (has('cici')) {
      text = `${pick(LINES.ciciFriend)} Psst, petunjuk: ${hint()}`
    } else if (hasCookie()) {
      options.push({
        label: 'Kasih kue jahe 🍪',
        kind: 'run',
        run: () => {
          giveCookie()
          say({ npc: 'mansion:cici', name: g.name, role: g.role, text: 'U-untukku? …Enak! Kamu baik sekali. Oke, aku nggak takut lagi. Sedikit.', at })
        },
      })
    } else text += ' (Cici gemetar. Mungkin kalau kamu diam saja sebentar… atau bawa camilan?)'
  }
  if (id === 'mimi') text = shown.mimi.st === 3 ? `${text} …Eh, mau tahu sesuatu? ${hint()}` : text
  if (id === 'buntut' && shown.buntut.st === 2) text = 'Aku patung. Patung tidak bicara. …Sial.'
  if (id === 'opa') text = has('boss_done') ? 'Jam itu… kalau kalian punya keempat pusaka, kembalikan. Aku sudah siap.' : pick(LINES.opa)
  if (id === 'penjaga' && has('bookcase')) text = 'Baiklah, baiklah. Rak itu sudah terbuka. Tapi kembalikan bukunya kalau dipinjam, ya.'
  say({ npc: 'mansion:' + id, name: g.name, role: g.role, text, options, at })
}

function GhostView({ id }) {
  const world = useMemo(() => new THREE.Vector3(), [])
  useInteractable('mansion:ghost:' + id, {
    get position() {
      const s = shown[id]
      return world.set(s.x, s.y - 0.25, s.z)
    },
    useY: true,
    radius: id === 'opa' ? 2.0 : 1.5,
    priority: 0.2,
    label: `Ngobrol dengan ${GHOSTS[id].name}`,
    enabled: () => {
      const s = shown[id]
      if (useStore.getState().view !== 'explore' || player.hide || s.op < 0.5 || aboveMe(s.x, s.y, s.z)) return false
      if (id === 'mimi') return s.st === 3
      if (id === 'dor') return s.st === 1
      if (id === 'opa') return boss.phase === 4 || boss.phase === 0
      return true
    },
    onInteract: () => talk(id),
  })
  const question = useRef()
  useFrame(() => {
    if (question.current) question.current.visible = LOST(shown[id].st) && id === 'buntut'
  })
  return (
    <GhostGnome get={() => shown[id]} look={LOOKS[id]} mode={MODES[id]}>
      <GhostBubble id={id} y={1.6} />
      {id === 'buntut' && (
        <mesh ref={question} position={[0, 1.5, 0]} material={mat('#ffe08a', 1)}>
          <torusGeometry args={[0.08, 0.025, 6, 12, Math.PI * 1.4]} />
        </mesh>
      )}
    </GhostGnome>
  )
}

/* ───────── the party in the wine cellar ───────── */

const PARTY_SPOTS = [
  [-5.6, 2.0],
  [-3.6, 2.0],
  [-5.4, 3.5],
  [-3.7, 3.4],
]
const PARTY_COLORS = ['#ff8fd0', '#9fd0ff', '#ffe08a', '#c9f2a0']
function PartyGhosts({ everywhere = false }) {
  const states = useMemo(() => PARTY_SPOTS.map(() => ({ x: 0, y: 0, z: 0, yaw: 0, st: 0, op: 1 })), [])
  useFrame(() => {
    const t = serverNow() / 1000
    const frozen = !everywhere && partyFrozen()
    PARTY_SPOTS.forEach(([lx, lz], i) => {
      const s = states[i]
      const [x, z] = toWorld(lx + (frozen ? 0 : Math.sin(t * 1.4 + i) * 0.25), lz + (frozen ? 0 : Math.cos(t * 1.1 + i * 2) * 0.2))
      s.x = x
      s.z = z
      s.y = floorY('B') + 0.2
      // frozen: all looking at the door, very innocent; otherwise dancing round the cake
      s.yaw = frozen ? -Math.PI / 2 + 0.2 * i : t * 2 + i
      s.st = frozen ? 0 : 1
    })
  })
  return PARTY_SPOTS.map((_, i) => <GhostGnome key={i} get={() => states[i]} look={{ color: PARTY_COLORS[i], phase: i * 0.8, size: 0.8 }} mode={(st) => (st ? 'dance' : 'float')} />)
}

/** In the funny ending, the house's own ghosts dance where they stand (and the cellar's gang joins). */
const DANCE_SPOTS = {
  mimi: [-1.0, 2.0, 'G'],
  buntut: [1.0, 3.2, 'G'],
  dor: [-0.4, 3.8, 'G'],
  usil: [-4.4, 2.2, 'G'],
  cici: [4.2, 1.6, 'G'],
  penjaga: [4.6, -2.0, 'G'],
  opa: [0.6, -1.0, 'A'],
}
function DancingGhost({ id }) {
  const s = useMemo(() => ({ x: 0, y: 0, z: 0, yaw: 0, st: 1, op: 1 }), [])
  useFrame(() => {
    const t = serverNow() / 1000
    const [lx, lz, f] = DANCE_SPOTS[id]
    const [x, z] = toWorld(lx + Math.sin(t * 1.3 + lx) * 0.3, lz + Math.cos(t * 1.2 + lz) * 0.3)
    s.x = x
    s.z = z
    s.y = floorY(f) + 0.25
    s.yaw = t * 1.6 + lx
  })
  return <GhostGnome get={() => s} look={LOOKS[id]} mode={() => 'dance'} />
}

/* ───────── the good ending: the Kenop family, gnomes again ───────── */

const BASE = { skin: '#ffd9c4', nose: '#ffae9c', pants: '#6d5a6e' }
const FAMILY = [
  { id: 'opa', at: [0.4, 3.3, 'G'], look: { shirt: '#7a5fc4', apron: '#f4f0f6', apronDark: '#9a6b4a', hat: '#5b4a6e', band: '#ffd27f', beard: '#f4f0f6', hair: '#f4f0f6', tallHat: true }, mode: 'wave' },
  { id: 'bu', at: [-0.9, 3.0, 'G'], look: { shirt: '#e8566f', apron: '#fff4e4', apronDark: '#e8798f', hat: '#ffb347', band: '#fff4e4', hair: '#c8794e', beard: null }, mode: 'talk' },
  { id: 'mimi', at: [-1.4, 2.0, 'G'], look: { shirt: '#f7a8c4', apron: '#ffffff', apronDark: '#e8798f', hat: '#f7c6ff', band: '#ffffff', hair: '#a0643f', beard: null }, mode: 'wave' },
  { id: 'cici', at: [1.3, 2.2, 'G'], look: { shirt: '#9fd0ff', apron: '#fff6ea', apronDark: '#5f8f86', hat: '#b8d6ff', band: '#ffd27f', hair: '#3a2a3e', beard: null }, mode: 'idle' },
  { id: 'usil', at: [-4.4, 2.4, 'G'], look: { shirt: '#ffe08a', apron: '#fff6ea', apronDark: '#c47a52', hat: '#ffb347', band: '#e8566f', hair: '#c8794e', beard: null }, mode: 'talk' },
  { id: 'buntut', at: [4.6, 1.8, 'G'], look: { shirt: '#8fc9b3', apron: '#fff6ea', apronDark: '#5f8f86', hat: '#3f8f86', band: '#ffd27f', hair: '#3a2a3e', beard: '#c8794e' }, mode: 'idle' },
  { id: 'penjaga', at: [4.8, -2.2, 'G'], look: { shirt: '#c9b6f4', apron: '#ffe9a8', apronDark: '#7a6aae', hat: '#5b4a6e', band: '#ffd27f', hair: '#d9cbb8', beard: '#d9cbb8', glasses: true }, mode: 'read' },
  { id: 'dor', at: [1.5, 4.2, 'G'], look: { shirt: '#ffffff', apron: '#ff8fbf', apronDark: '#e8566f', hat: '#e8566f', band: '#ffffff', hair: '#c8794e', beard: null }, mode: 'wave' },
]
const FAMILY_LINES = {
  opa: 'Terima kasih sudah membuka jendela-jendela rumah ini. Dan hatiku.',
  bu: 'Mampirlah untuk makan malam! Aku masak sup jamur. Tanpa ayam, janji.',
  mimi: 'Aku masih pemalu. Tapi sekarang pipiku merah beneran, bukan tembus pandang!',
  cici: 'Ternyata dunia luar nggak seseram itu. Gelap masih seram, sih.',
  usil: 'Aku nggak usil lagi. …Kecuali sedikit. Ayam-ayamnya aku lepas ke kebun.',
  buntut: 'Aku sekarang jalan di depan, bukan di belakang. Rasanya aneh.',
  penjaga: 'Perpustakaan sekarang buka untuk umum! Tetap jangan berisik, ya.',
  dor: 'DOR! …Hehe, sekarang cuma becanda.',
}
function FamilyGnome({ m }) {
  const g = useRef()
  const world = useMemo(() => new THREE.Vector3(), [])
  const look = useMemo(() => ({ ...BASE, ...m.look, phase: m.id.length }), [m])
  const [lx, lz, f] = m.at
  const [x, z] = toWorld(lx, lz)
  useInteractable('mansion:family:' + m.id, {
    position: world.set(x, floorY(f), z),
    useY: true,
    radius: 1.3,
    label: `Ngobrol dengan ${m.id === 'bu' ? 'Bu Kenop' : GHOSTS[m.id]?.name}`,
    enabled: () => useStore.getState().view === 'explore',
    onInteract: () => say({ npc: 'mansion:family:' + m.id, name: m.id === 'bu' ? 'Bu Kenop' : GHOSTS[m.id]?.name, role: 'Keluarga Kenop', text: FAMILY_LINES[m.id], at: [x, z] }),
  })
  useFrame(() => {
    if (!g.current) return
    g.current.visible = !aboveMe(x, floorY(f), z)
    g.current.rotation.y = Math.atan2(player.position.x - x, player.position.z - z) * 0.6
  })
  return (
    <group ref={g} position={[x, floorY(f), z]}>
      <Gnome look={look} pose={() => ({ mode: m.mode })} />
    </group>
  )
}

/* ───────── the chickens (24 of them, out of the kitchen cupboard) ───────── */

const N_CHICKENS = 24
const hash = (s) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
/** a point bouncing inside [a, b] (the same on both screens: no state, only time) */
const bounce = (p0, v, t, a, b) => {
  const span = b - a
  let u = (((p0 - a + v * t) % (2 * span)) + 2 * span) % (2 * span)
  return a + (u > span ? 2 * span - u : u)
}
export function Chickens() {
  const refs = useRef([])
  useFrame(() => {
    const ending = useMansion.getState().run.ending
    const a = lastAct('chickens', null, 10000)
    const t = serverNow() / 1000
    const seed = a ? hash(a.id) : 7
    refs.current.forEach((g, i) => {
      if (!g) return
      if (ending === 'funny') {
        // a chicken line dance in the foyer
        const row = Math.floor(i / 6)
        const col = i % 6
        g.visible = i < 12
        g.position.set(-1.5 + col * 0.6 + Math.sin(t * 3 + row) * 0.15, FL.G + Math.abs(Math.sin(t * 6 + col)) * 0.12, 1.4 + row * 0.7)
        g.rotation.y = Math.sin(t * 3 + i) * 0.8
        return
      }
      if (!a) {
        g.visible = false
        return
      }
      const into = t - a.at / 1000
      g.visible = into >= 0 && into < 7.5 && !aboveMe(MX + 3.6, floorY('G'), MZ + 4.4)
      if (!g.visible) return
      const r = ((seed >> (i % 24)) & 1023) / 1023
      const ang = (i / N_CHICKENS) * Math.PI * 2 + r
      const sp = 1.8 + r * 1.4
      // out of the cupboard, then round and round the kitchen and the foyer, then off through the door
      const run = Math.max(0, into - i * 0.06)
      const lx = bounce(3.6, Math.cos(ang) * sp, run, -1.8, 6.6)
      const lz = bounce(4.2, -Math.abs(Math.sin(ang)) * sp - 0.3, run, 0.3, 4.7)
      g.position.set(lx, FL.G + Math.abs(Math.sin(run * 14 + i)) * 0.06, lz)
      g.rotation.y = ang + Math.sin(run * 6) * 0.6
      g.scale.setScalar(Math.min(1, run * 3) * (into > 6.5 ? Math.max(0, 7.5 - into) : 1))
    })
  })
  return Array.from({ length: N_CHICKENS }, (_, i) => (
    <group key={i} ref={(el) => (refs.current[i] = el)} visible={false}>
      <mesh position={[0, 0.13, 0]} scale={[0.11, 0.1, 0.14]} material={mat('#fffaf2')}>
        <sphereGeometry args={[1, 10, 8]} />
      </mesh>
      <mesh position={[0, 0.25, 0.09]} scale={0.06} material={mat('#fffaf2')}>
        <sphereGeometry args={[1, 8, 6]} />
      </mesh>
      <mesh position={[0, 0.32, 0.09]} scale={[0.015, 0.03, 0.03]} material={mat('#e8566f')}>
        <sphereGeometry args={[1, 6, 4]} />
      </mesh>
      <mesh position={[0, 0.24, 0.16]} rotation={[Math.PI / 2, 0, 0]} material={mat('#ffb347')}>
        <coneGeometry args={[0.02, 0.05, 5]} />
      </mesh>
      {i === N_CHICKENS - 1 && (
        <mesh position={[0, 0.33, 0.07]} material={mat('#8a6a4a')}>
          <coneGeometry args={[0.05, 0.08, 6]} />
        </mesh>
      )}
    </group>
  ))
}

/* ───────── all of them ───────── */

export default function MansionGhosts() {
  const ending = useMansion((s) => s.run.ending)
  if (ending === 'good') return FAMILY.map((m) => <FamilyGnome key={m.id} m={m} />)
  if (ending === 'funny')
    return (
      <group>
        {GHOST_IDS.map((id) => (
          <DancingGhost key={id} id={id} />
        ))}
        <PartyGhosts everywhere />
      </group>
    )
  return (
    <group>
      {GHOST_IDS.map((id) => (
        <GhostView key={id} id={id} />
      ))}
      <PartyGhosts />
    </group>
  )
}
