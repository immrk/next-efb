import { Toaster } from "sonner"

import { TitleBar } from "@/components/title-bar"
import { useTheme } from "@/composables/useTheme"
import { useDesktopData } from "@/hooks/useDesktopData"
import { MainRouter } from "./router"
import { LeftBar } from "./components/leftBar"

export default function App() {
  const { isDark } = useTheme()
  useDesktopData()

  return (
    <>
      <TitleBar />
      <div className="flex h-full">
        <LeftBar />
        <main className="min-w-0 flex-1 overflow-hidden bg-background">
          <MainRouter />
        </main>
      </div>
      <Toaster richColors theme={isDark ? "dark" : "light"} />
    </>
  )
}
