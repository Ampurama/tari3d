import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import {
  canGetOff,
  coasterState,
  GAMES,
  getOff,
  hasBand,
  rideName,
  saveScore,
  shareGame,
  spinnerState,
  stopSharingGame,
  useBand,
  useBooth,
  useFair,
  useRide,
  useScores,
} from '../../lib/carnival'
import { aimAt, CANS, createGame, isDone, RING, ringTarget, SHOOT, step, tap, targetX } from '../../lib/carnivalGames'
import { serverNow } from '../../lib/clock'
import { coupleAvailable, useCouple } from '../../lib/couple'
import { nameOf } from '../../lib/wishes'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'

/*
 * DREAMLIGHT FUNFAIR — the screens (lib/carnival.js): the little card while she's on a ride (with
 * "Turun" once it's standing still), and the booth games, played on a canvas (the rules and the
 * scoring are lib/carnivalGames.js; this only draws them and passes on her taps).
 */

/* ───────── on a ride ───────── */

export function RideFloat() {
  const ride = useRide((s) => s.ride)
  const near = useFair((s) => s.near)
  const band = useBand((s) => s.day)
  const view = useStore((s) => s.view)
  const [, tick] = useState(0)
  useEffect(() => {
    if (!ride) return
    const id = setInterval(() => tick((n) => n + 1), 250)
    return () => clearInterval(id)
  }, [ride])
  void band
  if (view !== 'explore') return null
  if (!ride) {
    if (!near || hasBand()) return null
    return (
      <section className="date-float">
        <p>🎟️ Ambil Gelang Dreamlight gratis di loket dekat gerbang untuk naik wahana.</p>
      </section>
    )
  }
  const t = serverNow() / 1000
  let text = ''
  if (ride.kind === 'coaster') {
    const st = coasterState(t)
    text = st.cycle === ride.cycle && st.phase === 'board' ? `Kereta berangkat dalam ${Math.ceil(st.left)} detik…` : 'Pegangan erat! 🎢'
  } else if (ride.kind === 'wheel') {
    text = t < ride.at ? `Gondola turun dalam ${Math.ceil(ride.at - t)} detik. Tunggu di peron, ya.` : `Menikmati pemandangan ✨ Kembali ke bawah dalam ${Math.ceil(ride.until - t)} detik.`
  } else if (ride.kind === 'teacups' || ride.kind === 'carousel') {
    const st = spinnerState(ride.kind, t)
    text = st.phase === 'board' ? `Mulai berputar dalam ${Math.ceil(st.left)} detik…` : `Berputar! ${Math.ceil(st.left)} detik lagi.`
  } else if (ride.kind === 'bumper') text = 'Setir dengan WASD / joystick. Tabrak gnome-nya! 💥'
  const off = canGetOff()
  return (
    <section className="date-float">
      <p>
        <strong>{rideName(ride.kind)}</strong> · {text}
      </p>
      <div className="couple-actions">
        <button type="button" className="btn-ghost" disabled={!off} onClick={() => getOff()} title={off ? undefined : 'Tunggu wahananya berhenti dulu, ya'}>
          {ride.kind === 'bumper' ? 'Keluar' : off ? 'Turun' : 'Turun (tunggu berhenti)'}
        </button>
      </div>
    </section>
  )
}

/* ───────── drawing the booth games ───────── */

const W = 360
const H = 270
const PINK = '#ff8fbf'
const INK = '#4a3550'

