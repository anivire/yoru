import { type CueName, type PlayOptions, type SoundSet, type Spec, type ThemeName, play as foleyPlay, getAnalyser, getSet, set, toBuffer, unlock as foleyUnlock } from '@foleyjs/core'
import { onStep, onToast } from '@yoru/ui'
import { useSyncExternalStore } from 'react'

export const SOUND_THEMES = ['soft', 'default', 'mechanical', 'glass'] as const satisfies readonly ThemeName[]
export const SOUND_VOLUMES = ['10', '20', '30', '40', '50', '60', '70', '80', '90', '100'] as const
export type SoundVolume = (typeof SOUND_VOLUMES)[number]
export type SoundCategory = 'interface' | 'notifications' | 'feedback'
export const CLICK_SOUNDS = ['tick', 'hover', 'glide', 'pop', 'tap', 'switch', 'thock'] as const satisfies readonly CueName[]
export type ClickSound = (typeof CLICK_SOUNDS)[number]

export interface SoundSettings {
  enabled: boolean
  volume: SoundVolume
  theme: ThemeName
  click: ClickSound
  interface: boolean
  notifications: boolean
  feedback: boolean
}

const STORAGE_KEY = 'yoru:sounds'
const GAIN = 2
const LOUDNESS_WINDOW = 0.1
const PEAK_LIMIT = 0.28
const CLICK = 'click'
const AWAKE_MS = 30_000
const HUM_LEVEL = 1e-4
const DUCK = 0.35
const LEVELS: Partial<Record<CueName, number>> = { glide: 0.6, tap: 0.85, switch: 0.85, pop: 0.85, thock: 0.85, tick: 0.7, hover: 0.5, on: 1, off: 1, rise: 0.8, bubble: 1, chime: 1, ready: 1, success: 1, error: 1, warning: 1 }
const DEFAULTS: SoundSettings = { enabled: false, volume: '60', theme: 'soft', click: 'glide', interface: true, notifications: true, feedback: true }

function load(): SoundSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<SoundSettings>
    return {
      enabled: raw.enabled === true,
      volume: SOUND_VOLUMES.includes(raw.volume as SoundVolume) ? (raw.volume as SoundVolume) : DEFAULTS.volume,
      theme: SOUND_THEMES.includes(raw.theme as (typeof SOUND_THEMES)[number]) ? (raw.theme as ThemeName) : DEFAULTS.theme,
      click: CLICK_SOUNDS.includes(raw.click as ClickSound) ? (raw.click as ClickSound) : DEFAULTS.click,
      interface: raw.interface !== false,
      notifications: raw.notifications !== false,
      feedback: raw.feedback !== false,
    }
  } catch {
    return DEFAULTS
  }
}

function unlock() {
  foleyUnlock()
  const ctx = getAnalyser()?.context as AudioContext | undefined
  if (!ctx || ctx.state === 'running') return
  void ctx.resume().catch(() => undefined)
  const source = ctx.createBufferSource()
  source.buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
  source.connect(ctx.destination)
  source.start(0)
}

const SOFT_GLIDE: Spec = [{ kind: 'tone', at: 0, wave: 'sine', f: 360, f2: 680, glide: 0.12, a: 0.012, d: 0.12, peak: 0.09, send: 0.15 }]

const soundSets = new Map<ThemeName, SoundSet>()

function soundSet(theme: ThemeName): SoundSet {
  const cached = soundSets.get(theme)
  if (cached) return cached
  set({ theme })
  const result: SoundSet = { name: theme, transform: getSet().transform, cues: { glide: SOFT_GLIDE } }
  soundSets.set(theme, result)
  return result
}

interface Level {
  gain: number
  peak: number
}

function peak(buffer: AudioBuffer) {
  let max = 0
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    for (const x of buffer.getChannelData(c)) max = Math.max(max, Math.abs(x))
  }
  return max
}

function loudness(buffer: AudioBuffer) {
  const data = buffer.getChannelData(0)
  const size = Math.round(buffer.sampleRate * LOUDNESS_WINDOW)
  let sum = 0
  let best = 0
  for (let i = 0; i < data.length; i++) {
    sum += (data[i] ?? 0) ** 2
    if (i >= size) sum -= (data[i - size] ?? 0) ** 2
    if (sum > best) best = sum
  }
  return best
}

const gains = new Map<ThemeName, Partial<Record<CueName, Level>>>()
let reference: Promise<number> | null = null

function measure(theme: ThemeName) {
  if (gains.has(theme) || typeof OfflineAudioContext === 'undefined') return
  const current: Partial<Record<CueName, Level>> = {}
  gains.set(theme, current)
  if (!reference) {
    set({ theme: soundSet('default') })
    reference = toBuffer('on').then((buffer) => (buffer ? loudness(buffer) : 0))
  }
  set({ theme: soundSet(theme) })
  const names = Object.keys(LEVELS) as CueName[]
  const rendered = names.map((name) => toBuffer(name))
  set({ theme: soundSet(state.theme) })
  void Promise.all([reference, ...rendered])
    .then(([target, ...buffers]) => {
      names.forEach((name, i) => {
        const buffer = buffers[i] as AudioBuffer | null
        const level = buffer ? loudness(buffer) : 0
        if (buffer && target && level) current[name] = { gain: Math.min(8, Math.max(0.25, Math.sqrt((target as number) / level) * (LEVELS[name] ?? 1))), peak: peak(buffer) }
      })
    })
    .catch(() => gains.delete(theme))
}

