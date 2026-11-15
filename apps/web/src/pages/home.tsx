import { useQuery } from '@tanstack/react-query'
import type { AnimeSummary, HomeData } from '@yoru/shared'
import { Button, EmptyState, Image } from '@yoru/ui'
import { RiCalendarScheduleFill, RiDownload2Fill, RiPlayCircleFill, RiPlayLargeFill, RiSearchFill, RiTv2Fill } from '@remixicon/react'
import { Fragment, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimeCard, ContinueCard, PosterGrid, Rail, Score, UpcomingCard, UpcomingGrid } from '../components/anime-cards'
import { ActivityHeatmap } from '../components/activity'
import { HomeSkeleton, TextLine } from '../components/skeletons'
import { Page, Section } from '../components/app-shell'
import { api } from '../lib/api'
import { useAppearance } from '../lib/appearance'
import type { HomeSectionId } from '../lib/navigation'
import { keys } from '../lib/queries'
import { seasonLabel, typeLabel } from '../lib/format'
import { HeroBackdrop } from '../components/hero-backdrop'
import { TLink } from '../components/transition-link'
import { useDocumentTitle } from '../lib/title'
import { AnimeTitle } from '../lib/anime-title'

function Hero({ anime, episode, label }: { anime: AnimeSummary; episode: number | null; label: string }) {
  const { t } = useTranslation()
  const details = useQuery({ queryKey: keys.anime(anime.malId), queryFn: () => api.anime(anime.malId), staleTime: 10 * 60_000 })
  const synopsis = details.data?.anime.synopsis
  const genres = (details.data?.anime.genres.length ? details.data.anime.genres : anime.genres).slice(0, 4)
  const meta = [typeLabel(anime.type), anime.episodes ? `${anime.episodes} ${t('common.episodes')}` : null, seasonLabel(anime)].filter(Boolean)
  return (
    <div className="relative isolate -mt-(--header-h) pt-(--header-h)">
      <HeroBackdrop src={anime.imageUrl} />
      <div className="page-frame px-4 pb-12 pt-6 sm:px-6">
        <div className="mb-6 flex h-1 items-center text-[0.9375rem] font-medium text-muted-foreground">{label}</div>
        <div className="flex items-end gap-6">
          <TLink to={`/anime/${anime.malId}`} className="hidden shrink-0 sm:block">
            <div className="aspect-[2/3] w-44 overflow-hidden rounded-xl bg-muted shadow-2xl">
              {anime.imageUrl ? <Image src={anime.imageUrl} alt="" className="h-full w-full object-cover" /> : null}
            </div>
          </TLink>
          <div className="flex min-w-0 max-w-2xl flex-col gap-3">
            <h1 className="line-clamp-2 text-3xl font-semibold tracking-tight sm:text-4xl"><AnimeTitle anime={anime} /></h1>
            {genres.length ? (
              <div className="flex flex-wrap gap-1.5">
                {genres.map((g) => (
                  <span key={g} className="inline-flex h-6 items-center rounded-full bg-foreground/10 px-2.5 text-xs font-medium text-foreground/90">
                    {g}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {anime.score ? <Score value={anime.score} /> : null}
              {meta.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
            {synopsis ? (
              <p className="line-clamp-3 text-[0.9375rem] leading-relaxed text-foreground/80">{synopsis}</p>
            ) : details.isPending ? (
              <div className="text-[0.9375rem] leading-relaxed">
                <TextLine />
                <TextLine />
                <TextLine bar="w-2/3" />
              </div>
            ) : null}
            <div className="mt-1">
              <Button asChild variant="accent" size="lg">
                <TLink to={`/anime/${anime.malId}${episode ? `?episode=${episode}` : ''}`}>
                  <RiPlayLargeFill />
                  {episode ? `${t('common.episode')} ${episode}` : t('common.open')}
                </TLink>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function HomeHero({ data }: { data: HomeData }) {
  const { t } = useTranslation()
  const first = data.continueWatching.find((c) => !c.pending)
  if (first) return <Hero anime={first.anime} episode={first.episode} label={t('home.continue')} />
  const watching = data.watching[0]
  if (watching) return <Hero anime={watching.anime} episode={watching.progress + 1} label={t('home.watching')} />
  return null
}

export function HomePage() {
  const { t } = useTranslation()
  const { data, isPending } = useQuery({ queryKey: keys.home, queryFn: api.home })
  useDocumentTitle(t('nav.home'))
  const { showHero, homeSections } = useAppearance()

  if (isPending) return <HomeSkeleton />

  const empty = !data || (!data.continueWatching.length && !data.upcoming.length && !data.watching.length)

  const sections: Record<HomeSectionId, ReactNode> = {
    continue: data?.continueWatching.length ? (
      <Section
        title={t('home.continue')}
        icon={<RiPlayCircleFill />}
        hint={data.continueWatching.some((c) => c.pending) ? t('home.continueHint') : undefined}
      >
        <Rail>
          {data.continueWatching.map((item) => (
            <ContinueCard key={item.anime.malId} item={item} />
          ))}
        </Rail>
      </Section>
    ) : null,
    upcoming: data?.upcoming.length ? (
      <Section
        title={t('home.upcoming')}
        icon={<RiCalendarScheduleFill />}
        hint={t('home.upcomingHint')}
        action={
          <Button asChild variant="ghost" size="sm">
            <TLink to="/schedule">{t('nav.schedule')}</TLink>
          </Button>
        }
      >
        <UpcomingGrid>
          {data.upcoming.slice(0, 8).map((item) => (
            <UpcomingCard key={item.anime.malId} item={item} />
          ))}
        </UpcomingGrid>
      </Section>
    ) : null,
    activity: !empty ? <ActivityHeatmap /> : null,
    watching: data?.watching.length ? (
      <Section
        title={t('home.watching')}
        icon={<RiTv2Fill />}
        action={
          <Button asChild variant="ghost" size="sm">
            <TLink to="/lists?status=watching">{t('common.viewAll')}</TLink>
          </Button>
        }
      >
        <PosterGrid>
          {data.watching.map((e) => (
            <AnimeCard
              key={e.malId}
              anime={e.anime}
              progress={e.progress}
            />
          ))}
        </PosterGrid>
      </Section>
    ) : null,
  }

  return (
    <>
      {data && showHero ? <HomeHero data={data} /> : null}
      <Page>
        {empty ? (
          <EmptyState
            mood="sleepy"
            title={t('home.emptyTitle')}
            description={t('home.emptyText')}
            action={
              <div className="flex w-full max-w-xs flex-col gap-2 sm:w-auto sm:max-w-none sm:flex-row">
                <Button asChild variant="primary">
                  <TLink to="/search">
                    <RiSearchFill />
                    {t('home.find')}
                  </TLink>
                </Button>
                <Button asChild variant="secondary">
                  <TLink to="/settings/import">
                    <RiDownload2Fill />
                    {t('home.import')}
                  </TLink>
                </Button>
              </div>
            }
          />
        ) : null}

        {homeSections
          .filter((section) => section.visible)
          .map((section) => (
            <Fragment key={section.id}>{sections[section.id]}</Fragment>
          ))}
      </Page>
    </>
  )
}
