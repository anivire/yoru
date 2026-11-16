import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, EmptyState, Input, Segmented, toast } from '@yoru/ui'
import { RiCheckFill, RiCloseFill, RiGroupFill, RiSearchLine, RiUserReceivedFill } from '@remixicon/react'
import { type ReactNode, useDeferredValue, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Page, PageHeader, Section } from '../components/app-shell'
import { api } from '../lib/api'
import { errorMessage } from '../lib/queries'
import { useDocumentTitle } from '../lib/title'
import { UserGrid, UserGridSkeleton } from './profile'

function useFriendMutation(fn: (id: number) => Promise<unknown>) {
  const { t } = useTranslation()
  const client = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['friends'] })
      void client.invalidateQueries({ queryKey: ['profile'] })
    },
    onError: (e) => toast.error(errorMessage(e, t)),
  })
}

type View = 'friends' | 'requests' | 'search'

function PeopleSearch() {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const query = useDeferredValue(q.trim())
  const results = useQuery({ queryKey: ['users', query], queryFn: () => api.searchUsers(query) })
  let content: ReactNode = null
  if (results.isPending) content = <UserGridSkeleton />
  else if (!results.data?.length) content = <EmptyState mood="thinking" title={query ? t('friends.noResults') : t('friends.noUsers')} />
  else content = <UserGrid users={results.data} />
  return (
    <div className="grow-empty flex flex-col gap-4">
      <div className="relative">
        <RiSearchLine className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('friends.searchPlaceholder')} className="h-11 rounded-xl pl-10" autoFocus />
      </div>
      {content}
    </div>
  )
}

export function FriendsPage() {
  const { t } = useTranslation()
  useDocumentTitle(t('friends.title'))
  const overview = useQuery({ queryKey: ['friends'], queryFn: api.friends })
  const accept = useFriendMutation(api.addFriend)
  const remove = useFriendMutation(api.removeFriend)
  const data = overview.data
  const [view, setView] = useState<View>('friends')
  const requests = (data?.incoming.length ?? 0) + (data?.outgoing.length ?? 0)
  return (
    <Page>
      <PageHeader title={t('friends.title')} description={t('friends.description')} />
      <Segmented
        className="mb-6"
        value={view}
        onChange={setView}
        options={[
          { value: 'friends', label: t('friends.list'), icon: <RiGroupFill />, count: data?.friends.length },
          { value: 'requests', label: t('friends.requests'), icon: <RiUserReceivedFill />, count: requests || undefined },
          { value: 'search', label: t('friends.search'), icon: <RiSearchLine /> },
        ]}
      />
      {view === 'search' ? (
        <PeopleSearch />
      ) : overview.isPending ? (
        <UserGridSkeleton />
      ) : !data ? null : view === 'friends' ? (
        data.friends.length ? (
          <UserGrid users={data.friends} />
        ) : (
          <EmptyState mood="sleepy" title={t('friends.empty')} description={t('friends.emptyHint')} action={
              <Button variant="accent" onClick={() => setView('search')}>
                <RiSearchLine />
                {t('friends.search')}
              </Button>
            } />
        )
      ) : !requests ? (
        <EmptyState mood="sleepy" title={t('friends.noRequests')} />
      ) : (
        <div className="flex flex-col">
          {data.incoming.length ? (
            <Section title={t('friends.incoming')}>
              <UserGrid
                users={data.incoming}
                action={(user) => (
                  <>
                    <Button size="icon-sm" variant="accent" aria-label={t('profile.accept')} title={t('profile.accept')} onClick={() => accept.mutate(user.id)}>
                      <RiCheckFill />
                    </Button>
                    <Button size="icon-sm" variant="secondary" aria-label={t('profile.decline')} title={t('profile.decline')} onClick={() => remove.mutate(user.id)}>
                      <RiCloseFill />
                    </Button>
                  </>
                )}
              />
            </Section>
          ) : null}
          {data.outgoing.length ? (
            <Section title={t('friends.outgoing')}>
              <UserGrid
                users={data.outgoing}
                action={(user) => (
                  <Button size="sm" variant="secondary" onClick={() => remove.mutate(user.id)}>
                    {t('friends.cancel')}
                  </Button>
                )}
              />
            </Section>
          ) : null}
        </div>
      )}
    </Page>
  )
}
