import { useQuery } from '@tanstack/react-query'
import type { AnimeDetails } from '@yoru/shared'
import { Popover, PopoverContent, PopoverTrigger, Spinner, cn } from '@yoru/ui'
import { RiEdit2Fill } from '@remixicon/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { keys } from '../lib/queries'
import { CHOICE_PANEL_CLASS, EDITOR_PANEL_CLASS, ListEditorPanel } from './list-editor'

export function airedLimit(anime: Pick<AnimeDetails, 'status' | 'episodes' | 'latestEpisode'>): number | null {
  if (anime.status === 'finished') return anime.episodes
  if (anime.status === 'upcoming') return 0
  return anime.latestEpisode
}

export function QuickEdit({ malId, className }: { malId: number; className?: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const page = useQuery({ queryKey: keys.anime(malId), queryFn: () => api.anime(malId), enabled: open })
  const entry = page.data?.entry ?? null
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('anime.editEntry')}
          title={t('anime.editEntry')}
          className={cn(
            'grid size-7 cursor-pointer place-items-center rounded-lg bg-white/20 text-white opacity-0 backdrop-blur-md transition-[opacity,background-color] hover:bg-white/35 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:bg-white/35 data-[state=open]:opacity-100 [@media(hover:none)]:bg-black/55 [@media(hover:none)]:opacity-100',
            className,
          )}
        >
          <RiEdit2Fill className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className={page.data && entry ? EDITOR_PANEL_CLASS : CHOICE_PANEL_CLASS}>
        {page.data ? (
          <ListEditorPanel malId={malId} entry={entry} total={page.data.anime.episodes} aired={airedLimit(page.data.anime)} />
        ) : (
          <div className="grid h-24 place-items-center">
            <Spinner />
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
