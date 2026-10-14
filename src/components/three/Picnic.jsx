import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { companion, picnic } from '../../content/config'
import { PICNIC, picnicSpot } from '../../lib/layout'
import { input, player } from '../../lib/player'
import { standHeight } from '../../lib/terrain'
import { useInteractable } from '../../lib/interactions'
import { isoBack } from '../../lib/iso'
import { PICNIC_GAMES } from '../../lib/story'
import { useChapterUnlocked, useStore } from '../../store'
import { audio } from '../../audio/engine'
import Tappable from './Interact'
import { Glow } from './Bits'

/*
 * CHAPTER 4 — THE DISASTER DATE. A little picnic on the hill and three quick, forgiving
 * mini-games: catch the flowers the wind stole, save the sandwich from a tiny thief, and put
 * the picnic back together. Nothing can be failed — mistakes only make something funny happen.
 */

const damp = THREE.MathUtils.damp
const say = (t, ms) => useStore.getState().mochiSay(t, ms)
const toast = (t, ms) => useStore.getState().showToast(t, ms)
const ITEMS = ['blanket', 'basket', 'vase']
/** Mini-game progress the HUD shows ("2 / 3"). */
const setCount = (picnicCount) => useStore.setState({ picnicCount })

/** Tap handling that ignores drags (and works with mouse, touch and pen). */
function useTap(onTap, live = true) {
  const [hover, setHover] = useState(false)
  useCursor(hover && live)
  return {
    onClick: (e) => {
      if (!live) return
      e.stopPropagation()
      if (e.delta > 10) return
      onTap(e)
    },
    onPointerOver: (e) => {
      if (!live) return
      e.stopPropagation()
      setHover(true)
    },
    onPointerOut: () => setHover(false),
  }
}

/** A tap target bigger than the thing it belongs to (fingers are bigger than flowers). */
const Hit = ({ r = 0.5, ...p }) => (
  <mesh {...p}>
    <sphereGeometry args={[r, 10, 8]} />
    <meshBasicMaterial colorWrite={false} depthWrite={false} />
  </mesh>
)

/* ───────── the picnic things ───────── */

const CHECK = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    g.fillStyle = (x + y) % 2 ? '#fff6ee' : '#ff9cc4'
    g.fillRect(x * 8, y * 8, 8, 8)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.magFilter = THREE.NearestFilter
  return t
})()

function Blanket({ crumpled }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, crumpled ? 0.6 : 0.2]} position={[0, crumpled ? 0.06 : 0.02, 0]} scale={crumpled ? [0.45, 0.35, 1] : [1, 1, 1]}>
      <planeGeometry args={[1.5, 1.2]} />
      <meshStandardMaterial map={CHECK} roughness={0.9} side={THREE.DoubleSide} />
    </mesh>
  )
}

function Basket({ tipped }) {
  return (
    <group rotation={[0, 0, tipped ? 1.3 : 0]} position={[0, tipped ? 0.12 : 0, 0]}>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.18, 0.14, 0.24, 12]} />
        <meshStandardMaterial color="#d9a66b" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.27, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.14, 0.015, 6, 16, Math.PI]} />
        <meshStandardMaterial color="#b9844f" />
      </mesh>
      {/* the sandwich everyone wants */}
      <mesh position={[0.02, 0.27, 0]} scale={[0.12, 0.04, 0.1]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#f3d39b" />
      </mesh>
    </group>
  )
}

function Vase({ tipped }) {
  return (
    <group rotation={[tipped ? 1.4 : 0, 0, 0]} position={[0, tipped ? 0.08 : 0, 0]}>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 0.24, 10]} />
        <meshStandardMaterial color="#cfe6ff" roughness={0.2} metalness={0.1} />
      </mesh>
      {[-0.04, 0.03, 0].map((x, i) => (
        <mesh key={i} position={[x, 0.3 + i * 0.03, (i - 1) * 0.03]} scale={0.045}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color={['#ff8fc4', '#ffd98a', '#c9a8ff'][i]} emissive={['#ff8fc4', '#ffd98a', '#c9a8ff'][i]} emissiveIntensity={0.4} />
        </mesh>
      ))}
    </group>
  )
}

const MESH = { blanket: Blanket, basket: Basket, vase: Vase }

/* ───────── A · Catch the Flying Flowers ───────── */

