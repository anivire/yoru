import type { AnimeTitles, TitleLanguage } from '@yoru/shared'
import { useAppearance } from './appearance'

export function pickTitle(anime: AnimeTitles, language: TitleLanguage): string {
  const value = language === 'english' ? anime.titleEnglish : language === 'japanese' ? anime.titleJapanese : language === 'russian' ? anime.titleRussian : null
  return value?.trim() || anime.title
}

export function useAnimeTitle(): (anime: AnimeTitles) => string {
  const { titleLanguage } = useAppearance()
  return (anime) => pickTitle(anime, titleLanguage)
}

export function AnimeTitle({ anime }: { anime: AnimeTitles }) {
  return useAnimeTitle()(anime)
}
