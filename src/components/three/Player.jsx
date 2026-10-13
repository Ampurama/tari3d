import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { currentAvatar, useStore } from '../../store'
import { input, player, readMove } from '../../lib/player'
import { slope, standHeight, walkable } from '../../lib/terrain'
import { holdState, interactNearest, nearestInteractable } from '../../lib/interactions'
import { viewpointSpot } from '../../lib/layout'
import { viewpoint } from '../../content/config'
import { audio } from '../../audio/engine'
import Avatar from './Avatar'
import { Glow } from './Bits'

const WALK = 2.5
const RUN = 4.8
const tmpDir = new THREE.Vector3()
const follow = new THREE.Vector3()

/** Where the follow camera should look (just above the avatar's head). */
export const followTarget = () => follow.set(player.position.x, player.position.y + 0.95, player.position.z)

/** Try to move from (x, z) by (dx, dz); slides along obstacles. Returns the new [x, z] or null. */
function step(x, z, dx, dz) {
  const y = player.position.y
  const ok = (nx, nz) => {
    if (!walkable(nx, nz)) return false
    // cliff faces: can walk down, can't climb anything steep
    const rise = standHeight(nx, nz) - y
    return !(rise > 0.02 && slope(nx, nz) > 1.1)
  }
  if (ok(x + dx, z + dz)) return [x + dx, z + dz]
  if (ok(x + dx, z)) return [x + dx, z]
  if (ok(x, z + dz)) return [x, z + dz]
  return null
}

/**
 * The playable avatar: input → movement over the terrain, camera follow, interaction prompts.
 * Only drives anything while she's free-roaming on the island ('explore').
 */
export function PlayerController() {
  const controls = useThree((s) => s.controls)
  const camera = useThree((s) => s.camera)
  const lastPresses = useRef(input.interactPresses)
  const smoothFollow = useRef(new THREE.Vector3().copy(followTarget()))
  const wasExploring = useRef(false)
  const inViewpoint = useRef(false)

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const s = useStore.getState()
    const exploring = s.phase === 'world' && s.view === 'explore' && !s.curtain && !player.frozen
    if (!exploring) {
      wasExploring.current = false
      player.speed = THREE.MathUtils.damp(player.speed, 0, 8, delta)
      lastPresses.current = input.interactPresses
      if (s.prompt) s.setPrompt(null)
      return
    }
    if (!wasExploring.current) {
      smoothFollow.current.copy(followTarget())
      wasExploring.current = true
    }

    // ── movement intent: keyboard / joystick, or tap-to-walk
    const move = readMove()
    let dirX = 0
    let dirZ = 0
    let targetSpeed = 0
    if (move.mag > 0.05) {
      player.walkTarget = null
      player.onArrive = null
      camera.getWorldDirection(tmpDir)
      const fl = Math.hypot(tmpDir.x, tmpDir.z) || 1
      const fx = tmpDir.x / fl
      const fz = tmpDir.z / fl
      // right = (-fz, fx)
      dirX = fx * move.y - fz * move.x
      dirZ = fz * move.y + fx * move.x
      const l = Math.hypot(dirX, dirZ) || 1
      dirX /= l
      dirZ /= l
      targetSpeed = (move.run ? RUN : WALK) * Math.max(0.35, move.mag)
    } else if (player.walkTarget) {
      const wt = player.walkTarget
      const dx = wt.x - player.position.x
      const dz = wt.z - player.position.z
      const d = Math.hypot(dx, dz)
      if (d <= (wt.stopAt ?? 0.25)) {
        const arrive = player.onArrive
        player.walkTarget = null
        player.onArrive = null
        arrive?.()
      } else {
        dirX = dx / d
        dirZ = dz / d
        targetSpeed = d > 6 ? RUN : WALK
      }
    }

    player.speed = THREE.MathUtils.damp(player.speed, targetSpeed, targetSpeed > player.speed ? 7 : 10, delta)
    if (player.speed > 0.01 && (dirX || dirZ)) {
      const next = step(player.position.x, player.position.z, dirX * player.speed * delta, dirZ * player.speed * delta)
      if (next) {
        player.position.x = next[0]
        player.position.z = next[1]
      } else {
        // blocked: stop trying to walk somewhere unreachable
        if (player.walkTarget) {
          player.walkTarget = null
          player.onArrive = null
        }
        player.speed = 0
      }
      const targetYaw = Math.atan2(dirX, dirZ)
      let dy = targetYaw - player.yaw
      dy = Math.atan2(Math.sin(dy), Math.cos(dy))
      player.yaw += dy * Math.min(1, delta * 12)
    }
    player.position.y = THREE.MathUtils.damp(player.position.y, standHeight(player.position.x, player.position.z), 18, delta)
    player.cheer = Math.max(0, player.cheer - delta)

    // ── camera follows (the camera-controls orbit stays hers to change)
    smoothFollow.current.lerp(followTarget(), 1 - Math.exp(-delta * 8))
    const f = smoothFollow.current
    controls?.moveTo(f.x, f.y, f.z, false)

    // ── interaction prompt + the interact key/button
    const near = nearestInteractable()
    const hold = near ? near.it.hold : 0
    // "hold to…" interactions fill up while the key/button is held, and reset when let go
    if (near && hold > 0 && input.interactHeld) {
      if (holdState.id !== near.id) {
        holdState.id = near.id
        holdState.t = 0
      }
      holdState.need = hold
      holdState.t += delta
      if (holdState.t >= hold) {
        holdState.t = 0
        holdState.id = null
        input.interactHeld = false
        near.it.onInteract()
        audio.sparkle()
      }
    } else if (holdState.t > 0) {
      holdState.t = Math.max(0, holdState.t - delta * 2)
      if (holdState.t === 0) holdState.id = null
    }
    s.setPrompt(near ? { id: near.id, label: near.it.label, hold } : null)
    if (input.interactPresses !== lastPresses.current) {
      lastPresses.current = input.interactPresses
      if (interactNearest()) audio.sparkle()
    }

    // ── Starfall Cliff: the first time she reaches the viewpoint, the view opens up
    const inView = Math.hypot(player.position.x - viewpointSpot.x, player.position.z - viewpointSpot.z) < viewpointSpot.r
    if (inView && !inViewpoint.current && !s.viewpointSeen) {
      s.markViewpoint()
      s.showDiscovery({ kind: 'view', title: viewpoint.title, text: viewpoint.text }, 6000)
      controls?.dollyTo(12, true)
      controls?.rotatePolarTo(1.15, true)
    }
    inViewpoint.current = inView
  })
  return null
}

