import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { SafeAreaTopInset } from "@/components/SafeAreaTopInset"
import { useFlightPlanData } from "@/hooks/useFlightPlanData"
import { ChartDetailPage } from "@/pages/ChartDetailPage"
import { ChartsPage } from "@/pages/ChartsPage"
import { ChecklistsPage } from "@/pages/ChecklistsPage"
import { FlightPage } from "@/pages/FlightPage"
import { MapPage } from "@/pages/MapPage"
import { SettingsPage } from "@/pages/SettingsPage"

export function MainRouter() {
  const location = useLocation()
  const navigate = useNavigate()
  const [selectedChartId, setSelectedChartId] = useState<string | null>(null)
  const [selectedChecklistId, setSelectedChecklistId] = useState<string | null>(null)
  const flightPlan = useFlightPlanData()
  const detailMatch = location.pathname.match(/^\/charts\/([^/]+)\/edit$/)
  const detailChartId = detailMatch ? decodeURIComponent(detailMatch[1]) : null
  const route = detailChartId
    ? "chartDetail"
    : location.pathname.startsWith("/charts")
      ? "charts"
      : location.pathname === "/flight"
        ? "flight"
        : location.pathname.startsWith("/checklists")
          ? "checklists"
          : location.pathname === "/settings"
            ? "settings"
            : "map"
  const backRoute = (location.state as { back?: string } | null)?.back ?? "/charts"

  useEffect(() => {
    if (location.pathname === "/") {
      navigate("/map", { replace: true })
    }
  }, [location.pathname, navigate])

  return (
    <div className="h-full overflow-hidden">
      <section className={`route-view pt-7 ${route === "map" ? "active" : ""}`}>
        <MapPage
          flightPlanDraft={flightPlan.draft}
          flightPlanPoints={flightPlan.route?.points ?? []}
          flightPlanSegments={flightPlan.route?.segments ?? []}
          isImportingFlightPlan={flightPlan.isImporting}
          navDataReady={flightPlan.navDataReady}
          onOpenChartLibrary={(chartId) => {
            setSelectedChartId(chartId ?? null)
            navigate("/charts")
          }}
          onEditChart={(chartId) => {
            setSelectedChartId(chartId)
            navigate(`/charts/${encodeURIComponent(chartId)}/edit`, { state: { back: "/map" } })
          }}
          onOpenSettings={() => navigate("/settings")}
          onFlightPlanDraftChange={flightPlan.setDraft}
          onImportFlightPlan={flightPlan.importFromSimBrief}
          onClearFlightPlan={flightPlan.clear}
        />
      </section>

      <section
        className={`route-view route-view-with-safe-area route-view-page-surface pt-7 ${
          route === "flight" ? "active" : ""
        }`}
      >
        <SafeAreaTopInset className="route-safe-area-top" />
        <FlightPage
          simBriefPlan={flightPlan.simBriefPlan}
          isImporting={flightPlan.isImporting}
          navDataReady={flightPlan.navDataReady}
          onImport={flightPlan.importFromSimBrief}
          onClear={flightPlan.clear}
        />
      </section>

      <section
        className={`route-view route-view-with-safe-area route-view-page-surface pt-7 ${
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
        className={`route-view route-view-with-safe-area route-view-page-surface pt-7 ${
          route === "settings" ? "active" : ""
        }`}
      >
        <SafeAreaTopInset className="route-safe-area-top" />
        <SettingsPage />
      </section>

      <section
        className={`route-view route-view-with-safe-area route-view-page-surface pt-7 ${
          route === "checklists" ? "active" : ""
        }`}
      >
        <SafeAreaTopInset className="route-safe-area-top" />
        <ChecklistsPage
          selectedChecklistId={selectedChecklistId}
          onSelectChecklist={setSelectedChecklistId}
        />
      </section>

      {detailChartId ? (
        <section className="route-view route-view-with-safe-area route-view-page-surface active pt-7">
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
