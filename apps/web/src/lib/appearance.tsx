import { type ColorScheme, DEFAULT_SCHEME, DEFAULT_THEME, THEME_PRESETS, type ThemePreset, applyTheme } from '@yoru/ui'
import { type ReactNode, createContext, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'yoru:appearance'

interface Appearance {
  theme: ThemePreset
  scheme: ColorScheme
  stretch: boolean
  setTheme: (theme: ThemePreset) => void
  setScheme: (scheme: ColorScheme) => void
  setStretch: (stretch: boolean) => void
}

const AppearanceContext = createContext<Appearance | null>(null)

function load(): { theme: ThemePreset; scheme: ColorScheme; stretch: boolean } {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as { theme?: string; scheme?: string; stretch?: boolean }
    const theme = THEME_PRESETS.some((t) => t.id === raw.theme) ? (raw.theme as ThemePreset) : DEFAULT_THEME
    const scheme = raw.scheme === 'light' || raw.scheme === 'dark' || raw.scheme === 'system' ? raw.scheme : DEFAULT_SCHEME
    return { theme, scheme, stretch: raw.stretch === true }
  } catch {
    return { theme: DEFAULT_THEME, scheme: DEFAULT_SCHEME, stretch: false }
  }
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(load)

  useEffect(() => {
    applyTheme(state.theme, state.scheme)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    if (state.scheme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme(state.theme, state.scheme)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [state])

  useEffect(() => {
    document.documentElement.toggleAttribute('data-wide', state.stretch)
  }, [state.stretch])

  return (
    <AppearanceContext
      value={{
        ...state,
        setTheme: (theme) => setState((s) => ({ ...s, theme })),
        setScheme: (scheme) => setState((s) => ({ ...s, scheme })),
        setStretch: (stretch) => setState((s) => ({ ...s, stretch })),
      }}
    >
      {children}
    </AppearanceContext>
  )
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext)
  if (!ctx) throw new Error('useAppearance outside provider')
  return ctx
}
