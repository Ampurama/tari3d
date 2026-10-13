import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { timeScale, useStore } from '../../store'
import { glowTexture, heartTexture, petalTexture } from '../../lib/textures'
import { seeded } from '../../lib/island'

/** Pixel scale so point sizes can be given in world units. */
function updatePointScale(material, state) {
  const { size, viewport, camera } = state
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
  material.uniforms.uScale.value = (size.height * viewport.dpr * 0.5) / tanHalf
}

const commonVertex = /* glsl */ `
  uniform float uTime;
  uniform float uScale;
  uniform float uSize;
  uniform float uSpeed;
  uniform vec3 uArea;
  uniform float uOpacity;
  attribute float aSeed;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vRot;
`

const driftVertex = /* glsl */ `
  ${commonVertex}
  uniform float uDir;
  void main() {
    vec3 p = position;
    float t = uTime * uSpeed * (0.55 + aSeed * 0.9);
    p.y = mod(p.y + t * uDir, uArea.y);
    p.x += sin(t * 0.9 + aSeed * 40.0) * 0.45;
    p.z += cos(t * 0.7 + aSeed * 23.0) * 0.45;
    float edge = smoothstep(0.0, uArea.y * 0.18, p.y) * smoothstep(uArea.y, uArea.y * 0.8, p.y);
    p.y -= uArea.y * 0.5;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (0.6 + aSeed * 0.8) * uScale / -mv.z;
    vColor = aColor;
    vAlpha = edge * uOpacity;
    vRot = sin(t * 0.8 + aSeed * 10.0) * 0.6;
  }
`

const wanderVertex = /* glsl */ `
  ${commonVertex}
  void main() {
    vec3 p = position;
    float t = uTime * uSpeed;
    float s = aSeed * 60.0;
    p += vec3(sin(t * 0.7 + s), sin(t * 0.9 + s * 1.3) * 0.6, cos(t * 0.6 + s * 0.7)) * 0.6;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float blink = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * (1.2 + aSeed) + s), 2.0);
    gl_PointSize = uSize * (0.7 + aSeed * 0.6) * uScale / -mv.z;
    vColor = aColor;
    vAlpha = blink * uOpacity;
    vRot = 0.0;
  }
`

const spriteFragment = /* glsl */ `
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
    gl_FragColor = vec4(vColor * tex.rgb, a);
  }
`

function buildAttributes({ count, area, colors, seed, center = [0, 0, 0], shape = 'box' }) {
  const rand = seeded(seed)
  const positions = new Float32Array(count * 3)
  const seeds = new Float32Array(count)
  const cols = new Float32Array(count * 3)
  const palette = colors.map((c) => new THREE.Color(c))
  for (let i = 0; i < count; i++) {
    if (shape === 'disc') {
      const a = rand() * Math.PI * 2
      const r = Math.sqrt(rand()) * area[0] * 0.5
      positions[i * 3] = center[0] + Math.cos(a) * r
      positions[i * 3 + 2] = center[2] + Math.sin(a) * r
    } else {
      positions[i * 3] = center[0] + (rand() - 0.5) * area[0]
      positions[i * 3 + 2] = center[2] + (rand() - 0.5) * area[2]
    }
    positions[i * 3 + 1] = center[1] + rand() * area[1]
    seeds[i] = rand()
    const c = palette[Math.floor(rand() * palette.length)]
    cols.set([c.r, c.g, c.b], i * 3)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
  geometry.setAttribute('aColor', new THREE.BufferAttribute(cols, 3))
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(...center), Math.max(...area) * 1.5)
  return geometry
}

/**
 * Hearts (or petals) slowly rising/falling and swaying.
 * `area` is [width, height, depth]; the volume is centred on the group's origin.
 */
export function DriftParticles({
  count = 60,
  area = [14, 8, 14],
  colors = ['#ffb3d1', '#d9c2ff', '#ffe2a8'],
  size = 0.22,
  speed = 0.25,
  direction = 1,
  texture = 'heart',
  opacity = 1,
  seed = 7,
  shape = 'disc',
  intensity = 1.6,
  ...props
}) {
  const reducedMotion = useStore((s) => s.reducedMotion)
  const key = JSON.stringify([count, area, colors, seed, shape])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geometry = useMemo(() => buildAttributes({ count, area, colors, seed, shape }), [key])
  const material = useMemo(() => {
    const map = texture === 'petal' ? petalTexture() : texture === 'glow' ? glowTexture() : heartTexture()
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uScale: { value: 400 },
        uSize: { value: size },
        uSpeed: { value: speed },
        uDir: { value: direction },
        uArea: { value: new THREE.Vector3(...area) },
        uOpacity: { value: opacity * intensity },
        uMap: { value: map },
      },
      vertexShader: driftVertex,
      fragmentShader: spriteFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texture, size, speed, direction, key, opacity, intensity])

  // free GPU buffers when this effect unmounts (the shared sprite textures stay cached)
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  useFrame((state, delta) => {
    material.uniforms.uTime.value += delta * (reducedMotion ? 0.25 : 1) * timeScale(useStore.getState())
    updatePointScale(material, state)
  })

  return <points geometry={geometry} material={material} frustumCulled={false} {...props} />
}

