import { type ColorScheme, DEFAULT_SCHEME, DEFAULT_THEME, THEME_PRESETS, type ThemePreset, applyTheme } from '@yoru/ui'
import { type ReactNode, createContext, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'yoru:appearance'

export const PAGE_WIDTHS = [
  { value: 'narrow', max: '64rem', label: '1024' },
  { value: 'default', max: '80rem', label: '1280' },
  { value: 'wide', max: '96rem', label: '1536' },
  { value: 'xwide', max: '120rem', label: '1920' },
  { value: 'full', max: 'none', label: null },
] as const

export type PageWidth = (typeof PAGE_WIDTHS)[number]['value']

const DEFAULT_WIDTH: PageWidth = 'default'

interface State {
  theme: ThemePreset
  scheme: ColorScheme
  pageWidth: PageWidth
  expandSynopsis: boolean
}

interface Appearance extends State {
  stretch: boolean
  setTheme: (theme: ThemePreset) => void
  setScheme: (scheme: ColorScheme) => void
  setPageWidth: (width: PageWidth) => void
  setExpandSynopsis: (expand: boolean) => void
}

const AppearanceContext = createContext<Appearance | null>(null)

function load(): State {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as {
      theme?: string
      scheme?: string
      stretch?: boolean
      pageWidth?: string
      expandSynopsis?: boolean
    }
    const theme = THEME_PRESETS.some((t) => t.id === raw.theme) ? (raw.theme as ThemePreset) : DEFAULT_THEME
    const scheme = raw.scheme === 'light' || raw.scheme === 'dark' || raw.scheme === 'system' ? raw.scheme : DEFAULT_SCHEME
    const pageWidth = PAGE_WIDTHS.some((w) => w.value === raw.pageWidth) ? (raw.pageWidth as PageWidth) : raw.stretch ? 'full' : DEFAULT_WIDTH
    return { theme, scheme, pageWidth, expandSynopsis: raw.expandSynopsis !== false }
  } catch {
    return { theme: DEFAULT_THEME, scheme: DEFAULT_SCHEME, pageWidth: DEFAULT_WIDTH, expandSynopsis: true }
  }
}

function widthIndex(width: PageWidth) {
  return PAGE_WIDTHS.findIndex((w) => w.value === width)
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(load)
  const stretch = widthIndex(state.pageWidth) > widthIndex(DEFAULT_WIDTH)

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
    const root = document.documentElement
    root.style.setProperty('--page-max', PAGE_WIDTHS[widthIndex(state.pageWidth)]!.max)
    root.toggleAttribute('data-wide', stretch)
  }, [state.pageWidth, stretch])

  return (
    <AppearanceContext
      value={{
        ...state,
        stretch,
        setTheme: (theme) => setState((s) => ({ ...s, theme })),
        setScheme: (scheme) => setState((s) => ({ ...s, scheme })),
        setPageWidth: (pageWidth) => setState((s) => ({ ...s, pageWidth })),
        setExpandSynopsis: (expandSynopsis) => setState((s) => ({ ...s, expandSynopsis })),
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
