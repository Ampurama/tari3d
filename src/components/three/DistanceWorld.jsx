import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { couple } from '../../content/config'
import { areas } from '../../lib/layout'
import { count } from '../../lib/device'
import { glowTexture } from '../../lib/textures'
import { useChapterUnlocked, useStore } from '../../store'
import { audio } from '../../audio/engine'
import { Flowers, IslandBody } from './Island'
import { Glow, HeartMesh } from './Bits'
import { DriftParticles, Fireflies } from './Particles'
import HiddenHearts from './HiddenHearts'

const SPREAD = 9
const LIFT = 0.75
const ORB_Y = LIFT + 1

const threadVertex = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vec3 p = position;
    // a soft sway, strongest in the middle of the thread
    p.y += sin(uv.x * 9.42 + uTime * 1.3) * 0.06 * sin(uv.x * 3.1416);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vNormal = normalMatrix * normal;
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`
const threadFragment = /* glsl */ `
  uniform float uTime;
  uniform float uLeft;
  uniform float uRight;
  uniform float uGain;
  uniform float uConnected;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float along = vUv.x;
    // drawn from both ends toward the middle
    float shown = step(along, uLeft) + step(1.0 - uRight, along);
    if (shown < 0.5) discard;
    vec3 red = vec3(1.0, 0.16, 0.3);
    vec3 pink = vec3(1.0, 0.45, 0.62);
    float flow = 0.5 + 0.5 * sin(along * 40.0 - uTime * 4.0);
    vec3 col = mix(red, pink, flow * 0.35) * (1.4 + uConnected * 1.4 + flow * uConnected);
    float edge = pow(abs(dot(normalize(vNormal), normalize(vView))), 1.4) * uGain;
    gl_FragColor = vec4(col, edge * (0.75 + 0.25 * flow));
  }
