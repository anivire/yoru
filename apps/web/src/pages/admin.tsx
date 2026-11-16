import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Invite } from '@yoru/shared'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Popover,
  Segmented,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
  Select,
  Skeleton,
  StatusDot,
  toast,
} from '@yoru/ui'
import { RiAddFill, RiDatabase2Fill, RiDeleteBin6Fill, RiFileCopyFill, RiGroupFill, RiKey2Fill, RiShieldUserFill, RiTicket2Fill } from '@remixicon/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { DataSources, OAuthSettings } from '../components/admin-sources'
import { Moderation } from '../components/admin-moderation'
import { TLink } from '../components/transition-link'
import { UserAvatar, nameOf } from '../components/user-avatar'
import { Page, PageHeader } from '../components/app-shell'
import { api } from '../lib/api'
import { formatDate } from '../lib/format'
import { useUser } from '../lib/queries'
import { useDocumentTitle } from '../lib/title'

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
          <RiDeleteBin6Fill />
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
          <Button type="submit" variant="accent" loading={create.isPending}>
            <RiAddFill />
            {t('admin.createInvite')}
          </Button>
        </form>
        <div className="flex flex-col gap-1">
          {!invites.data?.length ? (
            invites.isPending ? (
              <Skeleton className="h-14" />
            ) : (
              <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
                <RiTicket2Fill className="size-5 text-subtle-foreground" />
                {t('admin.noInvites')}
              </div>
            )
          ) : (
            invites.data.map((invite) => {
              const state = inviteState(invite)
              const link = `${location.origin}/invite/${invite.code}`
              const tone = state === 'active' ? 'success' : state === 'used' ? 'neutral' : 'danger'
              const badge = (
                <Badge size="sm" variant={tone} className="max-w-full">
                  <span className="truncate">{state === 'used' ? t('admin.used', { user: invite.usedBy ?? '?' }) : t(`admin.${state}`)}</span>
                </Badge>
              )
              return (
                <div key={invite.id} className="flex items-start gap-3 rounded-lg bg-field px-4 py-3 sm:items-center">
                  <span className="flex h-5 shrink-0 items-center">
                    <StatusDot tone={tone} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-[0.8125rem]">{link}</div>
                    <div className="text-xs text-muted-foreground">
                      {[
                        invite.note,
                        t('admin.createdOn', { date: formatDate(invite.createdAt) }),
                        invite.expiresAt ? t('admin.validUntil', { date: formatDate(invite.expiresAt) }) : t('admin.noExpiry'),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                    <div className="mt-1.5 sm:hidden">{badge}</div>
                  </div>
                  <div className="hidden shrink-0 sm:block">{badge}</div>
                  {state === 'active' ? (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={t('common.copy')}
                      onClick={() => void navigator.clipboard?.writeText(link).then(() => toast.success(t('common.copied')))}
                    >
                      <RiFileCopyFill />
                    </Button>
                  ) : null}
                  <Button size="icon-sm" variant="ghost" aria-label={t('common.delete')} onClick={() => remove.mutate(invite.id)}>
                    <RiDeleteBin6Fill />
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
            <TLink to={`/u/${u.username}`} className="shrink-0">
              <UserAvatar user={u} className="size-8 text-[0.8125rem]" />
            </TLink>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <TLink to={`/u/${u.username}`} className="truncate transition-colors hover:text-accent">
                  {nameOf(u)}
                </TLink>
                {u.displayName ? <span className="truncate text-xs font-normal text-subtle-foreground">@{u.username}</span> : null}
                {u.role === 'admin' ? (
                  <Badge size="sm" variant="accent">
                    admin
                  </Badge>
                ) : null}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatDate(u.createdAt)} · {u.entries} {t('admin.entries')} · {t('profile.friendsCount', { count: u.friends })} · {t('admin.commentsCount', { count: u.comments })}
              </div>
            </div>
            {u.id !== me.id ? <ConfirmDelete label={t('admin.deleteUser', { name: u.username })} onConfirm={() => remove.mutate(u.id)} /> : null}
          </div>
        ))}
      </div>
    </Card>
  )
}

const TABS = ['invites', 'users', 'moderation', 'sources', 'oauth'] as const
type Tab = (typeof TABS)[number]
const TAB_ICONS = { invites: RiTicket2Fill, users: RiGroupFill, moderation: RiShieldUserFill, sources: RiDatabase2Fill, oauth: RiKey2Fill } satisfies Record<Tab, unknown>
const TAB_LABELS = { invites: 'admin.invites', users: 'admin.users', moderation: 'admin.tabs.moderation', sources: 'admin.tabs.sources', oauth: 'admin.tabs.oauth' } as const satisfies Record<Tab, string>

export function AdminPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const tab: Tab = TABS.includes(raw as Tab) ? (raw as Tab) : 'invites'
  useDocumentTitle(`${t(TAB_LABELS[tab])} · ${t('admin.title')}`)
  return (
    <Page>
      <PageHeader title={t('admin.title')} />
      <Segmented
        value={tab}
        onChange={(v) => setParams(v === 'invites' ? {} : { tab: v }, { replace: true })}
        options={TABS.map((v) => {
          const Icon = TAB_ICONS[v]
          return { value: v, label: t(TAB_LABELS[v]), icon: <Icon /> }
        })}
        className="mb-8 grid w-full grid-cols-2 sm:inline-flex sm:w-auto"
      />
      <div key={tab} className="grow-empty animate-fade">
        {tab === 'invites' ? <Invites /> : null}
        {tab === 'users' ? <Users /> : null}
        {tab === 'moderation' ? <Moderation /> : null}
        {tab === 'sources' ? <DataSources /> : null}
        {tab === 'oauth' ? <OAuthSettings /> : null}
      </div>
    </Page>
  )
}