function drawTent(ctx, stripe) {
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = i % 2 ? '#fff6ea' : stripe
    ctx.fillRect((i * W) / 9, 0, W / 9 + 1, H)
  }
  ctx.fillStyle = 'rgba(40, 20, 60, 0.18)'
  ctx.fillRect(0, 0, W, H)
}
function ellipse(ctx, x, y, rx, ry, fill, stroke, lw = 3) {
  ctx.beginPath()
  ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2)
  if (fill) {
    ctx.fillStyle = fill
    ctx.fill()
  }
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = lw
    ctx.stroke()
  }
}
function hud(ctx, left, right) {
  ctx.fillStyle = 'rgba(255, 250, 242, 0.92)'
  ctx.fillRect(0, 0, W, 26)
  ctx.fillStyle = INK
  ctx.font = "600 13px 'Quicksand', system-ui, sans-serif"
  ctx.textAlign = 'left'
  ctx.fillText(left, 10, 18)
  ctx.textAlign = 'right'
  ctx.fillText(right, W - 10, 18)
}
function banner(ctx, text, color = PINK) {
  ctx.font = "700 26px 'Cormorant Garamond', Georgia, serif"
  ctx.textAlign = 'center'
  ctx.lineWidth = 5
  ctx.strokeStyle = '#fffaf2'
  ctx.strokeText(text, W / 2, H * 0.5)
  ctx.fillStyle = color
  ctx.fillText(text, W / 2, H * 0.5)
}

/* Ring Toss: looking down the booth over a table of bottles */
const F = 230
const proj = (x, y, d) => {
  const z = d + 1.3
  return [W / 2 + (x * F) / z, H * 0.16 + ((1.4 - y) * F) / z, F / z]
}
function drawRing(ctx, g) {
  drawTent(ctx, '#ff8fbf')
  // the table
  const corners = [proj(-1.3, 0.55, 1.0), proj(1.3, 0.55, 1.0), proj(1.3, 0.55, 3.4), proj(-1.3, 0.55, 3.4)]
  ctx.fillStyle = '#c8915f'
  ctx.beginPath()
  corners.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.closePath()
  ctx.fill()
  // where the ring would land now (while choosing the power)
  if (g.phase === 'power') {
    const tg = ringTarget(g.aim, g.power)
    const [x, y, s] = proj(tg.x, 0.55, tg.d)
    ellipse(ctx, x, y, RING.hit * s, RING.hit * s * 0.35, 'rgba(255, 210, 127, 0.45)')
  }
  // bottles, far ones first
  const pegs = [...RING.pegs].sort((a, b) => b.d - a.d)
  for (const p of pegs) {
    const [bx, by, s] = proj(p.x, 0.55, p.d)
    const [, ny] = proj(p.x, 0.98, p.d)
    ctx.fillStyle = '#7fd6a8'
    ctx.fillRect(bx - 0.06 * s, ny + 0.12 * s, 0.12 * s, by - ny - 0.12 * s)
    ctx.fillRect(bx - 0.022 * s, ny, 0.044 * s, 0.14 * s)
    const rings = g.onPeg.filter((q) => q === p).length
    for (let i = 0; i < rings; i++) ellipse(ctx, bx, by - (0.05 + i * 0.03) * s, 0.15 * s, 0.05 * s, null, '#ffd27f', Math.max(2, 0.03 * s))
  }
  // the ring in the air
  if (g.fly) {
    const k = g.fly.k
    const x = g.fly.to.x * k
    const d = 0.2 + (g.fly.to.d - 0.2) * k
    const y = 1.25 + (0.98 - 1.25) * k + Math.sin(k * Math.PI) * 0.55
    const [rx, ry, s] = proj(x, y, d)
    ellipse(ctx, rx, ry, 0.15 * s, 0.06 * s, null, '#ffd27f', Math.max(2, 0.035 * s))
  }
  // aim and power
  if (g.phase === 'aim' || g.phase === 'power') {
    const tx = g.aim * 1.1
    const [ax, ay] = proj(tx, 0.56, 2.2)
    ctx.strokeStyle = 'rgba(255, 250, 242, 0.9)'
    ctx.lineWidth = 3
    ctx.setLineDash([6, 6])
    ctx.beginPath()
    ctx.moveTo(W / 2, H - 6)
    ctx.lineTo(ax, ay)
    ctx.stroke()
    ctx.setLineDash([])
  }
  if (g.phase === 'power') {
    ctx.fillStyle = 'rgba(255, 250, 242, 0.85)'
    ctx.fillRect(W - 28, 40, 16, H - 70)
    ctx.fillStyle = PINK
    const h = (H - 74) * g.power
    ctx.fillRect(W - 26, H - 32 - h, 12, h)
  }
  hud(ctx, `Gelang: ${g.rings}${g.fly ? ' (+1 di udara)' : ''}`, `Masuk: ${g.score}`)
  if (g.phase === 'result' && g.last) banner(ctx, g.last.hit ? 'Masuk! ✦' : 'Meleset…', g.last.hit ? '#2f9e6a' : INK)
  ctx.fillStyle = INK
  ctx.font = "500 12px 'Quicksand', system-ui, sans-serif"
  ctx.textAlign = 'center'
  if (g.phase === 'aim') ctx.fillText('Ketuk untuk mengunci arah', W / 2, H - 12)
  if (g.phase === 'power') ctx.fillText('Ketuk untuk mengunci kekuatan (jauh–dekat)', W / 2, H - 12)
}

