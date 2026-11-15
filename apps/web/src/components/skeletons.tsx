import { Skeleton, cn } from '@yoru/ui'
import { PosterGrid, Rail, UpcomingGrid } from './anime-cards'

export function TextLine({ className, bar }: { className?: string; bar?: string }) {
  return (
    <div className={cn('flex h-[1lh] items-center', className)}>
      <Skeleton className={cn('h-[0.75em] rounded-md', bar ?? 'w-full')} />
    </div>
  )
}

export function AnimeCardSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="aspect-[2/3] w-full rounded-xl" />
      <div className="px-0.5">
        <TextLine className="text-sm leading-snug" bar="w-4/5" />
        <TextLine className="mt-0.5 text-xs" bar="w-1/2" />
      </div>
    </div>
  )
}

export function PosterGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <PosterGrid>
      {Array.from({ length: count }, (_, i) => (
        <AnimeCardSkeleton key={i} />
      ))}
    </PosterGrid>
  )
}

export function PosterRailSkeleton({ count = 8 }: { count?: number }) {
  return (
    <Rail size="poster">
      {Array.from({ length: count }, (_, i) => (
        <AnimeCardSkeleton key={i} />
      ))}
    </Rail>
  )
}

export function SectionTitleSkeleton({ hint, icon }: { hint?: boolean; icon?: boolean }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      {icon ? <Skeleton className="size-9 shrink-0 rounded-xl" /> : null}
      <div>
        <TextLine className="text-xl font-semibold" bar="w-56" />
        {hint ? <TextLine className="text-[0.8125rem]" bar="w-32" /> : null}
      </div>
    </div>
  )
}

export function ContinueCardSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="aspect-video w-full rounded-xl" />
      <div className="px-0.5">
        <TextLine className="text-sm" bar="w-1/3" />
        <TextLine className="text-[0.8125rem]" bar="w-2/3" />
      </div>
    </div>
  )
}

export function UpcomingCardSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      <Skeleton className="aspect-video w-full rounded-xl" />
      <div className="px-0.5">
        <TextLine className="text-sm" bar="w-3/4" />
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <TextLine className="text-base" bar="w-20" />
          <TextLine className="text-[0.8125rem]" bar="w-16" />
        </div>
      </div>
    </div>
  )
}

export function HomeSkeleton() {
  return (
    <>
      <div className="page-frame px-4 pb-12 pt-6 sm:px-6">
        <div className="mb-6 flex h-1 items-center">
          <TextLine className="text-[0.9375rem]" bar="w-40" />
        </div>
        <div className="flex items-end gap-6">
          <Skeleton className="hidden aspect-[2/3] w-44 shrink-0 rounded-xl sm:block" />
          <div className="flex w-full max-w-2xl min-w-0 flex-col gap-3">
            <TextLine className="text-3xl sm:text-4xl" bar="w-2/3" />
            <div className="flex gap-1.5">
              {[16, 20, 14].map((w) => (
                <Skeleton key={w} className="h-6 rounded-full" style={{ width: `${w * 0.25}rem` }} />
              ))}
            </div>
            <TextLine className="text-sm" bar="w-48" />
            <div className="text-[0.9375rem] leading-relaxed">
              <TextLine />
              <TextLine />
              <TextLine bar="w-2/3" />
            </div>
            <Skeleton className="mt-1 h-11 w-36 rounded-full" />
          </div>
        </div>
      </div>
      <div className="page-frame w-full px-4 pb-8 pt-4 sm:px-6 sm:pt-(--page-top,2rem)">
        <section>
          <SectionTitleSkeleton icon />
          <Rail>
            {Array.from({ length: 4 }, (_, i) => (
              <ContinueCardSkeleton key={i} />
            ))}
          </Rail>
        </section>
        <section className="mt-10">
          <SectionTitleSkeleton hint icon />
          <UpcomingGrid>
            {Array.from({ length: 4 }, (_, i) => (
              <UpcomingCardSkeleton key={i} />
            ))}
          </UpcomingGrid>
        </section>
        <section className="mt-10">
          <SectionTitleSkeleton icon />
          <PosterGridSkeleton count={6} />
        </section>
      </div>
    </>
  )
}

