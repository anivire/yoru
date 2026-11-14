import { LIST_STATUSES, type ListEntry, type ListStatus } from '@yoru/shared'
import { Button, Popover, PopoverContent, PopoverTrigger, Select, cn } from '@yoru/ui'
import { Bookmark, BookmarkCheck, Check, ChevronDown, Minus, Plus, Star, Trash2 } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDeleteEntry, useSaveEntry } from '../lib/queries'

function Stepper({ value, onChange, min, max, label }: { value: ReactNode; onChange: (delta: number) => void; min?: boolean; max?: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="inline-flex h-8 items-center rounded-md bg-field">
        <button
          type="button"
          aria-label="-1"
          disabled={min}
          onClick={() => onChange(-1)}
          className="grid h-full w-8 cursor-pointer place-items-center rounded-l-md text-muted-foreground hover:bg-field-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <Minus className="size-3.5" />
        </button>
        <span className="min-w-14 px-1 text-center font-mono text-[13px]">{value}</span>
        <button
          type="button"
          aria-label="+1"
          disabled={max}
          onClick={() => onChange(1)}
          className="grid h-full w-8 cursor-pointer place-items-center rounded-r-md text-muted-foreground hover:bg-field-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

export function ListButton({ malId, entry, total, aired }: { malId: number; entry: ListEntry | null; total: number | null; aired: number | null }) {
  const { t } = useTranslation()
  const save = useSaveEntry(malId)
  const remove = useDeleteEntry(malId)
  const [confirm, setConfirm] = useState(false)
  const limit = aired ?? total

  const setStatus = (status: ListStatus) => save.mutate({ status })
  const setProgress = (value: number) => {
    if (!entry) return
    const progress = Math.max(0, limit !== null ? Math.min(limit, value) : value)
    if (progress === entry.progress) return
    save.mutate({ status: entry.status === 'planning' && progress > 0 ? 'watching' : entry.status, progress })
  }

  return (
    <Popover onOpenChange={(open) => !open && setConfirm(false)}>
      <PopoverTrigger asChild>
        <Button variant="accent" size="sm" className="w-full" loading={save.isPending}>
          {entry ? <BookmarkCheck /> : <Bookmark />}
          <span className="flex-1 truncate text-left">{entry ? t(`status.${entry.status}`) : t('anime.add')}</span>
          <ChevronDown className="opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1.5">
        <div className="px-3 pb-1 pt-2 text-xs font-medium text-subtle-foreground">{t('anime.status')}</div>
        {LIST_STATUSES.map((status) => {
          const active = entry?.status === status
          return (
            <button
              key={status}
              type="button"
              onClick={() => setStatus(status)}
              className={cn(
                'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors',
                active ? 'bg-accent-soft text-accent' : 'hover:bg-muted',
              )}
            >
              <Check className={cn('size-4', !active && 'invisible')} />
              {t(`status.${status}`)}
            </button>
          )
        })}
        {entry ? (
          <>
            <div className="mt-1.5 flex flex-col gap-2.5 rounded-md bg-inset px-3 py-3">
              <Stepper
                label={t('anime.progress')}
                value={`${entry.progress}/${total ?? '?'}`}
                min={entry.progress <= 0}
                max={limit !== null && entry.progress >= limit}
                onChange={(d) => setProgress(entry.progress + d)}
              />
              <Stepper
                label={t('anime.rewatchesShort')}
                value={entry.rewatches}
                min={entry.rewatches <= 0}
                onChange={(d) => save.mutate({ status: entry.status, rewatches: Math.max(0, entry.rewatches + d) })}
              />
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">{t('anime.score')}</span>
                <Select
                  size="sm"
                  className="w-[7.5rem]"
                  value={entry.score ? String(Math.round(entry.score)) : '0'}
                  onValueChange={(v) => save.mutate({ status: entry.status, score: Number(v) || null })}
                  icon={<Star className={entry.score ? 'fill-warning text-warning' : ''} />}
                  options={[{ value: '0', label: t('anime.noScore') }, ...Array.from({ length: 10 }, (_, i) => ({ value: String(10 - i), label: String(10 - i) }))]}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => (confirm ? remove.mutate() : setConfirm(true))}
              disabled={remove.isPending}
              className="mt-1.5 flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-danger transition-colors hover:bg-danger-soft"
            >
              <Trash2 className="size-4" />
              {confirm ? t('anime.removeConfirm') : t('anime.remove')}
            </button>
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
