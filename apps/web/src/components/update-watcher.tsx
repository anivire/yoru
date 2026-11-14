import { toast } from '@yoru/ui'
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
      toast(t('version.deployed'), {
        id: 'app-update',
        description: t('version.deployedText'),
        duration: Infinity,
        action: { label: t('version.reload'), onClick: () => window.location.reload() },
      })
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