export function AnimePageSkeleton() {
  return (
    <>
      <div className="page-frame px-4 pb-10 pt-4 sm:px-6 sm:pt-(--page-top,2.5rem)">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:gap-6">
          <div className="flex w-36 shrink-0 flex-col gap-3 sm:w-48">
            <Skeleton className="aspect-[2/3] w-full rounded-xl" />
            <Skeleton className="hidden h-8 w-full rounded-lg sm:block" />
            <div className="hidden flex-col gap-0.5 sm:flex">
              {[28, 20, 16, 14, 24].map((w) => (
                <div key={w} className="flex h-9 items-center gap-3">
                  <Skeleton className="size-6 shrink-0 rounded-md" />
                  <Skeleton className="h-3 rounded-full" style={{ width: `${w * 0.25}rem` }} />
                </div>
              ))}
            </div>
          </div>
          <div className="flex w-full min-w-0 flex-1 flex-col items-center gap-3 sm:items-stretch">
            <div className="flex w-full flex-col items-center sm:items-start">
              <TextLine className="w-full justify-center text-2xl font-semibold sm:justify-start sm:text-4xl" bar="w-2/3" />
              <TextLine className="mt-1 w-full justify-center text-base sm:justify-start sm:text-lg" bar="w-1/2" />
              <TextLine className="w-full justify-center text-sm sm:justify-start" bar="w-1/4" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <TextLine className="text-sm" bar="w-40" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[16, 20, 14, 18].map((w) => (
                <Skeleton key={w} className="h-6 rounded-full" style={{ width: `${w * 0.25}rem` }} />
              ))}
            </div>
            <div className="max-w-3xl text-[0.9375rem] leading-relaxed">
              <TextLine />
              <TextLine />
              <TextLine />
              <TextLine bar="w-3/5" />
            </div>
          </div>
        </div>
      </div>
      <div className="page-frame w-full px-4 pb-8 pt-4 sm:px-6 sm:pt-(--page-top,2rem)">
        <TextLine className="mb-4 text-xl font-semibold" bar="w-24" />
        <div className="mb-12 flex gap-4 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-video w-72 shrink-0 rounded-xl" />
          ))}
        </div>
        <TextLine className="mb-4 text-xl font-semibold" bar="w-40" />
        <div className="mb-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Skeleton className="h-10 w-full rounded-xl sm:w-40" />
          <Skeleton className="h-10 w-full rounded-xl sm:w-56" />
          <Skeleton className="size-10 rounded-xl sm:order-last sm:ml-auto sm:w-48" />
          <Skeleton className="col-span-3 h-10 w-full rounded-xl sm:w-72" />
        </div>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Skeleton className="aspect-video w-full rounded-xl" />
          <div className="flex flex-col gap-1">
            <TextLine className="mb-3 text-sm" bar="w-24" />
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex gap-3 p-1.5">
                <Skeleton className="aspect-video w-36 shrink-0 rounded-lg" />
                <div className="flex-1 py-0.5">
                  <TextLine className="text-[0.8125rem]" bar="w-1/3" />
                  <TextLine className="text-sm leading-snug" bar="w-4/5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

function ScheduleEntrySkeleton() {
  return (
    <div className="flex items-center gap-2 p-1">
      <Skeleton className="aspect-[2/3] w-7 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1 leading-tight">
        <TextLine className="text-xs" bar="w-4/5" />
        <TextLine className="mt-0.5 text-[0.6875rem]" bar="w-1/2" />
      </div>
    </div>
  )
}

export function ScheduleSkeleton() {
  return (
    <>
      <div className="hidden md:block">
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }, (_, i) => (
            <div key={i} className="flex min-h-28 flex-col gap-0.5 rounded-xl bg-surface p-1.5">
              <div className="flex h-7 items-center gap-2 px-1">
                <Skeleton className="size-6 rounded-full" />
                <TextLine className="text-xs" bar="w-6" />
              </div>
              {Array.from({ length: (i * 7) % 4 }, (_, j) => (
                <ScheduleEntrySkeleton key={j} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-6 md:hidden">
        {[4, 2].map((count, d) => (
          <section key={d}>
            <TextLine className="mb-2 text-sm font-semibold" bar="w-48" />
            <div className="flex flex-col gap-0.5 rounded-xl bg-surface p-1.5">
              {Array.from({ length: count }, (_, i) => (
                <ScheduleEntrySkeleton key={i} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  )
}

export function ListTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="rounded-2xl bg-surface p-1.5">
      <div className="px-3 pb-1.5 pt-2">
        <TextLine className="text-xs" bar="w-24" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2">
          <Skeleton className="h-14 w-10 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1">
            <TextLine className="text-sm" bar="w-1/3" />
            <TextLine className="mt-0.5 text-xs" bar="w-24" />
          </div>
          <TextLine className="hidden text-[0.8125rem] md:flex" bar="w-20" />
          <TextLine className="text-[0.8125rem]" bar="w-12" />
        </div>
      ))}
    </div>
  )
}
