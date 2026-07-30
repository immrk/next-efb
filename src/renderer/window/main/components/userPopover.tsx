import { LogIn, LogOut, Mail, UserRound } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"

interface UserPopoverProps {
  isLogin: boolean
  userdata: Record<string, any>
}

export function UserPopover({ isLogin, userdata }: UserPopoverProps) {
  const { t } = useTranslation()

  if (!isLogin) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("main.login.unlogin")}</p>
        <Button className="w-full" onClick={() => void window.windowManager.createWindow("login")}>
          <LogIn />
          {t("main.login.toLogin")}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2 text-sm">
        <p className="flex items-center gap-2"><UserRound className="size-4 text-muted-foreground" />{userdata.username}</p>
        <p className="flex items-center gap-2 text-muted-foreground"><Mail className="size-4" />{userdata.email}</p>
      </div>
      <Button variant="outline" className="w-full" onClick={() => void window.auth.logout()}>
        <LogOut />
        {t("main.login.logout")}
      </Button>
    </div>
  )
}
