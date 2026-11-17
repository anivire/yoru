import { useQuery } from '@tanstack/react-query'
import type { AnimeSummary } from '@yoru/shared'
import { HoverCard, HoverCardContent, HoverCardTrigger, Image } from '@yoru/ui'
import { type ReactNode, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { seasonLabel, typeLabel } from '../lib/format'
import { keys } from '../lib/queries'
import { Score } from './anime-cards'
import { TextLine } from './skeletons'
import { useAnimeTitle } from '../lib/anime-title'

const DESKTOP_HOVER = '(hover: hover) and (pointer: fine) and (min-width: 64rem)'

function useDesktopHover() {
  return useSyncExternalStore(
    (notify) => {
      const media = window.matchMedia(DESKTOP_HOVER)
      media.addEventListener('change', notify)
      return () => media.removeEventListener('change', notify)
    },
    () => window.matchMedia(DESKTOP_HOVER).matches,
  )
}

export function AnimeHoverCard(props: { anime: AnimeSummary; footer?: ReactNode; children: ReactNode }) {
  const desktop = useDesktopHover()
  return desktop ? <HoverPreview {...props} /> : <>{props.children}</>
}

function HoverPreview({ anime, footer, children }: { anime: AnimeSummary; footer?: ReactNode; children: ReactNode }) {
  const title = useAnimeTitle()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const details = useQuery({ queryKey: keys.anime(anime.malId), queryFn: () => api.anime(anime.malId), enabled: open, staleTime: 10 * 60_000 })
  const data = details.data?.anime
  const genres = (data?.genres.length ? data.genres : anime.genres).slice(0, 4)
  const meta = [typeLabel(anime.type), seasonLabel(anime), anime.episodes ? `${anime.episodes} ${t('common.episodes')}` : null].filter(Boolean)
  const main = title(anime)
  const secondary = [anime.title, data?.titleEnglish].find((v) => v && v !== main) ?? null
  return (
    <HoverCard openDelay={350} closeDelay={120} open={open} onOpenChange={setOpen}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side="right" className="w-80 p-3">
        <div className="flex gap-3">
          <div className="aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
            {anime.imageUrl ? <Image src={anime.imageUrl} alt="" fallback className="h-full w-full object-cover" /> : null}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="line-clamp-2 text-sm font-semibold leading-snug">{title(anime)}</div>
            {secondary ? <div className="truncate text-xs text-muted-foreground">{secondary}</div> : null}
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {anime.score ? <Score value={anime.score} surface="theme" className="h-5 px-1.5" /> : null}
              {meta.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
            {genres.length ? (
              <div className="flex flex-wrap gap-1">
                {genres.map((g) => (
                  <span key={g} className="inline-flex h-5 items-center rounded-full bg-field px-2 text-[0.6875rem] font-medium text-muted-foreground">
                    {g}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        {data?.synopsis ? (
          <p className="mt-3 line-clamp-4 text-xs leading-relaxed text-muted-foreground">{data.synopsis}</p>
        ) : details.isFetching ? (
          <div className="mt-3 text-xs leading-relaxed">
            <TextLine />
            <TextLine />
            <TextLine bar="w-2/3" />
          </div>
        ) : null}
        {footer ? <div className="mt-3">{footer}</div> : null}
      </HoverCardContent>
    </HoverCard>
  )
}
