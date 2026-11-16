import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type AdminSettings, type DataSourceInfo, FEATURES, FEATURE_SOURCES, type FeatureId, type ExtensionInfo, type ProviderEntryInfo, type ProviderGroup, type ProvidersSettings } from '@yoru/shared'
import { Badge, Button, Code, Dialog, DialogContent, DialogTrigger, Field, Input, Skeleton, StatusDot, Switch, Textarea, Tooltip, cn, toast } from '@yoru/ui'
import { DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { RiAddFill, RiDeleteBin6Fill, RiDraggable, RiExternalLinkLine, RiPuzzle2Fill, RiRefreshLine, RiSettings3Fill } from '@remixicon/react'
import { type ReactNode, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { errorMessage, optimistic } from '../lib/queries'
import { formatDate } from '../lib/format'
import { Anime365Extras, GithubExtras, KodikExtras, SourceStatus, UrlField, useAdminSettings, useSaveSettings } from './admin-sources'
import { SecretForm } from './secret-form'
import { SOURCE_NAMES, SourceIcon } from './source-logo'
import { restrictToVertical } from './layout-settings'
import { Group } from './admin-group'
import { ReleasesSection } from './release-status'

const PROVIDERS_KEY = ['admin', 'providers']
const EXTENSIONS_KEY = ['admin', 'extensions']

function ExtensionMark() {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent [&_svg]:size-[1.125rem]">
      <RiPuzzle2Fill />
    </span>
  )
}

function EntryIcon({ entry }: { entry: ProviderEntryInfo }) {
  if (entry.source) return <SourceIcon id={entry.source} />
  return <ExtensionMark />
}

function SettingsButton({ title, icon, status, children }: { title: string; icon: ReactNode; status?: ReactNode; children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <Dialog>
      <Tooltip content={t('admin.sources.settings')}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t('admin.sources.settings')}>
            <RiSettings3Fill />
          </Button>
        </DialogTrigger>
      </Tooltip>
      <DialogContent
        title={
          <span className="flex items-center gap-3">
            {icon}
            <span className="flex min-w-0 flex-col items-start gap-1">
              {title}
              {status}
            </span>
          </span>
        }
        className="w-[min(92vw,34rem)]"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          if (e.currentTarget instanceof HTMLElement) e.currentTarget.focus()
        }}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex flex-col gap-5 px-6 pb-6 pt-2">{children}</div>
      </DialogContent>
    </Dialog>
  )
}

function SourceSettings({ info, settings }: { info: DataSourceInfo; settings: AdminSettings }) {
  const { t } = useTranslation()
  const uses = t(`admin.sources.${info.id}`, { returnObjects: true }) as unknown as string[]
  return (
    <>
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
      </div>
      <div className="flex flex-col gap-1.5">
        <UrlField key={`${info.url}|${info.customUrl}`} info={info} />
        <p className="text-xs text-muted-foreground">
          <Trans i18nKey="admin.sources.envHint" components={{ code: <Code /> }} />
        </p>
      </div>
      {info.id === 'anime365' ? <Anime365Extras settings={settings} /> : null}
      {info.id === 'kodik' ? <KodikExtras settings={settings} /> : null}
      {info.id === 'github' ? <GithubExtras key={`${settings.github.repo}|${settings.github.branch}`} settings={settings} /> : null}
    </>
  )
}

function OffBadge() {
  const { t } = useTranslation()
  return (
    <Badge variant="neutral" className="shrink-0">
      {t('admin.sources.off')}
    </Badge>
  )
}

function ExtensionBadge({ extension, active }: { extension: ExtensionInfo | undefined; active: boolean }) {
  const { t } = useTranslation()
  if (active && extension?.lastError) {
    return (
      <Tooltip content={extension.lastError}>
        <Badge size="sm" variant="danger">
          <StatusDot tone="danger" />
          {t('admin.sources.failing')}
        </Badge>
      </Tooltip>
    )
  }
  return (
    <Badge size="sm" variant="accent">
      {t('admin.sources.extension')}
    </Badge>
  )
}

