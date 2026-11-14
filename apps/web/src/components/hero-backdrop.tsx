export function HeroBackdrop({ src, fadeKey }: { src: string | null; fadeKey?: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[calc(100%+12rem)] overflow-hidden [mask-image:linear-gradient(to_bottom,black_45%,transparent)]">
      {src ? <img key={fadeKey ?? src} src={src} alt="" className="h-full w-full scale-110 animate-fade object-cover object-[50%_30%] opacity-50 blur-xl" /> : null}
      <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-background/50 to-background/20" />
    </div>
  )
}
