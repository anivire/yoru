import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { User } from '@yoru/shared'
import { cn, toast } from '@yoru/ui'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { errorMessage, keys } from '../lib/queries'

export function useUpdateUser() {
  const client = useQueryClient()
  const { t } = useTranslation()
  return useMutation({
    mutationFn: api.updateSettings,
    onSuccess: (user: User) => {
      client.setQueryData(keys.me, user)
      toast.success(t('common.saved'))
    },
    onError: (e) => toast.error(errorMessage(e, t)),
  })
}

export function Block({ title, description, children, className }: { title: ReactNode; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('mt-10 first:mt-0', className)}>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  )
}