function ChainRow({
  entry,
  index,
  info,
  extension,
  settings,
  onToggle,
}: {
  entry: ProviderEntryInfo
  index: number
  info: DataSourceInfo | undefined
  extension: ExtensionInfo | undefined
  settings: AdminSettings | undefined
  onToggle: (enabled: boolean) => void
}) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id })
  const roles = entry.roles.filter((r) => r !== 'video').map((r) => t(`admin.sources.roles.${r}`))
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('relative flex items-center gap-3 rounded-lg bg-surface py-2 pl-1 pr-3', isDragging && 'z-10 bg-raised shadow-lg shadow-black/30')}
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
      <span className="w-4 shrink-0 text-center text-xs tabular-nums text-subtle-foreground">{index + 1}</span>
      <EntryIcon entry={entry} />
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-sm font-medium', !entry.enabled && 'text-muted-foreground')}>{entry.name}</span>
        <span className="mt-0.5 flex h-5 min-w-0 items-center gap-2 overflow-hidden">
          {entry.extension ? <ExtensionBadge extension={extension} active={entry.enabled} /> : null}
          {!entry.enabled ? <OffBadge /> : info && !entry.extension ? <SourceStatus info={info} /> : null}
          {roles.length ? <span className="min-w-0 truncate text-xs text-subtle-foreground">{roles.join(' · ')}</span> : null}
        </span>
      </span>
      {info && settings ? (
        <SettingsButton title={SOURCE_NAMES[info.id]} icon={<SourceIcon id={info.id} />} status={<SourceStatus info={info} />}>
          <SourceSettings info={info} settings={settings} />
        </SettingsButton>
      ) : extension ? (
        <ExtensionSettingsButton extension={extension} />
      ) : null}
      <Switch checked={entry.enabled} onCheckedChange={onToggle} />
    </div>
  )
}

