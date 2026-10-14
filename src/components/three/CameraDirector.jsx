import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CameraControls, CameraControlsImpl } from '@react-three/drei'
import * as THREE from 'three'
import { areas, framePose, futurePose, lanePose, loveTree, poses, resolvePose } from '../../lib/layout'
import { cine, CINE, CINE_LENGTH, cinematicCamera } from '../../lib/cinematic'
import { player } from '../../lib/player'
import { standHeight } from '../../lib/terrain'
import { connections } from '../../content/config'
import { isTouch } from '../../lib/device'
import { fovFor, ISO, isoBack, isoDir, isoRight, polarFor, rig } from '../../lib/iso'
import { useStore } from '../../store'
import { followTarget } from './Player'

const { ACTION } = CameraControlsImpl

function unlock(c) {
  c.minDistance = 0.1
  c.maxDistance = Infinity
  c.minPolarAngle = 0
  c.maxPolarAngle = Math.PI
  c.minAzimuthAngle = -Infinity
  c.maxAzimuthAngle = Infinity
}

const v = (x, y, z) => new THREE.Vector3(x, y, z)
const pose = (target, dir, fitW, fitH, minDist) => ({ target, dir: dir.normalize(), fitW, fitH, minDist })

/**
 * The island camera: the whole island in one frame (on a phone in portrait: most of its width),
 * leaning a little toward the avatar.
 */
const followPose = (aspect = 1.6) =>
  aspect < 0.8 ? pose(followTarget(ISO.follow).clone(), isoDir(), 19, 24, 0) : pose(followTarget(ISO.follow).clone(), isoDir(), 33, 24, 0)

/** Once the bridge is whole, Chapter 2 is seen from further back. */
const distanceWide = pose(areas.distance.clone().add(v(0, 1.6, 0)), isoDir(30), 30, 12, 0)

/**
 * One place that decides where the camera is. Every view has a pose; transitions are smooth,
 * the avatar is followed while exploring, and the final cinematic is scripted frame by frame.
 */
