import { type CueName, type ThemeName, observe, play, set, unlock } from '@foleyjs/core'
import { onToast } from '@yoru/ui'
import { useSyncExternalStore } from 'react'

export const SOUND_THEMES = ['soft', 'default', 'mechanical', 'glass'] as const satisfies readonly ThemeName[]
export const SOUND_VOLUMES = ['20', '40', '60', '80', '100'] as const
export type SoundVolume = (typeof SOUND_VOLUMES)[number]
export type SoundCategory = 'interface' | 'notifications' | 'feedback'

export interface SoundSettings {
  enabled: boolean
  volume: SoundVolume
  theme: ThemeName
  interface: boolean
  notifications: boolean
  feedback: boolean
}

const STORAGE_KEY = 'yoru:sounds'
const GAIN = 2
const DEFAULTS: SoundSettings = { enabled: false, volume: '60', theme: 'soft', interface: true, notifications: true, feedback: true }

function load(): SoundSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<SoundSettings>
    return {
      enabled: raw.enabled === true,
      volume: SOUND_VOLUMES.includes(raw.volume as SoundVolume) ? (raw.volume as SoundVolume) : DEFAULTS.volume,
      theme: SOUND_THEMES.includes(raw.theme as (typeof SOUND_THEMES)[number]) ? (raw.theme as ThemeName) : DEFAULTS.theme,
      interface: raw.interface !== false,
      notifications: raw.notifications !== false,
      feedback: raw.feedback !== false,
    }
  } catch {
    return DEFAULTS
  }
}

let state = load()
let stopObserving: (() => void) | null = null
const listeners = new Set<() => void>()

function apply() {
  set({ muted: !state.enabled, volume: (Number(state.volume) / 100) * GAIN, theme: state.theme })
  const watch = state.enabled && state.interface
  if (watch && !stopObserving) stopObserving = observe()
  if (!watch && stopObserving) {
    stopObserving()
    stopObserving = null
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

const CLICKABLE = 'button, a[href], summary, [role="tab"], [role="option"], [role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="switch"], [role="checkbox"], [role="radio"]'
const LIGHT_ROLES = new Set(['tab', 'option', 'menuitem', 'menuitemradio', 'menuitemcheckbox', 'radio'])

function clickCue(target: Element): CueName | null {
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
  if (role && LIGHT_ROLES.has(role)) return 'tick'
  return 'pop'
}

const TOAST_CUES = { success: 'success', error: 'error', warning: 'warning' } as const

export function installSounds() {
  apply()
  document.addEventListener('pointerdown', () => state.enabled && unlock(), { capture: true })
  document.addEventListener(
    'click',
    (e) => {
      if (!state.enabled || !state.interface || !(e.target instanceof Element)) return
      const name = clickCue(e.target)
      if (name) play(name, { pitch: (Math.random() * 2 - 1) * 1.5 })
    },
    { capture: true },
  )
  onToast((kind) => {
    if (kind in TOAST_CUES) cue('feedback', TOAST_CUES[kind as keyof typeof TOAST_CUES])
  })
}
