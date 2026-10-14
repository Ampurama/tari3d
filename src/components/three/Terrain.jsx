import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import {
  addCollider,
  MAIN_RADIUS,
  buildTerrainGeometry,
  outline,
  walkable,
  buildUndersideGeometry,
  edgeRadius,
  PATHS,
  seeded,
  standHeight,
  WATER_LEVEL,
  worldHeight,
  ZONES,
} from '../../lib/terrain'
import { player, walkTo } from '../../lib/player'
import { tier } from '../../lib/device'
import { placeNames } from '../../content/config'
import { useChapterUnlocked, useStore } from '../../store'
import { IslandBody } from './Island'
import { Glow } from './Bits'

/*
 * Ground detail: soft painted patches and fine grain on top of the zone colours, so the ground
 * reads as grass and soil (not flat paint) from the diorama camera. Pure shader, no texture download.
 */
const groundMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0 })
groundMaterial.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vGround;')
    .replace('#include <project_vertex>', '#include <project_vertex>\nvGround = (modelMatrix * vec4(transformed, 1.0)).xyz;')
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
      varying vec3 vGround;
      float gHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float gNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), u.x), mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), u.x), u.y);
      }`,
    )
    .replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      {
        vec2 q = vGround.xz;
        float patches = gNoise(q * 0.55) * 0.6 + gNoise(q * 1.7) * 0.4;
        float grain = gNoise(q * 9.0);
        float fleck = step(0.93, gHash(floor(q * 26.0)));
        diffuseColor.rgb *= 0.86 + patches * 0.22 + (grain - 0.5) * 0.08;
        diffuseColor.rgb += vec3(0.05, 0.06, 0.03) * fleck;
      }`,
    )
}
groundMaterial.customProgramCacheKey = () => 'island-ground'

/** Names of the places, written softly on the map (only while exploring). */
const PLACE_SPOTS = {
  meadow: [-2.4, 10.0, 0.2],
  garden: [-7.0, 5.2, 0.2],
  forest: [-8.4, -4.4, 0.2],
  lake: [5.0, -6.6, 0.2],
  cliff: [9.4, 0.4, 0.3],
  cove: [7.9, 9.4, 0.2],
  gallery: [-5.8, 9.9, 0.2],
  tree: [0, 0, 6.4],
}
export function PlaceNames() {
  const view = useStore((s) => s.view)
  const phase = useStore((s) => s.phase)
  if (phase !== 'world' || view !== 'explore') return null
  return Object.entries(PLACE_SPOTS).map(([id, [x, z, lift]]) =>
    placeNames[id] ? (
      <Html key={id} position={[x, standHeight(x, z) + lift, z]} center zIndexRange={[12, 0]} className="place-anchor">
        <span className={`place-name${id === 'tree' ? ' is-tree' : ''}`}>{placeNames[id]}</span>
      </Html>
    ) : null,
  )
}

/** The main island ground. Tapping it walks the avatar there. */
export function IslandGround() {
  const top = useMemo(() => buildTerrainGeometry(tier === 'high' ? { rows: 60, segments: 240 } : { rows: 42, segments: 160 }), [])
  const under = useMemo(() => buildUndersideGeometry({ segments: tier === 'high' ? 72 : 48 }), [])
  useEffect(
    () => () => {
      top.dispose()
      under.dispose()
    },
    [top, under],
  )
  return (
    <group>
      <mesh
        geometry={top}
        receiveShadow
        onClick={(e) => {
          const s = useStore.getState()
          if (s.view !== 'explore' || s.phase !== 'world' || e.delta > 8) return
          // tap-to-walk (drags orbit the camera instead)
          walkTo(e.point.x, e.point.z, 0.2)
          player.onArrive = null
        }}
      >
        <primitive object={groundMaterial} attach="material" />
      </mesh>
      <mesh geometry={under} castShadow>
        <meshStandardMaterial vertexColors roughness={0.75} metalness={0.05} flatShading />
      </mesh>
    </group>
  )
}

const waterVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`
const waterFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSky;
  uniform vec2 uCenter;
  uniform float uRadius;
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    float d = length(vWorld.xz - uCenter) / uRadius;
    // gentle moving ripples
    float r1 = sin(vWorld.x * 3.1 + uTime * 1.2) * sin(vWorld.z * 2.7 - uTime * 0.9);
    float r2 = sin((vWorld.x + vWorld.z) * 5.3 - uTime * 1.7);
    float ripple = r1 * 0.5 + r2 * 0.25;
    vec3 col = mix(uDeep, uShallow, smoothstep(0.35, 1.0, d));
    // soft sky reflection + glints
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - max(viewDir.y, 0.0), 3.0);
    col = mix(col, uSky, fres * 0.55 + ripple * 0.05);
    float glint = smoothstep(0.82, 1.0, ripple) * 0.6;
    col += vec3(1.0, 0.92, 0.98) * glint;
    float alpha = 0.82 + fres * 0.12;
    gl_FragColor = vec4(col, alpha);
  }
`

/** Reflection Lake: a calm, shimmering surface. */
export function Lake() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uDeep: { value: new THREE.Color('#2b2f6e') },
          uShallow: { value: new THREE.Color('#6f8fd0') },
          uSky: { value: new THREE.Color('#d7c4ff') },
          uCenter: { value: new THREE.Vector2(ZONES.lake.x, ZONES.lake.z) },
          uRadius: { value: 3.6 },
        },
        vertexShader: waterVertex,
        fragmentShader: waterFragment,
        transparent: true,
      }),
    [],
  )
  const reducedMotion = useStore((s) => s.reducedMotion)
  useFrame((_, delta) => {
    material.uniforms.uTime.value += delta * (reducedMotion ? 0.2 : 1)
  })
  return (
    <mesh position={[ZONES.lake.x, WATER_LEVEL, ZONES.lake.z]} rotation={[-Math.PI / 2, 0, 0]} material={material} renderOrder={1}>
      <circleGeometry args={[3.95, 64]} />
    </mesh>
  )
}

const fallVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const fallFragment = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    float streak = 0.6 + 0.4 * sin(vUv.x * 40.0 + sin(vUv.x * 7.0) * 2.0);
    float flow = fract(vUv.y * 3.0 - uTime * 0.8);
    float foam = smoothstep(0.0, 0.25, flow) * smoothstep(1.0, 0.6, flow);
    vec3 col = mix(vec3(0.62, 0.72, 1.0), vec3(1.0, 0.95, 1.0), foam * streak);
    float edge = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
    float fade = smoothstep(0.0, 0.25, vUv.y);
    gl_FragColor = vec4(col * 1.25, edge * fade * (0.45 + 0.4 * streak));
  }