/* Can Knockdown: the shelf from the front */
const cx = (x) => W / 2 + x * W * 0.72
const cy = (y) => H * 0.74 - y * H * 0.62
function drawCans(ctx, g) {
  drawTent(ctx, '#5fb3a8')
  ctx.fillStyle = '#a5714a'
  ctx.fillRect(cx(-0.5), cy(0), cx(0.5) - cx(-0.5), 10)
  for (const c of g.cans) {
    const w = (CANS.w * W * 0.72) / 1
    const h = CANS.h * H * 0.62
    ctx.save()
    const fall = c.down ? c.fall : 0
    ctx.translate(cx(c.x) + c.vx * fall * 30, cy(c.y) - h / 2 + fall * fall * 240)
    ctx.rotate(c.spin * fall * 0.6)
    ctx.globalAlpha = c.down ? Math.max(0, 1 - fall * 0.9) : 1
    ctx.fillStyle = ['#e8566f', '#ffd27f', '#5fb3a8'][c.i % 3]
    ctx.fillRect(-w / 2 + 2, -h / 2, w - 4, h)
    ctx.fillStyle = '#fffaf2'
    ctx.fillRect(-w / 2 + 2, -h * 0.12, w - 4, h * 0.24)
    ctx.restore()
  }
  ctx.globalAlpha = 1
  if (g.ball) {
    const k = g.ball.k
    const x = W / 2 + (cx(g.ball.to.x) - W / 2) * k
    const y = H + (cy(g.ball.to.y) - H) * k - Math.sin(k * Math.PI) * 40
    ellipse(ctx, x, y, 16 - k * 8, 16 - k * 8, '#fff6ea', '#e8566f', 2)
  }
  if (g.phase === 'aim') {
    const x = cx(g.aim.x)
    const y = cy(g.aim.y)
    ctx.strokeStyle = '#e8566f'
    ctx.lineWidth = 3
    ellipse(ctx, x, y, 12, 12, null, '#e8566f', 3)
    ctx.beginPath()
    ctx.moveTo(x - 18, y)
    ctx.lineTo(x + 18, y)
    ctx.moveTo(x, y - 18)
    ctx.lineTo(x, y + 18)
    ctx.stroke()
  }
  hud(ctx, `Bola: ${g.balls}`, `Roboh: ${g.score}/6`)
  if (g.phase === 'settle' && g.ball) banner(ctx, g.ball.hit ? 'Brakk! ✦' : 'Meleset…', g.ball.hit ? '#2f9e6a' : INK)
  ctx.fillStyle = INK
  ctx.font = "500 12px 'Quicksand', system-ui, sans-serif"
  ctx.textAlign = 'center'
  if (g.phase === 'aim') ctx.fillText('Ketuk saat bidikan tepat di kaleng', W / 2, H - 12)
}

