import { useQueryClient } from '@tanstack/react-query'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Logo,
  cn,
} from '@yoru/ui'
import { CalendarDays, Check, Compass, House, LibraryBig, LogOut, Menu, Search, Settings, Shield } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, matchPath, useLocation, useNavigate } from 'react-router'
import { api } from '../lib/api'
import { keys, useUser } from '../lib/queries'
import { Flag, LANGUAGES, useChangeLanguage } from './language'
import { NotificationsPopover } from './notifications'
import { Footer } from './footer'

function NavItem({ to, children, end }: { to: string; children: ReactNode; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'inline-flex h-9 items-center rounded-lg px-3.5 text-sm font-medium transition-colors',
          isActive ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
        )
      }
    >
      {children}
    </NavLink>
  )
}

function NavItems() {
  const { t } = useTranslation()
  return (
    <>
      <NavItem to="/" end>
        {t('nav.home')}
      </NavItem>
      <NavItem to="/discover">{t('nav.discover')}</NavItem>
      <NavItem to="/schedule">{t('nav.schedule')}</NavItem>
      <NavItem to="/search">{t('nav.search')}</NavItem>
      <NavItem to="/lists">{t('nav.lists')}</NavItem>
    </>
  )
}

const NAV = [
  { to: '/', key: 'home', icon: House, end: true },
  { to: '/discover', key: 'discover', icon: Compass },
  { to: '/schedule', key: 'schedule', icon: CalendarDays },
  { to: '/search', key: 'search', icon: Search },
  { to: '/lists', key: 'lists', icon: LibraryBig },
] as const

function MobileMenu() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="icon" aria-label={t('nav.menu')} className="rounded-full">
          <Menu />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-[calc(100dvh-5rem)] w-64 overflow-y-auto">
        <ProfileLabel />
        <DropdownMenuLabel className="mt-1">{t('nav.sections')}</DropdownMenuLabel>
        {NAV.map(({ to, key, icon: Icon, ...rest }) => {
          const active = Boolean(matchPath({ path: to, end: 'end' in rest }, pathname))
          return (
            <DropdownMenuItem
              key={to}
              onSelect={() => navigate(to)}
              className={cn(active && 'bg-accent-soft text-accent data-[highlighted]:bg-accent-soft [&_svg]:text-accent')}
            >
              <Icon />
              {t(`nav.${key}`)}
            </DropdownMenuItem>
          )
        })}
        <LanguageItems />
        <DropdownMenuLabel className="mt-1">{t('nav.account')}</DropdownMenuLabel>
        <AccountItems />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function LanguageItems() {
  const { t } = useTranslation()
  const user = useUser()
  const change = useChangeLanguage()
  return (
    <>
      <DropdownMenuLabel className="mt-1">{t('settings.language')}</DropdownMenuLabel>
      {LANGUAGES.map((l) => (
        <DropdownMenuItem key={l.value} onSelect={() => change(l.value)}>
          <Flag locale={l.value} className="h-3 w-4 rounded-[2px]" />
          <span className="flex-1">{l.label}</span>
          {l.value === user.locale ? <Check className="text-accent!" /> : null}
        </DropdownMenuItem>
      ))}
    </>
  )
}

function ProfileLabel() {
  const { t } = useTranslation()
  const user = useUser()
  return (
    <DropdownMenuLabel className="flex items-center gap-3 px-3 py-2">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold uppercase text-accent">{user.username.slice(0, 1)}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">{user.username}</span>
        <span className="block text-xs font-normal text-muted-foreground">{user.role === 'admin' ? t('nav.roleAdmin') : t('nav.roleUser')}</span>
      </span>
    </DropdownMenuLabel>
  )
}

function AccountItems() {
  const { t } = useTranslation()
  const user = useUser()
  const navigate = useNavigate()
  const client = useQueryClient()
  const logout = async () => {
    await api.logout()
    client.setQueryData(keys.me, null)
    client.clear()
    navigate('/login')
  }
  return (
    <>
      <DropdownMenuItem onSelect={() => navigate('/settings')}>
        <Settings />
        {t('nav.settings')}
      </DropdownMenuItem>
      {user.role === 'admin' ? (
        <DropdownMenuItem onSelect={() => navigate('/admin')}>
          <Shield />
          {t('nav.admin')}
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuItem onSelect={logout} className="text-danger data-[highlighted]:bg-danger-soft [&_svg]:text-danger">
        <LogOut />
        {t('nav.logout')}
      </DropdownMenuItem>
    </>
  )
}

function UserMenu() {
  const { t } = useTranslation()
  const user = useUser()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="icon" aria-label={t('nav.account')} className="rounded-full">
          <span className="text-[13px] font-semibold uppercase">{user.username.slice(0, 1)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60">
        <ProfileLabel />
        <LanguageItems />
        <DropdownMenuLabel className="mt-1">{t('nav.account')}</DropdownMenuLabel>
        <AccountItems />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function useHeader() {
  const ref = useRef<HTMLElement>(null)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    const header = ref.current
    const observer = new ResizeObserver(() => {
      if (header) document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`)
    })
    if (header) observer.observe(header)
    return () => {
      window.removeEventListener('scroll', onScroll)
      observer.disconnect()
    }
  }, [])
  return { ref, scrolled }
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const header = useHeader()
  return (
    <div className="flex min-h-dvh flex-col">
      <header
        ref={header.ref}
        className={cn('sticky top-0 z-40 transition-[background-color,backdrop-filter] duration-200', header.scrolled ? 'bg-background/80 backdrop-blur-xl' : 'bg-transparent')}
      >
        <div className="mx-auto flex h-16 max-w-(--page-max) items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="shrink-0">
            <Logo />
          </Link>
          <nav className="mx-auto hidden items-center gap-1 md:flex">
            <NavItems />
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <Button asChild variant="ghost" size="icon" className="md:hidden">
              <Link to="/search" aria-label={t('nav.search')}>
                <Search />
              </Link>
            </Button>
            <NotificationsPopover />
            <div className="hidden md:block">
              <UserMenu />
            </div>
            <div className="md:hidden">
              <MobileMenu />
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <Footer scope="app" />
    </div>
  )
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-(--page-max) px-4 pb-8 pt-4 sm:px-6 sm:pt-8', className)}>{children}</div>
}

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-[15px] text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function Section({
  title,
  hint,
  icon,
  action,
  children,
  className,
}: {
  title: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('mt-10 first:mt-0', className)}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {icon ? <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent [&_svg]:size-[18px]">{icon}</span> : null}
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            {hint ? <p className="text-[13px] text-muted-foreground">{hint}</p> : null}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
