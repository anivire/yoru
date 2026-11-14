import { useQuery } from '@tanstack/react-query'
import type { AnimeSummary, HomeData } from '@yoru/shared'
import { Button, EmptyState, Image } from '@yoru/ui'
import { RiCalendarScheduleFill, RiDownload2Fill, RiPlayCircleFill, RiPlayLargeFill, RiSearchFill, RiTv2Fill } from '@remixicon/react'
import { Fragment, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { AnimeCard, ContinueCard, PosterGrid, Rail, UpcomingCard, UpcomingGrid } from '../components/anime-cards'
import { ActivityHeatmap } from '../components/activity'
import { HomeSkeleton } from '../components/skeletons'
import { Page, Section } from '../components/app-shell'
import { api } from '../lib/api'
import { useAppearance } from '../lib/appearance'
import type { HomeSectionId } from '../lib/navigation'
import { keys } from '../lib/queries'

function Hero({ anime, episode, label }: { anime: AnimeSummary; episode: number | null; label: string }) {
  const { t } = useTranslation()
  return (
    <div className="relative isolate -mt-(--header-h) overflow-hidden pt-(--header-h)">
      {anime.imageUrl ? (
        <img src={anime.imageUrl} alt="" className="absolute inset-0 -z-10 h-full w-full scale-110 object-cover object-[50%_30%] opacity-50 blur-xl" />
      ) : null}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/70 to-background/20" />
      <div className="mx-auto flex max-w-(--page-max) items-end gap-6 px-4 pb-6 pt-6 sm:px-6">
        {anime.imageUrl ? (
          <div className="hidden aspect-[2/3] w-36 shrink-0 overflow-hidden rounded-xl bg-muted shadow-2xl sm:block">
            <Image src={anime.imageUrl} alt="" className="h-full w-full object-cover" />
          </div>
        ) : null}
        <div className="min-w-0">
          <div className="text-[15px] font-medium text-muted-foreground">{label}</div>
          <h1 className="mt-1 line-clamp-2 text-3xl font-semibold tracking-tight sm:text-4xl">{anime.title}</h1>
          {anime.titleEnglish && anime.titleEnglish !== anime.title ? <div className="mt-1 truncate text-muted-foreground">{anime.titleEnglish}</div> : null}
          <div className="mt-5 flex gap-2">
            <Button asChild variant="accent" size="lg">
              <Link to={`/anime/${anime.malId}${episode ? `?episode=${episode}` : ''}`}>
                <RiPlayLargeFill />
                {episode ? `${t('common.episode')} ${episode}` : t('common.open')}
              </Link>
            </Button>
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
            <Link to="/schedule">{t('nav.schedule')}</Link>
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
            <Link to="/lists?status=watching">{t('common.viewAll')}</Link>
          </Button>
        }
      >
        <PosterGrid>
          {data.watching.map((e) => (
            <AnimeCard
              key={e.malId}
              anime={e.anime}
              progress={e.progress}
              newEpisodes={e.latestEpisode && e.latestEpisode > e.progress ? e.latestEpisode - e.progress : undefined}
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
              <div className="flex gap-2">
                <Button asChild variant="primary">
                  <Link to="/search">
                    <RiSearchFill />
                    {t('home.find')}
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link to="/settings/import">
                    <RiDownload2Fill />
                    {t('home.import')}
                  </Link>
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
