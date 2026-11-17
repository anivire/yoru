import { type ComponentProps, useEffect, useRef, useState } from 'react'
import { cn } from '../lib/cn'
import { Mascot } from './mascot'

export function Image({ className, onLoad, onError, src, fallback, ...props }: ComponentProps<'img'> & { fallback?: boolean }) {
  const ref = useRef<HTMLImageElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState<string | undefined>(undefined)
  useEffect(() => {
    const el = ref.current
    setLoaded(Boolean(el?.complete && el.naturalWidth))
  }, [src])
  if (fallback && src && failed === src) {
    return (
      <span className={cn('grid place-items-center bg-muted', className)}>
        <Mascot mood="sleepy" animated={false} className="h-auto w-1/3 max-w-16 opacity-50" />
      </span>
    )
  }
  return (
    <img
      ref={ref}
      src={src}
      onLoad={(e) => {
        setLoaded(true)
        onLoad?.(e)
      }}
      onError={(e) => {
        setFailed(src)
        onError?.(e)
      }}
      className={cn(loaded ? 'animate-image-in' : 'opacity-0', className)}
      {...props}
    />
  )
}