function ChainSection({ group, entries: saved, settings, extensions }: { group: ProviderGroup; entries: ProviderEntryInfo[]; settings: AdminSettings | undefined; extensions: ExtensionInfo[] }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const [pending, setPending] = useState<ProviderEntryInfo[] | null>(null)
  if (pending && saved === pending) setPending(null)
  const entries = pending ?? saved
  const save = useMutation({
    mutationKey: [...PROVIDERS_KEY, group],
    scope: { id: `providers-${group}` },
    meta: optimistic,
    mutationFn: (next: ProviderEntryInfo[]) => api.admin.saveProviders(group, next.map(({ id, enabled }) => ({ id, enabled }))),
    onError: (e) => {
      toast.error(errorMessage(e, t))
      setPending(null)
      void client.invalidateQueries({ queryKey: PROVIDERS_KEY })
    },
    onSettled: () => {
      if (client.isMutating({ mutationKey: [...PROVIDERS_KEY, group] }) > 1) return
      for (const key of [PROVIDERS_KEY, ['admin', 'settings'], ['video-providers'], ['search'], ['genres'], ['me']]) void client.invalidateQueries({ queryKey: key })
    },
  })
  const apply = (next: ProviderEntryInfo[]) => {
    setPending(next)
    void client.cancelQueries({ queryKey: PROVIDERS_KEY })
    client.setQueryData<ProvidersSettings>(PROVIDERS_KEY, (prev) => (prev ? { ...prev, [group]: next } : prev))
    save.mutate(next)
  }
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = entries.findIndex((e) => e.id === active.id)
    const to = entries.findIndex((e) => e.id === over.id)
    if (from < 0 || to < 0) return
    apply(arrayMove(entries, from, to))
  }
  return (
    <Group title={t(`admin.sources.groups.${group}.title`)} hint={t(`admin.sources.groups.${group}.hint`)}>
      <div className="-mx-3 flex flex-col">
        <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVertical]} onDragEnd={onDragEnd}>
          <SortableContext items={entries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
            {entries.map((entry, index) => (
              <ChainRow
                key={entry.id}
                entry={entry}
                index={index}
                info={entry.source ? settings?.sources.find((s) => s.id === entry.source) : undefined}
                extension={entry.extension ? extensions.find((x) => x.id === entry.extension) : undefined}
                settings={settings}
                onToggle={(enabled) => apply(entries.map((e) => (e.id === entry.id ? { ...e, enabled } : e)))}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </Group>
  )
}

function FeatureRow({ id, info, settings }: { id: FeatureId; info: DataSourceInfo; settings: AdminSettings }) {
  const { t } = useTranslation()
  const save = useSaveSettings([['discover'], ['schedule'], ['home'], ['version'], ['me'], ['extras'], PROVIDERS_KEY])
  const enabled = settings.features[id]
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg py-2 pl-3 pr-3">
      <SourceIcon id={info.id} />
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-sm font-medium', !enabled && 'text-muted-foreground')}>{t(`admin.features.${id}.title`)}</span>
        <span className="mt-0.5 flex h-5 min-w-0 items-center gap-2 overflow-hidden">
          {enabled ? <SourceStatus info={info} /> : <OffBadge />}
          <span className="min-w-0 truncate text-xs text-subtle-foreground">
            {SOURCE_NAMES[info.id]} · {t(`admin.features.${id}.hint`)}
          </span>
        </span>
      </span>
      <SettingsButton title={SOURCE_NAMES[info.id]} icon={<SourceIcon id={info.id} />} status={<SourceStatus info={info} />}>
        <SourceSettings info={info} settings={settings} />
      </SettingsButton>
      <Switch checked={enabled} disabled={save.isPending} onCheckedChange={(next) => save.mutate({ features: { [id]: next } })} />
    </div>
  )
}

function FeaturesSection({ settings }: { settings: AdminSettings | undefined }) {
  const { t } = useTranslation()
  return (
    <Group title={t('admin.features.title')} hint={t('admin.features.hint')}>
      <div className="-mx-3 flex flex-col">
        {FEATURES.map((id) => {
          const info = settings?.sources.find((s) => s.id === FEATURE_SOURCES[id])
          return info && settings ? <FeatureRow key={id} id={id} info={info} settings={settings} /> : <Skeleton key={id} className="my-0.5 h-[4.125rem] rounded-lg" />
        })}
      </div>
    </Group>
  )
}

function useExtensionAction<T>(fn: (input: T) => Promise<unknown>, success?: (result: unknown) => string | null) {
  const { t } = useTranslation()
  const client = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (result) => {
      const message = success?.(result)
      if (message) toast.success(message)
    },
    onError: (e) => toast.error(errorMessage(e, t)),
    onSettled: () => {
      for (const key of [EXTENSIONS_KEY, PROVIDERS_KEY, ['video-providers']]) void client.invalidateQueries({ queryKey: key })
    },
  })
}

function ExtensionSettingsForm({ extension }: { extension: ExtensionInfo }) {
  const { t } = useTranslation()
  const patch = useExtensionAction((settings: Record<string, string | null>) => api.admin.patchExtension(extension.id, { settings }), () => t('common.saved'))
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(extension.settings.filter((s) => s.field.type === 'text').map((s) => [s.field.key, s.value ?? ''])))
  if (!extension.settings.length) return null
  const text = extension.settings.filter((s) => s.field.type === 'text')
  const changed = text.some((s) => (values[s.field.key] ?? '') !== (s.value ?? ''))
  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs font-medium text-subtle-foreground">{t('admin.extensions.settings')}</div>
      {text.length ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            patch.mutate(Object.fromEntries(text.map((s) => [s.field.key, values[s.field.key]?.trim() || null])))
          }}
        >
          {text.map((s) => (
            <Field key={s.field.key} label={s.field.label}>
              <Input value={values[s.field.key] ?? ''} onChange={(e) => setValues({ ...values, [s.field.key]: e.target.value })} className="h-8 text-[0.8125rem]" />
            </Field>
          ))}
          <Button type="submit" size="sm" variant="secondary" className="self-start" disabled={!changed} loading={patch.isPending}>
            {t('common.save')}
          </Button>
        </form>
      ) : null}
      {extension.settings
        .filter((s) => s.field.type === 'password')
        .map((s) => (
          <Field key={s.field.key} label={s.field.label}>
            <SecretForm
              placeholder={s.field.label}
              isSet={s.set}
              pending={patch.isPending}
              onSave={(v) => patch.mutate({ [s.field.key]: v })}
              onClear={() => patch.mutate({ [s.field.key]: null })}
            />
          </Field>
        ))}
    </div>
  )
}

