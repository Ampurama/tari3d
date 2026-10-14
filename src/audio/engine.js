/**
 * Tiny audio engine.
 *  • Music: either your own file (config.music.src) or a gentle generated waltz (original, written
 *    in the spirit of hand-drawn adventure films: soft piano, warm strings, 3/4 time).
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

/*
 * THE WALTZ — an original piece in C major, 3/4 time, two bars per chord:
 *   IVmaj7 – V6 – iii7 – vi9 – ii7 – V7sus4 – Iadd9 – III7 (which leans back into the start)
 * Soft piano (a low note on beat one, a gentle chord on beats two and three), warm strings that
 * swell under each chord, and a singable, slightly nostalgic melody on top.
 */
const W = (root, comp, pad) => ({ root, comp, pad })
const WALTZ = [
  W('F2', ['A3', 'C4', 'E4'], ['F3', 'A3', 'C4', 'E4']),
  W('G2', ['B3', 'D4', 'E4'], ['G3', 'B3', 'D4', 'E4']),
  W('E2', ['G3', 'B3', 'D4'], ['E3', 'G3', 'B3', 'D4']),
  W('A2', ['C4', 'E4', 'B4'], ['A3', 'C4', 'E4', 'B4']),
  W('D2', ['F3', 'A3', 'C4'], ['D3', 'F3', 'A3', 'C4']),
  W('G2', ['C4', 'D4', 'F4'], ['G3', 'C4', 'D4', 'F4']),
  W('C2', ['E3', 'G3', 'D4'], ['C3', 'E3', 'G3', 'D4']),
  W('E2', ['G#3', 'B3', 'D4'], ['E3', 'G#3', 'B3', 'D4']),
]
const BAR = 6 // eighths in a bar of 3/4
const CHORD_STEPS = 12 // two bars
const LOOP_STEPS = WALTZ.length * CHORD_STEPS // 16 bars

// The melody, in eighth-note steps: [step within the 16-bar loop, note, length in eighths]
const MELODY = [
  [0, 'A4', 3], [3, 'C5', 1], [4, 'E5', 2], [6, 'F5', 4], [10, 'E5', 2],
  [12, 'D5', 3], [15, 'E5', 1], [16, 'G5', 2], [18, 'E5', 6],
  [24, 'B4', 3], [27, 'C5', 1], [28, 'D5', 2], [30, 'G5', 6],
  [36, 'E5', 3], [39, 'D5', 1], [40, 'C5', 2], [42, 'B4', 2], [44, 'C5', 4],
  [48, 'A4', 3], [51, 'C5', 1], [52, 'F5', 2], [54, 'E5', 4], [58, 'D5', 2],
  [60, 'C5', 3], [63, 'D5', 1], [64, 'G5', 2], [66, 'F5', 6],
  [72, 'E5', 3], [75, 'G5', 1], [76, 'C6', 2], [78, 'B5', 2], [80, 'G5', 4],
  [84, 'B4', 3], [87, 'D5', 1], [88, 'G#5', 4], [92, 'E5', 4],
]

/*
 * Moods: the same waltz, played differently for each part of the journey.
 *   bpm     — quarter notes per minute
 *   melody  — the tune on top (it rests every third time round, so it can breathe)
 *   comp    — loudness of the "oom-pah-pah" piano chords (0 = none)
 *   strings — loudness of the string swells (0 = none)
 *   arp     — a flowing broken chord when the melody rests
 * The scheduler switches mood at the next chord, so changes are always smooth.
 */
const MOODS = {
  // avatar selection: slow and airy, strings and broken chords only
  select: { bpm: 80, melody: false, comp: 0, strings: 0.8, arp: 1 },
  // exploring, chapters 1–2: the full waltz
  little: { bpm: 96, melody: true, comp: 1, strings: 0.7, arp: 1 },
  // the two islands: more space, softer
  miles: { bpm: 84, melody: true, comp: 0.6, strings: 1, arp: 0.6 },
  // later chapters and the picnic: brighter, a little quicker
  future: { bpm: 104, melody: true, comp: 1.1, strings: 0.6, arp: 1 },
  // the letter and the finale: slower, the strings carry it
  finale: { bpm: 76, melody: true, comp: 0.7, strings: 1.3, arp: 0.8 },
  // the secret ending: almost still
  quiet: { bpm: 66, melody: false, comp: 0, strings: 1, arp: 0.5 },
}

