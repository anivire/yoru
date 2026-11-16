import { useQuery } from '@tanstack/react-query'
import type { AnimeSummary, RoomMedia } from '@yoru/shared'
import { Card, EmptyState, Image, Input, Skeleton, Tooltip, cn, toast } from '@yoru/ui'
import { RiGroupFill, RiLinkM, RiPlayCircleFill, RiSearchFill, RiTv2Fill } from '@remixicon/react'
import { type ReactNode, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Page, PageHeader, Section } from '../components/app-shell'
import { TLink } from '../components/transition-link'
import { BetaBadge, copyRoomLink } from '../components/watch-together'
import { useAnimeTitle } from '../lib/anime-title'
import { api } from '../lib/api'
import { useAppearance } from '../lib/appearance'
import { errorMessage } from '../lib/queries'
import { useDocumentTitle } from '../lib/title'

function Step({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent [&_svg]:size-[1.125rem]">{icon}</span>
      <span className="font-semibold">{title}</span>
      <span className="text-[0.8125rem] text-muted-foreground">{text}</span>
    </Card>
  )
}

function PickCard({ anime, hint, busy, onPick }: { anime: AnimeSummary; hint?: string; busy: boolean; onPick: () => void }) {
  const title = useAnimeTitle()
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onPick}
      className="group flex min-w-0 cursor-pointer items-center gap-3 rounded-xl bg-surface p-2 pr-3 text-left transition-colors hover:bg-field disabled:cursor-wait disabled:opacity-60"
    >
      <span className="h-16 w-11 shrink-0 overflow-hidden rounded-lg bg-muted">{anime.imageUrl ? <Image src={anime.imageUrl} alt="" className="h-full w-full object-cover" /> : null}</span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm font-medium leading-snug">{title(anime)}</span>
        {hint ? <span className="mt-0.5 block truncate text-xs text-muted-foreground">{hint}</span> : null}
      </span>
      <RiPlayCircleFill className="size-6 shrink-0 text-accent opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
    </button>
  )
}

function useDebounced(value: string, ms = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms)
    return () => window.clearTimeout(timer)
  }, [value, ms])
  return debounced
}

function PickGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
}

function PickSkeleton() {
  return (
    <PickGrid>
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-20 rounded-xl" />
      ))}
    </PickGrid>
  )
}

export function TogetherPage() {
  const { t } = useTranslation()
  const title = useAnimeTitle()
  const navigate = useNavigate()
  const { defaultKind } = useAppearance()
  useDocumentTitle(t('room.page.title'))
  const [query, setQuery] = useState('')
  const q = useDebounced(query.trim())
  const [creating, setCreating] = useState<number | null>(null)

  const rooms = useQuery({ queryKey: ['rooms'], queryFn: api.rooms, refetchInterval: 10_000 })
  const watching = useQuery({ queryKey: ['list', { status: 'watching', together: true }], queryFn: () => api.list({ status: 'watching', limit: 12, sort: 'updated' }) })
  const search = useQuery({ queryKey: ['search', q, 'together'], queryFn: () => api.search({ q, limit: 12 }), enabled: q.length >= 2 })

  const create = (anime: AnimeSummary, episode: number | null) => {
    setCreating(anime.malId)
    const media: RoomMedia = { episode, source: 'anime365', kind: defaultKind, author: null }
    api
      .createRoom({ malId: anime.malId, media })
      .then((info) => {
        copyRoomLink(info.id, t('room.created'))
        navigate(episode ? `/together/${info.id}?episode=${episode}` : `/together/${info.id}`)
      })
      .catch((e: unknown) => toast.error(errorMessage(e, t)))
      .finally(() => setCreating(null))
  }

  const results = search.data?.items ?? []
  const entries = watching.data?.items ?? []

  return (
    <Page>
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2.5">
            {t('room.page.title')}
            <BetaBadge className="h-5 px-2 text-[0.6875rem]" />
          </span>
        }
        description={t('room.page.description')}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Step icon={<RiTv2Fill />} title={t('room.page.step1')} text={t('room.page.step1Hint')} />
        <Step icon={<RiLinkM />} title={t('room.page.step2')} text={t('room.page.step2Hint')} />
        <Step icon={<RiGroupFill />} title={t('room.page.step3')} text={t('room.page.step3Hint')} />
      </div>

      {rooms.data?.length ? (
        <Section title={t('room.page.active')} hint={t('room.page.activeHint')} icon={<RiGroupFill />}>
          <PickGrid>
            {rooms.data.map((r) => (
              <TLink key={r.id} to={`/together/${r.id}`} className="flex min-w-0 items-center gap-3 rounded-xl bg-accent-soft p-2 pr-3 transition-opacity hover:opacity-90">
                <span className="h-16 w-11 shrink-0 overflow-hidden rounded-lg bg-muted">{r.anime.imageUrl ? <Image src={r.anime.imageUrl} alt="" className="h-full w-full object-cover" /> : null}</span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 text-sm font-medium">{title(r.anime)}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={cn('size-1.5 rounded-full', r.playing ? 'bg-success' : 'bg-subtle-foreground')} />
                    {r.episode ? t('room.page.episode', { episode: r.episode }) : t('room.page.noEpisode')}
                  </span>
                </span>
                <span className="flex -space-x-1.5">
                  {r.members.slice(0, 3).map((m) => (
                    <Tooltip key={m.id} content={m.username}>
                      <span className="grid size-7 place-items-center rounded-full bg-accent text-[0.6875rem] font-semibold uppercase text-accent-foreground ring-2 ring-accent-soft">{m.username.slice(0, 1)}</span>
                    </Tooltip>
                  ))}
                </span>
              </TLink>
            ))}
          </PickGrid>
        </Section>
      ) : null}

      <Section className="grow-empty" title={t('room.page.pick')} hint={t('room.page.pickHint')} icon={<RiPlayCircleFill />}>
        <div className="relative mb-4">
          <RiSearchFill className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('room.page.search')} className="h-11 rounded-xl pl-10 text-[0.9375rem]" />
        </div>
        {q.length >= 2 ? (
          search.isPending ? (
            <PickSkeleton />
          ) : results.length ? (
            <PickGrid>
              {results.map((a) => (
                <PickCard key={a.malId} anime={a} hint={[a.type?.toUpperCase(), a.year].filter(Boolean).join(' · ')} busy={creating !== null} onPick={() => create(a, null)} />
              ))}
            </PickGrid>
          ) : (
            <EmptyState mood="thinking" title={t('search.nothing')} />
          )
        ) : watching.isPending ? (
          <PickSkeleton />
        ) : entries.length ? (
          <>
            <div className="mb-2 text-[0.8125rem] font-medium text-muted-foreground">{t('room.page.watching')}</div>
            <PickGrid>
              {entries.map((e) => {
                const next = e.anime.episodes ? Math.min(e.progress + 1, e.anime.episodes) : e.progress + 1
                return <PickCard key={e.malId} anime={e.anime} hint={t('room.page.episode', { episode: next })} busy={creating !== null} onPick={() => create(e.anime, next)} />
              })}
            </PickGrid>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t('room.page.searchHint')}</p>
        )}
      </Section>
    </Page>
  )
}
