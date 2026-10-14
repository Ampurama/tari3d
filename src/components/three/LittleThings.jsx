import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { littleThings } from '../../content/config'
import { littleSpots } from '../../lib/layout'
import { BRIDGE } from '../../lib/terrain'
import { photoFallbackTexture } from '../../lib/textures'
import { useInteractable } from '../../lib/interactions'
import { useChapterUnlocked, useStore } from '../../store'
import { audio } from '../../audio/engine'
import { Glow } from './Bits'
import { DriftParticles } from './Particles'
import Tappable from './Interact'

/*
 * CHAPTER 1 — THE LITTLE THINGS.
 * Five objects, each with its own small moment. Found objects stay in the world and glow
 * (brighter still once all five are found).
 */

const damp = THREE.MathUtils.damp

function useLittle(id) {
  const found = useStore((s) => s.littleFound.includes(id))
  const allFound = useChapterUnlocked('miles')
  const findLittle = useStore((s) => s.findLittle)
  const item = littleThings.find((l) => l.id === id)
  const index = littleThings.findIndex((l) => l.id === id)
  return { found, allFound, item, position: littleSpots[index], find: () => findLittle(id) }
}

/** Re-reading something already found shows its message again (but never counts twice). */
const reread = (item) => useStore.getState().showDiscovery({ kind: 'little', title: item.title, text: item.message, photo: item.photo || null }, 6000)

function usePhotoTexture(src) {
  const [tex, setTex] = useState(null)
  useEffect(() => {
    if (!src) return setTex(photoFallbackTexture())
    let alive = true
    new THREE.TextureLoader().load(
      src,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace
        if (alive) setTex(t)
      },
      undefined,
      () => alive && setTex(photoFallbackTexture()),
    )
    return () => {
      alive = false
    }
  }, [src])
  return tex
}

/* 1 · A photograph on an easel, under a silk cloth that lifts away */
function Photograph() {
  const { found, allFound, item, position, find } = useLittle('photo')
  const cloth = useRef()
  const glow = useRef()
  const tex = usePhotoTexture(item?.photo)
  const aspect = tex?.image?.width ? tex.image.width / tex.image.height : 0.75
  const h = 0.62
  const w = Math.min(0.9, h * aspect)
  useInteractable('little:photo', {
    position,
    radius: 1.9,
    label: found ? 'Look at the photograph again' : 'Lift the cloth',
    onInteract: () => (found ? reread(item) : (find(), audio.sfx('reveal'))),
  })
  useFrame((_, delta) => {
    cloth.current.position.y = damp(cloth.current.position.y, found ? 2.6 : 1.12, 1.6, delta)
    cloth.current.rotation.z = damp(cloth.current.rotation.z, found ? 0.9 : 0, 1.6, delta)
    cloth.current.material.opacity = damp(cloth.current.material.opacity, found ? 0 : 1, 1.4, delta)
    glow.current.material.opacity = damp(glow.current.material.opacity, found ? (allFound ? 0.7 : 0.45) : 0.15, 2, delta)
  })
  return (
    <Tappable id="little:photo" position={position} rotation={[0, 0.9, 0]}>
      {/* easel */}
      {[-0.28, 0.28].map((x) => (
        <mesh key={x} position={[x, 0.55, -0.05]} rotation={[0.12, 0, x * -0.25]} castShadow>
          <boxGeometry args={[0.05, 1.15, 0.05]} />
          <meshStandardMaterial color="#c9a27e" roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, 0.5, -0.22]} rotation={[-0.35, 0, 0]}>
        <boxGeometry args={[0.04, 1.05, 0.04]} />
        <meshStandardMaterial color="#c9a27e" />
      </mesh>
      <group position={[0, 1.08, 0.02]} rotation={[-0.12, 0, 0]}>
        <mesh position={[0, 0, -0.025]} castShadow>
          <boxGeometry args={[w + 0.1, h + 0.1, 0.04]} />
          <meshStandardMaterial color="#f7e7c6" metalness={0.5} roughness={0.3} />
        </mesh>
        <mesh>
          <planeGeometry args={[w, h]} />
          {tex ? <meshBasicMaterial key={tex.uuid} map={tex} toneMapped={false} /> : <meshBasicMaterial color="#cdb9ee" />}
        </mesh>
      </group>
      <mesh ref={cloth} position={[0, 1.12, 0.06]}>
        <planeGeometry args={[w + 0.24, h + 0.3, 1, 1]} />
        <meshStandardMaterial color="#e9d6ff" roughness={0.6} transparent side={THREE.DoubleSide} />
      </mesh>
      <Glow ref={glow} position={[0, 1.1, -0.1]} color="#ffd6ea" size={2.2} opacity={0.15} />
    </Tappable>
  )
}

/* 2 · A letter in a bottle, bobbing on the lake; it drifts to the bridge and opens */
function BottleLetter() {
  const { found, allFound, item, position, find } = useLittle('letter')
  const bottle = useRef()
  const cork = useRef()
  const scroll = useRef()
  const glow = useRef()
  const reducedMotion = useStore((s) => s.reducedMotion)
  const ashore = useMemo(() => new THREE.Vector3(position.x, BRIDGE.deck + 0.18, BRIDGE.z - 0.65), [position])
  useInteractable('little:letter', {
    position,
    radius: 2.0,
    label: found ? 'Read the letter again' : 'Reach for the bottle',
    onInteract: () => (found ? reread(item) : (find(), audio.sfx('reveal'))),
  })
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    const b = bottle.current
    const goal = found ? ashore : position
    b.position.x = damp(b.position.x, goal.x, 1.2, delta)
    b.position.z = damp(b.position.z, goal.z, 1.2, delta)
    b.position.y = damp(b.position.y, goal.y + (reducedMotion || found ? 0 : Math.sin(t * 1.6) * 0.04), 2, delta)
    b.rotation.z = found ? damp(b.rotation.z, Math.PI / 2, 2, delta) : reducedMotion ? 1.2 : 1.2 + Math.sin(t * 1.3) * 0.15
    cork.current.position.y = damp(cork.current.position.y, found ? 0.55 : 0.2, 2, delta)
    scroll.current.scale.y = damp(scroll.current.scale.y, found ? 1 : 0.0001, 1.5, delta)
    glow.current.material.opacity = damp(glow.current.material.opacity, found ? (allFound ? 0.6 : 0.35) : 0.3, 2, delta)
  })
  return (
    <Tappable id="little:letter">
      <group ref={bottle} position={position} rotation={[0, 0.4, 1.2]}>
        <mesh>
          <cylinderGeometry args={[0.08, 0.09, 0.3, 14]} />
          <meshPhysicalMaterial color="#cfe8ff" transparent opacity={0.45} roughness={0.05} clearcoat={1} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.035, 0.06, 0.1, 10]} />
          <meshPhysicalMaterial color="#cfe8ff" transparent opacity={0.45} roughness={0.05} depthWrite={false} />
        </mesh>
        <mesh ref={cork} position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.06, 8]} />
          <meshStandardMaterial color="#c9a27e" />
        </mesh>
        <mesh ref={scroll} position={[0, 0, 0]} scale={[1, 0.0001, 1]}>
          <cylinderGeometry args={[0.045, 0.045, 0.24, 10]} />
          <meshStandardMaterial color="#fff6e8" emissive="#fff0d6" emissiveIntensity={0.4} />
        </mesh>
        <Glow ref={glow} color="#cfe8ff" size={0.9} opacity={0.3} />
      </group>
    </Tappable>
  )
}