function ExtensionDetails({ extension }: { extension: ExtensionInfo }) {
  const { t } = useTranslation()
  const update = useExtensionAction(
    () => api.admin.updateExtension(extension.id),
    (result) => {
      const r = result as { updated: boolean; version: string }
      return r.updated ? t('admin.extensions.updated', { version: r.version }) : t('admin.extensions.upToDate')
    },
  )
  const remove = useExtensionAction(() => api.admin.deleteExtension(extension.id), () => t('admin.extensions.removed'))
  const meta = [t('admin.extensions.version', { version: extension.version }), t(`admin.extensions.types.${extension.type}`), extension.author ? t('admin.extensions.author', { author: extension.author }) : null].filter(Boolean)
  return (
    <>
      <div className="flex flex-col gap-1">
        <div className="text-[0.8125rem] text-muted-foreground">{meta.join(' · ')}</div>
        {extension.description ? <p className="text-sm">{extension.description}</p> : null}
        {extension.manifestUrl ? <Code className="mt-1 block break-all px-2.5 py-2 text-xs">{extension.manifestUrl}</Code> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={!extension.manifestUrl} loading={update.isPending} onClick={() => update.mutate(undefined)}>
          <RiRefreshLine />
          {extension.manifestUrl ? t('admin.extensions.checkUpdate') : t('admin.extensions.noUpdateUrl')}
        </Button>
        <Button size="sm" variant="danger" loading={remove.isPending} onClick={() => remove.mutate(undefined)}>
          <RiDeleteBin6Fill />
          {t('admin.extensions.remove')}
        </Button>
      </div>
      <ExtensionSettingsForm key={extension.updatedAt} extension={extension} />
      {extension.lastError ? (
        <div className="rounded-lg bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger">
          <div className="font-medium">{t('admin.extensions.lastError')}</div>
          <div className="mt-0.5 break-words">{extension.lastError}</div>
        </div>
      ) : null}
      <div>
        <div className="mb-1 text-xs font-medium text-subtle-foreground">{t('admin.extensions.logs')}</div>
        {extension.logs.length ? (
          <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto rounded-lg bg-inset p-2 font-mono text-[0.6875rem] leading-relaxed">
            {extension.logs.map((log, i) => (
              <div key={i} className={cn('break-words', log.level === 'error' ? 'text-danger' : log.level === 'warn' ? 'text-warning' : 'text-muted-foreground')}>
                <span className="text-subtle-foreground">{formatDate(log.at, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span> {log.line}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[0.8125rem] text-muted-foreground">{t('admin.extensions.noLogs')}</p>
        )}
      </div>
    </>
  )
}

function ExtensionSettingsButton({ extension }: { extension: ExtensionInfo }) {
  return (
    <SettingsButton title={extension.name} icon={<ExtensionMark />} status={<ExtensionBadge extension={extension} active={extension.enabled} />}>
      <ExtensionDetails extension={extension} />
    </SettingsButton>
  )
}

function InstallForm() {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const manifest = value.trimStart().startsWith('{')
  const install = useExtensionAction(
    (body: { url?: string; manifest?: string }) => api.admin.installExtension(body),
    () => {
      setValue('')
      return t('admin.extensions.installed')
    },
  )
  const submit = (
    <Button type="submit" variant="accent" className={cn(manifest && 'self-start')} disabled={!value.trim()} loading={install.isPending}>
      <RiAddFill />
      {t('admin.extensions.install')}
    </Button>
  )
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (!value.trim()) return
        install.mutate(manifest ? { manifest: value } : { url: value.trim() })
      }}
    >
      {manifest ? (
        <>
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
            className="min-h-40 font-mono text-[0.8125rem]"
          />
          {submit}
        </>
      ) : (
        <div className="flex gap-2">
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={t('admin.extensions.url')} className="h-9 font-mono text-[0.8125rem]" />
          {submit}
        </div>
      )}
    </form>
  )
}

function ExtensionDocs({ settings }: { settings: AdminSettings | undefined }) {
  const { t } = useTranslation()
  const repo = settings?.github.repo || settings?.github.defaultRepo
  if (!repo) return null
  const base = `https://github.com/${repo}/tree/${settings?.github.branch || settings?.github.defaultBranch || 'master'}/docs/extensions`
  const link = (href: string, label: string) => (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
      {label}
      <RiExternalLinkLine className="size-3.5" />
    </a>
  )
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem]">
      {link(base, t('admin.extensions.docs'))}
      {link(`${base}/examples`, t('admin.extensions.examples'))}
    </p>
  )
}

function ExtensionRow({ extension }: { extension: ExtensionInfo }) {
  const { t } = useTranslation()
  const toggle = useExtensionAction((enabled: boolean) => api.admin.patchExtension(extension.id, { enabled }))
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg py-2 pl-3 pr-3">
      <ExtensionMark />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={cn('truncate text-sm font-medium', !extension.enabled && 'text-muted-foreground')}>{extension.name}</span>
          <ExtensionBadge extension={extension} active={extension.enabled} />
          {extension.enabled ? null : <OffBadge />}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {[t('admin.extensions.version', { version: extension.version }), t(`admin.extensions.types.${extension.type}`), formatDate(extension.updatedAt)].join(' · ')}
        </span>
      </span>
      <ExtensionSettingsButton extension={extension} />
      <Switch checked={extension.enabled} disabled={toggle.isPending} onCheckedChange={(enabled) => toggle.mutate(enabled)} />
    </div>
  )
}

