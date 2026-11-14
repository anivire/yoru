import type { Episode } from '@yoru/shared'
import { Badge, Image, Skeleton, cn } from '@yoru/ui'
import { RiCheckFill, RiLayoutGridFill, RiListUnordered } from '@remixicon/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export function EpisodeList({
  episodes,
  current,
  loading,
  onSelect,
}: {
  episodes: Episode[]
  current: number
  loading: boolean
  onSelect: (n: number) => void
}) {
  const { t } = useTranslation()
  const [view, setView] = useState<'list' | 'grid'>(() => (localStorage.getItem('yoru:episodes-view') === 'grid' ? 'grid' : 'list'))
  const activeRef = useRef<HTMLButtonElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const box = scrollRef.current
    const item = activeRef.current
    if (!box || !item) return
    const top = item.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop
    if (top < box.scrollTop) box.scrollTop = top
    else if (top + item.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = top + item.offsetHeight - box.clientHeight
  }, [current, episodes.length, view])
  const switchView = (v: 'list' | 'grid') => {
    setView(v)
    localStorage.setItem('yoru:episodes-view', v)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium">
          {t('player.episodesTitle')} <span className="font-mono text-xs text-subtle-foreground">{episodes.length || ''}</span>
        </span>
        <div className="flex gap-0.5">
          {(['grid', 'list'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => switchView(v)}
              className={cn('cursor-pointer rounded-md p-1.5', view === v ? 'bg-muted text-foreground' : 'text-subtle-foreground hover:text-foreground')}
            >
              {v === 'grid' ? <RiLayoutGridFill className="size-4" /> : <RiListUnordered className="size-4" />}
            </button>
          ))}
        </div>
      </div>
      <div ref={scrollRef} className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2">
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="aspect-video w-36 shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              </div>
            ))}
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-5 gap-1.5">
            {episodes.map((e) => (
              <button
                key={e.number}
                ref={e.number === current ? activeRef : undefined}
                type="button"
                disabled={!e.available}
                onClick={() => onSelect(e.number)}
                className={cn(
                  'relative h-10 cursor-pointer rounded-lg font-mono text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-35',
                  e.number === current ? 'bg-accent-soft text-accent' : 'bg-field hover:bg-field-hover',
                  e.watched && e.number !== current && 'text-subtle-foreground',
                )}
              >
                {e.number}
                {e.watched ? <span className="absolute right-1 top-1 size-1.5 rounded-full bg-accent" /> : null}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {episodes.map((e) => {
              const active = e.number === current
              const ratio = e.position && e.duration ? e.position / e.duration : e.watched ? 1 : 0
              return (
                <button
                  key={e.number}
                  ref={active ? activeRef : undefined}
                  type="button"
                  disabled={!e.available}
                  onClick={() => onSelect(e.number)}
                  className={cn(
                    'group flex cursor-pointer gap-3 rounded-xl p-1.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                    active ? 'bg-accent-soft' : 'hover:bg-muted',
                  )}
                >
                  <div className={cn('relative aspect-video w-36 shrink-0 overflow-hidden rounded-lg', e.imageUrl ? 'bg-muted' : active ? 'bg-accent/20' : 'bg-field')}>
                    {e.imageUrl ? (
                      <Image src={e.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <span className={cn('absolute inset-0 grid place-items-center font-mono text-2xl font-semibold', active ? 'text-accent' : 'text-subtle-foreground')}>{e.number}</span>
                    )}
                    {ratio > 0 ? (
                      <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
                        <div className="h-full bg-accent" style={{ width: `${Math.min(100, ratio * 100)}%` }} />
                      </div>
                    ) : null}
                    {e.watched ? (
                      <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-black/60 text-white">
                        <RiCheckFill className="size-3" />
                      </span>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1 py-0.5">
                    <div className={cn('text-[0.8125rem] font-medium', active ? 'text-accent' : 'text-muted-foreground')}>
                      {t('common.episode')} {e.number}
                    </div>
                    {e.title ? <div className="line-clamp-2 text-sm leading-snug">{e.title}</div> : null}
                    <div className="mt-1 flex gap-1">
                      {e.filler ? (
                        <Badge size="sm" variant="warning">
                          {t('player.filler')}
                        </Badge>
                      ) : null}
                      {e.recap ? (
                        <Badge size="sm" variant="neutral">
                          {t('player.recap')}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
