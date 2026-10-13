import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CameraControls, CameraControlsImpl } from '@react-three/drei'
import * as THREE from 'three'
import { framePose, futurePose, lanePose, poses, reactorPosition, resolvePose } from '../../lib/layout'
import { isTouch } from '../../lib/device'
import { useStore } from '../../store'
import { CUTSCENE_SECONDS } from '../../lib/story'

const { ACTION } = CameraControlsImpl

function unlock(c) {
  c.minDistance = 0.1
  c.maxDistance = Infinity
  c.minPolarAngle = 0
  c.maxPolarAngle = Math.PI
}

/**
 * One place that decides where the camera is. Every view has a pose; transitions are
 * smooth-damped (never jerky), and free orbiting is only allowed while exploring the island.
 */
export default function CameraDirector() {
  const ref = useRef()
  const prevView = useRef('intro')
  const timer = useRef()
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const view = useStore((s) => s.view)
  const selected = useStore((s) => s.selectedMemory)
  const camNonce = useStore((s) => s.camNonce)
  const laneIndex = useStore((s) => s.laneIndex)
  const riseCue = useStore((s) => s.riseCue)
  const futureIndex = useStore((s) => s.futureIndex)
  const cutStart = useRef(null)
  const cutDone = useRef(false)
  const reducedMotion = useStore((s) => s.reducedMotion)

  const poseFor = (v) =>
    v === 'memories' ? (selected === null ? poses.memories : framePose(selected)) : v === 'lane' ? lanePose(laneIndex) : v === 'future' ? futurePose(futureIndex) : poses[v]

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
    c.touches.two = ACTION.TOUCH_DOLLY
    c.touches.three = ACTION.NONE
    c.draggingSmoothTime = 0.18
    c.azimuthRotateSpeed = isTouch ? 0.55 : 0.4
    c.polarRotateSpeed = isTouch ? 0.45 : 0.35
    c.dollySpeed = 0.4
    unlock(c)
    fly(poses.intro, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // fly to the current view
  useEffect(() => {
    const c = ref.current
    clearTimeout(timer.current)
    unlock(c)
    c.enabled = false
    const calm = reducedMotion ? 0.25 : 0.95
    c.smoothTime = calm

    const lockExplore = (dist) => {
      c.minDistance = dist * 0.55
      c.maxDistance = dist * 1.3
      c.minPolarAngle = 0.5
      c.maxPolarAngle = 1.42
      c.enabled = true
    }

    if (view === 'intro') {
      fly(poses.intro, false)
    } else if (view === 'explore' && prevView.current === 'intro') {
      // cinematic arrival: swoop from the sky down toward the island, then settle in
      c.smoothTime = reducedMotion ? 0.25 : 1.25
      fly(poses.enterMid)
      timer.current = setTimeout(
        () => {
          c.smoothTime = reducedMotion ? 0.25 : 1.05
          lockExplore(fly(poses.explore))
        },
        reducedMotion ? 250 : 1700,
      )
    } else if (view === 'explore' && (prevView.current === 'finale' || prevView.current === 'finalRoom')) {
      // coming back from the finale: appear softly in front of the island instead of a long flight
      ref.current.setLookAt(0, 9, 30, 0, 1.6, 0, false)
      lockExplore(fly(poses.explore))
    } else if (view === 'explore') {
      lockExplore(fly(poses.explore))
    } else if (view === 'memories') {
      fly(selected === null ? poses.memories : framePose(selected))
    } else if (view === 'finale') {
      // the screen is dark while we travel; then the camera drifts gently toward the heart
      const { position, target } = resolvePose(poses.finale, camera.fov, size.width / size.height)
      const far = position.clone().sub(target).multiplyScalar(1.9).add(target).add(new THREE.Vector3(0, -3, 0))
      c.setLookAt(far.x, far.y, far.z, target.x, target.y, target.z, false)
      c.smoothTime = reducedMotion ? 0.25 : 2.6
      fly(poses.finale)
    } else if (view === 'future') {
      c.smoothTime = reducedMotion ? 0.25 : prevView.current === 'future' ? 1.0 : 1.6
      fly(futurePose(futureIndex))
    } else if (view === 'cutscene') {
      // the cutscene drives the camera frame by frame (see useFrame below)
      cutStart.current = null
    } else if (view === 'finalRoom') {
      // appear a little further back, then drift slowly toward the heart
      const { position, target } = resolvePose(poses.finalRoom, camera.fov, size.width / size.height)
      const far = position.clone().sub(target).multiplyScalar(1.6).add(target)
      c.setLookAt(far.x, far.y + 1.5, far.z, target.x, target.y, target.z, false)
      c.smoothTime = reducedMotion ? 0.25 : 3
      fly(poses.finalRoom)
    } else if (view === 'lane') {
      // walking the lane: a slower, floaty glide from lantern to lantern
      c.smoothTime = reducedMotion ? 0.25 : 1.15
      fly(lanePose(laneIndex))
    } else if (poses[view]) {
      c.smoothTime = reducedMotion ? 0.25 : view === 'distance' ? 1.3 : 0.95
      fly(poses[view])
    }
    prevView.current = view
    return () => clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selected, laneIndex, futureIndex, camNonce, reducedMotion])

  // before the finale: lift off toward the sky while the screen slowly dims
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

  // keep subjects framed when the screen rotates/resizes (except free exploring)
  useEffect(() => {
    if (view === 'explore' || view === 'intro') return
    const p = poseFor(view)
    if (p) fly(p)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height])

  // soft parallax from pointer / device tilt (+ the scripted ending cutscene)
  useFrame(({ clock }) => {
    const c = ref.current
    if (!c) return
    if (view === 'cutscene') {
      if (cutStart.current === null) cutStart.current = clock.elapsedTime
      const duration = reducedMotion ? 3 : CUTSCENE_SECONDS
      const t = Math.min(1, (clock.elapsedTime - cutStart.current) / duration)
      const e = t * t * (3 - 2 * t)
      // a slow rising spiral around the heart, closing in as it awakens
      const angle = reducedMotion ? 0 : -0.4 + e * Math.PI * 1.6
      const radius = reducedMotion ? 9 : THREE.MathUtils.lerp(15, 6.5, e)
      const height = reducedMotion ? 1 : THREE.MathUtils.lerp(-3.5, 1.8, e)
      const r = reactorPosition
      c.setLookAt(r.x + Math.sin(angle) * radius, r.y + height, r.z + Math.cos(angle) * radius, r.x, r.y, r.z, false)
      c.setFocalOffset(0, 0, 0, false)
      if (t >= 1 && !cutDone.current) {
        cutDone.current = true
        useStore.getState().finishCutscene()
      }
      return
    }
    cutDone.current = false
    const p = useStore.getState().pointer
    const amount = reducedMotion ? 0 : view === 'intro' ? 0.45 : view === 'explore' ? 0.18 : view === 'distance' || view === 'constellation' ? 0.35 : 0
    c.setFocalOffset(p.x * amount, p.y * amount * 0.6, 0, true)
  })

  return <CameraControls ref={ref} makeDefault />
}
