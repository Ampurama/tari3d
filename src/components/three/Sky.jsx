import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../../store'
import { cloudTexture, glowTexture, moonTexture } from '../../lib/textures'
import { moonPosition } from '../../lib/layout'
import { seeded } from '../../lib/island'
import { count } from '../../lib/device'
import { StarDome } from './Particles'

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const skyFragment = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uBottom;
  uniform vec3 uPink;
  uniform vec3 uViolet;
  uniform float uDim;
  uniform float uTime;
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = mix(uHorizon, uTop, smoothstep(0.0, 0.65, h));
    col = mix(col, uBottom, smoothstep(0.0, -0.6, h));
    // two soft nebula clouds
    float n1 = pow(max(dot(d, normalize(vec3(-0.5, 0.35, -0.8))), 0.0), 6.0);
    float n2 = pow(max(dot(d, normalize(vec3(0.75, 0.1, -0.4))), 0.0), 9.0);
    float n3 = pow(max(dot(d, normalize(vec3(0.2, -0.3, 0.9))), 0.0), 7.0);
    col += uPink * n1 * 0.55 + uViolet * n2 * 0.6 + uViolet * n3 * 0.35;
    // a soft, slowly moving aurora ribbon low over the northern horizon (pure math: almost free)
    float az = atan(d.x, -d.z);
    float ribbon = d.y - 0.16 - 0.07 * sin(az * 2.0 + uTime * 0.05) - 0.03 * sin(az * 5.0 - uTime * 0.08);
    float band = exp(-ribbon * ribbon * 140.0) * smoothstep(-0.05, 0.6, -d.z);
    float curtain = 0.55 + 0.45 * sin(az * 14.0 + uTime * 0.12 + sin(az * 3.0) * 2.0);
    col += mix(vec3(0.25, 0.75, 0.65), vec3(0.75, 0.45, 1.0), 0.5 + 0.5 * sin(az * 1.5 + uTime * 0.03)) * band * curtain * 0.32;
    gl_FragColor = vec4(col * uDim, 1.0);
  }
`

function SkyGradient() {
  const ref = useRef()
  const view = useStore((s) => s.view)
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTop: { value: new THREE.Color('#05051a') },
          uHorizon: { value: new THREE.Color('#251b55') },
          uBottom: { value: new THREE.Color('#0a0822') },
          uPink: { value: new THREE.Color('#ff8ec1') },
          uViolet: { value: new THREE.Color('#8b6cff') },
          uDim: { value: 1 },
          uTime: { value: 0 },
        },
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    [],
  )
  useFrame((state, delta) => {
    ref.current.position.copy(state.camera.position)
    // the finale happens in a darker, quieter corner of the universe
    // the finale is dark and quiet; the secret ending's final moment is the brightest the sky ever gets
    const target = view === 'finale' ? 0.35 : view === 'intro' ? 0.75 : view === 'epilogue' ? 1.35 : 1
    material.uniforms.uDim.value = THREE.MathUtils.damp(material.uniforms.uDim.value, target, 1.5, delta)
    material.uniforms.uTime.value += delta
  })
  return (
    <mesh ref={ref} material={material} renderOrder={-20} frustumCulled={false}>
      <sphereGeometry args={[600, 32, 16]} />
    </mesh>
  )
}

function Moon() {
  const ref = useRef()
  const reducedMotion = useStore((s) => s.reducedMotion)
  useFrame((_, delta) => {
    if (!reducedMotion) ref.current.rotation.y += delta * 0.01
  })
  return (
    <group position={moonPosition}>
      <mesh ref={ref}>
        <sphereGeometry args={[9, 48, 32]} />
        <meshBasicMaterial map={moonTexture()} color={[1.55, 1.45, 1.35]} toneMapped={false} />
      </mesh>
      <sprite scale={[70, 70, 1]}>
        <spriteMaterial
          map={glowTexture()}
          color="#ffe6c7"
          opacity={0.32}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <sprite scale={[140, 140, 1]}>
        <spriteMaterial
          map={glowTexture()}
          color="#c9a8ff"
          opacity={0.14}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
    </group>
  )
}

function Clouds() {
  const ref = useRef()
  const reducedMotion = useStore((s) => s.reducedMotion)
  const clouds = useMemo(() => {
    const rand = seeded(21)
    const tints = ['#c9a8f0', '#e7a9cc', '#a99ae6', '#d9c8f5']
    // a sea of clouds around (and below) the island
    return Array.from({ length: count(24, 13) }, (_, i) => {
      const a = (i / 24) * Math.PI * 2 + rand() * 0.4
      const r = 16 + rand() * 18
      const s = 12 + rand() * 12
      return {
        position: [Math.cos(a) * r, -4 - rand() * 6, Math.sin(a) * r],
        scale: [s * 1.6, s * 0.7, 1],
        tint: tints[i % tints.length],
        opacity: 0.09 + rand() * 0.1,
        seed: (i % 4) + 1,
      }
    })
  }, [])
  useFrame((_, delta) => {
    if (!reducedMotion) ref.current.rotation.y += delta * 0.008
  })
  return (
    <group ref={ref}>
      {clouds.map((c, i) => (
        <sprite key={i} position={c.position} scale={c.scale}>
          <spriteMaterial
            map={cloudTexture(c.seed)}
            color={c.tint}
            opacity={c.opacity}
            transparent
            depthWrite={false}
          />
        </sprite>
      ))}
    </group>
  )
}

export default function Sky() {
  const view = useStore((s) => s.view)
  return (
    <>
      <SkyGradient />
      <StarDome count={count(2600, 1300)} />
      <group visible={view !== 'finale' && view !== 'finalRoom'}>
        <Moon />
        <Clouds />
      </group>
    </>
  )
}