`

function Person({ who, side }) {
  const orb = useRef()
  const knot = useRef()
  const [hovered, setHovered] = useState(false)
  const key = side < 0 ? 'me' : 'you'
  const reducedMotion = useStore((s) => s.reducedMotion)
  const view = useStore((s) => s.view)
  const tied = useStore((s) => s.threadTied[key])
  const connected = useStore((s) => s.threadConnected)
  const read = useStore((s) => s.threadRead.includes(key))
  const tieThread = useStore((s) => s.tieThread)
  const showToast = useStore((s) => s.showToast)
  const unlocked = useChapterUnlocked(2)
  useCursor(hovered && view === 'distance')

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    orb.current.position.y = reducedMotion ? 1 : 1 + Math.sin(t * 1.2 + side) * 0.08
    // untied sides pulse softly to invite a tap
    const invite = unlocked && !tied && view === 'distance' && !reducedMotion ? 0.18 * (0.5 + 0.5 * Math.sin(t * 3)) : 0
    orb.current.scale.setScalar(THREE.MathUtils.damp(orb.current.scale.x, 1 + invite + (hovered ? 0.15 : 0), 6, delta))
    knot.current.scale.setScalar(THREE.MathUtils.damp(knot.current.scale.x, tied ? 1 : 0.0001, 4, delta))
  })

  const activate = () => {
    if (!unlocked) {
      showToast('The red thread is waiting for Chapter Three ♡')
      return
    }
    audio.sparkle()
    tieThread(key)
  }
  const select = (e) => {
    if (view === 'cutscene') return
    e.stopPropagation()
    if (e.delta > 8) return
    activate()
  }

  const color = side < 0 ? '#ffb3d1' : '#cdb3ff'
  const hint = !unlocked ? null : !connected ? (tied ? 'tied ✓' : 'tap to tie') : read ? 'message read ♡' : 'tap for a message'
  return (
    <group position={[side * SPREAD, LIFT, 0]}>
      <IslandBody radius={2.1} seed={side < 0 ? 3 : 8} />
      <Flowers radius={2.1} amount={count(60, 35)} seed={side < 0 ? 4 : 9} avoid={[[0, 0, 0.5]]} />
      <group
        ref={orb}
        position={[0, 1, 0]}
        onClick={select}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
      >
        <mesh>
          <sphereGeometry args={[0.28, 32, 24]} />
          <meshBasicMaterial color={new THREE.Color(color).multiplyScalar(2.2)} toneMapped={false} />
        </mesh>
        <Glow color={color} size={2.4} opacity={0.7} />
        <pointLight color={color} intensity={8} distance={5} />
        {/* the knot of red thread around the little world */}
        <mesh ref={knot} rotation={[Math.PI / 2, 0, 0]} scale={0.0001}>
          <torusGeometry args={[0.34, 0.03, 8, 40]} />
          <meshBasicMaterial color={[2.4, 0.3, 0.6]} toneMapped={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.7, 12, 10]} />
          <meshBasicMaterial colorWrite={false} depthWrite={false} />
        </mesh>
      </group>
      {view === 'distance' && (
        <Html center position={[0, 2.35, 0]} zIndexRange={[20, 0]}>
          <button type="button" className={`person-tag ${side < 0 ? 'is-me' : 'is-you'}`} onClick={(e) => {
              e.stopPropagation()
              activate()
            }}>
            <span className="person-icon" aria-hidden="true">
              {who.icon}
            </span>
            <strong>{who.name}</strong>
            <small>{who.place}</small>
            {hint && <em className="person-hint">{hint}</em>}
          </button>
        </Html>
      )}
    </group>
  )
}

/** Tiny sparks running along the thread in both directions. */
function ThreadSparks({ curve, visible }) {
  const n = count(48, 24)
  const { geometry, material } = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    const m = new THREE.PointsMaterial({
      size: 0.22,
      map: glowTexture(),
      color: new THREE.Color(2.4, 0.8, 1.2),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      toneMapped: false,
    })
    return { geometry: g, material: m }
  }, [n])
  const tmp = useMemo(() => new THREE.Vector3(), [])
  const reducedMotion = useStore((s) => s.reducedMotion)
  useFrame(({ clock }) => {
    if (!visible) return
    const pos = geometry.attributes.position
    for (let i = 0; i < n; i++) {
      const forward = i % 2 === 0
      let t = (clock.elapsedTime * (reducedMotion ? 0.03 : 0.11) * (0.7 + (i % 5) * 0.12) + i / n) % 1
      if (!forward) t = 1 - t
      curve.getPointAt(t, tmp)
      tmp.y += Math.sin(t * 9.42 + clock.elapsedTime * 1.3) * 0.06 * Math.sin(t * Math.PI)
      pos.setXYZ(i, tmp.x, tmp.y, tmp.z)
    }
    pos.needsUpdate = true
  })
  return <points geometry={geometry} material={material} visible={visible} frustumCulled={false} />
}

/**
 * RED THREAD — two little islands under the same sky, tied together by a glowing red thread.
 * Tap both islands to tie it; once connected, sparks and hearts run along it in both directions.
 */
export default function DistanceWorld() {
  const view = useStore((s) => s.view)
  const tied = useStore((s) => s.threadTied)
  const connected = useStore((s) => s.threadConnected)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const pulses = useRef([])
  const flash = useRef()
  const flashT = useRef(0)
  const wasConnected = useRef(connected)
  const active = view === 'distance'

  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-SPREAD, ORB_Y, 0),
        new THREE.Vector3(-SPREAD * 0.5, LIFT + 0.15, 0.7),
        new THREE.Vector3(0, LIFT + 0.45, 1.0),
        new THREE.Vector3(SPREAD * 0.5, LIFT + 0.15, 0.7),
        new THREE.Vector3(SPREAD, ORB_Y, 0),
      ]),
    [],
  )
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uLeft: { value: tied.me ? (connected ? 0.5 : 0.22) : 0 },
      uRight: { value: tied.you ? (connected ? 0.5 : 0.22) : 0 },
      uConnected: { value: connected ? 1 : 0 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const [core, halo] = useMemo(
    () =>
      [1, 0.3].map(
        (gain) =>
          new THREE.ShaderMaterial({
            uniforms: { ...uniforms, uGain: { value: gain } },
            vertexShader: threadVertex,
            fragmentShader: threadFragment,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
      ),
    [uniforms],
  )

  useFrame(({ clock }, delta) => {
    uniforms.uTime.value = clock.elapsedTime
    const speed = reducedMotion ? 6 : 0.45
    const goal = (side) => (connected ? 0.5 : tied[side] ? 0.22 : 0)
    uniforms.uLeft.value = THREE.MathUtils.lerp(uniforms.uLeft.value, goal('me'), Math.min(1, delta * speed * 3))
    uniforms.uRight.value = THREE.MathUtils.lerp(uniforms.uRight.value, goal('you'), Math.min(1, delta * speed * 3))
    uniforms.uConnected.value = THREE.MathUtils.damp(uniforms.uConnected.value, connected ? 1 : 0, 1.5, delta)

    // the moment both ends meet: a burst of light in the middle
    if (connected && !wasConnected.current) flashT.current = 1
    wasConnected.current = connected
    flashT.current = Math.max(0, flashT.current - delta * 0.5)
    const f = flashT.current
    flash.current.visible = f > 0.01
    flash.current.scale.setScalar(1 + (1 - f) * 9)
    flash.current.material.opacity = f * 0.9

    const fullyDrawn = uniforms.uLeft.value > 0.48 && uniforms.uRight.value > 0.48
    pulses.current.forEach((p, i) => {
      if (!p) return
      const forward = i % 2 === 0
      let t = (clock.elapsedTime * (reducedMotion ? 0.04 : 0.12) + i / pulses.current.length) % 1
      if (!forward) t = 1 - t
      curve.getPointAt(t, p.position)
      p.position.y += 0.12
      p.scale.setScalar(fullyDrawn ? 0.11 + 0.03 * Math.sin(t * Math.PI) : 0.0001)
      p.rotation.y = clock.elapsedTime * 2
    })
  })

  const mid = curve.getPointAt(0.5)

  return (
    <group position={areas.distance}>
      <Person who={couple.me} side={-1} />
      <Person who={couple.you} side={1} />
      <HiddenHearts group="distance" />
      <mesh material={core}>
        <tubeGeometry args={[curve, 160, 0.035, 8, false]} />
      </mesh>
      <mesh material={halo}>
        <tubeGeometry args={[curve, 160, 0.12, 8, false]} />
      </mesh>
      <ThreadSparks curve={curve} visible={connected && active} />
      {[0, 1, 2, 3].map((i) => (
        <group key={i} ref={(el) => (pulses.current[i] = el)}>
          <HeartMesh color={i % 2 ? '#ffb3d1' : '#ff5c7a'} emissive={i % 2 ? '#ff6fae' : '#ff2b55'} glow={1.6} />
        </group>
      ))}
      <Glow ref={flash} position={mid} color="#ff5c7a" size={1.5} opacity={0} visible={false} />
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

