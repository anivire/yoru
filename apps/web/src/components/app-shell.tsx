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
import { RiAccountCircleFill, RiGroupFill, RiLogoutBoxRFill, RiMenuFill, RiSearchFill, RiSettings3Fill, RiShieldFill, RiUser3Fill } from '@remixicon/react'
import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { matchPath, useLocation, useNavigate } from 'react-router'
import { api } from '../lib/api'
import { useAppearance } from '../lib/appearance'
import { NAV, isBeta } from '../lib/navigation'
import { keys, useUser } from '../lib/queries'
import { NotificationsPopover, useNotificationSound } from './notifications'
import { RailLabel, RailProvider, RailTip, useRailButton, BetaIcon, RailIcon } from './rail'
import { BetaBadge } from './watch-together'
import { Footer } from './footer'
import { TLink, TNavLink, useTransitionNavigate } from './transition-link'
import { AppearancePopover } from './appearance-panel'
import { UserAvatar, nameOf } from './user-avatar'

const NAV_ITEM = 'relative inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors [&_svg]:size-4 [&_svg]:shrink-0'

function useVisibleNav() {
  const { hiddenNav } = useAppearance()
  return NAV.filter((n) => !hiddenNav.includes(n.key))
}

function NavItems({ compact = false, side = 'bottom' }: { compact?: boolean; side?: 'top' | 'bottom' }) {
  const { t } = useTranslation()
  const nav = useVisibleNav()
  const { pathname } = useLocation()
  return (
    <>
      {nav.map((n) => {
        const label = t(`nav.${n.key}`)
        const active = Boolean(matchPath({ path: n.to, end: n.end }, pathname))
        const link = (
          <TNavLink
            key={n.to}
            to={n.to}
            end={n.end}
            aria-label={compact ? label : undefined}
            className={cn(NAV_ITEM, active ? 'text-foreground [&_svg]:text-accent' : 'text-muted-foreground hover:text-foreground')}
          >
            {compact && isBeta(n) ? (
              <BetaIcon>
                <n.icon />
              </BetaIcon>
            ) : (
              <n.icon />
            )}
            {compact ? null : label}
            {!compact && isBeta(n) ? <BetaBadge /> : null}
          </TNavLink>
        )
        if (!compact) return link
        return (
          <Tooltip
            key={n.to}
            side={side}
            content={
              isBeta(n) ? (
                <span className="inline-flex items-center gap-1.5">
                  {label}
                  <BetaBadge />
                </span>
              ) : (
                label
              )
            }
          >
            {link}
          </Tooltip>
        )
      })}
    </>
  )
}

function useFits(frame: RefObject<HTMLElement | null>, content: RefObject<HTMLElement | null>) {
  const [fits, setFits] = useState(true)
  useEffect(() => {
    const outer = frame.current
    const inner = content.current
    if (!outer || !inner) return
    const observer = new ResizeObserver(() => setFits(inner.offsetWidth <= outer.clientWidth))
    observer.observe(outer)
    observer.observe(inner)
    return () => observer.disconnect()
  }, [frame, content])
  return fits
}

function DesktopNav({ side }: { side: 'top' | 'bottom' }) {
  const ref = useRef<HTMLElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const full = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  const { pageWidth, hiddenNav } = useAppearance()
  const fits = useFits(frame, full)
  const compact = side === 'top' || !fits
  const indicator = useSlidingIndicator(ref, '[aria-current="page"]', `${pathname}|${pageWidth}|${hiddenNav.join()}|${compact}`)
  return (
    <div ref={frame} className="relative hidden min-w-0 flex-1 justify-center md:flex">
      <div ref={full} inert aria-hidden className="pointer-events-none invisible absolute left-0 top-0 flex w-max items-center gap-1">
        <NavItems />
      </div>
      <nav ref={ref} className="relative flex items-center gap-1">
        <span aria-hidden style={indicator} className="pointer-events-none absolute rounded-lg bg-muted duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]" />
        <NavItems compact={compact} side={side} />
      </nav>
    </div>
  )
}

function MobileMenu() {
  const go = useTransitionNavigate()
  const { t } = useTranslation()
  const nav = useVisibleNav()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const tap = useRef<{ wasOpen: boolean } | null>(null)
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        asChild
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse') return
          tap.current = { wasOpen: open }
          e.preventDefault()
        }}
        onClick={() => {
          if (!tap.current) return
          setOpen(!tap.current.wasOpen)
          tap.current = null
        }}
      >
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
              {key === 'together' ? <BetaBadge className="ml-auto" /> : null}
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
      <UserAvatar user={user} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">{nameOf(user)}</span>
        <span className="block text-xs font-normal text-muted-foreground">{user.role === 'admin' ? t('nav.roleAdmin') : t('nav.roleUser')}</span>
      </span>
    </DropdownMenuLabel>
  )
}

