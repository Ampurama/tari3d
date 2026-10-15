import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { avatarStage } from '../../lib/layout'
import { cloudTexture } from '../../lib/textures'
import { currentAvatar, useStore } from '../../store'
import { Glow } from './Bits'
import { DriftParticles } from './Particles'
import Avatar from './Avatar'

/** Shared with the selection overlay: drag-to-turn angle for the preview. */
export const previewSpin = { y: 0, velocity: 0 }

/**
 * The character selection stage: a round platform floating among clouds under the intro heart,
 * soft pink / lavender / gold lights, and the chosen little soul turning slowly in the middle.
 */
export default function AvatarStage() {
  const view = useStore((s) => s.view)
  const avatar = useStore(currentAvatar)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const turn = useRef()
  const swap = useRef()
  const burst = useRef()
  const lastId = useRef(avatar.id)
  const flash = useRef(0)

  useFrame((_, delta) => {
    if (!swap.current) return
    // a soft "pop" whenever the character changes
    if (lastId.current !== avatar.id) {
      lastId.current = avatar.id
      flash.current = 1
      swap.current.scale.setScalar(0.6)
    }
    flash.current = Math.max(0, flash.current - delta * 1.4)
    swap.current.scale.setScalar(THREE.MathUtils.damp(swap.current.scale.x, 1, 6, delta))
    burst.current.material.opacity = flash.current * 0.9
    burst.current.scale.setScalar(0.8 + (1 - flash.current) * 3)
    // drag spin with a little momentum, plus a slow idle turn
    previewSpin.velocity = THREE.MathUtils.damp(previewSpin.velocity, 0, 3, delta)
    previewSpin.y += previewSpin.velocity * delta + (reducedMotion ? 0 : delta * 0.25)
    turn.current.rotation.y = previewSpin.y
  })

  if (view !== 'avatar') return null
  return (
    <group position={avatarStage}>
      {/* platform */}
      <mesh position={[0, -0.15, 0]} receiveShadow>
        <cylinderGeometry args={[1.4, 1.2, 0.3, 48]} />
        {/* pearly, warm and softly lit from within (metal made it look like grey plastic) */}
        <meshStandardMaterial color="#f6e4f4" roughness={0.42} metalness={0} emissive="#ffc6e0" emissiveIntensity={0.12} />
      </mesh>
      <mesh position={[0, -0.6, 0]}>
        <cylinderGeometry args={[1.15, 0.2, 0.7, 24]} />
        <meshStandardMaterial color="#8f7bc8" roughness={0.7} flatShading />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[1.25, 1.36, 64]} />
        <meshBasicMaterial color={[2.4, 1.7, 1.1]} toneMapped={false} />
      </mesh>
      <group ref={swap}>
        <group ref={turn}>
          <Avatar config={avatar} getMotion={() => ({ speed: 0, cheer: flash.current })} />
        </group>
      </group>
      <Glow ref={burst} position={[0, 0.8, 0]} color="#ffe2f0" size={1.6} opacity={0} />
      <Glow position={[0, 0.6, -0.6]} color="#c9a8ff" size={4} opacity={0.35} />
      {/* clouds around the stage */}
      {Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2
        const r = 2.4 + (i % 3) * 0.7
        return (
          <sprite key={i} position={[Math.cos(a) * r, -0.9 - (i % 2) * 0.4, Math.sin(a) * r - 0.4]} scale={[3.4, 1.6, 1]}>
            <spriteMaterial map={cloudTexture((i % 4) + 1)} color={['#f6d6ff', '#ffd3e6', '#e2d8ff'][i % 3]} opacity={0.5} transparent depthWrite={false} />
          </sprite>
        )
      })}
      <pointLight position={[1.6, 1.8, 1.8]} color="#ffb6d5" intensity={10} distance={8} />
      <pointLight position={[-1.8, 1.4, 1.2]} color="#c9a8ff" intensity={8} distance={8} />
      <pointLight position={[0, 2.6, -1.4]} color="#ffe2a8" intensity={6} distance={8} />
      <DriftParticles position={[0, 1.2, 0]} count={36} area={[6, 3, 4]} size={0.09} speed={0.2} seed={33} intensity={1.3} />
    </group>
  )
}
