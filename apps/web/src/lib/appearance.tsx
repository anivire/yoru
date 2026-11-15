import { STREAM_KINDS, type StreamKind, TITLE_LANGUAGES, type TitleLanguage } from '@yoru/shared'
import { type ColorScheme, DEFAULT_SCHEME, DEFAULT_THEME, THEME_PRESETS, type ThemePreset, applyTheme, logoSvg } from '@yoru/ui'
import { type ReactNode, createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { HOME_SECTIONS, type HomeSectionId, NAV, type NavKey } from './navigation'
import { type FavoriteAuthors, normalizeFavorites } from './favorite-authors'

const STORAGE_KEY = 'yoru:appearance'

export const PAGE_WIDTHS = [
  { value: '3xl', max: '48rem', label: '3XL' },
  { value: '4xl', max: '56rem', label: '4XL' },
  { value: '5xl', max: '64rem', label: '5XL' },
  { value: '6xl', max: '72rem', label: '6XL' },
  { value: '7xl', max: '80rem', label: '7XL' },
  { value: '8xl', max: '96rem', label: '8XL' },
  { value: '9xl', max: '120rem', label: '9XL' },
  { value: 'full', max: '100vw', label: '100%' },
] as const

const LEGACY_WIDTHS: Record<string, PageWidth> = { narrow: '5xl', default: '7xl', wide: '8xl', xwide: '9xl' }

export type PageWidth = (typeof PAGE_WIDTHS)[number]['value']

const DEFAULT_WIDTH: PageWidth = '7xl'

export type NavPosition = 'left' | 'top' | 'bottom' | 'right'

export type NavLabels = 'always' | 'hover' | 'off'

export type BackdropShape = 'full' | 'glow'

export type IosFullscreen = 'app' | 'native'

export const WATCHED_THRESHOLDS = [0.7, 0.8, 0.85, 0.9, 0.95, 1] as const

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
  defaultKind: StreamKind
  preferredAuthors: FavoriteAuthors
  navPosition: NavPosition
  navLabels: NavLabels
  backdrop: BackdropShape
  iosFullscreen: IosFullscreen
  autoNext: boolean
  watchedAt: number
  titleLanguage: TitleLanguage
  appearanceButton: boolean
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
  tablet: boolean
  pageWidthOptions: (typeof PAGE_WIDTHS)[number][]
  setTheme: (theme: ThemePreset) => void
  setScheme: (scheme: ColorScheme) => void
  setPageWidth: (width: PageWidth) => void
  setExpandSynopsis: (expand: boolean) => void
  setShowHero: (show: boolean) => void
  setHomeSections: (sections: HomeSectionSetting[]) => void
  setHiddenNav: (hidden: NavKey[]) => void
  setDefaultKind: (kind: StreamKind) => void
  setPreferredAuthors: (authors: FavoriteAuthors) => void
  setNavPosition: (position: NavPosition) => void
  setNavLabels: (labels: NavLabels) => void
  setBackdrop: (shape: BackdropShape) => void
  setIosFullscreen: (mode: IosFullscreen) => void
  setAutoNext: (enabled: boolean) => void
  setWatchedAt: (ratio: number) => void
  setTitleLanguage: (language: TitleLanguage) => void
  setAppearanceButton: (show: boolean) => void
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
      defaultKind?: string
      preferredAuthors?: unknown
      navPosition?: string
      navLabels?: string
      backdrop?: string
      iosFullscreen?: string
      autoNext?: boolean
      watchedAt?: number
      titleLanguage?: string
      appearanceButton?: boolean
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
      defaultKind: STREAM_KINDS.includes(raw.defaultKind as StreamKind) ? (raw.defaultKind as StreamKind) : 'sub',
      preferredAuthors: normalizeFavorites(raw.preferredAuthors),
      navPosition: raw.navPosition === 'top' || raw.navPosition === 'bottom' || raw.navPosition === 'right' ? raw.navPosition : 'left',
      navLabels: raw.navLabels === 'hover' || raw.navLabels === 'off' ? raw.navLabels : 'always',
      backdrop: raw.backdrop === 'glow' ? 'glow' : 'full',
      iosFullscreen: raw.iosFullscreen === 'app' ? 'app' : 'native',
      autoNext: raw.autoNext !== false,
      watchedAt: (WATCHED_THRESHOLDS as readonly number[]).includes(raw.watchedAt as number) ? (raw.watchedAt as number) : 0.85,
      titleLanguage: TITLE_LANGUAGES.includes(raw.titleLanguage as TitleLanguage) ? (raw.titleLanguage as TitleLanguage) : 'romaji',
      appearanceButton: raw.appearanceButton !== false,
    }
  } catch {
    return { theme: DEFAULT_THEME, scheme: DEFAULT_SCHEME, pageWidth: DEFAULT_WIDTH, expandSynopsis: true, showHero: true, homeSections: DEFAULT_SECTIONS, hiddenNav: [], defaultKind: 'sub', preferredAuthors: {}, navPosition: 'left', navLabels: 'always', backdrop: 'full', iosFullscreen: 'native', autoNext: true, watchedAt: 0.85, titleLanguage: 'romaji', appearanceButton: true }
  }
}

