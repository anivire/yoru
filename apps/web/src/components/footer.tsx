import { useQuery } from '@tanstack/react-query'
import { Logo, Skeleton, cn } from '@yoru/ui'
import { RiArrowUpCircleFill, RiExternalLinkLine, RiGithubFill } from '@remixicon/react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { NAV } from '../lib/navigation'
import { useUser } from '../lib/queries'
import { TLink } from './transition-link'

const SOURCES = [
  { name: 'Anime365', url: 'https://smotret-anime.app' },
  { name: 'Shikimori', url: 'https://shikimori.one' },
  { name: 'MyAnimeList', url: 'https://myanimelist.net' },
  { name: 'Jikan', url: 'https://jikan.moe' },
  { name: 'AniList', url: 'https://anilist.co' },
] as const

const linkClass = 'inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground'

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-subtle-foreground">{title}</h3>
      <ul className="flex flex-col gap-2 text-sm">{children}</ul>
    </div>
  )
}

function External({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <a href={href} target="_blank" rel="noreferrer" className={cn(linkClass, 'group')}>
        {children}
        <RiExternalLinkLine className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
      </a>
    </li>
  )
}

function Internal({ to, children }: { to: string; children: ReactNode }) {
  return (
    <li>
      <TLink to={to} className={linkClass}>
        {children}
      </TLink>
    </li>
  )
}

function useVersion(scope: 'app' | 'public') {
  return useQuery({ queryKey: ['version', scope], queryFn: api.version, staleTime: 30 * 60_000 }).data
}

function VersionBadge({ scope }: { scope: 'app' | 'public' }) {
  const { t } = useTranslation()
  const data = useVersion(scope)
  if (!data) return <Skeleton className="h-4 w-24 rounded-full" />
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <a href={data.repoUrl} target="_blank" rel="noreferrer" className="hover:text-foreground">
        v{data.version}
      </a>
      {data.commit && data.commitUrl ? (
        <a href={data.commitUrl} target="_blank" rel="noreferrer" className="font-mono text-xs text-subtle-foreground hover:text-foreground">
          {data.commit.slice(0, 7)}
        </a>
      ) : null}
      {data.updateAvailable ? (
        <a
          href={data.compareUrl ?? data.repoUrl}
          target="_blank"
          rel="noreferrer"
          title={data.latest?.message}
          className="inline-flex h-6 items-center gap-1.5 rounded-full bg-accent-soft px-2.5 text-xs font-medium text-accent hover:bg-accent hover:text-accent-foreground"
        >
          <RiArrowUpCircleFill className="size-3.5" />
          {data.latest?.version && data.latest.version !== data.version ? t('version.updateTo', { version: data.latest.version }) : t('version.update')}
        </a>
      ) : null}
    </span>
  )
}

function AppColumns() {
  const { t } = useTranslation()
  const user = useUser()
  return (
    <>
      <Column title={t('footer.browse')}>
        {NAV.map((n) => (
          <Internal key={n.to} to={n.to}>
            {t(`nav.${n.key}`)}
          </Internal>
        ))}
      </Column>
      <Column title={t('footer.account')}>
        <Internal to="/settings/account">{t('settings.account')}</Internal>
        <Internal to="/settings/appearance">{t('settings.appearance')}</Internal>
        <Internal to="/settings/notifications">{t('settings.notifications')}</Internal>
        <Internal to="/settings/import">{t('settings.import')}</Internal>
        {user?.role === 'admin' ? <Internal to="/admin">{t('nav.admin')}</Internal> : null}
      </Column>
    </>
  )
}

export function Footer({ scope, compact, className }: { scope: 'app' | 'public'; compact?: boolean; className?: string }) {
  const { t } = useTranslation()
  const data = useVersion(scope)
  const repoUrl = data?.repoUrl

  if (compact) {
    return (
      <footer className={cn('flex flex-wrap items-center justify-center gap-2 py-6 text-sm text-muted-foreground', className)}>
        <span>yoru</span>
        <VersionBadge scope={scope} />
      </footer>
    )
  }

  return (
    <footer className={cn('mt-12', className)}>
      <div className="mx-auto max-w-(--page-max) px-4 sm:px-6">
        <div className="border-t border-border py-10">
          <div className={cn('grid grid-cols-2 gap-x-6 gap-y-8', scope === 'app' ? 'md:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))]' : 'md:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))]')}>
            <div className="col-span-2 flex flex-col gap-3 md:col-span-1">
              <TLink to="/" className="w-fit">
                <Logo />
              </TLink>
              <p className="max-w-xs text-sm text-muted-foreground">{t('footer.tagline')}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
                {repoUrl ? (
                  <a href={repoUrl} target="_blank" rel="noreferrer" className={linkClass}>
                    <RiGithubFill className="size-4" />
                    Open Source
                  </a>
                ) : null}
                <VersionBadge scope={scope} />
              </div>
            </div>
            {scope === 'app' ? <AppColumns /> : null}
            <Column title={t('footer.sources')}>
              {SOURCES.map((s) => (
                <External key={s.name} href={s.url}>
                  {s.name}
                </External>
              ))}
            </Column>
            <Column title={t('footer.project')}>
              {repoUrl ? (
                <>
                  <External href={repoUrl}>GitHub</External>
                  <External href={`${repoUrl}/commits`}>{t('footer.changelog')}</External>
                  <External href={`${repoUrl}/issues`}>{t('footer.issues')}</External>
                  <External href={`${repoUrl}#readme`}>{t('footer.selfHost')}</External>
                </>
              ) : null}
            </Column>
          </div>
        </div>
      </div>
    </footer>
  )
}
