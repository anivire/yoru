import { useQuery } from '@tanstack/react-query'
import { cn } from '@yoru/ui'
import { RiArrowUpCircleFill } from '@remixicon/react'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'

export function Footer({ scope, className }: { scope: 'app' | 'public'; className?: string }) {
  const { t } = useTranslation()
  const { data } = useQuery({ queryKey: ['version', scope], queryFn: api.version, staleTime: 30 * 60_000 })
  return (
    <footer className={cn('flex flex-wrap items-center justify-center gap-x-2 gap-y-2 py-6 text-sm text-muted-foreground', className)}>
      <span>
        yoru
        {data ? (
          <>
            {' · '}
            <a href={data.repoUrl} target="_blank" rel="noreferrer" className="hover:text-foreground">
              v{data.version}
            </a>
            {data.commit && data.commitUrl ? (
              <>
                {' '}
                <a href={data.commitUrl} target="_blank" rel="noreferrer" className="font-mono text-xs text-subtle-foreground hover:text-foreground">
                  {data.commit.slice(0, 7)}
                </a>
              </>
            ) : null}
          </>
        ) : null}
      </span>
      {data?.updateAvailable ? (
        <a
          href={data.compareUrl ?? data.repoUrl}
          target="_blank"
          rel="noreferrer"
          title={data.latest?.message}
          className="inline-flex h-6 items-center gap-1.5 rounded-full bg-accent-soft px-2.5 text-xs font-medium text-accent hover:bg-accent hover:text-accent-foreground"
        >
          <RiArrowUpCircleFill className="size-3.5" />
          {data.behindBy ? t('version.updateCount', { count: data.behindBy }) : t('version.update')}
        </a>
      ) : null}
    </footer>
  )
}
