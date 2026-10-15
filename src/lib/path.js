import { colliders, HOME_ISLAND, MAIN_RADIUS, obstacles, SEA, SKY, slope, standHeight, walkable } from './terrain'

/*
 * PATHFINDING for tap-to-walk and "Take me there". A small A* over a grid of walkable cells
 * (island edge, water, cliff faces and every tree / rock / prop collider are respected),
 * then the path is pulled tight so she walks in smooth straight segments, not grid steps.
 */

const CELL = 0.3
// the grid covers the main meadow, the home garden to the north, Sky Island to the east, the
// western isles, and the wide meadow between them (south as far as the pond)
const MIN_X = Math.min(-(MAIN_RADIUS + 1.2), SEA.x - SEA.r - 1)
const MAX_X = SKY.x + SKY.r * 1.6
const MIN_Z = HOME_ISLAND.z - HOME_ISLAND.r * 1.1 - 1
const MAX_Z = 40
const NX = Math.ceil((MAX_X - MIN_X) / CELL)
const NZ = Math.ceil((MAX_Z - MIN_Z) / CELL)
let grid = null
/** stand height of every walkable cell */
let heights = null
let builtFor = ''
const gridKey = () => `${colliders.length}:${obstacles.version}`

const toWorldX = (i) => MIN_X + (i + 0.5) * CELL
const toWorldZ = (j) => MIN_Z + (j + 0.5) * CELL
const toCellX = (v) => Math.max(0, Math.min(NX - 1, Math.floor((v - MIN_X) / CELL)))
const toCellZ = (v) => Math.max(0, Math.min(NZ - 1, Math.floor((v - MIN_Z) / CELL)))

/** Can she step from a to b (same rule as the player controller: no climbing steep faces)? */
function canStep(ax, az, bx, bz) {
  if (!walkable(bx, bz)) return false
  const rise = standHeight(bx, bz) - standHeight(ax, az)
  if (Math.abs(rise) > 0.5) return false // onto (or off the side of) a bridge
  return !(rise > 0.02 && slope(bx, bz) > 1.1)
}

/** Fill rows [from, to) of the grid. */
function buildRows(from, to) {
  for (let j = from; j < to; j++)
    for (let i = 0; i < NX; i++) {
      const k = j * NX + i
      const x = toWorldX(i)
      const z = toWorldZ(j)
      const ok = walkable(x, z)
      grid[k] = ok ? 1 : 0
      if (ok) heights[k] = standHeight(x, z)
    }
}
function start() {
  grid = new Uint8Array(NX * NZ)
  heights = new Float32Array(NX * NZ)
}
let warmRow = -1
/** what the grid looked like when the warm-up started (if colliders change meanwhile, it's rebuilt) */
let warmKey = ''
function build() {
  start()
  buildRows(0, NZ)
  builtFor = gridKey()
  warmRow = -1
}

/**
 * Build the walking grid a few rows at a time while the browser is idle, so the first tap rarely
 * has to wait for it (the meadow is big). Safe to call more than once.
 */
export function warmPaths() {
  if (typeof window === 'undefined' || (grid && builtFor === gridKey()) || warmRow >= 0) return
  start()
  builtFor = ''
  warmRow = 0
  warmKey = gridKey()
  const idle = window.requestIdleCallback || ((cb) => setTimeout(() => cb({ timeRemaining: () => 8 }), 30))
  const step = (deadline) => {
    if (warmRow < 0) return // finished (or built in one go by a tap meanwhile)
    while (warmRow < NZ && deadline.timeRemaining() > 2) {
      buildRows(warmRow, Math.min(NZ, warmRow + 4))
      warmRow += 4
    }
    if (warmRow >= NZ) {
      builtFor = warmKey
      warmRow = -1
    } else idle(step)
  }
  idle(step)
}

/** Can she step between neighbouring cells (read off the grid: the same rule as canStep, with the
 * slope taken from the step itself)? */
function cellStep(a, b, diagonal) {
  const rise = heights[b] - heights[a]
  if (Math.abs(rise) > 0.5) return false
  return !(rise > 0.02 && rise / (diagonal ? CELL * Math.SQRT2 : CELL) > 1.1)
}

/** Is the straight segment walkable (sampled finely)? */
function clearLine(ax, az, bx, bz) {
  const d = Math.hypot(bx - ax, bz - az)
  const steps = Math.max(1, Math.ceil(d / 0.12))
  let px = ax
  let pz = az
  for (let k = 1; k <= steps; k++) {
    const x = ax + ((bx - ax) * k) / steps
    const z = az + ((bz - az) * k) / steps
    if (!canStep(px, pz, x, z)) return false
    px = x
    pz = z
  }
  return true
}

