import { useQuery } from '@tanstack/react-query'
import type { AnimeLink, AnimeService } from '@yoru/shared'
import { Button } from '@yoru/ui'
import { ExternalLink } from 'lucide-react'
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
    <Button asChild variant="secondary" size="sm" className="w-full justify-start">
      <a href={href} target="_blank" rel="noreferrer">
        {icon}
        <span className="flex-1 truncate">{children}</span>
        <ExternalLink className="text-subtle-foreground" />
      </a>
    </Button>
  )
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
