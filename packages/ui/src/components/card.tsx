import type { ComponentProps } from 'react'
import { cn } from '../lib/cn'

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('rounded-xl bg-surface', className)} {...props} />
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex items-start justify-between gap-4 px-4 pb-1 pt-4 sm:px-5', className)} {...props} />
}

export function CardTitle({ className, ...props }: ComponentProps<'h3'>) {
  return <h3 className={cn('text-[0.9375rem] font-semibold tracking-tight', className)} {...props} />
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('mt-0.5 text-sm text-muted-foreground', className)} {...props} />
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('px-4 py-4 sm:px-5', className)} {...props} />
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex items-center justify-end gap-2 px-4 pb-4 pt-1 sm:px-5', className)} {...props} />
}
