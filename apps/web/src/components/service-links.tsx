import { useQuery } from '@tanstack/react-query'
import type { AnimeLink, AnimeService } from '@yoru/shared'
import { Tooltip } from '@yoru/ui'
import { type ReactNode, forwardRef } from 'react'
import { api } from '../lib/api'
import { keys } from '../lib/queries'

const SERVICES: Record<AnimeService, { name: string; color: string; label: string }> = {
  mal: { name: 'MyAnimeList', color: '#2e51a2', label: 'MAL' },
  shikimori: { name: 'Shikimori', color: '#343a40', label: 'Ш' },
  anilist: { name: 'AniList', color: '#02a9ff', label: 'AL' },
  anidb: { name: 'AniDB', color: '#24356c', label: 'DB' },
  kinopoisk: { name: 'Кинопоиск', color: '#ff5500', label: 'КП' },
  crunchyroll: { name: 'Crunchyroll', color: '#f47521', label: 'CR' },
}

export function ServiceIcon({ service }: { service: AnimeService }) {
  const s = SERVICES[service]
  const label = s.label
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="5" fill={s.color} />
      <text
        x="12"
        y={label.length > 2 ? 15.4 : 16.4}
        textAnchor="middle"
        fontSize={label.length > 2 ? 8.5 : 11}
        fontWeight="800"
        fill="#fff"
        fontFamily="Arial, sans-serif"
      >
        {label}
      </text>
    </svg>
  )
}

export const linkTileClass =
  'grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg bg-field transition-colors hover:bg-field-hover [&_svg]:size-5'

export const LinkTile = forwardRef<HTMLButtonElement, { label: string; children: ReactNode }>(function LinkTile({ label, children, ...props }, ref) {
  return (
    <button ref={ref} type="button" aria-label={label} className={linkTileClass} {...props}>
      {children}
    </button>
  )
})

export function LinkButton({ href, icon, children }: { href: string; icon: ReactNode; children: string }) {
  return (
    <Tooltip content={children}>
      <a href={href} target="_blank" rel="noreferrer" aria-label={children} className={linkTileClass}>
        {icon}
      </a>
    </Tooltip>
  )
}

export function LinkGroup({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>
}

export function ServiceLinks({ malId }: { malId: number }) {
  const { data } = useQuery({ queryKey: keys.links(malId), queryFn: () => api.links(malId), staleTime: 60 * 60_000 })
  const links: AnimeLink[] = data ?? [{ service: 'mal', url: `https://myanimelist.net/anime/${malId}` }]
  return (
    <>
      {links.map((link) => (
        <LinkButton key={link.service} href={link.url} icon={<ServiceIcon service={link.service} />}>
          {SERVICES[link.service].name}
        </LinkButton>
      ))}
    </>
  )
}