function FlyingFlower({ index, caught, onCatch }) {
  const ref = useRef()
  const live = !caught
  const handlers = useTap(() => onCatch(index), live)
  const phase = index * 2.1
  useFrame(({ clock }, delta) => {
    const g = ref.current
    if (caught) {
      // fly into the basket
      g.position.lerp(PICNIC.slots.basket.clone().add(new THREE.Vector3(0, 0.3, 0)), 1 - Math.exp(-delta * 4))
      g.scale.setScalar(damp(g.scale.x, 0.0001, 3, delta))
      return
    }
    const t = clock.elapsedTime * 0.5 + phase
    g.position.set(picnicSpot.x + Math.sin(t) * 1.7, picnicSpot.y + 0.9 + Math.sin(t * 2.6) * 0.25, picnicSpot.z + Math.cos(t * 0.8) * 1.2)
    g.rotation.y = t * 2
    g.rotation.z = Math.sin(t * 3) * 0.4
  })
  return (
    <group ref={ref} {...handlers}>
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={i} position={[Math.cos((i / 5) * Math.PI * 2) * 0.07, 0, Math.sin((i / 5) * Math.PI * 2) * 0.07]} scale={[0.07, 0.025, 0.05]}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshBasicMaterial color={[[2.6, 1.4, 2], [1.6, 2.2, 2.8], [2.8, 2.4, 1.3]][index % 3]} toneMapped={false} />
        </mesh>
      ))}
      <Glow color="#ffd6ea" size={0.7} opacity={0.6} />
      <Hit r={0.5} />
    </group>
  )
}

function CatchGame() {
  const [caught, setCaught] = useState([])
  // the source of truth (state only redraws): several presses can arrive within one frame
  const caughtRef = useRef([])
  const presses = useRef(input.interactPresses)
  useEffect(() => setCount('0 / 3'), [])
  const onCatch = (i) => {
    if (caughtRef.current.includes(i)) return
    const next = [...caughtRef.current, i]
    caughtRef.current = next
    setCaught(next)
    audio.sfx('pickup')
    setCount(`${next.length} / 3`)
    if (next.length === 1) say(companion.picnic[0], 2600)
    if (next.length >= 3) useStore.getState().winPicnic('catch')
  }
  // keyboard: every E press catches the next flower
  useFrame(() => {
    while (presses.current < input.interactPresses) {
      presses.current++
      const next = [0, 1, 2].find((i) => !caughtRef.current.includes(i))
      if (next !== undefined) onCatch(next)
    }
  })
  return [0, 1, 2].map((i) => <FlyingFlower key={i} index={i} caught={caught.includes(i)} onCatch={onCatch} />)
}

/* ───────── B · Save the Picnic ───────── */

