import { THEME_PRESETS as BASE_PRESETS } from '@anivire/kata-ui'

export const THEME_PRESETS = [{ id: 'yoru', name: 'Yoru', light: ['#f4f3ff', '#c7c2ff'], dark: ['#0b0b10', '#5b4fd6'] }, ...BASE_PRESETS] as const

export type ThemePreset = (typeof THEME_PRESETS)[number]['id']

export const DEFAULT_THEME: ThemePreset = 'yoru'
