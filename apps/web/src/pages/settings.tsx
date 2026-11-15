import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { EXPORT_FORMATS, type ExportFormat, IMPORT_PROVIDERS, type ImportProvider, type User } from '@yoru/shared'
import { Badge, Button, Card, CardContent, Code, Field, Input, LogoMark, Segmented, Skeleton, Spinner, StepSlider, Switch, toast } from '@yoru/ui'
import { RiAlertFill, RiArrowUpDownFill, RiBracesFill, RiDownload2Fill, RiFileCodeFill, RiFileExcel2Fill, RiFileUploadFill, RiLockFill, RiNotification3Fill, RiPaletteFill, RiPlayCircleFill, RiShieldFill, RiUser3Fill, RiVolumeUpFill } from '@remixicon/react'
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { Page, PageHeader } from '../components/app-shell'
import { SecretForm } from '../components/admin-sources'
import { HomeLayoutSettings, NavPositionSettings, NavigationSettings } from '../components/layout-settings'
import { SessionsList } from '../components/sessions'
import { Flag, LANGUAGES, useChangeLanguage } from '../components/language'
import { TitleLanguagePicker } from '../components/appearance-panel'
import { PROVIDER_NAMES, ProviderIcon } from '../components/providers'
import { SchemePicker, ThemePicker } from '../components/theme-picker'
import { api } from '../lib/api'
import { PAGE_WIDTHS, useAppearance } from '../lib/appearance'
import { exportFormatName, formatDate } from '../lib/format'
import { errorMessage, keys, useUser } from '../lib/queries'
import { TLink } from '../components/transition-link'
import { useDocumentTitle } from '../lib/title'

import { PlayerTab } from '../components/player-settings'
import { SoundsTab } from '../components/sound-settings'

const TABS = ['appearance', 'player', 'sounds', 'account', 'notifications', 'import'] as const
type Tab = (typeof TABS)[number]

const EXPORT_ICONS = { yoru: RiBracesFill, json: RiBracesFill, csv: RiFileExcel2Fill, 'mal-xml': RiFileCodeFill } satisfies Record<ExportFormat, unknown>

const TAB_ICONS = { appearance: RiPaletteFill, player: RiPlayCircleFill, sounds: RiVolumeUpFill, account: RiUser3Fill, notifications: RiNotification3Fill, import: RiArrowUpDownFill } satisfies Record<Tab, unknown>

function useUpdateUser() {
  const client = useQueryClient()
  const { t } = useTranslation()
  return useMutation({
    mutationFn: api.updateSettings,
    onSuccess: (user: User) => {
      client.setQueryData(keys.me, user)
      toast.success(t('common.saved'))
    },
    onError: (e) => toast.error(errorMessage(e, t)),
  })
}

