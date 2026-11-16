import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DATA_SOURCES, type DataSourceId, PROVIDER_CATEGORIES, type ProviderCategory, type ProviderEntryInfo, type ProvidersSettings } from '@yoru/shared'
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton, Switch, cn, toast } from '@yoru/ui'
import { DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { RiDraggable, RiPuzzle2Fill } from '@remixicon/react'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { errorMessage, optimistic } from '../lib/queries'
import { SourceIcon } from './admin-sources'
import { restrictToVertical } from './layout-settings'

const PROVIDERS_KEY = ['admin', 'providers']

function ProviderIcon({ entry }: { entry: ProviderEntryInfo }) {
  if (DATA_SOURCES.includes(entry.id as DataSourceId)) return <SourceIcon id={entry.id as DataSourceId} />
  if (entry.id === 'anilibria') return <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#b32121] text-sm font-extrabold text-white">A</span>
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent [&_svg]:size-[1.125rem]">
      <RiPuzzle2Fill />
    </span>
  )
}

function ProviderRow({ entry, onToggle }: { entry: ProviderEntryInfo; onToggle: (enabled: boolean) => void }) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('relative flex items-center gap-3 rounded-lg bg-surface py-2 pl-1 pr-1', isDragging && 'z-10 bg-raised shadow-lg shadow-black/30')}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={t('settings.dragToReorder')}
        className="grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-md text-subtle-foreground hover:bg-field hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <RiDraggable className="size-4" />
      </button>
      <ProviderIcon entry={entry} />
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-sm font-medium', !entry.enabled && 'text-muted-foreground')}>{entry.name}</span>
        <span className="mt-0.5 flex flex-wrap gap-1">
          <Badge size="sm" variant={entry.builtin ? 'neutral' : 'accent'}>
            {entry.builtin ? t('admin.providers.builtin') : t('admin.providers.extension')}
          </Badge>
          {entry.available ? null : (
            <Badge size="sm" variant="warning">
              {t('admin.providers.sourceOff')}
            </Badge>
          )}
        </span>
      </span>
      <Switch checked={entry.enabled} onCheckedChange={onToggle} />
    </div>
  )
}

function ProviderChain({ category, entries }: { category: ProviderCategory; entries: ProviderEntryInfo[] }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const save = useMutation({
    mutationKey: [...PROVIDERS_KEY, category],
    scope: { id: `providers-${category}` },
    meta: optimistic,
    mutationFn: (next: ProviderEntryInfo[]) => api.admin.saveProviders(category, next.map(({ id, enabled }) => ({ id, enabled }))),
    onMutate: (next) => {
      void client.cancelQueries({ queryKey: PROVIDERS_KEY })
      client.setQueryData<ProvidersSettings>(PROVIDERS_KEY, (prev) => (prev ? { ...prev, [category]: next } : prev))
    },
    onError: (e) => {
      toast.error(errorMessage(e, t))
      void client.invalidateQueries({ queryKey: PROVIDERS_KEY })
    },
    onSettled: () => {
      if (client.isMutating({ mutationKey: [...PROVIDERS_KEY, category] }) > 1) return
      void client.invalidateQueries({ queryKey: PROVIDERS_KEY })
      void client.invalidateQueries({ queryKey: ['video-providers'] })
      void client.invalidateQueries({ queryKey: ['me'] })
    },
  })
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = entries.findIndex((e) => e.id === active.id)
    const to = entries.findIndex((e) => e.id === over.id)
    if (from < 0 || to < 0) return
    save.mutate(arrayMove(entries, from, to))
  }
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <div>
        <h3 className="text-[0.9375rem] font-semibold tracking-tight">{t(`admin.providers.${category}.title`)}</h3>
        <p className="text-[0.8125rem] text-muted-foreground">{t(`admin.providers.${category}.hint`)}</p>
      </div>
      <div className="flex flex-col gap-1 rounded-xl bg-inset p-1">
        <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVertical]} onDragEnd={onDragEnd}>
          <SortableContext items={entries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
            {entries.map((entry) => (
              <ProviderRow key={entry.id} entry={entry} onToggle={(enabled) => save.mutate(entries.map((e) => (e.id === entry.id ? { ...e, enabled } : e)))} />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </section>
  )
}

export function Providers() {
  const { t } = useTranslation()
  const providers = useQuery({ queryKey: PROVIDERS_KEY, queryFn: api.admin.providers })
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t('admin.tabs.providers')}</CardTitle>
          <CardDescription>{t('admin.providers.hint')}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-3">
        {PROVIDER_CATEGORIES.map((category) =>
          providers.data ? (
            <ProviderChain key={category} category={category} entries={providers.data[category]} />
          ) : (
            <div key={category} className="flex flex-col gap-2">
              <Skeleton className="h-5 w-28 rounded-md" />
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-40 rounded-xl" />
            </div>
          ),
        )}
      </CardContent>
    </Card>
  )
}
