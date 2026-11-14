import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IMPORT_PROVIDERS, type Invite, type MetadataSource } from '@yoru/shared'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Code,
  Field,
  Input,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
  Segmented,
  Select,
  Skeleton,
  Spinner,
  StatusDot,
  toast,
} from '@yoru/ui'
import { Copy, KeyRound, Plus, Ticket, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Page, PageHeader } from '../components/app-shell'
import { PROVIDER_NAMES } from '../components/providers'
import { api } from '../lib/api'
import { formatDate } from '../lib/format'
import { useUser } from '../lib/queries'

function inviteState(invite: Invite): 'used' | 'expired' | 'active' {
  if (invite.usedAt) return 'used'
  if (invite.expiresAt && Date.parse(invite.expiresAt) < Date.now()) return 'expired'
  return 'active'
}

function ConfirmDelete({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const { t } = useTranslation()
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t('common.delete')}>
          <Trash2 />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3">
        <p className="text-sm">{label}</p>
        <div className="mt-3 flex justify-end gap-2">
          <PopoverClose asChild>
            <Button size="sm" variant="ghost">
              {t('common.cancel')}
            </Button>
          </PopoverClose>
          <PopoverClose asChild>
            <Button size="sm" variant="danger" onClick={onConfirm}>
              {t('common.delete')}
            </Button>
          </PopoverClose>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function Invites() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const invites = useQuery({ queryKey: ['admin', 'invites'], queryFn: api.admin.invites })
  const [note, setNote] = useState('')
  const [days, setDays] = useState('7')
  const setData = (data: Invite[]) => client.setQueryData(['admin', 'invites'], data)
  const create = useMutation({
    mutationFn: () => api.admin.createInvite(note.trim() || null, days === 'never' ? null : Number(days)),
    onSuccess: (data) => {
      setData(data)
      setNote('')
      const link = `${location.origin}/invite/${data[0]?.code}`
      void navigator.clipboard?.writeText(link).then(() => toast.success(t('common.copied')))
    },
  })
  const remove = useMutation({ mutationFn: api.admin.deleteInvite, onSuccess: setData })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.invites')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form
          className="grid gap-2 sm:grid-cols-[1fr_10rem_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            create.mutate()
          }}
        >
          <Field label={t('admin.note')}>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('admin.notePlaceholder')} />
          </Field>
          <Field label={t('admin.expires')}>
            <Select
              value={days}
              onValueChange={setDays}
              options={[
                { value: '1', label: t('admin.days', { count: 1 }) },
                { value: '7', label: t('admin.days', { count: 7 }) },
                { value: '30', label: t('admin.days', { count: 30 }) },
                { value: 'never', label: t('admin.never') },
              ]}
            />
          </Field>
          <Button type="submit" variant="primary" loading={create.isPending}>
            <Plus />
            {t('admin.createInvite')}
          </Button>
        </form>
        <div className="flex flex-col gap-1">
          {!invites.data?.length ? (
            invites.isPending ? (
              <Skeleton className="h-14" />
            ) : (
              <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
                <Ticket className="size-5 text-subtle-foreground" />
                {t('admin.noInvites')}
              </div>
            )
          ) : (
            invites.data.map((invite) => {
              const state = inviteState(invite)
              const link = `${location.origin}/invite/${invite.code}`
              return (
                <div key={invite.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-field px-4 py-3">
                  <StatusDot tone={state === 'active' ? 'success' : state === 'used' ? 'neutral' : 'danger'} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-[13px]">{link}</div>
                    <div className="text-xs text-muted-foreground">
                      {[
                        invite.note,
                        t('admin.createdOn', { date: formatDate(invite.createdAt) }),
                        invite.expiresAt ? t('admin.validUntil', { date: formatDate(invite.expiresAt) }) : t('admin.noExpiry'),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                  <Badge size="sm" variant={state === 'active' ? 'success' : state === 'used' ? 'neutral' : 'danger'}>
                    {state === 'used' ? t('admin.used', { user: invite.usedBy ?? '?' }) : t(`admin.${state}`)}
                  </Badge>
                  {state === 'active' ? (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={t('common.copy')}
                      onClick={() => void navigator.clipboard?.writeText(link).then(() => toast.success(t('common.copied')))}
                    >
                      <Copy />
                    </Button>
                  ) : null}
                  <Button size="icon-sm" variant="ghost" aria-label={t('common.delete')} onClick={() => remove.mutate(invite.id)}>
                    <Trash2 />
                  </Button>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function Users() {
  const { t } = useTranslation()
  const me = useUser()
  const client = useQueryClient()
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: api.admin.users })
  const remove = useMutation({
    mutationFn: api.admin.deleteUser,
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.users')}</CardTitle>
      </CardHeader>
      <div className="flex flex-col pb-2">
        {users.isPending
          ? [0, 1].map((i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))
          : null}
        {users.data?.map((u) => (
          <div key={u.id} className="flex items-center gap-3 px-5 py-3">
            <span className="grid size-8 place-items-center rounded-full bg-field text-[13px] font-semibold uppercase">{u.username.slice(0, 1)}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                {u.username}
                {u.role === 'admin' ? (
                  <Badge size="sm" variant="accent">
                    admin
                  </Badge>
                ) : null}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatDate(u.createdAt)} · {u.entries} {t('admin.entries')}
              </div>
            </div>
            {u.id !== me.id ? <ConfirmDelete label={t('admin.deleteUser', { name: u.username })} onConfirm={() => remove.mutate(u.id)} /> : null}
          </div>
        ))}
      </div>
    </Card>
  )
}

function GlobalSettings() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const settings = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: api.admin.settings,
    refetchInterval: (query) => (query.state.data?.metadataSource === 'jikan' && query.state.data.jikanReachable === null ? 2000 : false),
  })
  const [token, setToken] = useState('')
  const save = useMutation({
    mutationFn: (value: string | null) => api.admin.saveSettings({ anime365Token: value }),
    onSuccess: () => {
      setToken('')
      toast.success(t('common.saved'))
      void client.invalidateQueries({ queryKey: ['admin', 'settings'] })
    },
  })
  const source = useMutation({
    mutationFn: (metadataSource: MetadataSource) => api.admin.saveSettings({ metadataSource }),
    onSuccess: () => {
      toast.success(t('common.saved'))
      void client.invalidateQueries({ queryKey: ['admin', 'settings'] })
      void client.invalidateQueries({ queryKey: ['search'] })
      void client.invalidateQueries({ queryKey: ['genres'] })
    },
  })
  const s = settings.data
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.global')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">{t('admin.globalToken')}</div>
              <CardDescription>
                <Trans i18nKey="admin.globalTokenHint" components={{ code: <Code /> }} />
              </CardDescription>
            </div>
            {!s ? (
              <Skeleton className="h-6 w-28 rounded-full" />
            ) : (
              <Badge variant={s.hasAnime365Token ? 'success' : 'warning'}>
                <KeyRound />
                {s.hasAnime365Token ? t('admin.tokenConfigured') : t('admin.tokenNotConfigured')}
              </Badge>
            )}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              save.mutate(token.trim())
            }}
          >
            <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="access_token" autoComplete="off" />
            <Button type="submit" variant="primary" disabled={!token.trim()} loading={save.isPending}>
              {t('common.save')}
            </Button>
            {s?.hasAnime365Token ? (
              <Button type="button" variant="ghost" onClick={() => save.mutate(null)}>
                {t('common.delete')}
              </Button>
            ) : null}
          </form>
        </div>
        <div>
          <div className="text-sm font-medium">{t('admin.oauth')}</div>
          <CardDescription>
            <Trans i18nKey="admin.oauthHint" values={{ url: `${location.origin}/api/import/{provider}/callback` }} components={{ code: <Code /> }} />
          </CardDescription>
          <div className="mt-3 flex flex-wrap gap-2">
            {IMPORT_PROVIDERS.map((p) => (
              <Badge key={p} variant={s?.importProviders[p] ? 'success' : 'neutral'}>
                <StatusDot tone={s?.importProviders[p] ? 'success' : 'neutral'} />
                {PROVIDER_NAMES[p]}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <div className="text-sm font-medium">{t('admin.source')}</div>
            <CardDescription>{t('admin.sourceHint')}</CardDescription>
          </div>
          {!s ? (
            <Skeleton className="h-10 w-56 rounded-xl" />
          ) : (
            <Segmented
              value={s.metadataSource}
              onChange={(v) => source.mutate(v)}
              options={[
                { value: 'jikan', label: 'Jikan' },
                { value: 'anime365', label: 'Anime365' },
              ]}
              className="self-start"
            />
          )}
        </div>
        {s?.metadataSource === 'anime365' ? null : (
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium">{t('admin.jikan')}</div>
            {!s ? (
              <Skeleton className="h-6 w-28 rounded-full" />
            ) : s.jikanReachable === null ? (
              <Badge variant="neutral">
                <Spinner />
                {t('admin.checking')}
              </Badge>
            ) : (
              <Badge variant={s.jikanReachable ? 'success' : 'warning'}>
                <StatusDot tone={s.jikanReachable ? 'success' : 'warning'} pulse={!s.jikanReachable} />
                {s.jikanReachable ? t('admin.reachable') : t('admin.unreachable')}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function AdminPage() {
  const { t } = useTranslation()
  return (
    <Page>
      <PageHeader title={t('admin.title')} />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <Invites />
        </div>
        <Users />
        <GlobalSettings />
      </div>
    </Page>
  )
}
