import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { seeded } from '../../lib/island'
import { count } from '../../lib/device'
import { useStore } from '../../store'
import { DriftParticles } from './Particles'
import { Glow, HeartMesh } from './Bits'

const wood = '#f3e6ef'
const woodDark = '#cdb4d6'
const gold = '#e9c27a'

function bentTrunk() {
  const g = new THREE.CylinderGeometry(0.16, 0.3, 2.6, 14, 12)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) + 1.3
    const k = y / 2.6
    pos.setX(i, pos.getX(i) + 0.32 * k * k)
    pos.setZ(i, pos.getZ(i) - 0.1 * k * k)
  }
  g.translate(0, 1.3, 0)
  g.computeVertexNormals()
  return g
}

/** Blossom tree: a curved trunk, a few branches, and a soft cloud of pink canopy with falling petals. */
export function BlossomTree(props) {
  const canopy = useRef()
  const reducedMotion = useStore((s) => s.reducedMotion)
  const trunk = useMemo(bentTrunk, [])
  const blobs = useMemo(() => {
    const rand = seeded(12)
    const colors = ['#f7a8c8', '#fbc4da', '#f490bb', '#ffd6e7', '#e9b3f0']
    return Array.from({ length: 13 }, (_, i) => {
      const a = rand() * Math.PI * 2
      const r = i === 0 ? 0 : 0.55 + rand() * 0.85
      return {
        position: [0.3 + Math.cos(a) * r, 3.05 + (rand() - 0.3) * 0.75 + (i === 0 ? 0.35 : 0), -0.1 + Math.sin(a) * r],
        scale: i === 0 ? 1.05 : 0.5 + rand() * 0.45,
        color: colors[i % colors.length],
      }
    })
  }, [])
  const sparkles = useMemo(() => {
    const rand = seeded(19)
    return Array.from({ length: count(70, 40) }, () => {
      const a = rand() * Math.PI * 2
      const u = rand() * 2 - 1
      const r = 1.25 + rand() * 0.35
      return [0.3 + Math.cos(a) * Math.sqrt(1 - u * u) * r, 3.15 + u * r * 0.6, -0.1 + Math.sin(a) * Math.sqrt(1 - u * u) * r]
    })
  }, [])

  useFrame(({ clock }) => {
    if (reducedMotion) return
    const t = clock.elapsedTime
    canopy.current.rotation.z = Math.sin(t * 0.5) * 0.015
    canopy.current.rotation.x = Math.cos(t * 0.4) * 0.012
  })

  return (
    <group {...props}>
      <mesh geometry={trunk} castShadow receiveShadow>
        <meshStandardMaterial color="#8f6e9e" roughness={0.85} />
      </mesh>
      {[
        [0.35, 2.1, 0.1, 0.0, 0.0, -0.9, 1.1],
        [0.1, 2.0, -0.1, 0.6, 0.0, 0.8, 1.0],
        [0.45, 2.4, -0.25, -0.7, 0.3, 0.2, 0.8],
      ].map(([x, y, z, rx, ry, rz, len], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[rx, ry, rz]} castShadow>
          <cylinderGeometry args={[0.05, 0.1, len, 8]} />
          <meshStandardMaterial color="#8f6e9e" roughness={0.85} />
        </mesh>
      ))}
      <group ref={canopy}>
        {blobs.map((b, i) => (
          <mesh key={i} position={b.position} scale={b.scale} castShadow>
            <icosahedronGeometry args={[1, 2]} />
            <meshStandardMaterial color={b.color} roughness={0.6} emissive="#ff7fb2" emissiveIntensity={0.14} />
          </mesh>
        ))}
        {sparkles.map((p, i) => (
          <mesh key={i} position={p} scale={0.04 + (i % 3) * 0.012}>
            <sphereGeometry args={[1, 6, 4]} />
            <meshBasicMaterial color={i % 4 ? [2.2, 1.6, 1.9] : [2.4, 2.1, 1.4]} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <pointLight position={[0.3, 2.7, 0.6]} color="#ff9ccc" intensity={6} distance={6} decay={2} />
      <DriftParticles
        position={[0.3, 2.0, 0]}
        count={count(46, 24)}
        area={[3.6, 4, 3.6]}
        colors={['#ffc4dc', '#ffe0ee', '#f7a8c8']}
        size={0.11}
        speed={0.32}
        direction={-1}
        texture="petal"
        intensity={1.1}
        seed={41}
      />
    </group>
  )
}

/** A little bench for two under the tree. */
export function Bench(props) {
  return (
    <group {...props}>
      {[-0.12, 0, 0.12].map((z, i) => (
        <mesh key={i} position={[0, 0.46, z]} castShadow receiveShadow>
          <boxGeometry args={[1.5, 0.05, 0.1]} />
          <meshStandardMaterial color={wood} roughness={0.55} />
        </mesh>
      ))}
      {[0.66, 0.84].map((y, i) => (
        <mesh key={i} position={[0, y, -0.2]} rotation={[-0.15, 0, 0]} castShadow>
          <boxGeometry args={[1.5, 0.1, 0.04]} />
          <meshStandardMaterial color={wood} roughness={0.55} />
        </mesh>
      ))}
      {[-0.66, 0.66].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 0.23, 0.12]} castShadow>
            <boxGeometry args={[0.06, 0.46, 0.06]} />
            <meshStandardMaterial color={woodDark} roughness={0.5} metalness={0.2} />
          </mesh>
          <mesh position={[0, 0.48, -0.2]} castShadow>
            <boxGeometry args={[0.06, 0.96, 0.06]} />
            <meshStandardMaterial color={woodDark} roughness={0.5} metalness={0.2} />
          </mesh>
        </group>
      ))}
      {/* a tiny heart cushion resting on the bench */}
      <HeartMesh position={[0.36, 0.6, 0.02]} rotation={[-0.25, -0.3, 0]} scale={0.11} glow={0.25} />
    </group>
  )
}

