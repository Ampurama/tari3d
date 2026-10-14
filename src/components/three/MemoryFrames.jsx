import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { memories } from '../../content/config'
import { albumSpot, ARCH_HALF, frameFacing, framePositions, gallery, GALLERY_ENTRANCE, GALLERY_RING, galleryArches } from '../../lib/layout'
import { useInteractable } from '../../lib/interactions'
import { addCollider } from '../../lib/terrain'
import { useSeat } from '../../lib/actions'
import { count } from '../../lib/device'
import { audio } from '../../audio/engine'
import { photoFallbackTexture } from '../../lib/textures'
import { useStore } from '../../store'
import { Glow, HeartMesh, Interactive } from './Bits'
import { Fireflies } from './Particles'

/*
 * OUR MEMORIES — a little garden of our photos.
 *
 * A flower gate opens onto a round mosaic floor with a heart in the middle. At its centre a fountain
 * with a glowing crystal heart floating over the water (its rim is a place to sit together, looking
 * at the photos). Around it, a ring of arches dressed in wisteria and tiny lights; under each arch two
 * polaroids hang on ribbons, swaying a little, each with its title and date written underneath.
 * The ones she has already opened wear a small heart. The album on its stand holds every memory.
 */

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
  set({ texture: photoFallbackTexture(), aspect: 1 })
}

/**
 * Loads a photo — or a muted, looping video — as a texture.
 * Falls back to a soft placeholder if the file is missing, so nothing ever looks broken.
 */
function useMemoryTexture({ src, type }) {
  const [state, setState] = useState({ texture: null, aspect: 1 })
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
        set({ texture: tex, aspect: video.videoWidth / video.videoHeight || 1 })
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
      (image) => set({ texture: shrink(image), aspect: image.width / image.height || 1 }),
      undefined,
      () => fallback(src, set),
    )
    return () => {
      alive = false
    }
  }, [src, type])
  return state
}

/** Crop a texture to fill a square (like a real polaroid print), whatever the photo's shape. */
function coverSquare(texture, aspect) {
  if (!texture) return
  if (aspect >= 1) {
    texture.repeat.set(1 / aspect, 1)
    texture.offset.set((1 - 1 / aspect) / 2, 0)
  } else {
    texture.repeat.set(1, aspect)
    texture.offset.set(0, (1 - aspect) / 2)
  }
  texture.needsUpdate = true
}

/** The handwritten line under a polaroid: its title and date. */
function useCaption(memory) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 120
    const t = new THREE.CanvasTexture(canvas)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  }, [])
  useEffect(() => {
    const draw = () => {
      const g = texture.image.getContext('2d')
      g.fillStyle = '#fffdf8'
      g.fillRect(0, 0, 512, 120)
      g.textAlign = 'center'
      g.fillStyle = '#5d4a57'
      g.font = `44px 'Caveat', 'Segoe Script', cursive`
      g.fillText(memory.title || '', 256, 58, 480)
      g.fillStyle = '#c56d93'
      g.font = `600 22px 'Quicksand', system-ui, sans-serif`
      g.fillText(memory.date || '', 256, 100, 480)
      texture.needsUpdate = true
    }
    draw()
    document.fonts?.ready.then(draw)
  }, [texture, memory.title, memory.date])
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

/* ───────── shared materials ───────── */

const WHITE_STONE = new THREE.MeshStandardMaterial({ color: '#f7f1ea', roughness: 0.6 })
const ARCH_WOOD = new THREE.MeshStandardMaterial({ color: '#fbf6ef', roughness: 0.5 })
const POLAROID = new THREE.MeshStandardMaterial({ color: '#fffdf8', roughness: 0.8 })
const RIBBON = new THREE.MeshStandardMaterial({ color: '#ff9cc4', roughness: 0.6 })
const GOLD = new THREE.MeshStandardMaterial({ color: '#f2dcae', metalness: 0.7, roughness: 0.32, emissive: '#5a3d22', emissiveIntensity: 0.18 })

