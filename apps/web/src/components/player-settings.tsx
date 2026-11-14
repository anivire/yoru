import { STREAM_KINDS } from '@yoru/shared'
import { Button, Card, Input, cn } from '@yoru/ui'
import { RiArrowUpSFill, RiCloseFill } from '@remixicon/react'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppearance } from '../lib/appearance'
import { Block } from '../pages/settings'
import { KIND_ICONS } from './watch-section'

export function PlayerTab() {
  const { t } = useTranslation()
  const { defaultKind, setDefaultKind, preferredAuthors, setPreferredAuthors } = useAppearance()
  const [draft, setDraft] = useState('')

  const add = (e: FormEvent) => {
    e.preventDefault()
    const value = draft.trim()
    setDraft('')
    if (!value || preferredAuthors.some((a) => a.toLowerCase() === value.toLowerCase())) return
    setPreferredAuthors([...preferredAuthors, value])
  }
  const moveUp = (index: number) => {
    const next = [...preferredAuthors]
    ;[next[index - 1], next[index]] = [next[index]!, next[index - 1]!]
    setPreferredAuthors(next)
  }

  return (
    <>
      <Block title={t('settings.playerPrefs.kind')} description={t('settings.playerPrefs.kindHint')}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {STREAM_KINDS.map((kind) => {
            const Icon = KIND_ICONS[kind]
            const active = kind === defaultKind
            return (
              <button
                key={kind}
                type="button"
                onClick={() => setDefaultKind(kind)}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors',
                  active ? 'bg-accent-soft text-accent' : 'bg-surface text-foreground hover:bg-field-hover',
                )}
              >
                <Icon className="size-4 shrink-0" />
                {t(`player.${kind}`)}
              </button>
            )
          })}
        </div>
      </Block>
      <Block title={t('settings.playerPrefs.authors')} description={t('settings.playerPrefs.authorsHint')}>
        <Card className="flex flex-col gap-3 p-4">
          {preferredAuthors.length ? (
            <ol className="flex flex-col gap-1">
              {preferredAuthors.map((author, i) => (
                <li key={author} className="flex items-center gap-3 rounded-lg bg-field py-1 pl-3 pr-1 text-sm">
                  <span className="w-4 shrink-0 text-xs tabular-nums text-subtle-foreground">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{author}</span>
                  {i > 0 ? (
                    <Button size="icon-sm" variant="ghost" aria-label={t('settings.playerPrefs.up')} title={t('settings.playerPrefs.up')} onClick={() => moveUp(i)}>
                      <RiArrowUpSFill />
                    </Button>
                  ) : null}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t('settings.playerPrefs.remove')}
                    title={t('settings.playerPrefs.remove')}
                    onClick={() => setPreferredAuthors(preferredAuthors.filter((a) => a !== author))}
                  >
                    <RiCloseFill />
                  </Button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">{t('settings.playerPrefs.authorsEmpty')}</p>
          )}
          <form onSubmit={add} className="flex gap-2">
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t('settings.playerPrefs.placeholder')} className="h-8" />
            <Button type="submit" size="sm" variant="secondary" disabled={!draft.trim()}>
              {t('settings.playerPrefs.add')}
            </Button>
          </form>
        </Card>
      </Block>
    </>
  )
}
