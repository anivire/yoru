import { Button, Mascot } from '@yoru/ui'
import { type ComponentType, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, Outlet, createBrowserRouter, useLocation, useRouteError } from 'react-router'
import { AppShell } from './components/app-shell'
import { setLocale } from './lib/i18n'
import { useMe } from './lib/queries'
import { HomePage } from './pages/home'
import { LoginPage } from './pages/login'
import { NotFoundPage } from './pages/not-found'

const page = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) => async () => ({ Component: (await load())[name] })

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Mascot size={56} mood="sleepy" />
    </div>
  )
}

const RELOAD_KEY = 'yoru:error-reload'

function useAutoReload() {
  const [reloading] = useState(() => {
    try {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
      if (Date.now() - last < 60_000) return false
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
      return true
    } catch {
      return false
    }
  })
  useEffect(() => {
    if (reloading) window.location.reload()
  }, [reloading])
  return reloading
}

function RouteError() {
  const { t } = useTranslation()
  const error = useRouteError()
  const message = error instanceof Error ? error.message : String(error)
  const reloading = useAutoReload()
  if (reloading) return <Splash />
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="flex max-w-lg flex-col items-center gap-4 text-center">
        <Mascot size={64} mood="error" />
        <p className="break-words font-mono text-sm text-muted-foreground">{message}</p>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          {t('common.retry')}
        </Button>
      </div>
    </div>
  )
}

function RequireAuth() {
  const { data: user, isPending } = useMe()
  const location = useLocation()
  useEffect(() => {
    if (user) setLocale(user.locale)
  }, [user?.locale])
  if (isPending) return <Splash />
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

function RequireAdmin() {
  const { data: user } = useMe()
  if (user?.role !== 'admin') return <Navigate to="/" replace />
  return <Outlet />
}

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return <Outlet />
}

export const router = createBrowserRouter([
  {
    element: <ScrollTop />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <Splash />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/invite/:code', lazy: page(() => import('./pages/invite'), 'InvitePage') },
      { path: '/share/:token', lazy: page(() => import('./pages/shared-list'), 'SharedListPage') },
      {
        element: <RequireAuth />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'discover', lazy: page(() => import('./pages/discover'), 'DiscoverPage') },
          { path: 'schedule', lazy: page(() => import('./pages/schedule'), 'SchedulePage') },
          { path: 'search', lazy: page(() => import('./pages/search'), 'SearchPage') },
          { path: 'lists', lazy: page(() => import('./pages/lists'), 'ListsPage') },
          { path: 'stats', lazy: page(() => import('./pages/stats'), 'StatsPage') },
          { path: 'together/:id', lazy: page(() => import('./pages/room'), 'RoomPage') },
          { path: 'together', lazy: page(() => import('./pages/together'), 'TogetherPage') },
          { path: 'feed', lazy: page(() => import('./pages/feed'), 'FeedPage') },
          { path: 'changelog', lazy: page(() => import('./pages/changelog'), 'ChangelogPage') },
          { path: 'friends', lazy: page(() => import('./pages/friends'), 'FriendsPage') },
          { path: 'u/:username', lazy: page(() => import('./pages/profile'), 'ProfilePage') },
          { path: 'u/:username/recap/:year?', lazy: page(() => import('./pages/recap'), 'RecapPage') },
          { path: 'anime/:id', lazy: page(() => import('./pages/anime'), 'AnimePage') },
          { path: 'seiyuu/:id', lazy: page(() => import('./pages/person'), 'PersonPage') },
          { path: 'settings/:tab?', lazy: page(() => import('./pages/settings'), 'SettingsPage') },
          { element: <RequireAdmin />, children: [{ path: 'admin', lazy: page(() => import('./pages/admin'), 'AdminPage') }] },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])