/** Fireflies: soft golden lights wandering around a volume. */
export function Fireflies({ count = 40, area = [12, 4, 12], size = 0.16, seed = 3, center = [0, 0.6, 0], colors, ...props }) {
  const reducedMotion = useStore((s) => s.reducedMotion)
  const key = JSON.stringify([count, area, seed, center, colors])
  const geometry = useMemo(
    () => buildAttributes({ count, area, colors: colors || ['#ffd98a', '#fff1c4', '#ffc2dc'], seed, center, shape: 'disc' }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  )
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uScale: { value: 400 },
          uSize: { value: size },
          uSpeed: { value: 0.6 },
          uArea: { value: new THREE.Vector3(...area) },
          uOpacity: { value: 2.4 },
          uMap: { value: glowTexture() },
        },
        vertexShader: wanderVertex,
        fragmentShader: spriteFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [size, key],
  )
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  useFrame((state, delta) => {
    material.uniforms.uTime.value += delta * (reducedMotion ? 0.3 : 1) * timeScale(useStore.getState())
    updatePointScale(material, state)
  })
  return <points geometry={geometry} material={material} frustumCulled={false} {...props} />
}

const starVertex = /* glsl */ `
  uniform float uTime;
  uniform float uScale;
  uniform float uReveal;
  attribute float aSeed;
  attribute float aSize;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float twinkle = 0.55 + 0.45 * sin(uTime * (0.6 + aSeed * 2.2) + aSeed * 80.0);
    float reveal = smoothstep(aSeed, aSeed + 0.15, uReveal * 1.15);
    gl_PointSize = aSize * uScale / -mv.z;
    vColor = aColor;
    vAlpha = twinkle * reveal;
  }
`

const starFragment = /* glsl */ `
  uniform sampler2D uMap;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 tex = texture2D(uMap, gl_PointCoord);
    float a = tex.a * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }
`

/** Twinkling star dome that follows the camera, so it always feels infinitely far away. */
export function StarDome({ count = 2200, radius = 380 }) {
  const ref = useRef()
  const reducedMotion = useStore((s) => s.reducedMotion)
  const { geometry, material } = useMemo(() => {
    const rand = seeded(99)
    const pos = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    const sizes = new Float32Array(count)
    const cols = new Float32Array(count * 3)
    const palette = ['#ffffff', '#ffffff', '#ffe9f3', '#e6dcff', '#fff0c9'].map((c) => new THREE.Color(c))
    for (let i = 0; i < count; i++) {
      const u = rand() * 2 - 1
      const a = rand() * Math.PI * 2
      const r = Math.sqrt(1 - u * u)
      const d = radius * (0.85 + rand() * 0.15)
      pos.set([Math.cos(a) * r * d, u * d, Math.sin(a) * r * d], i * 3)
      seeds[i] = rand()
      const big = rand() > 0.97
      sizes[i] = (big ? 3.2 : 0.9 + rand() * 1.4) * (radius / 380)
      const c = palette[Math.floor(rand() * palette.length)].clone().multiplyScalar(big ? 2.2 : 1.2)
      cols.set([c.r, c.g, c.b], i * 3)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(cols, 3))
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uScale: { value: 400 },
        uReveal: { value: 0 },
        uMap: { value: glowTexture() },
      },
      vertexShader: starVertex,
      fragmentShader: starFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    return { geometry, material }
  }, [count, radius])

  const lastView = useRef(null)
  useFrame((state, delta) => {
    const u = material.uniforms
    const view = useStore.getState().view
    if (view === 'epilogue' && lastView.current !== 'epilogue') u.uReveal.value = 0
    lastView.current = view
    u.uTime.value += delta * (reducedMotion ? 0.2 : 1)
    u.uReveal.value = Math.min(1, u.uReveal.value + delta * (reducedMotion ? 2 : view === 'epilogue' ? 0.22 : 0.35))
    updatePointScale(material, state)
    // follow the camera with a whisper of parallax from the pointer
    const p = useStore.getState().pointer
    ref.current.position.copy(state.camera.position)
    ref.current.rotation.y = THREE.MathUtils.damp(ref.current.rotation.y, reducedMotion ? 0 : p.x * 0.03, 2, delta)
    ref.current.rotation.x = THREE.MathUtils.damp(ref.current.rotation.x, reducedMotion ? 0 : -p.y * 0.02, 2, delta)
  })

  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} renderOrder={-10} />
}

export { updatePointScale }
