import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import type { BuildFlightPlanInput } from "@shared/flight-plan-types"
import { SafeAreaTopInset } from "@/components/SafeAreaTopInset"
import { ChartDetailPage } from "@/pages/ChartDetailPage"
import { ChartsPage } from "@/pages/ChartsPage"
import { MapPage } from "@/pages/MapPage"
import { SettingsPage } from "@/pages/SettingsPage"
import {
  persistStoredFlightPlanDraft,
  readStoredFlightPlanDraft,
} from "@/utils/flightPlanPersistence"

export function MainRouter() {
  const location = useLocation()
  const navigate = useNavigate()
  const [selectedChartId, setSelectedChartId] = useState<string | null>(null)
  const [flightPlanDraft, setFlightPlanDraft] = useState<BuildFlightPlanInput>(() =>
    readStoredFlightPlanDraft(),
  )
  const detailMatch = location.pathname.match(/^\/charts\/([^/]+)\/edit$/)
  const detailChartId = detailMatch ? decodeURIComponent(detailMatch[1]) : null
  const route = detailChartId
    ? "chartDetail"
    : location.pathname.startsWith("/charts")
      ? "charts"
      : location.pathname === "/settings"
        ? "settings"
        : "map"
  const backRoute = (location.state as { back?: string } | null)?.back ?? "/charts"

  useEffect(() => {
    persistStoredFlightPlanDraft(flightPlanDraft)
  }, [flightPlanDraft])

  useEffect(() => {
    if (location.pathname === "/") {
      navigate("/map", { replace: true })
    }
  }, [location.pathname, navigate])

  return (
    <div className="h-full overflow-hidden">
      <section className={`route-view pt-7 ${route === "map" ? "active" : ""}`}>
        <MapPage
          flightPlanDraft={flightPlanDraft}
          onOpenChartLibrary={(chartId) => {
            setSelectedChartId(chartId ?? null)
            navigate("/charts")
          }}
          onEditChart={(chartId) => {
            setSelectedChartId(chartId)
            navigate(`/charts/${encodeURIComponent(chartId)}/edit`, { state: { back: "/map" } })
          }}
          onOpenSettings={() => navigate("/settings")}
          onFlightPlanDraftChange={setFlightPlanDraft}
        />
      </section>

      <section
        className={`route-view route-view-with-safe-area route-view-page-surface pt-10 ${
          route === "charts" ? "active" : ""
        }`}
      >
        <SafeAreaTopInset className="route-safe-area-top" />
        <ChartsPage
          selectedChartId={selectedChartId}
          onSelectChart={setSelectedChartId}
          onEditChart={(chartId) => {
            setSelectedChartId(chartId)
            navigate(`/charts/${encodeURIComponent(chartId)}/edit`, { state: { back: "/charts" } })
          }}
        />
      </section>

      <section
        className={`route-view route-view-with-safe-area route-view-page-surface pt-10 ${
          route === "settings" ? "active" : ""
        }`}
      >
        <SafeAreaTopInset className="route-safe-area-top" />
        <SettingsPage />
      </section>

      {detailChartId ? (
        <section className="route-view route-view-with-safe-area route-view-page-surface active pt-10">
          <SafeAreaTopInset className="route-safe-area-top" />
          <ChartDetailPage
            chartId={detailChartId}
            onBack={() => navigate(backRoute)}
            onSaved={() => undefined}
            onDeleted={() => {
              setSelectedChartId(null)
              navigate(backRoute)
            }}
          />
        </section>
      ) : null}
    </div>
  )
}
