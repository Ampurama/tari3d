import { colliders, MAIN_RADIUS, slope, standHeight, walkable } from './terrain'

/*
 * PATHFINDING for tap-to-walk and "Take me there". A small A* over a grid of walkable cells
 * (island edge, water, cliff faces and every tree / rock / prop collider are respected),
 * then the path is pulled tight so she walks in smooth straight segments, not grid steps.
 */

const CELL = 0.3
const MIN = -(MAIN_RADIUS + 1.2)
const N = Math.ceil((-MIN * 2) / CELL)
let grid = null
let builtFor = -1

const toWorld = (i) => MIN + (i + 0.5) * CELL
const toCell = (v) => Math.max(0, Math.min(N - 1, Math.floor((v - MIN) / CELL)))

/** Can she step from a to b (same rule as the player controller: no climbing steep faces)? */
function canStep(ax, az, bx, bz) {
  if (!walkable(bx, bz)) return false
  const rise = standHeight(bx, bz) - standHeight(ax, az)
  return !(rise > 0.02 && slope(bx, bz) > 1.1)
}

function build() {
  grid = new Uint8Array(N * N)
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) grid[j * N + i] = walkable(toWorld(i), toWorld(j)) ? 1 : 0
  builtFor = colliders.length
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
  if (grid[j * N + i]) return [i, j]
  for (let r = 1; r < 12; r++)
    for (let dj = -r; dj <= r; dj++)
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue
        const a = i + di
        const b = j + dj
        if (a >= 0 && b >= 0 && a < N && b < N && grid[b * N + a]) return [a, b]
      }
  return null
}

/**
 * A walkable route from (sx, sz) to (tx, tz) as a list of [x, z] waypoints (excluding the start),
 * or null if there is no way there.
 */
export function findPath(sx, sz, tx, tz) {
  if (clearLine(sx, sz, tx, tz)) return [[tx, tz]]
  if (!grid || builtFor !== colliders.length) build()
  const start = nearestOpen(toCell(sx), toCell(sz))
  const goal = nearestOpen(toCell(tx), toCell(tz))
  if (!start || !goal) return null
  const si = start[1] * N + start[0]
  const gi = goal[1] * N + goal[0]
  const g = new Float32Array(N * N).fill(Infinity)
  const from = new Int32Array(N * N).fill(-1)
  const closed = new Uint8Array(N * N)
  const open = [si]
  const f = new Float32Array(N * N).fill(Infinity)
  const h = (k) => Math.hypot((k % N) - goal[0], Math.floor(k / N) - goal[1])
  g[si] = 0
  f[si] = h(si)
  let found = false
  let guard = 0
  while (open.length && guard++ < 60000) {
    // small open lists: a linear scan is fast enough here
    let best = 0
    for (let k = 1; k < open.length; k++) if (f[open[k]] < f[open[best]]) best = k
    const cur = open[best]
    open[best] = open[open.length - 1]
    open.pop()
    if (cur === gi) {
      found = true
      break
    }
    closed[cur] = 1
    const ci = cur % N
    const cj = Math.floor(cur / N)
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue
        const ni = ci + di
        const nj = cj + dj
        if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue
        const nk = nj * N + ni
        if (closed[nk] || !grid[nk]) continue
        // no cutting corners past obstacles
        if (di && dj && (!grid[cj * N + ni] || !grid[nj * N + ci])) continue
        if (!canStep(toWorld(ci), toWorld(cj), toWorld(ni), toWorld(nj))) continue
        const cost = g[cur] + (di && dj ? Math.SQRT2 : 1)
        if (cost < g[nk]) {
          if (g[nk] === Infinity) open.push(nk)
          g[nk] = cost
          f[nk] = cost + h(nk)
          from[nk] = cur
        }
      }
  }
  if (!found) return null
  const cells = []
  for (let k = gi; k !== -1 && k !== si; k = from[k]) cells.push([toWorld(k % N), toWorld(Math.floor(k / N))])
  cells.reverse()
  // end on the target itself when she can stand there, otherwise as close as she can get
  if (walkable(tx, tz)) cells.push([tx, tz])
  else if (!cells.length) cells.push([toWorld(goal[0]), toWorld(goal[1])])
  // pull the path tight: skip every waypoint that can be reached in a straight line
  const out = []
  let ax = sx
  let az = sz
  let k = 0
  while (k < cells.length) {
    let far = k
    for (let m = cells.length - 1; m > k; m--)
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
