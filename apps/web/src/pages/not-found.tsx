import { Button, EmptyState } from '@yoru/ui'
import { House } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Page } from '../components/app-shell'

export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <Page>
      <EmptyState
        mood="error"
        title={
          <>
            <span className="block font-mono text-sm text-subtle-foreground">404</span>
            {t('notFound.title')}
          </>
        }
        description={t('notFound.text')}
        action={
          <Button asChild variant="accent">
            <Link to="/">
              <House />
              {t('notFound.home')}
            </Link>
          </Button>
        }
      />
    </Page>
  )
}
