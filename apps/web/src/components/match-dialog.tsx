import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ProviderMatch } from '@yoru/shared'
import { Badge, Button, Dialog, DialogContent, DialogTrigger, Image, Input, Spinner, cn } from '@yoru/ui'
import { RiLinksFill, RiSearchFill } from '@remixicon/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { keys } from '../lib/queries'

export function MatchDialog({ malId, match, defaultQuery }: { malId: number; match: ProviderMatch | undefined; defaultQuery: string }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(defaultQuery)
  const [debounced, setDebounced] = useState(defaultQuery)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 350)
    return () => clearTimeout(id)
  }, [query])
  const results = useQuery({ queryKey: ['match-search', debounced], queryFn: () => api.matchSearch(debounced), enabled: open && debounced.length >= 2 })
  const set = useMutation({
    mutationFn: (providerId: number | null) => api.setMatch(malId, providerId),
    onSuccess: (data) => {
      client.setQueryData(keys.match(malId), data)
      void client.invalidateQueries({ queryKey: keys.episodes(malId) })
      void client.invalidateQueries({ queryKey: ['translations', malId] })
      setOpen(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <RiLinksFill />
          {t('player.manualMatch')}
        </Button>
      </DialogTrigger>
      <DialogContent title={t('player.matchTitle')} description={t('player.matchHint')} className="w-[min(92vw,36rem)]">
        <div className="flex flex-col gap-3 p-4">
          {match?.providerId ? <div className="text-[13px] text-muted-foreground">{t('player.matched', { title: match.title })}</div> : null}
          <div className="relative">
            <RiSearchFill className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('player.matchSearch')} className="pl-9" autoFocus />
          </div>
          <div className="flex min-h-40 flex-col gap-1">
            {results.isFetching ? (
              <div className="grid h-40 place-items-center">
                <Spinner />
              </div>
            ) : (
              results.data?.map((c) => (
                <button
                  key={c.providerId}
                  type="button"
                  onClick={() => set.mutate(c.providerId)}
                  className={cn('flex cursor-pointer items-center gap-3 rounded-lg p-2 text-left hover:bg-muted', match?.providerId === c.providerId && 'bg-accent-soft')}
                >
                  {c.posterUrl ? <Image src={c.posterUrl} alt="" className="h-14 w-10 shrink-0 rounded object-cover" loading="lazy" /> : null}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{c.title}</div>
                    <div className="text-xs text-muted-foreground">{[c.type, c.year, c.episodes ? `${c.episodes} ${t('common.episodes')}` : null].filter(Boolean).join(' · ')}</div>
                  </div>
                  {c.malId === malId ? (
                    <Badge size="sm" variant="success">
                      MAL
                    </Badge>
                  ) : null}
                </button>
              ))
            )}
          </div>
          {match?.manual ? (
            <Button variant="secondary" onClick={() => set.mutate(null)} loading={set.isPending} className="self-start">
              {t('player.matchAuto')}
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