/* 3 · A sleeping flower in a forest clearing that blooms when touched */
function SleepingFlower() {
  const { found, allFound, item, position, find } = useLittle('flower')
  const petals = useRef([])
  const glow = useRef()
  const ring = useRef([])
  useInteractable('little:flower', {
    position,
    radius: 1.8,
    label: found ? 'Look at the flower again' : 'Touch the flower',
    onInteract: () => (found ? reread(item) : (find(), audio.sfx('bloom'))),
  })
  useFrame((_, delta) => {
    petals.current.forEach((p, i) => {
      if (!p) return
      p.rotation.x = damp(p.rotation.x, found ? 1.15 : 0.12, 1.4, delta)
    })
    glow.current.material.opacity = damp(glow.current.material.opacity, found ? (allFound ? 0.8 : 0.55) : 0.18, 1.5, delta)
    ring.current.forEach((r) => r && (r.material.emissiveIntensity = damp(r.material.emissiveIntensity, found ? 1.3 : 0.05, 1, delta)))
  })
  const N = 6
  return (
    <Tappable id="little:flower" position={position}>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.02, 0.03, 0.6, 6]} />
        <meshStandardMaterial color="#5f9c7d" />
      </mesh>
      <group position={[0, 0.6, 0]}>
        {Array.from({ length: N }, (_, i) => (
          <group key={i} rotation={[0, (i / N) * Math.PI * 2, 0]}>
            <mesh ref={(el) => (petals.current[i] = el)} rotation={[0.12, 0, 0]}>
              <group position={[0, 0.16, 0]}>
                <mesh scale={[0.09, 0.18, 0.025]}>
                  <sphereGeometry args={[1, 12, 8]} />
                  <meshStandardMaterial color="#ffc4dc" emissive="#ff8fc4" emissiveIntensity={0.5} />
                </mesh>
              </group>
            </mesh>
          </group>
        ))}
        <mesh>
          <sphereGeometry args={[0.06, 12, 10]} />
          <meshBasicMaterial color={[2.6, 2.1, 1.2]} toneMapped={false} />
        </mesh>
        <Glow ref={glow} color="#ffb3d6" size={1.8} opacity={0.18} />
      </group>
      {/* a ring of tiny flowers that light up when it blooms */}
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2
        return (
          <mesh key={i} ref={(el) => (ring.current[i] = el)} position={[Math.cos(a) * 0.9, 0.06, Math.sin(a) * 0.9]} scale={0.06}>
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color="#e2d4ff" emissive="#c9a8ff" emissiveIntensity={0.05} />
          </mesh>
        )
      })}
      {found && <DriftParticles position={[0, 1.2, 0]} count={18} area={[2, 1.6, 2]} size={0.06} speed={0.2} texture="petal" seed={409} intensity={1.4} />}
    </Tappable>
  )
}

