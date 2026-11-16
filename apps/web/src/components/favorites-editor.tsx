import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PROFILE_FAVORITES_MAX, type ProfileSettings, type ProfileUpdate } from '@yoru/shared'
import { Button, Dialog, DialogContent, DialogTrigger, Image, Input, Skeleton, Tooltip, cn, toast } from '@yoru/ui'
import { RiAddFill, RiCheckFill, RiCloseFill, RiEdit2Fill, RiImageFill, RiSearchFill } from '@remixicon/react'
import { useDeferredValue, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimeTitle } from '../lib/anime-title'
import { api } from '../lib/api'
import { errorMessage } from '../lib/queries'

const SHOWCASE_SUGGESTIONS = 24
const SHOWCASE_SKELETONS = 12

function Editor({ profile }: { profile: ProfileSettings }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [q, setQ] = useState('')
  const query = useDeferredValue(q.trim())
  const options = useQuery({
    queryKey: ['list', 'showcase', query],
    queryFn: () => api.list({ q: query || undefined, sort: 'score', limit: SHOWCASE_SUGGESTIONS }),
    placeholderData: keepPreviousData,
  })
  const known = new Map([...profile.favorites, ...(options.data?.items.map((e) => e.anime) ?? [])].map((a) => [a.malId, a]))
  const save = useMutation({
    mutationFn: (body: ProfileUpdate) => api.updateProfile(body),
    onMutate: (body) => {
      const previous = client.getQueryData<ProfileSettings>(['my-profile'])
      if (previous) {
        client.setQueryData<ProfileSettings>(['my-profile'], {
          ...previous,
          ...(body.favorites ? { favorites: body.favorites.flatMap((id) => known.get(id) ?? []) } : {}),
          ...(body.bannerMalId !== undefined ? { bannerMalId: body.bannerMalId } : {}),
        })
      }
      return { previous }
    },
    onSuccess: (next) => {
      client.setQueryData(['my-profile'], next)
      void client.invalidateQueries({ queryKey: ['profile'] })
    },
    onError: (e, _body, context) => {
      if (context?.previous) client.setQueryData(['my-profile'], context.previous)
      toast.error(errorMessage(e, t))
    },
  })
  const ids = profile.favorites.map((a) => a.malId)
  const full = ids.length >= PROFILE_FAVORITES_MAX
  const remove = (malId: number) => save.mutate({ favorites: ids.filter((id) => id !== malId), ...(profile.bannerMalId === malId ? { bannerMalId: null } : {}) })
  const toggle = (malId: number) => {
    if (ids.includes(malId)) remove(malId)
    else if (full) toast.error(t('profileSettings.showcaseFull', { count: PROFILE_FAVORITES_MAX }))
    else save.mutate({ favorites: [...ids, malId] })
  }
  return (
    <div className="flex flex-col gap-5">
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: PROFILE_FAVORITES_MAX }, (_, i) => {
            const anime = profile.favorites[i]
            if (!anime) return <div key={i} className="aspect-[2/3] rounded-xl border-2 border-dashed border-border" />
            const banner = profile.bannerMalId === anime.malId
            return (
              <div key={anime.malId} className={cn('group relative aspect-[2/3] overflow-hidden rounded-xl bg-muted', banner && 'ring-2 ring-accent ring-offset-2 ring-offset-popover')}>
                {anime.imageUrl ? <Image src={anime.imageUrl} alt="" className="size-full object-cover" /> : null}
                <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1.5 bg-linear-to-t from-black/80 to-transparent px-1 pb-2 pt-6 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                  <Tooltip content={banner ? t('profileSettings.removeBanner') : t('profileSettings.useAsBanner')}>
                    <button type="button" aria-pressed={banner} aria-label={banner ? t('profileSettings.removeBanner') : t('profileSettings.useAsBanner')} onClick={() => save.mutate({ bannerMalId: banner ? null : anime.malId })} className={cn('grid size-7 cursor-pointer place-items-center rounded-full text-white [&_svg]:size-4', banner ? 'bg-accent text-accent-foreground' : 'bg-white/20 hover:bg-white/30')}>
                      <RiImageFill />
                    </button>
                  </Tooltip>
                  <Tooltip content={t('profileSettings.unpin')}>
                    <button type="button" aria-label={t('profileSettings.unpin')} onClick={() => remove(anime.malId)} className="grid size-7 cursor-pointer place-items-center rounded-full bg-white/20 text-white hover:bg-white/30 [&_svg]:size-4">
                      <RiCloseFill />
                    </button>
                  </Tooltip>
                </div>
                {banner ? <span className="absolute left-1.5 top-1.5 rounded-md bg-accent px-1.5 py-0.5 text-[0.625rem] font-semibold text-accent-foreground">{t('profileSettings.isBanner')}</span> : null}
              </div>
            )
          })}
        </div>
        <div className="flex flex-col gap-3">
          <div className="sticky top-0 z-10 -mx-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border bg-popover px-6 py-3">
            <span className="text-sm font-semibold">{query ? t('profileSettings.showcaseResults') : t('profileSettings.showcaseTop')}</span>
            <div className="relative w-full sm:w-64">
              <RiSearchFill className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('profileSettings.showcaseSearch')} className="h-9 rounded-lg pl-9 text-sm" />
            </div>
          </div>
          {options.isPending ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-x-3">
              {Array.from({ length: SHOWCASE_SKELETONS }, (_, i) => (
                <Skeleton key={i} className="mb-4 aspect-[2/3] rounded-xl" />
              ))}
            </div>
          ) : options.data?.items.length ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-x-3">
              {options.data.items.map((entry) => {
                const pinned = ids.includes(entry.malId)
                return (
                  <button key={entry.malId} type="button" aria-pressed={pinned} onClick={() => toggle(entry.malId)} className="group flex cursor-pointer flex-col gap-1.5 pb-4 text-left">
                    <span className={cn('relative block aspect-[2/3] overflow-hidden rounded-xl bg-muted', pinned && 'ring-2 ring-accent ring-offset-2 ring-offset-popover')}>
                      {entry.anime.imageUrl ? <Image src={entry.anime.imageUrl} alt="" className="size-full object-cover transition-[filter] group-hover:brightness-110" /> : null}
                      <span className={cn('absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full transition-opacity [&_svg]:size-4', pinned ? 'bg-accent text-accent-foreground' : 'bg-black/60 text-white opacity-0 group-hover:opacity-100')}>
                        {pinned ? <RiCheckFill /> : <RiAddFill />}
                      </span>
                    </span>
                    <span className="line-clamp-2 text-xs font-medium leading-snug">
                      <AnimeTitle anime={entry.anime} />
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('profileSettings.showcaseNothing')}</p>
          )}
        </div>
    </div>
  )
}

export function FavoritesDialog() {
  const { t } = useTranslation()
  const profile = useQuery({ queryKey: ['my-profile'], queryFn: api.myProfile })
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <RiEdit2Fill />
          {t('profile.editFavorites')}
        </Button>
      </DialogTrigger>
      <DialogContent title={t('profileSettings.showcase')} description={t('profileSettings.showcaseHint', { count: PROFILE_FAVORITES_MAX })} className="w-[min(92vw,44rem)]">
        <div className="px-6 pb-6 pt-2">{profile.data ? <Editor profile={profile.data} /> : <Skeleton className="h-96 rounded-xl" />}</div>
      </DialogContent>
    </Dialog>
  )
}