/* ───────── the photos ───────── */

/** Size of a polaroid: a square photo with a deeper white margin at the bottom for the caption. */
const PHOTO = 0.6
const BORDER = 0.05
const BOTTOM = 0.17

function Polaroid({ memory, index }) {
  const group = useRef()
  const swing = useRef()
  const { texture, aspect } = useMemoryTexture(memory)
  const caption = useCaption(memory)
  const view = useStore((s) => s.view)
  const selected = useStore((s) => s.selectedMemory)
  const seen = useStore((s) => s.viewedMemories.includes(index))
  const selectMemory = useStore((s) => s.selectMemory)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const position = framePositions[index]
  const isSelected = selected === index
  const dimmed = view === 'memories' && selected !== null && !isSelected
  const W = PHOTO + BORDER * 2
  const H = PHOTO + BORDER + BOTTOM

  useEffect(() => coverSquare(texture, aspect), [texture, aspect])
  useEffect(() => group.current.lookAt(frameFacing(position)), []) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime + index * 1.7
    const k = reducedMotion ? 0 : 1
    // hanging from its ribbons: a slow little sway around the top
    swing.current.rotation.z = Math.sin(t * 0.9) * 0.05 * k
    swing.current.rotation.x = Math.sin(t * 0.6 + 1) * 0.03 * k
    const s = THREE.MathUtils.damp(swing.current.scale.x, isSelected ? 1.12 : dimmed ? 0.9 : 1, 4, delta)
    swing.current.scale.setScalar(s)
  })

  return (
    <group ref={group} position={position}>
      {/* the two ribbons it hangs from (up to the arch) */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * (W / 2 - 0.06), H / 2 + 0.36, -0.01]} material={RIBBON}>
          <boxGeometry args={[0.018, 0.72, 0.004]} />
        </mesh>
      ))}
      <group ref={swing} position={[0, H / 2, 0]}>
        <Interactive
          label={null}
          onSelect={() => selectMemory(index)}
          sparkleOffset={[W / 2, -0.05, 0.08]}
          sparkleColor="#ffd0e6"
          hideBehind={false}
          active={view === 'explore' || view === 'memories'}
        >
          <group position={[0, -H / 2, 0]}>
            {/* the print */}
            <mesh position={[0, 0, -0.012]} material={POLAROID} castShadow>
              <boxGeometry args={[W, H, 0.02]} />
            </mesh>
            {/* the photo (square, cropped to fill) */}
            <mesh position={[0, H / 2 - BORDER - PHOTO / 2, 0.001]}>
              <planeGeometry args={[PHOTO, PHOTO]} />
              {texture ? (
                <meshBasicMaterial key={texture.uuid} map={texture} toneMapped={false} color={dimmed ? '#8a84a8' : '#f0f0f0'} />
              ) : (
                <meshBasicMaterial color="#e6d8f5" />
              )}
            </mesh>
            {/* its title and date, handwritten */}
            <mesh position={[0, -H / 2 + BOTTOM / 2, 0.001]}>
              <planeGeometry args={[PHOTO, PHOTO * (120 / 512)]} />
              <meshBasicMaterial map={caption} toneMapped={false} color={dimmed ? '#9a94b8' : '#ffffff'} />
            </mesh>
            {/* a little heart pin once she's looked at it */}
            {seen && <HeartMesh position={[W / 2 - 0.07, H / 2 - 0.07, 0.02]} scale={0.035} color="#ff9cc8" emissive="#ff5fa2" glow={0.9} />}
            {memory.type === 'video' && (
              <mesh position={[-W / 2 + 0.08, H / 2 - 0.08, 0.004]}>
                <circleGeometry args={[0.035, 16]} />
                <meshBasicMaterial color="#ff8fbf" toneMapped={false} />
              </mesh>
            )}
          </group>
        </Interactive>
      </group>
    </group>
  )
}

/* ───────── the arches ───────── */

