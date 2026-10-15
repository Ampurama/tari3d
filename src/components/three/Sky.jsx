import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../../store'
import { cloudTexture, glowTexture, moonTexture } from '../../lib/textures'
import { moonPosition } from '../../lib/layout'
import { seeded } from '../../lib/island'
import { count } from '../../lib/device'
import { atmosphere, atmosphereTarget } from '../../lib/atmosphere'
import { StarDome } from './Particles'

/*
 * THE SKY — a bright pastel day by default (blue overhead, light cyan at the horizon, a warm sun),
 * warming into peach and pink as the story goes on, and a golden dusk for the finale.
 * The star-gazing places (the constellation, the old heart finale, the secret room) are at night.
 * It also eases the shared time of day (lib/atmosphere.js) that the lights read.
 */

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const skyFragment = /* glsl */ `
  varying vec3 vDir;
  uniform float uDay;
  uniform float uSunset;
  uniform float uDim;
  uniform float uTime;
  uniform vec3 uSunDir;
  uniform vec3 uDayHorizon;
  uniform vec3 uDayMid;
  uniform vec3 uDayTop;
  uniform vec3 uDayBelow;
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    // day (dreamcore): a warm peach-pink glow at the horizon, lavender above it, a deep celestial
    // blue overhead, and a soft lilac haze below the horizon
    vec3 dayCol = mix(uDayHorizon, uDayMid, smoothstep(0.0, 0.3, h));
    dayCol = mix(dayCol, uDayTop, smoothstep(0.3, 0.9, h));
    dayCol = mix(dayCol, uDayBelow, smoothstep(0.0, -0.35, h));
    // two faint pastel veils drifting high up (pink and aqua), like a daytime aurora
    float veil1 = smoothstep(0.35, 0.0, abs(h - 0.42 - 0.06 * sin(d.x * 3.0 + uTime * 0.05)));
    float veil2 = smoothstep(0.3, 0.0, abs(h - 0.62 - 0.05 * sin(d.z * 2.4 - uTime * 0.04)));
    dayCol += vec3(1.0, 0.62, 0.82) * veil1 * 0.07 + vec3(0.55, 0.95, 0.95) * veil2 * 0.05;
    // afternoon → sunset: peach and pink low down, a lavender-blue overhead
    float low = smoothstep(0.55, -0.1, h);
    vec3 dusk = mix(vec3(0.58, 0.66, 0.95), vec3(1.0, 0.74, 0.62), low);
    dusk = mix(dusk, vec3(1.0, 0.66, 0.72), low * low * 0.6);
    dayCol = mix(dayCol, dusk, uSunset * 0.85);
    // night: deep blue with two soft nebulae (only for the star-gazing places)
    // night: a deep clear blue, a little lighter (and faintly violet) toward the horizon
    vec3 night = mix(vec3(0.12, 0.14, 0.38), vec3(0.02, 0.03, 0.12), smoothstep(0.0, 0.65, h));
    night = mix(night, vec3(0.03, 0.04, 0.15), smoothstep(0.0, -0.6, h));
    float n1 = pow(max(dot(d, normalize(vec3(-0.5, 0.35, -0.8))), 0.0), 6.0);
    float n2 = pow(max(dot(d, normalize(vec3(0.75, 0.1, -0.4))), 0.0), 9.0);
    night += vec3(1.0, 0.56, 0.76) * n1 * 0.5 + vec3(0.55, 0.42, 1.0) * n2 * 0.55;
    vec3 col = mix(night, dayCol, uDay);
    // celestial: a scatter of stars that never quite leaves, faint by day, bright at night
    {
      vec3 sp = d * 110.0;
      vec3 cell = floor(sp);
      float pick = fract(sin(dot(cell, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
      float core = smoothstep(0.32, 0.0, length(fract(sp) - 0.5));
      float twinkle = 0.65 + 0.35 * sin(uTime * (1.5 + pick * 3.0) + pick * 40.0);
      float starMask = step(0.982, pick) * core * twinkle * smoothstep(0.08, 0.35, h);
      col += vec3(1.0, 0.96, 1.0) * starMask * mix(0.9, 0.32, uDay);
    }
    // the sun: a soft warm glow (and a golden halo low in the sky at sunset)
    float sun = max(dot(d, uSunDir), 0.0);
    col += vec3(1.0, 0.93, 0.78) * pow(sun, 260.0) * uDay;
    col += vec3(1.0, 0.72, 0.4) * pow(max(dot(d, normalize(vec3(0.15, 0.05, -1.0))), 0.0), 8.0) * uSunset * 0.55 * uDay;
    gl_FragColor = vec4(col * uDim, 1.0);
  }
`

/**
 * The daytime sky colours (tweak these to make the sky lighter or deeper).
 * horizon → mid → top going up; below = under the horizon (seen past the island's edge).
 */
