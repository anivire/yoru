import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type AvatarCrop, type ProfileSettings, type ProfileVisibility, type User, type Visibility } from '@yoru/shared'
import { Button, Card, Dialog, DialogContent, Input, Select, Skeleton, Switch, Textarea, cn, toast } from '@yoru/ui'
import { RiDeleteBin6Line, RiImageAddFill, RiZoomInLine, RiZoomOutLine } from '@remixicon/react'
import { type ChangeEvent, type ReactNode, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { errorMessage, keys, optimistic, useUser } from '../lib/queries'
import { Block } from './settings-block'
import { UserGrid } from './user-grid'
import { UserAvatar } from './user-avatar'

const AVATAR_SIZE = 256
const BIO_MAX = 300
const NAME_MAX = 40

const CROP_VIEW = 256
const MAX_GIF_BYTES = 4 * 1024 * 1024
const MAX_ZOOM = 3
const WHEEL_ZOOM = 0.002

interface Crop {
  x: number
  y: number
  zoom: number
}

function AvatarCropper({ file, src, pending, onCancel, onSave }: { file: File; src: string; pending: boolean; onCancel: () => void; onSave: (upload: { image: Blob; crop: AvatarCrop | null }) => void }) {
  const { t } = useTranslation()
  const image = useRef<HTMLImageElement>(null)
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [crop, setCrop] = useState<Crop>({ x: 0, y: 0, zoom: 1 })
  const scaleFor = (zoom: number, natural = size) => (natural ? (CROP_VIEW / Math.min(natural.w, natural.h)) * zoom : 1)
  const clamp = (x: number, y: number, zoom: number): Crop => {
    if (!size) return { x, y, zoom }
    const scale = scaleFor(zoom)
    return { x: Math.min(0, Math.max(CROP_VIEW - size.w * scale, x)), y: Math.min(0, Math.max(CROP_VIEW - size.h * scale, y)), zoom }
  }
  const zoomTo = (value: number) => {
    const zoom = Math.min(MAX_ZOOM, Math.max(1, value))
    const ratio = scaleFor(zoom) / scaleFor(crop.zoom)
    const center = CROP_VIEW / 2
    setCrop(clamp(center - (center - crop.x) * ratio, center - (center - crop.y) * ratio, zoom))
  }
  const save = () => {
    const el = image.current
    if (!el || !size) return
    const scale = scaleFor(crop.zoom)
    if (file.type === 'image/gif') {
      if (file.size > MAX_GIF_BYTES) {
        toast.error(t('profileSettings.avatarTooLarge'))
        return
      }
      const side = CROP_VIEW / scale
      onSave({ image: file, crop: { x: -crop.x / scale / side, y: -crop.y / scale / side, w: size.w / side, h: size.h / side } })
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = AVATAR_SIZE
    canvas.height = AVATAR_SIZE
    canvas.getContext('2d')!.drawImage(el, -crop.x / scale, -crop.y / scale, CROP_VIEW / scale, CROP_VIEW / scale, 0, 0, AVATAR_SIZE, AVATAR_SIZE)
    canvas.toBlob((blob) => (blob ? onSave({ image: blob, crop: null }) : toast.error(t('profileSettings.avatarInvalid'))), 'image/webp', 0.9)
  }
  const scale = scaleFor(crop.zoom)
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent title={t('profileSettings.cropTitle')} description={t('profileSettings.cropHint')}>
        <div className="flex flex-col items-center gap-5 px-4 pb-6 pt-2 sm:px-6">
          <div
            className="relative cursor-grab touch-none select-none overflow-hidden rounded-xl bg-black active:cursor-grabbing"
            style={{ width: CROP_VIEW, height: CROP_VIEW }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              drag.current = { px: e.clientX, py: e.clientY, x: crop.x, y: crop.y }
            }}
            onPointerMove={(e) => {
              const start = drag.current
              if (start) setCrop(clamp(start.x + e.clientX - start.px, start.y + e.clientY - start.py, crop.zoom))
            }}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            onWheel={(e) => zoomTo(crop.zoom - e.deltaY * WHEEL_ZOOM)}
          >
            <img
              ref={image}
              src={src}
              alt=""
              draggable={false}
              onLoad={(e) => {
                const natural = { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight }
                const fit = scaleFor(1, natural)
                setSize(natural)
                setCrop({ x: (CROP_VIEW - natural.w * fit) / 2, y: (CROP_VIEW - natural.h * fit) / 2, zoom: 1 })
              }}
              className={cn('absolute max-w-none', !size && 'invisible')}
              style={size ? { left: crop.x, top: crop.y, width: size.w * scale, height: size.h * scale } : undefined}
            />
            <div aria-hidden className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_999px_rgb(0_0_0/0.55)] ring-2 ring-white/70" />
          </div>
          <div className="flex w-full items-center gap-3 text-muted-foreground [&_svg]:size-4 [&_svg]:shrink-0" style={{ maxWidth: CROP_VIEW }}>
            <RiZoomOutLine />
            <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={crop.zoom} onChange={(e) => zoomTo(Number(e.target.value))} aria-label={t('profileSettings.cropZoom')} className="w-full cursor-pointer accent-accent" />
            <RiZoomInLine />
          </div>
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={onCancel}>
              {t('common.cancel')}
            </Button>
            <Button variant="accent" disabled={!size} loading={pending} onClick={save}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
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
  const [source, setSource] = useState<{ file: File; url: string } | null>(null)
  const close = () => {
    if (source) URL.revokeObjectURL(source.url)
    setSource(null)
  }
  const upload = useMutation({
    mutationFn: api.uploadAvatar,
    onSuccess: (next) => {
      done(next)
      close()
    },
    onError: (e) => toast.error(errorMessage(e, t)),
  })
  const remove = useMutation({ mutationFn: api.deleteAvatar, onSuccess: done, onError: (e) => toast.error(errorMessage(e, t)) })
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) setSource({ file, url: URL.createObjectURL(file) })
  }
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      {source ? <AvatarCropper key={source.url} file={source.file} src={source.url} pending={upload.isPending} onCancel={close} onSave={(result) => upload.mutate(result)} /> : null}
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

