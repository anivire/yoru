import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Locale, User } from '@yoru/shared'
import { cn, toast } from '@yoru/ui'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { setLocale } from '../lib/i18n'
import { errorMessage, keys } from '../lib/queries'

export const LANGUAGES: { value: Locale; label: string }[] = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
]

function RuFlag() {
  return (
    <svg viewBox="0 0 9 6" preserveAspectRatio="xMidYMid slice" className="size-full!">
      <rect width="9" height="2" fill="#fff" />
      <rect y="2" width="9" height="2" fill="#0039a6" />
      <rect y="4" width="9" height="2" fill="#d52b1e" />
    </svg>
  )
}

function UkFlag() {
  const id = useId()
  return (
    <svg viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice" className="size-full!">
      <clipPath id={`${id}t`}>
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#${id}t)`} stroke="#c8102e" strokeWidth="4" />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#c8102e" strokeWidth="6" />
    </svg>
  )
}

export function Flag({ locale, className }: { locale: Locale; className?: string }) {
  return (
    <span className={cn('inline-block h-3.5 w-5 shrink-0 overflow-hidden rounded-[3px] shadow-[0_0_0_1px_rgb(0_0_0/0.12)]', className)}>
      {locale === 'ru' ? <RuFlag /> : <UkFlag />}
    </span>
  )
}

export function useChangeLanguage() {
  const client = useQueryClient()
  const { t } = useTranslation()
  const mutation = useMutation({
    mutationFn: (locale: Locale) => api.updateSettings({ locale }),
    onSuccess: (user: User) => client.setQueryData(keys.me, user),
    onError: (e) => toast.error(errorMessage(e, t)),
  })
  return (locale: Locale) => {
    setLocale(locale)
    mutation.mutate(locale)
  }
}