function AccountItems({ settings = true }: { settings?: boolean }) {
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
      <DropdownMenuItem onSelect={() => go(`/u/${user.username}`)}>
        <RiAccountCircleFill />
        {t('nav.profile')}
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => go('/friends')}>
        <RiGroupFill />
        {t('nav.friends')}
      </DropdownMenuItem>
      {settings ? (
        <DropdownMenuItem onSelect={() => go('/settings')}>
          <RiSettings3Fill />
          {t('nav.settings')}
        </DropdownMenuItem>
      ) : null}
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

function UserMenu({ side = 'bottom', rail = false }: { side?: 'top' | 'bottom' | 'left' | 'right'; rail?: boolean }) {
  const { t } = useTranslation()
  const user = useUser()
  const railButton = useRailButton()
  const trigger = (
    <DropdownMenuTrigger asChild>
      {rail ? (
        <button type="button" aria-label={t('nav.account')} className={railButton}>
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="size-5 shrink-0 rounded-full object-cover" /> : <RiUser3Fill />}
          <RailLabel>{nameOf(user)}</RailLabel>
        </button>
      ) : (
        <Button variant="secondary" size="icon" aria-label={t('nav.account')} className="overflow-hidden rounded-full">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="size-full object-cover" /> : <span className="text-[0.8125rem] font-semibold uppercase">{nameOf(user).slice(0, 1)}</span>}
        </Button>
      )}
    </DropdownMenuTrigger>
  )
  return (
    <DropdownMenu>
      {rail && side !== 'bottom' ? (
        <RailTip label={t('nav.account')} side={side}>
          {trigger}
        </RailTip>
      ) : (
        trigger
      )}
      <DropdownMenuContent side={side} className="w-60">
        <ProfileLabel />
        <AccountItems settings={false} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SettingsButton({ rail = false, side = 'bottom' }: { rail?: boolean; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  const { t } = useTranslation()
  const active = Boolean(matchPath({ path: '/settings', end: false }, useLocation().pathname))
  const railButton = useRailButton()
  if (!rail) {
    return (
      <Tooltip content={t('nav.settings')} side={side}>
        <Button asChild variant="secondary" size="icon" className={cn('rounded-full', active && 'text-accent')}>
          <TLink to="/settings" aria-label={t('nav.settings')}>
            <RiSettings3Fill />
          </TLink>
        </Button>
      </Tooltip>
    )
  }
  return (
    <RailTip label={t('nav.settings')} side={side}>
      <TLink to="/settings" aria-label={t('nav.settings')} className={cn(railButton, active && 'bg-muted text-foreground [&_svg]:text-accent')}>
        <RiSettings3Fill />
        <RailLabel>{t('nav.settings')}</RailLabel>
      </TLink>
    </RailTip>
  )
}

function SideRail({ position }: { position: 'left' | 'right' }) {
  const { navLabels } = useAppearance()
  const [hovered, setHovered] = useState(false)
  const ref = useRef<HTMLElement>(null)
  const expanded = navLabels === 'always' || (navLabels === 'hover' && hovered)
  useEffect(() => {
    if (!hovered) return
    const onMove = (e: PointerEvent) => {
      if (ref.current?.querySelector('[data-state="open"]')) return
      const r = ref.current?.getBoundingClientRect()
      if (!r || e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) setHovered(false)
    }
    const onLeaveWindow = () => {
      if (!ref.current?.querySelector('[data-state="open"]')) setHovered(false)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeaveWindow)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeaveWindow)
    }
  }, [hovered])
  return (
    <RailProvider value={{ labels: navLabels !== 'off', expanded, fill: true }}>
      <aside
        data-app-chrome
        ref={ref}
        onPointerOver={(e) => {
          if (navLabels === 'hover' && (e.target as Element).closest('a, button')) setHovered(true)
        }}
        className={cn(
          'fixed inset-y-0 z-40 hidden flex-col items-start px-2 py-3 transition-[width,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] [view-transition-name:site-rail] md:flex',
          position === 'left' ? 'left-0' : 'right-0',
          expanded ? 'w-[11.25rem]' : 'w-[3.75rem]',
          navLabels === 'hover' && expanded && 'bg-background',
        )}
      >
        <SideRailContent position={position} />
      </aside>
    </RailProvider>
  )
}

