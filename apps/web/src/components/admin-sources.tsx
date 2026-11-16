import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type AdminSettings, type AdminSettingsInput, type DataSourceInfo, IMPORT_PROVIDERS, type ImportProvider } from '@yoru/shared'
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Code, Field, Input, Skeleton, Spinner, StatusDot, Tooltip, toast } from '@yoru/ui'
import { RiKey2Fill } from '@remixicon/react'
import { type FormEvent, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { errorMessage } from '../lib/queries'
import { PROVIDER_NAMES, ProviderIcon } from './providers'
import { SecretForm } from './secret-form'

export function useSaveSettings(extraKeys: string[][] = []) {
  const { t } = useTranslation()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (patch: AdminSettingsInput) => api.admin.saveSettings(patch),
    onSuccess: () => {
      toast.success(t('common.saved'))
      void client.invalidateQueries({ queryKey: ['admin', 'settings'] })
      for (const key of extraKeys) void client.invalidateQueries({ queryKey: key })
    },
    onError: (e) => toast.error(errorMessage(e, t)),
  })
}

export function SourceStatus({ info }: { info: DataSourceInfo }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const check = useMutation({
    mutationFn: () => api.admin.checkSource(info.id),
    onMutate: () => {
      client.setQueryData<AdminSettings>(['admin', 'settings'], (prev) =>
        prev ? { ...prev, sources: prev.sources.map((s) => (s.id === info.id ? { ...s, reachable: null } : s)) } : prev,
      )
    },
    onSuccess: (sources) => client.setQueryData<AdminSettings>(['admin', 'settings'], (prev) => (prev ? { ...prev, sources } : prev)),
    onError: (e) => toast.error(errorMessage(e, t)),
  })
  if (!info.enabled) return <Badge variant="neutral">{t('admin.sources.off')}</Badge>
  if (info.reachable === null) {
    return (
      <Badge variant="neutral">
        <Spinner />
        {t('admin.checking')}
      </Badge>
    )
  }
  return (
    <Tooltip content={t('admin.sources.recheck')}>
      <button type="button" className="cursor-pointer rounded-full" onClick={() => check.mutate()}>
        <Badge variant={info.reachable ? 'success' : 'danger'}>
          <StatusDot tone={info.reachable ? 'success' : 'danger'} pulse={!info.reachable} />
          {info.reachable ? t('admin.reachable') : t('admin.unreachable')}
        </Badge>
      </button>
    </Tooltip>
  )
}

export function UrlField({ info }: { info: DataSourceInfo }) {
  const { t } = useTranslation()
  const save = useSaveSettings([['me']])
  const [value, setValue] = useState(info.customUrl ? info.url : '')
  const changed = value.trim() !== (info.customUrl ? info.url : '')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate({ sources: { [info.id]: { url: value.trim() || null } } })
  }
  return (
    <form onSubmit={submit}>
      <Field label={t('admin.sources.url')}>
        <div className="flex gap-2">
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={info.defaultUrl} className="h-8 font-mono text-[0.8125rem]" inputMode="url" />
          {changed ? (
            <Button type="submit" size="sm" variant="secondary" loading={save.isPending}>
              {t('common.save')}
            </Button>
          ) : info.customUrl ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => save.mutate({ sources: { [info.id]: { url: null } } })}>
              {t('admin.sources.reset')}
            </Button>
          ) : null}
        </div>
      </Field>
    </form>
  )
}

export function Anime365Extras({ settings }: { settings: AdminSettings }) {
  const { t } = useTranslation()
  const save = useSaveSettings([['me']])
  return (
    <Field
      label={t('admin.globalToken')}
      hint={<Trans i18nKey="admin.globalTokenHint" components={{ code: <Code /> }} />}
    >
      <SecretForm
        placeholder="access_token"
        isSet={settings.hasAnime365Token}
        pending={save.isPending}
        onSave={(v) => save.mutate({ anime365Token: v })}
        onClear={() => save.mutate({ anime365Token: null })}
      />
      {settings.hasAnime365Token ? null : <p className="text-xs text-danger">{t('admin.globalTokenMissing')}</p>}
    </Field>
  )
}

export function KodikExtras({ settings }: { settings: AdminSettings }) {
  const { t } = useTranslation()
  const save = useSaveSettings([['admin', 'providers'], ['video-providers']])
  return (
    <Field label={t('admin.kodikToken')} hint={<Trans i18nKey="admin.kodikTokenHint" components={{ code: <Code /> }} />}>
      <SecretForm
        placeholder="token"
        isSet={settings.hasKodikToken}
        pending={save.isPending}
        onSave={(v) => save.mutate({ kodikToken: v })}
        onClear={() => save.mutate({ kodikToken: null })}
      />
      {settings.hasKodikToken ? null : <p className="text-xs text-danger">{t('admin.kodikTokenMissing')}</p>}
    </Field>
  )
}

