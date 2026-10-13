import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { seeds } from '../../content/config'
import { loveTree, plotSpots, seedSpots, stoneSpots, waterSpot } from '../../lib/layout'
import { useInteractable } from '../../lib/interactions'
import { tier } from '../../lib/device'
import { useChapterUnlocked, useStore } from '../../store'
import { audio } from '../../audio/engine'
import { Glow, HeartMesh } from './Bits'
import { Fireflies } from './Particles'
import Tappable from './Interact'

/*
 * CHAPTER 3 — A FUTURE WE GROW.
 * Five glowing seeds hidden around the island; each has its own plot beside the Love Tree
 * and its own way of being cared for. Growth is visible and permanent.
 */

const damp = THREE.MathUtils.damp
const seedIndex = (id) => seeds.findIndex((s) => s.id === id)
const say = (text, ms) => useStore.getState().showToast(text, ms)

/** A glowing seed waiting somewhere on the island. */
function SeedPickup({ seed, index }) {
  const ref = useRef()
  const unlocked = useChapterUnlocked(2)
  const state = useStore((s) => s.seedState[seed.id])
  const pickSeed = useStore((s) => s.pickSeed)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const position = seedSpots[index]
  const waiting = unlocked && !state
  useInteractable(`seed:${seed.id}`, {
    position,
    radius: 1.6,
    label: `Pick up the seed of ${seed.title}`,
    enabled: () => waiting,
    onInteract: () => pickSeed(seed.id) && audio.sfx('pickup'),
  })
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime + index
    ref.current.position.y = 0.45 + (reducedMotion ? 0 : Math.sin(t * 2) * 0.06)
    ref.current.rotation.y = reducedMotion ? 0 : t
  })
  if (!waiting) return null
  return (
    <Tappable id={`seed:${seed.id}`} position={position}>
      <mesh position={[0, 0.12, 0]} castShadow>
        <dodecahedronGeometry args={[0.22, 0]} />
        <meshStandardMaterial color="#7f9a86" roughness={0.9} flatShading />
      </mesh>
      <group ref={ref} position={[0, 0.45, 0]}>
        <mesh scale={[0.09, 0.12, 0.09]}>
          <sphereGeometry args={[1, 14, 10]} />
          <meshBasicMaterial color={[2.6, 2.2, 1.2]} toneMapped={false} />
        </mesh>
        <Glow color="#ffe2a8" size={1.1} opacity={0.8} />
      </group>
    </Tappable>
  )
}

/* ───────── what each seed grows into ───────── */

function Lily() {
  return (
    <group>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.02, 0.03, 0.5, 6]} />
        <meshStandardMaterial color="#5f9c7d" />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => (
        <group key={i} position={[0, 0.52, 0]} rotation={[0, (i / 6) * Math.PI * 2, 0]}>
          <mesh rotation={[0.9, 0, 0]} position={[0, 0.05, 0.08]} scale={[0.07, 0.17, 0.02]}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshStandardMaterial color="#ffffff" emissive="#fff4e0" emissiveIntensity={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function RoseBush() {
  return (
    <group>
      <mesh position={[0, 0.2, 0]} scale={[0.32, 0.22, 0.3]}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#5f9c7d" roughness={0.8} />
      </mesh>
      {[[0.1, 0.38, 0.1], [-0.15, 0.33, 0.05], [0.02, 0.42, -0.14], [0.2, 0.28, -0.1], [-0.05, 0.3, 0.2]].map((p, i) => (
        <mesh key={i} position={p} scale={0.075}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#ff5c8a" emissive="#ff4f7a" emissiveIntensity={0.6} />
        </mesh>
      ))}
    </group>
  )
}

function TwinStars() {
  return (
    <group>
      {[-0.12, 0.12].map((x, i) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 0.3 + i * 0.1, 0]}>
            <cylinderGeometry args={[0.015, 0.02, 0.6 + i * 0.2, 6]} />
            <meshStandardMaterial color="#5f9c7d" />
          </mesh>
          <mesh position={[0, 0.62 + i * 0.2, 0]} scale={[0.09, 0.11, 0.09]}>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color={[2.8, 2.3, 1.2]} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Sapling() {
  return (
    <group>
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.04, 0.06, 0.7, 7]} />
        <meshStandardMaterial color="#8f6e9e" />
      </mesh>
      {[[0, 0.82, 0, 0.3], [0.16, 0.7, 0.05, 0.2], [-0.14, 0.72, -0.05, 0.2]].map(([x, y, z, s], i) => (
        <mesh key={i} position={[x, y, z]} scale={s}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#8fc79a" emissive="#6fae86" emissiveIntensity={0.3} />
        </mesh>
      ))}
    </group>
  )
}

function CrystalHeart() {
  const ref = useRef()
  const reducedMotion = useStore((s) => s.reducedMotion)
  useFrame(({ clock }) => {
    if (!reducedMotion) ref.current.rotation.y = clock.elapsedTime * 0.6
  })
  return (
    <group>
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.03, 0.05, 0.7, 7]} />
        <meshStandardMaterial color="#a585b8" />
      </mesh>
      <group ref={ref} position={[0, 0.85, 0]}>
        <HeartMesh scale={0.16} color="#d9c2ff" emissive="#a985ff" glow={1.2} />
      </group>
    </group>
  )
}

