import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { EXPORT_FORMATS, type ExportFormat, IMPORT_PROVIDERS, type ImportProvider, type User } from '@yoru/shared'
import { Button, Card, CardContent, Code, Field, Input, Segmented, Switch, toast } from '@yoru/ui'
import { ArrowDownUp, Bell, Check, Download, FileBraces, FileCode, FileSpreadsheet, KeyRound, Palette, Shield, TriangleAlert, UserRound } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Page, PageHeader } from '../components/app-shell'
import { Flag, LANGUAGES, useChangeLanguage } from '../components/language'
import { PROVIDER_NAMES, ProviderIcon } from '../components/providers'
import { SchemePicker, ThemePicker } from '../components/theme-picker'
import { api } from '../lib/api'
import { useAppearance } from '../lib/appearance'
import { formatDate } from '../lib/format'
import { errorMessage, keys, useUser } from '../lib/queries'

const TABS = ['appearance', 'account', 'notifications', 'import'] as const
type Tab = (typeof TABS)[number]

const EXPORT_ICONS = { json: FileBraces, csv: FileSpreadsheet, 'mal-xml': FileCode } satisfies Record<ExportFormat, unknown>

const TAB_ICONS = { appearance: Palette, account: UserRound, notifications: Bell, import: ArrowDownUp } satisfies Record<Tab, unknown>

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

function Block({ title, description, children }: { title: ReactNode; description?: ReactNode; children: ReactNode }) {
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
  const { stretch, setStretch, expandSynopsis, setExpandSynopsis } = useAppearance()
  return (
    <>
      <Block title={t('settings.layout')}>
        <Card className="py-1">
          {[
            { key: 'stretch', checked: stretch, onChange: setStretch },
            { key: 'expandSynopsis', checked: expandSynopsis, onChange: setExpandSynopsis },
          ].map((o) => (
            <label key={o.key} className="flex cursor-pointer items-center justify-between gap-4 px-5 py-3">
              <span>
                <span className="block text-sm">{t(`settings.${o.key}`)}</span>
                <span className="block text-[13px] text-muted-foreground">{t(`settings.${o.key}Hint`)}</span>
              </span>
              <Switch checked={o.checked} onCheckedChange={o.onChange} />
            </label>
          ))}
        </Card>
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

function AccountTab() {
  const { t } = useTranslation()
  const user = useUser()
  const update = useUpdateUser()
  const changeLanguage = useChangeLanguage()
  const [token, setToken] = useState('')
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
      <Block title={t('settings.language')}>
        <Segmented
          value={user.locale}
          onChange={changeLanguage}
          options={LANGUAGES.map((l) => ({ ...l, icon: <Flag locale={l.value} /> }))}
        />
      </Block>
      <Block title={t('settings.token')} description={<Trans i18nKey="settings.tokenHint" components={{ code: <Code /> }} />}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="flex flex-col gap-4 p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                <KeyRound className="size-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-medium">Anime365</div>
                {user.hasOwnAnime365Token ? (
                  <div className="flex items-center gap-1 text-xs text-success">
                    <Check className="size-3" />
                    {t('settings.tokenSet')}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">{t('settings.tokenNotSet')}</div>
                )}
              </div>
              {user.hasOwnAnime365Token ? (
                <Button size="sm" variant="ghost" onClick={() => update.mutate({ anime365Token: null })}>
                  {t('common.delete')}
                </Button>
              ) : null}
            </div>
            <form
              className="mt-auto flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                update.mutate({ anime365Token: token.trim() }, { onSuccess: () => setToken('') })
              }}
            >
              <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="access_token" autoComplete="off" className="h-8 text-[13px]" />
              <Button type="submit" variant="secondary" size="sm" disabled={!token.trim()} loading={update.isPending}>
                {t('common.save')}
              </Button>
            </form>
          </Card>
        </div>
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
                <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
              </Field>
              <Field label={t('settings.newPassword')}>
                <Input type="password" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} required />
              </Field>
              <Button type="submit" variant="secondary" loading={password.isPending}>
                {t('settings.changePassword')}
              </Button>
            </form>
          </CardContent>
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
        {(['notifySub', 'notifyVoice'] as const).map((key) => (
          <label key={key} className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4">
            <span className="text-sm">{t(`settings.${key}`)}</span>
            <Switch checked={user[key]} onCheckedChange={(v) => update.mutate({ [key]: v })} />
          </label>
        ))}
      </Card>
    </Block>
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
            <TriangleAlert className="size-5 shrink-0 text-warning" />
            <div className="flex-1 text-sm">
              <div className="font-medium">{t('settings.importMissing', { names: missing.map((p) => PROVIDER_NAMES[p]).join(', ') })}</div>
              <div className="mt-0.5 text-muted-foreground">{isAdmin ? <Trans i18nKey="settings.importMissingAdmin" components={{ code: <Code /> }} /> : t('settings.importMissingUser')}</div>
            </div>
            {isAdmin ? (
              <Button asChild variant="secondary" size="sm">
                <Link to="/admin">
                  <Shield />
                  {t('nav.admin')}
                </Link>
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
                    {enabled === false ? (
                      <div className="flex items-center gap-1 text-xs text-warning">
                        <TriangleAlert className="size-3" />
                        {t('settings.notConfigured')}
                      </div>
                    ) : null}
                  </div>
                </div>
                {enabled === false && isAdmin ? (
                  <code className="break-all rounded-md bg-inset px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
                    {env}_CLIENT_ID
                    <br />
                    {env}_CLIENT_SECRET
                  </code>
                ) : null}
                {enabled ? (
                  <Button asChild variant="secondary" size="sm" className="mt-auto">
                    <a href={api.importStartUrl(p)}>
                      <Download />
                      {t('settings.connect', { name: PROVIDER_NAMES[p] })}
                    </a>
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" disabled className="mt-auto">
                    <Download />
                    {t('settings.connect', { name: PROVIDER_NAMES[p] })}
                  </Button>
                )}
              </Card>
            )
          })}
        </div>
        {status.data?.last ? (
          <p className="mt-3 text-[13px] text-muted-foreground">
            {t('settings.lastImport', { name: PROVIDER_NAMES[status.data.last.provider], date: formatDate(status.data.last.createdAt, { dateStyle: 'medium', timeStyle: 'short' }) })}
          </p>
        ) : null}
      </Block>
      <Block title={t('settings.exportTitle')} description={t('settings.exportHint')}>
        <div className="grid gap-3 sm:grid-cols-3">
          {EXPORT_FORMATS.map((f) => {
            const Icon = EXPORT_ICONS[f]
            const name = f === 'mal-xml' ? 'MAL XML' : f.toUpperCase()
            return (
              <Card key={f} className="flex flex-col gap-4 p-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                    <Icon className="size-[18px]" />
                  </span>
                  <div className="min-w-0">
                    <div className="font-medium">{name}</div>
                    <p className="text-xs text-muted-foreground">{t(`settings.exportFormat.${f}`)}</p>
                  </div>
                </div>
                <Button asChild variant="secondary" size="sm" className="mt-auto">
                  <a href={api.exportUrl(f)} download>
                    <Download />
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
        className="mb-8"
      />
      {tab === 'appearance' ? <AppearanceTab /> : null}
      {tab === 'account' ? <AccountTab /> : null}
      {tab === 'notifications' ? <NotificationsTab /> : null}
      {tab === 'import' ? <ImportTab /> : null}
    </Page>
  )
}

