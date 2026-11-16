import { Button, EmptyState } from '@yoru/ui'
import { RiHome5Fill } from '@remixicon/react'
import { useTranslation } from 'react-i18next'
import { Page } from '../components/app-shell'
import { TLink } from '../components/transition-link'
import { useDocumentTitle } from '../lib/title'

export function NotFoundPage() {
  const { t } = useTranslation()
  useDocumentTitle(t('notFound.title'))
  return (
    <Page>
      <EmptyState
        mood="error"
        title={t('notFound.title')}
        description={t('notFound.text')}
        action={
          <Button asChild variant="accent">
            <TLink to="/">
              <RiHome5Fill />
              {t('notFound.home')}
            </TLink>
          </Button>
        }
      />
    </Page>
  )
}
