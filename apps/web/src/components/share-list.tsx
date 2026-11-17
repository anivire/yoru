import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ShareInfo, ShareKind } from '@yoru/shared'
import { Button, Input, Popover, PopoverContent, PopoverTrigger, Skeleton, Switch, toast } from '@yoru/ui'
import { RiBarChart2Fill, RiBookShelfFill, RiExternalLinkFill, RiFileCopyFill, RiLinkUnlinkM, RiRefreshFill, RiShareFill } from '@remixicon/react'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { errorMessage } from '../lib/queries'

const SHARE_KEY = ['share'] as const

export function shareUrl(token: string, kind: ShareKind = 'list') {
  return `${location.origin}/share/${token}${kind === 'stats' ? '?tab=stats' : ''}`
}

export function ShareButton({ kind }: { kind: ShareKind }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const share = useQuery({ queryKey: SHARE_KEY, queryFn: api.share })
  const onSuccess = (data: ShareInfo) => client.setQueryData(SHARE_KEY, data)
  const onError = (e: Error) => toast.error(errorMessage(e, t))
  const create = useMutation({ mutationFn: () => api.createShare({ [kind]: true }), onSuccess, onError })
  const update = useMutation({ mutationFn: api.updateShare, onSuccess, onError })
  const remove = useMutation({
    mutationFn: api.deleteShare,
    onSuccess: (data) => {
      onSuccess(data)
      toast.success(t('share.manage.disabled'))
    },
    onError,
  })
  const token = share.data?.token ?? null
  const url = token ? shareUrl(token, share.data?.[kind] ? kind : 'list') : ''
  const copy = (value: string) => void navigator.clipboard?.writeText(value).then(() => toast.success(t('common.copied')))
  const sections = [
    { key: 'list', icon: RiBookShelfFill, label: t('share.tabs.list'), hint: t('share.manage.listHint') },
    { key: 'stats', icon: RiBarChart2Fill, label: t('share.tabs.stats'), hint: t('share.manage.statsHint') },
  ] as const
  const toggles = (
    <div className="flex flex-col gap-1 rounded-lg bg-field p-1">
      {sections.map(({ key, icon: Icon, label, hint }) => (
        <label key={key} className="flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 hover:bg-field-hover">
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{label}</span>
            <span className="block text-xs text-muted-foreground">{hint}</span>
          </span>
          <Switch checked={share.data?.[key] ?? false} disabled={update.isPending} onCheckedChange={(on) => update.mutate({ [key]: on })} />
        </label>
      ))}
    </div>
  )

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm">
          <RiShareFill />
          {t('share.manage.button')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={16} className="w-[min(24rem,calc(100vw-2rem))] p-4" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="text-sm font-semibold">{t('share.manage.title')}</div>
        <p className="mt-1 text-[0.8125rem] text-muted-foreground">{t('share.manage.hint')}</p>
        {share.isPending ? (
          <Skeleton className="mt-3 h-8 w-full" />
        ) : token ? (
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex gap-2">
              <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="h-8 font-mono text-xs" />
              <Button size="icon-sm" variant="accent" aria-label={t('common.copy')} onClick={() => copy(url)}>
                <RiFileCopyFill />
              </Button>
              <Button asChild size="icon-sm" variant="secondary" aria-label={t('share.manage.open')} title={t('share.manage.open')}>
                <a href={url} target="_blank" rel="noreferrer">
                  <RiExternalLinkFill />
                </a>
              </Button>
            </div>
            {toggles}
            {!share.data?.list && !share.data?.stats ? <p className="text-xs text-danger">{t('share.manage.nothing')}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" loading={create.isPending} onClick={() => create.mutate()}>
                <RiRefreshFill />
                {t('share.manage.regenerate')}
              </Button>
              <Button size="sm" variant="ghost" loading={remove.isPending} onClick={() => remove.mutate()} className="hover:bg-danger-soft hover:text-danger">
                <RiLinkUnlinkM />
                {t('share.manage.disable')}
              </Button>
            </div>
            <p className="text-xs text-subtle-foreground">{t('share.manage.regenerateHint')}</p>
          </div>
        ) : (
          <Button
            size="sm"
            variant="accent"
            className="mt-3"
            loading={create.isPending}
            onClick={() =>
              create.mutate(undefined, {
                onSuccess: (data) => {
                  if (data.token) copy(shareUrl(data.token, kind))
                },
              })
            }
          >
            <RiShareFill />
            {t('share.manage.create')}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}
