import { Button, Input, Select, Tooltip } from '@yoru/ui'
import { RiCalendar2Fill, RiCloseFill, RiSearchFill, RiSortAsc, RiSortDesc, RiTvFill } from '@remixicon/react'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { typeLabel } from '../lib/format'

const ANY = '__any'
const SORTS = ['score', 'updated', 'title', 'progress', 'year', 'added'] as const

export function useListParams() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? 'all'
  const filters = {
    status: status === 'all' ? undefined : status,
    q: params.get('q') ?? undefined,
    type: params.get('type') ?? undefined,
    year: params.get('year') ?? undefined,
    sort: params.get('sort') ?? 'score',
    order: params.get('order') ?? undefined,
  }
  const set = (key: string, value: string | undefined, reset: string[] = []) => {
    const next = new URLSearchParams(params)
    if (!value || value === ANY || value === 'all') next.delete(key)
    else next.set(key, value)
    for (const k of reset) next.delete(k)
    setParams(next, { replace: true })
  }
  return { status, filters, set }
}

type ListParams = ReturnType<typeof useListParams>

export function ListFilterBar({
  filters,
  set,
  years,
  types,
  children,
}: {
  filters: ListParams['filters']
  set: ListParams['set']
  years: number[]
  types: string[]
  children?: ReactNode
}) {
  const { t } = useTranslation()
  const [resetKey, setResetKey] = useState(0)
  const natural = filters.sort === 'title' ? 'asc' : 'desc'
  const order = filters.order ?? natural
  const SortIcon = order === 'asc' ? RiSortAsc : RiSortDesc
  return (
    <>
      <div className="relative mt-3">
        <RiSearchFill className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
        <Input key={resetKey} defaultValue={filters.q} onChange={(e) => set('q', e.target.value)} placeholder={t('lists.filter')} className="h-11 rounded-xl pl-10 text-[0.9375rem]" />
        {filters.q ? (
          <button
            type="button"
            onClick={() => {
              set('q', undefined)
              setResetKey((k) => k + 1)
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1 text-subtle-foreground hover:text-foreground"
          >
            <RiCloseFill className="size-4" />
          </button>
        ) : null}
      </div>
      <div className="mb-6 mt-3 flex flex-wrap items-center gap-3">
        <Select
          className="h-11 w-44 rounded-xl px-3.5"
          icon={<RiTvFill />}
          value={filters.type ?? ANY}
          onValueChange={(v) => set('type', v)}
          options={[{ value: ANY, label: `${t('search.type')}: ${t('common.any')}` }, ...types.map((v) => ({ value: v, label: typeLabel(v) }))]}
        />
        <Select
          className="h-11 w-40 rounded-xl px-3.5"
          icon={<RiCalendar2Fill />}
          value={filters.year ?? ANY}
          onValueChange={(v) => set('year', v)}
          options={[{ value: ANY, label: `${t('lists.year')}: ${t('common.any')}` }, ...years.map((y) => ({ value: String(y), label: String(y) }))]}
        />
        <Select
          className="h-11 min-w-48 max-w-72 flex-1 basis-0 rounded-xl px-3.5"
          icon={<SortIcon />}
          value={filters.sort}
          onValueChange={(v) => set('sort', v === 'score' ? undefined : v, ['order'])}
          prefix={t('lists.sortBy')}
          options={SORTS.map((s) => ({ value: s, label: t(`order.${s}`) }))}
        />
        <Tooltip content={t(order === 'asc' ? 'lists.ascending' : 'lists.descending')}>
          <Button
            variant="secondary"
            size="icon"
            aria-label={t(order === 'asc' ? 'lists.ascending' : 'lists.descending')}
            className="-ml-1 size-11 rounded-xl [&_svg]:size-4.5"
            onClick={() => {
              const next = order === 'asc' ? 'desc' : 'asc'
              set('order', next === natural ? undefined : next)
            }}
          >
            <SortIcon />
          </Button>
        </Tooltip>
        {children}
      </div>
    </>
  )
}
