import * as THREE from 'three'

/** Point on the classic heart curve, normalised to roughly -1..1. */
export function heartPoint(t) {
  const x = 16 * Math.sin(t) ** 3
  const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
  return [x / 17, (y + 2) / 17]
}

let geometry = null

/** A puffy, rounded 3D heart about 2 units wide. Shared by every heart in the scene. */
export function heartGeometry() {
  if (geometry) return geometry
  const shape = new THREE.Shape()
  const steps = 96
  for (let i = 0; i < steps; i++) {
    const [x, y] = heartPoint((i / steps) * Math.PI * 2)
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.18,
    bevelEnabled: true,
    bevelThickness: 0.32,
    bevelSize: 0.26,
    bevelSegments: 10,
    curveSegments: 48,
    steps: 1,
  })
  geometry.center()
  geometry.computeVertexNormals()
  return geometry
}

/**
 * Sample points filling a 3D heart volume (for the finale particle heart).
 * Returns a Float32Array of xyz triplets.
 */
export function heartVolumePoints(count, scale = 4) {
  const out = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const t = Math.random() * Math.PI * 2
    // bias toward the outline so the silhouette reads clearly
    const r = Math.random() < 0.55 ? 0.94 + Math.random() * 0.06 : Math.sqrt(Math.random())
    const [hx, hy] = heartPoint(t)
    const depth = (1 - r * r * 0.7) * 0.55
    out[i * 3] = hx * r * scale
    out[i * 3 + 1] = hy * r * scale
    out[i * 3 + 2] = (Math.random() * 2 - 1) * depth * scale * (0.35 + 0.65 * (1 - Math.abs(hx * r)))
  }
  return out
}