const DAY_SKY = {
  horizon: new THREE.Color(0.96, 0.7, 0.8),
  mid: new THREE.Color(0.56, 0.52, 0.9),
  top: new THREE.Color(0.24, 0.34, 0.82),
  below: new THREE.Color(0.7, 0.64, 0.92),
}

/** The colour far away at the island's level (the fog fades distant things into it). */
const HAZE = { day: new THREE.Color(0.74, 0.68, 0.93), sunset: new THREE.Color(1.0, 0.76, 0.72), night: new THREE.Color(0.05, 0.07, 0.2) }
const haze = new THREE.Color()

/**
 * Atmospheric depth: a very light fog in the colour of the haze, so the far islands, the clouds
 * and the cliffs below melt softly into the sky instead of being cut out against it.
 */
function Haze() {
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    scene.fog = new THREE.FogExp2(HAZE.day.clone(), 0.0024)
    return () => {
      scene.fog = null
    }
  }, [scene])
  useFrame(() => {
    if (!scene.fog) return
    haze.copy(HAZE.day).lerp(HAZE.sunset, atmosphere.sunset * 0.8).lerp(HAZE.night, 1 - atmosphere.day)
    scene.fog.color.copy(haze)
  })
  return null
}

/** Direction toward the sun (it lights the island from the upper right, behind the camera's shoulder). */
export const SUN_DIR = new THREE.Vector3(0.55, 0.62, 0.56).normalize()

function SkyGradient() {
  const ref = useRef()
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uDay: { value: 1 },
          uSunset: { value: 0 },
          uDim: { value: 1 },
          uTime: { value: 0 },
          uSunDir: { value: SUN_DIR },
          uDayHorizon: { value: DAY_SKY.horizon },
          uDayMid: { value: DAY_SKY.mid },
          uDayTop: { value: DAY_SKY.top },
          uDayBelow: { value: DAY_SKY.below },
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
    const s = useStore.getState()
    // ease the shared time of day toward where the story wants it
    const goal = atmosphereTarget(s, state.clock.elapsedTime)
    atmosphere.day = THREE.MathUtils.damp(atmosphere.day, goal.day, 1.2, delta)
    atmosphere.sunset = THREE.MathUtils.damp(atmosphere.sunset, goal.sunset, 0.8, delta)
    const u = material.uniforms
    u.uDay.value = atmosphere.day
    u.uSunset.value = atmosphere.sunset
    u.uTime.value += delta
    // the old heart finale is dark and quiet; the secret ending's last moment is the brightest
    u.uDim.value = THREE.MathUtils.damp(u.uDim.value, s.view === 'finale' ? 0.45 : s.view === 'epilogue' ? 1.1 : 1, 1.5, delta)
  })
  return (
    <mesh ref={ref} material={material} renderOrder={-20} frustumCulled={false}>
      <sphereGeometry args={[600, 32, 16]} />
    </mesh>
  )
}

const MOON_NIGHT = new THREE.Color(1.55, 1.45, 1.35)
const MOON_DAY = new THREE.Color(1.0, 0.97, 1.05)

/** The moon: bright at night, and still faintly there by day, pale against the dreamy sky. */
function Moon() {
  const ref = useRef()
  const halo = useRef()
  const reducedMotion = useStore((s) => s.reducedMotion)
  useFrame((_, delta) => {
    if (!reducedMotion) ref.current.rotation.y += delta * 0.01
    const night = 1 - atmosphere.day
    const m = ref.current.material
    m.color.copy(MOON_DAY).lerp(MOON_NIGHT, night)
    m.opacity = 0.55 + 0.45 * night
    halo.current.material.opacity = 0.12 + 0.2 * night
  })
  return (
    <group position={moonPosition}>
      <mesh ref={ref}>
        <sphereGeometry args={[9, 48, 32]} />
        <meshBasicMaterial map={moonTexture()} color={MOON_DAY} transparent opacity={0.55} toneMapped={false} fog={false} />
      </mesh>
      <sprite ref={halo} scale={[70, 70, 1]}>
        <spriteMaterial map={glowTexture()} color="#ffe6c7" opacity={0.12} transparent depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
      </sprite>
    </group>
  )
}

/** A soft pastel planet's surface: gentle bands of pink, peach and lavender. */
function planetTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  const g = ctx.createLinearGradient(0, 0, 0, 128)
  ;[
    [0, '#f7d6ff'],
    [0.25, '#ffc9dc'],
    [0.45, '#fde3cf'],
    [0.6, '#d8cbff'],
    [0.8, '#ffd3e6'],
    [1, '#cfc4ff'],
  ].forEach(([t, c]) => g.addColorStop(t, c))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 128)
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = 'rgba(255,255,255,' + (0.06 + (i % 3) * 0.04) + ')'
    ctx.fillRect(0, 8 + i * 13, 256, 3 + (i % 2) * 3)
  }
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
/** Far off to the north-east, high: seen behind the intro heart, the character stage, and from a low camera. */
const PLANET_AT = new THREE.Vector3(100, 64, -170)