/** A white arch with wisteria and tiny lights along its curve (tangent to the ring, facing the fountain). */
function Arch({ angle }) {
  const cx = gallery.x + Math.cos(angle) * GALLERY_RING
  const cz = gallery.z + Math.sin(angle) * GALLERY_RING
  const POST = 1.9
  useEffect(() => {
    ;[-1, 1].forEach((s) => addCollider(cx - Math.sin(angle) * s * ARCH_HALF, cz + Math.cos(angle) * s * ARCH_HALF, 0.14))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <group position={[cx, gallery.y, cz]} rotation={[0, -angle, 0]}>
      {/* local x points out from the fountain, local z runs along the ring */}
      {[-1, 1].map((s) => (
        <group key={s} position={[0, 0, s * ARCH_HALF]}>
          <mesh position={[0, POST / 2, 0]} material={ARCH_WOOD} castShadow>
            <boxGeometry args={[0.1, POST, 0.1]} />
          </mesh>
          <mesh position={[0, 0.05, 0]} material={WHITE_STONE}>
            <boxGeometry args={[0.2, 0.1, 0.2]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, POST, 0]} rotation={[0, Math.PI / 2, 0]} material={ARCH_WOOD}>
        <torusGeometry args={[ARCH_HALF, 0.05, 6, 24, Math.PI]} />
      </mesh>
    </group>
  )
}

/** Wisteria (hanging lilac clusters) and fairy lights on every arch: two instanced draws for all of them. */
function ArchDressing() {
  const flowers = useRef()
  const lights = useRef()
  const { blooms, bulbs } = useMemo(() => {
    const blooms = []
    const bulbs = []
    const colors = ['#c9a6ff', '#e3c6ff', '#ffc2e0', '#b48ef0']
    galleryArches.forEach((angle, k) => {
      const cx = gallery.x + Math.cos(angle) * GALLERY_RING
      const cz = gallery.z + Math.sin(angle) * GALLERY_RING
      const tx = -Math.sin(angle)
      const tz = Math.cos(angle)
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * Math.PI
        const along = Math.cos(a) * ARCH_HALF
        const up = 1.9 + Math.sin(a) * ARCH_HALF
        // keep the middle clear above the photos: wisteria hangs mostly near the posts and the top
        if (i % 2 === 0) blooms.push({ x: cx + tx * along, y: gallery.y + up - 0.12, z: cz + tz * along, s: 0.8 + ((i + k) % 3) * 0.15, c: colors[(i + k) % colors.length] })
        bulbs.push({ x: cx + tx * along + Math.cos(angle) * 0.07, y: gallery.y + up + 0.02, z: cz + tz * along + Math.sin(angle) * 0.07, c: i % 2 ? '#ffe2a8' : '#ffd6ea' })
      }
    })
    return { blooms, bulbs }
  }, [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0))
    const c = new THREE.Color()
    blooms.forEach((b, i) => {
      m.compose(new THREE.Vector3(b.x, b.y, b.z), q, new THREE.Vector3(0.09 * b.s, 0.28 * b.s, 0.09 * b.s))
      flowers.current.setMatrixAt(i, m)
      flowers.current.setColorAt(i, c.set(b.c))
    })
    flowers.current.instanceMatrix.needsUpdate = true
    if (flowers.current.instanceColor) flowers.current.instanceColor.needsUpdate = true
    flowers.current.computeBoundingSphere()
    const id = new THREE.Quaternion()
    bulbs.forEach((b, i) => {
      m.compose(new THREE.Vector3(b.x, b.y, b.z), id, new THREE.Vector3(0.03, 0.03, 0.03))
      lights.current.setMatrixAt(i, m)
      lights.current.setColorAt(i, c.set(b.c).multiplyScalar(2.2))
    })
    lights.current.instanceMatrix.needsUpdate = true
    if (lights.current.instanceColor) lights.current.instanceColor.needsUpdate = true
    lights.current.computeBoundingSphere()
  }, [blooms, bulbs])
  return (
    <group>
      <instancedMesh ref={flowers} args={[undefined, undefined, blooms.length]}>
        <coneGeometry args={[1, 1, 6]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={lights} args={[undefined, undefined, bulbs.length]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

/* ───────── the floor, the gate, the fountain, the album ───────── */

/** A round mosaic: soft pastel rings of tiles, and a heart of rose tiles in the middle. */
function useMosaic() {
  return useMemo(() => {
    const S = 1024
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = S
    const g = canvas.getContext('2d')
    const c = S / 2
    g.fillStyle = '#f3ead9'
    g.fillRect(0, 0, S, S)
    const ringColors = ['#f6e0c9', '#f9d6e3', '#efe4f7', '#f6e0c9', '#e6f1e2', '#f9d6e3']
    for (let r = 0; r < 6; r++) {
      const r0 = 120 + r * 64
      const tiles = 18 + r * 8
      for (let i = 0; i < tiles; i++) {
        const a0 = (i / tiles) * Math.PI * 2
        const a1 = ((i + 0.92) / tiles) * Math.PI * 2
        g.beginPath()
        g.arc(c, c, r0 + 58, a0, a1)
        g.arc(c, c, r0 + 4, a1, a0, true)
        g.closePath()
        g.fillStyle = i % 2 ? ringColors[r] : '#fbf5ec'
        g.fill()
      }
    }
    // the heart in the middle
    g.save()
    g.translate(c, c + 18)
    g.scale(4.2, 4.2)
    g.beginPath()
    g.moveTo(0, 14)
    g.bezierCurveTo(-26, -6, -14, -26, 0, -14)
    g.bezierCurveTo(14, -26, 26, -6, 0, 14)
    g.fillStyle = '#f7b6cf'
    g.fill()
    g.lineWidth = 1.2
    g.strokeStyle = '#fff6fa'
    g.stroke()
    g.restore()
    const t = new THREE.CanvasTexture(canvas)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [])
}

function Floor() {
  const mosaic = useMosaic()
  useEffect(() => () => mosaic.dispose(), [mosaic])
  return (
    <mesh position={[gallery.x, gallery.y + 0.012, gallery.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[GALLERY_RING + 0.15, 64]} />
      <meshStandardMaterial map={mosaic} roughness={0.85} />
    </mesh>
  )
}

/** The flower gate at the entrance. */
function Gate() {
  const r = GALLERY_RING + 0.55
  const x = gallery.x + Math.cos(GALLERY_ENTRANCE) * r
  const z = gallery.z + Math.sin(GALLERY_ENTRANCE) * r
  const blooms = useMemo(
    () =>
      Array.from({ length: 15 }, (_, i) => {
        const a = (i / 14) * Math.PI
        return { a, c: ['#ff8fbf', '#ffd6ea', '#ffd27f', '#f7f2ff', '#c9a6ff'][i % 5] }
      }),
    [],
  )
  useEffect(() => {
    ;[-1, 1].forEach((s) => addCollider(x - Math.sin(GALLERY_ENTRANCE) * s * 1.05, z + Math.cos(GALLERY_ENTRANCE) * s * 1.05, 0.16))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <group position={[x, gallery.y, z]} rotation={[0, -GALLERY_ENTRANCE, 0]}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 1.05, s * 1.05]} material={ARCH_WOOD} castShadow>
          <boxGeometry args={[0.12, 2.1, 0.12]} />
        </mesh>
      ))}
      <mesh position={[0, 2.1, 0]} rotation={[0, Math.PI / 2, 0]} material={ARCH_WOOD}>
        <torusGeometry args={[1.05, 0.07, 6, 24, Math.PI]} />
      </mesh>
      {blooms.map((b, i) => (
        <mesh key={i} position={[0.04, 2.1 + Math.sin(b.a) * 1.05, Math.cos(b.a) * 1.05]}>
          <icosahedronGeometry args={[0.1, 0]} />
          <meshStandardMaterial color={b.c} roughness={0.7} />
        </mesh>
      ))}
      <HeartMesh position={[0.06, 3.3, 0]} rotation={[0, Math.PI / 2, 0]} scale={0.2} color="#ff9cc8" emissive="#ff5fa2" glow={1} />
    </group>
  )
}

/** Gentle ripples on the fountain's water. */
const waterMaterial = new THREE.ShaderMaterial({
  transparent: true,
  uniforms: { uTime: { value: 0 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform float uTime; varying vec2 vUv;
    void main() {
      float d = length(vUv - 0.5) * 2.0;
      float ring = 0.5 + 0.5 * sin(d * 22.0 - uTime * 2.2);
      vec3 col = mix(vec3(0.62, 0.86, 0.95), vec3(0.98, 0.86, 0.94), smoothstep(0.0, 1.0, d)) + ring * 0.08;
      gl_FragColor = vec4(col, 0.92);
    }`,
})

/** The heart fountain: a stone basin, water, and a crystal heart floating over it. Its rim is a seat for four. */
function Fountain() {
  const heart = useRef()
  const reducedMotion = useStore((s) => s.reducedMotion)
  useEffect(() => addCollider(gallery.x, gallery.z, 1.05), [])
  useFrame(({ clock }, delta) => {
    waterMaterial.uniforms.uTime.value += delta
    if (!heart.current) return
    const t = clock.elapsedTime
    heart.current.rotation.y = t * 0.6
    heart.current.position.y = gallery.y + 1.55 + (reducedMotion ? 0 : Math.sin(t * 1.3) * 0.08)
  })
  return (
    <group>
      <group position={[gallery.x, gallery.y, gallery.z]}>
        <mesh position={[0, 0.2, 0]} material={WHITE_STONE} castShadow receiveShadow>
          <cylinderGeometry args={[0.95, 1.02, 0.4, 32, 1, true]} />
        </mesh>
        <mesh position={[0, 0.41, 0]} rotation={[Math.PI / 2, 0, 0]} material={WHITE_STONE}>
          <torusGeometry args={[0.95, 0.07, 8, 40]} />
        </mesh>
        <mesh position={[0, 0.33, 0]} rotation={[-Math.PI / 2, 0, 0]} material={waterMaterial}>
          <circleGeometry args={[0.92, 40]} />
        </mesh>
        <mesh position={[0, 0.6, 0]} material={WHITE_STONE}>
          <cylinderGeometry args={[0.1, 0.18, 0.6, 12]} />
        </mesh>
        <mesh position={[0, 0.92, 0]} material={GOLD}>
          <cylinderGeometry args={[0.28, 0.12, 0.1, 16]} />
        </mesh>
      </group>
      <group ref={heart} position={[gallery.x, gallery.y + 1.55, gallery.z]}>
        <HeartMesh scale={0.26} color="#ffb6d5" emissive="#ff6fa8" glow={1.5} />
        <Glow color="#ffc2dd" size={2.4} opacity={0.45} />
      </group>
      <FountainSeats />
      <Fireflies count={count(16, 8)} area={[3.2, 2.2, 3.2]} center={[gallery.x, gallery.y + 1.2, gallery.z]} seed={41} colors={['#ffe2a8', '#ffd6ea']} />
    </group>
  )
}

/** Four places on the fountain's rim, facing out toward the photos. */
function FountainSeat({ index }) {
  const a = GALLERY_ENTRANCE + Math.PI / 4 + (index * Math.PI) / 2
  const x = gallery.x + Math.cos(a) * 0.98
  const z = gallery.z + Math.sin(a) * 0.98
  const yaw = Math.atan2(Math.cos(a), Math.sin(a)) // facing outward
  useSeat(`fountain:${index}`, {
    x,
    z,
    y: gallery.y + 0.44,
    yaw,
    exit: [gallery.x + Math.cos(a) * 1.7, gallery.z + Math.sin(a) * 1.7],
    group: 'fountain',
    label: 'Duduk di tepi air mancur',
  })
  return null
}
function FountainSeats() {
  return [0, 1, 2, 3].map((i) => <FountainSeat key={i} index={i} />)
}

/** The open album on its stand (it holds every memory, however many there are). */
function Album() {
  const book = useRef()
  const goTo = useStore((s) => s.goTo)
  const view = useStore((s) => s.view)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const open = () => {
    audio.sparkle()
    goTo('memories')
  }
  useInteractable('gallery', {
    position: albumSpot,
    radius: 1.5,
    label: memories.length > framePositions.length ? `Open our memory album (${memories.length} memories)` : 'Open our memory album',
    onInteract: open,
  })
  useEffect(() => addCollider(albumSpot.x, albumSpot.z, 0.3), [])
  useFrame(({ clock }) => {
    if (!reducedMotion && book.current) book.current.position.y = 1.0 + Math.sin(clock.elapsedTime * 1.4) * 0.025
  })
  // it faces the gate, so she sees the pages as she walks in
  return (
    <Interactive label="Our memories" onSelect={open} position={albumSpot} rotation={[0, Math.PI / 2 - GALLERY_ENTRANCE, 0]} sparkleOffset={[0, 1.4, 0]} sparkleColor="#ffd0e6" active={view === 'explore'}>
      <mesh position={[0, 0.45, 0]} material={GOLD} castShadow>
        <cylinderGeometry args={[0.06, 0.16, 0.9, 10]} />
      </mesh>
      <mesh position={[0, 0.06, 0]} material={WHITE_STONE}>
        <cylinderGeometry args={[0.24, 0.28, 0.12, 16]} />
      </mesh>
      <group ref={book} position={[0, 1.0, 0]} rotation={[-0.55, 0, 0]}>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.16, 0, 0]} rotation={[0, 0, side * -0.12]}>
            <boxGeometry args={[0.3, 0.02, 0.4]} />
            <meshStandardMaterial color="#fff6ea" emissive="#ffd9b0" emissiveIntensity={0.5} />
          </mesh>
        ))}
        <mesh position={[0, -0.02, 0]}>
          <boxGeometry args={[0.66, 0.025, 0.44]} />
          <meshStandardMaterial color="#c9718f" />
        </mesh>
      </group>
      <Glow position={[0, 1.1, 0]} color="#ffd9b0" size={1.2} opacity={0.55} />
    </Interactive>
  )
}

/** Lantern posts around the outside of the ring, between the arches. */
function Lanterns() {
  const lamps = useMemo(() => {
    const list = []
    for (let i = 0; i < galleryArches.length - 1; i++) {
      const a = (galleryArches[i] + galleryArches[i + 1]) / 2
      list.push([gallery.x + Math.cos(a) * (GALLERY_RING + 0.15), gallery.z + Math.sin(a) * (GALLERY_RING + 0.15)])
    }
    return list
  }, [])
  useEffect(() => lamps.forEach(([x, z]) => addCollider(x, z, 0.12)), [lamps])
  return lamps.map(([x, z], i) => (
    <group key={i} position={[x, gallery.y, z]}>
      <mesh position={[0, 0.6, 0]} material={GOLD}>
        <cylinderGeometry args={[0.03, 0.05, 1.2, 6]} />
      </mesh>
      <mesh position={[0, 1.26, 0]}>
        <sphereGeometry args={[0.1, 12, 10]} />
        <meshBasicMaterial color={[2.4, 1.8, 1.2]} toneMapped={false} />
      </mesh>
      <Glow position={[0, 1.26, 0]} color="#ffd9a0" size={1.1} opacity={0.5} />
    </group>
  ))
}

export default function MemoryFrames() {
  return (
    <group>
      <Floor />
      <Gate />
      <Fountain />
      <Album />
      <Lanterns />
      {galleryArches.map((a, i) => (
        <Arch key={i} angle={a} />
      ))}
      <ArchDressing />
      {memories.slice(0, framePositions.length).map((m, i) => (
        <Polaroid key={i} memory={m} index={i} />
      ))}
    </group>
  )
}