export function Block({ title, description, children }: { title: ReactNode; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function AppearanceTab() {
  const { t } = useTranslation()
  const { pageWidth, setPageWidth, expandSynopsis, setExpandSynopsis } = useAppearance()
  const user = useUser()
  const changeLanguage = useChangeLanguage()
  return (
    <>
      <Block title={t('settings.language')} description={t('settings.languageHint')}>
        <Segmented
          value={user.locale}
          onChange={changeLanguage}
          options={LANGUAGES.map((l) => ({ ...l, icon: <Flag locale={l.value} /> }))}
        />
      </Block>
      <Block title={t('settings.titleLanguage.title')} description={t('settings.titleLanguage.hint')}>
        <TitleLanguagePicker />
      </Block>
      <Block title={t('settings.layout')}>
        <Card className="py-1">
          <div className="hidden flex-col gap-3 px-5 py-4 lg:flex">
            <span>
              <span className="block text-sm">{t('settings.pageWidth')}</span>
              <span className="block text-[0.8125rem] text-muted-foreground">{t('settings.pageWidthHint')}</span>
            </span>
            <StepSlider
              value={pageWidth}
              onChange={setPageWidth}
              label={t('settings.pageWidth')}
              options={PAGE_WIDTHS.map((w) => ({ value: w.value, label: w.label }))}
            />
          </div>
          <label className="flex cursor-pointer items-center justify-between gap-4 px-5 py-3">
            <span>
              <span className="block text-sm">{t('settings.expandSynopsis')}</span>
              <span className="block text-[0.8125rem] text-muted-foreground">{t('settings.expandSynopsisHint')}</span>
            </span>
            <Switch checked={expandSynopsis} onCheckedChange={setExpandSynopsis} />
          </label>
        </Card>
      </Block>
      <Block title={t('settings.homeLayout')} description={t('settings.homeLayoutHint')}>
        <HomeLayoutSettings />
      </Block>
      <Block title={t('settings.navPosition.title')} description={t('settings.navPosition.hint')}>
        <NavPositionSettings />
      </Block>
      <Block title={t('settings.navigation')} description={t('settings.navigationHint')}>
        <NavigationSettings />
      </Block>
      <Block title={t('settings.colorScheme')}>
        <SchemePicker />
      </Block>
      <Block title={t('settings.themes')}>
        <ThemePicker />
      </Block>
    </>
  )
}

function AccountInfoCard() {
  const { t } = useTranslation()
  const user = useUser()
  const info = useQuery({ queryKey: ['account-info'], queryFn: api.account })
  const none = <span className="text-subtle-foreground">{t('settings.accountInfo.none')}</span>
  const loading = <Skeleton className="ml-auto h-4 w-28 rounded-md" />
  const rows: [string, ReactNode][] = [
    [t('settings.accountInfo.role'), user.role === 'admin' ? t('nav.roleAdmin') : t('nav.roleUser')],
    [t('settings.accountInfo.id'), <span className="font-mono">#{user.id}</span>],
    [t('settings.accountInfo.createdAt'), formatDate(user.createdAt, { dateStyle: 'long', timeStyle: 'short' })],
    [t('settings.accountInfo.invitedBy'), info.data ? (info.data.invitedBy ?? none) : loading],
    [t('settings.accountInfo.lastLogin'), info.data ? (info.data.lastLoginAt ? formatDate(info.data.lastLoginAt, { dateStyle: 'long', timeStyle: 'short' }) : none) : loading],
  ]
  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-[0.8125rem] font-medium">{t('settings.accountInfo.username')}</span>
        <div className="flex h-9 cursor-default select-text items-center gap-2 rounded-lg bg-field px-3 text-sm font-medium">
          <RiLockFill className="size-4 shrink-0 text-subtle-foreground" />
          {user.username}
        </div>
      </div>
      <dl className="grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

function AccountTab() {
  const { t } = useTranslation()
  const user = useUser()
  const update = useUpdateUser()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const password = useMutation({
    mutationFn: () => api.changePassword(current, next),
    onSuccess: () => {
      setCurrent('')
      setNext('')
      toast.success(t('settings.passwordChanged'))
    },
  })

  return (
    <>
      <Block title={t('settings.accountInfo.title')}>
        <AccountInfoCard />
      </Block>
      <Block title={t('settings.sessions.title')} description={t('settings.sessions.hint')}>
        <SessionsList />
      </Block>
      <Block title={t('settings.password')}>
        <Card>
          <CardContent>
            <form
              className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
              onSubmit={(e: FormEvent) => {
                e.preventDefault()
                password.mutate()
              }}
            >
              <Field label={t('settings.currentPassword')} error={password.error ? errorMessage(password.error, t) : undefined}>
                <Input type="password" autoComplete="current-password" placeholder={t('settings.currentPasswordPlaceholder')} value={current} onChange={(e) => setCurrent(e.target.value)} required />
              </Field>
              <Field label={t('settings.newPassword')}>
                <Input type="password" autoComplete="new-password" minLength={8} placeholder={t('settings.newPasswordPlaceholder')} value={next} onChange={(e) => setNext(e.target.value)} required />
              </Field>
              <Button type="submit" variant="secondary" loading={password.isPending}>
                {t('settings.changePassword')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </Block>
      <Block title={t('settings.token')} description={<Trans i18nKey="settings.tokenHint" components={{ code: <Code /> }} />}>
        <Card className="flex flex-col gap-4 p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-white">
              <img src="/anime365.webp" alt="" className="size-7 object-contain" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-medium">Anime365</div>
              {user.hasOwnAnime365Token ? (
                <div className="text-xs text-success">{t('settings.tokenSet')}</div>
              ) : user.hasSharedAnime365Token ? (
                <div className="text-xs text-muted-foreground">{t('settings.tokenNotSet')}</div>
              ) : (
                <div className="text-xs text-danger">{t('settings.tokenMissing')}</div>
              )}
            </div>
          </div>
          <SecretForm
            placeholder="access_token"
            isSet={user.hasOwnAnime365Token}
            onSave={(v) => update.mutate({ anime365Token: v })}
            onClear={() => update.mutate({ anime365Token: null })}
            pending={update.isPending}
          />
        </Card>
      </Block>
    </>
  )
}

function NotificationsTab() {
  const { t } = useTranslation()
  const user = useUser()
  const update = useUpdateUser()
  return (
    <Block title={t('settings.notifications')} description={t('settings.notifyHint')}>
      <Card className="py-1">
        {(['notifySub', 'notifyVoice', 'notifyPremieres'] as const).map((key) => (
          <label key={key} className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4">
            <span>
              <span className="block text-sm">{t(`settings.${key}`)}</span>
              {key === 'notifyPremieres' ? <span className="block text-[0.8125rem] text-muted-foreground">{t('settings.notifyPremieresHint')}</span> : null}
            </span>
            <Switch checked={user[key]} onCheckedChange={(v) => update.mutate({ [key]: v })} />
          </label>
        ))}
      </Card>
    </Block>
  )
}

function YoruImport() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const upload = useMutation({
    mutationFn: api.importYoru,
    onSuccess: (r) => {
      toast.success(t('settings.importDone', { name: 'yoru', imported: r.imported, updated: r.updated, skipped: r.skipped }))
      void client.invalidateQueries({ queryKey: ['list'] })
      void client.invalidateQueries({ queryKey: keys.home })
      void client.invalidateQueries({ queryKey: ['import-status'] })
    },
    onError: (e) => toast.error(errorMessage(e, t)),
  })
  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-field">
            <LogoMark size={26} />
          </span>
          <div className="min-w-0">
            <div className="font-medium">yoru</div>
            <p className="text-xs text-muted-foreground">{t('settings.yoruFile.hint')}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t('settings.yoruFile.note')}</p>
      </div>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) upload.mutate(file)
          e.target.value = ''
        }}
      />
      <Button variant="secondary" size="sm" loading={upload.isPending} onClick={() => input.current?.click()} className="mt-auto self-start">
        <RiFileUploadFill />
        {t('settings.seanime.choose')}
      </Button>
    </Card>
  )
}

