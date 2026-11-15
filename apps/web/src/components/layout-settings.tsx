import { Card, Switch, cn } from '@yoru/ui'
import { DndContext, type DragEndEvent, KeyboardSensor, type Modifier, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { RiDraggable, RiImageFill, RiLayoutBottom2Fill, RiLayoutLeft2Fill, RiLayoutRight2Fill, RiLayoutTop2Fill, RiPaletteFill } from '@remixicon/react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { type HomeSectionSetting, type NavPosition, useAppearance } from '../lib/appearance'
import { HOME_SECTIONS, NAV } from '../lib/navigation'

export const restrictToVertical: Modifier = ({ transform }) => ({ ...transform, x: 0 })

function IconTile({ children }: { children: ReactNode }) {
  return <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent [&_svg]:size-4">{children}</span>
}

function SortableSection({ section, onToggle }: { section: HomeSectionSetting; onToggle: (visible: boolean) => void }) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: section.id })
  const meta = HOME_SECTIONS.find((s) => s.id === section.id)!
  const Icon = meta.icon
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
      <span className={cn('min-w-0 flex-1 truncate text-sm', !section.visible && 'text-muted-foreground')}>{t(meta.label)}</span>
      <Switch checked={section.visible} onCheckedChange={onToggle} />
    </div>
  )
}

export function HomeLayoutSettings() {
  const { t } = useTranslation()
  const { homeSections, setHomeSections, showHero, setShowHero } = useAppearance()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = homeSections.findIndex((s) => s.id === active.id)
    const to = homeSections.findIndex((s) => s.id === over.id)
    if (from < 0 || to < 0) return
    setHomeSections(arrayMove(homeSections, from, to))
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
          {homeSections.map((section) => (
            <SortableSection
              key={section.id}
              section={section}
              onToggle={(visible) => setHomeSections(homeSections.map((s) => (s.id === section.id ? { ...s, visible } : s)))}
            />
          ))}
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

export function NavPositionSettings() {
  const { t } = useTranslation()
  const { navPosition, setNavPosition } = useAppearance()
  return (
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
  )
}

export function NavigationSettings() {
  const { t } = useTranslation()
  const { hiddenNav, setHiddenNav, appearanceButton, setAppearanceButton } = useAppearance()
  const visibleCount = NAV.length - hiddenNav.length
  return (
    <Card className="py-1">
      {NAV.map((item) => {
        const visible = !hiddenNav.includes(item.key)
        const Icon = item.icon
        return (
          <label key={item.key} className="flex cursor-pointer items-center gap-3 px-5 py-2.5">
            <IconTile>
              <Icon />
            </IconTile>
            <span className={cn('min-w-0 flex-1 text-sm', !visible && 'text-muted-foreground')}>{t(`nav.${item.key}`)}</span>
            <Switch
              checked={visible}
              disabled={visible && visibleCount <= 1}
              onCheckedChange={(on) => setHiddenNav(on ? hiddenNav.filter((k) => k !== item.key) : [...hiddenNav, item.key])}
            />
          </label>
        )
      })}
      <label className="hidden cursor-pointer items-center gap-3 px-5 py-2.5 md:flex">
        <IconTile>
          <RiPaletteFill />
        </IconTile>
        <span className={cn('min-w-0 flex-1 text-sm', !appearanceButton && 'text-muted-foreground')}>{t('settings.appearance')}</span>
        <Switch checked={appearanceButton} onCheckedChange={setAppearanceButton} />
      </label>
    </Card>
  )
}