const TABLET_QUERY = '(pointer: coarse) and (min-width: 768px)'

function subscribeViewport(listener: () => void) {
  const media = window.matchMedia(TABLET_QUERY)
  window.addEventListener('resize', listener)
  media.addEventListener('change', listener)
  return () => {
    window.removeEventListener('resize', listener)
    media.removeEventListener('change', listener)
  }
}

function viewportSnapshot() {
  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  return `${window.innerWidth}|${rem}|${window.matchMedia(TABLET_QUERY).matches ? 1 : 0}`
}

function useViewport() {
  const [width, rem, tablet] = useSyncExternalStore(subscribeViewport, viewportSnapshot).split('|')
  return { width: Number(width), rem: Number(rem), tablet: tablet === '1' }
}

function widthPx(width: (typeof PAGE_WIDTHS)[number], rem: number) {
  return width.max.endsWith('rem') ? Number.parseFloat(width.max) * rem : Infinity
}

function widthIndex(width: PageWidth) {
  return PAGE_WIDTHS.findIndex((w) => w.value === width)
}

function resolveColor(variable: string): string {
  const probe = document.createElement('span')
  probe.style.color = `var(${variable})`
  probe.style.display = 'none'
  document.body.append(probe)
  const color = getComputedStyle(probe).color
  probe.remove()
  return color
}

function updateFavicon() {
  const body = resolveColor('--logo')
  const ink = resolveColor('--logo-ink')
  if (!body || !ink) return
  let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.append(link)
  }
  link.type = 'image/svg+xml'
  link.href = `data:image/svg+xml,${encodeURIComponent(logoSvg(body, ink))}`
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(load)
  const viewport = useViewport()
  const pageWidthOptions = viewport.tablet
    ? PAGE_WIDTHS.filter((w) => w.value === '3xl' || w.value === 'full')
    : PAGE_WIDTHS.filter((w) => w.value === 'full' || w.value === '3xl' || widthPx(w, viewport.rem) <= viewport.width)
  const pageWidth: PageWidth = pageWidthOptions.some((w) => w.value === state.pageWidth)
    ? state.pageWidth
    : viewport.tablet
      ? '3xl'
      : 'full'
  const stretch = widthIndex(viewport.tablet ? pageWidth : state.pageWidth) > widthIndex(DEFAULT_WIDTH)

  useEffect(() => {
    applyTheme(state.theme, state.scheme)
    updateFavicon()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    if (state.scheme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      applyTheme(state.theme, state.scheme)
      updateFavicon()
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [state])

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--page-max-setting', PAGE_WIDTHS[widthIndex(pageWidth)]!.max)
    root.toggleAttribute('data-wide', stretch)
  }, [pageWidth, stretch])

  return (
    <AppearanceContext
      value={{
        ...state,
        pageWidth,
        stretch,
        tablet: viewport.tablet,
        pageWidthOptions,
        setTheme: (theme) => setState((s) => ({ ...s, theme })),
        setScheme: (scheme) => setState((s) => ({ ...s, scheme })),
        setPageWidth: (pageWidth) => setState((s) => ({ ...s, pageWidth })),
        setExpandSynopsis: (expandSynopsis) => setState((s) => ({ ...s, expandSynopsis })),
        setShowHero: (showHero) => setState((s) => ({ ...s, showHero })),
        setHomeSections: (homeSections) => setState((s) => ({ ...s, homeSections })),
        setHiddenNav: (hiddenNav) => setState((s) => ({ ...s, hiddenNav: normalizeNav(hiddenNav) })),
        setDefaultKind: (defaultKind) => setState((s) => ({ ...s, defaultKind })),
        setPreferredAuthors: (preferredAuthors) => setState((s) => ({ ...s, preferredAuthors })),
        setNavPosition: (navPosition) => setState((s) => ({ ...s, navPosition })),
        setNavLabels: (navLabels) => setState((s) => ({ ...s, navLabels })),
        setBackdrop: (backdrop) => setState((s) => ({ ...s, backdrop })),
        setIosFullscreen: (iosFullscreen) => setState((s) => ({ ...s, iosFullscreen })),
        setAutoNext: (autoNext) => setState((s) => ({ ...s, autoNext })),
        setWatchedAt: (watchedAt) => setState((s) => ({ ...s, watchedAt })),
        setTitleLanguage: (titleLanguage) => setState((s) => ({ ...s, titleLanguage })),
        setAppearanceButton: (appearanceButton) => setState((s) => ({ ...s, appearanceButton })),
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
