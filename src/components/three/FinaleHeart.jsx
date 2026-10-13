import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { areas } from '../../lib/layout'
import { heartVolumePoints } from '../../lib/heart'
import { glowTexture, heartTexture } from '../../lib/textures'
import { count } from '../../lib/device'
import { useStore } from '../../store'
import { updatePointScale } from './Particles'
import { Glow } from './Bits'

const vertex = /* glsl */ `
  uniform float uTime;
  uniform float uScale;
  uniform float uProgress;
  uniform float uBurst;
  uniform float uSize;
  attribute vec3 aStart;
  attribute float aSeed;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vRot;
  void main() {
    float delay = aSeed * 0.45;
    float p = clamp((uProgress - delay) / 0.55, 0.0, 1.0);
    p = 1.0 - pow(1.0 - p, 3.0);
    // heartbeat: two quick pulses, then rest
    float beat = pow(max(sin(uTime * 2.4), 0.0), 8.0) + 0.6 * pow(max(sin(uTime * 2.4 - 0.7), 0.0), 8.0);
    vec3 target = position * (1.0 + beat * 0.035 * p);
    vec3 swirl = vec3(sin(uTime * 0.6 + aSeed * 30.0), cos(uTime * 0.5 + aSeed * 20.0), sin(uTime * 0.4 + aSeed * 12.0)) * 0.06;
    vec3 pos = mix(aStart, target + swirl, p);
    pos += normalize(position + vec3(0.0001)) * uBurst * (0.5 + aSeed * 2.5);
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (0.55 + aSeed * 0.9) * uScale / -mv.z;
    vColor = aColor;
    vAlpha = 0.35 + 0.65 * p;
    vRot = sin(uTime + aSeed * 40.0) * 0.4 * (1.0 - p);
  }
`
const fragment = /* glsl */ `
  uniform sampler2D uMap;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vRot;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float c = cos(vRot), s = sin(vRot);
    uv = mat2(c, -s, s, c) * uv + 0.5;
    vec4 tex = texture2D(uMap, vec2(uv.x, 1.0 - uv.y));
    float a = tex.a * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }
`

function buildCloud(n, map, size, colors) {
  const targets = heartVolumePoints(n, 4)
  const starts = new Float32Array(n * 3)
  const seeds = new Float32Array(n)
  const cols = new Float32Array(n * 3)
  const palette = colors.map((c) => new THREE.Color(c))
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1
    const a = Math.random() * Math.PI * 2
    const r = 18 + Math.random() * 30
    const k = Math.sqrt(1 - u * u)
    starts.set([Math.cos(a) * k * r, u * r, Math.sin(a) * k * r - 8], i * 3)
    seeds[i] = Math.random()
    const c = palette[Math.floor(Math.random() * palette.length)].clone().multiplyScalar(1.5 + Math.random())
    cols.set([c.r, c.g, c.b], i * 3)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(targets, 3))
  geometry.setAttribute('aStart', new THREE.BufferAttribute(starts, 3))
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
  geometry.setAttribute('aColor', new THREE.BufferAttribute(cols, 3))
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: 400 },
      uProgress: { value: 0 },
      uBurst: { value: 0 },
      uSize: { value: size },
      uMap: { value: map },
    },
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  return { geometry, material }
}

/** Thousands of tiny hearts gathering from across the universe into one big heart. */
export default function FinaleHeart() {
  const group = useRef()
  const glow = useRef()
  const view = useStore((s) => s.view)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const burst = useRef(0)
  const active = view === 'finale'
  const n = count(reducedMotion ? 2500 : 6000, reducedMotion ? 1200 : 2600)

  // ~60% little hearts, ~40% stars — together they gather into one big heart
  const clouds = useMemo(() => {
    const starCount = Math.round(n * 0.4)
    return [
      buildCloud(n - starCount, heartTexture(), 0.16, ['#ff8fc4', '#ffb3d6', '#ffd6e8', '#c9a8ff', '#ffe2a8']),
      buildCloud(starCount, glowTexture(), 0.2, ['#ffffff', '#fff1d6', '#e6dcff', '#ffe2f0']),
    ]
  }, [n])

  useEffect(
    () => () =>
      clouds.forEach(({ geometry, material }) => {
        geometry.dispose()
        material.dispose()
      }),
    [clouds],
  )

  // the answer buttons trigger a joyful burst
  useEffect(() => {
    const onBurst = () => (burst.current = 1)
    window.addEventListener('universe:burst', onBurst)
    return () => window.removeEventListener('universe:burst', onBurst)
  }, [])

  useFrame((state, delta) => {
    const progress = clouds[0].material.uniforms.uProgress.value
    const nextProgress = active ? Math.min(1.5, progress + delta * (reducedMotion ? 1 : 0.24)) : 0
    burst.current = THREE.MathUtils.damp(burst.current, 0, 1.6, delta)
    clouds.forEach(({ material }) => {
      const u = material.uniforms
      u.uTime.value += delta
      u.uProgress.value = nextProgress
      u.uBurst.value = Math.sin(Math.min(burst.current, 1) * Math.PI) * 2.2
      updatePointScale(material, state)
    })
    const u = clouds[0].material.uniforms
    if (!reducedMotion) group.current.rotation.y = Math.sin(u.uTime.value * 0.35) * 0.35
    glow.current.material.opacity = Math.max(0, Math.min(1, u.uProgress.value - 0.6)) * 0.55
  })

  return (
    <group position={areas.finale} visible={active}>
      <group ref={group}>
        {clouds.map(({ geometry, material }, i) => (
          <points key={i} geometry={geometry} material={material} frustumCulled={false} />
        ))}
      </group>
      <Glow ref={glow} color="#ff7fb8" size={16} opacity={0} />
    </group>
  )
}