export function GithubExtras({ settings }: { settings: AdminSettings }) {
  const { t } = useTranslation()
  const save = useSaveSettings([['version']])
  const [repo, setRepo] = useState(settings.github.repo)
  const [branch, setBranch] = useState(settings.github.branch)
  const changed = repo.trim() !== settings.github.repo || branch.trim() !== settings.github.branch
  return (
    <>
      <form
        className="grid grid-cols-[minmax(0,1fr)_minmax(0,7rem)] items-end gap-2 [&>button]:col-span-2 [&>button]:justify-self-start"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate({
            github: {
              repo: repo.trim() === settings.github.defaultRepo ? null : repo.trim() || null,
              branch: branch.trim() === settings.github.defaultBranch ? null : branch.trim() || null,
            },
          })
        }}
      >
        <Field label={t('admin.sources.repo')}>
          <Input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder={settings.github.defaultRepo} className="h-8 font-mono text-[0.8125rem]" />
        </Field>
        <Field label={t('admin.sources.branch')}>
          <Input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder={settings.github.defaultBranch} className="h-8 font-mono text-[0.8125rem]" />
        </Field>
        <Button type="submit" size="sm" variant="secondary" disabled={!changed} loading={save.isPending}>
          {t('common.save')}
        </Button>
      </form>
      <Field
        label={t('admin.sources.token')}
        hint={t('admin.sources.tokenHint')}
      >
        <SecretForm
          placeholder="github_pat_…"
          isSet={settings.github.hasToken}
          pending={save.isPending}
          onSave={(v) => save.mutate({ github: { token: v } })}
          onClear={() => save.mutate({ github: { token: null } })}
        />
      </Field>
    </>
  )
}

function CardSkeletonHeader({ control }: { control: string }) {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="size-9 shrink-0 rounded-lg" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className="h-4 w-28 rounded-md" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className={control} />
    </div>
  )
}

function FieldSkeleton() {
  return (
    <div className="flex flex-col gap-1.5">
      <Skeleton className="h-3 w-24 rounded-md" />
      <Skeleton className="h-8 w-full rounded-lg" />
    </div>
  )
}

function OAuthProviderSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl bg-field/50 p-3 sm:p-4">
      <CardSkeletonHeader control="hidden" />
      <FieldSkeleton />
      <FieldSkeleton />
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-3 w-28 rounded-md" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    </div>
  )
}

const CHECK_POLL_MS = 2000
const CHECK_POLL_LIMIT_MS = 60_000
let checkingSince: number | null = null

function checkPollInterval(settings: AdminSettings | undefined): number | false {
  if (!settings?.sources.some((s) => s.enabled && s.reachable === null)) {
    checkingSince = null
    return false
  }
  checkingSince ??= Date.now()
  return Date.now() - checkingSince < CHECK_POLL_LIMIT_MS ? CHECK_POLL_MS : false
}

export function useAdminSettings() {
  return useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: api.admin.settings,
    refetchInterval: (query) => checkPollInterval(query.state.data),
  })
}

function OAuthProvider({ provider, settings }: { provider: ImportProvider; settings: AdminSettings }) {
  const { t } = useTranslation()
  const info = settings.oauth[provider]
  const save = useSaveSettings([['import-status']])
  const [clientId, setClientId] = useState(info.clientId)
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl bg-field/50 p-3 sm:p-4">
      <div className="flex items-center gap-3">
        <ProviderIcon provider={provider} />
        <div className="min-w-0 flex-1">
          <div className="font-medium">{PROVIDER_NAMES[provider]}</div>
          <div className="mt-0.5 flex flex-wrap gap-1">
            <Badge variant={info.configured ? 'success' : 'neutral'}>
              <StatusDot tone={info.configured ? 'success' : 'neutral'} />
              {info.configured ? t('admin.oauthKeys.configured') : t('admin.oauthKeys.missing')}
            </Badge>
            {info.fromEnv ? <Badge variant="neutral">{t('admin.oauthKeys.fromEnv')}</Badge> : null}
          </div>
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate({ oauth: { [provider]: { clientId: clientId.trim() || null } } })
        }}
      >
        <Field label={t('admin.oauthKeys.clientId')}>
          <div className="flex gap-2">
            <Input value={clientId} onChange={(e) => setClientId(e.target.value)} className="h-8 font-mono text-[0.8125rem]" autoComplete="off" />
            {clientId.trim() !== info.clientId ? (
              <Button type="submit" size="sm" variant="secondary" loading={save.isPending}>
                {t('common.save')}
              </Button>
            ) : null}
          </div>
        </Field>
      </form>
      <Field label={t('admin.oauthKeys.clientSecret')}>
        <SecretForm
          placeholder="client_secret"
          isSet={info.hasSecret}
          fromEnv={info.fromEnv}
          pending={save.isPending}
          onSave={(v) => save.mutate({ oauth: { [provider]: { clientSecret: v } } })}
          onClear={() => save.mutate({ oauth: { [provider]: { clientSecret: null } } })}
        />
      </Field>
      <div>
        <div className="mb-1 text-xs font-medium text-subtle-foreground">{t('admin.oauthKeys.redirect')}</div>
        <Code className="block break-all px-2.5 py-2 text-xs leading-relaxed">{info.redirectUri}</Code>
      </div>
    </div>
  )
}

export function OAuthSettings() {
  const { t } = useTranslation()
  const { data } = useAdminSettings()
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <RiKey2Fill className="size-4 text-muted-foreground" />
            {t('admin.oauthKeys.title')}
          </CardTitle>
          <CardDescription>
            <Trans i18nKey="admin.oauthKeys.hint" components={{ code: <Code /> }} />
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))] gap-3 [&>*]:min-w-0">
        {data
          ? IMPORT_PROVIDERS.map((p) => <OAuthProvider key={`${p}|${data.oauth[p].clientId}`} provider={p} settings={data} />)
          : IMPORT_PROVIDERS.map((p) => <OAuthProviderSkeleton key={p} />)}
      </CardContent>
    </Card>
  )
}
