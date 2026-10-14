import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { memories } from '../../content/config'
import { FRAME_SCALE, frameFacing, framePositions, gallery, GALLERY_RING } from '../../lib/layout'
import { useInteractable } from '../../lib/interactions'
import { addCollider } from '../../lib/terrain'
import { audio } from '../../audio/engine'
import { photoFallbackTexture } from '../../lib/textures'
import { useStore } from '../../store'
import { Glow, Interactive } from './Bits'

const loader = new THREE.ImageLoader()

/** Photos are shrunk to at most this many pixels on their long side: crisp in the frames, light on memory. */
const MAX_SIDE = 512

/** A downscaled texture from a loaded image (big phone photos would cost tens of MB of GPU memory each). */
function shrink(image) {
  const k = Math.min(1, MAX_SIDE / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * k))
  canvas.height = Math.max(1, Math.round(image.height * k))
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

const fallback = (src, set) => {
  console.warn(`[our-little-universe] Could not load "${src}" — showing a placeholder.`)
  set({ texture: photoFallbackTexture(), aspect: 0.8 })
}

/**
 * Loads a photo — or a muted, looping video — as a texture.
 * Falls back to a soft placeholder if the file is missing, so nothing ever looks broken.
 */
function useMemoryTexture({ src, type }) {
  const [state, setState] = useState({ texture: null, aspect: 0.8 })
  useEffect(() => {
    let alive = true
    const set = (s) => alive && setState(s)

    if (type === 'video') {
      const video = document.createElement('video')
      Object.assign(video, { src, muted: true, loop: true, playsInline: true, preload: 'auto', crossOrigin: 'anonymous' })
      video.setAttribute('playsinline', '')
      const onReady = () => {
        const tex = new THREE.VideoTexture(video)
        tex.colorSpace = THREE.SRGBColorSpace
        set({ texture: tex, aspect: video.videoWidth / video.videoHeight || 0.8 })
        video.play().catch(() => {}) // muted autoplay is allowed; if not, the first frame still shows
      }
      const onError = () => fallback(src, set)
      video.addEventListener('loadeddata', onReady, { once: true })
      video.addEventListener('error', onError, { once: true })
      return () => {
        alive = false
        video.removeEventListener('loadeddata', onReady)
        video.removeEventListener('error', onError)
        video.pause()
        video.removeAttribute('src')
        video.load()
      }
    }

    loader.load(
      src,
      (image) => set({ texture: shrink(image), aspect: image.width / image.height || 0.8 }),
      undefined,
      () => fallback(src, set),
    )
    return () => {
      alive = false
    }
  }, [src, type])
  return state
}

/** Shared by every frame and post (one material instead of a heavy glass/clearcoat pair per photo). */
const FRAME_MAT = new THREE.MeshStandardMaterial({ color: '#f2dcae', metalness: 0.7, roughness: 0.32, emissive: '#5a3d22', emissiveIntensity: 0.18 })
/** Height of the post under each frame (local to the frame's scale). */
const POST = 1.7

function Frame({ memory, index }) {
  const group = useRef()
  const inner = useRef()
  const { texture, aspect: rawAspect } = useMemoryTexture(memory)
  const view = useStore((s) => s.view)
  const selected = useStore((s) => s.selectedMemory)
  const selectMemory = useStore((s) => s.selectMemory)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const position = framePositions[index]
  const isSelected = selected === index
  const dimmed = view === 'memories' && selected !== null && !isSelected

  const aspect = THREE.MathUtils.clamp(rawAspect, 0.5, 1.8)
  const h = Math.min(1.35, 1.75 / aspect) // keep wide photos from getting huge
  const w = h * aspect

  useEffect(() => {
    group.current.lookAt(frameFacing(position))
    // the frame's post is solid
    addCollider(position.x, position.z, 0.22)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime + index * 1.3
    const float = reducedMotion ? 0 : 1
    // standing frames only breathe a little
    inner.current.position.y = Math.sin(t * 0.8) * 0.03 * float
    inner.current.rotation.y = Math.sin(t * 0.35) * 0.04 * float
    const s = THREE.MathUtils.damp(inner.current.scale.x, isSelected ? 1.12 : dimmed ? 0.88 : 1, 4, delta)
    inner.current.scale.setScalar(s)
  })

  return (
    <group ref={group} position={position} scale={FRAME_SCALE}>
      <Interactive
        label={null}
        onSelect={() => selectMemory(index)}
        sparkleOffset={[w / 2 + 0.05, h / 2 + 0.05, 0.1]}
        sparkleColor="#ffd0e6"
        hideBehind={false}
        active={view === 'explore' || view === 'memories'}
      >
        <group ref={inner}>
          {/* frame */}
          <mesh position={[0, 0, -0.04]} castShadow material={FRAME_MAT}>
            <boxGeometry args={[w + 0.16, h + 0.16, 0.06]} />
          </mesh>
          <mesh position={[0, 0, -0.005]}>
            <planeGeometry args={[w + 0.04, h + 0.04]} />
            <meshBasicMaterial color="#fffaf2" />
          </mesh>
          {/* photo */}
          <mesh position={[0, 0, 0]}>
            <planeGeometry args={[w, h]} />
            {texture ? (
              <meshBasicMaterial key={texture.uuid} map={texture} toneMapped={false} color={dimmed ? '#8a84a8' : '#eeeeee'} />
            ) : (
              <meshBasicMaterial color="#cdb9ee" />
            )}
          </mesh>
          {/* little ribbon heart on top */}
          <mesh position={[0, h / 2 + 0.08, 0.04]} rotation={[0, 0, Math.PI / 4]} scale={0.06}>
            <boxGeometry args={[1, 1, 0.5]} />
            <meshStandardMaterial color="#ff9cc4" emissive="#ff6fa8" emissiveIntensity={0.6} />
          </mesh>
        </group>
        {/* the slim golden post it stands on */}
        <mesh position={[0, -(h / 2 + 0.1 + POST / 2), -0.04]} material={FRAME_MAT}>
          <cylinderGeometry args={[0.035, 0.055, POST, 8]} />
        </mesh>
      </Interactive>
    </group>
  )
}

