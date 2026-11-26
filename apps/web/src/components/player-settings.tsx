import { STREAM_KINDS } from '@yoru/shared'
import { Button, Card, Input, Segmented, Switch, cn } from '@yoru/ui'
import { DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { RiAddFill, RiCloseFill, RiDraggable } from '@remixicon/react'
import { type FormEvent, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { WATCHED_THRESHOLDS, useAppearance } from '../lib/appearance'
import { IS_IOS } from '../lib/device'
import { type FavoriteGroup, rememberedAuthors } from '../lib/favorite-authors'
import { Block } from './settings-block'
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
  const { defaultKind, setDefaultKind, preferredAuthors, setPreferredAuthors, iosFullscreen, setIosFullscreen, skipButton, setSkipButton, autoNext, setAutoNext, watchedAt, setWatchedAt } = useAppearance()
  const [draft, setDraft] = useState('')
  const [picked, setPicked] = useState<FavoriteGroup>(defaultKind)
  const groups: FavoriteGroup[] = preferredAuthors.any?.length ? [...STREAM_KINDS, 'any'] : [...STREAM_KINDS]
  const group = groups.includes(picked) ? picked : defaultKind
  const authors = preferredAuthors[group] ?? []
  const setAuthors = (next: string[]) => setPreferredAuthors({ ...preferredAuthors, [group]: next })
  const suggestions = useMemo(() => (group === 'any' ? [] : rememberedAuthors(group, authors)), [group, authors])

  const addAuthor = (value: string) => {
    if (!value || authors.some((a) => a.toLowerCase() === value.toLowerCase())) return
    setAuthors([...authors, value])
  }
  const add = (e: FormEvent) => {
    e.preventDefault()
    addAuthor(draft.trim())
    setDraft('')
  }
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = authors.indexOf(String(active.id))
    const to = authors.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    setAuthors(arrayMove(authors, from, to))
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
          <Segmented
            size="sm"
            value={group}
            onChange={setPicked}
            className="self-start"
            options={groups.map((g) => {
              const Icon = g === 'any' ? null : KIND_ICONS[g]
              return {
                value: g,
                label: t(g === 'any' ? 'settings.playerPrefs.any' : `player.${g}`),
                icon: Icon ? <Icon /> : undefined,
                count: preferredAuthors[g]?.length || undefined,
              }
            })}
          />
          {group === 'any' ? <p className="text-[0.8125rem] text-muted-foreground">{t('settings.playerPrefs.anyHint')}</p> : null}
          {authors.length ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVertical]} onDragEnd={onDragEnd}>
              <SortableContext items={authors} strategy={verticalListSortingStrategy}>
                <ol className="flex flex-col gap-1">
                  {authors.map((author, i) => (
                    <SortableAuthor key={author} author={author} index={i} onRemove={() => setAuthors(authors.filter((a) => a !== author))} />
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
          {suggestions.length ? (
            <div className="flex flex-col gap-2">
              <span className="text-[0.8125rem] text-muted-foreground">{t('settings.playerPrefs.suggestions')}</span>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map(([author, count]) => (
                  <button
                    key={author}
                    type="button"
                    onClick={() => addAuthor(author)}
                    title={t('settings.playerPrefs.pickedIn', { count })}
                    className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full bg-field pl-2 pr-3 text-[0.8125rem] font-medium transition-colors hover:bg-field-hover [&_svg]:size-3.5 [&_svg]:text-accent"
                  >
                    <RiAddFill />
                    {author}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </Card>
      </Block>
      <Block title={t('settings.playerPrefs.playback')}>
        <Card className="py-1">
          <label className="flex cursor-pointer items-center justify-between gap-4 px-5 py-3">
            <span>
              <span className="block text-sm">{t('settings.playerPrefs.autoNext')}</span>
              <span className="block text-[0.8125rem] text-muted-foreground">{t('settings.playerPrefs.autoNextHint')}</span>
            </span>
            <Switch checked={autoNext} onCheckedChange={setAutoNext} />
          </label>
          <div className="flex flex-col gap-3 px-5 py-3">
            <span>
              <span className="block text-sm">{t('settings.playerPrefs.watchedAt')}</span>
              <span className="block text-[0.8125rem] text-muted-foreground">{t('settings.playerPrefs.watchedAtHint')}</span>
            </span>
            <Segmented
              size="sm"
              className="self-start"
              value={String(watchedAt)}
              onChange={(v) => setWatchedAt(Number(v))}
              options={WATCHED_THRESHOLDS.map((ratio) => ({
                value: String(ratio),
                label: ratio === 1 ? t('settings.playerPrefs.watchedAtEnd') : `${Math.round(ratio * 100)}%`,
              }))}
            />
          </div>
          <div className="flex flex-col gap-3 px-5 py-3">
            <span>
              <span className="block text-sm">{t('settings.playerPrefs.skipButton')}</span>
              <span className="block text-[0.8125rem] text-muted-foreground">{t('settings.playerPrefs.skipButtonHint')}</span>
            </span>
            <Segmented
              size="sm"
              className="self-start"
              value={skipButton}
              onChange={setSkipButton}
              options={[
                { value: 'brief', label: t('settings.playerPrefs.skipButtonBrief') },
                { value: 'auto', label: t('settings.playerPrefs.skipButtonAuto') },
              ]}
            />
          </div>
          {IS_IOS ? (
            <div className="flex flex-col gap-3 px-5 py-3">
              <span>
                <span className="block text-sm">{t('settings.playerPrefs.iosFullscreen')}</span>
                <span className="block text-[0.8125rem] text-muted-foreground">{t('settings.playerPrefs.iosFullscreenHint')}</span>
              </span>
              <Segmented
                size="sm"
                className="self-start"
                value={iosFullscreen}
                onChange={setIosFullscreen}
                options={[
                  { value: 'app', label: t('settings.playerPrefs.iosFullscreenApp') },
                  { value: 'native', label: t('settings.playerPrefs.iosFullscreenNative') },
                ]}
              />
            </div>
          ) : null}
        </Card>
      </Block>
    </>
  )
}
