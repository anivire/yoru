import { RiLoader4Fill } from '@remixicon/react'
import { cn } from '../lib/cn'

export function Spinner({ className }: { className?: string }) {
  return <RiLoader4Fill className={cn('size-4 animate-spin text-current', className)} aria-hidden />
}
