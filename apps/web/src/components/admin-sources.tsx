import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type AdminSettings, type AdminSettingsInput, DATA_SOURCES, type DataSourceId, type DataSourceInfo, IMPORT_PROVIDERS, type ImportProvider } from '@yoru/shared'
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Code, Field, Input, Skeleton, Spinner, StatusDot, Switch, toast } from '@yoru/ui'
import { RiKey2Fill } from '@remixicon/react'
import { type FormEvent, type ReactNode, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { errorMessage } from '../lib/queries'
import { PROVIDER_NAMES, ProviderIcon } from './providers'
import { Anime365Mark } from './source-logo'

const SOURCE_NAMES: Record<DataSourceId, string> = { anime365: 'Anime365', jikan: 'Jikan', shikimori: 'Shikimori', anilist: 'AniList', aniskip: 'AniSkip', github: 'GitHub' }

function GithubMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-5">
      <path d="M10.226 17.284c-2.965-.36-5.054-2.493-5.054-5.256 0-1.123.404-2.336 1.078-3.144-.292-.741-.247-2.314.09-2.965.898-.112 2.111.36 2.83 1.01.853-.269 1.752-.404 2.853-.404 1.1 0 1.999.135 2.807.382.696-.629 1.932-1.1 2.83-.988.315.606.36 2.179.067 2.942.72.854 1.101 2 1.101 3.167 0 2.763-2.089 4.852-5.098 5.234.763.494 1.28 1.572 1.28 2.807v2.336c0 .674.561 1.056 1.235.786 4.066-1.55 7.255-5.615 7.255-10.646C23.5 6.188 18.334 1 11.978 1 5.62 1 .5 6.188.5 12.545c0 4.986 3.167 9.12 7.435 10.669.606.225 1.19-.18 1.19-.786V20.63a2.9 2.9 0 0 1-1.078.224c-1.483 0-2.359-.808-2.987-2.313-.247-.607-.517-.966-1.034-1.033-.27-.023-.359-.135-.359-.27 0-.27.45-.471.898-.471.652 0 1.213.404 1.797 1.235.45.651.921.943 1.483.943.561 0 .92-.202 1.437-.719.382-.381.674-.718.944-.943" />
    </svg>
  )
}

function SourceIcon({ id }: { id: DataSourceId }) {
  if (id === 'anime365') return <Anime365Mark />
  if (id === 'jikan') return <ProviderIcon provider="mal" />
  if (id === 'shikimori') return <ProviderIcon provider="shikimori" />
  if (id === 'anilist') return <ProviderIcon provider="anilist" />
  if (id === 'aniskip') {
    return (
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#d97706] text-white">
        <svg viewBox="0 0 24 24" aria-hidden className="size-[55%] translate-x-[6%]">
          <path d="M7 5.5v13L18 12Z" fill="currentColor" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
        </svg>
      </span>
    )
  }
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-inverse text-inverse-foreground">
      <GithubMark />
    </span>
  )
}

function useSaveSettings(extraKeys: string[][] = []) {
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

function SourceStatus({ info }: { info: DataSourceInfo }) {
  const { t } = useTranslation()
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
    <Badge variant={info.reachable ? 'success' : 'danger'}>
      <StatusDot tone={info.reachable ? 'success' : 'danger'} pulse={!info.reachable} />
      {info.reachable ? t('admin.reachable') : t('admin.unreachable')}
    </Badge>
  )
}

