/*
 * THE BOOTH GAMES of Dreamlight Funfair — what happens in them, kept apart from how they're drawn
 * (components/ui/CarnivalUI.jsx draws them on a canvas). Each game is a plain object moved along by
 * step(game, dt) and played with tap(game) (and aimAt for the shooting gallery). The score comes only
 * from what happened: where the ring landed, which cans fell, which targets the darts reached.
 *
 * Units: the booth's own metres. x across (0 in the middle), d into the booth, y up.
 */

const tri = (t) => 1 - Math.abs(((t % 2) + 2) % 2 - 1) // 0 → 1 → 0, period 2

/* ───────── Ring Toss: aim, then power; the ring has to drop over a bottle's neck ───────── */

export const RING = {
  rings: 5,
  pegs: [-0.6, 0, 0.6].flatMap((x) => [1.5, 2.2, 2.9].map((d) => ({ x, d }))),
  hit: 0.19, // how close the ring's centre has to land to a neck
  flight: 0.85,
}
export function createRingToss() {
  return { kind: 'ringtoss', phase: 'aim', t: 0, pt: 0, aim: 0, power: 0, rings: RING.rings, score: 0, fly: null, last: null, onPeg: [], wait: 0 }
}
/** Where a thrown ring lands for an aim (−1…1) and a power (0…1). */
export const ringTarget = (aim, power) => ({ x: aim * 1.1, d: 0.9 + power * 2.5 })
function stepRing(g, dt) {
  g.t += dt
  if (g.phase === 'aim') g.aim = Math.sin(g.t * 1.15)
  else if (g.phase === 'power') {
    g.pt += dt
    g.power = tri(g.pt * 0.75)
  } else if (g.phase === 'flying') {
    g.fly.k = Math.min(1, g.fly.k + dt / RING.flight)
    if (g.fly.k >= 1) {
      // where it came down: over a neck, or on the board
      let best = null
      let bd = Infinity
      for (const p of RING.pegs) {
        const dd = Math.hypot(p.x - g.fly.to.x, p.d - g.fly.to.d)
        if (dd < bd) {
          bd = dd
          best = p
        }
      }
      const hit = bd < RING.hit
      if (hit) {
        g.score++
        g.onPeg.push(best)
      }
      g.last = { hit, at: hit ? { x: best.x, d: best.d } : g.fly.to }
      g.fly = null
      g.phase = 'result'
      g.wait = 0.9
    }
  } else if (g.phase === 'result') {
    g.wait -= dt
    if (g.wait <= 0) {
      g.phase = g.rings > 0 ? 'aim' : 'done'
      g.last = g.phase === 'done' ? g.last : null
    }
  }
}
function tapRing(g) {
  if (g.phase === 'aim') {
    g.phase = 'power'
    g.pt = 0
    g.power = 0
  } else if (g.phase === 'power') {
    g.rings--
    g.fly = { k: 0, to: ringTarget(g.aim, g.power) }
    g.phase = 'flying'
  }
}

/* ───────── Can Knockdown: a pyramid of six; what loses its support falls too ───────── */

export const CANS = { balls: 3, w: 0.22, h: 0.28, ball: 0.075, flight: 0.45 }
const PYRAMID = [
  { x: -0.25, row: 0 },
  { x: 0, row: 0 },
  { x: 0.25, row: 0 },
  { x: -0.125, row: 1 },
  { x: 0.125, row: 1 },
  { x: 0, row: 2 },
]
export function createCans() {
  return {
    kind: 'cans',
    phase: 'aim',
    t: 0,
    aim: { x: 0, y: 0.4 },
    balls: CANS.balls,
    score: 0,
    cans: PYRAMID.map((c, i) => ({ i, x: c.x, row: c.row, y: c.row * CANS.h, down: false, fall: 0, vx: 0, spin: 0 })),
    ball: null,
    wait: 0,
  }
}
/** The cans a can rests on (the ones below it that it overlaps). */
const under = (g, c) => g.cans.filter((o) => o.row === c.row - 1 && Math.abs(o.x - c.x) < CANS.w * 0.95)
function knock(g, c, push) {
  if (c.down) return
  c.down = true
  c.vx = push
  c.spin = push * 9 + (c.i % 2 ? 2 : -2)
}
/** The ball arrives at the aim point: does it hit a can? Then what can no longer stand falls. */
function arrive(g) {
  const { x, y } = g.ball.to
  // the frontmost hit: the highest row first, the can whose middle is nearest
  const hit = g.cans
    .filter((c) => !c.down && Math.abs(x - c.x) < CANS.w / 2 + CANS.ball && y > c.y - CANS.ball && y < c.y + CANS.h + CANS.ball)
    .sort((a, b) => b.row - a.row || Math.abs(x - a.x) - Math.abs(x - b.x))[0]
  if (hit) {
    const off = x - hit.x
    knock(g, hit, -off * 6 + (off < 0 ? 0.6 : -0.6))
    // a glancing blow near its edge tips the neighbour on that side too (the same row)
    if (Math.abs(off) > 0.06) {
      const side = g.cans.find((o) => !o.down && o.row === hit.row && Math.sign(o.x - hit.x) === -Math.sign(off) && Math.abs(Math.abs(o.x - hit.x) - CANS.w * 1.1) < 0.06)
      if (side) knock(g, side, -Math.sign(off) * 1.4)
    }
  }
  // everything above a fallen can comes down (repeat until nothing more falls)
  let changed = true
  while (changed) {
    changed = false
    for (const c of g.cans) {
      if (c.down || c.row === 0) continue
      if (under(g, c).some((o) => o.down)) {
        knock(g, c, (c.x >= 0 ? 1 : -1) * 0.8)
        changed = true
      }
    }
  }
  g.score = g.cans.filter((c) => c.down).length
  g.ball.hit = Boolean(hit)
}
function stepCans(g, dt) {
  g.t += dt
  if (g.phase === 'aim') {
    g.aim.x = 0.55 * Math.sin(g.t * 1.25)
    g.aim.y = 0.42 + 0.42 * Math.sin(g.t * 1.9 + 1)
  } else if (g.phase === 'flying') {
    g.ball.k = Math.min(1, g.ball.k + dt / CANS.flight)
    if (g.ball.k >= 1 && g.ball.hit === undefined) {
      arrive(g)
      g.phase = 'settle'
      g.wait = 1.0
    }
  } else if (g.phase === 'settle') {
    g.wait -= dt
    if (g.wait <= 0) {
      g.ball = null
      g.phase = g.score === g.cans.length || g.balls === 0 ? 'done' : 'aim'
    }
  }
  // fallen cans tumble off the shelf
  for (const c of g.cans) {
    if (!c.down) continue
    c.fall = Math.min(1.2, c.fall + dt)
    c.x += c.vx * dt * 0.3
  }
}
function tapCans(g) {
  if (g.phase !== 'aim') return
  g.balls--
  g.ball = { k: 0, to: { ...g.aim }, hit: undefined }
  g.phase = 'flying'
}

