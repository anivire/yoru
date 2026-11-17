import { Segmented, Textarea, Tooltip, cn } from '@yoru/ui'
import {
  RiBold,
  RiCodeLine,
  RiDoubleQuotesL,
  RiH3,
  RiItalic,
  RiLink,
  RiListOrdered2,
  RiListUnordered,
  RiStrikethrough,
} from '@remixicon/react'
import { type KeyboardEvent, type ReactNode, Suspense, lazy, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const MarkdownRender = lazy(() => import('./markdown-render'))

export function Markdown({ text, className }: { text: string; className?: string }) {
  return (
    <Suspense fallback={<p className={cn('whitespace-pre-wrap break-words text-sm leading-relaxed', className)}>{text}</p>}>
      <MarkdownRender text={text} className={className} />
    </Suspense>
  )
}

type Action = { key: string; icon: ReactNode; shortcut?: string; apply: (selected: string) => { text: string; select?: [number, number] } }

function wrap(marker: string, fallback: string) {
  return (selected: string) => {
    const body = selected || fallback
    return { text: `${marker}${body}${marker}`, select: [marker.length, marker.length + body.length] as [number, number] }
  }
}

function prefixLines(prefix: (index: number) => string, fallback: string) {
  return (selected: string) => {
    const lines = (selected || fallback).split('\n')
    const text = lines.map((line, i) => `${prefix(i)}${line}`).join('\n')
    return { text, select: [0, text.length] as [number, number] }
  }
}

export function MarkdownEditor({ value, onChange, placeholder, maxLength }: { value: string; onChange: (value: string) => void; placeholder?: string; maxLength?: number }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLTextAreaElement>(null)
  const [tab, setTab] = useState<'write' | 'preview'>('write')

  const actions: Action[] = [
    { key: 'bold', icon: <RiBold />, shortcut: 'B', apply: wrap('**', t('markdown.sample')) },
    { key: 'italic', icon: <RiItalic />, shortcut: 'I', apply: wrap('_', t('markdown.sample')) },
    { key: 'strike', icon: <RiStrikethrough />, apply: wrap('~~', t('markdown.sample')) },
    { key: 'heading', icon: <RiH3 />, apply: prefixLines(() => '### ', t('markdown.sample')) },
    { key: 'quote', icon: <RiDoubleQuotesL />, apply: prefixLines(() => '> ', t('markdown.sample')) },
    { key: 'list', icon: <RiListUnordered />, apply: prefixLines(() => '- ', t('markdown.sample')) },
    { key: 'ordered', icon: <RiListOrdered2 />, apply: prefixLines((i) => `${i + 1}. `, t('markdown.sample')) },
    { key: 'code', icon: <RiCodeLine />, apply: wrap('`', 'code') },
    {
      key: 'link',
      icon: <RiLink />,
      shortcut: 'K',
      apply: (selected) => {
        const label = selected || t('markdown.sample')
        const text = `[${label}](https://)`
        return { text, select: [label.length + 3, text.length - 1] }
      },
    },
  ]

  const run = (action: Action) => {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const result = action.apply(value.slice(start, end))
    const next = value.slice(0, start) + result.text + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      const [from, to] = result.select ?? [result.text.length, result.text.length]
      el.setSelectionRange(start + from, start + to)
    })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.ctrlKey || e.metaKey)) return
    const action = actions.find((a) => a.shortcut === e.key.toUpperCase())
    if (!action) return
    e.preventDefault()
    run(action)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          size="sm"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'write', label: t('markdown.write') },
            { value: 'preview', label: t('markdown.preview') },
          ]}
        />
        {tab === 'write' ? (
          <div className="flex flex-wrap items-center gap-0.5">
            {actions.map((action) => (
              <Tooltip key={action.key} content={action.shortcut ? `${t(`markdown.${action.key}`)} · Ctrl+${action.shortcut}` : t(`markdown.${action.key}`)}>
                <button
                  type="button"
                  aria-label={t(`markdown.${action.key}`)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => run(action)}
                  className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-field hover:text-foreground [&_svg]:size-4"
                >
                  {action.icon}
                </button>
              </Tooltip>
            ))}
          </div>
        ) : null}
      </div>
      {tab === 'write' ? (
        <Textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} placeholder={placeholder} maxLength={maxLength} className="min-h-28 resize-y font-[inherit]" />
      ) : (
        <div className="min-h-28 rounded-lg bg-foreground/[0.05] px-3 py-2">
          {value.trim() ? <Markdown text={value} /> : <p className="text-sm text-subtle-foreground">{t('markdown.empty')}</p>}
        </div>
      )}
    </div>
  )
}
