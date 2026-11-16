import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PROFILE_FAVORITES_MAX, type ProfileSettings, type ProfileUpdate, type ProfileVisibility, type User, type Visibility } from '@yoru/shared'
import { Button, Card, Image, Input, Select, Skeleton, Switch, Textarea, Tooltip, cn, toast } from '@yoru/ui'
import { RiAddFill, RiCheckFill, RiCloseFill, RiDeleteBin6Line, RiImageAddFill, RiImageFill, RiSearchFill } from '@remixicon/react'
import { type ChangeEvent, type ReactNode, useDeferredValue, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { errorMessage, keys, useUser } from '../lib/queries'
import { Block } from '../pages/settings'
import { UserGrid } from '../pages/profile'
import { AnimeTitle } from '../lib/anime-title'
import { UserAvatar } from './user-avatar'

const AVATAR_SIZE = 256
const BIO_MAX = 300
const NAME_MAX = 40

async function squareImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_SIZE
  canvas.height = AVATAR_SIZE
  canvas.getContext('2d')!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE)
  bitmap.close()
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('AVATAR_INVALID'))), 'image/webp', 0.9))
}

function Row({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <span className="min-w-0">
        <span className="block text-sm">{label}</span>
        {hint ? <span className="block text-[0.8125rem] text-muted-foreground">{hint}</span> : null}
      </span>
      {children}
    </div>
  )
}