const GROWN = { honesty: Lily, kindness: RoseBush, adventures: TwinStars, growth: Sapling, future: CrystalHeart }

/** One plot beside the Love Tree, with its own care interaction. */
function Plot({ seed, index }) {
  const sprout = useRef()
  const bloom = useRef()
  const ring = useRef()
  const linking = useRef(null)
  const unlocked = useChapterUnlocked(2)
  const state = useStore((s) => s.seedState[seed.id])
  const carrying = useStore((s) => s.carrying)
  const hasWater = useStore((s) => s.hasWater)
  const stonesLit = useStore((s) => s.stonesLit)
  const futureLinks = useStore((s) => s.futureLinks)
  const position = plotSpots[index]
  const Grown = GROWN[seed.id] || Sapling
  const targetHere = carrying === seed.id

  const label = () => {
    if (targetHere) return seed.id === 'honesty' ? `Hold to plant ${seed.title}` : `Plant ${seed.title}`
    if (state === 'planted') {
      if (seed.id === 'kindness') return hasWater ? 'Give it water' : 'It’s thirsty — bring water from the lake'
      if (seed.id === 'adventures') return 'Light the two guiding stones beside it'
      if (seed.id === 'growth') return 'Hold to stay with it a while'
      if (seed.id === 'future') return 'Connect it to the other four lights'
    }
    if (state === 'grown') return `Look at ${seed.title}`
    return `A place for ${seed.title}`
  }
  const hold = () => (targetHere && seed.id === 'honesty' ? 1.3 : state === 'planted' && seed.id === 'growth' ? 3 : 0)

  useInteractable(`plot:${seed.id}`, {
    position,
    radius: 1.35,
    label,
    hold,
    enabled: () => unlocked,
    onInteract: () => {
      const st = useStore.getState()
      if (st.carrying === seed.id) {
        if (st.plantSeed(seed.id)) {
          audio.sfx('plant')
          // honesty is planted by hand — that *is* its care
          if (seed.id === 'honesty') setTimeout(() => st.growSeed('honesty') && audio.sfx('bloom'), 900)
        }
        return
      }
      if (st.carrying) return say('This plot is waiting for a different seed ✦', 3000)
      const now = st.seedState[seed.id]
      if (!now) return say(`The seed of ${seed.title} is hidden somewhere on the island ✦`, 3600)
      if (now === 'grown') return st.showDiscovery({ kind: 'seed', title: seed.title, text: seed.message }, 5000)
      if (seed.id === 'kindness') return st.hasWater ? st.growSeed('kindness') && audio.sfx('bloom') : say('It needs a little water from Reflection Lake ✦', 3600)
      if (seed.id === 'adventures') return say('Light the two guiding stones beside it ✦', 3200)
      if (seed.id === 'growth') return st.growSeed('growth') && audio.sfx('bloom')
      if (seed.id === 'future') {
        const others = seeds.filter((s) => s.id !== 'future')
        if (!others.every((s) => st.seedState[s.id] === 'grown')) return say('It’s waiting for the other four to grow first ♡', 3600)
        if (linking.current !== null) return
        // the light of each grown plant reaches across, one by one
        linking.current = 0
        others.forEach((s, i) =>
          setTimeout(() => {
            useStore.getState().linkFuture(s.id)
            audio.sfx('light')
            if (i === others.length - 1)
              setTimeout(() => {
                useStore.getState().growSeed('future') && audio.sfx('complete')
                linking.current = null
              }, 900)
          }, 700 * (i + 1)),
        )
      }
    },
  })

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    sprout.current.scale.setScalar(damp(sprout.current.scale.x, state === 'planted' ? 1 : 0.0001, 3, delta))
    bloom.current.scale.setScalar(damp(bloom.current.scale.x, state === 'grown' ? 1 : 0.0001, 1.6, delta))
    const want = targetHere ? 0.9 + 0.3 * Math.sin(t * 4) : state === 'planted' ? 0.55 : state === 'grown' ? 0.4 : unlocked ? 0.25 : 0.06
    ring.current.material.opacity = damp(ring.current.material.opacity, want, 4, delta)
  })

  const others = seeds.filter((s) => s.id !== 'future')
  return (
    <group>
      <Tappable id={`plot:${seed.id}`} position={position}>
        <mesh position={[0, 0.03, 0]} receiveShadow>
          <cylinderGeometry args={[0.42, 0.5, 0.08, 18]} />
          <meshStandardMaterial color="#6e5a4f" roughness={1} />
        </mesh>
        <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
          <ringGeometry args={[0.44, 0.56, 32]} />
          <meshBasicMaterial color={[2.2, 1.7, 1.0]} transparent opacity={0.06} toneMapped={false} depthWrite={false} />
        </mesh>
        <group ref={sprout} scale={0.0001} position={[0, 0.07, 0]}>
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.012, 0.016, 0.2, 5]} />
            <meshStandardMaterial color="#6fae86" />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.05, 0.19, 0]} rotation={[0, 0, s * 0.8]} scale={[0.05, 0.02, 0.03]}>
              <sphereGeometry args={[1, 8, 6]} />
              <meshStandardMaterial color="#8fc79a" emissive="#6fae86" emissiveIntensity={0.4} />
            </mesh>
          ))}
        </group>
        <group ref={bloom} scale={0.0001} position={[0, 0.07, 0]}>
          <Grown />
          <Glow position={[0, 0.6, 0]} color="#ffe2f0" size={1.1} opacity={0.45} />
        </group>
      </Tappable>
      {/* the Future seed gathers light from the other four */}
      {seed.id === 'future' &&
        others.map((s) =>
          futureLinks.includes(s.id) ? (
            <Line key={s.id} points={[plotSpots[seedIndex(s.id)].clone().add(new THREE.Vector3(0, 0.6, 0)), position.clone().add(new THREE.Vector3(0, 0.8, 0))]} color="#ffe2a8" lineWidth={2} transparent opacity={0.8} toneMapped={false} />
          ) : null,
        )}
      {/* the Shared Adventures seed has two guiding stones */}
      {seed.id === 'adventures' && stoneSpots.map((p, n) => <GuidingStone key={n} n={n} position={p} lit={stonesLit.includes(n)} active={state === 'planted'} />)}
    </group>
  )
}

