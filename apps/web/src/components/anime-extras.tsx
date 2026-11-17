import { useQuery } from '@tanstack/react-query'
import type { AnimeCharacter, ListStatus, WatchOrderEntry } from '@yoru/shared'
import { Button, Image, Input, Lightbox, Mascot, Segmented, Skeleton, cn } from '@yoru/ui'
import { RiCornerDownRightLine, RiSearchLine } from '@remixicon/react'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router'
import { api } from '../lib/api'
import { seasonLabel, typeLabel } from '../lib/format'
import { keys } from '../lib/queries'
import { AnimeCard, Rail } from './anime-cards'
import { TLink } from './transition-link'
import { animePath, seiyuuPath, useAnimeTitle } from '../lib/anime-title'
import { StatusText } from '../lib/list-status'
import type { Crumb } from './breadcrumbs'
import { WatchOrderSkeleton } from './skeletons'

function useListStatuses() {
  return useQuery({ queryKey: keys.listStatuses, queryFn: api.listStatuses, staleTime: 60_000 }).data
}

export function useAnimeExtras(malId: number) {
  return useQuery({ queryKey: keys.extras(malId), queryFn: () => api.extras(malId), staleTime: 60 * 60_000 })
}

function Section({ title, action, className, children }: { title: string; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={cn('mt-12', className)}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

const WATCH_ORDER_PREVIEW = 6

export function WatchOrderSection({ malId, className }: { malId: number; className?: string }) {
  const { t } = useTranslation()
  const { data, isPending } = useQuery({ queryKey: keys.franchise(malId), queryFn: () => api.franchise(malId), staleTime: 60 * 60_000 })
  const statuses = useListStatuses()
  const [open, setOpen] = useState(false)
  if (isPending) return <WatchOrderSkeleton />
  if (!data) return null
  if (!data.length) return <RelatedSection malId={malId} className={className} />
  if (data.length < 2) return null
  const numbers = new Map<number, number>()
  for (const e of data) if (!e.side) numbers.set(e.anime.malId, numbers.size + 1)
  const current = Math.max(0, data.findIndex((e) => e.anime.malId === malId))
  const collapsible = data.length > WATCH_ORDER_PREVIEW + 2
  const start = collapsible && !open ? Math.min(Math.max(0, current - 2), data.length - WATCH_ORDER_PREVIEW) : 0
  const shown = collapsible && !open ? data.slice(start, start + WATCH_ORDER_PREVIEW) : data
  const groups: WatchOrderEntry[][] = []
  for (const entry of shown) {
    if (entry.side && groups.length) groups[groups.length - 1]!.push(entry)
    else groups.push([entry])
  }
  return (
    <Section title={t('anime.watchOrder')} className={className}>
      <div className={cn('gap-x-6', shown.length > 3 && 'lg:columns-2')}>
        {groups.map((group) => (
          <div key={group[0]!.anime.malId} className="flex break-inside-avoid flex-col gap-0.5 pb-0.5">
            {group.map((entry) => (
              <WatchOrderRow key={entry.anime.malId} entry={entry} number={numbers.get(entry.anime.malId)} current={entry.anime.malId === malId} status={statuses?.[entry.anime.malId]} />
            ))}
          </div>
        ))}
      </div>
      {collapsible ? (
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setOpen(!open)}>
          {open ? t('anime.less') : t('anime.watchOrderAll', { count: data.length })}
        </Button>
      ) : null}
    </Section>
  )
}

function WatchOrderRow({ entry, number, current, status }: { entry: WatchOrderEntry; number?: number; current: boolean; status?: ListStatus }) {
  const { t } = useTranslation()
  const title = useAnimeTitle()
  const { anime, side, relation } = entry
  const meta = [
    relation ? t(`anime.relation.${relation}`, { defaultValue: '' }) : null,
    typeLabel(anime.type),
    anime.year,
    anime.episodes && anime.episodes > 1 ? `${anime.episodes} ${t('common.episodes')}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <TLink
      to={animePath(anime.malId, anime.title)}
      aria-current={current ? 'page' : undefined}
      className={cn('group flex items-center gap-3 rounded-xl py-1.5 pr-3 transition-colors', side ? 'pl-3 sm:pl-12' : 'pl-3', current ? 'bg-accent-soft' : 'hover:bg-foreground/[0.04]')}
    >
      {side ? (
        <RiCornerDownRightLine className="size-4 shrink-0 text-subtle-foreground" />
      ) : (
        <span className={cn('grid size-7 shrink-0 place-items-center rounded-full font-mono text-xs font-semibold tabular-nums', current ? 'bg-accent text-accent-foreground' : 'bg-foreground/[0.06] text-muted-foreground')}>{number}</span>
      )}
      <div className={cn('shrink-0 overflow-hidden rounded-md bg-muted', side ? 'h-11 w-8' : 'h-14 w-10')}>
        {anime.imageUrl ? (
          <Image src={anime.imageUrl} alt="" fallback className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center">
            <Mascot mood="sleepy" animated={false} className="h-auto w-1/2 opacity-50" />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn('truncate font-medium transition-colors', side ? 'text-[0.8125rem]' : 'text-sm', current ? 'text-accent' : 'group-hover:text-accent')}>{title(anime)}</div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {current ? <span className="font-medium text-accent">{t('anime.watchOrderCurrent')}</span> : null}
          {current && meta ? ' · ' : null}
          {meta}
        </div>
      </div>
      {status ? <StatusText status={status} className="hidden text-xs sm:inline-flex" /> : null}
    </TLink>
  )
}

function RelatedSection({ malId, className }: { malId: number; className?: string }) {
  const { t } = useTranslation()
  const { data } = useAnimeExtras(malId)
  const statuses = useListStatuses()
  if (!data?.relations.length) return null
  return (
    <Section title={t('anime.related')} className={className}>
      <Rail size="poster">
        {data.relations.map(({ relation, anime }) => (
          <AnimeCard
            key={`${relation}-${anime.malId}`}
            anime={anime}
            status={statuses?.[anime.malId]}
            subtitle={[t(`anime.relation.${relation}`, { defaultValue: relation }), typeLabel(anime.type), anime.year].filter(Boolean).join(' · ')}
          />
        ))}
      </Rail>
    </Section>
  )
}

function Portrait({ src }: { src: string | null }) {
  return <div className="aspect-[3/4] overflow-hidden bg-muted">{src ? <Image src={src} alt="" loading="lazy" fallback className="h-full w-full object-cover" /> : null}</div>
}

function CharacterCard({ character, from }: { character: AnimeCharacter; from?: Crumb }) {
  const { t } = useTranslation()
  const va = character.voiceActor
  return (
    <div className="overflow-hidden rounded-xl bg-foreground/[0.04]">
      <div className="grid grid-cols-2">
        <Portrait src={character.imageUrl} />
        {va ? (
          <TLink to={seiyuuPath(va.id, va.name)} state={{ from }} aria-label={va.name} className="transition-[filter] duration-200 hover:brightness-110">
            <Portrait src={va.imageUrl} />
          </TLink>
        ) : (
          <Portrait src={null} />
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 px-3 py-2.5">
        <div className="min-w-0">
          <div className="line-clamp-2 text-sm font-medium leading-snug">{character.name}</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{t(`anime.role.${character.role}`)}</div>
        </div>
        {va ? (
          <TLink to={seiyuuPath(va.id, va.name)} state={{ from }} className="group/va min-w-0 text-right">
            <div className="line-clamp-2 text-sm leading-snug transition-colors group-hover/va:text-accent">{va.name}</div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">{t('anime.seiyu')}</div>
          </TLink>
        ) : null}
      </div>
    </div>
  )
}

type RoleFilter = 'all' | 'main' | 'supporting'

function CharactersSection({ malId }: { malId: number }) {
  const { t } = useTranslation()
  const { data } = useAnimeExtras(malId)
  const page = useQuery({ queryKey: keys.anime(malId), queryFn: () => api.anime(malId) }).data
  const title = useAnimeTitle()
  const { pathname } = useLocation()
  const [role, setRole] = useState<RoleFilter>('all')
  const [query, setQuery] = useState('')
  if (!data?.characters.length) return null
  const from = page ? { label: title(page.anime), to: pathname } : undefined
  const q = query.trim().toLowerCase()
  const shown = data.characters.filter(
    (c) => (role === 'all' || (role === 'main' ? c.role === 'main' : c.role !== 'main')) && (!q || c.name.toLowerCase().includes(q) || Boolean(c.voiceActor?.name.toLowerCase().includes(q))),
  )
  const hasMain = data.characters.some((c) => c.role === 'main')
  const hasOther = data.characters.some((c) => c.role !== 'main')
  return (
    <Section title={t('anime.characters')}>
      <div className="-mt-1 mb-4 flex flex-wrap items-center gap-2">
        {hasMain && hasOther ? (
          <Segmented
            size="sm"
            value={role}
            onChange={setRole}
            options={[
              { value: 'all', label: t('anime.characterFilter.all') },
              { value: 'main', label: t('anime.characterFilter.main') },
              { value: 'supporting', label: t('anime.characterFilter.supporting') },
            ]}
          />
        ) : null}
        <div className="relative w-full sm:w-64">
          <RiSearchLine className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('anime.characterSearch')} className="h-9 rounded-xl pl-9" />
        </div>
      </div>
      {shown.length ? (
        <Rail>
          {shown.map((c) => (
            <CharacterCard key={c.id} character={c} from={from} />
          ))}
        </Rail>
      ) : (
        <p className="py-6 text-sm text-muted-foreground">{t('anime.noCharacters')}</p>
      )}
    </Section>
  )
}

function RecommendationsSection({ malId }: { malId: number }) {
  const { t } = useTranslation()
  const { data } = useAnimeExtras(malId)
  const statuses = useListStatuses()
  if (!data?.recommendations.length) return null
  return (
    <Section title={t('anime.recommendations')}>
      <Rail size="poster">
        {data.recommendations.map((anime) => (
          <AnimeCard key={anime.malId} anime={anime} status={statuses?.[anime.malId]} subtitle={[typeLabel(anime.type), seasonLabel(anime)].filter(Boolean).join(' · ')} />
        ))}
      </Rail>
    </Section>
  )
}

export function ScreenshotsSection({ malId }: { malId: number }) {
  const { t } = useTranslation()
  const { data, isPending } = useQuery({ queryKey: keys.screenshots(malId), queryFn: () => api.screenshots(malId), staleTime: 60 * 60_000 })
  if (isPending) {
    return (
      <section className="mb-12">
        <Skeleton className="mb-4 h-6 w-24 rounded-md" />
        <Rail>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-video rounded-xl" />
          ))}
        </Rail>
      </section>
    )
  }
  if (!data?.length) return null
  return (
    <Section title={t('anime.screenshots')} className="mb-12 mt-0">
      <Rail>
        {data.map((shot, i) => (
          <Lightbox key={shot.full} src={shot.full} title={`${t('anime.screenshots')} ${i + 1}`} closeLabel={t('common.close')}>
            <button type="button" className="group aspect-video cursor-zoom-in overflow-hidden rounded-xl bg-muted">
              <Image src={shot.thumb} alt="" className="h-full w-full object-cover transition-[filter] duration-200 group-hover:brightness-110" />
            </button>
          </Lightbox>
        ))}
      </Rail>
    </Section>
  )
}

export function AnimeExtrasSections({ malId }: { malId: number }) {
  return (
    <>
      <CharactersSection malId={malId} />
      <RecommendationsSection malId={malId} />
    </>
  )
}
