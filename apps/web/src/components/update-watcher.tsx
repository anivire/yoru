import { Button, Mascot, toast } from '@yoru/ui'
import { RiRefreshFill } from '@remixicon/react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

const POLL_MS = 60_000

async function fetchBuild(): Promise<string | null> {
  try {
    const res = await fetch('/api/build', { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { version: string; commit: string | null }
    return `${data.version}:${data.commit ?? ''}`
  } catch {
    return null
  }
}

export function UpdateWatcher() {
  const { t } = useTranslation()
  useEffect(() => {
    let baseline: string | null = null
    let notified = false
    const check = async () => {
      if (notified || document.hidden) return
      const build = await fetchBuild()
      if (!build) return
      if (!baseline) {
        baseline = build
        return
      }
      if (build === baseline) return
      notified = true
      toast.custom(
        (id) => (
          <div className="flex w-[min(calc(100vw-2rem),22rem)] gap-3 rounded-xl bg-raised p-4 font-sans text-foreground shadow-2xl">
            <Mascot mood="happy" size={36} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{t('version.deployed')}</div>
              <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{t('version.deployedText')}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="accent" onClick={() => window.location.reload()}>
                  <RiRefreshFill />
                  {t('version.reload')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toast.dismiss(id)}>
                  {t('version.later')}
                </Button>
              </div>
            </div>
          </div>
        ),
        { id: 'app-update', duration: Infinity },
      )
    }
    void check()
    const timer = setInterval(check, POLL_MS)
    const onVisible = () => {
      if (!document.hidden) void check()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [t])
  return null
}
