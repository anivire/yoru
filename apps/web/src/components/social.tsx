import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type Comment, type CommentTarget, REACTIONS, type Reaction, type ReactionCount, type UserCard } from '@yoru/shared'
import { Button, Dialog, DialogContent, DialogTrigger, Popover, PopoverContent, PopoverTrigger, Skeleton, StarIcon, Textarea, Tooltip, cn, toast } from '@yoru/ui'
import { RiChat3Line, RiDeleteBin6Line, RiEdit2Line, RiEmotionLine, RiSendPlaneFill, RiShareForwardFill, RiUserAddFill } from '@remixicon/react'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { relativeTime } from '../lib/format'
import { StatusIcon } from '../lib/list-status'
import { errorMessage } from '../lib/queries'
import { AnimeCard } from './anime-cards'
import { TLink } from './transition-link'
import { UserAvatar, nameOf } from './user-avatar'

const COMMENT_MAX = 1000

export function ReactionBar({ eventId, reactions, mine, comments, onComments, commentsOpen }: { eventId: number; reactions: ReactionCount[]; mine: Reaction | null; comments: number; onComments: () => void; commentsOpen: boolean }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const react = useMutation({
    mutationFn: (emoji: Reaction | null) => api.setReaction(eventId, emoji),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['feed'] }),
    onError: (e) => toast.error(errorMessage(e, t)),
  })
  const pick = (emoji: Reaction) => {
    setOpen(false)
    react.mutate(mine === emoji ? null : emoji)
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          aria-pressed={mine === r.emoji}
          onClick={() => pick(r.emoji)}
          className={cn('inline-flex h-7 cursor-pointer items-center gap-1 rounded-full px-2.5 text-sm transition-colors', mine === r.emoji ? 'bg-accent-soft text-accent' : 'bg-field hover:bg-field-hover')}
        >
          <span>{r.emoji}</span>
          <span className="font-mono text-xs tabular-nums">{r.count}</span>
        </button>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="icon-sm" variant="ghost" className="rounded-full" aria-label={t('social.react')} title={t('social.react')}>
            <RiEmotionLine />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="flex w-auto gap-1 p-1.5" align="start" side="top">
          {REACTIONS.map((emoji) => (
            <button key={emoji} type="button" onClick={() => pick(emoji)} className={cn('grid size-9 cursor-pointer place-items-center rounded-lg text-lg transition-colors hover:bg-muted', mine === emoji && 'bg-accent-soft')}>
              {emoji}
            </button>
          ))}
        </PopoverContent>
      </Popover>
      <Button size="sm" variant="ghost" className={cn('h-7 rounded-full px-2.5', commentsOpen && 'bg-muted')} onClick={onComments}>
        <RiChat3Line />
        {comments ? <span className="font-mono text-xs tabular-nums">{comments}</span> : t('social.comment')}
      </Button>
    </div>
  )
}

