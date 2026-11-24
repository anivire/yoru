import { useQuery } from '@tanstack/react-query'
import type { DataSourceId } from '@yoru/shared'
import { Card, Skeleton, Switch, cn } from '@yoru/ui'
import { RiStackFill } from '@remixicon/react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { useUser } from '../lib/queries'
import { Block, useUpdateUser } from './settings-block'
import { SOURCE_NAMES, SourceIcon } from './source-logo'

function SourceChoice<T extends DataSourceId>({ value, available, pending, onChange }: { value: T | null; available: readonly T[]; pending: boolean; onChange: (value: T | null) => void }) {
  const { t } = useTranslation()
  const current = value && available.includes(value) ? value : null
  const options: { id: T | null; icon: ReactNode; label: string; hint?: string }[] = [
    {
      id: null,
      icon: (
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-field text-muted-foreground [&_svg]:size-[1.125rem]">
          <RiStackFill />
        </span>
      ),
      label: t('settings.anySource'),
      hint: t('settings.anySourceHint'),
    },
    ...available.map((id) => ({ id, icon: <SourceIcon id={id} />, label: SOURCE_NAMES[id] })),
  ]
  return (
    <div role="radiogroup" aria-label={t('settings.notifySourceTitle')} className="pb-1">
      <div className="px-5 pb-1 pt-4 text-xs font-medium text-muted-foreground">{t('settings.notifySourceTitle')}</div>
      {pending ? (
        <div className="flex flex-col gap-1 px-5 py-2">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      ) : !available.length ? (
        <p className="px-5 py-3 text-[0.8125rem] text-muted-foreground">{t('settings.noSources')}</p>
      ) : (
        options.map((option) => {
          const checked = option.id === current
          return (
            <button
              key={option.id ?? 'any'}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => !checked && onChange(option.id)}
              className="flex w-full cursor-pointer items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-muted"
            >
              {option.icon}
              <span className="min-w-0 flex-1">
                <span className="block text-sm">{option.label}</span>
                {option.hint ? <span className="block text-[0.8125rem] text-muted-foreground">{option.hint}</span> : null}
              </span>
              <span className={cn('grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors', checked ? 'border-accent' : 'border-border')}>
                {checked ? <span className="size-2.5 rounded-full bg-accent" /> : null}
              </span>
            </button>
          )
        })
      )}
    </div>
  )
}

function SwitchRow({ label, checked, onChange }: { label: ReactNode; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4">
      <span className="block text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  )
}

export function NotificationsTab() {
  const { t } = useTranslation()
  const user = useUser()
  const update = useUpdateUser()
  const sources = useQuery({ queryKey: ['notification-sources'], queryFn: api.notificationSources })
  const translations = sources.data?.translations ?? []
  const calendars = sources.data?.calendars ?? []
  return (
    <>
      <Block title={t('settings.notifications')} description={t('settings.notifyHint')}>
        <Card className="py-1">
          <SwitchRow label={t('settings.notifySub')} checked={user.notifySub} onChange={(notifySub) => update.mutate({ notifySub })} />
          <SwitchRow label={t('settings.notifyVoice')} checked={user.notifyVoice} onChange={(notifyVoice) => update.mutate({ notifyVoice })} />
          {user.notifySub || user.notifyVoice ? <SourceChoice value={user.notifySource} available={translations} pending={sources.isPending} onChange={(notifySource) => update.mutate({ notifySource })} /> : null}
        </Card>
      </Block>
      <Block title={t('settings.notifyPremieres')} description={t('settings.notifyPremieresHint')}>
        <Card className="py-1">
          <SwitchRow label={t('settings.premieresSwitch')} checked={user.notifyPremieres} onChange={(notifyPremieres) => update.mutate({ notifyPremieres })} />
          {user.notifyPremieres ? <SourceChoice value={user.premiereSource} available={translations} pending={sources.isPending} onChange={(premiereSource) => update.mutate({ premiereSource })} /> : null}
        </Card>
      </Block>
      <Block title={t('settings.notifySequels')} description={t('settings.notifySequelsHint')}>
        <Card className="py-1">
          <SwitchRow label={t('settings.sequelsSwitch')} checked={user.notifySequels} onChange={(notifySequels) => update.mutate({ notifySequels })} />
        </Card>
      </Block>
      <Block title={t('settings.airedTitle')} description={t('settings.notifyAiredHint')}>
        <Card className="py-1">
          <SwitchRow label={t('settings.notifyAired')} checked={user.notifyAired} onChange={(notifyAired) => update.mutate({ notifyAired })} />
          {user.notifyAired ? <SourceChoice value={user.airedSource} available={calendars} pending={sources.isPending} onChange={(airedSource) => update.mutate({ airedSource })} /> : null}
        </Card>
      </Block>
      <Block title={t('settings.socialNotifications')} description={t('settings.socialNotificationsHint')}>
        <Card className="py-1">
          {(['notifyFriends', 'notifyComments', 'notifyReactions', 'notifyRecommendations', 'notifyRooms'] as const).map((key) => (
            <label key={key} className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4">
              <span className="block text-sm">{t(`settings.${key}`)}</span>
              <Switch checked={user[key]} onCheckedChange={(v) => update.mutate({ [key]: v })} />
            </label>
          ))}
        </Card>
      </Block>
    </>
  )
}
