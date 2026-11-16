import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import type { Locale } from '@yoru/shared'
import { readStorage, writeStorage } from './storage'

const STORAGE_KEY = 'yoru:locale'

const LOADERS: Record<Locale, () => Promise<object>> = {
  ru: () => import('../locales/ru').then((m) => m.ru),
  en: () => import('../locales/en').then((m) => m.en),
}

function initialLocale(): Locale {
  const stored = readStorage(STORAGE_KEY)
  if (stored === 'ru' || stored === 'en') return stored
  return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

async function ensureLocale(locale: Locale) {
  if (!i18n.hasResourceBundle(locale, 'translation')) i18n.addResourceBundle(locale, 'translation', await LOADERS[locale]())
}

const initial = initialLocale()

export const i18nReady = LOADERS[initial]().then((messages) =>
  i18n.use(initReactI18next).init({
    resources: { [initial]: { translation: messages } },
    lng: initial,
    fallbackLng: false,
    partialBundledLanguages: true,
    interpolation: { escapeValue: false },
  }),
)

export async function setLocale(locale: Locale) {
  writeStorage(STORAGE_KEY, locale)
  document.documentElement.lang = locale
  await ensureLocale(locale)
  await i18n.changeLanguage(locale)
}

document.documentElement.lang = initial

export { i18n }
