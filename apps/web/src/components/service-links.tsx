import { useQuery } from '@tanstack/react-query'
import type { AnimeLink, AnimeService } from '@yoru/shared'
import { buttonVariants, cn } from '@yoru/ui'
import { RiExternalLinkLine } from '@remixicon/react'
import { type ComponentProps, type ReactNode, forwardRef } from 'react'
import { api } from '../lib/api'
import { GLASS_CHIP } from './anime-cards'
import { keys } from '../lib/queries'
import { PROVIDER_PATHS } from './providers'

const CRUNCHYROLL_PATH =
  'M2.933 13.467a10.55 10.55 0 1 1 21.067-.8V12c0-6.627-5.373-12-12-12S0 5.373 0 12s5.373 12 12 12h.8a10.617 10.617 0 0 1-9.867-10.533zM19.2 14a3.85 3.85 0 0 1-1.333-7.467A7.89 7.89 0 0 0 14 5.6a8.4 8.4 0 1 0 8.4 8.4 6.492 6.492 0 0 0-.133-1.6A3.415 3.415 0 0 1 19.2 14z'

const SERVICES: Record<AnimeService, { name: string; color: string; path?: string; label?: string }> = {
  mal: { name: 'MyAnimeList', color: '#2e51a2', path: PROVIDER_PATHS.mal },
  shikimori: { name: 'Shikimori', color: '#343a40', path: PROVIDER_PATHS.shikimori },
  anilist: { name: 'AniList', color: '#02a9ff', path: PROVIDER_PATHS.anilist },
  anidb: { name: 'AniDB', color: '#24356c', label: 'DB' },
  crunchyroll: { name: 'Crunchyroll', color: '#f47521', path: CRUNCHYROLL_PATH },
}

export function LinkLogo({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="grid size-6 shrink-0 place-items-center rounded-md text-white [&_svg]:size-3.5" style={{ background: color }}>
      {children}
    </span>
  )
}

export function ServiceLogo({ service }: { service: AnimeService }) {
  const s = SERVICES[service]
  return (
    <LinkLogo color={s.color}>
      {s.path ? (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d={s.path} />
        </svg>
      ) : (
        <span className="text-[0.625rem] font-extrabold leading-none">{s.label}</span>
      )}
    </LinkLogo>
  )
}

const linkClass = cn(buttonVariants({ variant: 'secondary', size: 'sm' }), GLASS_CHIP, 'group pl-1 hover:bg-white dark:hover:bg-white/15')

type LinkProps = { logo: ReactNode; label: string; external?: boolean }

export const LinkChip = forwardRef<HTMLAnchorElement & HTMLButtonElement, LinkProps & ComponentProps<'a'> & ComponentProps<'button'>>(function LinkChip(
  { logo, label, external, href, className, ...props },
  ref,
) {
  const content = (
    <>
      {logo}
      {label}
      {external ? <RiExternalLinkLine className="-ml-0.5 opacity-40 transition-opacity group-hover:opacity-70" /> : null}
    </>
  )
  if (href) {
    return (
      <a ref={ref} href={href} target="_blank" rel="noreferrer" className={cn(linkClass, className)} {...props}>
        {content}
      </a>
    )
  }
  return (
    <button ref={ref} type="button" className={cn(linkClass, className)} {...props}>
      {content}
    </button>
  )
})

export function LinkChips({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap justify-center gap-1.5 sm:justify-start">{children}</div>
}

export function ServiceLinks({ malId }: { malId: number }) {
  const { data } = useQuery({ queryKey: keys.links(malId), queryFn: () => api.links(malId), staleTime: 60 * 60_000 })
  const links: AnimeLink[] = data ?? [{ service: 'mal', url: `https://myanimelist.net/anime/${malId}` }]
  return (
    <>
      {links.map((link) => (
        <LinkChip key={link.service} href={link.url} external logo={<ServiceLogo service={link.service} />} label={SERVICES[link.service].name} />
      ))}
    </>
  )
}
