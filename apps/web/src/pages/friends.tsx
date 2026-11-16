import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, EmptyState, Input, Skeleton, toast } from '@yoru/ui'
import { RiCheckFill, RiCloseFill, RiSearchLine } from '@remixicon/react'
import { type ReactNode, useDeferredValue, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Page, PageHeader, Section } from '../components/app-shell'
import { api } from '../lib/api'
import { errorMessage } from '../lib/queries'
import { useDocumentTitle } from '../lib/title'
import { UserGrid } from './profile'

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

function PeopleSearch() {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const query = useDeferredValue(q.trim())
  const results = useQuery({ queryKey: ['users', query], queryFn: () => api.searchUsers(query), enabled: query.length > 0 })
  let content: ReactNode = null
  if (query && results.isPending) content = <Skeleton className="h-16 rounded-xl" />
  else if (query && !results.data?.length) content = <p className="px-1 text-sm text-muted-foreground">{t('friends.noResults')}</p>
  else if (results.data?.length) content = <UserGrid users={results.data} />
  return (
    <Section title={t('friends.search')} hint={t('friends.searchHint')}>
      <div className="relative mb-3 max-w-md">
        <RiSearchLine className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('friends.searchPlaceholder')} className="pl-9" />
      </div>
      {content}
    </Section>
  )
}

export function FriendsPage() {
  const { t } = useTranslation()
  useDocumentTitle(t('friends.title'))
  const overview = useQuery({ queryKey: ['friends'], queryFn: api.friends })
  const accept = useFriendMutation(api.addFriend)
  const remove = useFriendMutation(api.removeFriend)
  const data = overview.data
  return (
    <Page>
      <PageHeader title={t('friends.title')} description={t('friends.description')} />
      <div className="flex flex-col">
        {overview.isPending ? (
          <Skeleton className="h-32 rounded-xl" />
        ) : data ? (
          <>
            {data.incoming.length ? (
              <Section title={t('friends.incoming')}>
                <UserGrid
                  users={data.incoming}
                  action={(user) => (
                    <div className="flex shrink-0 gap-1">
                      <Button size="icon-sm" variant="accent" aria-label={t('profile.accept')} title={t('profile.accept')} onClick={() => accept.mutate(user.id)}>
                        <RiCheckFill />
                      </Button>
                      <Button size="icon-sm" variant="ghost" aria-label={t('profile.decline')} title={t('profile.decline')} onClick={() => remove.mutate(user.id)}>
                        <RiCloseFill />
                      </Button>
                    </div>
                  )}
                />
              </Section>
            ) : null}
            <Section title={t('friends.list')}>
              {data.friends.length ? <UserGrid users={data.friends} /> : <EmptyState mood="sleepy" title={t('friends.empty')} description={t('friends.emptyHint')} />}
            </Section>
            {data.outgoing.length ? (
              <Section title={t('friends.outgoing')}>
                <UserGrid
                  users={data.outgoing}
                  action={(user) => (
                    <Button size="sm" variant="ghost" onClick={() => remove.mutate(user.id)}>
                      {t('friends.cancel')}
                    </Button>
                  )}
                />
              </Section>
            ) : null}
          </>
        ) : null}
        <PeopleSearch />
      </div>
    </Page>
  )
}
