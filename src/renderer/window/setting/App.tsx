import { Toaster } from "sonner"
import { TitleBar } from "@/components/title-bar"
import { useTheme } from "@/composables/useTheme"
import { useDesktopData } from "@/hooks/useDesktopData"
import { SettingsPage } from "@/pages/SettingsPage"

export default function App() {
  const { isDark } = useTheme()
  useDesktopData()

  return (
    <>
      <TitleBar />
      <div className="h-full overflow-y-auto bg-background pt-10">
        <SettingsPage />
      </div>
      <Toaster richColors theme={isDark ? "dark" : "light"} />
    </>
  )
}
