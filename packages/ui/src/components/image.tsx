import { type ComponentProps, useEffect, useRef, useState } from 'react'
import { cn } from '../lib/cn'

export function Image({ className, onLoad, src, ...props }: ComponentProps<'img'>) {
  const ref = useRef<HTMLImageElement>(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    const el = ref.current
    setLoaded(Boolean(el?.complete && el.naturalWidth))
  }, [src])
  return (
    <img
      ref={ref}
      src={src}
      onLoad={(e) => {
        setLoaded(true)
        onLoad?.(e)
      }}
      className={cn(loaded ? 'animate-image-in' : 'opacity-0', className)}
      {...props}
    />
  )
}
