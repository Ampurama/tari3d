import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../../store'
import { areas, hiddenHeartSpots, lanePoints, starPositions } from '../../lib/layout'
import { secretEnding } from '../../content/config'
import { player, input } from '../../lib/player'
import { approach, interactables, nearestInteractable } from '../../lib/interactions'
import { standHeight } from '../../lib/terrain'

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
  const controls = useThree((s) => s.controls)
  useEffect(() => {
    if (!enabled) return
    const project = (v) => {
      const p = v.clone().project(camera)
      return { x: ((p.x + 1) / 2) * size.width, y: ((1 - p.y) / 2) * size.height, visible: p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1 }
    }
    window.__universe = {
      store: useStore,
      secretEnding,
      heart: (i) => project(hiddenHeartSpots[i].position.clone().add(groupOrigin[hiddenHeartSpots[i].group])),
      star: (i) => project(starPositions[i].clone().add(areas.constellation)),
      lantern: (i) => project(lanePoints[i].clone().add(new THREE.Vector3(0, 0.4, 0))),
      player,
      input,
      /** put the avatar somewhere on the island (tests only) */
      teleport: (x, z) => {
        player.position.set(x, standHeight(x, z), z)
        player.walkTarget = null
      },
      interactables: () => [...interactables.keys()],
      near: () => nearestInteractable()?.id || null,
      /** tap an interactable the same way a finger would (walks there first if needed) */
      approach,
      where: (id) => {
        const it = interactables.get(id)
        return it ? project(it.position.clone()) : null
      },
      project: (x, y, z) => project(new THREE.Vector3(x, y, z)),
      /** zoom / tilt / turn the island camera like a pinch or a drag would (tests only) */
      zoom: (distance) => controls?.dollyTo(distance, false),
      tilt: (elevationDeg) => controls?.rotatePolarTo(((90 - elevationDeg) * Math.PI) / 180, false),
      turn: (radians) => controls?.rotate(radians, 0, false),
      cameraDistance: () => controls?.distance,
    }
  }, [camera, size, controls])
  return null
}
