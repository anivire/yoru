import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Logo,
  cn,
} from '@yoru/ui'
import { ArrowUpCircle, LogOut, Search, Settings, Shield } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, useNavigate } from 'react-router'
import { api } from '../lib/api'
import { keys, useUser } from '../lib/queries'
import { LanguageMenu } from './language'
import { NotificationsPopover } from './notifications'
import { QuickAppearance } from './quick-appearance'

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

function UserMenu() {
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="icon" aria-label={t('nav.account')} className="rounded-full">
          <span className="text-[13px] font-semibold uppercase">{user.username.slice(0, 1)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60">
        <DropdownMenuLabel className="flex items-center gap-3 px-2.5 py-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold uppercase text-accent">{user.username.slice(0, 1)}</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">{user.username}</span>
            <span className="block text-xs font-normal text-muted-foreground">{user.role === 'admin' ? t('nav.roleAdmin') : t('nav.roleUser')}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
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
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logout} className="text-danger data-[highlighted]:bg-danger-soft [&_svg]:text-danger">
          <LogOut />
          {t('nav.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Footer() {
  const { t } = useTranslation()
  const { data } = useQuery({ queryKey: ['version'], queryFn: api.version, staleTime: 30 * 60_000 })
  return (
    <footer className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 py-6 text-sm text-muted-foreground">
      <span>
        yoru · <span className="text-foreground">Anime365</span> · Jikan
      </span>
      {data ? (
        <span className="inline-flex items-center gap-1.5">
          <span>·</span>
          <a href={data.repoUrl} target="_blank" rel="noreferrer" className="hover:text-foreground">
            v{data.version}
          </a>
          {data.commit && data.commitUrl ? (
            <a href={data.commitUrl} target="_blank" rel="noreferrer" className="font-mono text-xs text-subtle-foreground hover:text-foreground">
              {data.commit.slice(0, 7)}
            </a>
          ) : null}
        </span>
      ) : null}
      {data?.updateAvailable ? (
        <a
          href={data.compareUrl ?? data.repoUrl}
          target="_blank"
          rel="noreferrer"
          title={data.latest?.message}
          className="inline-flex h-6 items-center gap-1.5 rounded-full bg-accent-soft px-2.5 text-xs font-medium text-accent hover:bg-accent hover:text-accent-foreground"
        >
          <ArrowUpCircle className="size-3.5" />
          {data.behindBy ? t('version.updateCount', { count: data.behindBy }) : t('version.update')}
        </a>
      ) : null}
    </footer>
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
        <div className="mx-auto flex h-16 max-w-7xl wide:max-w-none items-center gap-4 px-4 sm:px-6">
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
            <UserMenu />
            <LanguageMenu />
          </div>
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto px-4 pb-2 scrollbar-none md:hidden">
          <NavItems />
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <Footer />
      <QuickAppearance />
    </div>
  )
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-7xl wide:max-w-none px-4 py-8 sm:px-6', className)}>{children}</div>
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

export function Section({ title, hint, action, children, className }: { title: ReactNode; hint?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('mt-10 first:mt-0', className)}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          {hint ? <p className="text-[13px] text-muted-foreground">{hint}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
