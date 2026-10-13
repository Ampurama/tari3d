import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { futureWorlds } from '../../content/config'
import { areas, futureWorldPositions } from '../../lib/layout'
import { useStore } from '../../store'
import { Glow, HeartMesh } from './Bits'
import { DriftParticles } from './Particles'

/*
 * The dream worlds behind the portal: small conceptual dioramas inside glass bubbles.
 * This module is lazy-loaded and only mounted while she's in the Future Simulator,
 * so none of it costs memory or draw calls anywhere else.
 */

const Mat = ({ c, e, ei = 0, ...p }) => <meshStandardMaterial color={c} emissive={e || c} emissiveIntensity={ei} roughness={0.6} {...p} />

function Ground({ color = '#9fc9b2' }) {
  return (
    <>
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <cylinderGeometry args={[1.45, 1.45, 0.1, 40]} />
        <Mat c={color} />
      </mesh>
      <mesh position={[0, -0.32, 0]}>
        <cylinderGeometry args={[1.42, 0.5, 0.45, 20]} />
        <Mat c="#7d68b3" flatShading />
      </mesh>
    </>
  )
}

function HomeWorld() {
  return (
    <group>
      <Ground />
      {/* house */}
      <mesh position={[0, 0.35, -0.1]} castShadow>
        <boxGeometry args={[0.8, 0.7, 0.7]} />
        <Mat c="#fff3ea" />
      </mesh>
      <mesh position={[0, 0.92, -0.1]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[0.66, 0.5, 4]} />
        <Mat c="#e48fb3" />
      </mesh>
      {[-0.2, 0.2].map((x) => (
        <mesh key={x} position={[x, 0.42, 0.252]}>
          <planeGeometry args={[0.16, 0.16]} />
          <meshBasicMaterial color={[2.4, 1.8, 1.1]} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0, 0.2, 0.252]}>
        <planeGeometry args={[0.16, 0.3]} />
        <Mat c="#8f6e9e" />
      </mesh>
      <mesh position={[0.18, 1.0, -0.25]}>
        <boxGeometry args={[0.1, 0.25, 0.1]} />
        <Mat c="#cdb4d6" />
      </mesh>
      {/* tree + path + little fence */}
      <mesh position={[-0.85, 0.3, 0.2]}>
        <cylinderGeometry args={[0.04, 0.06, 0.6, 8]} />
        <Mat c="#8f6e9e" />
      </mesh>
      <mesh position={[-0.85, 0.72, 0.2]} castShadow>
        <icosahedronGeometry args={[0.32, 1]} />
        <Mat c="#f7a8c8" e="#ff7fb2" ei={0.15} />
      </mesh>
      {[0.5, 0.7, 0.9].map((z) => (
        <mesh key={z} position={[0, 0.005, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.08, 12]} />
          <meshBasicMaterial color={[1.3, 1, 0.75]} toneMapped={false} />
        </mesh>
      ))}
      {[-0.9, -0.7, -0.5, 0.5, 0.7, 0.9].map((x) => (
        <mesh key={x} position={[x, 0.1, 0.95]}>
          <boxGeometry args={[0.04, 0.2, 0.04]} />
          <Mat c="#f3e6ef" />
        </mesh>
      ))}
      <pointLight position={[0, 0.6, 0.6]} color="#ffcf87" intensity={2} distance={3} />
    </group>
  )
}

function TravelWorld() {
  const orbit = useRef()
  const balloon = useRef()
  const reducedMotion = useStore((s) => s.reducedMotion)
  useFrame(({ clock }, delta) => {
    if (reducedMotion) return
    orbit.current.rotation.y += delta * 0.6
    balloon.current.position.y = 1.1 + Math.sin(clock.elapsedTime * 0.8) * 0.1
  })
  return (
    <group>
      <Ground color="#b7d9e8" />
      {/* tiny globe */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <sphereGeometry args={[0.45, 32, 24]} />
        <Mat c="#9fb4ff" e="#7f9bff" ei={0.15} />
      </mesh>
      {[
        [0.2, 0.75, 0.3],
        [-0.25, 0.45, 0.32],
        [0.1, 0.3, -0.38],
      ].map((p, i) => (
        <mesh key={i} position={p} scale={[0.18, 0.1, 0.18]}>
          <sphereGeometry args={[1, 12, 8]} />
          <Mat c="#a8e0c9" />
        </mesh>
      ))}
      {/* a little plane circling the world */}
      <group ref={orbit} position={[0, 0.55, 0]}>
        <group position={[0.78, 0.1, 0]} rotation={[0, 0, -0.15]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <capsuleGeometry args={[0.04, 0.2, 4, 8]} />
            <Mat c="#ffffff" />
          </mesh>
          <mesh>
            <boxGeometry args={[0.32, 0.015, 0.07]} />
            <Mat c="#ff9cc4" />
          </mesh>
        </group>
      </group>
      {/* hot-air balloon */}
      <group ref={balloon} position={[-0.95, 1.1, -0.3]}>
        <mesh>
          <sphereGeometry args={[0.24, 20, 16]} />
          <Mat c="#ffb3d6" e="#ff8fc4" ei={0.25} />
        </mesh>
        <mesh position={[0, -0.32, 0]}>
          <boxGeometry args={[0.1, 0.08, 0.1]} />
          <Mat c="#c9a27e" />
        </mesh>
      </group>
    </group>
  )
}

function SimpleWorld() {
  return (
    <group>
      <Ground />
      {/* picnic blanket */}
      <mesh position={[0, 0.006, 0.1]} rotation={[-Math.PI / 2, 0, 0.2]}>
        <planeGeometry args={[1.3, 1]} />
        <Mat c="#ffc4dc" />
      </mesh>
      {[-0.32, 0, 0.32].map((x) => (
        <mesh key={x} position={[x, 0.008, 0.1]} rotation={[-Math.PI / 2, 0, 0.2]}>
          <planeGeometry args={[0.1, 1]} />
          <Mat c="#ffffff" />
        </mesh>
      ))}
      {/* two cups with a little steam */}
      {[-0.18, 0.18].map((x, i) => (
        <group key={x} position={[x, 0.08, 0.15]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.07, 0.06, 0.14, 16]} />
            <Mat c={i ? '#d9c2ff' : '#fff3ea'} />
          </mesh>
          <Glow position={[0, 0.2, 0]} color="#ffffff" size={0.25} opacity={0.35} />
        </group>
      ))}
      {/* lantern */}
      <mesh position={[0.6, 0.15, -0.3]}>
        <cylinderGeometry args={[0.08, 0.1, 0.25, 12]} />
        <Mat c="#ffd9a0" e="#ffb86b" ei={1.5} />
      </mesh>
      <Glow position={[0.6, 0.18, -0.3]} color="#ffd9a0" size={0.9} opacity={0.6} />
      {/* two cushions, side by side */}
      {[-0.35, 0.35].map((x) => (
        <mesh key={x} position={[x, 0.05, -0.25]} scale={[0.22, 0.07, 0.18]}>
          <sphereGeometry args={[1, 16, 10]} />
          <Mat c="#c9a8ff" />
        </mesh>
      ))}
    </group>
  )
}

function WeddingWorld() {
  const rings = useRef()
  const reducedMotion = useStore((s) => s.reducedMotion)
  useFrame(({ clock }) => {
    if (reducedMotion) return
    rings.current.rotation.y = clock.elapsedTime * 0.8
    rings.current.position.y = 1.15 + Math.sin(clock.elapsedTime) * 0.06
  })
  return (
    <group>
      <Ground />
      {/* aisle */}
      <mesh position={[0, 0.006, 0.35]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.36, 1.3]} />
        <Mat c="#fff6ee" />
      </mesh>
      {/* flower arch */}
      <mesh position={[0, 0.05, -0.35]}>
        <torusGeometry args={[0.6, 0.035, 10, 40, Math.PI]} />
        <Mat c="#f6eaf6" metalness={0.3} />
      </mesh>
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 15) * Math.PI
        return (
          <mesh key={i} position={[Math.cos(a) * 0.6, 0.05 + Math.sin(a) * 0.6, -0.33]} scale={0.06 + (i % 3) * 0.015}>
            <icosahedronGeometry args={[1, 1]} />
            <Mat c={['#ffc4dc', '#ffffff', '#e2cfff'][i % 3]} e={['#ff8fc4', '#ffffff', '#c9a8ff'][i % 3]} ei={0.35} />
          </mesh>
        )
      })}
      {/* chairs either side of the aisle */}
      {[-0.45, 0.45].flatMap((x) =>
        [0.35, 0.7].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.08, z]}>
            <boxGeometry args={[0.18, 0.16, 0.14]} />
            <Mat c="#f3e6ef" />
          </mesh>
        )),
      )}
      {/* two rings */}
      <group ref={rings} position={[0, 1.15, -0.35]}>
        <mesh rotation={[0, 0, 0.4]} position={[-0.06, 0, 0]}>
          <torusGeometry args={[0.12, 0.022, 12, 40]} />
          <meshStandardMaterial color="#f3cf8a" metalness={1} roughness={0.15} emissive="#c99a3e" emissiveIntensity={0.4} />
        </mesh>
        <mesh rotation={[0.5, 0.2, -0.3]} position={[0.07, 0, 0]}>
          <torusGeometry args={[0.12, 0.022, 12, 40]} />
          <meshStandardMaterial color="#f3e6ff" metalness={1} roughness={0.15} emissive="#a985ff" emissiveIntensity={0.3} />
        </mesh>
        <Glow color="#ffe2a8" size={0.9} opacity={0.5} />
      </group>
      <DriftParticles position={[0, 1, 0]} count={24} area={[2.4, 2, 2.4]} size={0.07} speed={0.25} direction={-1} texture="petal" seed={77} intensity={1.2} />
    </group>
  )
}

