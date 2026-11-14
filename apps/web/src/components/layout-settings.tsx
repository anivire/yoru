import { Button, Card, Switch, cn } from '@yoru/ui'
import { RiArrowDownSFill, RiArrowUpSFill, RiImageFill } from '@remixicon/react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppearance } from '../lib/appearance'
import { HOME_SECTIONS, NAV } from '../lib/navigation'

function IconTile({ children }: { children: ReactNode }) {
  return <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent [&_svg]:size-4">{children}</span>
}

export function HomeLayoutSettings() {
  const { t } = useTranslation()
  const { homeSections, setHomeSections, showHero, setShowHero } = useAppearance()
  const move = (index: number, delta: number) => {
    const next = [...homeSections]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target]!, next[index]!]
    setHomeSections(next)
  }
  return (
    <Card className="py-1">
      <label className="flex cursor-pointer items-center gap-3 px-5 py-3">
        <IconTile>
          <RiImageFill />
        </IconTile>
        <span className="min-w-0 flex-1">
          <span className="block text-sm">{t('settings.heroBanner')}</span>
          <span className="block text-[13px] text-muted-foreground">{t('settings.heroBannerHint')}</span>
        </span>
        <Switch checked={showHero} onCheckedChange={setShowHero} />
      </label>
      {homeSections.map((section, index) => {
        const meta = HOME_SECTIONS.find((s) => s.id === section.id)!
        const Icon = meta.icon
        return (
          <div key={section.id} className="flex items-center gap-3 px-5 py-2.5">
            <IconTile>
              <Icon />
            </IconTile>
            <span className={cn('min-w-0 flex-1 truncate text-sm', !section.visible && 'text-muted-foreground')}>{t(meta.label)}</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon-sm" aria-label={t('settings.moveUp')} disabled={index === 0} onClick={() => move(index, -1)}>
                <RiArrowUpSFill />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={t('settings.moveDown')} disabled={index === homeSections.length - 1} onClick={() => move(index, 1)}>
                <RiArrowDownSFill />
              </Button>
            </div>
            <Switch
              checked={section.visible}
              onCheckedChange={(visible) => setHomeSections(homeSections.map((s) => (s.id === section.id ? { ...s, visible } : s)))}
            />
          </div>
        )
      })}
    </Card>
  )
}

export function NavigationSettings() {
  const { t } = useTranslation()
  const { hiddenNav, setHiddenNav } = useAppearance()
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
    </Card>
  )
}
