import { EmptyState as BaseEmptyState } from '@anivire/kata-ui'
import type { ComponentProps } from 'react'
import { Mascot, type MascotMood } from './mascot'

export function EmptyState({ mood = 'idle', ...props }: Omit<ComponentProps<typeof BaseEmptyState>, 'icon'> & { mood?: MascotMood }) {
  return <BaseEmptyState icon={<Mascot mood={mood} size={56} />} {...props} />
}
