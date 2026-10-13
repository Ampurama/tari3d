import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CameraControls, CameraControlsImpl } from '@react-three/drei'
import * as THREE from 'three'
import { areas, framePose, futurePose, lanePose, loveTree, poses, resolvePose } from '../../lib/layout'
import { cine, CINE_LENGTH, cinematicCamera } from '../../lib/cinematic'
import { player } from '../../lib/player'
import { standHeight } from '../../lib/terrain'
import { connections } from '../../content/config'
import { isTouch } from '../../lib/device'
import { useStore } from '../../store'
import { followTarget } from './Player'

const { ACTION } = CameraControlsImpl

function unlock(c) {
  c.minDistance = 0.1
  c.maxDistance = Infinity
  c.minPolarAngle = 0
  c.maxPolarAngle = Math.PI
}

const v = (x, y, z) => new THREE.Vector3(x, y, z)
const pose = (target, dir, fitW, fitH, minDist) => ({ target, dir: dir.normalize(), fitW, fitH, minDist })

/** Third-person camera behind the avatar. */
const followPose = () => pose(followTarget().clone(), v(-Math.sin(player.yaw), 0.5, -Math.cos(player.yaw)), 4, 4, 7.2)

/** Once the bridge is whole, Chapter 2 is seen from further back. */
const distanceWide = pose(areas.distance.clone().add(v(0, 1.2, 0)), v(0, 0.42, 1), 28, 14, 24)

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
    if (vw === 'explore') return followPose()
    return poses[vw]
  }

  const fly = (p, smooth = true) => {
    const { position, target, dist } = resolvePose(p, camera.fov, size.width / size.height)
    ref.current.setLookAt(position.x, position.y, position.z, target.x, target.y, target.z, smooth)
    return dist
  }

  // configure input once
  useEffect(() => {
    const c = ref.current
    c.mouseButtons.right = ACTION.NONE
    c.mouseButtons.middle = ACTION.NONE
    c.mouseButtons.wheel = ACTION.DOLLY
    c.touches.one = ACTION.TOUCH_ROTATE
    c.touches.two = ACTION.TOUCH_DOLLY
    c.touches.three = ACTION.NONE
    c.draggingSmoothTime = 0.18
    c.azimuthRotateSpeed = isTouch ? 0.6 : 0.45
    c.polarRotateSpeed = isTouch ? 0.45 : 0.35
    c.dollySpeed = 0.4
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
      // arriving from far away (selection, cinematic, secret room…): appear behind the avatar
      if (['intro', 'avatar', 'finale', 'finalRoom', 'cinematic', 'epilogue', 'ending'].includes(prev)) {
        const { position, target } = resolvePose(followPose(), camera.fov, size.width / size.height)
        c.setLookAt(position.x, position.y + 4, position.z + 0.01, target.x, target.y, target.z, false)
      }
      c.smoothTime = reducedMotion ? 0.25 : 1.1
      fly(followPose())
      // free third-person orbit around the avatar
      c.minDistance = 3.2
      c.maxDistance = 12.5
      c.minPolarAngle = 0.55
      c.maxPolarAngle = 1.42
      c.enabled = true
    } else if (view === 'cinematic') {
      cine.t0 = null
      cineDone.current = false
      // the avatar waits at the foot of the Love Tree for the last scenes
      player.position.set(loveTree.x + 0.4, standHeight(loveTree.x + 0.4, loveTree.z + 2.4), loveTree.z + 2.4)
      player.yaw = Math.PI
      player.walkTarget = null
    } else if (view === 'finale') {
      const { position, target } = resolvePose(poses.finale, camera.fov, size.width / size.height)
      const far = position.clone().sub(target).multiplyScalar(1.9).add(target).add(v(0, -3, 0))
      c.setLookAt(far.x, far.y, far.z, target.x, target.y, target.z, false)
      c.smoothTime = reducedMotion ? 0.25 : 2.6
      fly(poses.finale)
    } else if (view === 'finalRoom') {
      if (prev !== 'finalRoom') {
        const { position, target } = resolvePose(poses.finalRoom, camera.fov, size.width / size.height)
        const far = position.clone().sub(target).multiplyScalar(1.6).add(target)
        c.setLookAt(far.x, far.y + 1.5, far.z, target.x, target.y, target.z, false)
      }
      const close = secretStage && secretStage !== 'found'
      c.smoothTime = reducedMotion ? 0.25 : close ? 4.5 : 3
      fly(close ? poses.secretClose : poses.finalRoom)
    } else if (view === 'epilogue') {
      if (prev !== 'epilogue') {
        const { position, target } = resolvePose(poses.ending, camera.fov, size.width / size.height)
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
        fly(p)
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

  // keep subjects framed when the screen rotates/resizes (except while free-roaming)
  useEffect(() => {
    if (['explore', 'intro', 'cinematic'].includes(view)) return
    const p = poseFor(view)
    if (p) fly(p)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height])

  useFrame(({ clock }) => {
    const c = ref.current
    if (!c) return
    // the final cinematic drives the camera itself
    if (view === 'cinematic') {
      if (cine.t0 === null) cine.t0 = clock.elapsedTime
      const t = (clock.elapsedTime - cine.t0) * (reducedMotion ? 4 : 1)
      const { pos, tgt } = cinematicCamera(Math.min(t, CINE_LENGTH), size.width / size.height, camera.fov)
      c.setLookAt(pos.x, pos.y, pos.z, tgt.x, tgt.y, tgt.z, false)
      c.setFocalOffset(0, 0, 0, false)
      if (t >= CINE_LENGTH && !cineDone.current) {
        cineDone.current = true
        useStore.getState().finishCinematic()
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
