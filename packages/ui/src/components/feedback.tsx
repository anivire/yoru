import type { ComponentProps, ReactNode } from 'react'
import { Toaster as Sonner } from 'sonner'
import { cn } from '../lib/cn'
import { Mascot, type MascotMood } from './mascot'

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('animate-shimmer rounded-lg', className)} {...props} />
}

export function Progress({ value, className, tone = 'accent' }: { value: number; className?: string; tone?: 'accent' | 'foreground' }) {
  const pct = Math.max(0, Math.min(100, value * 100))
  return (
    <div className={cn('h-1 w-full overflow-hidden rounded-full bg-muted', className)}>
      <div className={cn('h-full rounded-full transition-[width]', tone === 'accent' ? 'bg-accent' : 'bg-foreground')} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function EmptyState({
  title,
  description,
  mood = 'idle',
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  mood?: MascotMood
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('empty-state flex w-full flex-col items-center justify-center gap-3 self-stretch rounded-xl bg-inset px-6 py-12 text-center', className)}>
      <Mascot mood={mood} size={56} />
      <div className="flex max-w-md flex-col items-center">
        <div className="text-[0.9375rem] font-medium">{title}</div>
        {description ? <div className="mt-1 text-sm text-muted-foreground">{description}</div> : null}
      </div>
      {action}
    </div>
  )
}

export function Kbd({ className, ...props }: ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded bg-field px-1 font-mono text-[0.6875rem] text-muted-foreground', className)}
      {...props}
    />
  )
}

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: '!rounded-xl !border-0 !bg-raised !text-foreground !shadow-2xl !font-sans',
          description: '!text-muted-foreground',
          actionButton: '!h-7 !rounded-lg !bg-accent !px-3 !text-xs !font-medium !text-accent-foreground',
        },
      }}
    />
  )
}

export function Code({ className, ...props }: ComponentProps<'code'>) {
  return <code className={cn('rounded-md bg-field px-1.5 py-0.5 font-mono text-[0.85em] text-foreground [overflow-wrap:anywhere]', className)} {...props} />
}
