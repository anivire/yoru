import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import type { Locale } from '@yoru/shared'
import { en } from '../locales/en'
import { ru } from '../locales/ru'

const STORAGE_KEY = 'yoru:locale'

function initialLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'ru' || stored === 'en') return stored
  return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

void i18n.use(initReactI18next).init({
  resources: { ru: { translation: ru }, en: { translation: en } },
  lng: initialLocale(),
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
})

export function setLocale(locale: Locale) {
  localStorage.setItem(STORAGE_KEY, locale)
  document.documentElement.lang = locale
  void i18n.changeLanguage(locale)
}

document.documentElement.lang = i18n.language

export { i18n }
