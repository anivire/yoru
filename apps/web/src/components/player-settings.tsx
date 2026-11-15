import { STREAM_KINDS } from '@yoru/shared'
import { Button, Card, Input, cn } from '@yoru/ui'
import { DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { RiCloseFill, RiDraggable } from '@remixicon/react'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppearance } from '../lib/appearance'
import { Block } from '../pages/settings'
import { restrictToVertical } from './layout-settings'
import { KIND_ICONS } from './watch-section'

function SortableAuthor({ author, index, onRemove }: { author: string; index: number; onRemove: () => void }) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: author })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('relative flex items-center gap-2 rounded-lg bg-field py-1 pl-1 pr-1 text-sm', isDragging && 'z-10 bg-raised shadow-lg shadow-black/30')}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={t('settings.dragToReorder')}
        className="grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-md text-subtle-foreground hover:bg-field-hover hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <RiDraggable className="size-4" />
      </button>
      <span className="w-4 shrink-0 text-xs tabular-nums text-subtle-foreground">{index + 1}</span>
      <span className="min-w-0 flex-1 truncate font-medium">{author}</span>
      <Button size="icon-sm" variant="ghost" aria-label={t('settings.playerPrefs.remove')} title={t('settings.playerPrefs.remove')} onClick={onRemove}>
        <RiCloseFill />
      </Button>
    </li>
  )
}

export function PlayerTab() {
  const { t } = useTranslation()
  const { defaultKind, setDefaultKind, preferredAuthors, setPreferredAuthors } = useAppearance()
  const [draft, setDraft] = useState('')

  const add = (e: FormEvent) => {
    e.preventDefault()
    const value = draft.trim()
    setDraft('')
    if (!value || preferredAuthors.some((a) => a.toLowerCase() === value.toLowerCase())) return
    setPreferredAuthors([...preferredAuthors, value])
  }
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = preferredAuthors.indexOf(String(active.id))
    const to = preferredAuthors.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    setPreferredAuthors(arrayMove(preferredAuthors, from, to))
  }

  return (
    <>
      <Block title={t('settings.playerPrefs.kind')} description={t('settings.playerPrefs.kindHint')}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {STREAM_KINDS.map((kind) => {
            const Icon = KIND_ICONS[kind]
            const active = kind === defaultKind
            return (
              <button
                key={kind}
                type="button"
                onClick={() => setDefaultKind(kind)}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors',
                  active ? 'bg-accent-soft text-accent' : 'bg-surface text-foreground hover:bg-field-hover',
                )}
              >
                <Icon className="size-4 shrink-0" />
                {t(`player.${kind}`)}
              </button>
            )
          })}
        </div>
      </Block>
      <Block title={t('settings.playerPrefs.authors')} description={t('settings.playerPrefs.authorsHint')}>
        <Card className="flex flex-col gap-3 p-4">
          {preferredAuthors.length ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVertical]} onDragEnd={onDragEnd}>
              <SortableContext items={preferredAuthors} strategy={verticalListSortingStrategy}>
                <ol className="flex flex-col gap-1">
                  {preferredAuthors.map((author, i) => (
                    <SortableAuthor key={author} author={author} index={i} onRemove={() => setPreferredAuthors(preferredAuthors.filter((a) => a !== author))} />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
          ) : (
            <p className="text-sm text-muted-foreground">{t('settings.playerPrefs.authorsEmpty')}</p>
          )}
          <form onSubmit={add} className="flex gap-2">
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t('settings.playerPrefs.placeholder')} className="h-8" />
            <Button type="submit" size="sm" variant="secondary" disabled={!draft.trim()}>
              {t('settings.playerPrefs.add')}
            </Button>
          </form>
        </Card>
      </Block>
    </>
  )
}