const AUDIO_PREFS = 'our-little-universe:audio'
const loadPrefs = () => {
  try {
    return JSON.parse(localStorage.getItem(AUDIO_PREFS)) || {}
  } catch {
    return {}
  }
}
const savePrefs = (p) => {
  try {
    localStorage.setItem(AUDIO_PREFS, JSON.stringify({ ...loadPrefs(), ...p }))
  } catch {
    /* ignore */
  }
}

class AudioEngine {
  ctx = null
  master = null
  reverb = null
  musicBus = null
  ambientBus = null
  musicOn = false
  ambientOn = false
  prefs = loadPrefs()
  /** sound effects for interactions (on by default) */
  sfxOn = this.prefs.sfxOn !== false
  /** master volume 0..1 */
  volume = typeof this.prefs.volume === 'number' ? this.prefs.volume : 0.85
  mood = 'little'
  pendingMood = null
  /** 0..1 — Chapter 2 warms up as connections are restored */
  warmth = 0
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
    const state = { musicOn: this.musicOn, ambientOn: this.ambientOn, sfxOn: this.sfxOn, volume: this.volume }
    this.listeners.forEach((fn) => fn(state))
  }

  /** Did she turn the music off herself last time? Then it stays off until she turns it on. */
  get musicWanted() {
    return this.prefs.musicOn !== false
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v))
    savePrefs({ volume: this.volume })
    if (this.master) this.fade(this.master.gain, this.volume, 0.2)
    this.emit()
  }

  setSfx(on) {
    this.sfxOn = on
    savePrefs({ sfxOn: on })
    this.emit()
  }

  /** Switch the musical mood; takes effect on the next chord so it never jumps. */
  setMood(mood) {
    if (!MOODS[mood] || (this.mood === mood && !this.pendingMood)) return
    this.pendingMood = mood
  }

  setWarmth(w) {
    this.warmth = Math.max(0, Math.min(1, w))
  }

  eighth() {
    return 60 / MOODS[this.mood].bpm / 2
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
    this.master.gain.value = this.volume
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
    if (user) {
      this.userMuted = !on
      this.prefs.musicOn = on
      savePrefs({ musicOn: on })
    }
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
      // a new mood starts on a chord change
      if (this.pendingMood && this.step % CHORD_STEPS === 0) {
        this.mood = this.pendingMood
        this.pendingMood = null
      }
      this.playStep(this.step, this.nextTime)
      this.nextTime += this.eighth()
      this.step = (this.step + 1) % LOOP_STEPS
      if (this.step === 0) this.loop++
    }
  }

  playStep(step, time) {
    const mood = MOODS[this.mood]
    const E = this.eighth()
    const chord = WALTZ[Math.floor(step / CHORD_STEPS) % WALTZ.length]
    const inBar = step % BAR
    // strings swell under every chord (the bridge chapter warms them up as it's restored)
    const strings = mood.strings * (this.mood === 'miles' ? 0.6 + this.warmth * 0.6 : 1)
    if (step % CHORD_STEPS === 0 && strings > 0) chord.pad.forEach((n) => this.strings(freq(n), time, E * CHORD_STEPS, strings))
    // oom — the low note on beat one
    if (inBar === 0) this.piano(freq(chord.root), time, 0.075, E * 5)
    // pah-pah — a soft chord on beats two and three
    if (mood.comp && (inBar === 2 || inBar === 4)) chord.comp.forEach((n) => this.piano(freq(n), time, 0.016 * mood.comp, E * 2.2))
    const withMelody = mood.melody && this.loop % 3 !== 2
    if (withMelody) {
      const note = MELODY.find((m) => m[0] === step)
      if (note) this.piano(freq(note[1]), time, 0.075, Math.max(1.2, note[2] * E * 1.7))
    } else if (mood.arp && inBar % 2 === 1 && ((step * 5 + this.loop) % 10) / 10 < mood.arp) {
      // when the tune rests: a gentle broken chord rising through the harmony
      const n = chord.pad[(Math.floor(step / 2) + this.loop) % chord.pad.length]
      this.piano(freq(n) * 2, time, 0.03, E * 3)
    }
  }

  /** A soft piano-like note: a quick hammer, a warm body, a long gentle fade. */
  piano(f, time, gain, length) {
    const ctx = this.ctx
    const out = ctx.createGain()
    out.gain.setValueAtTime(0, time)
    out.gain.linearRampToValueAtTime(gain, time + 0.006)
    out.gain.exponentialRampToValueAtTime(gain * 0.45, time + 0.28)
    out.gain.exponentialRampToValueAtTime(0.0001, time + length + 0.6)
    const tone = ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = Math.min(5200, f * 6)
    tone.connect(out).connect(this.musicBus)
    ;[
      ['sine', 1, 1],
      ['triangle', 2, 0.18],
      ['sine', 3, 0.06],
    ].forEach(([type, ratio, g]) => {
      const osc = ctx.createOscillator()
      osc.type = type
      osc.frequency.value = f * ratio
      const og = ctx.createGain()
      og.gain.value = g
      osc.connect(og).connect(tone)
      osc.start(time)
      osc.stop(time + length + 0.7)
    })
  }

  /** A warm string swell: two slightly detuned saws, softened, with a slow vibrato. */
  strings(f, time, length, level = 1) {
    const ctx = this.ctx
    const out = ctx.createGain()
    const peak = 0.011 * level
    out.gain.setValueAtTime(0, time)
    out.gain.linearRampToValueAtTime(peak, time + 1.6)
    out.gain.setValueAtTime(peak, time + Math.max(1.7, length - 0.8))
    out.gain.linearRampToValueAtTime(0, time + length + 1.4)
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 1150
    filter.Q.value = 0.4
    filter.connect(out).connect(this.musicBus)
    const vibrato = ctx.createOscillator()
    vibrato.frequency.value = 5
    const depth = ctx.createGain()
    depth.gain.value = 4
    vibrato.connect(depth)
    ;[-7, 7].forEach((detune) => {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = f
      osc.detune.value = detune
      depth.connect(osc.detune)
      osc.connect(filter)
      osc.start(time)
      osc.stop(time + length + 1.5)
    })
    vibrato.start(time)
    vibrato.stop(time + length + 1.5)
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
      if (this.ctx && this.musicOn && !musicConfig.src) this.fade(this.musicBus.gain, this.baseLevel(), 1)
      if (this.file && this.musicOn) this.file.volume = this.baseLevel()
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
    const volume = this.baseLevel()
    if (on) clearTimeout(this.climaxTimer)
    if (!this.musicOn || this.voice) return
    if (this.ctx && !musicConfig.src) this.fade(this.musicBus.gain, on ? 0.12 : volume, on ? 0.5 : 1.2)
    if (this.file) this.file.volume = on ? 0.12 : volume
  }

  /** Normal music level, or the quieter one while the secret ending is playing. */
  baseLevel() {
    const volume = musicConfig.volume ?? 0.55
    return this.softened ? volume * 0.25 : volume
  }

  /**
   * Slowly lowers the music (secret ending) or brings it back. Never starts music by itself.
   * `seconds` is how long the fade takes.
   */
  soften(on, seconds = 5) {
    if (this.softened === on) return
    this.softened = on
    clearTimeout(this.climaxTimer)
    clearInterval(this.softTimer)
    if (!this.musicOn || this.ducked || this.voice) return
    const target = this.baseLevel()
    if (this.ctx && !musicConfig.src) this.fade(this.musicBus.gain, target, seconds)
    if (this.file) {
      // HTMLAudio has no ramps: step the volume gently
      const from = this.file.volume
      const start = performance.now()
      this.softTimer = setInterval(() => {
        const t = Math.min(1, (performance.now() - start) / (seconds * 1000))
        if (this.file) this.file.volume = from + (target - from) * t
        if (t >= 1) clearInterval(this.softTimer)
      }, 100)
    }
  }

  /** Short interaction sounds. They follow the "sound effects" setting, not the music toggle. */
  sfx(kind, n = 0) {
    if (!this.sfxOn || !this.ensure()) return
    const ctx = this.ctx
    const t = ctx.currentTime + 0.01
    const out = this.master
    const notes = (list, gap, gain, len) => list.forEach((nm, i) => this.bellTo(out, freq(nm), t + i * gap, gain, len))
    switch (kind) {
      case 'reveal':
        notes(['E5', 'G5', 'B5'], 0.09, 0.05, 1.8)
        break
      case 'bloom':
        notes(['C5', 'E5', 'G5', 'A5', 'C6'], 0.07, 0.045, 2.2)
        break
      case 'rise':
        notes(['G4', 'C5', 'E5', 'G5', 'C6', 'E6'], 0.08, 0.045, 2.4)
        break
      case 'pickup':
        notes(['A5', 'E6'], 0.08, 0.05, 1.2)
        break
      case 'plant': {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.frequency.setValueAtTime(160, t)
        o.frequency.exponentialRampToValueAtTime(70, t + 0.25)
        g.gain.setValueAtTime(0.12, t)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
        o.connect(g).connect(out)
        o.start(t)
        o.stop(t + 0.4)
        notes(['D5', 'A5'], 0.12, 0.035, 1.4)
        break
      }
      case 'water':
        notes(['B5', 'F#6', 'B6'], 0.05, 0.03, 0.9)
        break
      case 'light':
        notes(['E6'], 0, 0.05, 2)
        break
      case 'tick':
        notes(['C6'], 0, 0.02, 0.25)
        break
      case 'note':
        notes([['C5', 'D5', 'E5', 'G5', 'A5'][n % 5]], 0, 0.06, 1.6)
        break
      case 'complete':
        ;['C4', 'G4', 'E5', 'C6'].forEach((nm) => this.bellTo(out, freq(nm), t, 0.04, 3.2))
        notes(['G5', 'C6', 'E6'], 0.12, 0.03, 2.4)
        break
      case 'squeak':
      case 'boing': {
        // the companion's little voice: a quick pitch glide (squeak = up, boing = down)
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.type = kind === 'boing' ? 'triangle' : 'sine'
        const base = kind === 'boing' ? 420 : 640 + (n % 4) * 90
        o.frequency.setValueAtTime(base, t)
        o.frequency.exponentialRampToValueAtTime(kind === 'boing' ? 150 : base * 1.9, t + (kind === 'boing' ? 0.28 : 0.12))
        g.gain.setValueAtTime(0.0001, t)
        g.gain.exponentialRampToValueAtTime(kind === 'boing' ? 0.07 : 0.05, t + 0.02)
        g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'boing' ? 0.32 : 0.16))
        o.connect(g).connect(out)
        o.start(t)
        o.stop(t + 0.4)
        break
      }
      case 'step': {
        // a soft footstep: a tiny low thump
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.frequency.setValueAtTime(110 + (n % 2) * 18, t)
        o.frequency.exponentialRampToValueAtTime(55, t + 0.06)
        g.gain.setValueAtTime(0.022, t)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08)
        o.connect(g).connect(out)
        o.start(t)
        o.stop(t + 0.1)
        break
      }
      case 'pop':
        notes(['C6', 'G6'], 0.04, 0.035, 0.5)
        break
      default:
        break
    }
  }

  /** The music box from Chapter 1 — a short tune that plays even when the background music is off. */
  musicBox() {
    if (!this.ensure()) return
    const ctx = this.ctx
    const tune = ['E5', 'G5', 'A5', 'G5', 'E5', 'D5', 'E5', 'G5', 'C6', 'B5', 'A5', 'G5', 'E5', 'G5', 'A5']
    const t0 = ctx.currentTime + 0.05
    if (this.musicOn) this.duck(true)
    tune.forEach((nm, i) => this.bellTo(this.master, freq(nm), t0 + i * 0.32 + (i % 4 === 3 ? 0.08 : 0), 0.07, 1.8))
    clearTimeout(this.boxTimer)
    this.boxTimer = setTimeout(() => this.duck(false), tune.length * 320 + 900)
  }

  /** A bell routed to any destination (used by sound effects). */
  bellTo(dest, f, time, gain, length) {
    const ctx = this.ctx
    const out = ctx.createGain()
    out.gain.setValueAtTime(0, time)
    out.gain.linearRampToValueAtTime(gain, time + 0.006)
    out.gain.exponentialRampToValueAtTime(0.0001, time + length)
    out.connect(dest)
    out.connect(this.reverb)
    ;[
      [1, 1],
      [2, 0.25],
      [2.76, 0.06],
    ].forEach(([ratio, g]) => {
      const osc = ctx.createOscillator()
      osc.frequency.value = f * ratio
      const og = ctx.createGain()
      og.gain.value = g
      osc.connect(og).connect(out)
      osc.start(time)
      osc.stop(time + length + 0.05)
    })
  }

  /** Little sparkle when something magical is opened (only if sound is already on). */
  sparkle() {
    if (!this.ctx || (!this.musicOn && !this.ambientOn)) return
    this.chime(0.04, this.master)
  }
}

export const audio = new AudioEngine()
