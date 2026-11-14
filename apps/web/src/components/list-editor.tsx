import { LIST_STATUSES, type ListEntry, type ListStatus } from '@yoru/shared'
import { Button, Popover, PopoverClose, PopoverContent, PopoverTrigger, Select, Tooltip } from '@yoru/ui'
import { EpisodeCount } from './anime-cards'
import { RiAddFill, RiArrowDownSFill, RiBookmark3Fill, RiDeleteBin6Fill, RiEdit2Fill, RiRepeatFill, RiStarFill, RiSubtractFill } from '@remixicon/react'
import { useTranslation } from 'react-i18next'
import { useDeleteEntry, useSaveEntry } from '../lib/queries'

function DateField({ label, value, onChange }: { label: string; value: string | null; onChange: (value: string | null) => void }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type="date"
        value={value?.slice(0, 10) ?? ''}
        max="9999-12-31"
        onChange={(e) => onChange(e.target.value || null)}
        className="h-9 w-full min-w-0 rounded-lg bg-field px-2.5 text-[0.8125rem] text-foreground transition-colors [color-scheme:inherit] hover:bg-field-hover focus-visible:bg-field-hover focus-visible:outline-none"
      />
    </label>
  )
}

function EntryControls({ malId, entry, total, aired }: { malId: number; entry: ListEntry; total: number | null; aired: number | null }) {
  const { t } = useTranslation()
  const save = useSaveEntry(malId)
  const remove = useDeleteEntry(malId)
  const limit = aired ?? total
  const setProgress = (value: number) => {
    const progress = Math.max(0, limit !== null ? Math.min(limit, value) : value)
    if (progress === entry.progress) return
    save.mutate({ status: entry.status === 'planning' && progress > 0 ? 'watching' : entry.status, progress })
  }

  return (
    <div className="flex flex-col gap-2">
      <Select
        className="w-full"
        value={entry.status}
        onValueChange={(v) => save.mutate({ status: v as ListStatus })}
        options={LIST_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))}
      />
      <div className="grid grid-cols-1 gap-2 min-[22rem]:grid-cols-3">
      <div className="flex h-9 items-center justify-between rounded-lg bg-field">
        <button type="button" aria-label="-1" onClick={() => setProgress(entry.progress - 1)} className="grid h-full w-8 cursor-pointer place-items-center rounded-l-lg text-muted-foreground hover:bg-field-hover hover:text-foreground">
          <RiSubtractFill className="size-3.5" />
        </button>
        <span className="min-w-16 px-1 text-center font-mono text-[0.8125rem]">
          <EpisodeCount current={entry.progress} total={total} />
        </span>
        <button
          type="button"
          aria-label="+1"
          disabled={limit !== null && entry.progress >= limit}
          onClick={() => setProgress(entry.progress + 1)}
          className="grid h-full w-8 cursor-pointer place-items-center rounded-r-lg text-muted-foreground hover:bg-field-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <RiAddFill className="size-3.5" />
        </button>
      </div>
      <Select
        className="w-full"
        value={entry.score ? String(Math.round(entry.score)) : '0'}
        onValueChange={(v) => save.mutate({ status: entry.status, score: Number(v) || null })}
        icon={<RiStarFill className={entry.score ? 'text-amber-500' : undefined} />}
        options={[{ value: '0', label: t('anime.noScore') }, ...Array.from({ length: 10 }, (_, i) => ({ value: String(10 - i), label: String(10 - i) }))]}
      />
      <Tooltip content={t('anime.rewatches')}>
        <div className="flex h-9 items-center justify-between rounded-lg bg-field">
          <button
            type="button"
            aria-label="-1"
            disabled={entry.rewatches <= 0}
            onClick={() => save.mutate({ status: entry.status, rewatches: entry.rewatches - 1 })}
            className="grid h-full w-8 cursor-pointer place-items-center rounded-l-lg text-muted-foreground hover:bg-field-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <RiSubtractFill className="size-3.5" />
          </button>
          <span className="inline-flex min-w-12 items-center justify-center gap-1.5 px-1 text-[0.8125rem]">
            <RiRepeatFill className="size-3.5 text-muted-foreground" />
            <span className="font-mono">{entry.rewatches}</span>
          </span>
          <button
            type="button"
            aria-label="+1"
            onClick={() => save.mutate({ status: entry.status, rewatches: entry.rewatches + 1 })}
            className="grid h-full w-8 cursor-pointer place-items-center rounded-r-lg text-muted-foreground hover:bg-field-hover hover:text-foreground"
          >
            <RiAddFill className="size-3.5" />
          </button>
        </div>
      </Tooltip>
      </div>
      <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
        <DateField label={t('anime.startedAt')} value={entry.startedAt} onChange={(v) => save.mutate({ status: entry.status, startedAt: v })} />
        <DateField label={t('anime.completedAt')} value={entry.completedAt} onChange={(v) => save.mutate({ status: entry.status, completedAt: v })} />
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="danger" size="icon" aria-label={t('common.remove')} title={t('common.remove')}>
            <RiDeleteBin6Fill />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="end">
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
    </div>
  )
}

function StatusChoice({ malId }: { malId: number }) {
  const { t } = useTranslation()
  const save = useSaveEntry(malId)
  return (
    <>
      <div className="px-3 pb-1 pt-2 text-xs font-medium text-subtle-foreground">{t('anime.chooseStatus')}</div>
      {LIST_STATUSES.map((status) => (
        <button
          key={status}
          type="button"
          onClick={() => save.mutate({ status })}
          className="flex w-full cursor-pointer items-center rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
        >
          {t(`status.${status}`)}
        </button>
      ))}
    </>
  )
}

export function ListEditorPanel({ malId, entry, total, aired }: { malId: number; entry: ListEntry | null; total: number | null; aired: number | null }) {
  return entry ? <EntryControls malId={malId} entry={entry} total={total} aired={aired} /> : <StatusChoice malId={malId} />
}

export const EDITOR_PANEL_CLASS = 'w-[min(28rem,calc(100vw-2rem))] p-3'
export const CHOICE_PANEL_CLASS = 'w-56 p-1.5'

export function ListEditor({
  malId,
  entry,
  total,
  aired,
  compact,
}: {
  malId: number
  entry: ListEntry | null
  total: number | null
  aired: number | null
  compact?: boolean
}) {
  const { t } = useTranslation()

  return (
    <Popover>
      <PopoverTrigger asChild>
        {compact ? (
          <Button variant="secondary" size="icon-sm" className="rounded-full" aria-label={t('anime.editEntry')}>
            <RiEdit2Fill />
          </Button>
        ) : (
        <Button variant="accent" size="sm" className="w-full">
          {entry ? <RiBookmark3Fill /> : <RiAddFill />}
          <span className="flex-1 truncate text-left">{entry ? t(`status.${entry.status}`) : t('anime.add')}</span>
          <RiArrowDownSFill className="-mr-1 size-5! opacity-70" />
        </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align={compact ? 'center' : 'start'} className={entry ? EDITOR_PANEL_CLASS : 'w-[var(--radix-popover-trigger-width)] min-w-56 p-1.5'}>
        <ListEditorPanel malId={malId} entry={entry} total={total} aired={aired} />
      </PopoverContent>
    </Popover>
  )
}