function ChainSkeleton({ group, rows }: { group: ProviderGroup; rows: number }) {
  const { t } = useTranslation()
  return (
    <Group title={t(`admin.sources.groups.${group}.title`)} hint={t(`admin.sources.groups.${group}.hint`)}>
      <div className="-mx-3 flex flex-col">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="my-0.5 h-[4.125rem] rounded-lg" />
        ))}
      </div>
    </Group>
  )
}

export function DataSources() {
  const { t } = useTranslation()
  const settings = useAdminSettings()
  const providers = useQuery({ queryKey: PROVIDERS_KEY, queryFn: api.admin.providers })
  const extensions = useQuery({ queryKey: EXTENSIONS_KEY, queryFn: api.admin.extensions })
  const installed = extensions.data ?? []
  return (
    <div className="flex flex-col gap-4">
      {providers.data ? (
        <>
          <ChainSection group="primary" entries={providers.data.primary} settings={settings.data} extensions={installed} />
          <ChainSection group="video" entries={providers.data.video} settings={settings.data} extensions={installed} />
        </>
      ) : (
        <>
          <ChainSkeleton group="primary" rows={3} />
          <ChainSkeleton group="video" rows={2} />
        </>
      )}
      <FeaturesSection settings={settings.data} />
      <ReleasesSection settings={settings.data} providers={providers.data} />
      <Group title={t('admin.extensions.title')} hint={t('admin.extensions.hint')}>
        <InstallForm />
        <ExtensionDocs settings={settings.data} />
        {extensions.isPending ? (
          <Skeleton className="h-[3.25rem] rounded-lg" />
        ) : installed.length ? (
          <div className="-mx-3 flex flex-col">
            {installed.map((extension) => (
              <ExtensionRow key={extension.id} extension={extension} />
            ))}
          </div>
        ) : (
          <p className="text-[0.8125rem] text-muted-foreground">{t('admin.extensions.empty')}</p>
        )}
      </Group>
    </div>
  )
}