const PRIVACY_KEY = ['my-profile', 'privacy']

type Privacy = Partial<Pick<ProfileSettings, 'profileVisibility' | 'listVisibility' | 'statsVisibility' | 'friendsVisibility' | 'shareActivity'>>

function ProfileForm({ initial }: { initial: ProfileSettings }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [displayName, setDisplayName] = useState(initial.displayName ?? '')
  const [bio, setBio] = useState(initial.bio ?? '')
  const save = useMutation({
    scope: { id: 'my-profile' },
    mutationFn: api.updateProfile,
    onSuccess: (next) => {
      client.setQueryData(['my-profile'], next)
      void client.invalidateQueries({ queryKey: keys.me })
      void client.invalidateQueries({ queryKey: ['profile'] })
      toast.success(t('common.saved'))
    },
    onError: (e) => toast.error(errorMessage(e, t)),
  })
  const privacy = useMutation({
    mutationKey: PRIVACY_KEY,
    scope: { id: 'my-profile' },
    meta: optimistic,
    mutationFn: (body: Privacy) => api.updateProfile(body),
    onMutate: (body) => {
      void client.cancelQueries({ queryKey: ['my-profile'], exact: true })
      client.setQueryData<ProfileSettings>(['my-profile'], (prev) => (prev ? { ...prev, ...body } : prev))
    },
    onError: (e) => toast.error(errorMessage(e, t)),
    onSettled: () => {
      if (client.isMutating({ mutationKey: PRIVACY_KEY }) > 1) return
      void client.invalidateQueries({ queryKey: ['my-profile'] })
      void client.invalidateQueries({ queryKey: ['profile'] })
    },
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
            <Select value={initial.profileVisibility} onValueChange={(v) => privacy.mutate({ profileVisibility: v as ProfileVisibility })} options={(['everyone', 'friends'] as const).map(visibility)} className="sm:w-56" />
          </Row>
          <Row label={t('profileSettings.listVisibility')}>
            <Select value={initial.listVisibility} onValueChange={(v) => privacy.mutate({ listVisibility: v as Visibility })} options={(['everyone', 'friends', 'private'] as const).map(visibility)} className="sm:w-56" />
          </Row>
          <Row label={t('profileSettings.statsVisibility')}>
            <Select value={initial.statsVisibility} onValueChange={(v) => privacy.mutate({ statsVisibility: v as Visibility })} options={(['everyone', 'friends', 'private'] as const).map(visibility)} className="sm:w-56" />
          </Row>
          <Row label={t('profileSettings.friendsVisibility')}>
            <Select value={initial.friendsVisibility} onValueChange={(v) => privacy.mutate({ friendsVisibility: v as Visibility })} options={(['everyone', 'friends', 'private'] as const).map(visibility)} className="sm:w-56" />
          </Row>
          <label className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4">
            <span className="min-w-0">
              <span className="block text-sm">{t('profileSettings.shareActivity')}</span>
              <span className="block text-[0.8125rem] text-muted-foreground">{t('profileSettings.shareActivityHint')}</span>
            </span>
            <Switch checked={initial.shareActivity} onCheckedChange={(shareActivity) => privacy.mutate({ shareActivity })} />
          </label>
        </Card>
      </Block>
    </>
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
          menu={false}
          action={(user) => (
            <Button size="sm" variant="secondary" onClick={() => unblock.mutate(user.id)}>
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
      <BlockedUsers />
    </>
  )
}