function SaveGame() {
  const thief = useRef()
  const zone = useRef()
  const st = useRef({ u: 0, mode: 'sneak', t: 0, won: false })
  const presses = useRef(input.interactPresses)
  const from = PICNIC.thiefFrom
  const to = PICNIC.slots.basket
  const ZONE = [0.6, 0.94]
  const zoneCenter = useMemo(() => from.clone().lerp(to, (ZONE[0] + ZONE[1]) / 2), [from, to]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setCount(''), [])

  const tap = () => {
    const s = st.current
    if (s.won || s.mode !== 'sneak') return
    if (s.u >= ZONE[0] && s.u <= ZONE[1]) {
      s.mode = 'flee'
      s.t = 0
      s.won = true
      audio.sfx('boing')
      say(companion.saved, 3200)
      setTimeout(() => useStore.getState().winPicnic('save'), 900)
    } else {
      s.mode = 'stare'
      s.t = 0
      audio.sfx('squeak', 1)
      toast(picnic.games.save.early, 2600)
    }
  }
  const handlers = useTap(tap)

  useFrame(({ clock }, delta) => {
    const s = st.current
    s.t += delta
    while (presses.current < input.interactPresses) {
      presses.current++
      tap()
    }
    if (s.mode === 'sneak') {
      // sneaky: little stops along the way ("fake-outs")
      const pause = (s.u > 0.3 && s.u < 0.34) || (s.u > 0.52 && s.u < 0.55)
      s.u += delta * (pause ? 0.05 : 0.2)
      if (s.u >= 1) {
        s.mode = 'steal'
        s.t = 0
        say(companion.picnic[1], 2600)
        toast(picnic.games.save.late, 3200)
      }
    } else if (s.mode === 'stare' && s.t > 1.3) {
      s.mode = 'sneak'
    } else if (s.mode === 'steal') {
      // runs off with the sandwich… trips… drops it… comes back for another try
      s.u = Math.max(0, 1 - s.t * 0.6)
      if (s.t > 2.6) {
        s.mode = 'sneak'
        s.u = 0
      }
    } else if (s.mode === 'flee') {
      s.u = Math.max(-0.6, s.u - delta * 1.2)
    }
    const g = thief.current
    const p = from.clone().lerp(to, Math.max(0, s.u))
    if (s.u < 0) p.add(from.clone().sub(to).normalize().multiplyScalar(-s.u * 2))
    const t = clock.elapsedTime
    g.position.set(p.x, standHeight(p.x, p.z) + (s.mode === 'sneak' ? Math.abs(Math.sin(t * 10)) * 0.04 : s.mode === 'flee' ? Math.abs(Math.sin(t * 16)) * 0.15 : 0), p.z)
    const dir = s.mode === 'flee' || s.mode === 'steal' ? from.clone().sub(to) : to.clone().sub(from)
    g.rotation.y = Math.atan2(dir.x, dir.z)
    g.rotation.z = s.mode === 'steal' && s.t > 1 && s.t < 1.6 ? Math.sin(s.t * 20) * 0.6 : 0 // the trip
    g.children[0].visible = s.mode === 'steal' && s.t < 1.2 // the stolen sandwich
    g.visible = s.u > -0.55
    zone.current.material.opacity = damp(zone.current.material.opacity, s.won ? 0 : s.u >= ZONE[0] && s.u <= ZONE[1] && s.mode === 'sneak' ? 0.95 : 0.4, 8, delta)
  })

  return (
    <group>
      <mesh ref={zone} rotation={[-Math.PI / 2, 0, 0]} position={[zoneCenter.x, standHeight(zoneCenter.x, zoneCenter.z) + 0.04, zoneCenter.z]}>
        <ringGeometry args={[0.38, 0.5, 32]} />
        <meshBasicMaterial color={[2.4, 2.0, 1.1]} transparent opacity={0.4} toneMapped={false} depthWrite={false} />
      </mesh>
      {/* the snack thief: a round grey bandit with a mask and big ears */}
      <group ref={thief} {...handlers}>
        <mesh position={[0, 0.42, 0.12]} scale={[0.1, 0.035, 0.08]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#f3d39b" />
        </mesh>
        <mesh position={[0, 0.2, 0]} scale={[0.17, 0.16, 0.2]}>
          <sphereGeometry args={[1, 12, 10]} />
          <meshStandardMaterial color="#a69bbd" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.36, 0.08]} scale={0.11}>
          <sphereGeometry args={[1, 12, 10]} />
          <meshStandardMaterial color="#b9afcf" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.38, 0.17]} scale={[0.09, 0.025, 0.03]}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshBasicMaterial color="#3a3150" />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.07, 0.47, 0.06]} scale={[0.035, 0.06, 0.02]}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color="#8f83aa" />
          </mesh>
        ))}
        <mesh position={[0, 0.22, -0.2]} rotation={[0.8, 0, 0]} scale={[0.05, 0.14, 0.05]}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color="#8f83aa" />
        </mesh>
        <Hit r={0.45} position={[0, 0.3, 0]} />
      </group>
    </group>
  )
}

/* ───────── C · Fix the Picnic ───────── */

function FixItem({ id, placed, selected, onPick }) {
  const ref = useRef()
  const handlers = useTap(() => onPick(id), !placed)
  const Mesh = MESH[id]
  useFrame(({ clock }, delta) => {
    const g = ref.current
    const goal = placed ? PICNIC.slots[id] : PICNIC.scattered[id]
    g.position.x = damp(g.position.x, goal.x, 5, delta)
    g.position.z = damp(g.position.z, goal.z, 5, delta)
    g.position.y = standHeight(g.position.x, g.position.z) + (selected ? 0.15 + Math.abs(Math.sin(clock.elapsedTime * 6)) * 0.08 : 0)
  })
  return (
    <group ref={ref} position={PICNIC.scattered[id]} {...handlers}>
      <Mesh crumpled={!placed} tipped={!placed} />
      {!placed && <Hit r={0.5} position={[0, 0.2, 0]} />}
    </group>
  )
}

function FixSlot({ id, placed, onDrop }) {
  const ring = useRef()
  const handlers = useTap(() => onDrop(id), !placed)
  const p = PICNIC.slots[id]
  useFrame(({ clock }) => {
    ring.current.material.opacity = placed ? 0 : 0.45 + Math.sin(clock.elapsedTime * 3) * 0.2
  })
  const r = id === 'blanket' ? 0.75 : 0.25
  return (
    <group position={[p.x, standHeight(p.x, p.z) + 0.03, p.z]} {...handlers}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[r * 0.8, r, 32]} />
        <meshBasicMaterial color={[2.2, 1.7, 2.3]} transparent opacity={0.5} toneMapped={false} depthWrite={false} />
      </mesh>
      {!placed && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[r, 24]} />
          <meshBasicMaterial colorWrite={false} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}