function UrlField({ info }: { info: DataSourceInfo }) {
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

export function SecretForm({
  placeholder,
  isSet,
  fromEnv = false,
  onSave,
  onClear,
  pending,
}: {
  placeholder: string
  isSet: boolean
  fromEnv?: boolean
  onSave: (v: string) => void
  onClear: () => void
  pending: boolean
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const [editing, setEditing] = useState(false)
  if (isSet && !editing) {
    return (
      <div className="flex gap-2">
        <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg bg-success-soft px-3 text-[0.8125rem] text-success">
          <RiKey2Fill className="size-3.5 shrink-0" />
          {fromEnv ? <span className="shrink-0 font-medium">{t('admin.secret.setEnv')}</span> : null}
          <span className="min-w-0 flex-1 overflow-hidden whitespace-nowrap font-mono text-lg leading-none tracking-[0.15em]" title={t('admin.secret.set')}>
            {"•".repeat(128)}
          </span>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(true)}>
          {t('admin.secret.replace')}
        </Button>
        {fromEnv ? null : (
          <Button type="button" size="sm" variant="ghost" onClick={onClear} loading={pending}>
            {t('common.delete')}
          </Button>
        )}
      </div>
    )
  }
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        onSave(value.trim())
        setValue('')
        setEditing(false)
      }}
    >
      <Input
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        autoComplete="new-password"
        autoFocus={editing}
        className="h-8 text-[0.8125rem]"
      />
      <Button type="submit" size="sm" variant="secondary" disabled={!value.trim()} loading={pending}>
        {t('common.save')}
      </Button>
      {editing ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setValue('')
            setEditing(false)
          }}
        >
          {t('common.cancel')}
        </Button>
      ) : null}
    </form>
  )
}

function Anime365Extras({ settings }: { settings: AdminSettings }) {
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

function GithubExtras({ settings }: { settings: AdminSettings }) {
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

function SourceCard({ info, settings }: { info: DataSourceInfo; settings: AdminSettings }) {
  const { t } = useTranslation()
  const save = useSaveSettings([['search'], ['genres'], ['discover'], ['schedule'], ['home'], ['version']])
  const uses = t(`admin.sources.${info.id}`, { returnObjects: true }) as unknown as string[]
  let extras: ReactNode = null
  if (info.id === 'anime365') extras = <Anime365Extras settings={settings} />
  if (info.id === 'github') extras = <GithubExtras key={`${settings.github.repo}|${settings.github.branch}`} settings={settings} />
  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-xl bg-field/50 p-3 sm:p-4">
      <div className="flex items-center gap-3">
        <SourceIcon id={info.id} />
        <div className="min-w-0 flex-1">
          <div className="font-medium">{SOURCE_NAMES[info.id]}</div>
          <div className="mt-0.5">
            <SourceStatus info={info} />
          </div>
        </div>
        {info.id === 'anime365' ? (
          <Badge variant="accent">{t('admin.sources.core')}</Badge>
        ) : (
          <Switch checked={info.enabled} disabled={save.isPending} onCheckedChange={(enabled) => save.mutate({ sources: { [info.id]: { enabled } } })} />
        )}
      </div>
      <div>
        <div className="mb-1 text-xs font-medium text-subtle-foreground">{t('admin.sources.usedFor')}</div>
        <ul className="flex flex-col gap-0.5 text-[0.8125rem] text-muted-foreground">
          {uses.map((u) => (
            <li key={u} className="flex gap-2">
              <span className="mt-[0.55em] size-1 shrink-0 rounded-full bg-subtle-foreground" />
              {u}
            </li>
          ))}
        </ul>
        {info.id === 'jikan' && !info.enabled ? <p className="mt-2 text-[0.8125rem] text-warning">{t('admin.sources.jikanOff')}</p> : null}
      </div>
      <UrlField key={`${info.url}|${info.customUrl}`} info={info} />
      {extras}
    </div>
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

function SourceCardSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-xl bg-field/50 p-3 sm:p-4">
      <CardSkeletonHeader control="h-5 w-9 shrink-0 rounded-full" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-20 rounded-md" />
        <Skeleton className="h-3.5 w-4/5 rounded-md" />
        <Skeleton className="h-3.5 w-3/5 rounded-md" />
        <Skeleton className="h-3.5 w-2/3 rounded-md" />
      </div>
      <FieldSkeleton />
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

function useAdminSettings() {
  return useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: api.admin.settings,
    refetchInterval: (query) => (query.state.data?.sources.some((s) => s.enabled && s.reachable === null) ? 2000 : false),
  })
}

export function DataSources() {
  const { t } = useTranslation()
  const { data } = useAdminSettings()
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t('admin.sources.title')}</CardTitle>
          <CardDescription>
            <Trans i18nKey="admin.sources.hint" components={{ code: <Code /> }} />
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] gap-3 [&>*]:min-w-0">
        {data
          ? data.sources.map((info) => <SourceCard key={info.id} info={info} settings={data} />)
          : DATA_SOURCES.map((id) => <SourceCardSkeleton key={id} />)}
      </CardContent>
    </Card>
  )
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