/** The avatar the player controls, plus what she's carrying (a seed, a little water). */
export function PlayerAvatar() {
  const group = useRef()
  const carry = useRef()
  const marker = useRef()
  const avatar = useStore(currentAvatar)
  const phase = useStore((s) => s.phase)
  const carrying = useStore((s) => s.carrying)
  const hasWater = useStore((s) => s.hasWater)
  const reducedMotion = useStore((s) => s.reducedMotion)

  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return // not mounted until she's in the world
    g.position.copy(player.position)
    g.rotation.y = player.yaw
    if (carry.current) carry.current.position.y = 1.55 + (reducedMotion ? 0 : Math.sin(clock.elapsedTime * 2.4) * 0.06)
    if (marker.current) {
      const wt = player.walkTarget
      marker.current.visible = Boolean(wt)
      if (wt) marker.current.position.set(wt.x, standHeight(wt.x, wt.z) + 0.03, wt.z)
    }
  })

  if (phase !== 'world') return null
  return (
    <>
      <group ref={group}>
        <Avatar config={avatar} getMotion={() => ({ speed: player.speed, cheer: player.cheer })} />
        {(carrying || hasWater) && (
          <group ref={carry} position={[0, 1.55, 0]}>
            <mesh>
              <sphereGeometry args={[0.09, 16, 12]} />
              <meshBasicMaterial color={carrying ? [2.6, 2.2, 1.2] : [1.0, 1.8, 2.8]} toneMapped={false} />
            </mesh>
            <Glow color={carrying ? '#ffe2a8' : '#a8d8ff'} size={0.7} opacity={0.75} />
          </group>
        )}
      </group>
      {/* where tap-to-walk is heading */}
      <mesh ref={marker} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.18, 0.26, 24]} />
        <meshBasicMaterial color={[2.2, 1.4, 1.8]} transparent opacity={0.8} toneMapped={false} depthWrite={false} />
      </mesh>
    </>
  )
}
