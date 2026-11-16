import type { CueName } from '@foleyjs/core'
import { Button, Card, Segmented, StepSlider, Switch, cn } from '@yoru/ui'
import { RiCursorFill, RiNotification3Fill, RiPlayFill, RiCheckboxCircleFill, type RemixiconComponentType } from '@remixicon/react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { SOUND_THEMES, SOUND_VOLUMES, type SoundCategory, preview, updateSounds, useSounds } from '../lib/sounds'

function Block({ title, description, children }: { title: ReactNode; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  )
}

const CATEGORIES: { key: SoundCategory; icon: RemixiconComponentType; sample: CueName }[] = [
  { key: 'interface', icon: RiCursorFill, sample: 'glide' },
  { key: 'notifications', icon: RiNotification3Fill, sample: 'bubble' },
  { key: 'feedback', icon: RiCheckboxCircleFill, sample: 'success' },
]

export function SoundsTab() {
  const { t } = useTranslation()
  const sounds = useSounds()
  return (
    <>
      <Block title={t('settings.sound.title')} description={t('settings.sound.hint')}>
        <Card className="py-1">
          <label className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4">
            <span className="text-sm">{t('settings.sound.enabled')}</span>
            <Switch checked={sounds.enabled} onCheckedChange={(enabled) => updateSounds({ enabled })} />
          </label>
          <div className={cn('flex flex-col gap-3 px-5 py-4', !sounds.enabled && 'pointer-events-none opacity-50')}>
            <span className="text-sm">{t('settings.sound.volume')}</span>
            <StepSlider
              value={sounds.volume}
              onChange={(volume) => {
                updateSounds({ volume })
                preview('glide')
              }}
              label={t('settings.sound.volume')}
              options={SOUND_VOLUMES.map((v, i) => ({ value: v, label: <span className={cn(i % 2 === 0 && i > 0 && 'max-sm:hidden')}>{v}%</span> }))}
            />
          </div>
        </Card>
      </Block>
      <Block title={t('settings.sound.character')} description={t('settings.sound.characterHint')}>
        <div className={cn(!sounds.enabled && 'pointer-events-none opacity-50')}>
          <Segmented
            value={sounds.theme as (typeof SOUND_THEMES)[number]}
            onChange={(theme) => {
              updateSounds({ theme })
              preview('success')
            }}
            options={SOUND_THEMES.map((v) => ({ value: v, label: t(`settings.sound.themes.${v}`) }))}
            className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto"
          />
        </div>
      </Block>
      <Block title={t('settings.sound.categories')} description={t('settings.sound.categoriesHint')}>
        <Card className={cn('py-1', !sounds.enabled && 'pointer-events-none opacity-50')}>
          {CATEGORIES.map(({ key, icon: Icon, sample }) => (
            <div key={key} className="flex items-center gap-3 px-5 py-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent [&_svg]:size-4">
                <Icon />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block text-sm', !sounds[key] && 'text-muted-foreground')}>{t(`settings.sound.${key}`)}</span>
                <span className="block text-[0.8125rem] text-muted-foreground">{t(`settings.sound.${key}Hint`)}</span>
              </span>
              <Button variant="ghost" size="icon-sm" className="rounded-full" data-sound="none" aria-label={t('settings.sound.preview')} title={t('settings.sound.preview')} onClick={() => preview(sample)}>
                <RiPlayFill />
              </Button>
              <Switch checked={sounds[key]} onCheckedChange={(on) => updateSounds({ [key]: on })} />
            </div>
          ))}
        </Card>
      </Block>
    </>
  )
}