function AvatarEditor() {
  const { t } = useTranslation()
  const user = useUser()
  const client = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const done = (next: User) => {
    client.setQueryData(keys.me, next)
    void client.invalidateQueries({ queryKey: ['profile'] })
  }
  const upload = useMutation({ mutationFn: async (file: File) => api.uploadAvatar(await squareImage(file)), onSuccess: done, onError: (e) => toast.error(errorMessage(e, t)) })
  const remove = useMutation({ mutationFn: api.deleteAvatar, onSuccess: done, onError: (e) => toast.error(errorMessage(e, t)) })
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) upload.mutate(file)
  }
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <UserAvatar user={user} className="size-16 text-2xl" />
      <div className="flex flex-wrap gap-2">
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={pick} />
        <Button variant="secondary" size="sm" loading={upload.isPending} onClick={() => input.current?.click()}>
          <RiImageAddFill />
          {t('profileSettings.avatarUpload')}
        </Button>
        {user.avatarUrl ? (
          <Button variant="ghost" size="sm" loading={remove.isPending} onClick={() => remove.mutate()}>
            <RiDeleteBin6Line />
            {t('profileSettings.avatarRemove')}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function ProfileForm({ initial }: { initial: ProfileSettings }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [displayName, setDisplayName] = useState(initial.displayName ?? '')
  const [bio, setBio] = useState(initial.bio ?? '')
  const save = useMutation({
    mutationFn: api.updateProfile,
    onSuccess: (next) => {
      client.setQueryData(['my-profile'], next)
      void client.invalidateQueries({ queryKey: keys.me })
      void client.invalidateQueries({ queryKey: ['profile'] })
      toast.success(t('common.saved'))
    },
    onError: (e) => toast.error(errorMessage(e, t)),
  })
  const dirty = displayName.trim() !== (initial.displayName ?? '') || bio.trim() !== (initial.bio ?? '')
  const visibility = (v: Visibility) => ({ value: v, label: t(`profileSettings.visibility.${v}`) })
  return (
    <>
      <Block title={t('profileSettings.title')} description={t('profileSettings.hint')}>
        <Card className="py-1">
          <AvatarEditor />
          <div className="flex flex-col gap-3 px-5 py-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm">{t('profileSettings.displayName')}</span>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={NAME_MAX} placeholder={t('profileSettings.displayNamePlaceholder')} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="flex justify-between text-sm">
                {t('profileSettings.bio')}
                <span className="text-xs tabular-nums text-subtle-foreground">
                  {bio.length}/{BIO_MAX}
                </span>
              </span>
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={BIO_MAX} placeholder={t('profileSettings.bioPlaceholder')} />
            </label>
            <Button variant="accent" className="self-end" disabled={!dirty} loading={save.isPending} onClick={() => save.mutate({ displayName: displayName.trim() || null, bio: bio.trim() || null })}>
              {t('common.save')}
            </Button>
          </div>
        </Card>
      </Block>
      <Block title={t('profileSettings.privacy')} description={t('profileSettings.privacyHint')}>
        <Card className="py-1">
          <Row label={t('profileSettings.profileVisibility')} hint={t('profileSettings.profileVisibilityHint')}>
            <Select value={initial.profileVisibility} onValueChange={(v) => save.mutate({ profileVisibility: v as ProfileVisibility })} options={(['everyone', 'friends'] as const).map(visibility)} className="sm:w-56" />
          </Row>
          <Row label={t('profileSettings.listVisibility')}>
            <Select value={initial.listVisibility} onValueChange={(v) => save.mutate({ listVisibility: v as Visibility })} options={(['everyone', 'friends', 'private'] as const).map(visibility)} className="sm:w-56" />
          </Row>
          <Row label={t('profileSettings.statsVisibility')}>
            <Select value={initial.statsVisibility} onValueChange={(v) => save.mutate({ statsVisibility: v as Visibility })} options={(['everyone', 'friends', 'private'] as const).map(visibility)} className="sm:w-56" />
          </Row>
          <label className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4">
            <span className="min-w-0">
              <span className="block text-sm">{t('profileSettings.shareActivity')}</span>
              <span className="block text-[0.8125rem] text-muted-foreground">{t('profileSettings.shareActivityHint')}</span>
            </span>
            <Switch checked={initial.shareActivity} onCheckedChange={(shareActivity) => save.mutate({ shareActivity })} />
          </label>
        </Card>
      </Block>
    </>
  )
}

const SHOWCASE_SUGGESTIONS = 24
const SHOWCASE_SKELETONS = 16

function ShowcaseEditor({ profile }: { profile: ProfileSettings }) {
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
    <Block title={t('profileSettings.showcase')} description={t('profileSettings.showcaseHint', { count: PROFILE_FAVORITES_MAX })}>
      <Card className="flex flex-col gap-6 p-5">
        <div className="grid grid-cols-5 gap-3 sm:max-w-xl">
          {Array.from({ length: PROFILE_FAVORITES_MAX }, (_, i) => {
            const anime = profile.favorites[i]
            if (!anime) return <div key={i} className="aspect-[2/3] rounded-xl border-2 border-dashed border-border" />
            const banner = profile.bannerMalId === anime.malId
            return (
              <div key={anime.malId} className={cn('group relative aspect-[2/3] overflow-hidden rounded-xl bg-muted', banner && 'ring-2 ring-accent ring-offset-2 ring-offset-surface')}>
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
          <div className="relative">
            <RiSearchFill className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('profileSettings.showcaseSearch')} className="h-11 rounded-xl pl-10 text-[0.9375rem]" />
          </div>
          <span className="text-[0.8125rem] text-muted-foreground">{query ? t('profileSettings.showcaseResults') : t('profileSettings.showcaseTop')}</span>
          {options.isPending ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] grid-rows-[auto_auto] auto-rows-[0] gap-x-3 overflow-hidden">
              {Array.from({ length: SHOWCASE_SKELETONS }, (_, i) => (
                <Skeleton key={i} className="mb-4 aspect-[2/3] rounded-xl" />
              ))}
            </div>
          ) : options.data?.items.length ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] grid-rows-[auto_auto] auto-rows-[0] gap-x-3 overflow-hidden px-1 pt-1 -mx-1 -mt-1">
              {options.data.items.map((entry) => {
                const pinned = ids.includes(entry.malId)
                return (
                  <button key={entry.malId} type="button" aria-pressed={pinned} onClick={() => toggle(entry.malId)} className="group flex cursor-pointer flex-col gap-1.5 pb-4 text-left">
                    <span className={cn('relative block aspect-[2/3] overflow-hidden rounded-xl bg-muted', pinned && 'ring-2 ring-accent ring-offset-2 ring-offset-surface')}>
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
      </Card>
    </Block>
  )
}

function BlockedUsers() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const blocked = useQuery({ queryKey: ['blocks'], queryFn: api.blocks })
  const unblock = useMutation({
    mutationFn: api.unblockUser,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['blocks'] })
      void client.invalidateQueries({ queryKey: ['profile'] })
    },
    onError: (e) => toast.error(errorMessage(e, t)),
  })
  return (
    <Block title={t('profileSettings.blocked')} description={t('profileSettings.blockedHint')}>
      {blocked.isPending ? (
        <Skeleton className="h-16 rounded-xl" />
      ) : blocked.data?.length ? (
        <UserGrid
          users={blocked.data}
          action={(user) => (
            <Button size="sm" variant="ghost" onClick={() => unblock.mutate(user.id)}>
              {t('profile.unblock')}
            </Button>
          )}
        />
      ) : (
        <Card className="px-5 py-4 text-sm text-muted-foreground">{t('profileSettings.noBlocked')}</Card>
      )}
    </Block>
  )
}

export function ProfileTab() {
  const profile = useQuery({ queryKey: ['my-profile'], queryFn: api.myProfile })
  return (
    <>
      {profile.data ? <ProfileForm key={`${profile.data.displayName}|${profile.data.bio}`} initial={profile.data} /> : <Skeleton className="h-64 rounded-xl" />}
      {profile.data ? <ShowcaseEditor profile={profile.data} /> : null}
      <BlockedUsers />
    </>
  )
}
