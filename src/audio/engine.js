/**
 * Tiny audio engine.
 *  • Music: either your own file (config.music.src) or a gentle generated music-box piece.
 *  • Ambient: soft generated wind with the occasional wind-chime.
 * Everything is created lazily on the first user gesture, so nothing ever autoplays.
 */
import { music as musicConfig } from '../content/config'

const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 }
const freq = (name) => {
  const m = /^([A-G]#?)(\d)$/.exec(name)
  const midi = (Number(m[2]) + 1) * 12 + NOTE[m[1]]
  return 440 * 2 ** ((midi - 69) / 12)
}

// IV – V – iii – vi in C major, two bars each. Soft, hopeful, a little bittersweet.
const CHORDS = [
  { root: 'F2', pad: ['F3', 'A3', 'C4', 'E4'], arp: ['F4', 'A4', 'C5', 'E5', 'A5'] },
  { root: 'G2', pad: ['G3', 'B3', 'D4', 'E4'], arp: ['G4', 'B4', 'D5', 'E5', 'G5'] },
  { root: 'E2', pad: ['E3', 'G3', 'B3', 'D4'], arp: ['E4', 'G4', 'B4', 'D5', 'G5'] },
  { root: 'A2', pad: ['A3', 'C4', 'E4', 'G4'], arp: ['A4', 'C5', 'E5', 'G5', 'A5'] },
]

// Melody in eighth-note steps: [step within the 8-bar loop, note, length in eighths]
const MELODY = [
  [0, 'E5', 2], [2, 'F5', 2], [4, 'A5', 4], [8, 'G5', 6], [14, 'E5', 2],
  [16, 'D5', 2], [18, 'E5', 2], [20, 'G5', 4], [24, 'E5', 6], [30, 'D5', 2],
  [32, 'B4', 2], [34, 'D5', 2], [36, 'G5', 4], [40, 'E5', 4], [44, 'D5', 2], [46, 'C5', 2],
  [48, 'C5', 2], [50, 'E5', 2], [52, 'A5', 2], [54, 'G5', 2], [56, 'E5', 8],
]
const ARP_PATTERNS = [
  [0, 2, 3, 4, 3, 2, 1, 2],
  [0, 1, 2, 4, 2, 3, 1, 2],
  [0, 2, 1, 3, 2, 4, 3, 1],
]

const BPM = 68
const EIGHTH = 60 / BPM / 2
const LOOP_STEPS = 64 // 8 bars

class AudioEngine {
  ctx = null
  master = null
  reverb = null
  musicBus = null
  ambientBus = null
  musicOn = false
  ambientOn = false
  step = 0
  nextTime = 0
  loop = 0
  timer = null
  chimeTimer = null
  file = null
  listeners = new Set()

  subscribe(fn) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  emit() {
    this.listeners.forEach((fn) => fn({ musicOn: this.musicOn, ambientOn: this.ambientOn }))
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume()
      return this.ctx
    }
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    const ctx = (this.ctx = new Ctx())

    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.ratio.value = 3
    comp.connect(ctx.destination)

    this.master = ctx.createGain()
    this.master.gain.value = 1
    this.master.connect(comp)

    this.reverb = ctx.createConvolver()
    this.reverb.buffer = this.impulse(3.2, 2.4)
    const wet = ctx.createGain()
    wet.gain.value = 0.55
    this.reverb.connect(wet).connect(this.master)

    this.musicBus = ctx.createGain()
    this.musicBus.gain.value = 0
    this.musicBus.connect(this.master)
    this.musicSend = ctx.createGain()
    this.musicSend.gain.value = 0.6
    this.musicBus.connect(this.musicSend).connect(this.reverb)

    this.ambientBus = ctx.createGain()
    this.ambientBus.gain.value = 0
    this.ambientBus.connect(this.master)

    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return
      if (document.hidden) {
        this.ctx.suspend()
        this.file?.pause()
      } else {
        if (this.musicOn || this.ambientOn) this.ctx.resume()
        if (this.musicOn) this.file?.play().catch(() => {})
      }
    })
    return ctx
  }

  impulse(seconds, decay) {
    const ctx = this.ctx
    const length = Math.floor(ctx.sampleRate * seconds)
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const data = buffer.getChannelData(c)
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay
    }
    return buffer
  }

  fade(param, to, seconds = 1.2) {
    const now = this.ctx.currentTime
    param.cancelScheduledValues(now)
    param.setValueAtTime(param.value, now)
    param.linearRampToValueAtTime(to, now + seconds)
  }

  /* ───────── music ───────── */

  setMusic(on, { user = false } = {}) {
    if (!this.ensure()) return
    if (user) this.userMuted = !on
    if (!on) clearTimeout(this.climaxTimer)
    this.musicOn = on
    const volume = musicConfig.volume ?? 0.55

    if (musicConfig.src) {
      if (!this.file) {
        this.file = new Audio(musicConfig.src)
        this.file.loop = true
        this.file.preload = 'auto'
        this.file.addEventListener('error', () => {
          // File missing → fall back to the generated melody.
          this.file = null
          musicConfig.src = null
          if (this.musicOn) this.setMusic(true)
        })
      }
      if (on) {
        this.file.volume = volume
        this.file.play().catch(() => {})
      } else this.file.pause()
    } else if (on) {
      if (!this.timer) {
        this.step = 0
        this.loop = 0
        this.nextTime = this.ctx.currentTime + 0.15
        this.timer = setInterval(() => this.schedule(), 60)
      }
      this.fade(this.musicBus.gain, volume, 1.5)
    } else {
      this.fade(this.musicBus.gain, 0, 1)
      const t = this.timer
      setTimeout(() => {
        if (!this.musicOn && this.timer === t) {
          clearInterval(this.timer)
          this.timer = null
        }
      }, 1200)
    }
    this.emit()
  }

  schedule() {
    const ctx = this.ctx
    if (ctx.state !== 'running') {
      this.nextTime = ctx.currentTime + 0.1
      return
    }
    while (this.nextTime < ctx.currentTime + 0.25) {
      this.playStep(this.step, this.nextTime)
      this.nextTime += EIGHTH
      this.step = (this.step + 1) % LOOP_STEPS
      if (this.step === 0) this.loop++
    }
  }

  playStep(step, time) {
    const chord = CHORDS[Math.floor(step / 16)]
    const inChord = step % 16
    if (inChord === 0) {
      chord.pad.forEach((n) => this.pad(freq(n), time, EIGHTH * 16))
      this.bass(freq(chord.root), time, EIGHTH * 16)
    }
    // Arpeggio — sparser when the melody plays so they don't crowd each other.
    const withMelody = this.loop % 2 === 0
    const pattern = ARP_PATTERNS[(Math.floor(step / 8) + this.loop) % ARP_PATTERNS.length]
    const idx = pattern[step % 8]
    if (!withMelody || step % 2 === 0) {
      this.bell(freq(chord.arp[idx]) / (withMelody ? 2 : 1), time, withMelody ? 0.035 : 0.05, 1.6)
    }
    if (withMelody) {
      const note = MELODY.find((m) => m[0] === step)
      if (note) this.bell(freq(note[1]), time, 0.085, Math.max(1.8, note[2] * EIGHTH * 1.4))
    }
  }

  bell(f, time, gain, length) {
    const ctx = this.ctx
    const out = ctx.createGain()
    out.gain.setValueAtTime(0, time)
    out.gain.linearRampToValueAtTime(gain, time + 0.008)
    out.gain.exponentialRampToValueAtTime(0.0001, time + length)
    out.connect(this.musicBus)
    ;[
      [1, 1],
      [2, 0.28],
      [3.01, 0.08],
    ].forEach(([ratio, g]) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = f * ratio
      const og = ctx.createGain()
      og.gain.value = g
      osc.connect(og).connect(out)
      osc.start(time)
      osc.stop(time + length + 0.05)
    })
  }

  pad(f, time, length) {
    const ctx = this.ctx
    const out = ctx.createGain()
    out.gain.setValueAtTime(0, time)
    out.gain.linearRampToValueAtTime(0.022, time + 1.4)
    out.gain.setValueAtTime(0.022, time + length - 0.6)
    out.gain.linearRampToValueAtTime(0, time + length + 1.2)
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 1100
    filter.connect(out).connect(this.musicBus)
    ;[-6, 6].forEach((detune) => {
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = f
      osc.detune.value = detune
      osc.connect(filter)
      osc.start(time)
      osc.stop(time + length + 1.3)
    })
  }

  bass(f, time, length) {
    const ctx = this.ctx
    const out = ctx.createGain()
    out.gain.setValueAtTime(0, time)
    out.gain.linearRampToValueAtTime(0.07, time + 0.6)
    out.gain.linearRampToValueAtTime(0, time + length)
    out.connect(this.musicBus)
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = f
    osc.connect(out)
    osc.start(time)
    osc.stop(time + length + 0.1)
  }

  /* ───────── ambient ───────── */

  setAmbient(on) {
    if (!this.ensure()) return
    this.ambientOn = on
    if (on) {
      if (!this.wind) this.wind = this.createWind()
      this.fade(this.ambientBus.gain, 1, 2)
      this.queueChime()
    } else {
      this.fade(this.ambientBus.gain, 0, 1.2)
      clearTimeout(this.chimeTimer)
    }
    this.emit()
  }

  createWind() {
    const ctx = this.ctx
    const length = ctx.sampleRate * 4
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02 // brown-ish noise
      data[i] = last * 3.5
    }
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 420
    band.Q.value = 0.7
    const gain = ctx.createGain()
    gain.gain.value = 0.22
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.06
    const lfoDepth = ctx.createGain()
    lfoDepth.gain.value = 220
    lfo.connect(lfoDepth).connect(band.frequency)
    const lfo2 = ctx.createOscillator()
    lfo2.frequency.value = 0.045
    const lfo2Depth = ctx.createGain()
    lfo2Depth.gain.value = 0.1
    lfo2.connect(lfo2Depth).connect(gain.gain)
    src.connect(band).connect(gain).connect(this.ambientBus)
    src.start()
    lfo.start()
    lfo2.start()
    return src
  }

  queueChime() {
    clearTimeout(this.chimeTimer)
    this.chimeTimer = setTimeout(() => {
      if (!this.ambientOn) return
      this.chime(0.05)
      this.queueChime()
    }, 3500 + Math.random() * 6000)
  }

  chime(gain = 0.05, target) {
    const ctx = this.ctx
    if (!ctx || ctx.state !== 'running') return
    const notes = ['C6', 'D6', 'E6', 'G6', 'A6', 'C7']
    const count = 2 + Math.floor(Math.random() * 3)
    for (let i = 0; i < count; i++) {
      const t = ctx.currentTime + i * (0.09 + Math.random() * 0.12)
      const f = freq(notes[Math.floor(Math.random() * notes.length)])
      const out = ctx.createGain()
      out.gain.setValueAtTime(0, t)
      out.gain.linearRampToValueAtTime(gain, t + 0.005)
      out.gain.exponentialRampToValueAtTime(0.0001, t + 2.8)
      out.connect(target || this.ambientBus)
      out.connect(this.reverb)
      ;[1, 2.76, 5.4].forEach((ratio, k) => {
        const osc = ctx.createOscillator()
        osc.frequency.value = f * ratio
        const og = ctx.createGain()
        og.gain.value = [1, 0.3, 0.1][k]
        osc.connect(og).connect(out)
        osc.start(t)
        osc.stop(t + 2.9)
      })
    }
  }

  /**
   * Final cutscene: the music swells to a climax, then settles.
   * Must be called from a user gesture (the "Awaken" button), so it may also start the music.
   */
  climax(seconds = 12) {
    if (!this.ensure()) return
    const ctx = this.ctx
    clearTimeout(this.climaxTimer) // a replay must not be cut short by an older restore
    if (!this.musicOn) {
      if (this.userMuted) return // she muted the music herself: respect that
      this.setMusic(true)
    }
    const volume = musicConfig.volume ?? 0.55
    const now = ctx.currentTime
    if (!musicConfig.src) {
      this.fade(this.musicBus.gain, Math.min(1, volume * 1.7), seconds * 0.45)
      // a wide, slowly blooming chord under everything
      ;['F2', 'C3', 'F3', 'A3', 'C4', 'G4', 'A4', 'E5'].forEach((n, i) => {
        const out = ctx.createGain()
        out.gain.setValueAtTime(0, now)
        out.gain.linearRampToValueAtTime(0.03 + (i < 2 ? 0.02 : 0), now + seconds * 0.55)
        out.gain.linearRampToValueAtTime(0, now + seconds + 2)
        out.connect(this.musicBus)
        const osc = ctx.createOscillator()
        osc.type = i < 2 ? 'sine' : 'triangle'
        osc.frequency.value = freq(n)
        osc.connect(out)
        osc.start(now)
        osc.stop(now + seconds + 2.2)
      })
      // a rising cascade of bells at the peak
      const bells = ['C5', 'E5', 'G5', 'A5', 'C6', 'E6', 'G6', 'A6', 'C7']
      bells.forEach((n, i) => this.bell(freq(n), now + seconds * 0.5 + i * 0.16, 0.07, 3.2))
      this.climaxTimer = setTimeout(() => this.musicOn && !this.ducked && this.fade(this.musicBus.gain, volume, 4), seconds * 1000)
    } else if (this.file) {
      // with a custom song: simply bring it up for the climax
      this.file.volume = Math.min(1, volume * 1.6)
      this.climaxTimer = setTimeout(() => this.file && !this.ducked && (this.file.volume = volume), seconds * 1000)
    }
  }

  /**
   * Plays a voice note, gently lowering the music while it speaks.
   * Returns the <audio> element (so the UI can show play/pause), or null if it can't play.
   */
  playVoice(src, onEnd) {
    this.stopVoice()
    const el = new Audio(src)
    this.voice = el
    const restore = () => {
      if (this.voice === el) this.voice = null
      if (this.ctx && this.musicOn && !musicConfig.src) this.fade(this.musicBus.gain, musicConfig.volume ?? 0.55, 1)
      if (this.file && this.musicOn) this.file.volume = musicConfig.volume ?? 0.55
      onEnd?.()
    }
    el.addEventListener('ended', restore)
    el.addEventListener('error', restore)
    if (this.ensure() && this.musicOn && !musicConfig.src) this.fade(this.musicBus.gain, 0.12, 0.6)
    if (this.file && this.musicOn) this.file.volume = 0.12
    el.play().catch(restore)
    return el
  }

  stopVoice() {
    if (!this.voice) return
    const el = this.voice
    this.voice = null
    el.pause()
    el.dispatchEvent(new Event('ended'))
  }

  /** Lower the music while a video or recording in the page is playing; restore it afterwards. */
  duck(on) {
    this.ducked = on
    const volume = musicConfig.volume ?? 0.55
    if (on) clearTimeout(this.climaxTimer)
    if (!this.musicOn || this.voice) return
    if (this.ctx && !musicConfig.src) this.fade(this.musicBus.gain, on ? 0.12 : volume, on ? 0.5 : 1.2)
    if (this.file) this.file.volume = on ? 0.12 : volume
  }

  /** Little sparkle when something magical is opened (only if sound is already on). */
  sparkle() {
    if (!this.ctx || (!this.musicOn && !this.ambientOn)) return
    this.chime(0.04, this.master)
  }
}

export const audio = new AudioEngine()
