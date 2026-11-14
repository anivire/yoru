import { Slider } from 'radix-ui'
import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

export interface StepOption<T extends string> {
  value: T
  label: ReactNode
}

export function StepSlider<T extends string>({
  value,
  onChange,
  options,
  className,
  label,
}: {
  value: T
  onChange: (value: T) => void
  options: StepOption<T>[]
  className?: string
  label?: string
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value))
  const last = options.length - 1
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Slider.Root
        value={[index]}
        min={0}
        max={last}
        step={1}
        onValueChange={([i]) => {
          const next = options[i ?? 0]
          if (next && next.value !== value) onChange(next.value)
        }}
        className="relative flex h-6 w-full touch-none select-none items-center"
        aria-label={label}
      >
        <Slider.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-field-hover">
          <Slider.Range className="absolute h-full rounded-full bg-accent" />
        </Slider.Track>
        <div className="pointer-events-none absolute inset-x-2.5 top-1/2 flex -translate-y-1/2 justify-between">
          {options.map((o, i) => (
            <span key={o.value} className={cn('size-1.5 rounded-full', i <= index ? 'bg-accent-foreground/70' : 'bg-subtle-foreground/60')} />
          ))}
        </div>
        <Slider.Thumb className="relative block size-5 cursor-grab rounded-full bg-raised shadow-md shadow-black/30 ring-4 ring-accent/25 transition-[box-shadow] active:cursor-grabbing focus-visible:outline-none focus-visible:ring-accent/50" />
      </Slider.Root>
      <div className="relative h-4 text-xs">
        {options.map((o, i) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'absolute top-0 cursor-pointer whitespace-nowrap transition-colors hover:text-foreground',
              i === 0 ? 'left-0' : i === last ? 'right-0' : '-translate-x-1/2',
              i === index ? 'font-medium text-foreground' : 'text-muted-foreground',
            )}
            style={i === 0 || i === last ? undefined : { left: `calc(0.625rem + (100% - 1.25rem) * ${i / last})` }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
