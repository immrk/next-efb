import type { LucideIcon } from "lucide-react"
import { ClipboardCheck, Library, Map, PlaneTakeoff, Settings } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useLocation, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { APP_NAME } from "@shared/branding"
import { BRAND_ICON_URL } from "@/branding"
import { SidebarUpdateButton } from "@/components/SidebarUpdateButton"

interface NavigationItem {
  path: string
  labelKey: string
  icon: LucideIcon
}

const navigationItems: NavigationItem[] = [
  { path: "/map", labelKey: "nav.map", icon: Map },
  { path: "/flight", labelKey: "nav.flight", icon: PlaneTakeoff },
  { path: "/charts", labelKey: "nav.charts", icon: Library },
  { path: "/checklists", labelKey: "nav.checklists", icon: ClipboardCheck },
]

export function LeftBar() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <aside className="flex h-full w-16 shrink-0 flex-col items-center border-r bg-muted/30 px-2 pb-4 pt-10">
      <HoverCard openDelay={100} closeDelay={100}>
        <HoverCardTrigger asChild>
          <button className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <img className="size-10 rounded-xl object-contain" src={BRAND_ICON_URL} alt={APP_NAME} />
          </button>
        </HoverCardTrigger>
        <HoverCardContent side="right" align="start" sideOffset={12} className="w-56">
          <div className="space-y-1">
            <p className="font-medium">{APP_NAME}</p>
            <p className="text-sm text-muted-foreground">{t("app.subtitle")}</p>
          </div>
        </HoverCardContent>
      </HoverCard>

      <div className="my-4 h-px w-8 bg-border" />

      <nav className="flex w-full flex-1 flex-col items-center gap-1">
        {navigationItems.map(({ path, labelKey, icon: Icon }) => (
          <Tooltip key={path}>
            <TooltipTrigger asChild>
              <Button
                variant={location.pathname.startsWith(path) ? "default" : "ghost"}
                size="icon"
                aria-label={t(labelKey)}
                aria-current={location.pathname.startsWith(path) ? "page" : undefined}
                className={location.pathname.startsWith(path)
                  ? "w-full shadow-sm"
                  : "w-full text-muted-foreground hover:text-foreground"
                }
                onClick={() => navigate(path)}
              >
                <Icon className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>{t(labelKey)}</TooltipContent>
          </Tooltip>
        ))}
      </nav>

      <SidebarUpdateButton />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={location.pathname === "/settings" ? "default" : "ghost"}
            size="icon"
            className={location.pathname === "/settings"
              ? "w-full shadow-sm"
              : "w-full text-muted-foreground hover:text-foreground"
            }
            aria-label={t("nav.settings")}
            aria-current={location.pathname === "/settings" ? "page" : undefined}
            onClick={() => navigate("/settings")}
          >
            <Settings className="size-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>{t("nav.settings")}</TooltipContent>
      </Tooltip>
    </aside>
  )
}
