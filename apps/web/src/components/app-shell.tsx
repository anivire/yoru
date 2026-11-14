import { useQueryClient } from '@tanstack/react-query'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Logo,
  LogoMark,
  Tooltip,
  cn,
  useSlidingIndicator,
} from '@yoru/ui'
import { RiLogoutBoxRFill, RiMenuFill, RiSearchFill, RiSettings3Fill, RiShieldFill } from '@remixicon/react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { matchPath, useLocation, useNavigate } from 'react-router'
import { api } from '../lib/api'
import { type NavPosition, useAppearance } from '../lib/appearance'
import { NAV } from '../lib/navigation'
import { keys, useUser } from '../lib/queries'
import { NotificationsPopover } from './notifications'
import { Footer } from './footer'
import { TLink, TNavLink, useTransitionNavigate } from './transition-link'

function NavItem({ to, children, end, label }: { to: string; children: ReactNode; end?: boolean; label?: string }) {
  return (
    <TNavLink
      to={to}
      end={end}
      aria-label={label}
      title={label}
      className={({ isActive }) =>
        cn(
          'relative inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors [&_svg]:size-4 [&_svg]:shrink-0',
          isActive ? 'text-foreground [&_svg]:text-accent' : 'text-muted-foreground hover:text-foreground',
        )
      }
    >
      {children}
    </TNavLink>
  )
}

function useVisibleNav() {
  const { hiddenNav } = useAppearance()
  return NAV.filter((n) => !hiddenNav.includes(n.key))
}

function NavItems() {
  const { t } = useTranslation()
  const nav = useVisibleNav()
  const { pageWidth } = useAppearance()
  const iconOnly = pageWidth === '3xl'
  return (
    <>
      {nav.map((n) => (
        <NavItem key={n.to} to={n.to} end={n.end} label={iconOnly ? t(`nav.${n.key}`) : undefined}>
          <n.icon />
          {iconOnly ? null : t(`nav.${n.key}`)}
        </NavItem>
      ))}
    </>
  )
}

function DesktopNav() {
  const ref = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  const { pageWidth, hiddenNav } = useAppearance()
  const indicator = useSlidingIndicator(ref, '[aria-current="page"]', `${pathname}|${pageWidth}|${hiddenNav.join()}`)
  return (
    <nav ref={ref} className="relative mx-auto hidden items-center gap-1 md:flex">
      <span aria-hidden style={indicator} className="pointer-events-none absolute rounded-lg bg-muted duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]" />
      <NavItems />
    </nav>
  )
}

