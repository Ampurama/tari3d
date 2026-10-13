import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CameraControls, CameraControlsImpl } from '@react-three/drei'
import { framePose, poses, resolvePose } from '../../lib/layout'
import { isTouch } from '../../lib/device'
import { useStore } from '../../store'

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
  const reducedMotion = useStore((s) => s.reducedMotion)

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
    } else if (view === 'explore' && prevView.current === 'finale') {
      // coming back from the finale: appear softly in front of the island instead of a long flight
      ref.current.setLookAt(0, 9, 30, 0, 1.6, 0, false)
      lockExplore(fly(poses.explore))
    } else if (view === 'explore') {
      lockExplore(fly(poses.explore))
    } else if (view === 'memories') {
      fly(selected === null ? poses.memories : framePose(selected))
    } else if (view === 'finale') {
      fly(poses.finale, false) // the screen is dark while we travel
    } else if (poses[view]) {
      c.smoothTime = reducedMotion ? 0.25 : view === 'distance' ? 1.3 : 0.95
      fly(poses[view])
    }
    prevView.current = view
    return () => clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selected, camNonce, reducedMotion])

  // keep subjects framed when the screen rotates/resizes (except free exploring)
  useEffect(() => {
    if (view === 'explore' || view === 'intro') return
    const p = view === 'memories' ? (selected === null ? poses.memories : framePose(selected)) : poses[view]
    if (p) fly(p)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height])

  // soft parallax from pointer / device tilt
  useFrame(() => {
    const c = ref.current
    if (!c) return
    const p = useStore.getState().pointer
    const amount = reducedMotion ? 0 : view === 'intro' ? 0.45 : view === 'explore' ? 0.18 : view === 'distance' ? 0.35 : 0
    c.setFocalOffset(p.x * amount, p.y * amount * 0.6, 0, true)
  })

  return <CameraControls ref={ref} makeDefault />
}