/**
 * The plaza around the photos: a glowing ring on the paving, little lanterns around it,
 * and an open album on a pedestal in the middle — it holds every memory, however many there are.
 */
function GalleryPlaza() {
  const lamps = useRef()
  const book = useRef()
  const goTo = useStore((s) => s.goTo)
  const view = useStore((s) => s.view)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const open = () => {
    audio.sparkle()
    goTo('memories')
  }
  useInteractable('gallery', {
    position: gallery,
    radius: 1.6,
    label: memories.length > framePositions.length ? `Open our memory album (${memories.length} memories)` : 'Open our memory album',
    onInteract: open,
  })
  useEffect(() => addCollider(gallery.x, gallery.z, 0.42), [])
  const lampSpots = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2 + 0.31
        return [gallery.x + Math.cos(a) * (GALLERY_RING + 0.55), gallery.z + Math.sin(a) * (GALLERY_RING + 0.55)]
      }),
    [],
  )
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    lampSpots.forEach(([x, z], i) => {
      m.makeTranslation(x, gallery.y + 0.08, z)
      lamps.current.setMatrixAt(i, m)
    })
    lamps.current.instanceMatrix.needsUpdate = true
  }, [lampSpots])
  const ring = useMemo(() => new THREE.RingGeometry(GALLERY_RING + 0.32, GALLERY_RING + 0.38, 72), [])
  useEffect(() => () => ring.dispose(), [ring])
  useFrame(({ clock }) => {
    if (!reducedMotion) book.current.position.y = 1.02 + Math.sin(clock.elapsedTime * 1.4) * 0.03
  })
  return (
    <group>
      <mesh geometry={ring} rotation={[-Math.PI / 2, 0, 0]} position={[gallery.x, gallery.y + 0.03, gallery.z]}>
        <meshBasicMaterial color={[1.9, 1.35, 1.0]} toneMapped={false} transparent opacity={0.7} depthWrite={false} />
      </mesh>
      <instancedMesh ref={lamps} args={[null, null, lampSpots.length]}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshBasicMaterial color={[2.6, 1.8, 1.1]} toneMapped={false} />
      </instancedMesh>
      <Interactive label="Our memories" onSelect={open} position={gallery} sparkleOffset={[0, 1.5, 0]} sparkleColor="#ffd0e6" active={view === 'explore'}>
        {/* pedestal */}
        <mesh position={[0, 0.42, 0]} material={FRAME_MAT} castShadow>
          <cylinderGeometry args={[0.2, 0.3, 0.84, 12]} />
        </mesh>
        {/* the open album */}
        <group ref={book} position={[0, 1.02, 0]} rotation={[-0.5, 0, 0]}>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.17, 0, 0]} rotation={[0, 0, side * -0.12]}>
              <boxGeometry args={[0.32, 0.02, 0.42]} />
              <meshStandardMaterial color="#fff6ea" emissive="#ffd9b0" emissiveIntensity={0.5} />
            </mesh>
          ))}
          <mesh position={[0, -0.02, 0]}>
            <boxGeometry args={[0.7, 0.025, 0.46]} />
            <meshStandardMaterial color="#c9718f" />
          </mesh>
        </group>
        <Glow position={[0, 1.15, 0]} color="#ffd9b0" size={1.4} opacity={0.6} />
      </Interactive>
    </group>
  )
}

export default function MemoryFrames() {
  return (
    <group>
      <GalleryPlaza />
      {memories.slice(0, framePositions.length).map((m, i) => (
        <Frame key={i} memory={m} index={i} />
      ))}
    </group>
  )
}