/* Target Shooting: the gallery from the front */
const sx = (x) => W / 2 + x * W * 0.42
const sy = (y) => H * 0.88 - y * H * 0.72
function star(ctx, x, y, r, fill) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2
    const rr = i % 2 ? r * 0.45 : r
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
}
function drawShooting(ctx, g) {
  drawTent(ctx, '#c9a5e8')
  SHOOT.rows.forEach((row) => {
    ctx.fillStyle = '#a5714a'
    ctx.fillRect(0, sy(row.y) + row.r * H * 0.72 + 4, W, 5)
  })
  for (const tg of g.targets) {
    const row = SHOOT.rows[tg.row]
    const x = sx(targetX(tg, g.t))
    const y = sy(row.y)
    const r = row.r * W * 0.42
    if (tg.down > 0) {
      ctx.fillStyle = 'rgba(80, 60, 90, 0.35)'
      ctx.fillRect(x - r, y + r * 0.7, r * 2, 4)
      continue
    }
    if (row.kind === 'star') star(ctx, x, y, r * 1.2, '#ffd27f')
    else if (row.kind === 'duck') {
      ellipse(ctx, x, y + r * 0.2, r, r * 0.7, '#fff1a8')
      ellipse(ctx, x + r * 0.6, y - r * 0.5, r * 0.45, r * 0.45, '#fff1a8')
      ellipse(ctx, x + r * 1.05, y - r * 0.45, r * 0.25, r * 0.12, '#ffb347')
    } else {
      ctx.fillStyle = '#fff6ea'
      ctx.fillRect(x - r * 0.3, y, r * 0.6, r * 0.9)
      ellipse(ctx, x, y, r, r * 0.6, '#e8566f')
      ellipse(ctx, x - r * 0.4, y - r * 0.15, r * 0.15, r * 0.1, '#ffffff')
      ellipse(ctx, x + r * 0.35, y - r * 0.25, r * 0.12, r * 0.08, '#ffffff')
    }
  }
  for (const d of g.darts) {
    if (d.done) continue
    const x = W / 2 + (sx(d.to.x) - W / 2) * d.k
    const y = H + (sy(d.to.y) - H) * d.k
    ellipse(ctx, x, y, 6 - d.k * 3, 6 - d.k * 3, '#ff8fbf')
  }
  for (const p of g.pops) {
    ctx.fillStyle = '#2f9e6a'
    ctx.font = "700 16px 'Quicksand', system-ui, sans-serif"
    ctx.textAlign = 'center'
    ctx.fillText(`+${p.pts}`, sx(p.x), sy(p.y) - 14 - (g.t - p.t) * 30)
  }
  const x = sx(g.cross.x)
  const y = sy(g.cross.y)
  ctx.strokeStyle = '#e8566f'
  ctx.lineWidth = 2.5
  ellipse(ctx, x, y, 11, 11, null, '#e8566f', 2.5)
  ctx.beginPath()
  ctx.moveTo(x - 16, y)
  ctx.lineTo(x + 16, y)
  ctx.moveTo(x, y - 16)
  ctx.lineTo(x, y + 16)
  ctx.stroke()
  hud(ctx, `Waktu: ${Math.ceil(g.left)} dtk`, `Poin: ${g.score}`)
  if (g.phase === 'ready') banner(ctx, 'Ketuk untuk mulai!')
}
/** (exported for the render test) */
export const DRAW = { ringtoss: drawRing, cans: drawCans, shooting: drawShooting }

/* ───────── a booth game, from the rules to the result ───────── */

