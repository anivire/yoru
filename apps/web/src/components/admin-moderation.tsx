import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AnimeSummary, UserCard } from '@yoru/shared'
import { Button, Card, EmptyState, Segmented, Skeleton, toast } from '@yoru/ui'
import { RiChat3Fill, RiDeleteBin6Line, RiIdCardFill, RiStickyNoteFill } from '@remixicon/react'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { AnimeTitle } from '../lib/anime-title'
import { relativeTime } from '../lib/format'
import { errorMessage } from '../lib/queries'
import { TLink } from './transition-link'
import { UserAvatar, nameOf } from './user-avatar'

type View = 'comments' | 'notes' | 'profiles'

function Row({ user, anime, createdAt, children, actions }: { user: UserCard; anime?: AnimeSummary | null; createdAt: string; children: ReactNode; actions: ReactNode }) {
  return (
    <div className="flex gap-3 px-5 py-3">
      <TLink to={`/u/${user.username}`} className="shrink-0">
        <UserAvatar user={user} className="size-8 text-xs" />
      </TLink>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 text-[0.8125rem]">
          <TLink to={`/u/${user.username}`} className="font-semibold transition-colors hover:text-accent">
            {nameOf(user)}
          </TLink>
          <span className="text-subtle-foreground">@{user.username}</span>
          {anime ? (
            <TLink to={`/anime/${anime.malId}`} className="min-w-0 truncate text-muted-foreground transition-colors hover:text-foreground">
              <AnimeTitle anime={anime} />
            </TLink>
          ) : null}
          <span className="text-xs text-subtle-foreground">{relativeTime(createdAt)}</span>
        </div>
        <div className="mt-0.5 whitespace-pre-line break-words text-sm">{children}</div>
      </div>
      <div className="flex shrink-0 items-start gap-1">{actions}</div>
    </div>
  )
}

function useRefresh(view: View) {
  const client = useQueryClient()
  return () => void client.invalidateQueries({ queryKey: ['admin', 'moderation', view] })
}

function DeleteButton({ onClick, pending, label }: { onClick: () => void; pending: boolean; label: string }) {
  return (
    <Button size="icon-sm" variant="ghost" className="hover:text-danger" aria-label={label} title={label} loading={pending} onClick={onClick}>
      <RiDeleteBin6Line />
    </Button>
  )
}

function Comments() {
  const { t } = useTranslation()
  const refresh = useRefresh('comments')
  const list = useQuery({ queryKey: ['admin', 'moderation', 'comments'], queryFn: api.moderationComments })
  const remove = useMutation({ mutationFn: api.moderateDeleteComment, onSuccess: refresh, onError: (e) => toast.error(errorMessage(e, t)) })
  if (list.isPending) return <Skeleton className="m-5 h-24 rounded-xl" />
  if (!list.data?.length) return <EmptyState mood="sleepy" title={t('moderation.emptyComments')} />
  return list.data.map((item) => (
    <Row key={item.id} user={item.user} anime={item.anime} createdAt={item.createdAt} actions={<DeleteButton label={t('notes.delete')} pending={remove.isPending && remove.variables === item.id} onClick={() => remove.mutate(item.id)} />}>
      {item.text}
    </Row>
  ))
}

function Notes() {
  const { t } = useTranslation()
  const refresh = useRefresh('notes')
  const list = useQuery({ queryKey: ['admin', 'moderation', 'notes'], queryFn: api.moderationNotes })
  const remove = useMutation({ mutationFn: api.moderateDeleteNote, onSuccess: refresh, onError: (e) => toast.error(errorMessage(e, t)) })
  if (list.isPending) return <Skeleton className="m-5 h-24 rounded-xl" />
  if (!list.data?.length) return <EmptyState mood="sleepy" title={t('moderation.emptyNotes')} />
  return list.data.map((item) => (
    <Row key={item.id} user={item.user} anime={item.anime} createdAt={item.createdAt} actions={<DeleteButton label={t('notes.delete')} pending={remove.isPending && remove.variables === item.id} onClick={() => remove.mutate(item.id)} />}>
      <span className="line-clamp-4">{item.text}</span>
    </Row>
  ))
}

function Profiles() {
  const { t } = useTranslation()
  const refresh = useRefresh('profiles')
  const list = useQuery({ queryKey: ['admin', 'moderation', 'profiles'], queryFn: api.moderationProfiles })
  const reset = useMutation({
    mutationFn: ({ id, body }: { id: number; body: { avatar?: boolean; bio?: boolean; displayName?: boolean } }) => api.moderateUser(id, body),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e, t)),
  })
  if (list.isPending) return <Skeleton className="m-5 h-24 rounded-xl" />
  if (!list.data?.length) return <EmptyState mood="sleepy" title={t('moderation.emptyProfiles')} />
  return list.data.map((item) => (
    <Row
      key={item.user.id}
      user={item.user}
      createdAt={item.createdAt}
      actions={
        <div className="flex flex-wrap justify-end gap-1">
          {item.user.avatarUrl ? (
            <Button size="sm" variant="ghost" onClick={() => reset.mutate({ id: item.user.id, body: { avatar: true } })}>
              {t('profile.moderate.avatar')}
            </Button>
          ) : null}
          {item.user.displayName ? (
            <Button size="sm" variant="ghost" onClick={() => reset.mutate({ id: item.user.id, body: { displayName: true } })}>
              {t('profile.moderate.displayName')}
            </Button>
          ) : null}
          {item.bio ? (
            <Button size="sm" variant="ghost" onClick={() => reset.mutate({ id: item.user.id, body: { bio: true } })}>
              {t('profile.moderate.bio')}
            </Button>
          ) : null}
        </div>
      }
    >
      {item.bio ? <span className="text-muted-foreground">{item.bio}</span> : null}
    </Row>
  ))
}

export function Moderation() {
  const { t } = useTranslation()
  const [view, setView] = useState<View>('comments')
  return (
    <div className="flex flex-col gap-4">
      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: 'comments', label: t('moderation.comments'), icon: <RiChat3Fill /> },
          { value: 'notes', label: t('moderation.notes'), icon: <RiStickyNoteFill /> },
          { value: 'profiles', label: t('moderation.profiles'), icon: <RiIdCardFill /> },
        ]}
      />
      <p className="text-sm text-muted-foreground">{t(`moderation.${view}Hint`)}</p>
      <Card className="flex flex-col divide-y divide-border py-1">
        {view === 'comments' ? <Comments /> : view === 'notes' ? <Notes /> : <Profiles />}
      </Card>
    </div>
  )
}