/** A brass telescope on a tripod, pointing at the sky. */
export function Telescope(props) {
  return (
    <group {...props}>
      {[0, 2.1, 4.2].map((a) => (
        <mesh key={a} position={[Math.cos(a) * 0.18, 0.42, Math.sin(a) * 0.18]} rotation={[Math.sin(a) * 0.32, 0, -Math.cos(a) * 0.32]} castShadow>
          <cylinderGeometry args={[0.022, 0.03, 0.9, 8]} />
          <meshStandardMaterial color={woodDark} roughness={0.5} />
        </mesh>
      ))}
      <group position={[0, 0.88, 0]} rotation={[0.2, 0.6, 0.85]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.075, 0.11, 0.95, 20]} />
          <meshStandardMaterial color="#f1d9ec" roughness={0.3} metalness={0.4} />
        </mesh>
        {[-0.4, 0, 0.42].map((y) => (
          <mesh key={y} position={[0, y, 0]}>
            <cylinderGeometry args={[y > 0 ? 0.1 : 0.12, y > 0 ? 0.1 : 0.12, 0.05, 20]} />
            <meshStandardMaterial color={gold} roughness={0.25} metalness={0.9} />
          </mesh>
        ))}
        <mesh position={[0, 0.48, 0]}>
          <circleGeometry args={[0.085, 20]} />
          <meshBasicMaterial color={[1.4, 1.2, 2.2]} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

/** The heart-shaped arch at the end of the glowing path. Wakes up once the letter has been read. */
export function SecretArch(props) {
  const heart = useRef()
  const glowRef = useRef()
  const letterRead = useStore((s) => s.letterRead)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const blooms = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => {
        const a = (i / 21) * Math.PI
        return { position: [Math.cos(a) * 1.0, Math.sin(a) * 1.0 + 1.05, 0.02 * (i % 2)], color: ['#ffc4dc', '#ffffff', '#e2cfff'][i % 3], s: 0.07 + (i % 3) * 0.02 }
      }),
    [],
  )

  const curtainMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: new THREE.Color('#ff9fd0') }, uOpacity: { value: 0.12 } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uOpacity;
          varying vec2 vUv;
          void main() {
            vec2 p = vUv - vec2(0.5, 0.45);
            float inside = p.y < 0.0 ? step(abs(p.x), 0.5) : step(length(p), 0.5);
            float fade = smoothstep(0.0, 0.45, vUv.y) * (1.0 - smoothstep(0.3, 0.5, length(p * vec2(1.0, 0.7))));
            gl_FragColor = vec4(uColor * 1.6, inside * fade * uOpacity);
          }
        `,
      }),
    [],
  )

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    const target = letterRead ? 1 : 0.15
    const u = curtainMaterial.uniforms.uOpacity
    u.value = THREE.MathUtils.damp(u.value, letterRead ? 0.5 + 0.15 * Math.sin(t * 1.5) : 0.12, 2, delta)
    heart.current.rotation.y = reducedMotion ? 0 : t * 0.8
    heart.current.position.y = 1.25 + (reducedMotion ? 0 : Math.sin(t * 1.6) * 0.06)
    heart.current.material.emissiveIntensity = THREE.MathUtils.damp(heart.current.material.emissiveIntensity, target * 1.4 + 0.1, 2, delta)
    glowRef.current.material.opacity = THREE.MathUtils.damp(glowRef.current.material.opacity, target * 0.7, 2, delta)
  })

  return (
    <group {...props}>
      <mesh position={[0, 1.05, 0]} castShadow>
        <torusGeometry args={[1.0, 0.06, 12, 48, Math.PI]} />
        <meshStandardMaterial color="#f6eaf6" roughness={0.35} metalness={0.3} />
      </mesh>
      {[-1, 1].map((x) => (
        <mesh key={x} position={[x, 0.52, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.08, 1.06, 12]} />
          <meshStandardMaterial color="#f6eaf6" roughness={0.35} metalness={0.3} />
        </mesh>
      ))}
      {blooms.map((b, i) => (
        <mesh key={i} position={b.position} scale={b.s}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color={b.color} emissive={b.color} emissiveIntensity={letterRead ? 0.6 : 0.1} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 0.98, 0]} material={curtainMaterial}>
        <planeGeometry args={[1.9, 1.9]} />
      </mesh>
      <HeartMesh ref={heart} position={[0, 1.25, 0]} scale={0.22} glow={0.1} />
      <Glow ref={glowRef} position={[0, 1.2, 0.1]} color="#ff9fd0" size={2.6} opacity={0} />
    </group>
  )
}