function CommentItem({ comment, onChanged }: { comment: Comment; onChanged: () => void }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(comment.text)
  const save = useMutation({
    mutationFn: () => api.editComment(comment.id, text.trim()),
    onSuccess: () => {
      setEditing(false)
      onChanged()
    },
    onError: (e) => toast.error(errorMessage(e, t)),
  })
  const remove = useMutation({ mutationFn: () => api.deleteComment(comment.id), onSuccess: onChanged, onError: (e) => toast.error(errorMessage(e, t)) })
  return (
    <li className="flex gap-2.5">
      <TLink to={`/u/${comment.user.username}`} className="shrink-0">
        <UserAvatar user={comment.user} className="size-7 text-xs" />
      </TLink>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <TLink to={`/u/${comment.user.username}`} className="truncate text-[0.8125rem] font-semibold transition-colors hover:text-accent">
            {nameOf(comment.user)}
          </TLink>
          <Tooltip content={new Date(comment.createdAt).toLocaleString()}>
            <span className="shrink-0 text-xs text-subtle-foreground">{relativeTime(comment.createdAt)}</span>
          </Tooltip>
          {!editing && (comment.canEdit || comment.canDelete) ? (
            <div className="ml-auto flex gap-0.5">
              {comment.canEdit ? (
                <Button size="icon-sm" variant="ghost" className="size-6" aria-label={t('notes.edit')} title={t('notes.edit')} onClick={() => setEditing(true)}>
                  <RiEdit2Line />
                </Button>
              ) : null}
              {comment.canDelete ? (
                <Button size="icon-sm" variant="ghost" className="size-6 hover:text-danger" aria-label={t('notes.delete')} title={t('notes.delete')} loading={remove.isPending} onClick={() => remove.mutate()}>
                  <RiDeleteBin6Line />
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        {editing ? (
          <div className="mt-1 flex flex-col gap-2">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={COMMENT_MAX} className="min-h-16" />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                {t('common.cancel')}
              </Button>
              <Button size="sm" variant="accent" disabled={!text.trim()} loading={save.isPending} onClick={() => save.mutate()}>
                {t('common.save')}
              </Button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-line break-words text-sm">{comment.text}</p>
        )}
      </div>
    </li>
  )
}

export function CommentThread({ target, id }: { target: CommentTarget; id: number }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [text, setText] = useState('')
  const thread = useQuery({ queryKey: ['comments', target, id], queryFn: () => api.comments(target, id) })
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['comments', target, id] })
    void client.invalidateQueries({ queryKey: ['feed'] })
    void client.invalidateQueries({ queryKey: ['notes'] })
  }
  const add = useMutation({
    mutationFn: () => api.addComment(target, id, text.trim()),
    onSuccess: () => {
      setText('')
      refresh()
    },
    onError: (e) => toast.error(errorMessage(e, t)),
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (text.trim()) add.mutate()
  }
  return (
    <div className="mt-3 flex flex-col gap-3 rounded-xl bg-surface p-3">
      {thread.isPending ? (
        <Skeleton className="h-10 rounded-lg" />
      ) : thread.data?.length ? (
        <ul className="flex flex-col gap-3">
          {thread.data.map((comment) => (
            <CommentItem key={comment.id} comment={comment} onChanged={refresh} />
          ))}
        </ul>
      ) : (
        <p className="text-[0.8125rem] text-muted-foreground">{t('social.noComments')}</p>
      )}
      <form onSubmit={submit} className="flex items-end gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(e)
          }}
          maxLength={COMMENT_MAX}
          placeholder={t('social.commentPlaceholder')}
          className="min-h-10 flex-1 resize-none py-2"
          rows={1}
        />
        <Button type="submit" size="icon" variant="accent" aria-label={t('social.send')} title={t('social.send')} disabled={!text.trim()} loading={add.isPending}>
          <RiSendPlaneFill />
        </Button>
      </form>
    </div>
  )
}

function FriendPicker({ selected, onChange }: { selected: number[]; onChange: (ids: number[]) => void }) {
  const { t } = useTranslation()
  const friends = useQuery({ queryKey: ['friends'], queryFn: api.friends })
  const toggle = (user: UserCard) => onChange(selected.includes(user.id) ? selected.filter((id) => id !== user.id) : [...selected, user.id])
  if (friends.isPending) return <Skeleton className="h-24 rounded-xl" />
  if (!friends.data?.friends.length) return <p className="text-sm text-muted-foreground">{t('social.noFriendsToRecommend')}</p>
  return (
    <div role="group" className="flex max-h-64 flex-col gap-1 overflow-y-auto">
      {friends.data.friends.map((user) => (
        <button
          key={user.id}
          type="button"
          role="checkbox"
          aria-checked={selected.includes(user.id)}
          onClick={() => toggle(user)}
          className={cn('flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors', selected.includes(user.id) ? 'bg-accent-soft' : 'hover:bg-muted')}
        >
          <UserAvatar user={user} className="size-8" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{nameOf(user)}</span>
          <span className={cn('size-4 rounded-full border-2', selected.includes(user.id) ? 'border-accent bg-accent' : 'border-border')} />
        </button>
      ))}
    </div>
  )
}

