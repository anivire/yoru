import type { ListStatus } from '@yoru/shared'
import { cn } from '@yoru/ui'
import { RiBookmarkFill, RiCheckboxCircleFill, RiCloseCircleFill, RiHourglass2Fill, RiPlayCircleFill, RiRepeatFill, type RemixiconComponentType } from '@remixicon/react'
import { useTranslation } from 'react-i18next'

export type StatusTone = 'accent' | 'info' | 'success' | 'orange' | 'danger'

export const STATUS_META: Record<ListStatus, { tone: StatusTone; icon: RemixiconComponentType }> = {
  watching: { tone: 'accent', icon: RiPlayCircleFill },
  rewatching: { tone: 'accent', icon: RiRepeatFill },
  planning: { tone: 'info', icon: RiBookmarkFill },
  completed: { tone: 'success', icon: RiCheckboxCircleFill },
  paused: { tone: 'orange', icon: RiHourglass2Fill },
  dropped: { tone: 'danger', icon: RiCloseCircleFill },
}

export const TONE_SOLID: Record<StatusTone, string> = {
  accent: 'bg-accent text-accent-foreground',
  info: 'bg-info text-white',
  success: 'bg-success text-white',
  orange: 'bg-[oklch(0.68_0.17_50)] text-white',
  danger: 'bg-danger text-white',
}

export const TONE_TEXT: Record<StatusTone, string> = {
  accent: 'text-accent',
  info: 'text-info',
  success: 'text-success',
  orange: 'text-[oklch(0.7_0.17_50)]',
  danger: 'text-danger',
}

export function StatusIcon({ status, className }: { status: ListStatus; className?: string }) {
  const { icon: Icon, tone } = STATUS_META[status]
  return <Icon className={cn('size-4 shrink-0', TONE_TEXT[tone], className)} />
}

export function StatusLabel({ status }: { status: ListStatus }) {
  const { t } = useTranslation()
  return (
    <span className="inline-flex items-center gap-2">
      <StatusIcon status={status} />
      {t(`status.${status}`)}
    </span>
  )
}

export function StatusText({ status, className }: { status: ListStatus; className?: string }) {
  const { t } = useTranslation()
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1 font-medium', TONE_TEXT[STATUS_META[status].tone], className)}>
      <StatusIcon status={status} className="size-3.5" />
      <span className="truncate">{t(`status.${status}`)}</span>
    </span>
  )
}

export function StatusBadge({ status, className }: { status: ListStatus; className?: string }) {
  const { t } = useTranslation()
  const { icon: Icon, tone } = STATUS_META[status]
  return (
    <span className={cn('inline-flex h-5 min-w-0 max-w-full items-center gap-1 rounded-full pl-1.5 pr-2 text-[0.6875rem] font-semibold shadow-sm', TONE_SOLID[tone], className)}>
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate">{t(`status.${status}`)}</span>
    </span>
  )
}