function SeanimeImport() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const upload = useMutation({
    mutationFn: api.importSeanime,
    onSuccess: (r) => {
      toast.success(t('settings.importDone', { name: 'Seanime', imported: r.imported, updated: r.updated, skipped: r.skipped }))
      void client.invalidateQueries({ queryKey: ['list'] })
      void client.invalidateQueries({ queryKey: keys.home })
      void client.invalidateQueries({ queryKey: ['import-status'] })
    },
    onError: (e) => toast.error(errorMessage(e, t)),
  })
  const paths = [
    ['Windows', String.raw`%APPDATA%\Seanime\offline\local.db`],
    ['macOS', '~/Library/Application Support/Seanime/offline/local.db'],
    ['Linux', '~/.config/Seanime/offline/local.db'],
  ]
  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-black">
            <img src="/seanime.webp" alt="" className="size-7 object-contain" />
          </span>
          <div className="min-w-0">
            <div className="font-medium">Seanime</div>
            <p className="text-xs text-muted-foreground">{t('settings.seanime.hint')}</p>
          </div>
        </div>
        <div className="flex flex-col gap-1 text-[0.8125rem] text-muted-foreground">
          {paths.map(([os, path]) => (
            <div key={os} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
              <span className="shrink-0 text-subtle-foreground sm:w-16">{os}</span>
              <Code>{path}</Code>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t('settings.seanime.note')}</p>
      </div>
      <input
        ref={input}
        type="file"
        accept=".db,.json,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) upload.mutate(file)
          e.target.value = ''
        }}
      />
      <Button variant="secondary" size="sm" loading={upload.isPending} onClick={() => input.current?.click()} className="self-start">
        <RiFileUploadFill />
        {t('settings.seanime.choose')}
      </Button>
    </Card>
  )
}

