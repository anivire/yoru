import { Card, Segmented, Switch, cn } from '@yoru/ui'
import { DndContext, type DragEndEvent, KeyboardSensor, type Modifier, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { RiDraggable, RiImageFill, RiLayoutBottom2Fill, RiLayoutLeft2Fill, RiLayoutRight2Fill, RiLayoutTop2Fill, RiPaletteFill } from '@remixicon/react'
import type { ComponentType, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { type BackdropShape, FEED_SCOPES, type NavLabels, type NavPosition, useAppearance } from '../lib/appearance'
import { HOME_SECTIONS, NAV } from '../lib/navigation'

export const restrictToVertical: Modifier = ({ transform }) => ({ ...transform, x: 0 })

function IconTile({ children }: { children: ReactNode }) {
  return <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent [&_svg]:size-4">{children}</span>
}

function useReorderSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
}

function reorder<T>(items: T[], id: (item: T) => string, { active, over }: DragEndEvent) {
  if (!over || active.id === over.id) return null
  const from = items.findIndex((item) => id(item) === active.id)
  const to = items.findIndex((item) => id(item) === over.id)
  if (from < 0 || to < 0) return null
  return arrayMove(items, from, to)
}

function SortableRow({ id, icon: Icon, label, checked, disabled, onToggle }: { id: string; icon: ComponentType; label: ReactNode; checked: boolean; disabled?: boolean; onToggle: (checked: boolean) => void }) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('relative flex items-center gap-3 rounded-lg bg-surface py-2.5 pl-2 pr-5', isDragging && 'z-10 bg-raised shadow-lg shadow-black/30')}
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
      <IconTile>
        <Icon />
      </IconTile>
      <span className={cn('min-w-0 flex-1 truncate text-sm', !checked && 'text-muted-foreground')}>{label}</span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onToggle} />
    </div>
  )
}

export function HomeLayoutSettings() {
  const { t } = useTranslation()
  const { homeSections, setHomeSections, showHero, setShowHero } = useAppearance()
  const sensors = useReorderSensors()
  const onDragEnd = (event: DragEndEvent) => {
    const next = reorder(homeSections, (s) => s.id, event)
    if (next) setHomeSections(next)
  }
  return (
    <Card className="py-1">
      <label className="flex cursor-pointer items-center gap-3 py-2.5 pl-2 pr-5">
        <span className="size-8 shrink-0" aria-hidden />
        <IconTile>
          <RiImageFill />
        </IconTile>
        <span className="min-w-0 flex-1">
          <span className="block text-sm">{t('settings.heroBanner')}</span>
          <span className="block text-[0.8125rem] text-muted-foreground">{t('settings.heroBannerHint')}</span>
        </span>
        <Switch checked={showHero} onCheckedChange={setShowHero} />
      </label>
      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVertical]} onDragEnd={onDragEnd}>
        <SortableContext items={homeSections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {homeSections.map((section) => {
            const meta = HOME_SECTIONS.find((s) => s.id === section.id)!
            return (
              <SortableRow
                key={section.id}
                id={section.id}
                icon={meta.icon}
                label={t(meta.label)}
                checked={section.visible}
                onToggle={(visible) => setHomeSections(homeSections.map((s) => (s.id === section.id ? { ...s, visible } : s)))}
              />
            )
          })}
        </SortableContext>
      </DndContext>
    </Card>
  )
}

const NAV_POSITIONS = [
  { value: 'left', icon: RiLayoutLeft2Fill },
  { value: 'top', icon: RiLayoutTop2Fill },
  { value: 'bottom', icon: RiLayoutBottom2Fill },
  { value: 'right', icon: RiLayoutRight2Fill },
] as const satisfies { value: NavPosition; icon: unknown }[]

const NAV_LABELS = ['always', 'hover', 'off'] as const satisfies NavLabels[]

export function NavPositionSettings() {
  const { t } = useTranslation()
  const { navPosition, setNavPosition, navLabels, setNavLabels } = useAppearance()
  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label={t('settings.navPosition.title')} className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4">
        {NAV_POSITIONS.map(({ value, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={navPosition === value}
            onClick={() => setNavPosition(value)}
            className={cn(
              'flex cursor-pointer flex-col items-center gap-2 rounded-xl px-3 py-4 text-sm font-medium transition-colors',
              navPosition === value ? 'bg-accent-soft text-accent' : 'bg-surface text-foreground hover:bg-field',
            )}
          >
            <Icon className="size-6" />
            {t(`settings.navPosition.${value}`)}
          </button>
        ))}
      </div>
      {navPosition === 'left' || navPosition === 'right' ? (
        <div className="hidden flex-wrap items-center justify-between gap-x-4 gap-y-2 md:flex">
          <span className="text-sm">{t('settings.navLabels.title')}</span>
          <Segmented
            size="sm"
            value={navLabels}
            onChange={setNavLabels}
            options={NAV_LABELS.map((value) => ({ value, label: t(`settings.navLabels.${value}`) }))}
          />
        </div>
      ) : null}
    </div>
  )
}

export function NavigationSettings() {
  const { t } = useTranslation()
  const { hiddenNav, setHiddenNav, navOrder, setNavOrder, appearanceButton, setAppearanceButton } = useAppearance()
  const sensors = useReorderSensors()
  const visibleCount = NAV.length - hiddenNav.length
  const onDragEnd = (event: DragEndEvent) => {
    const next = reorder(navOrder, (key) => key, event)
    if (next) setNavOrder(next)
  }
  return (
    <Card className="py-1">
      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVertical]} onDragEnd={onDragEnd}>
        <SortableContext items={navOrder} strategy={verticalListSortingStrategy}>
          {navOrder.map((key) => {
            const item = NAV.find((n) => n.key === key)!
            const visible = !hiddenNav.includes(key)
            return (
              <SortableRow
                key={key}
                id={key}
                icon={item.icon}
                label={t(`nav.${key}`)}
                checked={visible}
                disabled={visible && visibleCount <= 1}
                onToggle={(on) => setHiddenNav(on ? hiddenNav.filter((k) => k !== key) : [...hiddenNav, key])}
              />
            )
          })}
        </SortableContext>
      </DndContext>
      <label className="hidden cursor-pointer items-center gap-3 py-2.5 pl-2 pr-5 md:flex">
        <span className="size-8 shrink-0" aria-hidden />
        <IconTile>
          <RiPaletteFill />
        </IconTile>
        <span className={cn('min-w-0 flex-1 text-sm', !appearanceButton && 'text-muted-foreground')}>{t('settings.appearance')}</span>
        <Switch checked={appearanceButton} onCheckedChange={setAppearanceButton} />
      </label>
    </Card>
  )
}

const BACKDROPS = ['full', 'glow'] as const satisfies BackdropShape[]

export function FeedScopePicker() {
  const { t } = useTranslation()
  const { feedScope, setFeedScope } = useAppearance()
  return <Segmented size="sm" value={feedScope} onChange={setFeedScope} options={FEED_SCOPES.map((value) => ({ value, label: t(`feed.scopes.${value}`) }))} />
}

export function BackdropPicker() {
  const { t } = useTranslation()
  const { backdrop, setBackdrop } = useAppearance()
  return <Segmented size="sm" value={backdrop} onChange={setBackdrop} options={BACKDROPS.map((value) => ({ value, label: t(`settings.backdrop.${value}`) }))} />
}