`

/** A little stream from the lake to the island's edge, then a waterfall into the clouds. */
export function Waterfall() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: fallVertex,
        fragmentShader: fallFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  )
  const reducedMotion = useStore((s) => s.reducedMotion)
  useFrame((_, delta) => {
    material.uniforms.uTime.value += delta * (reducedMotion ? 0.15 : 1)
  })

  const { stream, fall, lip } = useMemo(() => {
    // stream: lake edge → coast, hugging the ground
    const dir = new THREE.Vector2(0.72, -0.69).normalize()
    const start = new THREE.Vector2(ZONES.lake.x + dir.x * 2.6, ZONES.lake.z + dir.y * 2.6)
    // runs until it reaches the coast, however big the island is
    const pts = []
    for (let i = 0; i <= 40; i++) {
      const x = start.x + dir.x * i * 0.2
      const z = start.y + dir.y * i * 0.2
      if (Math.hypot(x, z) > edgeRadius(x, z)) break
      pts.push(new THREE.Vector3(x, Math.max(WATER_LEVEL, worldHeight(x, z)) + 0.04, z))
    }
    const last = pts[pts.length - 1]
    const side = new THREE.Vector3(-dir.y, 0, dir.x)
    const ribbon = (points, width) => {
      const pos = []
      const uv = []
      const idx = []
      points.forEach((p, i) => {
        const w = width * (1 - i / points.length * 0.2)
        pos.push(p.x - side.x * w, p.y, p.z - side.z * w, p.x + side.x * w, p.y, p.z + side.z * w)
        uv.push(0, 1 - i / (points.length - 1), 1, 1 - i / (points.length - 1))
        if (i < points.length - 1) {
          const a = i * 2
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
        }
      })
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
      g.setIndex(idx)
      return g
    }
    const stream = ribbon(pts, 0.32)
    // falling sheet: curves outward and down past the rock underside
    const fallPts = []
    for (let i = 0; i <= 20; i++) {
      const t = i / 20
      fallPts.push(new THREE.Vector3(last.x + dir.x * (0.2 + t * 1.6), last.y - t * t * 9, last.z + dir.y * (0.2 + t * 1.6)))
    }
    const fall = ribbon(fallPts, 0.3)
    return { stream, fall, lip: fallPts[fallPts.length - 1] }
  }, [])

  return (
    <group>
      <mesh geometry={stream} material={material} renderOrder={2} />
      <mesh geometry={fall} material={material} renderOrder={2} />
      <Glow position={lip} color="#cfe0ff" size={5} opacity={0.35} />
    </group>
  )
}

/** Glowing stepping stones along the main paths. The cliff path lights up when Chapter 1 is done. */
export function LuminousPaths() {
  const ref = useRef()
  const chapter2 = useChapterUnlocked(1)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const stones = useMemo(() => {
    const list = []
    PATHS.forEach((pts, pathIndex) => {
      if (pathIndex === 5) return // the cove path stays a secret
      const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)))
      const n = Math.round(curve.getLength() / 0.7)
      for (let i = 0; i <= n; i++) {
        const p = curve.getPointAt(i / n)
        list.push({ x: p.x, z: p.z, y: standHeight(p.x, p.z) + 0.015, path: pathIndex, t: i / n, s: 0.08 + ((i * 7) % 5) * 0.01 })
      }
    })
    return list
  }, [])

  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    stones.forEach((s, i) => {
      m.compose(new THREE.Vector3(s.x, s.y, s.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, i * 1.7, 0)), new THREE.Vector3(s.s * 1.25, 0.03, s.s))
      ref.current.setMatrixAt(i, m)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [stones])

  const color = useMemo(() => new THREE.Color(), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    stones.forEach((s, i) => {
      // after Chapter 1 the path to Starfall Cliff glows and flows toward the telescope
      const lit = chapter2 && s.path === 4
      const wave = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(s.t * 9 - t * (lit ? 3 : 1.4) + s.path)
      const k = lit ? 1.6 + wave * 0.9 : 0.55 + 0.35 * wave
      color.setRGB(1.25 * k, 0.88 * k, 0.66 * k)
      ref.current.setColorAt(i, color)
    })
    ref.current.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[null, null, stones.length]} receiveShadow>
      <cylinderGeometry args={[1, 1, 1, 12]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}

/** Small floating islands far away — they make the world feel bigger than it is. */
export function DistantIslands() {
  const group = useRef()
  const reducedMotion = useStore((s) => s.reducedMotion)
  const islands = useMemo(() => {
    const rand = seeded(303)
    return Array.from({ length: tier === 'high' ? 7 : 4 }, (_, i) => {
      const a = (i / 7) * Math.PI * 2 + rand() * 0.5
      const r = 34 + rand() * 26
      return { position: [Math.cos(a) * r, -3 + rand() * 12, Math.sin(a) * r], radius: 1.2 + rand() * 2.2, seed: 20 + i }
    })
  }, [])
  useFrame(({ clock }) => {
    if (reducedMotion) return
    group.current.children.forEach((c, i) => {
      c.position.y = islands[i].position[1] + Math.sin(clock.elapsedTime * 0.25 + i) * 0.4
    })
  })
  return (
    <group ref={group}>
      {islands.map((isl, i) => (
        <group key={i} position={isl.position}>
          <IslandBody radius={isl.radius} seed={isl.seed} crystals={false} />
        </group>
      ))}
    </group>
  )
}

/** Warm lanterns along the island's paths — little lights that show the way at night. */
export function PathLanterns() {
  const posts = useRef()
  const lights = useRef()
  const reducedMotion = useStore((s) => s.reducedMotion)
  const items = useMemo(() => {
    const list = []
    PATHS.forEach((pts, pathIndex) => {
      if (pathIndex === 5) return // the cove path stays a secret
      const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)))
      const n = Math.max(1, Math.round(curve.getLength() / 2.4))
      for (let i = 0; i <= n; i++) {
        const t = Math.min(0.98, 0.04 + (i / n) * 0.94)
        const p = curve.getPointAt(t)
        const tan = curve.getTangentAt(t)
        const side = i % 2 ? 1 : -1
        const x = p.x - tan.z * 0.72 * side
        const z = p.z + tan.x * 0.72 * side
        if (!walkable(x, z) || list.some((l) => Math.hypot(l.x - x, l.z - z) < 1.4)) continue
        list.push({ x, z, y: standHeight(x, z), phase: list.length * 1.7 })
      }
    })
    list.forEach((l) => addCollider(l.x, l.z, 0.14))
    return list
  }, [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    items.forEach((l, i) => {
      m.makeTranslation(l.x, l.y + 0.45, l.z)
      posts.current.setMatrixAt(i, m)
      m.makeTranslation(l.x, l.y + 0.98, l.z)
      lights.current.setMatrixAt(i, m)
    })
    posts.current.instanceMatrix.needsUpdate = true
    lights.current.instanceMatrix.needsUpdate = true
  }, [items])
  const color = useMemo(() => new THREE.Color(), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    items.forEach((l, i) => {
      const k = reducedMotion ? 1 : 0.88 + 0.12 * Math.sin(t * 3 + l.phase) * Math.sin(t * 1.7 + l.phase * 0.5)
      lights.current.setColorAt(i, color.setRGB(2.8 * k, 1.9 * k, 1.05 * k))
    })
    lights.current.instanceColor.needsUpdate = true
  })
  return (
    <group>
      <instancedMesh ref={posts} args={[null, null, items.length]} castShadow>
        <cylinderGeometry args={[0.035, 0.05, 0.9, 6]} />
        <meshStandardMaterial color="#5c4a78" roughness={0.6} metalness={0.3} />
      </instancedMesh>
      <instancedMesh ref={lights} args={[null, null, items.length]}>
        <sphereGeometry args={[0.1, 12, 10]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

/** A thin ribbon of light running all around the island's shore. */
export function ShoreGlow() {
  const ref = useRef()
  const reducedMotion = useStore((s) => s.reducedMotion)
  const geometry = useMemo(() => {
    const pts = Array.from({ length: 220 }, (_, i) => {
      const a = (i / 220) * Math.PI * 2
      const r = MAIN_RADIUS * outline(a) * 0.975
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      return new THREE.Vector3(x, Math.max(WATER_LEVEL, worldHeight(x, z)) + 0.05, z)
    })
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 440, 0.035, 6, true)
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  useFrame(({ clock }) => {
    const k = reducedMotion ? 1 : 0.8 + 0.2 * Math.sin(clock.elapsedTime * 0.8)
    ref.current.material.color.setRGB(1.9 * k, 1.15 * k, 1.7 * k)
  })
  return (
    <mesh ref={ref} geometry={geometry}>
      <meshBasicMaterial toneMapped={false} transparent opacity={0.85} depthWrite={false} />
    </mesh>
  )
}
