import { Toaster } from "sonner"

import { TitleBar } from "@/components/title-bar"
import { useLanguage } from "@/composables/useLanguage"
import { useTheme } from "@/composables/useTheme"
import { LoginBox } from "./components/loginBox"

export default function App() {
  const { isDark } = useTheme()
  useLanguage()

  return (
    <>
      <TitleBar />
      <LoginBox />
      <Toaster richColors theme={isDark ? "dark" : "light"} />
    </>
  )
}