function GuidingStone({ n, position, lit, active }) {
  const glow = useRef()
  useInteractable(`stone:${n}`, {
    position,
    radius: 1.1,
    label: 'Light the guiding stone',
    enabled: () => active && !lit,
    onInteract: () => {
      const st = useStore.getState()
      st.lightStone(n)
      audio.sfx('light')
      if (useStore.getState().stonesLit.length >= 2) setTimeout(() => useStore.getState().growSeed('adventures') && audio.sfx('bloom'), 700)
    },
  })
  useFrame((_, delta) => {
    glow.current.material.opacity = damp(glow.current.material.opacity, lit ? 0.85 : active ? 0.25 : 0.05, 3, delta)
  })
  return (
    <Tappable id={`stone:${n}`} position={position}>
      <mesh position={[0, 0.16, 0]} castShadow>
        <dodecahedronGeometry args={[0.18, 0]} />
        <meshStandardMaterial color={lit ? '#ffe2a8' : '#9d8fb8'} emissive={lit ? '#ffc46b' : '#000000'} emissiveIntensity={lit ? 1.2 : 0} flatShading />
      </mesh>
      <Glow ref={glow} position={[0, 0.3, 0]} color="#ffe2a8" size={0.9} opacity={0.05} />
    </Tappable>
  )
}

/** The lake shore where water can be scooped for Kindness. */
function WaterSource() {
  const glow = useRef()
  const needed = useStore((s) => s.seedState.kindness === 'planted' && !s.hasWater)
  useInteractable('water', {
    position: waterSpot,
    radius: 1.5,
    label: 'Scoop up some lake water',
    enabled: () => needed,
    onInteract: () => {
      useStore.getState().fetchWater()
      audio.sfx('water')
    },
  })
  useFrame((_, delta) => {
    glow.current.material.opacity = damp(glow.current.material.opacity, needed ? 0.6 : 0, 2, delta)
  })
  return (
    <Tappable id="water" position={waterSpot}>
      <Glow ref={glow} position={[0, 0.25, 0]} color="#a8d8ff" size={1.4} opacity={0} />
    </Tappable>
  )
}

export default function SeedGarden() {
  const grown = useStore((s) => seeds.filter((sd) => s.seedState[sd.id] === 'grown').length)
  return (
    <group>
      {seeds.map((sd, i) => (
        <SeedPickup key={sd.id} seed={sd} index={i} />
      ))}
      {seeds.map((sd, i) => (
        <Plot key={sd.id} seed={sd} index={i} />
      ))}
      <WaterSource />
      {/* fireflies arrive as the garden grows */}
      {grown >= 2 && <Fireflies count={tier === 'high' ? 14 + grown * 6 : 8 + grown * 3} area={[7, 2.5, 7]} center={[loveTree.x, loveTree.y + 0.4, loveTree.z]} seed={90 + grown} colors={['#ffe2a8', '#ffd6ea']} />}
    </group>
  )
}
