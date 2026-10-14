import { colliders, HOME_ISLAND, MAIN_RADIUS, obstacles, SKY, slope, standHeight, walkable } from './terrain'

/*
 * PATHFINDING for tap-to-walk and "Take me there". A small A* over a grid of walkable cells
 * (island edge, water, cliff faces and every tree / rock / prop collider are respected),
 * then the path is pulled tight so she walks in smooth straight segments, not grid steps.
 */

const CELL = 0.3
// the grid covers the main island, the home island to the north and Sky Island to the east
const MIN_X = -(MAIN_RADIUS + 1.2)
const MAX_X = SKY.x + SKY.r * 1.6
const MIN_Z = HOME_ISLAND.z - HOME_ISLAND.r * 1.1 - 1
const NX = Math.ceil((MAX_X - MIN_X) / CELL)
const NZ = Math.ceil((MAIN_RADIUS + 1.2 - MIN_Z) / CELL)
let grid = null
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
  return !(rise > 0.02 && slope(bx, bz) > 1.1)
}

function build() {
  grid = new Uint8Array(NX * NZ)
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) grid[j * NX + i] = walkable(toWorldX(i), toWorldZ(j)) ? 1 : 0
  builtFor = gridKey()
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
  if (!grid || builtFor !== gridKey()) build()
  const start = nearestOpen(toCellX(sx), toCellZ(sz))
  const goal = nearestOpen(toCellX(tx), toCellZ(tz))
  if (!start || !goal) return null
  const si = start[1] * NX + start[0]
  const gi = goal[1] * NX + goal[0]
  const g = new Float32Array(NX * NZ).fill(Infinity)
  const from = new Int32Array(NX * NZ).fill(-1)
  const closed = new Uint8Array(NX * NZ)
  const open = [si]
  const f = new Float32Array(NX * NZ).fill(Infinity)
  const h = (k) => Math.hypot((k % NX) - goal[0], Math.floor(k / NX) - goal[1])
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
        if (!canStep(toWorldX(ci), toWorldZ(cj), toWorldX(ni), toWorldZ(nj))) continue
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
