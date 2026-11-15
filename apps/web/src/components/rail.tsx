import { Tooltip, cn } from '@yoru/ui'
import { type ReactElement, type ReactNode, createContext, useContext } from 'react'

export const RAIL_BUTTON =
  'relative flex h-11 shrink-0 cursor-pointer items-center justify-start gap-3 rounded-xl px-3 text-muted-foreground outline-none transition-[color,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent data-[state=open]:bg-muted data-[state=open]:text-foreground [&_svg]:size-5 [&_svg]:shrink-0'

interface RailState {
  labels: boolean
  expanded: boolean
  fill: boolean
}

const RailContext = createContext<RailState>({ labels: false, expanded: false, fill: false })

export function RailProvider({ value, children }: { value: RailState; children: ReactNode }) {
  return <RailContext value={value}>{children}</RailContext>
}

export function useRail() {
  return useContext(RailContext)
}

export function useRailButton() {
  const { fill } = useRail()
  return cn(RAIL_BUTTON, fill ? 'w-full' : 'w-11')
}

export function RailTip({ label, side, children }: { label: string; side: 'top' | 'bottom' | 'left' | 'right'; children: ReactElement }) {
  const { labels } = useRail()
  if (labels) return children
  return (
    <Tooltip content={label} side={side}>
      {children}
    </Tooltip>
  )
}

export function RailLabel({ children }: { children: ReactNode }) {
  const { labels, expanded } = useRail()
  if (!labels) return null
  return (
    <span className={cn('min-w-0 truncate text-sm font-medium transition-opacity duration-200', expanded ? 'opacity-100' : 'opacity-0')}>
      {children}
    </span>
  )
}
