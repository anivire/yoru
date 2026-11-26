import { Image as BaseImage } from '@anivire/kata-ui'
import type { ComponentProps } from 'react'
import { Mascot } from './mascot'

export function Image({ fallback, ...props }: Omit<ComponentProps<typeof BaseImage>, 'fallback'> & { fallback?: boolean }) {
  return <BaseImage fallback={fallback ? <Mascot mood="sleepy" animated={false} className="h-auto w-1/3 max-w-16 opacity-50" /> : undefined} {...props} />
}
