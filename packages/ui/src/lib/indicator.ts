import { type CSSProperties, type RefObject, useLayoutEffect, useRef, useState } from 'react'

export function useSlidingIndicator(container: RefObject<HTMLElement | null>, selector: string, key: unknown): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({ opacity: 0 })
  const placed = useRef(false)

  useLayoutEffect(() => {
    const root = container.current
    if (!root) return
    const measure = () => {
      const active = root.querySelector<HTMLElement>(selector)
      if (!active) {
        setStyle((s) => ({ ...s, opacity: 0 }))
        return
      }
      setStyle({
        left: active.offsetLeft,
        top: active.offsetTop,
        width: active.offsetWidth,
        height: active.offsetHeight,
        opacity: 1,
        transitionProperty: placed.current ? 'left, top, width, height, opacity' : 'opacity',
      })
      placed.current = true
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    for (const child of Array.from(root.children)) observer.observe(child)
    return () => observer.disconnect()
  }, [container, selector, key])

  return style
}
