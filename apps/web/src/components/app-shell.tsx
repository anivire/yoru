import { useQueryClient } from '@tanstack/react-query'
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
import { LogOut, Search, Settings, Shield, User as UserIcon } from 'lucide-react'
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
      <DropdownMenuContent>
        <DropdownMenuLabel className="flex items-center gap-2">
          <UserIcon className="size-3.5" />
          {user.username}
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
        <DropdownMenuItem onSelect={logout}>
          <LogOut />
          {t('nav.logout')}
        </DropdownMenuItem>
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
        <div className="mx-auto flex h-16 max-w-7xl wide:max-w-none items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="shrink-0">
            <Logo />
          </Link>
          <nav className="mx-auto hidden items-center gap-1 sm:flex">
            <NavItem to="/" end>
              {t('nav.home')}
            </NavItem>
            <NavItem to="/search">{t('nav.search')}</NavItem>
            <NavItem to="/lists">{t('nav.lists')}</NavItem>
          </nav>
          <div className="ml-auto flex items-center gap-2 sm:ml-0">
            <Button asChild variant="ghost" size="icon" className="sm:hidden">
              <Link to="/search" aria-label={t('nav.search')}>
                <Search />
              </Link>
            </Button>
            <NotificationsPopover />
            <UserMenu />
            <LanguageMenu />
          </div>
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto px-4 pb-2 scrollbar-none sm:hidden">
          <NavItem to="/" end>
            {t('nav.home')}
          </NavItem>
          <NavItem to="/search">{t('nav.search')}</NavItem>
          <NavItem to="/lists">{t('nav.lists')}</NavItem>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="py-6 text-center text-sm text-muted-foreground">
        yoru · <span className="text-foreground">Anime365</span> · Jikan
      </footer>
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
