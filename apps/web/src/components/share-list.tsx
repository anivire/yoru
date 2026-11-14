import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ShareInfo } from '@yoru/shared'
import { Button, Input, Popover, PopoverContent, PopoverTrigger, Skeleton, toast } from '@yoru/ui'
import { RiExternalLinkFill, RiFileCopyFill, RiLinkUnlinkM, RiRefreshFill, RiShareFill } from '@remixicon/react'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { errorMessage } from '../lib/queries'

export function shareUrl(token: string) {
  return `${location.origin}/share/${token}`
}

export function ShareListButton() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const share = useQuery({ queryKey: ['share'], queryFn: api.share })
  const onSuccess = (data: ShareInfo) => client.setQueryData(['share'], data)
  const onError = (e: Error) => toast.error(errorMessage(e, t))
  const create = useMutation({ mutationFn: api.createShare, onSuccess, onError })
  const remove = useMutation({
    mutationFn: api.deleteShare,
    onSuccess: (data) => {
      onSuccess(data)
      toast.success(t('lists.share.disabled'))
    },
    onError,
  })
  const token = share.data?.token ?? null
  const copy = (value: string) => void navigator.clipboard?.writeText(value).then(() => toast.success(t('common.copied')))

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm">
          <RiShareFill />
          {t('lists.share.button')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,24rem)] p-4" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="text-sm font-semibold">{t('lists.share.title')}</div>
        <p className="mt-1 text-[0.8125rem] text-muted-foreground">{t('lists.share.hint')}</p>
        {share.isPending ? (
          <Skeleton className="mt-3 h-8 w-full" />
        ) : token ? (
          <div className="mt-3 flex flex-col gap-2">
            <div className="flex gap-2">
              <Input readOnly value={shareUrl(token)} onFocus={(e) => e.currentTarget.select()} className="h-8 font-mono text-xs" />
              <Button size="icon-sm" variant="accent" aria-label={t('common.copy')} onClick={() => copy(shareUrl(token))}>
                <RiFileCopyFill />
              </Button>
              <Button asChild size="icon-sm" variant="secondary" aria-label={t('lists.share.open')} title={t('lists.share.open')}>
                <a href={shareUrl(token)} target="_blank" rel="noreferrer">
                  <RiExternalLinkFill />
                </a>
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" loading={create.isPending} onClick={() => create.mutate()}>
                <RiRefreshFill />
                {t('lists.share.regenerate')}
              </Button>
              <Button size="sm" variant="ghost" loading={remove.isPending} onClick={() => remove.mutate()} className="hover:bg-danger-soft hover:text-danger">
                <RiLinkUnlinkM />
                {t('lists.share.disable')}
              </Button>
            </div>
            <p className="text-xs text-subtle-foreground">{t('lists.share.regenerateHint')}</p>
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
                  if (data.token) copy(shareUrl(data.token))
                },
              })
            }
          >
            <RiShareFill />
            {t('lists.share.create')}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}
