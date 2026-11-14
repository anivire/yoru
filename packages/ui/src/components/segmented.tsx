import { type ReactNode, useRef } from 'react'
import { cn } from '../lib/cn'
import { useSlidingIndicator } from '../lib/indicator'

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
  const ref = useRef<HTMLDivElement>(null)
  const indicator = useSlidingIndicator(ref, '[aria-selected="true"]', value)
  return (
    <div
      ref={ref}
      role="tablist"
      className={cn('relative inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl bg-foreground/[0.05] p-1 scrollbar-none', className)}
    >
      <span
        aria-hidden
        style={indicator}
        className="pointer-events-none absolute rounded-lg bg-raised duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] dark:bg-foreground/[0.12]"
      />
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
              'relative inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-colors [&_svg]:shrink-0',
              size === 'sm' ? 'h-7 px-2.5 text-[0.8125rem] [&_svg]:size-3.5' : 'h-8 px-3.5 text-sm [&_svg]:size-4',
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.icon}
            {option.label}
            {option.count !== undefined ? (
              <span className={cn('font-mono text-[0.6875rem]', active ? 'text-muted-foreground' : 'text-subtle-foreground')}>
                {option.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
