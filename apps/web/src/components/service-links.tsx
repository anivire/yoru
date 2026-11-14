import { useQuery } from '@tanstack/react-query'
import type { AnimeLink, AnimeService } from '@yoru/shared'
import { RiExternalLinkFill } from '@remixicon/react'
import type { ReactNode } from 'react'
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

export function LinkButton({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group flex h-9 min-w-0 items-center gap-2.5 rounded-lg px-2.5 text-[0.8125rem] font-medium text-foreground transition-colors hover:bg-field-hover [&_svg]:size-4 [&_svg]:shrink-0"
    >
      {icon}
      <span className="flex-1 truncate text-left">{children}</span>
      <RiExternalLinkFill className="size-3.5! text-subtle-foreground transition-colors group-hover:text-foreground" />
    </a>
  )
}

export function LinkGroup({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-0.5 rounded-xl bg-field p-1 sm:grid-cols-1">{children}</div>
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