export default function CameraDirector() {
  const ref = useRef()
  const prevView = useRef('intro')
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const view = useStore((s) => s.view)
  const selected = useStore((s) => s.selectedMemory)
  const camNonce = useStore((s) => s.camNonce)
  const laneIndex = useStore((s) => s.laneIndex)
  const riseCue = useStore((s) => s.riseCue)
  const futureIndex = useStore((s) => s.futureIndex)
  const secretStage = useStore((s) => s.secretStage)
  const bridgeWhole = useStore((s) => s.connectionsDone.length >= connections.length)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const cineDone = useRef(false)

  const poseFor = (vw) => {
    if (vw === 'memories') return selected === null ? poses.memories : framePose(selected)
    if (vw === 'lane') return lanePose(laneIndex)
    if (vw === 'future') return futurePose(futureIndex)
    if (vw === 'finalRoom' && secretStage && secretStage !== 'found') return poses.secretClose
    if (vw === 'distance' && bridgeWhole) return distanceWide
    if (vw === 'explore') return followPose(size.width / size.height)
    return poses[vw]
  }

  /** the lens this view is seen through */
  const lens = () => fovFor(useStore.getState().view)
  const fly = (p, smooth = true) => {
    const { position, target, dist } = resolvePose(p, lens(), size.width / size.height)
    ref.current.setLookAt(position.x, position.y, position.z, target.x, target.y, target.z, smooth)
    return dist
  }

  /** While exploring: spin all the way round, tilt (never under the ground) and zoom. */
  const exploreLimits = (dist) => {
    const c = ref.current
    c.normalizeRotations()
    rig.baseDist = dist
    rig.minDist = Math.max(5.5, dist * ISO.zoomIn)
    c.minDistance = rig.minDist
    c.maxDistance = dist * 1.3
    c.minPolarAngle = polarFor(ISO.maxElevation)
    c.maxPolarAngle = polarFor(ISO.minElevation)
    c.minAzimuthAngle = -Infinity
    c.maxAzimuthAngle = Infinity
  }

  // configure input once
  useEffect(() => {
    const c = ref.current
    // drag turns the island around (a click / tap without dragging still walks), wheel / pinch zooms
    c.mouseButtons.left = ACTION.ROTATE
    c.mouseButtons.right = ACTION.NONE
    c.mouseButtons.middle = ACTION.NONE
    c.mouseButtons.wheel = ACTION.DOLLY
    c.touches.one = ACTION.TOUCH_ROTATE
    c.touches.two = ACTION.TOUCH_DOLLY
    c.touches.three = ACTION.NONE
    c.draggingSmoothTime = 0.18
    c.dollySpeed = 0.6
    c.azimuthRotateSpeed = isTouch ? 0.7 : 0.55
    c.polarRotateSpeed = isTouch ? 0.5 : 0.4
    unlock(c)
    fly(poses.intro, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // fly to the current view
  useEffect(() => {
    const c = ref.current
    unlock(c)
    c.enabled = false
    c.smoothTime = reducedMotion ? 0.25 : 0.95
    const prev = prevView.current

    if (view === 'intro') {
      fly(poses.intro, false)
    } else if (view === 'avatar') {
      c.smoothTime = reducedMotion ? 0.25 : 1.4
      fly(poses.avatar, prev === 'intro')
    } else if (view === 'explore') {
      // arriving from far away (selection, cinematic, secret room…): a sweeping flight once around
      // the island while descending onto it
      const grand = ['intro', 'avatar', 'finale', 'finalRoom', 'cinematic', 'epilogue', 'ending'].includes(prev)
      if (grand) {
        const { target, dist } = resolvePose(followPose(size.width / size.height), lens(), size.width / size.height)
        c.normalizeRotations()
        const start = isoDir(62, reducedMotion ? 0 : -2.4).multiplyScalar(dist * 1.9).add(target)
        c.setLookAt(start.x, start.y + 6, start.z, target.x, target.y, target.z, false)
      }
      c.smoothTime = reducedMotion ? 0.25 : grand ? 2.6 : 1.1
      exploreLimits(fly(followPose(size.width / size.height)))
      c.enabled = true
    } else if (view === 'cinematic') {
      cine.t0 = null
      cineDone.current = false
      // the avatar waits at the foot of the Love Tree for the last scenes, on the camera's side, looking up at it
      const at = loveTree.clone().addScaledVector(isoBack, 3.35).addScaledVector(isoRight, 0.55)
      player.position.set(at.x, standHeight(at.x, at.z), at.z)
      player.yaw = Math.atan2(loveTree.x - at.x, loveTree.z - at.z)
      player.walkTarget = null
    } else if (view === 'finale') {
      const { position, target } = resolvePose(poses.finale, lens(), size.width / size.height)
      const far = position.clone().sub(target).multiplyScalar(1.9).add(target).add(v(0, -3, 0))
      c.setLookAt(far.x, far.y, far.z, target.x, target.y, target.z, false)
      c.smoothTime = reducedMotion ? 0.25 : 2.6
      fly(poses.finale)
    } else if (view === 'finalRoom') {
      if (prev !== 'finalRoom') {
        const { position, target } = resolvePose(poses.finalRoom, lens(), size.width / size.height)
        const far = position.clone().sub(target).multiplyScalar(1.6).add(target)
        c.setLookAt(far.x, far.y + 1.5, far.z, target.x, target.y, target.z, false)
      }
      const close = secretStage && secretStage !== 'found'
      c.smoothTime = reducedMotion ? 0.25 : close ? 4.5 : 3
      fly(close ? poses.secretClose : poses.finalRoom)
    } else if (view === 'epilogue') {
      if (prev !== 'epilogue') {
        const { position, target } = resolvePose(poses.ending, lens(), size.width / size.height)
        c.setLookAt(position.x, position.y, position.z, target.x, target.y, target.z, false)
      }
      c.smoothTime = reducedMotion ? 0.25 : 5
      fly(poses.epilogue)
    } else if (view === 'ending') {
      c.smoothTime = reducedMotion ? 0.25 : 2.4
      fly(poses.ending, prev !== 'cinematic')
    } else if (view === 'lane') {
      c.smoothTime = reducedMotion ? 0.25 : 1.15
      fly(lanePose(laneIndex))
    } else if (view === 'future') {
      c.smoothTime = reducedMotion ? 0.25 : prev === 'future' ? 1.0 : 1.6
      fly(futurePose(futureIndex))
    } else {
      const p = poseFor(view)
      if (p) {
        c.smoothTime = reducedMotion ? 0.25 : view === 'distance' ? (bridgeWhole ? 3 : 1.3) : 0.95
        const dist = fly(p)
        // Chapter 2: she may turn and zoom a little to see (and tap) everything between the islands
        if (view === 'distance') {
          c.normalizeRotations()
          c.minDistance = dist * 0.4
          c.maxDistance = dist * 1.3
          c.minPolarAngle = polarFor(75)
          c.maxPolarAngle = polarFor(5)
          c.minAzimuthAngle = ISO.azimuth - 0.9
          c.maxAzimuthAngle = ISO.azimuth + 0.9
          c.enabled = true
        }
      }
    }
    prevView.current = view
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selected, laneIndex, futureIndex, secretStage, bridgeWhole, camNonce, reducedMotion])

  // before the "one last question" finale: lift off toward the sky while the screen dims
  useEffect(() => {
    if (!riseCue) return
    const c = ref.current
    unlock(c)
    c.enabled = false
    c.smoothTime = reducedMotion ? 0.25 : 1.9
    const pos = c.getPosition(new THREE.Vector3())
    const target = c.getTarget(new THREE.Vector3())
    c.setLookAt(pos.x, pos.y + 6, pos.z + 3, target.x, target.y + 22, target.z - 4, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riseCue])

  // keep subjects framed when the screen rotates/resizes
  useEffect(() => {
    if (view === 'explore') {
      const { dist } = resolvePose(followPose(size.width / size.height), lens(), size.width / size.height)
      ref.current.dollyTo(dist, true)
      exploreLimits(dist)
      return
    }
    if (['intro', 'cinematic'].includes(view)) return
    const p = poseFor(view)
    if (p) fly(p)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height])

  useFrame(({ clock }, delta) => {
    const c = ref.current
    if (!c) return
    // ease the lens between the flat 2D island and the sky set pieces
    const fov = fovFor(view)
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = reducedMotion ? fov : THREE.MathUtils.damp(camera.fov, fov, 2.6, delta)
      camera.updateProjectionMatrix()
    }
    // the final cinematic drives the camera itself
    if (view === 'cinematic') {
      if (cine.t0 === null) cine.t0 = clock.elapsedTime
      const t = clock.elapsedTime - cine.t0
      // with reduced motion the camera simply holds one calm shot of the tree
      const { pos, tgt } = cinematicCamera(reducedMotion ? CINE.title : t, size.width / size.height)
      c.setLookAt(pos.x, pos.y, pos.z, tgt.x, tgt.y, tgt.z, false)
      c.setFocalOffset(0, 0, 0, false)
      // the whole message has been shown: the ending counts as seen (she chooses what's next)
      if (t >= CINE_LENGTH && !cineDone.current) {
        cineDone.current = true
        useStore.getState().markEndingSeen()
      }
      return
    }
    // soft parallax from the pointer in calm, framed views
    const p = useStore.getState().pointer
    const amount = reducedMotion ? 0 : view === 'intro' || view === 'avatar' ? 0.3 : view === 'distance' || view === 'constellation' ? 0.35 : 0
    c.setFocalOffset(p.x * amount, p.y * amount * 0.6, 0, true)
  })

  return <CameraControls ref={ref} makeDefault />
}
