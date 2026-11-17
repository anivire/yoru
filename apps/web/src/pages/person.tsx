import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { ListStatus, PersonPage as Person, PersonRole } from '@yoru/shared'
import { Button, EmptyState, Image, Lightbox, Skeleton, cn } from '@yoru/ui'
import { RiArrowDownSLine, RiGlobalLine } from '@remixicon/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useParams } from 'react-router'
import { AnimeCard, GLASS_CHIP } from '../components/anime-cards'
import { Page } from '../components/app-shell'
import { type Crumb, Breadcrumbs } from '../components/breadcrumbs'
import MarkdownRender from '../components/markdown-render'
import { LinkList, LinkLogo, LinkRow, ServiceLogo } from '../components/service-links'
import { AnimeCardSkeleton, TextLine } from '../components/skeletons'
import { api } from '../lib/api'
import { useAppearance } from '../lib/appearance'
import { i18n } from '../lib/i18n'
import { keys } from '../lib/queries'
import { useDocumentTitle } from '../lib/title'

const HEADER_FRAME = 'page-frame page-top-double px-4 pb-10 sm:px-6'

function birthday(b: Person['birthday']) {
  if (!b) return null
  if (!b.month) return b.year ? String(b.year) : null
  return new Date(b.year ?? 2000, b.month - 1, b.day ?? 1).toLocaleDateString(i18n.language, { day: b.day ? 'numeric' : undefined, month: 'long', year: b.year ? 'numeric' : undefined })
}

function PersonLinks({ person, className }: { person: Person; className?: string }) {
  if (!person.url && !person.links.length) return null
  return (
    <LinkList className={className}>
      {person.url ? <LinkRow href={person.url} external logo={<ServiceLogo service="anilist" />} label="AniList" /> : null}
      {person.links.map((link) => (
        <LinkRow
          key={link.url}
          href={link.url}
          external
          label={link.label}
          logo={
            <LinkLogo color="#52525b">
              <RiGlobalLine />
            </LinkLogo>
          }
        />
      ))}
    </LinkList>
  )
}

function PersonHeader({ person, crumbs }: { person: Person; crumbs: Crumb[] }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const facts = [
    [t('person.birthday'), birthday(person.birthday)],
    [t('person.homeTown'), person.homeTown],
    [t('person.active'), person.yearsActive.length ? `${person.yearsActive[0]} — ${person.yearsActive[1] ?? t('person.now')}` : null],
  ].filter((f): f is [string, string] => Boolean(f[1]))
  const long = (person.description?.length ?? 0) > 400
  return (
    <div className={HEADER_FRAME}>
      <Breadcrumbs items={crumbs} className="mb-6" />
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:gap-6">
        <div className="flex w-36 shrink-0 flex-col gap-3 sm:w-48">
          {person.imageUrl ? (
            <Lightbox src={person.imageUrl} title={person.name} closeLabel={t('common.close')}>
              <button type="button" aria-label={person.name} className="group aspect-[2/3] w-full cursor-zoom-in overflow-hidden rounded-xl bg-muted shadow-2xl">
                <Image src={person.imageUrl} alt="" className="h-full w-full object-cover transition-[filter] duration-100 group-hover:brightness-110" />
              </button>
            </Lightbox>
          ) : (
            <div className="aspect-[2/3] w-full rounded-xl bg-muted shadow-2xl" />
          )}
          <PersonLinks person={person} className="hidden sm:flex" />
        </div>
        <div className="flex w-full min-w-0 flex-1 flex-col items-center gap-3 text-center sm:items-stretch sm:text-left">
          <div className="w-full">
            <h1 className="line-clamp-3 text-2xl font-semibold tracking-tight sm:line-clamp-2 sm:text-4xl">{person.name}</h1>
            {person.nativeName ? <div className="mt-1 text-base font-medium text-muted-foreground sm:truncate sm:text-lg sm:font-normal">{person.nativeName}</div> : null}
          </div>
          <div className="flex flex-wrap justify-center gap-1.5 sm:justify-start">
            <span className={cn('inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium', GLASS_CHIP)}>{t('anime.seiyu')}</span>
          </div>
          {facts.length ? (
            <div className="flex flex-col items-center gap-1 text-[0.8125rem] text-muted-foreground sm:items-start">
              {facts.map(([label, value]) => (
                <span key={label}>
                  {label}: <span className="text-foreground">{value}</span>
                </span>
              ))}
            </div>
          ) : null}
          {person.description ? (
            <div className="flex w-full max-w-3xl flex-col gap-1 text-left">
              <div className={cn('text-foreground/80', long && !open && 'max-h-36 overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)]')}>
                <MarkdownRender text={person.description} />
              </div>
              {long ? (
                <Button size="sm" variant="secondary" className="mt-1 self-start" onClick={() => setOpen(!open)}>
                  <RiArrowDownSLine className={cn('transition-transform', open && 'rotate-180')} />
                  {open ? t('anime.less') : t('anime.more')}
                </Button>
              ) : null}
            </div>
          ) : null}
          <PersonLinks person={person} className="w-full max-sm:grid max-sm:grid-cols-2 sm:hidden" />
        </div>
      </div>
    </div>
  )
}

const ROLE_ORDER = ['main', 'supporting', 'background']

function mergeRoles(list: PersonRole[]) {
  const byAnime = new Map<number, PersonRole>()
  for (const r of list) {
    const merged = byAnime.get(r.anime.malId)
    if (!merged) byAnime.set(r.anime.malId, { ...r, characters: [...r.characters] })
    else merged.characters.push(...r.characters.filter((c) => !merged.characters.some((x) => x.id === c.id)))
  }
  for (const r of byAnime.values()) r.characters.sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
  return [...byAnime.values()]
}

