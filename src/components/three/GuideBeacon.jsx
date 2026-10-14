import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { nextGoal } from '../../lib/guide'
import { interactables } from '../../lib/interactions'
import { player } from '../../lib/player'
import { standHeight } from '../../lib/terrain'
import { useStore } from '../../store'
import { Glow } from './Bits'

const DOTS = 28
const SPACING = 0.75
const tmp = new THREE.Object3D()

/**
 * The 💡 hint guide in the world: a tall soft beam of light over the next goal, a little arrow
 * bobbing above it, and a trail of glowing dots running from the avatar toward it.
 * Only while the guide is on and she's exploring the island.
 */
export default function GuideBeacon() {
  const on = useStore((s) => s.guide && s.phase === 'world' && s.view === 'explore')
  const reducedMotion = useStore((s) => s.reducedMotion)
  const beacon = useRef()
  const beam = useRef()
  const arrow = useRef()
  const dots = useRef()
  const target = useRef(null)
  const lastCheck = useRef(-1)
  const dotMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.6, 2.2), transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false }),
    [],
  )

  useFrame(({ clock }) => {
    if (!on || !beacon.current) return
    const t = clock.elapsedTime
    // what to point at (re-checked a few times a second; follows her progress)
    if (t - lastCheck.current > 0.4) {
      lastCheck.current = t
      const goal = nextGoal(useStore.getState())
      const it = goal?.target && interactables.get(goal.target)
      target.current = it && it.enabled() ? it.position : null
    }
    const p = target.current
    beacon.current.visible = Boolean(p)
    dots.current.visible = Boolean(p)
    if (!p) return
    const ground = standHeight(p.x, p.z)
    beacon.current.position.set(p.x, ground, p.z)
    beam.current.material.opacity = reducedMotion ? 0.32 : 0.26 + Math.sin(t * 2.2) * 0.08
    arrow.current.position.y = 2.7 + (reducedMotion ? 0 : Math.abs(Math.sin(t * 2.6)) * 0.35)
    arrow.current.rotation.y = t * 1.2

    // the trail: dots flowing from her feet toward the goal
    const dx = p.x - player.position.x
    const dz = p.z - player.position.z
    const len = Math.hypot(dx, dz)
    const flow = reducedMotion ? 0 : (t * 1.4) % SPACING
    for (let i = 0; i < DOTS; i++) {
      const d = 0.7 + i * SPACING + flow
      if (d > len - 0.6) {
        tmp.scale.setScalar(0.0001)
      } else {
        const x = player.position.x + (dx / len) * d
        const z = player.position.z + (dz / len) * d
        tmp.position.set(x, standHeight(x, z) + 0.1, z)
        // fade the dots in near her and out near the goal
        tmp.scale.setScalar(0.075 * Math.min(1, (d - 0.5) / 1.2, (len - d) / 1.2 + 0.2))
      }
      tmp.updateMatrix()
      dots.current.setMatrixAt(i, tmp.matrix)
    }
    dots.current.instanceMatrix.needsUpdate = true
  })

  if (!on) return null
  return (
    <>
      <group ref={beacon}>
        <mesh ref={beam} position={[0, 4.5, 0]} renderOrder={4}>
          <cylinderGeometry args={[0.16, 0.42, 9, 20, 1, true]} />
          <meshBasicMaterial color={[2.4, 1.5, 2.1]} transparent opacity={0.3} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
        </mesh>
        <mesh ref={arrow} rotation={[Math.PI, 0, 0]} renderOrder={4}>
          <coneGeometry args={[0.22, 0.42, 4]} />
          <meshBasicMaterial color={[2.8, 1.8, 2.4]} toneMapped={false} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} renderOrder={4}>
          <ringGeometry args={[0.7, 0.86, 40]} />
          <meshBasicMaterial color={[2.4, 1.5, 2.1]} transparent opacity={0.8} toneMapped={false} depthWrite={false} />
        </mesh>
        <Glow position={[0, 0.5, 0]} color="#ffb6d9" size={3} opacity={0.6} />
      </group>
      <instancedMesh ref={dots} args={[null, dotMat, DOTS]} frustumCulled={false} renderOrder={4}>
        <sphereGeometry args={[1, 10, 8]} />
      </instancedMesh>
    </>
  )
}
