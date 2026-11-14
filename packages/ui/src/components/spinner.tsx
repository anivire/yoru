import { LoaderCircle } from 'lucide-react'
import { cn } from '../lib/cn'

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cn('size-4 animate-spin text-current', className)} aria-hidden />
}