function RoleRow({ role, status }: { role: PersonRole; status?: ListStatus }) {
  const { t } = useTranslation()
  return (
    <div className="flex max-w-full gap-3 rounded-2xl bg-foreground/[0.04] p-3">
      <div className="w-32 shrink-0 sm:w-36">
        <AnimeCard anime={role.anime} status={status} />
      </div>
      <div className="scrollbar-none flex min-w-0 gap-3 overflow-x-auto">
        {role.characters.map((c) => (
          <div key={c.id} className="flex w-24 shrink-0 flex-col gap-2 sm:w-28">
            <div className="aspect-[2/3] overflow-hidden rounded-xl bg-muted shadow-sm">{c.imageUrl ? <Image src={c.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}</div>
            <div className="px-0.5">
              <div className="line-clamp-2 text-sm font-medium leading-snug">{c.name}</div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">{t(`anime.role.${c.role}`)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PersonSkeleton() {
  return (
    <div className="relative isolate -mt-(--header-h) pt-(--header-h)">
      <div className={HEADER_FRAME}>
        <TextLine className="mb-6 text-[0.8125rem]" bar="w-56" />
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:gap-6">
          <div className="flex w-36 shrink-0 flex-col gap-3 sm:w-48">
            <Skeleton className="aspect-[2/3] w-full rounded-xl" />
            <div className="hidden flex-col gap-0.5 sm:flex">
              {[16, 24, 20].map((w) => (
                <div key={w} className="flex h-9 items-center gap-3">
                  <Skeleton className="size-6 shrink-0 rounded-md" />
                  <Skeleton className="h-3 rounded-full" style={{ width: `${w * 0.25}rem` }} />
                </div>
              ))}
            </div>
          </div>
          <div className="flex w-full min-w-0 flex-1 flex-col items-center gap-3 sm:items-stretch">
            <div className="flex w-full flex-col items-center sm:items-start">
              <TextLine className="w-full justify-center text-2xl font-semibold sm:justify-start sm:text-4xl" bar="w-1/2" />
              <TextLine className="mt-1 w-full justify-center text-base sm:justify-start sm:text-lg" bar="w-1/4" />
            </div>
            <Skeleton className="h-6 w-14 rounded-full" />
            <div className="flex flex-wrap justify-center gap-x-5 sm:justify-start">
              <TextLine className="text-[0.8125rem]" bar="w-40" />
              <TextLine className="text-[0.8125rem]" bar="w-36" />
            </div>
            <div className="w-full max-w-3xl text-sm leading-relaxed">
              <TextLine />
              <TextLine />
              <TextLine bar="w-3/5" />
            </div>
          </div>
        </div>
      </div>
      <Page>
        <TextLine className="mb-2 text-xl font-semibold" bar="w-20" />
        <div className="skeleton-fill flex flex-wrap gap-4">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="flex max-w-full gap-3 overflow-hidden rounded-2xl bg-foreground/[0.04] p-3">
              {Array.from({ length: i % 4 === 1 ? 3 : 2 }, (_, j) => (
                <div key={j} className={j ? 'w-24 shrink-0 sm:w-28' : 'w-32 shrink-0 sm:w-36'}>
                  <AnimeCardSkeleton />
                </div>
              ))}
            </div>
          ))}
        </div>
      </Page>
    </div>
  )
}

export function PersonPage() {
  const { t } = useTranslation()
  const id = Number(useParams().id?.split('-')[0])
  const { backdrop } = useAppearance()
  const from = (useLocation().state as { from?: Crumb } | null)?.from
  const person = useInfiniteQuery({
    queryKey: ['person', id],
    queryFn: ({ pageParam }) => api.person(id, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (last.hasNextPage ? pages.length + 1 : undefined),
    staleTime: 60 * 60_000,
    retry: false,
  })
  const first = person.data?.pages[0]
  const roles = mergeRoles(person.data?.pages.flatMap((p) => p.roles) ?? [])
  const statuses = useQuery({ queryKey: keys.listStatuses, queryFn: api.listStatuses, staleTime: 60_000 }).data
  useDocumentTitle(first?.name)

  if (person.isPending) return <PersonSkeleton />
  if (person.isError || !first) {
    return (
      <Page>
        <EmptyState mood="error" title={t('person.notFound')} />
      </Page>
    )
  }

  return (
    <div className="relative isolate -mt-(--header-h) pt-(--header-h)">
      <div className={cn('pointer-events-none absolute inset-x-0 top-0 -z-10 h-[52rem] overflow-hidden', backdrop === 'glow' ? 'backdrop-glow' : '[mask-image:linear-gradient(to_bottom,black_30%,transparent)]')}>
        {first.imageUrl ? <img src={first.imageUrl} alt="" className="h-full w-full scale-110 object-cover object-[50%_25%] opacity-50 blur-xl" /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-background/50 to-background/20" />
      </div>
      <PersonHeader person={first} crumbs={[{ label: t('nav.home'), to: '/' }, ...(from ? [from] : []), { label: t('anime.seiyu') }, { label: first.name }]} />
      <Page>
        <h2 className="mb-2 text-xl font-semibold tracking-tight">{t('person.roles')}</h2>
        {roles.length ? (
          <div className="mt-2 flex flex-wrap gap-4">
            {roles.map((r) => (
              <RoleRow key={r.anime.malId} role={r} status={statuses?.[r.anime.malId]} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('person.noRoles')}</p>
        )}
        {person.hasNextPage ? (
          <div className="flex justify-center pt-8">
            <Button variant="secondary" loading={person.isFetchingNextPage} onClick={() => person.fetchNextPage()}>
              {t('search.more')}
            </Button>
          </div>
        ) : null}
      </Page>
    </div>
  )
}
