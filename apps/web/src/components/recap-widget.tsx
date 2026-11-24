import { useQuery } from '@tanstack/react-query'
import { Button, Image, Skeleton } from '@yoru/ui'
import { RiArrowRightSLine, RiCheckboxCircleFill, RiPlayCircleFill, RiSparkling2Fill, RiTimeFill } from '@remixicon/react'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { TLink } from './transition-link'

export function RecapWidget({ username }: { username: string }) {
  const { t, i18n } = useTranslation()
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const recap = useQuery({ queryKey: ['profile', username, 'recap', null, tz], queryFn: () => api.profileRecap(username, null, tz) })
  if (recap.isPending) return <Skeleton className="h-36 rounded-xl" />
  const data = recap.data
  if (!data) return null
  const n = (value: number) => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 }).format(value)
  const stats = [
    { value: n(Math.round(data.minutes / 60)), label: t('recap.hours'), icon: <RiTimeFill className="text-accent" /> },
    { value: n(data.episodes), label: t('recap.episodes'), icon: <RiPlayCircleFill className="text-accent" /> },
    { value: n(data.completed), label: t('recap.completed'), icon: <RiCheckboxCircleFill className="text-success" /> },
  ]
  return (
    <section className="relative isolate overflow-hidden rounded-xl bg-surface p-4 sm:p-5">
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(90%_140%_at_100%_0%,color-mix(in_oklab,var(--accent)_28%,transparent),transparent_65%)]" />
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent [&_svg]:size-[1.125rem]">
            <RiSparkling2Fill />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{t('recap.titleYear', { year: data.year })}</h2>
            <p className="truncate text-xs text-muted-foreground">{data.inProgress ? t('recap.widgetInProgress') : t('recap.widgetHint')}</p>
          </div>
        </div>
        <Button asChild variant="accent" size="sm" className="shrink-0">
          <TLink to={`/u/${username}/recap/${data.year}`}>
            {t('recap.open')}
            <RiArrowRightSLine />
          </TLink>
        </Button>
      </div>
      <div className="mt-4 flex items-end justify-between gap-4">
        <div className="flex min-w-0 gap-5">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0">
              <div className="flex items-center gap-1.5 text-xl font-semibold tracking-tight tabular-nums [&_svg]:size-4 [&_svg]:shrink-0">
                {s.value}
                {s.icon}
              </div>
              <div className="truncate text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="hidden shrink-0 -space-x-3 min-[30rem]:flex">
          {data.top.slice(0, 3).map((item) =>
            item.anime.imageUrl ? <Image key={item.anime.malId} src={item.anime.imageUrl} alt="" className="h-14 w-10 rounded-md object-cover ring-2 ring-surface" /> : null,
          )}
        </div>
      </div>
    </section>
  )
}
