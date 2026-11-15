import { TITLE_LANGUAGES, type TitleLanguage } from '@yoru/shared'
import { Button, Popover, PopoverContent, PopoverTrigger, Segmented, StepSlider, Switch, cn } from '@yoru/ui'
import { RiArrowRightSLine, RiLockFill, RiPaletteFill } from '@remixicon/react'
import { type ReactNode, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppearance } from '../lib/appearance'
import { useMe } from '../lib/queries'
import { Flag } from './language'
import { BackdropPicker, HomeLayoutSettings, NavPositionSettings, NavigationSettings } from './layout-settings'
import { RailLabel, RailTip, useRailButton } from './rail'
import { SchemePicker, ThemePicker } from './theme-picker'
import { TLink } from './transition-link'

const TITLE_FLAGS = { romaji: 'romaji', english: 'en', japanese: 'ja', russian: 'ru' } as const satisfies Record<TitleLanguage, 'ja' | 'romaji' | 'en' | 'ru'>

export function TitleLanguagePicker({ compact }: { compact?: boolean }) {
  const { t } = useTranslation()
  const { titleLanguage, setTitleLanguage } = useAppearance()
  const locked = useMe().data?.russianTitles === false
  return (
    <>
      <Segmented
        value={titleLanguage === 'russian' && locked ? 'romaji' : titleLanguage}
        onChange={setTitleLanguage}
        size={compact ? 'sm' : 'md'}
        options={TITLE_LANGUAGES.map((v) => ({
          value: v,
          label: t(`settings.titleLanguage.${v}`),
          icon: <Flag locale={TITLE_FLAGS[v]} />,
          disabled: v === 'russian' && locked,
          title: v === 'russian' && locked ? t('settings.titleLanguage.russianLocked') : undefined,
        }))}
        className={compact ? 'grid w-full grid-cols-2' : 'grid w-full grid-cols-2 sm:inline-flex sm:w-auto'}
      />
      {locked ? (
        <p className={cn('flex items-center gap-2 text-warning', compact ? 'mt-2 text-xs' : 'mt-3 text-[0.8125rem]')}>
          <RiLockFill className="size-3.5 shrink-0" />
          {t('settings.titleLanguage.russianLocked')}
        </p>
      ) : titleLanguage === 'russian' ? (
        <p className={cn('text-muted-foreground', compact ? 'mt-2 text-xs' : 'mt-3 text-[0.8125rem]')}>{t('settings.titleLanguage.russianNote')}</p>
      ) : null}
    </>
  )
}

function Section({ title, children, className }: { title: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="mb-2 text-xs font-medium text-muted-foreground">{title}</div>
      {children}
    </div>
  )
}

function AppearancePanel({ full }: { full: boolean }) {
  const { t } = useTranslation()
  const { pageWidth, setPageWidth, pageWidthOptions, expandSynopsis, setExpandSynopsis } = useAppearance()
  return (
    <>
      <Section title={t('settings.colorScheme')}>
        <SchemePicker compact />
      </Section>
      <Section title={t('settings.themes')}>
        <ThemePicker compact />
      </Section>
      {full ? (
        <>
          <Section title={t('settings.titleLanguage.title')}>
            <TitleLanguagePicker compact />
          </Section>
          <Section title={t('settings.pageWidth')}>
            <StepSlider value={pageWidth} onChange={setPageWidth} label={t('settings.pageWidth')} options={pageWidthOptions.map((w) => ({ value: w.value, label: w.label }))} />
          </Section>
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span className="text-sm">{t('settings.expandSynopsis')}</span>
            <Switch checked={expandSynopsis} onCheckedChange={setExpandSynopsis} />
          </label>
          <Section title={t('settings.backdrop.title')}>
            <BackdropPicker />
          </Section>
          <Section title={t('settings.navPosition.title')} className="hidden md:block">
            <NavPositionSettings />
          </Section>
          <Section title={t('settings.homeLayout')}>
            <HomeLayoutSettings />
          </Section>
          <Section title={t('settings.navigation')}>
            <NavigationSettings />
          </Section>
          <TLink to="/settings/appearance" className="flex items-center justify-center gap-1 rounded-lg py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            {t('settings.allSettings')}
            <RiArrowRightSLine className="size-4" />
          </TLink>
        </>
      ) : null}
    </>
  )
}

let popoverOpen = false
const openListeners = new Set<() => void>()

function setPopoverOpen(open: boolean) {
  popoverOpen = open
  for (const listener of openListeners) listener()
}

function usePopoverOpen() {
  return useSyncExternalStore(
    (listener) => {
      openListeners.add(listener)
      return () => openListeners.delete(listener)
    },
    () => popoverOpen,
  )
}

export function AppearancePopover({
  side = 'bottom',
  rail = false,
  full = false,
  className,
}: {
  side?: 'top' | 'bottom' | 'left' | 'right'
  rail?: boolean
  full?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const open = usePopoverOpen()
  const railButton = useRailButton()
  return (
    <Popover open={open} onOpenChange={setPopoverOpen}>
      <RailTip label={t('settings.appearance')} side={side}>
        <PopoverTrigger asChild>
          <Button
            variant="secondary"
            size="icon"
            aria-label={t('settings.appearance')}
            className={cn(rail ? railButton + ' bg-transparent hover:bg-transparent' : 'rounded-full', className)}
          >
            <RiPaletteFill />
            {rail ? <RailLabel>{t('settings.appearance')}</RailLabel> : null}
          </Button>
        </PopoverTrigger>
      </RailTip>
      <PopoverContent
        side={side}
        align="end"
        collisionPadding={12}
        className={cn('flex max-h-[min(85vh,44rem)] flex-col overflow-hidden p-0', full ? 'w-[min(92vw,26rem)]' : 'w-[min(92vw,22rem)]')}
      >
        <div className="flex min-h-0 flex-col gap-5 overflow-y-auto p-4">
          <AppearancePanel full={full} />
        </div>
      </PopoverContent>
    </Popover>
  )
}