export function InviteFriendsButton({ roomId, className }: { roomId: string; className?: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const send = useMutation({
    mutationFn: () => api.inviteToRoom(roomId, selected),
    onSuccess: () => {
      toast.success(t('social.invited'))
      setOpen(false)
      setSelected([])
    },
    onError: (e) => toast.error(errorMessage(e, t)),
  })
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className={className}>
          <RiUserAddFill />
          {t('social.inviteFriends')}
        </Button>
      </DialogTrigger>
      <DialogContent title={t('social.inviteFriends')} description={t('social.inviteHint')}>
        <div className="flex flex-col gap-4 px-6 pb-6 pt-2">
          <FriendPicker selected={selected} onChange={setSelected} />
          <Button variant="accent" className="self-end" disabled={!selected.length} loading={send.isPending} onClick={() => send.mutate()}>
            <RiSendPlaneFill />
            {t('social.send')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function RecommendButton({ malId, className }: { malId: number; className?: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const [message, setMessage] = useState('')
  const send = useMutation({
    mutationFn: () => api.recommend({ malId, friendIds: selected, message: message.trim() || null }),
    onSuccess: () => {
      toast.success(t('social.recommended'))
      setOpen(false)
      setSelected([])
      setMessage('')
    },
    onError: (e) => toast.error(errorMessage(e, t)),
  })
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className={className}>
          <RiShareForwardFill />
          {t('social.recommend')}
        </Button>
      </DialogTrigger>
      <DialogContent title={t('social.recommend')} description={t('social.recommendHint')}>
        <div className="flex flex-col gap-4 px-6 pb-6 pt-2">
          <FriendPicker selected={selected} onChange={setSelected} />
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={300} placeholder={t('social.recommendMessage')} />
          <Button variant="accent" className="self-end" disabled={!selected.length} loading={send.isPending} onClick={() => send.mutate()}>
            <RiSendPlaneFill />
            {t('social.send')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function FriendsOnAnime({ malId, total }: { malId: number; total: number | null }) {
  const { t } = useTranslation()
  const entries = useQuery({ queryKey: ['friend-entries', malId], queryFn: () => api.friendEntries(malId) })
  if (!entries.data?.length) return null
  return (
    <section className="mt-10">
      <h2 className="mb-4 text-xl font-semibold tracking-tight">{t('social.friendsWatching')}</h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-2">
        {entries.data.map((entry) => (
          <TLink key={entry.user.id} to={`/u/${entry.user.username}`} className="flex items-center gap-3 rounded-xl bg-surface p-3 transition-colors hover:bg-muted">
            <UserAvatar user={entry.user} className="size-10" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{nameOf(entry.user)}</span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <StatusIcon status={entry.status} className="size-3.5" />
                {t(`status.${entry.status}`)}
                {entry.progress && entry.status !== 'completed' ? <span className="font-mono tabular-nums">{total ? `${entry.progress}/${total}` : entry.progress}</span> : null}
              </span>
            </span>
            {entry.score ? (
              <span className="inline-flex items-center gap-1 text-sm font-semibold tabular-nums">
                <StarIcon className="size-3.5 text-amber-500" />
                {entry.score}
              </span>
            ) : null}
          </TLink>
        ))}
      </div>
    </section>
  )
}

export function TasteMatchCard({ username }: { username: string }) {
  const { t } = useTranslation()
  const match = useQuery({ queryKey: ['profile', username, 'match'], queryFn: () => api.tasteMatch(username), retry: false })
  if (!match.data) return null
  const { percent, shared, suggestions } = match.data
  return (
    <section className="flex flex-col gap-5 rounded-xl bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-3xl font-semibold tabular-nums text-accent">{percent === null ? '—' : `${percent}%`}</span>
        <span className="text-sm font-medium">{t('social.tasteMatch')}</span>
        <span className="text-[0.8125rem] text-muted-foreground">{percent === null ? t('social.tasteMatchFew') : t('social.sharedTitles', { count: shared })}</span>
      </div>
      {suggestions.length ? (
        <div>
          <h3 className="mb-3 text-sm font-semibold">{t('social.suggestions')}</h3>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-x-3 gap-y-4">
            {suggestions.map((anime) => (
              <AnimeCard key={anime.malId} anime={anime} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
