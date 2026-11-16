import type { AnimeTitles, TitleLanguage } from '@yoru/shared'
import { useAppearance } from './appearance'
import { useMe } from './queries'

export function pickTitle(anime: AnimeTitles, language: TitleLanguage): string {
  const value = language === 'english' ? anime.titleEnglish : language === 'japanese' ? anime.titleJapanese : language === 'russian' ? anime.titleRussian : null
  return value?.trim() || anime.title
}

export function useAnimeTitle(): (anime: AnimeTitles) => string {
  const { titleLanguage } = useAppearance()
  const me = useMe()
  const language = titleLanguage === 'russian' && me.data?.russianTitles === false ? 'romaji' : titleLanguage
  return (anime) => pickTitle(anime, language)
}

export function AnimeTitle({ anime }: { anime: AnimeTitles }) {
  return useAnimeTitle()(anime)
}

export function animeSlug(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '')
}

export function animePath(malId: number, title?: string | null): string {
  const slug = title ? animeSlug(title) : ''
  return slug ? `/anime/${malId}-${slug}` : `/anime/${malId}`
}