/* ───────── Target Shooting: moving targets, foam darts that take a moment to arrive ───────── */

export const SHOOT = {
  seconds: 25,
  dart: 0.16,
  rows: [
    { y: 0.78, r: 0.075, pts: 3, kind: 'star', speed: 0.5 },
    { y: 0.52, r: 0.1, pts: 2, kind: 'duck', speed: -0.38 },
    { y: 0.26, r: 0.12, pts: 1, kind: 'mushroom', speed: 0.27 },
  ],
}
export function createShooting() {
  const targets = []
  SHOOT.rows.forEach((row, ri) => {
    for (let i = 0; i < 4; i++) targets.push({ row: ri, x0: -1 + i * 0.5 + ri * 0.17, down: 0 })
  })
  return { kind: 'shooting', phase: 'ready', t: 0, left: SHOOT.seconds, score: 0, shots: 0, hits: 0, targets, darts: [], cross: { x: 0, y: 0.5 }, pops: [] }
}
/** Where a target is at time t (they glide along their row and wrap round). */
export function targetX(tg, t) {
  const row = SHOOT.rows[tg.row]
  const x = tg.x0 + row.speed * t
  return ((((x + 1.1) % 2.2) + 2.2) % 2.2) - 1.1
}
export function aimAt(g, x, y) {
  g.cross.x = Math.max(-1.1, Math.min(1.1, x))
  g.cross.y = Math.max(0, Math.min(1, y))
}
function stepShooting(g, dt) {
  if (g.phase === 'ready' || g.phase === 'done') return
  g.t += dt
  g.left = Math.max(0, g.left - dt)
  for (const tg of g.targets) if (tg.down > 0) tg.down = Math.max(0, tg.down - dt)
  for (const d of g.darts) {
    if (d.done) continue
    d.k = Math.min(1, d.k + dt / SHOOT.dart)
    if (d.k >= 1) {
      d.done = true
      // what's under the dart when it gets there
      const hit = g.targets.find((tg) => tg.down === 0 && Math.hypot(targetX(tg, g.t) - d.to.x, SHOOT.rows[tg.row].y - d.to.y) < SHOOT.rows[tg.row].r + 0.025)
      if (hit) {
        hit.down = 1.3
        g.score += SHOOT.rows[hit.row].pts
        g.hits++
        g.pops.push({ x: d.to.x, y: d.to.y, pts: SHOOT.rows[hit.row].pts, t: g.t })
      }
    }
  }
  g.darts = g.darts.filter((d) => !d.done || g.t - d.at < 0.4)
  g.pops = g.pops.filter((p) => g.t - p.t < 0.8)
  if (g.left <= 0 && g.darts.every((d) => d.done)) g.phase = 'done'
}
function tapShooting(g) {
  if (g.phase === 'ready') {
    g.phase = 'play'
    return
  }
  if (g.phase !== 'play' || g.left <= 0) return
  g.shots++
  g.darts.push({ k: 0, to: { ...g.cross }, at: g.t })
}

/* ───────── the same three verbs for all of them ───────── */

const GAMES = {
  ringtoss: { create: createRingToss, step: stepRing, tap: tapRing },
  cans: { create: createCans, step: stepCans, tap: tapCans },
  shooting: { create: createShooting, step: stepShooting, tap: tapShooting },
}
export const createGame = (kind) => GAMES[kind].create()
export const step = (g, dt) => GAMES[g.kind].step(g, Math.min(dt, 0.1))
export const tap = (g) => GAMES[g.kind].tap(g)
export const isDone = (g) => g.phase === 'done'
