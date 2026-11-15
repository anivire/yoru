import { cn } from '@yoru/ui'
import { useAppearance } from '../lib/appearance'
import { useEffect, useState } from 'react'

const FADE_MS = 700

let lastShown: string | null = null

interface Layer {
  src: string
  shown: boolean
}

function preload(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = () => resolve()
    img.src = src
    if (img.complete) resolve()
  })
}

export function HeroBackdrop({ src }: { src: string | null }) {
  const { backdrop } = useAppearance()
  const [layers, setLayers] = useState<Layer[]>(() => (lastShown ? [{ src: lastShown, shown: true }] : []))

  useEffect(() => {
    if (!src) return
    let cancelled = false
    let timer: number | undefined
    void preload(src).then(() => {
      if (cancelled) return
      setLayers((prev) => (prev.at(-1)?.src === src ? prev : [...prev.filter((l) => l.shown && l.src !== src), { src, shown: false }]))
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (cancelled) return
        lastShown = src
        setLayers((prev) => prev.map((l) => (l.src === src ? { ...l, shown: true } : l)))
        timer = window.setTimeout(() => setLayers((prev) => (prev.at(-1)?.src === src ? prev.slice(-1) : prev)), FADE_MS)
      }))
    })
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [src])

  return (
    <div className={cn('pointer-events-none absolute inset-x-0 top-0 -z-10 h-[calc(100%+12rem)] overflow-hidden', backdrop === 'glow' ? 'backdrop-glow' : '[mask-image:linear-gradient(to_bottom,black_45%,transparent)]')}>
      <div className="absolute inset-0 opacity-50">
      {layers.map((layer) => (
        <img
          key={layer.src}
          src={layer.src}
          alt=""
          style={{ transitionDuration: `${FADE_MS}ms` }}
          className={cn('absolute inset-0 h-full w-full scale-110 object-cover object-[50%_30%] blur-xl transition-opacity ease-out', layer.shown ? 'opacity-100' : 'opacity-0')}
        />
      ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-background/50 to-background/20" />
    </div>
  )
}
