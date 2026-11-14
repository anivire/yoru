import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  icon?: ReactNode
  count?: number
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div
      role="tablist"
      className={cn('inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl bg-inset p-1 scrollbar-none', className)}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-colors [&_svg]:shrink-0',
              size === 'sm' ? 'h-7 px-2.5 text-[13px] [&_svg]:size-3.5' : 'h-8 px-3.5 text-sm [&_svg]:size-4',
              active
                ? 'bg-raised text-foreground shadow-sm shadow-black/20'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.icon}
            {option.label}
            {option.count !== undefined ? (
              <span className={cn('font-mono text-[11px]', active ? 'text-muted-foreground' : 'text-subtle-foreground')}>
                {option.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
