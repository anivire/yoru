import { Navigate } from 'react-router'
import { useMe } from '../lib/queries'
import { InvitePageInner } from './login'

export function InvitePage() {
  const { data: me } = useMe()
  if (me) return <Navigate to="/" replace />
  return <InvitePageInner />
}
