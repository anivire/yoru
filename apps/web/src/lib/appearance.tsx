import { type ColorScheme, DEFAULT_SCHEME, DEFAULT_THEME, THEME_PRESETS, type ThemePreset, applyTheme } from '@yoru/ui'
import { type ReactNode, createContext, useContext, useEffect, useState } from 'react'
import { HOME_SECTIONS, type HomeSectionId, NAV, type NavKey } from './navigation'

const STORAGE_KEY = 'yoru:appearance'

export const PAGE_WIDTHS = [
  { value: '3xl', max: '48rem', label: '3XL' },
  { value: '4xl', max: '56rem', label: '4XL' },
  { value: '5xl', max: '64rem', label: '5XL' },
  { value: '6xl', max: '72rem', label: '6XL' },
  { value: '7xl', max: '80rem', label: '7XL' },
  { value: '8xl', max: '96rem', label: '8XL' },
  { value: '9xl', max: '120rem', label: '9XL' },
  { value: 'full', max: 'none', label: '100%' },
] as const

const LEGACY_WIDTHS: Record<string, PageWidth> = { narrow: '5xl', default: '7xl', wide: '8xl', xwide: '9xl' }

export type PageWidth = (typeof PAGE_WIDTHS)[number]['value']

const DEFAULT_WIDTH: PageWidth = '7xl'

export interface HomeSectionSetting {
  id: HomeSectionId
  visible: boolean
}

interface State {
  theme: ThemePreset
  scheme: ColorScheme
  pageWidth: PageWidth
  expandSynopsis: boolean
  showHero: boolean
  homeSections: HomeSectionSetting[]
  hiddenNav: NavKey[]
}

const DEFAULT_SECTIONS: HomeSectionSetting[] = HOME_SECTIONS.map((s) => ({ id: s.id, visible: true }))

function normalizeSections(value: unknown): HomeSectionSetting[] {
  const known = new Set<string>(HOME_SECTIONS.map((s) => s.id))
  const list = Array.isArray(value) ? (value as HomeSectionSetting[]).filter((s) => s && known.has(s.id)) : []
  const seen = new Set(list.map((s) => s.id))
  return [...list.map((s) => ({ id: s.id, visible: s.visible !== false })), ...DEFAULT_SECTIONS.filter((s) => !seen.has(s.id))]
}

function normalizeNav(value: unknown): NavKey[] {
  const known = new Set<string>(NAV.map((n) => n.key))
  const list = Array.isArray(value) ? (value as string[]).filter((k) => known.has(k)) : []
  return list.length >= NAV.length ? [] : (list as NavKey[])
}

interface Appearance extends State {
  stretch: boolean
  setTheme: (theme: ThemePreset) => void
  setScheme: (scheme: ColorScheme) => void
  setPageWidth: (width: PageWidth) => void
  setExpandSynopsis: (expand: boolean) => void
  setShowHero: (show: boolean) => void
  setHomeSections: (sections: HomeSectionSetting[]) => void
  setHiddenNav: (hidden: NavKey[]) => void
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
      showHero?: boolean
      homeSections?: unknown
      hiddenNav?: unknown
    }
    const theme = THEME_PRESETS.some((t) => t.id === raw.theme) ? (raw.theme as ThemePreset) : DEFAULT_THEME
    const scheme = raw.scheme === 'light' || raw.scheme === 'dark' || raw.scheme === 'system' ? raw.scheme : DEFAULT_SCHEME
    const pageWidth = PAGE_WIDTHS.some((w) => w.value === raw.pageWidth)
      ? (raw.pageWidth as PageWidth)
      : (raw.pageWidth && LEGACY_WIDTHS[raw.pageWidth]) || (raw.stretch ? 'full' : DEFAULT_WIDTH)
    return {
      theme,
      scheme,
      pageWidth,
      expandSynopsis: raw.expandSynopsis !== false,
      showHero: raw.showHero !== false,
      homeSections: normalizeSections(raw.homeSections),
      hiddenNav: normalizeNav(raw.hiddenNav),
    }
  } catch {
    return { theme: DEFAULT_THEME, scheme: DEFAULT_SCHEME, pageWidth: DEFAULT_WIDTH, expandSynopsis: true, showHero: true, homeSections: DEFAULT_SECTIONS, hiddenNav: [] }
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
        setShowHero: (showHero) => setState((s) => ({ ...s, showHero })),
        setHomeSections: (homeSections) => setState((s) => ({ ...s, homeSections })),
        setHiddenNav: (hiddenNav) => setState((s) => ({ ...s, hiddenNav: normalizeNav(hiddenNav) })),
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
