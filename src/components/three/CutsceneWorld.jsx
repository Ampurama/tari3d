import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { cut, cutTime, tickCutscene, useCutscene } from '../../lib/cutscene'
import { BEACH, BEACH_SPOT } from '../../lib/westLayout'
import { currentAvatar, useStore } from '../../store'
import Avatar from './Avatar'
import Ghost, { useMateAvatar } from './Ghost'
import { Glow } from './Bits'
import { Fireflies } from './Particles'

/*
 * CUTSCENES, in the world: the clock that runs them (sky, music, their beats, the end), and the
 * moonlit beach she dreams of from the pier: far from everything, and only drawn while it plays.
 */

const SHORE = BEACH.z // the waterline runs along x; the sea is toward −z, where the moon is

/** The sea of the dream: deep night blue, foam rolling in, and the moon's path on the water. */
const dreamSea = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uShore: { value: SHORE }, uX: { value: BEACH.x } },
  vertexShader: /* glsl */ `
    uniform float uTime;
    varying vec2 vWorld;
    void main() {
      vec4 w = modelMatrix * vec4(position, 1.0);
      w.y += sin(w.x * 0.35 + uTime * 0.9) * 0.05 + sin(w.z * 0.5 - uTime * 1.2) * 0.06;
      vWorld = w.xz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }`,
  fragmentShader: /* glsl */ `
    uniform float uTime, uShore, uX;
    varying vec2 vWorld;
    void main() {
      float toShore = uShore - vWorld.y; // metres out to sea
      vec3 col = mix(vec3(0.05, 0.12, 0.27), vec3(0.02, 0.05, 0.14), smoothstep(0.0, 60.0, toShore));
      // the moon's path
      float off = abs(vWorld.x - uX);
      float width = 0.6 + toShore * 0.09;
      float sparkle = 0.55 + 0.45 * sin(vWorld.x * 6.0 + vWorld.y * 3.0 + uTime * 2.4);
      col += vec3(1.0, 0.96, 0.82) * smoothstep(width, 0.0, off) * smoothstep(1.0, 8.0, toShore) * sparkle * 0.6;
      // foam rolling onto the sand
      float wave = fract(toShore * 0.35 - uTime * 0.18);
      float foam = smoothstep(0.85, 1.0, wave) * smoothstep(9.0, 0.5, toShore) + smoothstep(1.2, 0.0, toShore) * (0.6 + 0.4 * sin(uTime * 1.3));
      col = mix(col, vec3(0.92, 0.95, 1.0), clamp(foam, 0.0, 1.0) * 0.75);
      gl_FragColor = vec4(col, 1.0);
    }`,
})

function Sand() {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(140, 50, 70, 25)
    g.rotateX(-Math.PI / 2)
    const p = g.attributes.position
    const colors = []
    const c = new THREE.Color()
    const dry = new THREE.Color('#cdb894')
    const wet = new THREE.Color('#8f7f68')
    for (let i = 0; i < p.count; i++) {
      // (after rotating, z runs −25 … 25; the waterline is at −25)
      const inland = p.getZ(i) + 25
      p.setY(i, inland * 0.045 - 0.12 + Math.sin(p.getX(i) * 0.3) * 0.04)
      c.copy(wet).lerp(dry, THREE.MathUtils.smoothstep(inland, 0.5, 4))
      colors.push(c.r, c.g, c.b)
    }
    g.translate(BEACH.x, 0, SHORE + 25)
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    g.computeVertexNormals()
    return g
  }, [])
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial vertexColors roughness={1} />
    </mesh>
  )
}

/** Footprints in the sand, one by one, coming to stand beside her. */
const tmpM = new THREE.Matrix4()
const tmpQ = new THREE.Quaternion()
const tmpP = new THREE.Vector3()
const tmpS = new THREE.Vector3()
const tmpE = new THREE.Euler()

function Footprints() {
  const ref = useRef()
  const prints = useMemo(() => {
    const list = []
    const from = new THREE.Vector2(BEACH_SPOT.x - 7.5, BEACH_SPOT.z + 1.6)
    const to = new THREE.Vector2(BEACH_SPOT.x - 0.85, BEACH_SPOT.z + 0.15)
    const n = 16
    const dir = to.clone().sub(from).normalize()
    const sideV = new THREE.Vector2(-dir.y, dir.x)
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1)
      const p = from.clone().lerp(to, k).addScaledVector(sideV, i % 2 ? 0.1 : -0.1)
      list.push({ x: p.x, z: p.y, yaw: Math.atan2(dir.x, dir.y), at: 13.6 + k * 5.8 })
    }
    return list
  }, [])
  useFrame(() => {
    const t = cutTime()
    prints.forEach((p, i) => {
      const s = THREE.MathUtils.clamp((t - p.at) / 0.35, 0, 1)
      tmpM.compose(tmpP.set(p.x, 0.03 + (p.z - SHORE) * 0.045 - 0.12, p.z), tmpQ.setFromEuler(tmpE.set(0, p.yaw, 0)), tmpS.set(0.07 * s, 0.01, 0.13 * s))
      ref.current.setMatrixAt(i, tmpM)
    })
    ref.current.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, prints.length]} frustumCulled={false}>
      <sphereGeometry args={[1, 10, 6]} />
      <meshStandardMaterial color="#7d6c57" roughness={1} />
    </instancedMesh>
  )
}

