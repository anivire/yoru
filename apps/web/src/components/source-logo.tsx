import type { DataSourceId } from '@yoru/shared'
import { RiPlayCircleFill } from '@remixicon/react'
import { useId } from 'react'
import { ANILIBRIA_LOGO, ANIME365_LOGO } from '../lib/logos'
import { ProviderIcon } from './providers'

export function Anime365Mark() {
  return (
    <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-white">
      <img src={ANIME365_LOGO} alt="" className="size-7 object-contain" />
    </span>
  )
}

export function AnilibriaMark() {
  return (
    <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-white">
      <img src={ANILIBRIA_LOGO} alt="" className="size-6 object-contain" />
    </span>
  )
}

const KITSU_PATH =
  'M1.429 5.441a12.478 12.478 0 0 0 1.916 2.056c.011.011.022.011.022.022.452.387 1.313.947 1.937 1.173 0 0 3.886 1.496 4.091 1.582a1.4 1.4 0 0 0 .237.075.694.694 0 0 0 .808-.549c.011-.065.022-.172.022-.248V5.161c.011-.667-.205-1.679-.398-2.239 0-.011-.011-.022-.011-.032A11.979 11.979 0 0 0 8.824.36L8.781.285a.697.697 0 0 0-.958-.162c-.054.032-.086.075-.129.119L7.608.36a4.743 4.743 0 0 0-.786 3.412 8.212 8.212 0 0 0-.775.463c-.043.032-.42.291-.71.56A4.803 4.803 0 0 0 1.87 4.3c-.043.011-.097.021-.14.032-.054.022-.107.043-.151.076a.702.702 0 0 0-.193.958l.043.075zM8.222 1.07c.366.614.678 1.249.925 1.917-.495.086-.98.215-1.453.388a3.918 3.918 0 0 1 .528-2.305zM4.658 5.463a7.467 7.467 0 0 0-.893 1.216 11.68 11.68 0 0 1-1.453-1.55 3.825 3.825 0 0 1 2.346.334zm13.048-.302a7.673 7.673 0 0 0-2.347-.474 7.583 7.583 0 0 0-3.811.818l-.215.108v3.918c0 .054 0 .258-.032.431a1.535 1.535 0 0 1-.646.98 1.545 1.545 0 0 1-1.152.247 2.618 2.618 0 0 1-.409-.118 747.6 747.6 0 0 1-3.402-1.313 8.9 8.9 0 0 0-.323-.129 30.597 30.597 0 0 0-3.822 3.832l-.075.086a.698.698 0 0 0 .538 1.098.676.676 0 0 0 .42-.118c.011-.011.022-.022.043-.032 1.313-.947 2.756-1.712 4.284-2.325a.7.7 0 0 1 .818.13.704.704 0 0 1 .054.915l-.237.388a20.277 20.277 0 0 0-1.97 4.306l-.032.129a.646.646 0 0 0 .108.538.713.713 0 0 0 .549.301.657.657 0 0 0 .42-.118c.054-.043.108-.086.151-.14l.043-.065a18.95 18.95 0 0 1 1.765-2.153 20.156 20.156 0 0 1 10.797-6.018c.032-.011.065-.011.097-.011.237.011.42.215.409.452a.424.424 0 0 1-.344.398c-3.908.829-10.948 5.469-8.483 12.208.043.108.075.172.129.269a.71.71 0 0 0 .538.301.742.742 0 0 0 .657-.398c.398-.754 1.152-1.593 3.326-2.497 6.061-2.508 7.062-6.093 7.17-8.364v-.129a7.716 7.716 0 0 0-5.016-7.451zm-6.083 17.762c-.56-1.669-.506-3.283.151-4.823 1.26 2.035 3.456 2.207 3.456 2.207-2.25.937-3.133 1.863-3.607 2.616z'

export function KitsuMark() {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#fd755c] text-white">
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-[55%]">
        <path d={KITSU_PATH} />
      </svg>
    </span>
  )
}

export const SOURCE_NAMES: Record<DataSourceId, string> = { anime365: 'Anime365', jikan: 'Jikan', shikimori: 'Shikimori', anilist: 'AniList', kitsu: 'Kitsu', anilibria: 'AniLibria', kodik: 'Kodik', aniskip: 'AniSkip', github: 'GitHub' }

function GithubMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-5">
      <path d="M10.226 17.284c-2.965-.36-5.054-2.493-5.054-5.256 0-1.123.404-2.336 1.078-3.144-.292-.741-.247-2.314.09-2.965.898-.112 2.111.36 2.83 1.01.853-.269 1.752-.404 2.853-.404 1.1 0 1.999.135 2.807.382.696-.629 1.932-1.1 2.83-.988.315.606.36 2.179.067 2.942.72.854 1.101 2 1.101 3.167 0 2.763-2.089 4.852-5.098 5.234.763.494 1.28 1.572 1.28 2.807v2.336c0 .674.561 1.056 1.235.786 4.066-1.55 7.255-5.615 7.255-10.646C23.5 6.188 18.334 1 11.978 1 5.62 1 .5 6.188.5 12.545c0 4.986 3.167 9.12 7.435 10.669.606.225 1.19-.18 1.19-.786V20.63a2.9 2.9 0 0 1-1.078.224c-1.483 0-2.359-.808-2.987-2.313-.247-.607-.517-.966-1.034-1.033-.27-.023-.359-.135-.359-.27 0-.27.45-.471.898-.471.652 0 1.213.404 1.797 1.235.45.651.921.943 1.483.943.561 0 .92-.202 1.437-.719.382-.381.674-.718.944-.943" />
    </svg>
  )
}

function AniSkipMark() {
  const id = useId()
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-[70%]">
      <defs>
        <linearGradient id={id} x1="2" y1="4" x2="22" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ab5ac6" />
          <stop offset="1" stopColor="#1f98d8" />
        </linearGradient>
      </defs>
      <g fill="none" stroke={`url(#${id})`} strokeWidth="2.1" strokeLinejoin="round" strokeLinecap="round">
        <path d="M2.4 4.7v14.6L14.6 12Z" />
        <path d="M9.4 4.7 21.6 12 9.4 19.3" />
      </g>
    </svg>
  )
}

export function SourceIcon({ id }: { id: DataSourceId }) {
  if (id === 'anime365') return <Anime365Mark />
  if (id === 'jikan') return <ProviderIcon provider="mal" />
  if (id === 'shikimori') return <ProviderIcon provider="shikimori" />
  if (id === 'anilist') return <ProviderIcon provider="anilist" />
  if (id === 'kitsu') return <KitsuMark />
  if (id === 'anilibria') return <AnilibriaMark />
  if (id === 'kodik') {
    return (
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-field text-muted-foreground [&_svg]:size-[1.125rem]">
        <RiPlayCircleFill />
      </span>
    )
  }
  if (id === 'aniskip') {
    return (
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white">
        <AniSkipMark />
      </span>
    )
  }
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-inverse text-inverse-foreground">
      <GithubMark />
    </span>
  )
}
