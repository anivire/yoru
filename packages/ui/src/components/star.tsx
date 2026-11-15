import type { ComponentProps } from 'react'

const STAR = 'M12 17 6.12 20.59l1.6-6.7-5.23-4.48 6.87-.55L12 2.5l2.64 6.36 6.87.55-5.23 4.48 1.6 6.7Z'

export function StarIcon({ outline = false, ...props }: ComponentProps<'svg'> & { outline?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden {...props}>
      <path d={STAR} fill={outline ? 'none' : 'currentColor'} stroke="currentColor" strokeWidth={outline ? 2 : 2.4} strokeLinejoin="round" />
    </svg>
  )
}
