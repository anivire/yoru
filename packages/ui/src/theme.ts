export const THEME_PRESETS = [
  { id: 'yoru', name: 'Yoru', light: ['#f4f3ff', '#c7c2ff'], dark: ['#0b0b10', '#5b4fd6'] },
  { id: 'sakura', name: 'Sakura', light: ['#fff1f5', '#f08fb3'], dark: ['#1a0c12', '#d0437a'] },
  { id: 'matcha', name: 'Matcha', light: ['#f1f7ef', '#8cc79a'], dark: ['#0c140f', '#3f9a60'] },
  { id: 'umi', name: 'Umi', light: ['#eef5fa', '#7fb4d8'], dark: ['#0a1219', '#2f7fb3'] },
  { id: 'ember', name: 'Ember', light: ['#fbf1ea', '#e39a6c'], dark: ['#170e09', '#c76a33'] },
  { id: 'fuji', name: 'Fuji', light: ['#f6f0fb', '#b994e0'], dark: ['#120c19', '#8a5bd1'] },
  { id: 'momiji', name: 'Momiji', light: ['#fdf0ee', '#ec8f84'], dark: ['#190b0a', '#c8423a'] },
  { id: 'kohaku', name: 'Kohaku', light: ['#fbf5e8', '#e6b85c'], dark: ['#16110a', '#c08a1e'] },
  { id: 'wakaba', name: 'Wakaba', light: ['#f3f8e9', '#a8cf6a'], dark: ['#10140a', '#6e9e2c'] },
  { id: 'kori', name: 'Kōri', light: ['#ecf8f8', '#78ccd0'], dark: ['#091415', '#23919a'] },
  { id: 'ajisai', name: 'Ajisai', light: ['#eff2fd', '#8fa2ec'], dark: ['#0b0e1a', '#4a5fd1'] },
  { id: 'sumi', name: 'Sumi', light: ['#f5f5f5', '#a3a3a3'], dark: ['#0b0b0b', '#5a5a5a'] },
] as const

export type ThemePreset = (typeof THEME_PRESETS)[number]['id']
export type ColorScheme = 'system' | 'light' | 'dark'

export const DEFAULT_THEME: ThemePreset = 'yoru'
export const DEFAULT_SCHEME: ColorScheme = 'dark'

export function resolveScheme(scheme: ColorScheme): 'light' | 'dark' {
  if (scheme !== 'system') return scheme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: ThemePreset, scheme: ColorScheme) {
  const root = document.documentElement
  root.dataset.theme = theme
  root.classList.toggle('dark', resolveScheme(scheme) === 'dark')
}
