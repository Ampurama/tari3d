import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../../store'
import { areas, hiddenHeartSpots, lanePoints, starPositions } from '../../lib/layout'

const enabled = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')

const groupOrigin = {
  island: new THREE.Vector3(),
  sky: new THREE.Vector3(),
  distance: areas.distance,
  constellation: areas.constellation,
}

/**
 * Test helper, only active with `?debug` in the URL: lets automated tests read state and
 * find the on-screen position of 3D objects so they can click them like a real person would.
 */
export default function DebugBridge() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  useEffect(() => {
    if (!enabled) return
    const project = (v) => {
      const p = v.clone().project(camera)
      return { x: ((p.x + 1) / 2) * size.width, y: ((1 - p.y) / 2) * size.height, visible: p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1 }
    }
    window.__universe = {
      store: useStore,
      heart: (i) => project(hiddenHeartSpots[i].position.clone().add(groupOrigin[hiddenHeartSpots[i].group])),
      star: (i) => project(starPositions[i].clone().add(areas.constellation)),
      lantern: (i) => project(lanePoints[i].clone().add(new THREE.Vector3(0, 0.4, 0))),
    }
  }, [camera, size])
  return null
}
