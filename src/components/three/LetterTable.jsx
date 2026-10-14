import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../../store'
import { Glow, HeartMesh } from './Bits'
import { DriftParticles } from './Particles'

const PINK = '#f6b9d3'
const PINK_DARK = '#ee9fc2'

function flapGeometry() {
  const shape = new THREE.Shape()
  shape.moveTo(-0.4, 0)
  shape.lineTo(0.4, 0)
  shape.quadraticCurveTo(0.06, -0.3, 0, -0.33)
  shape.quadraticCurveTo(-0.06, -0.3, -0.4, 0)
  return new THREE.ShapeGeometry(shape, 16)
}

/**
 * Small round table with a pastel envelope. When the letter view opens:
 * flap swings open → the letter rises out → hearts drift around it.
 */
export default function LetterTable(props) {
  const flap = useRef()
  const paper = useRef()
  const view = useStore((s) => s.view)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const open = view === 'letter'
  const openedAt = useRef(null)
  const flapGeo = useMemo(flapGeometry, [])

  useFrame(({ clock }, delta) => {
    const now = clock.elapsedTime
    if (open && openedAt.current === null) openedAt.current = now
    if (!open) openedAt.current = null
    const since = openedAt.current === null ? -1 : now - openedAt.current
    const speed = reducedMotion ? 12 : 3.2

    // 1. flap opens (after the camera has started moving)
    const flapTarget = open && since > (reducedMotion ? 0 : 0.55) ? -Math.PI - 0.55 : -Math.PI / 2
    flap.current.rotation.x = THREE.MathUtils.damp(flap.current.rotation.x, flapTarget, speed, delta)

    // 2. the letter slides up and turns toward the camera
    const rise = open && since > (reducedMotion ? 0 : 1.1)
    paper.current.position.y = THREE.MathUtils.damp(paper.current.position.y, rise ? 0.5 : 0.012, speed * 0.7, delta)
    paper.current.rotation.x = THREE.MathUtils.damp(paper.current.rotation.x, rise ? -0.35 : -Math.PI / 2, speed * 0.7, delta)
    paper.current.visible = paper.current.position.y > 0.02 || open
  })

  return (
    <group {...props}>
      {/* table */}
      <mesh position={[0, 0.62, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.58, 0.58, 0.05, 40]} />
        <meshPhysicalMaterial color="#fbf4f8" roughness={0.25} clearcoat={0.8} />
      </mesh>
      <mesh position={[0, 0.645, 0]}>
        <torusGeometry args={[0.58, 0.012, 8, 48]} />
        <meshStandardMaterial color="#e9c27a" metalness={0.9} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.31, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, 0.6, 12]} />
        <meshStandardMaterial color="#d9c3e3" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <cylinderGeometry args={[0.26, 0.3, 0.04, 24]} />
        <meshStandardMaterial color="#d9c3e3" roughness={0.4} metalness={0.3} />
      </mesh>

      {/* candle */}
      <group position={[-0.34, 0.65, -0.22]}>
        <mesh position={[0, 0.09, 0]} castShadow>
          <cylinderGeometry args={[0.045, 0.05, 0.18, 16]} />
          <meshStandardMaterial color="#fff6ee" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.215, 0]} scale={[0.022, 0.045, 0.022]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshBasicMaterial color={[3, 2.1, 1.1]} toneMapped={false} />
        </mesh>
        <Glow position={[0, 0.22, 0]} color="#ffcf87" size={0.5} opacity={0.8} />
      </group>

      {/* envelope */}
      <group position={[0.06, 0.66, 0.06]} rotation={[0, -0.25, 0]}>
        <mesh position={[0, 0.012, 0]} castShadow>
          <boxGeometry args={[0.8, 0.024, 0.55]} />
          <meshPhysicalMaterial color={PINK} roughness={0.5} sheen={1} sheenColor="#ffe3ef" />
        </mesh>
        {/* front pocket folds */}
        <mesh position={[0, 0.0255, 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
          <shapeGeometry
            args={[
              (() => {
                const s = new THREE.Shape()
                s.moveTo(-0.4, -0.255)
                s.lineTo(0.4, -0.255)
                s.lineTo(0.4, 0.2)
                s.lineTo(0, -0.02)
                s.lineTo(-0.4, 0.2)
                s.closePath()
                return s
              })(),
            ]}
          />
          <meshStandardMaterial color={PINK_DARK} roughness={0.6} />
        </mesh>
        {/* letter paper */}
        <group ref={paper} position={[0, 0.012, 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh position={[0, 0.23, 0]}>
            <planeGeometry args={[0.7, 0.46]} />
            <meshStandardMaterial color="#fffaf3" roughness={0.8} side={THREE.DoubleSide} emissive="#fff3e6" emissiveIntensity={0.25} />
          </mesh>
          {[0.32, 0.26, 0.2, 0.14, 0.08].map((y, i) => (
            <mesh key={y} position={[i === 0 ? -0.12 : 0, y, 0.002]}>
              <planeGeometry args={[i === 0 ? 0.3 : 0.54, 0.012]} />
              <meshBasicMaterial color="#e3b7cf" />
            </mesh>
          ))}
        </group>
        {/* flap — hinged on the back edge */}
        <group ref={flap} position={[0, 0.026, -0.275]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh geometry={flapGeo} castShadow>
            <meshPhysicalMaterial color={PINK} roughness={0.5} side={THREE.DoubleSide} sheen={1} sheenColor="#ffe3ef" />
          </mesh>
          <HeartMesh position={[0, -0.25, 0.012]} scale={0.045} rotation={[0, 0, 0]} color="#e2557f" emissive="#c2185b" glow={0.35} />
        </group>
      </group>

      {open && (
        <DriftParticles position={[0, 1.2, 0]} count={36} area={[1.8, 1.6, 1.4]} size={0.07} speed={0.22} intensity={2} seed={88} />
      )}
    </group>
  )
}
