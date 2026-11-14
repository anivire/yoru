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

export function SectionTitleSkeleton({ hint }: { hint?: boolean }) {
  return (
    <div className="mb-4">
      <TextLine className="text-xl font-semibold" bar="w-56" />
      {hint ? <TextLine className="text-[13px]" bar="w-32" /> : null}
    </div>
  )
}

export function ContinueCardSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="aspect-video w-full rounded-xl" />
      <div className="px-0.5">
        <TextLine className="text-sm" bar="w-1/3" />
        <TextLine className="text-[13px]" bar="w-2/3" />
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
          <TextLine className="text-[13px]" bar="w-16" />
        </div>
      </div>
    </div>
  )
}

export function HomeSkeleton() {
  return (
    <>
      <div className="mx-auto flex max-w-7xl items-end gap-6 px-4 pb-6 pt-6 wide:max-w-none sm:px-6">
        <Skeleton className="hidden aspect-[2/3] w-36 shrink-0 rounded-xl sm:block" />
        <div className="w-full min-w-0">
          <TextLine className="text-[15px]" bar="w-40" />
          <TextLine className="mt-1 text-3xl sm:text-4xl" bar="w-2/3" />
          <TextLine className="mt-1" bar="w-1/3" />
          <Skeleton className="mt-5 h-11 w-36 rounded-full" />
        </div>
      </div>
      <div className="mx-auto w-full max-w-7xl px-4 pb-8 pt-4 wide:max-w-none sm:px-6 sm:pt-8">
        <section>
          <SectionTitleSkeleton />
          <Rail>
            {Array.from({ length: 4 }, (_, i) => (
              <ContinueCardSkeleton key={i} />
            ))}
          </Rail>
        </section>
        <section className="mt-10">
          <SectionTitleSkeleton hint />
          <UpcomingGrid>
            {Array.from({ length: 4 }, (_, i) => (
              <UpcomingCardSkeleton key={i} />
            ))}
          </UpcomingGrid>
        </section>
        <section className="mt-10">
          <SectionTitleSkeleton />
          <PosterGridSkeleton count={6} />
        </section>
      </div>
    </>
  )
}

export function AnimePageSkeleton() {
  return (
    <>
      <div className="mx-auto max-w-7xl px-4 pb-10 pt-4 wide:max-w-none sm:px-6 sm:pt-10">
        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="flex w-full shrink-0 flex-col gap-2 self-start sm:w-48">
            <Skeleton className="aspect-[2/3] w-full rounded-xl" />
            <Skeleton className="h-8 w-full rounded-md" />
            <div className="mt-1 grid grid-cols-2 gap-1.5 sm:grid-cols-1">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-8 w-full rounded-md" />
              ))}
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div>
              <TextLine className="text-3xl font-semibold sm:text-4xl" bar="w-2/3" />
              <TextLine className="mt-1 text-lg" bar="w-1/2" />
              <TextLine className="text-sm" bar="w-1/4" />
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
            <div className="max-w-3xl text-[15px] leading-relaxed">
              <TextLine />
              <TextLine />
              <TextLine />
              <TextLine bar="w-3/5" />
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto w-full max-w-7xl px-4 pb-8 pt-4 wide:max-w-none sm:px-6 sm:pt-8">
        <TextLine className="mb-4 text-xl font-semibold" bar="w-40" />
        <div className="mb-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Skeleton className="h-8 w-full rounded-md sm:w-36" />
          <Skeleton className="h-8 w-full rounded-md sm:w-40" />
          <Skeleton className="col-span-2 h-8 w-full rounded-md sm:w-64" />
        </div>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Skeleton className="aspect-video w-full rounded-xl" />
          <div className="flex flex-col gap-1">
            <TextLine className="mb-3 text-sm" bar="w-24" />
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex gap-3 p-1.5">
                <Skeleton className="aspect-video w-36 shrink-0 rounded-lg" />
                <div className="flex-1 py-0.5">
                  <TextLine className="text-[13px]" bar="w-1/3" />
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

export function ScheduleSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      {[6, 3].map((count, d) => (
        <section key={d}>
          <TextLine className="mb-3 text-lg font-semibold" bar="w-64" />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: count }, (_, i) => (
              <div key={i} className="flex items-center gap-4 rounded-xl bg-surface p-2.5 pr-4">
                <Skeleton className="aspect-[2/3] w-20 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] leading-snug">
                    <TextLine />
                    <TextLine bar="w-2/3" />
                  </div>
                  <TextLine className="mt-1 text-[13px]" bar="w-1/3" />
                </div>
                <TextLine className="font-mono text-sm" bar="w-14" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export function ListTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl bg-surface">
      <div className="flex h-[2.375rem] items-center bg-inset px-4">
        <TextLine className="text-xs" bar="w-24" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-2.5">
          <Skeleton className="h-12 w-8 shrink-0 rounded" />
          <div className="min-w-0 flex-1">
            <TextLine className="text-sm" bar="w-1/3" />
            <TextLine className="text-xs" bar="w-24" />
          </div>
          <TextLine className="hidden text-[13px] md:flex" bar="w-20" />
          <TextLine className="font-mono text-[13px]" bar="w-12" />
        </div>
      ))}
    </div>
  )
}
