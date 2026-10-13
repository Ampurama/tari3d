import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { couple } from '../../content/config'
import { areas } from '../../lib/layout'
import { count } from '../../lib/device'
import { useStore } from '../../store'
import { Flowers, IslandBody } from './Island'
import { Glow, HeartMesh } from './Bits'
import { DriftParticles, Fireflies } from './Particles'
import HiddenHearts from './HiddenHearts'

const SPREAD = 9
const LIFT = 0.75

const beamVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalMatrix * normal;
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`
const beamFragment = /* glsl */ `
  uniform float uTime;
  uniform float uReveal;
  uniform vec3 uPink;
  uniform vec3 uViolet;
  uniform float uGain;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float along = vUv.x;
    vec3 col = mix(uPink, uViolet, along);
    float flow = 0.55 + 0.45 * sin(along * 26.0 - uTime * 3.0);
    float edge = pow(abs(dot(normalize(vNormal), normalize(vView))), 1.5) * uGain;
    float reveal = smoothstep(uReveal, uReveal - 0.08, along);
    gl_FragColor = vec4(col * (1.2 + flow * 1.6), edge * reveal * (0.45 + 0.55 * flow));
  }
`

function Person({ who, side }) {
  const ref = useRef()
  const reducedMotion = useStore((s) => s.reducedMotion)
  const view = useStore((s) => s.view)
  useFrame(({ clock }) => {
    if (reducedMotion) return
    ref.current.position.y = 1.0 + Math.sin(clock.elapsedTime * 1.2 + side) * 0.08
  })
  const color = side < 0 ? '#ffb3d1' : '#cdb3ff'
  return (
    <group position={[side * SPREAD, LIFT, 0]}>
      <IslandBody radius={2.1} seed={side < 0 ? 3 : 8} />
      <Flowers radius={2.1} amount={count(60, 35)} seed={side < 0 ? 4 : 9} avoid={[[0, 0, 0.5]]} />
      <group ref={ref} position={[0, 1, 0]}>
        <mesh>
          <sphereGeometry args={[0.28, 32, 24]} />
          <meshBasicMaterial color={new THREE.Color(color).multiplyScalar(2.2)} toneMapped={false} />
        </mesh>
        <Glow color={color} size={2.4} opacity={0.7} />
        <pointLight color={color} intensity={8} distance={5} />
      </group>
      {view === 'distance' && (
        <Html center position={[0, 2.25, 0]} zIndexRange={[20, 0]}>
          <div className={`person-tag ${side < 0 ? 'is-me' : 'is-you'}`}>
            <span className="person-icon" aria-hidden="true">
              {who.icon}
            </span>
            <strong>{who.name}</strong>
            <small>{who.place}</small>
          </div>
        </Html>
      )}
    </group>
  )
}

/** Two little islands, an ocean of stars between them, and a ribbon of light carrying love across. */
export default function DistanceWorld() {
  const view = useStore((s) => s.view)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const pulses = useRef([])
  const active = view === 'distance'

  const curve = useMemo(
    () =>
      new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-SPREAD, LIFT + 1.1, 0),
        new THREE.Vector3(0, LIFT + 5.2, -0.5),
        new THREE.Vector3(SPREAD, LIFT + 1.1, 0),
      ),
    [],
  )
  const shared = useMemo(
    () => ({
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uPink: { value: new THREE.Color('#ff8fc4') },
      uViolet: { value: new THREE.Color('#a985ff') },
    }),
    [],
  )
  const [core, halo] = useMemo(
    () =>
      [1, 0.28].map(
        (gain) =>
          new THREE.ShaderMaterial({
            uniforms: { ...shared, uGain: { value: gain } },
            vertexShader: beamVertex,
            fragmentShader: beamFragment,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
      ),
    [shared],
  )
  useFrame(({ clock }, delta) => {
    const u = shared
    u.uTime.value = clock.elapsedTime
    // the ribbon draws itself from one island to the other
    u.uReveal.value = active
      ? Math.min(1.1, u.uReveal.value + delta * (reducedMotion ? 3 : 0.35))
      : Math.max(0, u.uReveal.value - delta * 1.5)
    const reveal = u.uReveal.value
    pulses.current.forEach((p, i) => {
      if (!p) return
      const forward = i % 2 === 0
      let t = (clock.elapsedTime * (reducedMotion ? 0.05 : 0.14) + i / pulses.current.length) % 1
      if (!forward) t = 1 - t
      curve.getPointAt(t, p.position)
      const visible = reveal > 1 && (forward ? t : 1 - t) < 0.98
      p.scale.setScalar(visible ? 0.1 + 0.03 * Math.sin(t * Math.PI) : 0.0001)
      p.rotation.y = clock.elapsedTime * 2
    })
  })

  return (
    <group position={areas.distance}>
      <Person who={couple.me} side={-1} />
      <Person who={couple.you} side={1} />
      <HiddenHearts group="distance" />
      <mesh material={core}>
        <tubeGeometry args={[curve, 120, 0.05, 10, false]} />
      </mesh>
      <mesh material={halo}>
        <tubeGeometry args={[curve, 120, 0.16, 10, false]} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <group key={i} ref={(el) => (pulses.current[i] = el)}>
          <HeartMesh color={i % 2 ? '#d9c2ff' : '#ffb3d1'} emissive={i % 2 ? '#a985ff' : '#ff6fae'} glow={1.6} />
        </group>
      ))}
      {/* the ocean of stars between us */}
      <DriftParticles
        position={[0, -1.4, 0]}
        count={count(220, 110)}
        area={[30, 1.6, 10]}
        shape="box"
        texture="glow"
        colors={['#ffffff', '#ffd6ea', '#d8c8ff', '#ffe8b8']}
        size={0.16}
        speed={0.05}
        intensity={1.4}
        seed={61}
      />
      <Fireflies count={count(40, 22)} area={[26, 5, 8]} center={[0, -1, 0]} size={0.12} seed={17} colors={['#ffe0f0', '#e4d6ff']} />
    </group>
  )
}
