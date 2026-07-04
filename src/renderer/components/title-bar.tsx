export function TitleBar() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-x-0 top-0 z-50 h-[30px]"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    />
  )
}