function FixGame() {
  const [placed, setPlaced] = useState([])
  const [selected, setSelected] = useState(null)
  const placedRef = useRef([])
  const presses = useRef(input.interactPresses)
  useEffect(() => setCount('0 / 3'), [])
  const place = (id) => {
    if (placedRef.current.includes(id)) return
    const next = [...placedRef.current, id]
    placedRef.current = next
    setPlaced(next)
    setSelected(null)
    audio.sfx('plant')
    setCount(`${next.length} / 3`)
    if (next.length >= ITEMS.length) {
      say(companion.picnic[2], 3200)
      setTimeout(() => useStore.getState().winPicnic('fix'), 700)
    }
  }
  const onPick = (id) => {
    audio.sfx('squeak', 3)
    setSelected(id)
  }
  const onDrop = (slot) => {
    if (!selected) return toast(picnic.games.fix.pick, 2400)
    if (selected !== slot) {
      audio.sfx('boing')
      useStore.getState().cueMochi('oops')
      return toast(picnic.games.fix.wrong, 2400)
    }
    place(slot)
  }
  // keyboard: every E press places the next thing
  useFrame(() => {
    while (presses.current < input.interactPresses) {
      presses.current++
      const next = ITEMS.find((i) => !placedRef.current.includes(i))
      if (next) place(next)
    }
  })
  return (
    <group>
      {ITEMS.map((id) => (
        <FixSlot key={`s-${id}`} id={id} placed={placed.includes(id)} onDrop={onDrop} />
      ))}
      {ITEMS.map((id) => (
        <FixItem key={id} id={id} placed={placed.includes(id)} selected={selected === id} onPick={onPick} />
      ))}
    </group>
  )
}

/* ───────── the picnic hill ───────── */

/** The picnic laid out properly. */
function SetPicnic() {
  return ITEMS.map((id) => {
    const Mesh = MESH[id]
    const p = PICNIC.slots[id]
    return (
      <group key={id} position={[p.x, standHeight(p.x, p.z), p.z]}>
        <Mesh />
      </group>
    )
  })
}

/** After the thief: the wind has blown everything about (until "Fix the Picnic"). */
function Scattered() {
  return ITEMS.map((id) => {
    const Mesh = MESH[id]
    const p = PICNIC.scattered[id]
    return (
      <group key={id} position={[p.x, standHeight(p.x, p.z), p.z]}>
        <Mesh crumpled tipped />
      </group>
    )
  })
}

export default function Picnic() {
  const view = useStore((s) => s.view)
  const stage = useStore((s) => s.picnicStage)
  const open = useChapterUnlocked('picnic')
  const done = useStore((s) => s.picnicDone)
  const marker = useRef()
  const fixed = done.includes('fix')
  const scattered = !fixed && done.includes('save')
  const playing = view === 'picnic'
  const allDone = PICNIC_GAMES.every((g) => done.includes(g))

  useInteractable('picnic', {
    position: picnicSpot,
    radius: 1.9,
    label: () => (allDone ? 'Sit at the picnic again' : useStore.getState().picnicDone.length ? 'Continue the picnic' : 'Start the picnic'),
    enabled: () => open && useStore.getState().view === 'explore',
    onInteract: () => {
      audio.sparkle()
      useStore.getState().startPicnic()
    },
  })

  // at the picnic, she sits on the blanket facing the camera
  useEffect(() => {
    if (!playing) return
    const p = PICNIC.seatHer
    player.position.set(p.x, standHeight(p.x, p.z), p.z)
    player.yaw = Math.atan2(isoBack.x, isoBack.z)
    player.walkTarget = null
    player.speed = 0
  }, [playing])

  useFrame(({ clock }) => {
    if (!marker.current) return
    marker.current.material.opacity = 0.45 + Math.sin(clock.elapsedTime * 2.4) * 0.2
  })

  if (!open) return null
  return (
    <group>
      {/* the picnic hill marker while it's waiting for her */}
      {!allDone && !playing && (
        <Tappable id="picnic" position={[picnicSpot.x, picnicSpot.y + 0.03, picnicSpot.z]}>
          <mesh ref={marker} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.9, 1.05, 40]} />
            <meshBasicMaterial color={[2.4, 1.6, 2.0]} transparent opacity={0.5} toneMapped={false} depthWrite={false} />
          </mesh>
          <Glow position={[0, 0.5, 0]} color="#ffd6ea" size={1.4} opacity={0.5} />
        </Tappable>
      )}
      {/* set → (a gust of wind after the thief) scattered → fixed for good */}
      {playing && stage === 'fix' ? null : scattered ? <Scattered /> : <SetPicnic />}
      {playing && stage === 'catch' && <CatchGame />}
      {playing && stage === 'save' && <SaveGame />}
      {playing && stage === 'fix' && <FixGame />}
    </group>
  )
}
