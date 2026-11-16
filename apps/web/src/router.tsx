import { Button, Mascot } from '@yoru/ui'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, Outlet, createBrowserRouter, useLocation, useRouteError } from 'react-router'
import { AppShell } from './components/app-shell'
import { setLocale } from './lib/i18n'
import { useMe } from './lib/queries'
import { AdminPage } from './pages/admin'
import { AnimePage } from './pages/anime'
import { DiscoverPage } from './pages/discover'
import { HomePage } from './pages/home'
import { InvitePage } from './pages/invite'
import { ListsPage } from './pages/lists'
import { LoginPage } from './pages/login'
import { NotFoundPage } from './pages/not-found'
import { SchedulePage } from './pages/schedule'
import { SearchPage } from './pages/search'
import { SettingsPage } from './pages/settings'
import { SharedListPage } from './pages/shared-list'
import { StatsPage } from './pages/stats'
import { RoomPage } from './pages/room'
import { TogetherPage } from './pages/together'
import { ChangelogPage } from './pages/changelog'
import { FeedPage } from './pages/feed'

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
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/invite/:code', element: <InvitePage /> },
      { path: '/share/:token', element: <SharedListPage /> },
      {
        element: <RequireAuth />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'discover', element: <DiscoverPage /> },
          { path: 'schedule', element: <SchedulePage /> },
          { path: 'search', element: <SearchPage /> },
          { path: 'lists', element: <ListsPage /> },
          { path: 'stats', element: <StatsPage /> },
          { path: 'together/:id', element: <RoomPage /> },
          { path: 'together', element: <TogetherPage /> },
          { path: 'feed', element: <FeedPage /> },
          { path: 'changelog', element: <ChangelogPage /> },
          { path: 'anime/:id', element: <AnimePage /> },
          { path: 'settings/:tab?', element: <SettingsPage /> },
          { element: <RequireAdmin />, children: [{ path: 'admin', element: <AdminPage /> }] },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])
