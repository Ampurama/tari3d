import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { memories } from '../../content/config'
import { frameLookAt, framePositions } from '../../lib/layout'
import { photoFallbackTexture } from '../../lib/textures'
import { useStore } from '../../store'
import { Interactive } from './Bits'

const loader = new THREE.TextureLoader()

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
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        tex.anisotropy = 4
        set({ texture: tex, aspect: tex.image.width / tex.image.height || 0.8 })
      },
      undefined,
      () => fallback(src, set),
    )
    return () => {
      alive = false
    }
  }, [src, type])
  return state
}

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
    group.current.lookAt(frameLookAt)
  }, [])

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime + index * 1.3
    const float = reducedMotion ? 0 : 1
    inner.current.position.y = Math.sin(t * 0.8) * 0.12 * float
    inner.current.rotation.z = Math.sin(t * 0.5) * 0.04 * float
    inner.current.rotation.y = Math.sin(t * 0.35) * 0.08 * float
    const s = THREE.MathUtils.damp(inner.current.scale.x, isSelected ? 1.12 : dimmed ? 0.88 : 1, 4, delta)
    inner.current.scale.setScalar(s)
  })

  return (
    <group ref={group} position={position}>
      <Interactive
        label={index === 0 ? 'Our memories' : null}
        onSelect={() => selectMemory(index)}
        sparkleOffset={[w / 2 + 0.05, h / 2 + 0.05, 0.1]}
        sparkleColor="#ffd0e6"
        hideBehind={false}
        active={view === 'explore' || view === 'memories'}
      >
        <group ref={inner}>
          {/* frame */}
          <mesh position={[0, 0, -0.04]} castShadow>
            <boxGeometry args={[w + 0.16, h + 0.16, 0.06]} />
            <meshPhysicalMaterial color="#f7e7c6" metalness={0.65} roughness={0.28} clearcoat={1} emissive="#5a3d22" emissiveIntensity={0.15} />
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
          {/* glass */}
          <mesh position={[0, 0, 0.012]}>
            <planeGeometry args={[w, h]} />
            <meshPhysicalMaterial transparent opacity={0.12} roughness={0.05} metalness={0} clearcoat={1} color="#ffffff" depthWrite={false} />
          </mesh>
          {/* little ribbon heart on top */}
          <mesh position={[0, h / 2 + 0.08, 0.04]} rotation={[0, 0, Math.PI / 4]} scale={0.06}>
            <boxGeometry args={[1, 1, 0.5]} />
            <meshStandardMaterial color="#ff9cc4" emissive="#ff6fa8" emissiveIntensity={0.6} />
          </mesh>
        </group>
      </Interactive>
    </group>
  )
}

export default function MemoryFrames() {
  return (
    <group>
      {memories.slice(0, framePositions.length).map((m, i) => (
        <Frame key={i} memory={m} index={i} />
      ))}
    </group>
  )
}
