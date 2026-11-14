import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Card, Field, Input, Logo, Mascot } from '@yoru/ui'
import { type FormEvent, type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { api } from '../lib/api'
import { errorMessage, keys, useMe } from '../lib/queries'

export function AuthLayout({ title, subtitle, children }: { title?: ReactNode; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        {title ? (
          <div className="mb-8 flex flex-col items-center gap-4 text-center">
            <Mascot size={64} />
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
              {subtitle ? <p className="mt-1 text-[15px] text-muted-foreground">{subtitle}</p> : null}
            </div>
          </div>
        ) : null}
        <Card className="p-5">{children}</Card>
        <div className="mt-6 flex justify-center opacity-60">
          <Logo size={18} />
        </div>
      </div>
    </div>
  )
}

export function LoginPage() {
  const { t } = useTranslation()
  const { data: me } = useMe()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const client = useQueryClient()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const login = useMutation({
    mutationFn: () => api.login(username, password),
    onSuccess: (user) => {
      client.setQueryData(keys.me, user)
      navigate(params.get('next') || '/', { replace: true })
    },
  })
  if (me) return <Navigate to="/" replace />
  const submit = (e: FormEvent) => {
    e.preventDefault()
    login.mutate()
  }
  return (
    <AuthLayout>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t('auth.username')} htmlFor="username">
          <Input id="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
        </Field>
        <Field label={t('auth.password')} htmlFor="password" error={login.error ? errorMessage(login.error, t) : undefined}>
          <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <Button type="submit" variant="accent" loading={login.isPending} className="mt-1">
          {t('auth.login')}
        </Button>
      </form>
    </AuthLayout>
  )
}

export function InviteForm({ code, role }: { code: string; role: string | null }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const client = useQueryClient()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const register = useMutation({
    mutationFn: () => api.register(code, username, password),
    onSuccess: (user) => {
      client.setQueryData(keys.me, user)
      navigate('/', { replace: true })
    },
  })
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        register.mutate()
      }}
      className="flex flex-col gap-4"
    >
      {role === 'admin' ? (
        <Badge variant="accent" className="self-start">
          {t('auth.inviteAdmin')}
        </Badge>
      ) : null}
      <Field label={t('auth.username')} hint={t('auth.usernameHint')} htmlFor="username">
        <Input
          id="username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          pattern="[a-zA-Z0-9_.\-]{3,32}"
          autoFocus
          required
        />
      </Field>
      <Field label={t('auth.password')} hint={t('auth.passwordHint')} htmlFor="password" error={register.error ? errorMessage(register.error, t) : undefined}>
        <Input id="password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      <Button type="submit" variant="accent" loading={register.isPending} className="mt-1">
        {t('auth.register')}
      </Button>
    </form>
  )
}

export function InvitePageInner() {
  const { t } = useTranslation()
  const { code = '' } = useParams()
  const invite = useQuery({ queryKey: ['invite', code], queryFn: () => api.invite(code) })
  return (
    <AuthLayout title={t('auth.inviteTitle')} subtitle={t('auth.inviteSubtitle')}>
      {invite.isPending ? (
        <div className="h-40" />
      ) : invite.data?.valid ? (
        <InviteForm code={code} role={invite.data.role} />
      ) : (
        <div className="flex flex-col items-center gap-3 py-4 text-center text-sm text-muted-foreground">
          <Mascot mood="error" size={44} />
          {t('auth.inviteInvalid')}
        </div>
      )}
    </AuthLayout>
  )
}