/** A ringed pastel planet hanging in the sky, day and night: the celestial half of the dream. */
function Planet() {
  const body = useRef()
  const ring = useRef()
  const reducedMotion = useStore((s) => s.reducedMotion)
  const map = useMemo(planetTexture, [])
  useEffect(() => () => map.dispose(), [map])
  useFrame((_, delta) => {
    if (!reducedMotion) body.current.rotation.y += delta * 0.02
    const k = 0.7 + 0.3 * (1 - atmosphere.day)
    body.current.material.opacity = k
    ring.current.material.opacity = 0.45 * k
  })
  return (
    <group position={PLANET_AT} rotation={[0.35, 0.4, -0.32]}>
      <mesh ref={body}>
        <sphereGeometry args={[11, 40, 24]} />
        <meshBasicMaterial map={map} transparent opacity={0.7} toneMapped={false} fog={false} />
      </mesh>
      <mesh ref={ring} rotation={[Math.PI / 2 - 0.25, 0, 0]}>
        <ringGeometry args={[15, 22, 64]} />
        <meshBasicMaterial color="#ffe6f2" transparent opacity={0.45} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} fog={false} />
      </mesh>
      <sprite scale={[80, 80, 1]}>
        <spriteMaterial map={glowTexture()} color="#f3c9ff" opacity={0.16} transparent depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
      </sprite>
    </group>
  )
}

/**
 * Clouds: big soft cumulus drifting high over the meadow, all around the horizon
 * (they turn peach and pink at sunset).
 */
function Clouds() {
  const above = useRef()
  const reducedMotion = useStore((s) => s.reducedMotion)
  const sky = useMemo(() => {
    const rand = seeded(57)
    // big cumulus clouds around the horizon, each one a few overlapping puffs
    const out = []
    for (let i = 0; i < count(9, 6); i++) {
      const a = (i / 9) * Math.PI * 2 + rand() * 0.5
      const r = 46 + rand() * 22
      const base = [Math.cos(a) * r, 14 + rand() * 10, Math.sin(a) * r]
      const s = 11 + rand() * 9
      ;[
        [0, 0, s * 1.6, s * 0.9],
        [-s * 0.55, -s * 0.12, s * 1.1, s * 0.7],
        [s * 0.6, -s * 0.15, s * 1.2, s * 0.7],
        [s * 0.1, s * 0.35, s * 0.9, s * 0.65],
      ].forEach(([dx, dy, w, h], k) =>
        out.push({ position: [base[0] - Math.sin(a) * dx, base[1] + dy, base[2] + Math.cos(a) * dx], scale: [w, h, 1], opacity: 0.95, seed: ((i + k) % 4) + 1, pink: i % 4 === 1 && k === 0 }),
      )
    }
    return out
  }, [])
  const tint = useMemo(() => new THREE.Color(), [])
  const white = useMemo(() => new THREE.Color('#fff7fc'), [])
  const cream = useMemo(() => new THREE.Color('#ffeee4'), [])
  const lavender = useMemo(() => new THREE.Color('#ece2ff'), [])
  const blush = useMemo(() => new THREE.Color('#ffdcec'), [])
  const gold = useMemo(() => new THREE.Color('#ffc9a8'), [])
  useFrame((_, delta) => {
    if (!reducedMotion) {
      above.current.rotation.y -= delta * 0.004
    }
    // white by day, warming at sunset, dim at night
    const k = 0.35 + 0.65 * atmosphere.day
    ;[above.current].forEach((g) =>
      g.children.forEach((sp, i) => {
        tint.copy(sp.userData.pink ? blush : [white, lavender, cream, white][i % 4]).lerp(gold, atmosphere.sunset * 0.55).multiplyScalar(k)
        sp.material.color.copy(tint)
      }),
    )
  })
  const draw = (list) =>
    list.map((c, i) => (
      <sprite key={i} position={c.position} scale={c.scale} userData={{ pink: c.pink }}>
        <spriteMaterial map={cloudTexture(c.seed)} opacity={c.opacity} transparent depthWrite={false} />
      </sprite>
    ))
  return (
    <>
      <group ref={above}>{draw(sky)}</group>
    </>
  )
}

export default function Sky() {
  const view = useStore((s) => s.view)
  const night = view === 'constellation' || view === 'finale' || view === 'finalRoom'
  // a few stars in the pastel twilight of the intro and the character selection, too
  const stars = night || view === 'intro' || view === 'avatar'
  return (
    <>
      <SkyGradient />
      <Haze />
      {stars && <StarDome count={count(2600, 1300)} />}
      <group visible={view !== 'finale' && view !== 'finalRoom'}>
        <Moon />
        <Planet />
        <Clouds />
      </group>
    </>
  )
}