/** Paper lanterns drifting up far out over the water. */
function SkyLanterns() {
  const ref = useRef()
  const list = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        x: BEACH.x + (((i * 37) % 41) - 20) * 2.2,
        z: SHORE - 25 - ((i * 53) % 60),
        delay: (i * 1.7) % 18,
        speed: 0.28 + ((i * 7) % 5) * 0.05,
      })),
    [],
  )
  useLayoutEffect(() => {
    ref.current.frustumCulled = false
  }, [])
  useFrame(() => {
    const t = cutTime()
    tmpQ.identity()
    list.forEach((l, i) => {
      const y = Math.max(0, t - 4 - l.delay) * l.speed
      const s = y > 0 ? 0.32 : 0
      tmpM.compose(tmpP.set(l.x + Math.sin(t * 0.3 + i) * 0.6, y, l.z), tmpQ, tmpS.set(s, s * 1.3, s))
      ref.current.setMatrixAt(i, tmpM)
    })
    ref.current.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, list.length]}>
      <cylinderGeometry args={[0.8, 1, 1.2, 6]} />
      <meshBasicMaterial color={[2.4, 1.5, 0.8]} toneMapped={false} />
    </instancedMesh>
  )
}

/** A shooting star crossing the sky ahead of them. */
function ShootingStar() {
  const ref = useRef()
  const from = useMemo(() => new THREE.Vector3(BEACH.x + 34, 30, SHORE - 90), [])
  const to = useMemo(() => new THREE.Vector3(BEACH.x - 22, 21, SHORE - 90), [])
  useFrame(() => {
    const k = (cutTime() - 38.4) / 1.5
    const g = ref.current
    g.visible = k > 0 && k < 1
    if (!g.visible) return
    g.position.lerpVectors(from, to, k)
    g.children[1].material.opacity = Math.sin(Math.PI * k)
  })
  const dir = to.clone().sub(from)
  return (
    <group ref={ref} visible={false}>
      <Glow color="#fff6d8" size={3} opacity={0.9} />
      <mesh rotation={[0, 0, Math.atan2(dir.y, dir.x)]} position={[-dir.clone().normalize().x * 3.5, -dir.clone().normalize().y * 3.5, 0]}>
        <planeGeometry args={[7, 0.12]} />
        <meshBasicMaterial color="#fff6d8" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** Her, and (as the footprints arrive) the one she's waiting for, in light, taking her hand. */
function Two() {
  const me = useStore(currentAvatar)
  const mate = useMateAvatar()
  // facing the sea (−z); the other one stands at her side, where a held hand reaches
  const yaw = Math.PI
  const beside = BEACH_SPOT.clone().add(new THREE.Vector3(Math.cos(yaw) * 0.55, 0, -Math.sin(yaw) * 0.55))
  const holding = () => cutTime() >= 24
  return (
    <group>
      <Avatar config={me} position={BEACH_SPOT} rotation={[0, yaw, 0]} getMotion={() => ({ speed: 0, cheer: 0, hand: holding() ? 'right' : null })} />
      <Ghost config={mate} position={beside} rotation={[0, yaw, 0]} getOpacity={() => THREE.MathUtils.clamp((cutTime() - 19.8) / 3.2, 0, 1)} getMotion={() => ({ speed: 0, cheer: 0, hand: holding() ? 'left' : null })} />
      <Glow position={[beside.x, 1.0, beside.z]} color="#ffc2dd" size={2.6} opacity={0.35} />
    </group>
  )
}

function Beach() {
  useFrame((_, delta) => (dreamSea.uniforms.uTime.value += delta))
  return (
    <group>
      {/* moonlight (only while the dream is on) */}
      <directionalLight position={[BEACH.x, 20, SHORE - 60]} intensity={0.9} color="#cfdcff" />
      <hemisphereLight args={['#5d6fa8', '#2a2440', 0.55]} />
      <mesh position={[BEACH.x, -0.1, SHORE - 60]} rotation={[-Math.PI / 2, 0, 0]} material={dreamSea}>
        <planeGeometry args={[260, 120, 60, 30]} />
      </mesh>
      <Sand />
      {/* the moon, low over the sea */}
      <mesh position={[BEACH.x, 13, SHORE - 150]}>
        <circleGeometry args={[7, 48]} />
        <meshBasicMaterial color={[1.6, 1.55, 1.3]} toneMapped={false} />
      </mesh>
      <Glow position={[BEACH.x, 13, SHORE - 149]} color="#fff3d6" size={46} opacity={0.35} />
      <Footprints />
      <SkyLanterns />
      <ShootingStar />
      <Two />
      <Fireflies count={18} area={[10, 2.4, 6]} center={[BEACH_SPOT.x, 1.1, BEACH_SPOT.z + 1]} seed={99} colors={['#fff1c9', '#ffd6ea']} />
    </group>
  )
}

/** Shows the beach only for its part of the dream (the white flashes hide the switch). */
function BeachWhenDreaming() {
  const ref = useRef()
  useFrame(() => {
    if (!ref.current) return
    const sc = cut.script?.scene
    const t = cutTime()
    ref.current.visible = Boolean(sc && t >= sc[0] && t < sc[1])
  })
  return (
    <group ref={ref} visible={false}>
      <Beach />
    </group>
  )
}

/** The cutscene clock, and the beach while the dream plays. */
export default function CutsceneWorld() {
  const id = useCutscene((s) => s.id)
  useFrame(() => tickCutscene())
  return id === 'beach' ? <BeachWhenDreaming /> : null
}
