import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SessionInfo } from '@yoru/shared'
import { Badge, Button, Card, Skeleton, cn, toast } from '@yoru/ui'
import { RiComputerFill, RiLogoutBoxRFill, RiSmartphoneFill, RiTabletFill } from '@remixicon/react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { api } from '../lib/api'
import { formatDate, relativeTime } from '../lib/format'
import { errorMessage, keys } from '../lib/queries'

const BROWSERS: [RegExp, string][] = [
  [/YaBrowser\//, 'Yandex Browser'],
  [/Edg(A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Vivaldi\//, 'Vivaldi'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari'],
]

const SYSTEMS: [RegExp, string][] = [
  [/iPhone/, 'iPhone'],
  [/iPad/, 'iPad'],
  [/Android/, 'Android'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux'],
]

function describe(ua: string | null) {
  if (!ua) return { name: null, kind: 'desktop' as const }
  const browser = BROWSERS.find(([re]) => re.test(ua))?.[1]
  const system = SYSTEMS.find(([re]) => re.test(ua))?.[1]
  const kind = /iPad|Tablet/.test(ua) ? ('tablet' as const) : /Mobi|iPhone|Android/.test(ua) ? ('mobile' as const) : ('desktop' as const)
  const name = [browser, system].filter(Boolean).join(' · ') || null
  return { name, kind }
}

const DEVICE_ICONS = { desktop: RiComputerFill, mobile: RiSmartphoneFill, tablet: RiTabletFill }

function SessionRow({ session, onRevoke, pending }: { session: SessionInfo; onRevoke: () => void; pending: boolean }) {
  const { t } = useTranslation()
  const device = describe(session.userAgent)
  const Icon = DEVICE_ICONS[device.kind]
  const meta = [
    session.ip,
    session.lastSeenAt ? t('settings.sessions.lastSeen', { when: relativeTime(session.lastSeenAt) }) : null,
    t('settings.sessions.signedIn', { date: formatDate(session.createdAt, { dateStyle: 'medium' }) }),
  ].filter(Boolean)
  return (
    <div className="flex flex-col gap-3 rounded-lg px-3 py-2.5 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-field text-muted-foreground [&_svg]:size-5">
          <Icon />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium">{device.name ?? t('settings.sessions.unknownDevice')}</span>
            {session.current ? (
              <Badge size="sm" variant="success">
                {t('settings.sessions.current')}
              </Badge>
            ) : null}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground sm:truncate">{meta.join(' · ')}</div>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        loading={pending}
        onClick={onRevoke}
        aria-label={session.current ? t('settings.sessions.signOut') : t('settings.sessions.revoke')}
        title={session.current ? t('settings.sessions.signOut') : t('settings.sessions.revoke')}
        className={cn(
          'w-full shrink-0 bg-field hover:bg-danger-soft hover:text-danger sm:w-auto sm:bg-transparent',
          !session.current && 'sm:size-8 sm:px-0',
        )}
      >
        <RiLogoutBoxRFill />
        <span className={cn(!session.current && 'sm:hidden')}>{session.current ? t('settings.sessions.signOut') : t('settings.sessions.revoke')}</span>
      </Button>
    </div>
  )
}

export function SessionsList() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const navigate = useNavigate()
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: api.sessions })
  const revoke = useMutation({
    mutationFn: api.revokeSession,
    onSuccess: (r) => {
      if (r.signedOut) {
        client.setQueryData(keys.me, null)
        client.clear()
        navigate('/login')
        return
      }
      toast.success(t('settings.sessions.revoked'))
      void client.invalidateQueries({ queryKey: ['sessions'] })
    },
    onError: (e) => toast.error(errorMessage(e, t)),
  })
  const revokeOthers = useMutation({
    mutationFn: api.revokeOtherSessions,
    onSuccess: () => {
      toast.success(t('settings.sessions.othersRevoked'))
      void client.invalidateQueries({ queryKey: ['sessions'] })
    },
    onError: (e) => toast.error(errorMessage(e, t)),
  })
  const list = sessions.data ?? []
  return (
    <Card className="flex flex-col gap-1 p-1.5">
      {sessions.isPending
        ? [0, 1].map((i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5">
              <Skeleton className="size-10 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
            </div>
          ))
        : list.map((s) => (
            <SessionRow key={s.id} session={s} pending={revoke.isPending && revoke.variables === s.id} onRevoke={() => revoke.mutate(s.id)} />
          ))}
      {list.length > 1 ? (
        <div className="flex justify-end px-1.5 pb-1 pt-1">
          <Button variant="danger" size="sm" loading={revokeOthers.isPending} onClick={() => revokeOthers.mutate()}>
            <RiLogoutBoxRFill />
            {t('settings.sessions.revokeOthers')}
          </Button>
        </div>
      ) : null}
    </Card>
  )
}
