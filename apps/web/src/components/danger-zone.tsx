import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Dialog, DialogClose, DialogContent, DialogTrigger, Field, Input, toast } from '@yoru/ui'
import { RiDeleteBin6Fill, RiEraserFill } from '@remixicon/react'
import { type FormEvent, type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { api } from '../lib/api'
import { errorMessage, keys, useUser } from '../lib/queries'

function ConfirmAction({
  label,
  hint,
  button,
  title,
  icon,
  action,
  onDone,
}: {
  label: string
  hint: string
  button: string
  title: string
  icon: ReactNode
  action: (password: string) => Promise<unknown>
  onDone: () => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const mutation = useMutation({
    mutationFn: () => action(password),
    onSuccess: () => {
      setOpen(false)
      onDone()
    },
  })
  const change = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setPassword('')
      mutation.reset()
    }
  }
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <span>
        <span className="block text-sm">{label}</span>
        <span className="block text-[0.8125rem] text-muted-foreground">{hint}</span>
      </span>
      <Dialog open={open} onOpenChange={change}>
        <DialogTrigger asChild>
          <Button variant="danger" size="sm" className="shrink-0 self-start sm:self-auto">
            {icon}
            {button}
          </Button>
        </DialogTrigger>
        <DialogContent title={title} description={t('settings.danger.passwordPrompt')}>
          <form
            className="flex flex-col gap-4 px-6 pb-5 pt-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault()
              mutation.mutate()
            }}
          >
            <Field label={t('settings.currentPassword')} error={mutation.error ? errorMessage(mutation.error, t) : undefined}>
              <Input type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" variant="ghost" size="sm">
                  {t('common.cancel')}
                </Button>
              </DialogClose>
              <Button type="submit" variant="danger" size="sm" loading={mutation.isPending} disabled={!password}>
                {button}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function DangerZone() {
  const { t } = useTranslation()
  const user = useUser()
  const client = useQueryClient()
  const navigate = useNavigate()
  return (
    <Card className="divide-y divide-border py-1">
      <ConfirmAction
        label={t('settings.danger.clear')}
        hint={t('settings.danger.clearHint')}
        button={t('settings.danger.clearButton')}
        title={t('settings.danger.clearConfirm')}
        icon={<RiEraserFill />}
        action={api.clearData}
        onDone={() => {
          void client.invalidateQueries({ predicate: (q) => q.queryKey[0] !== keys.me[0] })
          toast.success(t('settings.danger.clearDone'))
        }}
      />
      <ConfirmAction
        label={t('settings.danger.delete')}
        hint={t('settings.danger.deleteHint')}
        button={t('settings.danger.deleteButton')}
        title={t('settings.danger.deleteConfirm', { username: user.username })}
        icon={<RiDeleteBin6Fill />}
        action={api.deleteAccount}
        onDone={() => {
          client.setQueryData(keys.me, null)
          client.clear()
          navigate('/login')
        }}
      />
    </Card>
  )
}
