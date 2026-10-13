import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { memoryLane } from '../../content/config'
import { laneCurve, lanePoints } from '../../lib/layout'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'
import { Glow, Interactive } from './Bits'

const WARM = new THREE.Color('#ffd9a0')
const PINK = new THREE.Color('#ffb3d6')

/** A paper lantern floating above a tiny island stone. */
function Lantern({ index, position, milestone }) {
  const group = useRef()
  const body = useRef()
  const halo = useRef()
  const view = useStore((s) => s.view)
  const laneIndex = useStore((s) => s.laneIndex)
  const openLane = useStore((s) => s.openLane)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const current = view === 'lane' && laneIndex === index
  const color = index % 2 ? PINK : WARM

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime + index * 0.9
    group.current.position.y = reducedMotion ? 0 : Math.sin(t * 0.8) * 0.1
    group.current.rotation.y = reducedMotion ? 0 : Math.sin(t * 0.4) * 0.25
    const target = current ? 1.35 : view === 'lane' ? 0.75 : 1
    const s = THREE.MathUtils.damp(group.current.scale.x, target, 3, delta)
    group.current.scale.setScalar(s)
    body.current.material.emissiveIntensity = THREE.MathUtils.damp(body.current.material.emissiveIntensity, current ? 2.4 : 1.2, 3, delta)
    halo.current.material.opacity = THREE.MathUtils.damp(halo.current.material.opacity, current ? 0.75 : 0.4, 3, delta)
  })

  return (
    <group position={position}>
      {/* stepping-stone island */}
      <mesh position={[0, -0.32, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.42, 0.16, 0.34, 9]} />
        <meshStandardMaterial color="#8f7bc8" roughness={0.75} flatShading />
      </mesh>
      <mesh position={[0, -0.14, 0]} receiveShadow>
        <cylinderGeometry args={[0.43, 0.43, 0.05, 18]} />
        <meshStandardMaterial color="#9fc9b2" roughness={0.9} />
      </mesh>
      <Interactive
        label={index === 0 ? memoryLane.title : null}
        hint={index === 0}
        onSelect={() => {
          audio.sparkle()
          openLane(index)
        }}
        sparkleOffset={[0, 1.05, 0]}
        sparkleColor="#ffd9a0"
        active={view === 'explore' || view === 'lane'}
        hideBehind={false}
      >
        <group ref={group}>
          <mesh ref={body} position={[0, 0.42, 0]} castShadow>
            <cylinderGeometry args={[0.17, 0.2, 0.36, 16, 1, true]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={1.2}
              roughness={0.6}
              side={THREE.DoubleSide}
              transparent
              opacity={0.95}
            />
          </mesh>
          {[0.23, 0.61].map((y) => (
            <mesh key={y} position={[0, y, 0]}>
              <cylinderGeometry args={[0.13, 0.13, 0.035, 14]} />
              <meshStandardMaterial color="#6f5a99" roughness={0.5} metalness={0.3} />
            </mesh>
          ))}
          <mesh position={[0, 0.42, 0]}>
            <sphereGeometry args={[0.07, 12, 10]} />
            <meshBasicMaterial color={color.clone().multiplyScalar(3)} toneMapped={false} />
          </mesh>
          <Glow ref={halo} position={[0, 0.42, 0]} color={`#${color.getHexString()}`} size={1.5} opacity={0.4} />
          {/* bigger, invisible tap target */}
          <mesh position={[0, 0.3, 0]}>
            <sphereGeometry args={[0.5, 10, 8]} />
            <meshBasicMaterial colorWrite={false} depthWrite={false} />
          </mesh>
        </group>
      </Interactive>
      {view === 'lane' && (
        <Html center position={[0, 1.15, 0]} zIndexRange={[20, 0]}>
          <button
            type="button"
            className={`lane-tag${current ? ' is-current' : ''}`}
            onClick={() => openLane(index)}
            aria-label={`${milestone.date}: ${milestone.title}`}
          >
            {milestone.date}
          </button>
        </Html>
      )}
    </group>
  )
}

/** Floating stepping stones + a thin ribbon of light connecting the lanterns. */
function LanePath() {
  const stones = useRef()
  const points = useMemo(() => {
    const length = laneCurve.getLength()
    const n = Math.floor(length / 0.85)
    const list = []
    for (let i = 1; i < n; i++) {
      const t = i / n
      const p = laneCurve.getPointAt(t)
      // leave room around each lantern
      if (lanePoints.some((lp) => lp.distanceTo(p) < 0.75)) continue
      list.push({ p, s: 0.09 + ((i * 7) % 4) * 0.02, r: i * 1.3 })
    }
    return list
  }, [])

  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    points.forEach(({ p, s, r }, i) => {
      q.setFromEuler(new THREE.Euler(0, r, 0))
      m.compose(new THREE.Vector3(p.x, p.y - 0.18, p.z), q, new THREE.Vector3(s * 1.3, 0.05, s))
      stones.current.setMatrixAt(i, m)
    })
    stones.current.instanceMatrix.needsUpdate = true
  }, [points])

  const ribbon = useMemo(() => new THREE.TubeGeometry(laneCurve, 160, 0.018, 6, false), [])

  return (
    <group>
      <instancedMesh ref={stones} args={[null, null, points.length]}>
        <cylinderGeometry args={[1, 1, 1, 10]} />
        <meshBasicMaterial color={[1.25, 0.95, 0.75]} toneMapped={false} />
      </instancedMesh>
      <mesh geometry={ribbon} position={[0, -0.1, 0]}>
        <meshBasicMaterial color={[1.3, 0.75, 1.1]} transparent opacity={0.45} toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  )
}

/** MEMORY LANE — lanterns drifting out from the island, one for each milestone of our story. */
export default function MemoryLane() {
  const view = useStore((s) => s.view)
  if (!lanePoints.length) return null
  return (
    <group visible={view !== 'finale' && view !== 'finalRoom'}>
      <LanePath />
      {memoryLane.milestones.map((m, i) => (
        <Lantern key={i} index={i} position={lanePoints[i]} milestone={m} />
      ))}
    </group>
  )
}