function SideRailContent({ position }: { position: 'left' | 'right' }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  const { hiddenNav, appearanceButton } = useAppearance()
  const railButton = useRailButton()
  const nav = useVisibleNav()
  const indicator = useSlidingIndicator(ref, '[aria-current="page"]', `${pathname}|${hiddenNav.join()}|${position}`)
  const side = position === 'left' ? 'right' : 'left'
  return (
    <>
      <TLink to="/" aria-label="yoru" className="grid size-11 place-items-center">
        <LogoMark size={30} />
      </TLink>
      <nav ref={ref} className="relative mt-4 flex w-full flex-col items-start gap-1">
        <span aria-hidden style={{ ...indicator, left: 0, width: '100%', transitionProperty: indicator.transitionProperty ? 'top, height, opacity' : undefined }} className="pointer-events-none absolute rounded-xl bg-muted duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]" />
        {nav.map((n) => {
          const active = Boolean(matchPath({ path: n.to, end: n.end }, pathname))
          return (
            <RailTip
              key={n.to}
              label={
                isBeta(n) ? (
                  <span className="inline-flex items-center gap-1.5">
                    {t(`nav.${n.key}`)}
                    <BetaBadge />
                  </span>
                ) : (
                  t(`nav.${n.key}`)
                )
              }
              side={side}
            >
              <TNavLink
                to={n.to}
                end={n.end}
                aria-label={t(`nav.${n.key}`)}
                className={cn(railButton, active && 'text-foreground [&_svg]:text-accent')}
              >
                <RailIcon beta={isBeta(n)}>
                  <n.icon />
                </RailIcon>
                <RailLabel badge={isBeta(n) ? <BetaBadge /> : undefined}>{t(`nav.${n.key}`)}</RailLabel>
              </TNavLink>
            </RailTip>
          )
        })}
      </nav>
      <div className="mt-auto flex w-full flex-col items-start gap-2">
        {appearanceButton ? <AppearancePopover side={side} rail full /> : null}
        <SettingsButton side={side} rail />
        <NotificationsPopover side={side} rail />
        <UserMenu side={side} rail />
      </div>
    </>
  )
}

export function useHeader(bottom = false) {
  const ref = useRef<HTMLElement>(null)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    const header = ref.current
    const measure = () => {
      if (!header) return
      const height = getComputedStyle(header).position === 'fixed' ? 0 : header.offsetHeight
      document.documentElement.style.setProperty('--header-h', `${height}px`)
    }
    const observer = new ResizeObserver(measure)
    if (header) observer.observe(header)
    window.addEventListener('resize', measure, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', measure)
      observer.disconnect()
    }
  }, [bottom])
  return { ref, scrolled }
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { navPosition, navLabels, appearanceButton } = useAppearance()
  const rail = navPosition === 'left' || navPosition === 'right' ? navPosition : null
  const dock = navPosition === 'bottom'
  const header = useHeader(dock)
  const side = dock ? 'top' : 'bottom'
  useNotificationSound()
  return (
    <div
      className={cn(
        'flex min-h-dvh flex-col',
        rail && 'md:[--page-top:1.125rem]',
        rail && navLabels !== 'always' && 'md:[--page-max:min(var(--page-max-setting),calc(100%-2.65rem))]',
        rail && navLabels === 'always' && 'md:[--page-max:min(var(--page-max-setting),calc(100%-10.15rem))]',
        rail === 'left' && (navLabels === 'always' ? 'md:[--rail-left:10.15rem]' : 'md:[--rail-left:2.65rem]'),
        rail === 'right' && (navLabels === 'always' ? 'md:[--rail-right:10.15rem]' : 'md:[--rail-right:2.65rem]'),
        dock && 'md:pb-20 md:[--page-top:1.5rem]',
      )}
    >
      {rail ? <SideRail position={rail} /> : null}
      <header data-app-chrome ref={header.ref} className={cn('sticky top-0 z-40 pt-2', rail && 'md:hidden', dock && 'md:fixed md:inset-x-0 md:top-auto md:bottom-0 md:pb-3 md:pt-0')}>
        <div className="page-frame px-4 sm:px-6">
          <div
            className={cn(
              'flex h-12 items-center gap-3 -mx-2 rounded-full px-2 transition-[background-color,backdrop-filter] duration-300 [view-transition-name:site-header] sm:h-14 sm:gap-4 sm:-mx-4 sm:px-4',
              header.scrolled ? 'bg-background/55 backdrop-blur-2xl backdrop-saturate-150' : 'bg-transparent',
              dock && 'md:bg-background/70 md:backdrop-blur-2xl md:backdrop-saturate-150',
            )}
          >
            <TLink to="/" className="flex shrink-0 items-center">
              <Logo className="[&>span]:text-[0.9375rem] [&_svg]:size-6 sm:[&>span]:text-[17px] sm:[&_svg]:size-7" />
            </TLink>
            <DesktopNav side={side} />
            <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2 md:ml-0">
              <Button asChild variant="ghost" size="icon" className="rounded-full md:hidden">
                <TLink to="/search" aria-label={t('nav.search')}>
                  <RiSearchFill />
                </TLink>
              </Button>
              <div className="hidden items-center gap-2 md:flex">
                {appearanceButton && !rail ? <AppearancePopover side={side} full /> : null}
                <SettingsButton side={side} />
              </div>
              <NotificationsPopover side={side} />
              <div className="hidden md:block">
                <UserMenu side={side} />
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
  return <div className={cn('page-frame w-full px-4 pb-8 pt-4 sm:px-6 sm:pt-(--page-top,2rem)', className)}>{children}</div>
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
  media,
  action,
  children,
  className,
}: {
  title: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  media?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('mt-10 first:mt-0', className)}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {media}
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
