import { LIST_STATUSES, type ListEntry, type ListStatus } from '@yoru/shared'
import { Button, Popover, PopoverClose, PopoverContent, PopoverTrigger, Select, Tooltip } from '@yoru/ui'
import { Minus, Plus, Repeat, Star, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useDeleteEntry, useSaveEntry } from '../lib/queries'

export function ListEditor({ malId, entry, total, aired }: { malId: number; entry: ListEntry | null; total: number | null; aired: number | null }) {
  const { t } = useTranslation()
  const save = useSaveEntry(malId)
  const remove = useDeleteEntry(malId)

  if (!entry) {
    return (
      <Button variant="accent" size="sm" className="w-full" loading={save.isPending} onClick={() => save.mutate({ status: 'planning' })}>
        <Plus />
        {t('anime.add')}
      </Button>
    )
  }

  const limit = aired ?? total
  const setProgress = (value: number) => {
    const progress = Math.max(0, limit !== null ? Math.min(limit, value) : value)
    if (progress === entry.progress) return
    save.mutate({ status: entry.status === 'planning' && progress > 0 ? 'watching' : entry.status, progress })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        className="w-44"
        value={entry.status}
        onValueChange={(v) => save.mutate({ status: v as ListStatus })}
        options={LIST_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))}
      />
      <div className="inline-flex h-9 items-center rounded-lg bg-field">
        <button type="button" aria-label="-1" onClick={() => setProgress(entry.progress - 1)} className="grid h-full w-8 cursor-pointer place-items-center rounded-l-lg text-muted-foreground hover:bg-field-hover hover:text-foreground">
          <Minus className="size-3.5" />
        </button>
        <span className="min-w-16 px-1 text-center font-mono text-[13px]">
          {entry.progress}/{total ?? '?'}
        </span>
        <button
          type="button"
          aria-label="+1"
          disabled={limit !== null && entry.progress >= limit}
          onClick={() => setProgress(entry.progress + 1)}
          className="grid h-full w-8 cursor-pointer place-items-center rounded-r-lg text-muted-foreground hover:bg-field-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      <Select
        className="w-28"
        value={entry.score ? String(Math.round(entry.score)) : '0'}
        onValueChange={(v) => save.mutate({ status: entry.status, score: Number(v) || null })}
        icon={<Star className={entry.score ? 'fill-warning text-warning' : ''} />}
        options={[{ value: '0', label: t('anime.noScore') }, ...Array.from({ length: 10 }, (_, i) => ({ value: String(10 - i), label: String(10 - i) }))]}
      />
      <Tooltip content={t('anime.rewatches')}>
        <div className="inline-flex h-9 items-center rounded-lg bg-field">
          <button
            type="button"
            aria-label="-1"
            disabled={entry.rewatches <= 0}
            onClick={() => save.mutate({ status: entry.status, rewatches: entry.rewatches - 1 })}
            className="grid h-full w-8 cursor-pointer place-items-center rounded-l-lg text-muted-foreground hover:bg-field-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <Minus className="size-3.5" />
          </button>
          <span className="inline-flex min-w-12 items-center justify-center gap-1.5 px-1 text-[13px]">
            <Repeat className="size-3.5 text-muted-foreground" />
            <span className="font-mono">{entry.rewatches}</span>
          </span>
          <button
            type="button"
            aria-label="+1"
            onClick={() => save.mutate({ status: entry.status, rewatches: entry.rewatches + 1 })}
            className="grid h-full w-8 cursor-pointer place-items-center rounded-r-lg text-muted-foreground hover:bg-field-hover hover:text-foreground"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      </Tooltip>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t('common.remove')}>
            <Trash2 />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start">
          <p className="text-sm">{t('anime.removeConfirm')}</p>
          <div className="mt-3 flex justify-end gap-2">
            <PopoverClose asChild>
              <Button size="sm" variant="ghost">
                {t('common.cancel')}
              </Button>
            </PopoverClose>
            <Button size="sm" variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>
              {t('common.remove')}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