function GameSheet({ onClose }) {
  const game = useBooth((s) => s.game)
  const best = useScores((s) => s.best[game])
  const mateId = useCouple((s) => s.mate?.id)
  const connected = useCouple((s) => s.status === 'connected')
  const [stage, setStage] = useState('intro')
  const [result, setResult] = useState(null)
  const canvas = useRef()
  const state = useRef(null)
  const def = GAMES[game]

  // the game loop (only while playing)
  useEffect(() => {
    if (stage !== 'play' || !canvas.current) return
    const el = canvas.current
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    el.width = W * dpr
    el.height = H * dpr
    const ctx = el.getContext('2d')
    ctx.scale(dpr, dpr)
    const g = createGame(game)
    state.current = g
    let raf = 0
    let last = performance.now()
    let shared = -1
    let finished = false
    const frame = (now) => {
      step(g, (now - last) / 1000)
      last = now
      ctx.clearRect(0, 0, W, H)
      DRAW[game](ctx, g)
      if (g.score !== shared) {
        shared = g.score
        shareGame(game, 'playing', g.score)
        if (g.score > 0) audio.sfx('pop', g.score)
      }
      if (isDone(g) && !finished) {
        finished = true
        audio.sfx(g.score >= def.prizeAt ? 'complete' : 'note', 1)
        saveScore(game, g.score).then((r) => setResult({ score: g.score, ...r }))
        setStage('result')
        return
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    shareGame(game, 'playing', 0)
    const onKey = (e) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'e' || e.key === 'E') {
        e.preventDefault()
        tap(g)
        audio.sfx('tick', 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKey)
      if (!finished) stopSharingGame()
    }
  }, [stage, game, def])

  const toGame = (e) => {
    const r = canvas.current.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * W
    const y = ((e.clientY - r.top) / r.height) * H
    return { x: (x - W / 2) / (W * 0.42), y: (H * 0.88 - y) / (H * 0.72) }
  }
  const onPointerMove = (e) => {
    const g = state.current
    if (g?.kind === 'shooting') {
      const p = toGame(e)
      aimAt(g, p.x, p.y)
    }
  }
  const onPointerDown = (e) => {
    const g = state.current
    if (!g) return
    if (g.kind === 'shooting') {
      const p = toGame(e)
      aimAt(g, p.x, p.y)
    }
    tap(g)
    audio.sfx('tick', 1)
  }
  if (!def) return null
  return (
    <motion.div className="panel-backdrop is-soft" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="panel couple-panel date-panel booth-panel" role="dialog" aria-modal="true" aria-label={def.title} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="icon-btn panel-close" onClick={onClose} aria-label="Tutup">
          <X size={18} />
        </button>
        <h2>
          {def.icon} {def.title}
        </h2>
        {stage === 'intro' && (
          <>
            <p className="couple-status">{def.how}</p>
            <p className="booth-prize">
              Hadiah: <strong>{def.prizeName}</strong> untuk Rumah Kita (skor {def.prizeAt}
              {game === 'shooting' ? '+' : ''}).
            </p>
            <p className="booth-best">
              Skor terbaik — kamu: {best?.mine ?? '–'} · {nameOf(mateId)}: {best?.mate ?? '–'}
            </p>
            <button type="button" className="btn-glow" onClick={() => setStage('play')}>
              Mulai main
            </button>
          </>
        )}
        {stage === 'play' && (
          <canvas ref={canvas} className="booth-canvas" style={{ aspectRatio: `${W} / ${H}` }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} aria-label={`${def.title}: ketuk untuk bermain`} />
        )}
        {stage === 'result' && (
          <div className="booth-result">
            <p className="booth-score">
              Skor: <strong>{result?.score ?? '…'}</strong>
              {game === 'ringtoss' ? ' / 5 gelang' : game === 'cans' ? ' / 6 kaleng' : ' poin'}
            </p>
            {result && (
              <>
                <p className="couple-status">
                  Skor terbaikmu: {result.best}
                  {result.coins ? ` · +${result.coins} koin hati` : ''}
                </p>
                {result.prize ? (
                  <p className="booth-prize is-won">
                    🎁 {def.prizeName} untuk Rumah Kita! {result.saved ? 'Ada di katalog Mode Bangun.' : 'Masuk berdua dulu supaya hadiahnya tersimpan.'}
                  </p>
                ) : (
                  <p className="couple-status">Butuh skor {def.prizeAt} untuk hadiahnya. Coba lagi!</p>
                )}
                {!result.saved && coupleAvailable && connected && <p className="couple-error">Skor belum tersimpan di server (013_carnival.sql sudah dijalankan?).</p>}
              </>
            )}
            <div className="couple-actions">
              <button
                type="button"
                className="btn-glow"
                onClick={() => {
                  setResult(null)
                  setStage('play')
                }}
              >
                Main lagi
              </button>
              <button type="button" className="btn-ghost" onClick={onClose}>
                Selesai
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

export default function CarnivalUI() {
  const panel = useStore((s) => s.panel)
  const setPanel = useStore((s) => s.setPanel)
  const phase = useStore((s) => s.phase)
  if (phase !== 'world') return null
  return (
    <>
      {!coupleAvailable && (
        <div className="top-stack">
          <RideFloat />
        </div>
      )}
      <AnimatePresence>{panel === 'carnival-game' && <GameSheet key="booth" onClose={() => setPanel(null)} />}</AnimatePresence>
    </>
  )
}
