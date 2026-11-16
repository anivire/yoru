import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AnimeNote, NoteInput } from '@yoru/shared'
import { Button, Input, Skeleton, Switch, Tooltip, cn, toast } from '@yoru/ui'
import { RiChat3Line, RiDeleteBin6Line, RiEdit2Line, RiLockFill, RiStickyNoteFill } from '@remixicon/react'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { relativeTime } from '../lib/format'
import { errorMessage, useUser } from '../lib/queries'
import { Section } from './app-shell'
import { Markdown, MarkdownEditor } from './markdown'
import { TLink } from './transition-link'
import { CommentThread } from './social'
import { UserAvatar, nameOf } from './user-avatar'

function NoteForm({ initial, submitLabel, pending, onSubmit, onCancel }: { initial?: AnimeNote; submitLabel: string; pending: boolean; onSubmit: (input: NoteInput) => void; onCancel?: () => void }) {
  const { t } = useTranslation()
  const [text, setText] = useState(initial?.text ?? '')
  const [episode, setEpisode] = useState(initial?.episode ? String(initial.episode) : '')
  const [isPrivate, setIsPrivate] = useState(initial?.private ?? true)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    const number = Number(episode)
    onSubmit({ text: text.trim(), episode: Number.isInteger(number) && number > 0 ? number : null, private: isPrivate })
    if (!initial) {
      setText('')
      setEpisode('')
      setIsPrivate(true)
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <MarkdownEditor value={text} onChange={setText} placeholder={t('notes.placeholder')} maxLength={4000} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
          {t('notes.episode')}
          <Input value={episode} onChange={(e) => setEpisode(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="-" className="h-8 w-16 text-center" />
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-[0.8125rem] text-muted-foreground">
          <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
          {t('notes.private')}
        </label>
        <div className="ml-auto flex gap-2">
          {onCancel ? (
            <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
              {t('common.cancel')}
            </Button>
          ) : null}
          <Button type="submit" size="sm" variant="accent" loading={pending} disabled={!text.trim()}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  )
}

export function NoteBody({ note }: { note: AnimeNote }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-1.5">
      {note.episode || note.private ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {note.episode ? <span className="rounded-full bg-field px-2 py-0.5 font-medium">{t('notes.episodeBadge', { episode: note.episode })}</span> : null}
          {note.private ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-field px-2 py-0.5 font-medium">
              <RiLockFill className="size-3" />
              {t('notes.privateBadge')}
            </span>
          ) : null}
        </div>
      ) : null}
      <Markdown text={note.text} />
    </div>
  )
}

function NoteCard({ note, malId }: { note: AnimeNote; malId: number }) {
  const { t } = useTranslation()
  const user = useUser()
  const client = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [thread, setThread] = useState(false)
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['notes', malId] })
    void client.invalidateQueries({ queryKey: ['feed'] })
  }
  const update = useMutation({
    mutationFn: (input: NoteInput) => api.updateNote(note.id, input),
    onSuccess: () => {
      setEditing(false)
      refresh()
    },
    onError: (e) => toast.error(errorMessage(e, t)),
  })
  const remove = useMutation({ mutationFn: () => api.deleteNote(note.id), onSuccess: refresh, onError: (e) => toast.error(errorMessage(e, t)) })
  const own = note.user.id === user.id
  return (
    <article className="flex gap-3 rounded-xl bg-surface p-4">
      <TLink to={`/u/${note.user.username}`} className="shrink-0">
        <UserAvatar user={note.user} />
      </TLink>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2">
          <TLink to={`/u/${note.user.username}`} className="truncate text-sm font-semibold transition-colors hover:text-accent">
            {nameOf(note.user)}
          </TLink>
          <Tooltip content={new Date(note.createdAt).toLocaleString()}>
            <span className="shrink-0 text-xs text-subtle-foreground">{relativeTime(note.createdAt)}</span>
          </Tooltip>
          {(own || user.role === 'admin') && !editing ? (
            <div className="ml-auto flex gap-0.5">
              {own ? (
                <Button size="icon-sm" variant="ghost" aria-label={t('notes.edit')} title={t('notes.edit')} onClick={() => setEditing(true)}>
                  <RiEdit2Line />
                </Button>
              ) : null}
              <Button size="icon-sm" variant="ghost" aria-label={t('notes.delete')} title={t('notes.delete')} loading={remove.isPending} onClick={() => remove.mutate()} className="hover:text-danger">
                <RiDeleteBin6Line />
              </Button>
            </div>
          ) : null}
        </div>
        {editing ? <NoteForm initial={note} submitLabel={t('common.save')} pending={update.isPending} onSubmit={(input) => update.mutate(input)} onCancel={() => setEditing(false)} /> : <NoteBody note={note} />}
        {!note.private && !editing ? (
          <>
            <Button size="sm" variant="ghost" className={cn('mt-2 h-7 rounded-full px-2.5', thread && 'bg-muted')} onClick={() => setThread(!thread)}>
              <RiChat3Line />
              {note.comments ? <span className="font-mono text-xs tabular-nums">{note.comments}</span> : t('social.comment')}
            </Button>
            {thread ? <CommentThread target="note" id={note.id} /> : null}
          </>
        ) : null}
      </div>
    </article>
  )
}

export function NotesSection({ malId }: { malId: number }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const notes = useQuery({ queryKey: ['notes', malId], queryFn: () => api.notes(malId) })
  const create = useMutation({
    mutationFn: (input: NoteInput) => api.createNote(malId, input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['notes', malId] })
      void client.invalidateQueries({ queryKey: ['feed'] })
    },
    onError: (e) => toast.error(errorMessage(e, t)),
  })
  return (
    <Section title={t('notes.title')} hint={t('notes.hint')} icon={<RiStickyNoteFill />}>
      <div className="flex flex-col gap-3">
        <div className="rounded-xl bg-surface p-4">
          <NoteForm submitLabel={t('notes.add')} pending={create.isPending} onSubmit={(input) => create.mutate(input)} />
        </div>
        {notes.isPending ? (
          <Skeleton className="h-24 rounded-xl" />
        ) : notes.data?.length ? (
          notes.data.map((note) => <NoteCard key={note.id} note={note} malId={malId} />)
        ) : (
          <p className="px-1 text-sm text-muted-foreground">{t('notes.empty')}</p>
        )}
      </div>
    </Section>
  )
}
