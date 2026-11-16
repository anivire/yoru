import { type CueName, type PlayOptions, type SoundSet, type Spec, type ThemeName, play as foleyPlay, getAnalyser, getSet, set, unlock as foleyUnlock } from '@foleyjs/core'
import { onStep, onStepEnd, onToast } from '@yoru/ui'
import { useSyncExternalStore } from 'react'

export const SOUND_THEMES = ['soft', 'default', 'mechanical', 'glass'] as const satisfies readonly ThemeName[]
export const SOUND_VOLUMES = ['10', '20', '30', '40', '50', '60', '70', '80', '90', '100'] as const
export type SoundVolume = (typeof SOUND_VOLUMES)[number]
export type SoundCategory = 'interface' | 'notifications' | 'feedback'
export const CLICK_SOUNDS = ['press', 'tick', 'hover', 'glide', 'pop', 'tap', 'switch', 'thock'] as const satisfies readonly CueName[]
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
const RELEASE_DELAY_MS = 70
const THEME_PREVIEW_DELAY_MS = 220
const SUBMIT_DELAY_MS = 240
const MAX_POSITION_PITCH = 7
const SLIDER_PITCH_RANGE = 10
const AWAKE_MS = 30_000
const HUM_LEVEL = 1e-4
const DUCK = 0.35
const DEFAULTS: SoundSettings = { enabled: false, volume: '40', theme: 'mechanical', click: 'press', interface: true, notifications: true, feedback: true }

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

let state = load()
let observer: MutationObserver | null = null
const listeners = new Set<() => void>()

function play(name: CueName, opts?: PlayOptions) {
  unlock()
  const random = Math.random
  let calls = 0
  Math.random = () => (++calls <= 2 ? 0.5 : random())
  try {
    foleyPlay(name, opts)
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
  set({ muted: !state.enabled, volume: Number(state.volume) / 100, theme: soundSet(state.theme) })
  if (!state.enabled) sleep()
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

function playClick(name: ClickSound) {
  if (name !== 'press') {
    play(name)
    return
  }
  play('press')
  window.setTimeout(() => play('release'), RELEASE_DELAY_MS)
}

export function previewClick(name: ClickSound) {
  if (state.enabled) playClick(name)
}

export function previewTheme() {
  if (!state.enabled) return
  play('thock')
  window.setTimeout(() => play('chime'), THEME_PREVIEW_DELAY_MS)
}

export function duckSounds(ducked: boolean) {
  set({ duck: ducked ? DUCK : 1 })
}

const CLICKABLE = 'button, a[href], summary, [role="tab"], [role="option"], [role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="switch"], [role="checkbox"], [role="radio"]'
const SELECT_ROLES = new Set(['tab', 'radio', 'option', 'menuitem', 'menuitemradio', 'menuitemcheckbox'])
const SELECT_ITEM = '[data-radix-select-viewport] [role="option"]'
const TYPING = 'textarea, [contenteditable="true"], input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input[type="number"]'
const TOAST_CUES = { success: 'success', error: 'error', warning: 'warning', info: 'ping' } as const

type Voice = { kind: 'click'; el: Element } | { kind: 'select'; el: Element } | { kind: 'cue'; name: CueName }

function voiceOf(target: Element): Voice | null {
  const scoped = target.closest('[data-sound]')
  const el = target.closest(CLICKABLE)
  if (scoped && (!el || scoped.contains(el))) {
    const value = scoped.getAttribute('data-sound')
    if (value === 'none') return null
    if (scoped === el && value) return { kind: 'cue', name: value as CueName }
  }
  if (!el) return null
  const role = el.getAttribute('role')
  if (role === 'switch' || role === 'checkbox') return { kind: 'cue', name: el.getAttribute('aria-checked') === 'true' ? 'off' : 'on' }
  const pressed = el.getAttribute('aria-pressed')
  if (pressed === 'true' || pressed === 'false') return { kind: 'cue', name: pressed === 'true' ? 'off' : 'on' }
  if (role && SELECT_ROLES.has(role)) return { kind: 'select', el }
  return { kind: 'click', el }
}

function positionPitch(el: Element) {
  const role = el.getAttribute('role')
  const siblings = Array.from(el.parentElement?.children ?? []).filter((node) => node.getAttribute('role') === role)
  return Math.min(Math.max(siblings.indexOf(el), 0), MAX_POSITION_PITCH)
}

function playSelect(el: Element) {
  play('switch', { pitch: positionPitch(el) })
}

function onTyping(e: KeyboardEvent) {
  if (!state.enabled || !state.interface || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || !(e.target instanceof Element)) return
  const field = e.target.closest(TYPING)
  if (!field || field.closest('[data-sound="none"]')) return
  if (e.key === 'Enter' && field instanceof HTMLInputElement) {
    if (!field.value.trim()) {
      play('denied')
      return
    }
    play('swoosh')
    window.setTimeout(() => play('complete'), SUBMIT_DELAY_MS)
    return
  }
  if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter') play('thock')
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
  let pressed = false
  const active = () => state.enabled && state.interface
  document.addEventListener(
    'pointerdown',
    (e) => {
      pointer = e.pointerType
      pressed = false
      if (!active() || pointer === 'touch' || e.button !== 0 || e.ctrlKey || !(e.target instanceof Element)) return
      if (voiceOf(e.target)?.kind !== 'click') return
      if (state.click === 'press') {
        pressed = true
        play('press')
      } else play(state.click)
    },
    { capture: true, passive: true },
  )
  document.addEventListener(
    'pointerup',
    (e) => {
      if (!active() || !(e.target instanceof Element)) return
      if (pressed) play('release')
      pressed = false
      const item = e.target.closest(SELECT_ITEM)
      if (item && pointer !== 'touch') playSelect(item)
    },
    { capture: true, passive: true },
  )
  document.addEventListener(
    'click',
    (e) => {
      if (!active() || !(e.target instanceof Element)) return
      const voice = voiceOf(e.target)
      if (!voice) return
      if (voice.kind === 'cue') play(voice.name)
      else if (voice.kind === 'select') playSelect(voice.el)
      else if (e.detail === 0 || pointer === 'touch') playClick(state.click)
    },
    { capture: true },
  )
  document.addEventListener('keydown', onTyping, { capture: true, passive: true })
  onStep((position) => {
    if (active()) play('tick', { pitch: position * SLIDER_PITCH_RANGE })
  })
  onStepEnd(() => {
    if (active()) play('pop')
  })
  onToast((kind) => {
    if (kind in TOAST_CUES) cue('feedback', TOAST_CUES[kind as keyof typeof TOAST_CUES])
  })
}