const DIORAMAS = { home: HomeWorld, travel: TravelWorld, simple: SimpleWorld, wedding: WeddingWorld }

function Bubble({ index, world }) {
  const group = useRef()
  const glass = useRef()
  const futureIndex = useStore((s) => s.futureIndex)
  const visited = useStore((s) => s.futureVisited.includes(index))
  const openFuture = useStore((s) => s.openFuture)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const current = futureIndex === index
  const Diorama = DIORAMAS[world.id] || (() => <HeartMesh scale={0.5} position={[0, 0.6, 0]} />)

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime + index
    group.current.position.y = reducedMotion ? 0 : Math.sin(t * 0.6) * 0.15
    group.current.rotation.y = reducedMotion ? 0 : Math.sin(t * 0.25) * 0.35
    const s = THREE.MathUtils.damp(group.current.scale.x, current ? 1.15 : 0.85, 3, delta)
    group.current.scale.setScalar(s)
    glass.current.material.opacity = THREE.MathUtils.damp(glass.current.material.opacity, current ? 0.1 : 0.2, 3, delta)
  })

  return (
    <group position={futureWorldPositions[index]}>
      <group
        ref={group}
        onClick={(e) => {
          e.stopPropagation()
          if (e.delta > 8) return
          openFuture(index)
        }}
      >
        <Diorama />
        <mesh ref={glass} position={[0, 0.4, 0]}>
          <sphereGeometry args={[1.9, 40, 28]} />
          <meshPhysicalMaterial color="#f3e8ff" transparent opacity={0.15} roughness={0.05} clearcoat={1} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <Glow position={[0, 0.4, -0.5]} color={visited ? '#ffb3d6' : '#c9a8ff'} size={5.5} opacity={current ? 0.35 : 0.18} />
      </group>
    </group>
  )
}

export default function FutureWorlds() {
  return (
    <group position={areas.future}>
      {futureWorlds.worlds.map((w, i) => (
        <Bubble key={w.id} index={i} world={w} />
      ))}
      <ambientLight intensity={0.15} />
      <DriftParticles position={[0, 2, -2]} count={60} area={[26, 10, 8]} shape="box" texture="glow" size={0.14} speed={0.08} seed={93} intensity={1.3} colors={['#ffffff', '#ffd6ea', '#d8c8ff']} />
    </group>
  )
}