function MobileMenu() {
  const go = useTransitionNavigate()
  const { t } = useTranslation()
  const nav = useVisibleNav()
  const { pathname } = useLocation()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="icon" aria-label={t('nav.menu')} className="rounded-full">
          <RiMenuFill />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-[calc(100dvh-5rem)] w-64 overflow-y-auto">
        <ProfileLabel />
        <DropdownMenuLabel className="mt-1">{t('nav.sections')}</DropdownMenuLabel>
        {nav.map(({ to, key, icon: Icon, end }) => {
          const active = Boolean(matchPath({ path: to, end }, pathname))
          return (
            <DropdownMenuItem
              key={to}
              onSelect={() => go(to)}
              className={cn(active && 'bg-accent-soft text-accent data-[highlighted]:bg-accent-soft [&_svg]:text-accent')}
            >
              <Icon />
              {t(`nav.${key}`)}
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuLabel className="mt-1">{t('nav.account')}</DropdownMenuLabel>
        <AccountItems />
      </DropdownMenuContent>
    </DropdownMenu>
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
  const go = useTransitionNavigate()
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
      <DropdownMenuItem onSelect={() => go('/settings')}>
        <RiSettings3Fill />
        {t('nav.settings')}
      </DropdownMenuItem>
      {user.role === 'admin' ? (
        <DropdownMenuItem onSelect={() => go('/admin')}>
          <RiShieldFill />
          {t('nav.admin')}
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuItem onSelect={logout} className="text-danger data-[highlighted]:bg-danger-soft [&_svg]:text-danger">
        <RiLogoutBoxRFill />
        {t('nav.logout')}
      </DropdownMenuItem>
    </>
  )
}

function UserMenu({ side = 'bottom' }: { side?: 'bottom' | 'left' | 'right' }) {
  const { t } = useTranslation()
  const user = useUser()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="icon" aria-label={t('nav.account')} className="rounded-full">
          <span className="text-[0.8125rem] font-semibold uppercase">{user.username.slice(0, 1)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} className="w-60">
        <ProfileLabel />
        <AccountItems />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SideRail({ position }: { position: Exclude<NavPosition, 'top'> }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  const { hiddenNav } = useAppearance()
  const nav = useVisibleNav()
  const indicator = useSlidingIndicator(ref, '[aria-current="page"]', `${pathname}|${hiddenNav.join()}|${position}`)
  const side = position === 'left' ? 'right' : 'left'
  return (
    <aside
      className={cn(
        'fixed inset-y-0 z-40 hidden w-16 flex-col items-center bg-surface py-3 [view-transition-name:site-rail] md:flex',
        position === 'left' ? 'left-0' : 'right-0',
      )}
    >
      <TLink to="/" aria-label="yoru" className="grid size-11 place-items-center">
        <LogoMark size={30} />
      </TLink>
      <nav ref={ref} className="relative mt-4 flex flex-col items-center gap-1">
        <span aria-hidden style={indicator} className="pointer-events-none absolute rounded-xl bg-muted duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]" />
        {nav.map((n) => {
          const active = Boolean(matchPath({ path: n.to, end: n.end }, pathname))
          return (
            <Tooltip key={n.to} content={t(`nav.${n.key}`)} side={side}>
              <TNavLink
                to={n.to}
                end={n.end}
                aria-label={t(`nav.${n.key}`)}
                className={cn(
                  'relative grid size-11 place-items-center rounded-xl transition-colors [&_svg]:size-5',
                  active ? 'text-foreground [&_svg]:text-accent' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <n.icon />
              </TNavLink>
            </Tooltip>
          )
        })}
      </nav>
      <div className="mt-auto flex flex-col items-center gap-2">
        <NotificationsPopover side={side} />
        <UserMenu side={side} />
      </div>
    </aside>
  )
}

export function useHeader() {
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
  const { navPosition } = useAppearance()
  const rail = navPosition === 'top' ? null : navPosition
  return (
    <div className={cn('flex min-h-dvh flex-col', rail === 'left' && 'md:pl-16', rail === 'right' && 'md:pr-16')}>
      {rail ? <SideRail position={rail} /> : null}
      <header ref={header.ref} className={cn('sticky top-0 z-40 pt-2', rail && 'md:hidden')}>
        <div className="mx-auto max-w-(--page-max) px-4 sm:px-6">
          <div
            className={cn(
              'flex h-12 items-center gap-3 -mx-2 rounded-full px-2 transition-[background-color,backdrop-filter] duration-300 [view-transition-name:site-header] sm:h-14 sm:gap-4 sm:-mx-4 sm:px-4',
              header.scrolled ? 'bg-background/55 backdrop-blur-2xl backdrop-saturate-150' : 'bg-transparent',
            )}
          >
            <TLink to="/" className="flex shrink-0 items-center">
              <Logo className="[&>span]:text-[0.9375rem] [&_svg]:size-6 sm:[&>span]:text-[17px] sm:[&_svg]:size-7" />
            </TLink>
            <DesktopNav />
            <div className="ml-auto flex items-center gap-1.5 sm:gap-2 md:ml-0">
              <Button asChild variant="ghost" size="icon" className="rounded-full md:hidden">
                <TLink to="/search" aria-label={t('nav.search')}>
                  <RiSearchFill />
                </TLink>
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
        {description ? <p className="mt-1 text-[0.9375rem] text-muted-foreground">{description}</p> : null}
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
          {icon ? <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent [&_svg]:size-[1.125rem]">{icon}</span> : null}
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            {hint ? <p className="text-[0.8125rem] text-muted-foreground">{hint}</p> : null}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
