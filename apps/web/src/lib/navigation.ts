import { RiBarChart2Fill, RiNewspaperFill, RiGroupFill, RiBookShelfFill, RiCalendar2Fill, RiCalendarScheduleFill, RiCompass3Fill, RiHome5Fill, RiPlayCircleFill, RiPulseFill, RiSearchFill, RiTv2Fill } from '@remixicon/react'

export const NAV = [
  { to: '/', key: 'home', icon: RiHome5Fill, end: true },
  { to: '/feed', key: 'feed', icon: RiNewspaperFill, end: false },
  { to: '/discover', key: 'discover', icon: RiCompass3Fill, end: false },
  { to: '/schedule', key: 'schedule', icon: RiCalendar2Fill, end: false },
  { to: '/search', key: 'search', icon: RiSearchFill, end: false },
  { to: '/lists', key: 'lists', icon: RiBookShelfFill, end: false },
  { to: '/together', key: 'together', icon: RiGroupFill, end: false, beta: true },
  { to: '/stats', key: 'stats', icon: RiBarChart2Fill, end: false },
] as const

export type NavKey = (typeof NAV)[number]['key']

export const HOME_SECTIONS = [
  { id: 'continue', label: 'home.continue', icon: RiPlayCircleFill },
  { id: 'upcoming', label: 'home.upcoming', icon: RiCalendarScheduleFill },
  { id: 'watching', label: 'home.watching', icon: RiTv2Fill },
  { id: 'activity', label: 'home.activity', icon: RiPulseFill },
] as const

export type HomeSectionId = (typeof HOME_SECTIONS)[number]['id']

export function isBeta(item: (typeof NAV)[number]) {
  return 'beta' in item && item.beta
}