/* 4 · A music box at the cliff viewpoint: the lid opens and it plays */
function MusicBox() {
  const { found, allFound, item, position, find } = useLittle('musicbox')
  const lid = useRef()
  const dancer = useRef()
  const playing = useRef(0)
  const glow = useRef()
  const reducedMotion = useStore((s) => s.reducedMotion)
  useInteractable('little:musicbox', {
    position,
    radius: 1.8,
    label: found ? 'Play the music box again' : 'Open the music box',
    onInteract: () => {
      audio.musicBox()
      playing.current = 7
      if (!found) find()
      else reread(item)
    },
  })
  useFrame((_, delta) => {
    playing.current = Math.max(0, playing.current - delta)
    const open = found || playing.current > 0
    lid.current.rotation.x = damp(lid.current.rotation.x, open ? -1.9 : 0, 3, delta)
    dancer.current.position.y = damp(dancer.current.position.y, open ? 0.3 : 0.1, 3, delta)
    if (playing.current > 0 && !reducedMotion) dancer.current.rotation.y += delta * 2.5
    glow.current.material.opacity = damp(glow.current.material.opacity, playing.current > 0 ? 0.8 : found ? (allFound ? 0.55 : 0.35) : 0.18, 2, delta)
  })
  return (
    <Tappable id="little:musicbox" position={position} rotation={[0, -0.8, 0]}>
      {/* stone pedestal */}
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.32, 0.4, 0.6, 9]} />
        <meshStandardMaterial color="#9d8fb8" roughness={0.8} flatShading />
      </mesh>
      <group position={[0, 0.6, 0]}>
        <mesh position={[0, 0.09, 0]} castShadow>
          <boxGeometry args={[0.36, 0.18, 0.26]} />
          <meshStandardMaterial color="#f3d9ec" roughness={0.4} metalness={0.2} />
        </mesh>
        <mesh position={[0, 0.183, 0]}>
          <boxGeometry args={[0.37, 0.012, 0.27]} />
          <meshStandardMaterial color="#e9c27a" metalness={0.9} roughness={0.25} />
        </mesh>
        <group ref={lid} position={[0, 0.19, -0.13]}>
          <mesh position={[0, 0.02, 0.13]}>
            <boxGeometry args={[0.36, 0.04, 0.26]} />
            <meshStandardMaterial color="#f3d9ec" roughness={0.4} metalness={0.2} />
          </mesh>
        </group>
        <group ref={dancer} position={[0, 0.1, 0]}>
          <mesh scale={0.06} position={[0, 0.02, 0]}>
            <octahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#ffb3d6" emissive="#ff8fc4" emissiveIntensity={1} />
          </mesh>
        </group>
        <Glow ref={glow} position={[0, 0.3, 0]} color="#ffe2a8" size={1.5} opacity={0.18} />
      </group>
    </Tappable>
  )
}

/* 5 · A fallen star in the meadow: it rises back into the sky and lights everything around it */
function FallenStar() {
  const { found, allFound, item, position, find } = useLittle('star')
  const star = useRef()
  const halo = useRef()
  const reducedMotion = useStore((s) => s.reducedMotion)
  useInteractable('little:star', {
    position,
    radius: 1.8,
    label: found ? 'Look at the star again' : 'Pick up the fallen star',
    onInteract: () => (found ? reread(item) : (find(), audio.sfx('rise'))),
  })
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    star.current.position.y = damp(star.current.position.y, found ? 3.4 : 0.32 + (reducedMotion ? 0 : Math.sin(t * 2) * 0.04), 0.8, delta)
    star.current.rotation.y = reducedMotion ? 0 : t * (found ? 0.6 : 1.4)
    halo.current.scale.setScalar(damp(halo.current.scale.x, found ? (allFound ? 4.5 : 3.6) : 1.1, 1, delta))
  })
  return (
    <Tappable id="little:star" position={position}>
      {/* a little crater of glowing sand */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.18, 0.5, 24]} />
        <meshBasicMaterial color={[1.4, 1.2, 0.9]} transparent opacity={0.5} toneMapped={false} depthWrite={false} />
      </mesh>
      <group ref={star} position={[0, 0.32, 0]}>
        <mesh scale={[0.16, 0.2, 0.16]}>
          <octahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={[3, 2.6, 1.6]} toneMapped={false} />
        </mesh>
        <Glow ref={halo} color="#fff1c9" size={1} opacity={0.85} />
      </group>
    </Tappable>
  )
}

/** Chapter 1 objects. They're always in the world (the chapter is the first one). */
export default function LittleThings() {
  const view = useStore((s) => s.view)
  if (view === 'finale' || view === 'finalRoom') return null
  return (
    <group>
      <Photograph />
      <BottleLetter />
      <SleepingFlower />
      <MusicBox />
      <FallenStar />
    </group>
  )
}
