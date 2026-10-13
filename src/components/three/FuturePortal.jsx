import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { futureWorlds } from '../../content/config'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'
import { Glow, Interactive } from './Bits'

const swirlVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const swirlFragment = /* glsl */ `
  uniform float uTime;
  uniform float uAwake;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;
    float a = atan(p.y, p.x);
    float swirl = sin(a * 3.0 + r * 9.0 - uTime * 2.2) * 0.5 + 0.5;
    float swirl2 = sin(a * 5.0 - r * 6.0 + uTime * 1.4) * 0.5 + 0.5;
    vec3 pink = vec3(1.0, 0.45, 0.75);
    vec3 violet = vec3(0.55, 0.42, 1.0);
    vec3 gold = vec3(1.0, 0.85, 0.55);
    vec3 col = mix(violet, pink, swirl);
    col = mix(col, gold, pow(swirl2, 4.0) * 0.6);
    col += vec3(1.0, 0.9, 1.0) * pow(1.0 - r, 3.0) * 1.2;
    float edge = smoothstep(1.0, 0.85, r);
    float alpha = edge * (0.25 + 0.65 * uAwake);
    gl_FragColor = vec4(col * (0.4 + 1.6 * uAwake), alpha);
  }
`

/** FUTURE SIMULATOR — a swirling portal at the edge of the island. Wakes up in Chapter Five. */
export default function FuturePortal(props) {
  const ring = useRef()
  const unlocked = true // an optional discovery now — always open
  const openFuture = useStore((s) => s.openFuture)
  const showToast = useStore((s) => s.showToast)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uAwake: { value: 0 } },
        vertexShader: swirlVertex,
        fragmentShader: swirlFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )

  useFrame((_, delta) => {
    material.uniforms.uTime.value += delta * (reducedMotion ? 0.15 : unlocked ? 1 : 0.2)
    material.uniforms.uAwake.value = THREE.MathUtils.damp(material.uniforms.uAwake.value, unlocked ? 1 : 0, 1.5, delta)
    if (!reducedMotion) ring.current.rotation.z += delta * (unlocked ? 0.3 : 0.04)
  })

  return (
    <Interactive
      label={unlocked ? futureWorlds.title : `${futureWorlds.title} · sleeping`}
      onSelect={() => {
        if (!unlocked) {
          showToast('The portal is still closed. It opens in Chapter Five ♡')
          return
        }
        audio.sparkle()
        openFuture(0)
      }}
      sparkleOffset={[0, 2.35, 0]}
      sparkleColor={unlocked ? '#c9a8ff' : '#8f86b8'}
      {...props}
    >
      <group position={[0, 1.15, 0]}>
        <mesh ref={ring} castShadow>
          <torusGeometry args={[0.95, 0.07, 14, 80]} />
          <meshStandardMaterial color="#f3e6ff" metalness={0.6} roughness={0.25} emissive="#a985ff" emissiveIntensity={unlocked ? 0.8 : 0.1} />
        </mesh>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const a = (i / 8) * Math.PI * 2
          return (
            <mesh key={i} position={[Math.cos(a) * 0.95, Math.sin(a) * 0.95, 0]} scale={0.07}>
              <icosahedronGeometry args={[1, 0]} />
              <meshStandardMaterial color={i % 2 ? '#ffc4dc' : '#ffe2a8'} emissive={i % 2 ? '#ff8fc4' : '#ffc46b'} emissiveIntensity={unlocked ? 1.2 : 0.1} />
            </mesh>
          )
        })}
        <mesh material={material}>
          <circleGeometry args={[0.9, 48]} />
        </mesh>
        <Glow color="#c9a8ff" size={3.2} opacity={unlocked ? 0.45 : 0.1} />
      </group>
      {/* little stone base */}
      <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.55, 0.65, 0.16, 20]} />
        <meshStandardMaterial color="#8f7bc8" roughness={0.7} flatShading />
      </mesh>
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[1.0, 1.0, 2.2, 10]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>
    </Interactive>
  )
}