/** Nearest walkable cell to (x, z) (the goal may be inside a collider, e.g. a bench). */
function nearestOpen(i, j) {
  if (grid[j * NX + i]) return [i, j]
  for (let r = 1; r < 12; r++)
    for (let dj = -r; dj <= r; dj++)
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue
        const a = i + di
        const b = j + dj
        if (a >= 0 && b >= 0 && a < NX && b < NZ && grid[b * NX + a]) return [a, b]
      }
  return null
}

/**
 * A walkable route from (sx, sz) to (tx, tz) as a list of [x, z] waypoints (excluding the start),
 * or null if there is no way there.
 */
export function findPath(sx, sz, tx, tz) {
  if (clearLine(sx, sz, tx, tz)) return [[tx, tz]]
  if (!grid || builtFor !== gridKey()) {
    // a warm-up still in progress: finish it now; otherwise (or if things changed) build afresh
    if (warmRow >= 0 && builtFor === '') {
      buildRows(warmRow, NZ)
      builtFor = warmKey
      warmRow = -1
    }
    if (builtFor !== gridKey()) build()
  }
  const start = nearestOpen(toCellX(sx), toCellZ(sz))
  const goal = nearestOpen(toCellX(tx), toCellZ(tz))
  if (!start || !goal) return null
  const si = start[1] * NX + start[0]
  const gi = goal[1] * NX + goal[0]
  const g = new Float32Array(NX * NZ).fill(Infinity)
  const from = new Int32Array(NX * NZ).fill(-1)
  const closed = new Uint8Array(NX * NZ)
  const f = new Float32Array(NX * NZ).fill(Infinity)
  // the open list as a binary heap on f (the meadow is big: a linear scan got slow)
  const heap = [si]
  const less = (a, b) => f[heap[a]] < f[heap[b]]
  const swap = (a, b) => ([heap[a], heap[b]] = [heap[b], heap[a]])
  const push = (k) => {
    heap.push(k)
    for (let i = heap.length - 1; i > 0; ) {
      const p = (i - 1) >> 1
      if (!less(i, p)) break
      swap(i, p)
      i = p
    }
  }
  const pop = () => {
    const top = heap[0]
    const last = heap.pop()
    if (heap.length) {
      heap[0] = last
      for (let i = 0; ; ) {
        const l = i * 2 + 1
        const r = l + 1
        let m = i
        if (l < heap.length && less(l, m)) m = l
        if (r < heap.length && less(r, m)) m = r
        if (m === i) break
        swap(i, m)
        i = m
      }
    }
    return top
  }
  const h = (k) => Math.hypot((k % NX) - goal[0], Math.floor(k / NX) - goal[1])
  g[si] = 0
  f[si] = h(si)
  let found = false
  let guard = 0
  while (heap.length && guard++ < 120000) {
    const cur = pop()
    if (closed[cur]) continue // a stale entry (it was improved and pushed again)
    if (cur === gi) {
      found = true
      break
    }
    closed[cur] = 1
    const ci = cur % NX
    const cj = Math.floor(cur / NX)
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue
        const ni = ci + di
        const nj = cj + dj
        if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue
        const nk = nj * NX + ni
        if (closed[nk] || !grid[nk]) continue
        // no cutting corners past obstacles
        if (di && dj && (!grid[cj * NX + ni] || !grid[nj * NX + ci])) continue
        if (!cellStep(cur, nk, di && dj)) continue
        const cost = g[cur] + (di && dj ? Math.SQRT2 : 1)
        if (cost < g[nk]) {
          g[nk] = cost
          f[nk] = cost + h(nk)
          from[nk] = cur
          push(nk)
        }
      }
  }
  if (!found) return null
  const cells = []
  for (let k = gi; k !== -1 && k !== si; k = from[k]) cells.push([toWorldX(k % NX), toWorldZ(Math.floor(k / NX))])
  cells.reverse()
  // end on the target itself when she can stand there, otherwise as close as she can get
  if (walkable(tx, tz)) cells.push([tx, tz])
  else if (!cells.length) cells.push([toWorldX(goal[0]), toWorldZ(goal[1])])
  // pull the path tight: skip every waypoint that can be reached in a straight line
  const out = []
  let ax = sx
  let az = sz
  let k = 0
  while (k < cells.length) {
    let far = k
    // look a limited way ahead (straight-line checks are costly over a long meadow walk)
    for (let m = Math.min(cells.length - 1, k + 30); m > k; m--)
      if (clearLine(ax, az, cells[m][0], cells[m][1])) {
        far = m
        break
      }
    out.push(cells[far])
    ;[ax, az] = cells[far]
    k = far + 1
  }
  return out
}
