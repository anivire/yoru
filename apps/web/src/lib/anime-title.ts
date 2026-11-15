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
