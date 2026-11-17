import { useQuery } from '@tanstack/react-query'
import type { AnimeCharacter } from '@yoru/shared'
import { Image, Lightbox, Skeleton, cn } from '@yoru/ui'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router'
import { api } from '../lib/api'
import { seasonLabel, typeLabel } from '../lib/format'
import { keys } from '../lib/queries'
import { AnimeCard, Rail } from './anime-cards'
import { TLink } from './transition-link'
import { seiyuuPath, useAnimeTitle } from '../lib/anime-title'
import type { Crumb } from './breadcrumbs'

function useListStatuses() {
  return useQuery({ queryKey: keys.listStatuses, queryFn: api.listStatuses, staleTime: 60_000 }).data
}

export function useAnimeExtras(malId: number) {
  return useQuery({ queryKey: keys.extras(malId), queryFn: () => api.extras(malId), staleTime: 60 * 60_000 })
}

function Section({ title, action, className, children }: { title: string; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={cn('mt-12', className)}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function RelatedSection({ malId }: { malId: number }) {
  const { t } = useTranslation()
  const { data } = useAnimeExtras(malId)
  const statuses = useListStatuses()
  if (!data?.relations.length) return null
  return (
    <Section title={t('anime.related')}>
      <Rail size="poster">
        {data.relations.map(({ relation, anime }) => (
          <AnimeCard
            key={`${relation}-${anime.malId}`}
            anime={anime}
            status={statuses?.[anime.malId]}
            subtitle={[t(`anime.relation.${relation}`, { defaultValue: relation }), typeLabel(anime.type), anime.year].filter(Boolean).join(' · ')}
          />
        ))}
      </Rail>
    </Section>
  )
}

function Portrait({ src }: { src: string | null }) {
  return <div className="aspect-[3/4] overflow-hidden bg-muted">{src ? <Image src={src} alt="" loading="lazy" fallback className="h-full w-full object-cover" /> : null}</div>
}

function CharacterCard({ character, from }: { character: AnimeCharacter; from?: Crumb }) {
  const { t } = useTranslation()
  const va = character.voiceActor
  return (
    <div className="overflow-hidden rounded-xl bg-foreground/[0.04]">
      <div className="grid grid-cols-2">
        <Portrait src={character.imageUrl} />
        {va ? (
          <TLink to={seiyuuPath(va.id, va.name)} state={{ from }} aria-label={va.name} className="transition-[filter] duration-200 hover:brightness-110">
            <Portrait src={va.imageUrl} />
          </TLink>
        ) : (
          <Portrait src={null} />
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 px-3 py-2.5">
        <div className="min-w-0">
          <div className="line-clamp-2 text-sm font-medium leading-snug">{character.name}</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{t(`anime.role.${character.role}`)}</div>
        </div>
        {va ? (
          <TLink to={seiyuuPath(va.id, va.name)} state={{ from }} className="group/va min-w-0 text-right">
            <div className="line-clamp-2 text-sm leading-snug transition-colors group-hover/va:text-accent">{va.name}</div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">{t('anime.seiyu')}</div>
          </TLink>
        ) : null}
      </div>
    </div>
  )
}

function CharactersSection({ malId }: { malId: number }) {
  const { t } = useTranslation()
  const { data } = useAnimeExtras(malId)
  const page = useQuery({ queryKey: keys.anime(malId), queryFn: () => api.anime(malId) }).data
  const title = useAnimeTitle()
  const { pathname } = useLocation()
  if (!data?.characters.length) return null
  const from = page ? { label: title(page.anime), to: pathname } : undefined
  return (
    <Section title={t('anime.characters')}>
      <Rail>
        {data.characters.map((c) => (
          <CharacterCard key={c.id} character={c} from={from} />
        ))}
      </Rail>
    </Section>
  )
}

function RecommendationsSection({ malId }: { malId: number }) {
  const { t } = useTranslation()
  const { data } = useAnimeExtras(malId)
  const statuses = useListStatuses()
  if (!data?.recommendations.length) return null
  return (
    <Section title={t('anime.recommendations')}>
      <Rail size="poster">
        {data.recommendations.map((anime) => (
          <AnimeCard key={anime.malId} anime={anime} status={statuses?.[anime.malId]} subtitle={[typeLabel(anime.type), seasonLabel(anime)].filter(Boolean).join(' · ')} />
        ))}
      </Rail>
    </Section>
  )
}

export function ScreenshotsSection({ malId }: { malId: number }) {
  const { t } = useTranslation()
  const { data, isPending } = useQuery({ queryKey: keys.screenshots(malId), queryFn: () => api.screenshots(malId), staleTime: 60 * 60_000 })
  if (isPending) {
    return (
      <section className="mb-12">
        <Skeleton className="mb-4 h-6 w-24 rounded-md" />
        <Rail>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-video rounded-xl" />
          ))}
        </Rail>
      </section>
    )
  }
  if (!data?.length) return null
  return (
    <Section title={t('anime.screenshots')} className="mb-12 mt-0">
      <Rail>
        {data.map((shot, i) => (
          <Lightbox key={shot.full} src={shot.full} title={`${t('anime.screenshots')} ${i + 1}`} closeLabel={t('common.close')}>
            <button type="button" className="group aspect-video cursor-zoom-in overflow-hidden rounded-xl bg-muted">
              <Image src={shot.thumb} alt="" className="h-full w-full object-cover transition-[filter] duration-200 group-hover:brightness-110" />
            </button>
          </Lightbox>
        ))}
      </Rail>
    </Section>
  )
}

export function AnimeExtrasSections({ malId }: { malId: number }) {
  return (
    <>
      <RelatedSection malId={malId} />
      <CharactersSection malId={malId} />
      <RecommendationsSection malId={malId} />
    </>
  )
}
