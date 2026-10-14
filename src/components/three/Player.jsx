import { useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { currentAvatar, useStore } from '../../store'
import { input, player, readMove } from '../../lib/player'
import { eastBridgeAt, groundAt, HOME_ISLAND, inSkyArea, SKY, SKY_BRIDGE, skyDistance, slope, solidAt, standHeight, walkable } from '../../lib/terrain'
import { holdState, interactables, interactNearest, nearestInteractable } from '../../lib/interactions'
import { ISO, polarFor, rig } from '../../lib/iso'
import { viewpointSpot } from '../../lib/layout'
import { holdSeat, standUp } from '../../lib/actions'
import { followBlocked, handFollow, holding, myHand, releaseHand } from '../../lib/hand'
import { respawnPoint } from '../../lib/sky'
import { viewpoint } from '../../content/config'
import { audio } from '../../audio/engine'
import Avatar from './Avatar'
import { Glow, HeartMesh } from './Bits'
import EmoteFx from './EmoteFx'

/** The silhouette: additive, drawn in the opaque pass, only where it's behind something. */
const GHOST = new THREE.MeshBasicMaterial({
  color: new THREE.Color(0.55, 0.32, 0.5),
  transparent: false,
  blending: THREE.AdditiveBlending,
  depthFunc: THREE.GreaterDepth,
  depthWrite: false,
  toneMapped: false,
})

const WALK = 2.5
const RUN = 4.8
const tmpDir = new THREE.Vector3()
const follow = new THREE.Vector3()

/** The middle of the island diorama (slightly south, so the far shore isn't cut). */
const MAIN_CENTER = new THREE.Vector3(0, 0.4, 0.8)
/** The middle of the home island, the same way. */
const HOME_CENTER = new THREE.Vector3(HOME_ISLAND.x, HOME_ISLAND.level + 0.4, HOME_ISLAND.z + 0.8)
/** …and of Sky Island. */
const SKY_CENTER = new THREE.Vector3(SKY.x + 1.5, SKY.level + 0.4, SKY.z + 2)
const center = new THREE.Vector3()
/** The diorama is whichever island she's on (blending across the bridges). */
const islandCenter = () => {
  const { x, z } = player.position
  if (skyDistance(x, z) < 1.6) return center.copy(SKY_CENTER)
  const e = eastBridgeAt(x, z)
  if (e.t > 0 && e.t < 1 && e.off < 3) return center.lerpVectors(MAIN_CENTER, SKY_CENTER, THREE.MathUtils.smoothstep(e.t, 0.15, 0.85))
  return center.lerpVectors(MAIN_CENTER, HOME_CENTER, THREE.MathUtils.smoothstep(-z, -SKY_BRIDGE.z0, -SKY_BRIDGE.z1))
}

/** Jumping (only on Sky Island and its clouds): about a metre high, three and a half metres at a run. */
const JUMP_SPEED = 5.6
const GRAVITY = 15

/** Moving through the air: only solid things (trees, walls) stop her; the edge doesn't. */
function stepAir(x, z, dx, dz) {
  const y = player.position.y
  const ok = (nx, nz) => {
    if (solidAt(nx, nz)) return false
    const g = groundAt(nx, nz)
    return g === null || g <= y + 0.25 // can't fly into the side of something higher
  }
  if (ok(x + dx, z + dz)) return [x + dx, z + dz]
  if (ok(x + dx, z)) return [x + dx, z]
  if (ok(x, z + dz)) return [x, z + dz]
  return null
}

/** A fall into the clouds: back to the checkpoint (in Cloud Hop) or the last safe ground. */
function recover() {
  const p = respawnPoint()
  player.position.set(p.x, p.y ?? standHeight(p.x, p.z), p.z)
  player.vy = 0
  player.air = false
  player.speed = 0
  player.walkTarget = null
  player.onArrive = null
  useStore.getState().showToast('Hampir jatuh! Kembali ke tempat aman ✦', 2600)
}

/**
 * Where the camera looks: between the island's centre and the avatar.
 * `weight` 1 = right on her; the fully zoomed-out diorama view uses ISO.follow.
 */
export const followTarget = (weight = 1) => {
  const c = islandCenter()
  return follow.set(player.position.x, player.position.y + 0.6, player.position.z).sub(c).multiplyScalar(weight).add(c)
}

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
  const lastJump = useRef(input.jumpPresses)
  const smoothFollow = useRef(new THREE.Vector3().copy(followTarget(ISO.follow)))
  const wasExploring = useRef(false)
  const inViewpoint = useRef(false)
  const stepTimer = useRef(0)
  const stepCount = useRef(0)

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const s = useStore.getState()
    // a panel or a dialog on screen has her attention: the avatar waits
    const exploring = s.phase === 'world' && s.view === 'explore' && !s.curtain && !player.frozen && !s.panel && !s.dialog
    if (!exploring) {
      // leaving the island for a story moment: stand up first
      if (player.seat && s.view !== 'explore') standUp()
      // a menu opened mid-jump: come down where she is (or back to safety over the clouds)
      if (player.air) {
        const g = groundAt(player.position.x, player.position.z)
        if (g !== null) {
          player.position.y = g
          player.air = false
          player.vy = 0
        } else recover()
      }
      lastJump.current = input.jumpPresses
      wasExploring.current = false
      player.speed = THREE.MathUtils.damp(player.speed, 0, 8, delta)
      lastPresses.current = input.interactPresses
      if (s.prompt) s.setPrompt(null)
      return
    }
    // the closer she zooms in, the more tightly the camera follows the avatar
    const zoom = controls ? THREE.MathUtils.clamp((controls.distance - rig.minDist) / Math.max(1, rig.baseDist - rig.minDist), 0, 1) : 1
    const weight = THREE.MathUtils.lerp(1, ISO.follow, zoom)
    if (!wasExploring.current) {
      smoothFollow.current.copy(followTarget(weight))
      wasExploring.current = true
    }

    // ── movement intent: keyboard / joystick, or tap-to-walk
    const move = readMove()
    // sitting: any move (keys, joystick, a tap somewhere) gets her up again
    if (player.seat && (move.mag > 0.05 || player.walkTarget)) standUp()
    // holding hands and following: walk beside the leader (her own keys wait; "Lepas Gandengan" lets go)
    const lead = handFollow()
    let leadDist = 0
    let dirX = 0
    let dirZ = 0
    let targetSpeed = 0
    if (lead) {
      player.walkTarget = null
      player.onArrive = null
      const dx = lead.x - player.position.x
      const dz = lead.z - player.position.z
      leadDist = Math.hypot(dx, dz)
      if (leadDist > 0.06) {
        dirX = dx / leadDist
        dirZ = dz / leadDist
        targetSpeed = Math.min(RUN * 1.25, lead.speed + leadDist * 3.2)
      }
    } else if (move.mag > 0.05) {
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
      // follow the path's waypoints; the last one is the target (or as close as she can stand)
      const path = wt.path || [[wt.x, wt.z]]
      while (path.length > 1 && Math.hypot(path[0][0] - player.position.x, path[0][1] - player.position.z) < 0.3) path.shift()
      const dx = path[0][0] - player.position.x
      const dz = path[0][1] - player.position.z
      const d = Math.hypot(dx, dz)
      const toTarget = Math.hypot(wt.x - player.position.x, wt.z - player.position.z)
      if (toTarget <= (wt.stopAt ?? 0.25) || (path.length === 1 && d < 0.12)) {
        const arrive = player.onArrive
        player.walkTarget = null
        player.onArrive = null
        arrive?.()
      } else {
        dirX = dx / d
        dirZ = dz / d
        targetSpeed = toTarget > 6 ? RUN : WALK
      }
    }

    // jump (Space / "Lompat"), only up on Sky Island
    if (input.jumpPresses !== lastJump.current) {
      lastJump.current = input.jumpPresses
      if (!player.air && !player.seat && !lead && inSkyArea(player.position.x, player.position.z)) {
        if (holding()) releaseHand('self')
        player.air = true
        player.vy = JUMP_SPEED
        player.walkTarget = null
        player.onArrive = null
        audio.sfx('boing', 1)
      }
    }
    player.speed = THREE.MathUtils.damp(player.speed, targetSpeed, targetSpeed > player.speed ? 7 : 10, delta)
    // never overshoot the place beside the leader (no jitter back and forth)
    if (lead) player.speed = Math.min(player.speed, leadDist / Math.max(delta, 1e-3))
    if (player.speed > 0.01 && (dirX || dirZ)) {
      const next = (player.air ? stepAir : step)(player.position.x, player.position.z, dirX * player.speed * delta, dirZ * player.speed * delta)
      if (lead) followBlocked(delta, !next && leadDist > 0.8)
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
    // beside the leader: look the same way they do
    if (lead && leadDist < 0.4) {
      let dy = lead.yaw - player.yaw
      dy = Math.atan2(Math.sin(dy), Math.cos(dy))
      player.yaw += dy * Math.min(1, delta * 8)
    }
    if (player.seat) holdSeat()
    else if (player.air) {
      player.vy -= GRAVITY * delta
      player.position.y += player.vy * delta
      const g = groundAt(player.position.x, player.position.z)
      if (g !== null && player.vy <= 0 && player.position.y <= g) {
        player.position.y = g
        player.air = false
        player.vy = 0
      } else if (player.position.y < SKY.level - 4.5) recover()
    } else {
      player.position.y = THREE.MathUtils.damp(player.position.y, standHeight(player.position.x, player.position.z), 18, delta)
      // remember the last safe ground (for coming back after a fall)
      if (walkable(player.position.x, player.position.z)) {
        player.safe.x = player.position.x
        player.safe.z = player.position.z
      }
    }
    // soft footsteps
    if (player.speed > 0.6) {
      stepTimer.current -= delta
      if (stepTimer.current <= 0) {
        stepTimer.current = player.speed > 3.5 ? 0.27 : 0.38
        audio.sfx('step', ++stepCount.current)
      }
    } else stepTimer.current = 0
    player.cheer = Math.max(0, player.cheer - delta)

    // ── left alone for a while, the island slowly turns by itself (any touch stops it)
    if (move.mag > 0.05 || player.walkTarget) input.lastActive = performance.now()
    if (controls && !s.reducedMotion && performance.now() - input.lastActive > ISO.idleSpin * 1000) controls.rotate(delta * 0.07, 0, false)

    // ── camera follows (the camera-controls orbit stays hers to change)
    smoothFollow.current.lerp(followTarget(weight), 1 - Math.exp(-delta * 4))
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
      // the view opens up a little: further back and lower, still the same 2.5D angle
      if (controls) {
        controls.smoothTime = 1.6
        controls.dollyTo(Math.min(rig.baseDist, controls.distance * 1.3), true)
        controls.rotatePolarTo(polarFor(24), true)
      }
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
  const ghost = useRef()
  const focus = useRef()
  const beacon = useRef()
  const beaconHeart = useRef()
  const camera = useThree((s) => s.camera)
  const avatar = useStore(currentAvatar)
  const phase = useStore((s) => s.phase)
  const carrying = useStore((s) => s.carrying)
  const hasWater = useStore((s) => s.hasWater)
  const reducedMotion = useStore((s) => s.reducedMotion)

  // the avatar draws after the scenery, so the silhouette below only shows where something hides her
  useLayoutEffect(() => {
    group.current?.traverse((o) => {
      if (o.isMesh) o.renderOrder = 6
    })
  })

  useFrame(({ clock }, delta) => {
    const g = group.current
    if (!g) return // not mounted until she's in the world
    g.position.copy(player.position)
    g.rotation.y = player.yaw
    const t = clock.elapsedTime
    ghost.current.position.copy(player.position)
    GHOST.opacity = reducedMotion ? 0.5 : 0.42 + Math.sin(t * 3) * 0.08
    // a soft ring and a little diamond over whatever she can use right now
    const prompt = useStore.getState().prompt
    const it = prompt && interactables.get(prompt.id)
    const f = focus.current
    f.visible = Boolean(it)
    if (it) {
      const p = it.position
      f.position.set(p.x, standHeight(p.x, p.z) + 0.04, p.z)
      const pulse = reducedMotion ? 1 : 1 + Math.sin(t * 3.2) * 0.08
      f.children[0].scale.setScalar(THREE.MathUtils.damp(f.children[0].scale.x, pulse, 8, delta))
      f.children[1].position.y = 1.9 + (reducedMotion ? 0 : Math.sin(t * 2.4) * 0.08)
      f.children[1].rotation.y = t * 1.5
    }
    // from far away (the diorama view) a little heart floats over her head and a soft ring sits at her feet
    const far = THREE.MathUtils.clamp((camera.position.distanceTo(player.position) - 45) / 60, 0, 1)
    const b = beacon.current
    b.position.copy(player.position)
    b.children[0].material.opacity = 0.35 + far * 0.4
    b.children[0].scale.setScalar(1 + far * 0.6)
    const h = beaconHeart.current
    h.visible = far > 0.05
    h.scale.setScalar(0.16 + far * 0.2)
    h.position.y = 1.75 + far * 0.5 + (reducedMotion ? 0 : Math.sin(t * 2.2) * 0.08)
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
        <Avatar config={avatar} getMotion={() => ({ speed: player.speed, cheer: player.cheer, sit: Boolean(player.seat), emote: player.emote, hand: myHand() })} />
        <EmoteFx get={() => player.emote} />
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
      {/* her silhouette, visible only where scenery hides her (depth test reversed, drawn before the avatar) */}
      <group ref={ghost}>
        <mesh position={[0, 0.72, 0]} renderOrder={5} material={GHOST}>
          <capsuleGeometry args={[0.21, 0.4, 4, 12]} />
        </mesh>
        <mesh position={[0, 1.08, 0]} renderOrder={5} material={GHOST}>
          <sphereGeometry args={[0.3, 16, 12]} />
        </mesh>
      </group>
      {/* where she is, even from far away */}
      <group ref={beacon}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} renderOrder={3}>
          <ringGeometry args={[0.32, 0.46, 32]} />
          <meshBasicMaterial color={[2.4, 1.3, 1.9]} transparent opacity={0.4} toneMapped={false} depthWrite={false} />
        </mesh>
        <HeartMesh ref={beaconHeart} position={[0, 2, 0]} scale={0.2} color="#ff9cc8" emissive="#ff5fa2" glow={1.2} />
      </group>
      {/* what she can interact with right now */}
      <group ref={focus} visible={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
          <ringGeometry args={[0.55, 0.66, 40]} />
          <meshBasicMaterial color={[2.2, 1.5, 1.9]} transparent opacity={0.75} toneMapped={false} depthWrite={false} />
        </mesh>
        <mesh scale={[0.09, 0.14, 0.09]}>
          <octahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={[2.6, 1.9, 2.3]} toneMapped={false} />
        </mesh>
      </group>
      {/* where tap-to-walk is heading */}
      <mesh ref={marker} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.18, 0.26, 24]} />
        <meshBasicMaterial color={[2.2, 1.4, 1.8]} transparent opacity={0.8} toneMapped={false} depthWrite={false} />
      </mesh>
    </>
  )
}
