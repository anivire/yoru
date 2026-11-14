import { type VariantProps, cva } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '../lib/cn'

export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap font-medium [&_svg]:size-3.5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        outline: 'bg-field text-foreground',
        neutral: 'bg-muted text-muted-foreground',
        accent: 'bg-accent-soft text-accent',
        success: 'bg-success-soft text-success',
        warning: 'bg-warning-soft text-warning',
        danger: 'bg-danger-soft text-danger',
        info: 'bg-info-soft text-info',
        solid: 'bg-inverse text-inverse-foreground',
      },
      size: {
        sm: 'h-5 rounded-md px-1.5 text-[11px]',
        md: 'h-6 rounded-full px-2.5 text-xs',
        lg: 'h-8 rounded-full px-3 text-sm',
      },
    },
    defaultVariants: { variant: 'outline', size: 'md' },
  },
)

export function Badge({ className, variant, size, ...props }: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />
}

const dotColors = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  accent: 'bg-accent',
  neutral: 'bg-subtle-foreground',
}

export function StatusDot({ tone = 'neutral', pulse, className }: { tone?: keyof typeof dotColors; pulse?: boolean; className?: string }) {
  return (
    <span className={cn('relative inline-flex size-2 shrink-0', className)}>
      {pulse ? <span className={cn('absolute inset-0 animate-ping rounded-full opacity-60', dotColors[tone])} /> : null}
      <span className={cn('relative size-2 rounded-full', dotColors[tone])} />
    </span>
  )
}
