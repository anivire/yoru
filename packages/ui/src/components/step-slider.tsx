import { Slider } from 'radix-ui'
import { type KeyboardEvent, type ReactNode, useState } from 'react'
import { cn } from '../lib/cn'
import { emitStep, emitStepEnd } from '../lib/step'

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
  const [drag, setDrag] = useState<number | null>(null)
  const shown = drag ?? index
  const select = (position: number) => {
    const target = Math.min(last, Math.max(0, Math.round(position)))
    const next = options[target]
    if (!next || next.value === value) return
    emitStep(last > 0 ? target / last : 0)
    onChange(next.value)
  }
  const onKeyDown = (e: KeyboardEvent) => {
    const keys: Record<string, number> = { ArrowLeft: index - 1, ArrowDown: index - 1, ArrowRight: index + 1, ArrowUp: index + 1, Home: 0, End: last }
    const target = keys[e.key]
    if (target === undefined) return
    e.preventDefault()
    setDrag(null)
    select(target)
    emitStepEnd()
  }
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Slider.Root
        value={[shown]}
        min={0}
        max={last}
        step={0.001}
        onValueChange={([position = 0]) => {
          setDrag(position)
          select(position)
        }}
        onValueCommit={([position = 0]) => {
          setDrag(null)
          select(position)
          emitStepEnd()
        }}
        onKeyDown={onKeyDown}
        className={cn(
          'relative flex h-6 w-full touch-none select-none items-center',
          drag === null && '[&>span[style]]:transition-[left] [&>span[style]]:duration-200 [&>span[style]]:ease-out',
        )}
        aria-label={label}
      >
        <Slider.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-field-hover">
          <Slider.Range className={cn('absolute h-full rounded-full bg-accent', drag === null && 'transition-[left,right] duration-200 ease-out')} />
        </Slider.Track>
        <Slider.Thumb className="relative block size-5 cursor-grab rounded-full bg-raised shadow-md shadow-black/30 ring-4 ring-accent/25 transition-[box-shadow,scale] active:scale-110 active:cursor-grabbing focus-visible:outline-none focus-visible:ring-accent/50" />
      </Slider.Root>
      <div className="pointer-events-none relative -mt-1 h-1.5">
        {options.map((o, i) => (
          <span
            key={o.value}
            className={cn('absolute top-0 h-full w-0.5 -translate-x-1/2 rounded-full transition-colors duration-200', i <= shown ? 'bg-accent' : 'bg-field-hover')}
            style={{ left: `calc(0.625rem + (100% - 1.25rem) * ${i / last})` }}
          />
        ))}
      </div>
      <div className="relative h-4 text-xs">
        {options.map((o, i) => (
          <button
            key={o.value}
            type="button"
            data-sound="none"
            onClick={() => {
              select(i)
              emitStepEnd()
            }}
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
