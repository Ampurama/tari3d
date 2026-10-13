import * as THREE from 'three'

export const ISLAND_RADIUS = 6

/** Gentle meadow height on top of the main island. */
export function heightAt(x, z, radius = ISLAND_RADIUS) {
  const r2 = (x * x + z * z) / (radius * radius)
  const k = radius / ISLAND_RADIUS
  return (
    0.3 * k * (1 - r2) +
    0.07 * k * Math.sin(x / k * 0.9 + 0.4) * Math.cos(z / k * 0.8 - 0.3) +
    0.035 * k * Math.sin(x / k * 2.1 + z / k * 1.7)
  )
}

function rimFactor(theta, seed) {
  return 1 + 0.035 * Math.sin(3 * theta + seed) + 0.025 * Math.sin(7 * theta + seed * 2.3)
}

/**
 * Builds a ring-by-ring surface. `rows` is a list of radius factors; `yAt(row, x, z)` gives height.
 * `jitter(row, theta)` nudges the radius for a hand-carved look.
 */
function polarSurface({ rows, segments, radius, seed, yAt, jitter = () => 0, colorAt }) {
  const positions = []
  const colors = []
  const indices = []
  const color = new THREE.Color()

  rows.forEach((rf, row) => {
    for (let s = 0; s <= segments; s++) {
      const theta = (s / segments) * Math.PI * 2
      const rr = rf * radius * rimFactor(theta, seed) * (1 + jitter(row, theta))
      const x = Math.cos(theta) * rr
      const z = Math.sin(theta) * rr
      positions.push(x, yAt(row, x, z), z)
      colorAt(color, row / (rows.length - 1), x, z)
      colors.push(color.r, color.g, color.b)
    }
  })

  const stride = segments + 1
  for (let row = 0; row < rows.length - 1; row++) {
    for (let s = 0; s < segments; s++) {
      const a = row * stride + s
      const b = a + stride
      indices.push(a, a + 1, b, b, a + 1, b + 1)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

const grassA = new THREE.Color('#86b59f')
const grassB = new THREE.Color('#d98fb4')
const grassC = new THREE.Color('#a593d8')

export function grassGeometry({ radius = ISLAND_RADIUS, seed = 1, segments = 96 } = {}) {
  const rows = []
  for (let i = 0; i <= 18; i++) rows.push(Math.max(0.0001, i / 18))
  rows.push(1.025) // soft lip over the edge
  return polarSurface({
    rows,
    segments,
    radius,
    seed,
    yAt: (row, x, z) => (row === rows.length - 1 ? heightAt(x, z, radius) - 0.18 * (radius / ISLAND_RADIUS) : heightAt(x, z, radius)),
    colorAt: (c, t, x, z) => {
      const n = 0.5 + 0.5 * Math.sin(x * 1.3 + seed) * Math.cos(z * 1.1 - seed)
      c.copy(grassA).lerp(grassC, t * 0.55).lerp(grassB, n * 0.28 * t)
    },
  })
}

const rockTop = new THREE.Color('#9d88cf')
const rockMid = new THREE.Color('#5f4b98')
const rockBottom = new THREE.Color('#2a2056')

export function rockGeometry({ radius = ISLAND_RADIUS, seed = 1, segments = 48 } = {}) {
  const k = radius / ISLAND_RADIUS
  const profile = [
    [1.025, -0.18],
    [0.98, -0.75],
    [0.9, -1.5],
    [0.76, -2.4],
    [0.6, -3.4],
    [0.42, -4.5],
    [0.24, -5.6],
    [0.1, -6.6],
    [0.0001, -7.4],
  ]
  return polarSurface({
    rows: profile.map((p) => p[0]),
    segments,
    radius,
    seed: seed,
    yAt: (row) => profile[row][1] * k,
    jitter: (row, theta) =>
      row === 0 || row === profile.length - 1
        ? 0
        : 0.09 * Math.sin(theta * 5 + row * 1.7 + seed) + 0.06 * Math.sin(theta * 11 - row * 2.3 + seed),
    colorAt: (c, t) => {
      if (t < 0.4) c.copy(rockTop).lerp(rockMid, t / 0.4)
      else c.copy(rockMid).lerp(rockBottom, (t - 0.4) / 0.6)
    },
  })
}

/** Deterministic pseudo random generator. */
export function seeded(seed = 1) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}
