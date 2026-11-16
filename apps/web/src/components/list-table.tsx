import type { ListEntryWithAnime } from '@yoru/shared'
import { Image, Progress, Segmented, StarIcon, cn } from '@yoru/ui'
import { RiLayoutGridFill, RiLayoutRowFill, RiRepeatFill } from '@remixicon/react'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDate, typeLabel } from '../lib/format'
import { EpisodeCount, scoreColor } from './anime-cards'
import { TLink } from './transition-link'
import { AnimeTitle } from '../lib/anime-title'
import { STATUS_META, StatusIcon, TONE_TEXT } from '../lib/list-status'

export type ListView = 'grid' | 'table'

const VIEW_KEY = 'yoru:list-view'

export function useListView() {
  const [view, setView] = useState<ListView>(() => (localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'grid'))
  const change = (v: ListView) => {
    setView(v)
    localStorage.setItem(VIEW_KEY, v)
  }
  return [view, change] as const
}

export function ViewToggle({ view, onChange }: { view: ListView; onChange: (v: ListView) => void }) {
  const { t } = useTranslation()
  return (
    <Segmented
      className="ml-auto [&_button]:h-9 [&_button]:px-3"
      value={view}
      onChange={onChange}
      options={[
        { value: 'grid', icon: <RiLayoutGridFill />, label: <span className="sr-only">{t('lists.grid')}</span>, title: t('lists.grid') },
        { value: 'table', icon: <RiLayoutRowFill />, label: <span className="sr-only">{t('lists.table')}</span>, title: t('lists.table') },
      ]}
    />
  )
}

function RowLink({ malId, external, className, children }: { malId: number; external?: boolean; className: string; children: ReactNode }) {
  if (external) {
    return (
      <a href={`https://myanimelist.net/anime/${malId}`} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    )
  }
  return (
    <TLink to={`/anime/${malId}`} className={className}>
      {children}
    </TLink>
  )
}

const TABLE_COLS =
  'grid items-center gap-x-4 grid-cols-[minmax(0,1fr)_5.5rem] @md:grid-cols-[minmax(0,1fr)_6rem_3.5rem] @2xl:grid-cols-[minmax(0,1fr)_8.5rem_6.5rem_3.5rem] @4xl:grid-cols-[minmax(0,1fr)_8.5rem_7rem_3.5rem_7.5rem]'

export function ListTable({ items, external }: { items: ListEntryWithAnime[]; external?: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="@container rounded-2xl bg-surface p-1.5">
      <div className={cn(TABLE_COLS, 'px-3 pb-1.5 pt-2 text-xs font-medium text-subtle-foreground')}>
        <span>{t('lists.name')}</span>
        <span className="hidden @2xl:block">{t('search.status')}</span>
        <span>{t('lists.progress')}</span>
        <span className="hidden @md:block">{t('lists.score')}</span>
        <span className="hidden text-right @4xl:block">{t('lists.updated')}</span>
      </div>
      <div className="flex flex-col">
        {items.map((e) => (
          <RowLink key={e.malId} malId={e.malId} external={external} className={cn(TABLE_COLS, 'group rounded-xl px-3 py-2 transition-colors [contain-intrinsic-size:auto_4.5rem] [content-visibility:auto] hover:bg-field-hover')}>
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                {e.anime.imageUrl ? <Image src={e.anime.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium transition-colors group-hover:text-accent"><AnimeTitle anime={e.anime} /></div>
                <div className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground">
                  {[typeLabel(e.anime.type), e.anime.year].filter(Boolean).join(' · ')}
                  {e.rewatches ? (
                    <span className="inline-flex items-center gap-0.5" title={t('anime.rewatches')}>
                      · <RiRepeatFill className="size-3" />
                      {e.rewatches}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <span className={cn('hidden min-w-0 items-center gap-2 text-[0.8125rem] font-medium @2xl:flex', TONE_TEXT[STATUS_META[e.status].tone])}>
              <StatusIcon status={e.status} />
              <span className="truncate">{t(`status.${e.status}`)}</span>
            </span>
            <div className="flex flex-col gap-1.5">
              <EpisodeCount current={e.progress} total={e.anime.episodes} className="text-[0.8125rem] font-medium" />
              {e.anime.episodes ? <Progress value={e.progress / e.anime.episodes} tone={e.progress >= e.anime.episodes ? 'foreground' : 'accent'} className="h-0.5 bg-field" /> : null}
            </div>
            <span className="hidden @md:block">
              {e.score ? (
                <span className="inline-flex items-center gap-1 text-[0.8125rem] font-semibold tabular-nums">
                  <StarIcon className="size-3.5" style={{ color: scoreColor(e.score) }} />
                  {e.score}
                </span>
              ) : (
                <span className="text-[0.8125rem] text-subtle-foreground">{t('anime.noScore')}</span>
              )}
            </span>
            <span className="hidden text-right text-xs text-muted-foreground @4xl:block" title={formatDate(e.updatedAt, { dateStyle: 'long', timeStyle: 'short' })}>
              {formatDate(e.updatedAt)}
            </span>
          </RowLink>
        ))}
      </div>
    </div>
  )
}
