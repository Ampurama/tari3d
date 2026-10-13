import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { heartGeometry } from '../../lib/heart'
import { glowTexture } from '../../lib/textures'
import { useStore } from '../../store'

/** Glossy, softly glowing heart. */
export function HeartMesh({ color = '#ff8fbf', emissive = '#ff5fa2', glow = 0.6, ...props }) {
  return (
    <mesh geometry={heartGeometry()} castShadow {...props}>
      <meshPhysicalMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={glow}
        roughness={0.18}
        metalness={0.05}
        clearcoat={1}
        clearcoatRoughness={0.08}
        sheen={0.6}
        sheenColor="#ffd6ea"
      />
    </mesh>
  )
}

/** A soft additive glow sprite. */
const noRaycast = () => null

export function Glow({ color = '#ffc2dd', size = 1, opacity = 0.6, ...props }) {
  return (
    <sprite scale={[size, size, 1]} raycast={noRaycast} {...props}>
      <spriteMaterial
        map={glowTexture()}
        color={color}
        opacity={opacity}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </sprite>
  )
}

const tmp = new THREE.Vector3()
const tmpCam = new THREE.Vector3()

/**
 * Makes children clickable + adds a gentle sparkle and a label so people discover them.
 * Labels hide when the object is around the back of the island.
 */
export function Interactive({ label, onSelect, sparkleOffset = [0, 1.2, 0], children, active = true, hint = true, sparkleColor = '#ffe3a3', hideBehind = true, ...props }) {
  const group = useRef()
  const sparkle = useRef()
  const labelRef = useRef()
  const [hovered, setHovered] = useState(false)
  const view = useStore((s) => s.view)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const showHints = active && hint && view === 'explore'
  useCursor(hovered && active && view !== 'cutscene' && view !== 'epilogue')

  useFrame((state) => {
    if (!group.current) return
    const t = state.clock.elapsedTime
    if (sparkle.current) {
      const pulse = reducedMotion ? 1 : 0.85 + 0.25 * Math.sin(t * 2.4 + sparkleOffset[0])
      const s = (hovered ? 1.35 : 1) * 0.9 * pulse
      sparkle.current.scale.set(s, s, 1)
    }
    if (labelRef.current) {
      let visible = showHints
      if (visible && hideBehind) {
        group.current.getWorldPosition(tmp)
        tmpCam.copy(state.camera.position)
        tmp.y = 0
        tmpCam.y = 0
        visible = tmp.lengthSq() < 4 || tmp.normalize().dot(tmpCam.normalize()) > -0.92
      }
      labelRef.current.style.opacity = visible ? 1 : 0
      labelRef.current.style.pointerEvents = visible ? 'auto' : 'none'
    }
  })

  // inactive objects (and everything during the ending cutscene) let taps pass through to what's behind
  const live = active && view !== 'cutscene' && view !== 'epilogue'
  const select = (e) => {
    if (!live) return
    e.stopPropagation()
    if (e.delta > 8) return
    onSelect?.()
  }

  return (
    <group
      ref={group}
      {...props}
      onClick={select}
      onPointerOver={(e) => {
        if (!live) return
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
    >
      {children}
      {showHints && (
        <group position={sparkleOffset}>
          <sprite ref={sparkle}>
            <spriteMaterial
              map={glowTexture()}
              color={sparkleColor}
              transparent
              opacity={0.95}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </sprite>
          {label && (
            <Html center position={[0, 0.42, 0]} zIndexRange={[20, 0]} className="label-anchor">
              <button
                ref={labelRef}
                type="button"
                className={`world-label${hovered ? ' is-hovered' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect?.()
                }}
              >
                {label}
              </button>
            </Html>
          )}
        </group>
      )}
    </group>
  )
}
