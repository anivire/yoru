import { Button, EmptyState } from '@yoru/ui'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Page } from '../components/app-shell'

export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <Page>
      <EmptyState
        mood="error"
        title="404"
        action={
          <Button asChild variant="secondary">
            <Link to="/">{t('nav.home')}</Link>
          </Button>
        }
      />
    </Page>
  )
}
