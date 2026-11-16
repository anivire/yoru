import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ProfileSettings, ProfileVisibility, User, Visibility } from '@yoru/shared'
import { Button, Card, Input, Select, Skeleton, Switch, Textarea, toast } from '@yoru/ui'
import { RiDeleteBin6Line, RiImageAddFill } from '@remixicon/react'
import { type ChangeEvent, type ReactNode, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { errorMessage, keys, useUser } from '../lib/queries'
import { Block } from '../pages/settings'
import { UserGrid } from '../pages/profile'
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
        <p className="px-1 text-sm text-muted-foreground">{t('profileSettings.noBlocked')}</p>
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