function ImportTab() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const client = useQueryClient()
  const status = useQuery({ queryKey: ['import-status'], queryFn: api.importStatus })
  const isAdmin = useUser().role === 'admin'

  useEffect(() => {
    const provider = params.get('provider') as ImportProvider | null
    if (!provider) return
    const name = PROVIDER_NAMES[provider] ?? provider
    if (params.get('error')) toast.error(t('settings.importFailed', { name }))
    else
      toast.success(
        t('settings.importDone', { name, imported: params.get('imported') ?? 0, updated: params.get('updated') ?? 0, skipped: params.get('skipped') ?? 0 }),
      )
    void client.invalidateQueries({ queryKey: ['list'] })
    void client.invalidateQueries({ queryKey: keys.home })
    setParams({}, { replace: true })
  }, [])

  const missing = IMPORT_PROVIDERS.filter((p) => status.data?.providers[p] === false)

  return (
    <>
      <Block title={t('settings.importTitle')} description={t('settings.importHint')}>
        {missing.length ? (
          <div className="mb-4 flex flex-col gap-3 rounded-xl bg-warning-soft p-4 sm:flex-row sm:items-center">
            <RiAlertFill className="size-5 shrink-0 text-warning" />
            <div className="flex-1 text-sm">
              <div className="font-medium">{t('settings.importMissing', { names: missing.map((p) => PROVIDER_NAMES[p]).join(', ') })}</div>
              <div className="mt-0.5 text-muted-foreground">{isAdmin ? <Trans i18nKey="settings.importMissingAdmin" components={{ code: <Code /> }} /> : t('settings.importMissingUser')}</div>
            </div>
            {isAdmin ? (
              <Button asChild variant="secondary" size="sm">
                <TLink to="/admin?tab=oauth">
                  <RiShieldFill />
                  {t('nav.admin')}
                </TLink>
              </Button>
            ) : null}
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-3">
          {IMPORT_PROVIDERS.map((p) => {
            const enabled = status.data?.providers[p]
            const env = p.toUpperCase()
            return (
              <Card key={p} className="flex flex-col gap-4 p-4">
                <div className="flex items-center gap-3">
                  <ProviderIcon provider={p} />
                  <div className="min-w-0">
                    <div className="font-medium">{PROVIDER_NAMES[p]}</div>
                    {status.isPending ? (
                      <Badge size="sm" variant="neutral" className="mt-0.5">
                        <Spinner />
                        {t('admin.checking')}
                      </Badge>
                    ) : enabled === false ? (
                      <div className="flex items-center gap-1 text-xs text-warning">
                        <RiAlertFill className="size-3" />
                        {t('settings.notConfigured')}
                      </div>
                    ) : null}
                  </div>
                </div>
                {enabled === false && isAdmin ? (
                  <code className="break-all rounded-md bg-inset px-2 py-1.5 font-mono text-[0.6875rem] text-muted-foreground">
                    {env}_CLIENT_ID
                    <br />
                    {env}_CLIENT_SECRET
                  </code>
                ) : null}
                {enabled ? (
                  <Button asChild variant="secondary" size="sm" className="mt-auto">
                    <a href={api.importStartUrl(p)}>
                      <RiDownload2Fill />
                      {t('settings.connect', { name: PROVIDER_NAMES[p] })}
                    </a>
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" disabled className="mt-auto">
                    <RiDownload2Fill />
                    {t('settings.connect', { name: PROVIDER_NAMES[p] })}
                  </Button>
                )}
              </Card>
            )
          })}
        </div>
        {status.data?.last ? (
          <p className="mt-3 text-[0.8125rem] text-muted-foreground">
            {t('settings.lastImport', { name: status.data.last.provider === 'seanime' ? 'Seanime' : status.data.last.provider === 'yoru' ? 'yoru' : PROVIDER_NAMES[status.data.last.provider], date: formatDate(status.data.last.createdAt, { dateStyle: 'medium', timeStyle: 'short' }) })}
          </p>
        ) : null}
      </Block>
      <Block title={t('settings.fileImportTitle')} description={t('settings.fileImportHint')}>
        <div className="grid gap-3 lg:grid-cols-2">
          <YoruImport />
          <SeanimeImport />
        </div>
      </Block>
      <Block title={t('settings.exportTitle')} description={t('settings.exportHint')}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {EXPORT_FORMATS.map((f) => {
            const Icon = EXPORT_ICONS[f]
            const name = exportFormatName(f)
            return (
              <Card key={f} className="flex flex-col gap-4 p-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                    {f === 'yoru' ? <LogoMark size={24} /> : <Icon className="size-[1.125rem]" />}
                  </span>
                  <div className="min-w-0">
                    <div className="font-medium">{name}</div>
                    <p className="text-xs text-muted-foreground">{t(`settings.exportFormat.${f}`)}</p>
                  </div>
                </div>
                <Button asChild variant="secondary" size="sm" className="mt-auto">
                  <a href={api.exportUrl(f)} download>
                    <RiDownload2Fill />
                    {t('settings.download', { name })}
                  </a>
                </Button>
              </Card>
            )
          })}
        </div>
      </Block>
    </>
  )
}

export function SettingsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { tab: raw } = useParams()
  const tab: Tab = TABS.includes(raw as Tab) ? (raw as Tab) : 'appearance'
  useDocumentTitle(`${t(`settings.${tab}`)} · ${t('settings.title')}`)
  return (
    <Page>
      <PageHeader title={t('settings.title')} />
      <Segmented
        value={tab}
        onChange={(v) => navigate(`/settings/${v}`, { replace: true })}
        options={TABS.map((v) => {
          const Icon = TAB_ICONS[v]
          return { value: v, label: t(`settings.${v}`), icon: <Icon /> }
        })}
        className="mb-8 grid w-full grid-cols-2 sm:inline-flex sm:w-auto"
      />
      <div key={tab} className="animate-fade">
        {tab === 'appearance' ? <AppearanceTab /> : null}
        {tab === 'player' ? <PlayerTab /> : null}
        {tab === 'sounds' ? <SoundsTab /> : null}
        {tab === 'account' ? <AccountTab /> : null}
        {tab === 'notifications' ? <NotificationsTab /> : null}
        {tab === 'import' ? <ImportTab /> : null}
      </div>
    </Page>
  )
}