let state = load()
let observer: MutationObserver | null = null
const listeners = new Set<() => void>()

function levelFor(name: CueName) {
  const level = gains.get(state.theme)?.[name]
  if (!level) return 1
  const master = (Number(state.volume) / 100) * GAIN
  return level.peak ? Math.min(level.gain, PEAK_LIMIT / (level.peak * master)) : level.gain
}

function play(name: CueName, opts?: PlayOptions) {
  unlock()
  const random = Math.random
  let calls = 0
  Math.random = () => (++calls <= 2 ? 0.5 : random())
  try {
    foleyPlay(name, { ...opts, volume: (opts?.volume ?? 1) * levelFor(name) })
  } finally {
    Math.random = random
  }
}

let hum: AudioBufferSourceNode | null = null
let sleepTimer = 0
let lastWake = 0

function sleep() {
  window.clearTimeout(sleepTimer)
  if (!hum) return
  hum.stop()
  hum.disconnect()
  hum = null
}

function wake() {
  if (!state.enabled || document.hidden || !navigator.userActivation?.hasBeenActive) return
  const now = performance.now()
  if (hum && now - lastWake < 1000) return
  lastWake = now
  unlock()
  const ctx = getAnalyser()?.context
  if (!ctx) return
  if (!hum) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * HUM_LEVEL
    hum = ctx.createBufferSource()
    hum.buffer = buffer
    hum.loop = true
    hum.connect(ctx.destination)
    hum.start()
  }
  window.clearTimeout(sleepTimer)
  sleepTimer = window.setTimeout(sleep, AWAKE_MS)
}

function playEntering(records: MutationRecord[]) {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (!(node instanceof Element)) continue
      const el = node.matches('[data-foley-enter]') ? node : node.querySelector('[data-foley-enter]')
      const name = el?.getAttribute('data-foley-enter')
      if (name) play(name as CueName)
    }
  }
}

function apply() {
  set({ muted: !state.enabled, volume: (Number(state.volume) / 100) * GAIN, theme: soundSet(state.theme) })
  if (state.enabled) measure(state.theme)
  else sleep()
  const watch = state.enabled && state.interface
  if (watch && !observer) {
    observer = new MutationObserver(playEntering)
    observer.observe(document.documentElement, { childList: true, subtree: true })
  }
  if (!watch && observer) {
    observer.disconnect()
    observer = null
  }
}

export function updateSounds(patch: Partial<SoundSettings>) {
  state = { ...state, ...patch }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
  apply()
  for (const listener of listeners) listener()
}

export function useSounds(): SoundSettings {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}

export function cue(category: SoundCategory, name: CueName) {
  if (state.enabled && state[category]) play(name)
}

export function preview(name: CueName) {
  if (state.enabled) play(name)
}

export function duckSounds(ducked: boolean) {
  set({ duck: ducked ? DUCK : 1 })
}

const CLICKABLE = 'button, a[href], summary, [role="tab"], [role="option"], [role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="switch"], [role="checkbox"], [role="radio"]'
const TOAST_CUES = { success: 'success', error: 'error', warning: 'warning' } as const

function clickCue(target: Element): CueName | typeof CLICK | null {
  const scoped = target.closest('[data-sound]')
  const el = target.closest(CLICKABLE)
  if (scoped && (!el || scoped.contains(el))) {
    const value = scoped.getAttribute('data-sound')
    if (value === 'none') return null
    if (scoped === el && value) return value as CueName
  }
  if (!el) return null
  const role = el.getAttribute('role')
  if (role === 'switch' || role === 'checkbox') return el.getAttribute('aria-checked') === 'true' ? 'off' : 'on'
  const pressed = el.getAttribute('aria-pressed')
  if (pressed === 'true' || pressed === 'false') return pressed === 'true' ? 'off' : 'on'
  return CLICK
}

export function installSounds() {
  apply()
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      sleep()
      return
    }
    if (!state.enabled) return
    const ctx = getAnalyser()?.context as AudioContext | undefined
    if (ctx && ctx.state !== 'running') void ctx.resume().catch(() => undefined)
  })
  for (const event of ['pointermove', 'pointerdown', 'touchstart', 'keydown', 'wheel'] as const) {
    document.addEventListener(event, wake, { capture: true, passive: true })
  }
  let pointer = ''
  const active = () => state.enabled && state.interface
  document.addEventListener(
    'pointerdown',
    (e) => {
      pointer = e.pointerType
      if (!active() || pointer === 'touch' || e.button !== 0 || e.ctrlKey || !(e.target instanceof Element)) return
      if (clickCue(e.target) === CLICK) play(state.click)
    },
    { capture: true, passive: true },
  )
  document.addEventListener(
    'click',
    (e) => {
      if (!active() || !(e.target instanceof Element)) return
      const name = clickCue(e.target)
      if (!name) return
      if (name === CLICK && e.detail > 0 && pointer !== 'touch') return
      play(name === CLICK ? state.click : name)
    },
    { capture: true },
  )
  onStep((position) => {
    if (active()) play('tick', { pitch: position * 7 - 3.5 })
  })
  onToast((kind) => {
    if (kind in TOAST_CUES) cue('feedback', TOAST_CUES[kind as keyof typeof TOAST_CUES])
  })
}
