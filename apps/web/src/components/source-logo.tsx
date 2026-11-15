import { ANIME365_LOGO } from '../lib/logos'

export function Anime365Mark() {
  return (
    <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-white">
      <img src={ANIME365_LOGO} alt="" className="size-7 object-contain" />
    </span>
  )
}
