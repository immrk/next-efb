import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  BuildFlightPlanInput,
  NavDataStatus,
  SimBriefImportResult
} from '@shared/flight-plan-types'
import { getAppClient } from '../client'
import { toast } from '../components/ui/use-toast'
import { useAppStore } from '../store/useAppStore'
import {
  persistStoredFlightPlanDraft,
  persistStoredFlightPlanResult,
  persistStoredSimBriefPlan,
  readStoredFlightPlanDraft,
  readStoredFlightPlanResult,
  readStoredSimBriefPlan,
  type StoredFlightPlanResult
} from '../utils/flightPlanPersistence'
import {
  buildFlightPlanDraftSignature,
  EMPTY_FLIGHT_PLAN_DRAFT,
  importSimBriefFlightPlan
} from '../utils/simBriefFlightPlan'

export interface FlightPlanData {
  draft: BuildFlightPlanInput
  route: StoredFlightPlanResult | null
  simBriefPlan: SimBriefImportResult | null
  isImporting: boolean
  navDataReady: boolean
  setDraft: (draft: BuildFlightPlanInput) => void
  importFromSimBrief: () => Promise<void>
  clear: () => void
}

export function useFlightPlanData(): FlightPlanData {
  const { t } = useTranslation()
  const appClient = getAppClient()
  const settings = useAppStore((state) => state.settings)
  const [draft, setDraft] = useState<BuildFlightPlanInput>(() => readStoredFlightPlanDraft())
  const [route, setRoute] = useState<StoredFlightPlanResult | null>(() =>
    readStoredFlightPlanResult()
  )
  const [simBriefPlan, setSimBriefPlan] = useState<SimBriefImportResult | null>(() =>
    readStoredSimBriefPlan()
  )
  const [navStatus, setNavStatus] = useState<NavDataStatus | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const signature = useMemo(() => buildFlightPlanDraftSignature(draft), [draft])
  const lastBuiltSignatureRef = useRef('')
  const navDataReady = Boolean(navStatus?.exists && navStatus.activePath)

  useEffect(() => {
    persistStoredFlightPlanDraft(draft)
  }, [draft])

  useEffect(() => {
    persistStoredSimBriefPlan(simBriefPlan)
  }, [simBriefPlan])

  useEffect(() => {
    let active = true
    void appClient.getNavDataStatus().then((status) => {
      if (active) {
        setNavStatus(status)
      }
    })

    return () => {
      active = false
    }
  }, [appClient, settings])

  useEffect(() => {
    const departureAirport = draft.departureAirport.trim().toUpperCase()
    const destinationAirport = draft.destinationAirport.trim().toUpperCase()

    if (!departureAirport || !destinationAirport) {
      lastBuiltSignatureRef.current = signature
      setRoute(null)
      persistStoredFlightPlanResult(null)
      return
    }

    if (lastBuiltSignatureRef.current === signature) {
      return
    }

    let active = true
    const timer = window.setTimeout(() => {
      void appClient
        .buildFlightPlan({
          ...draft,
          departureAirport,
          destinationAirport
        })
        .then((result) => {
          if (!active) return
          lastBuiltSignatureRef.current = signature
          setRoute({
            points: result.points,
            segments: result.segments
          })
          persistStoredFlightPlanResult(result)
        })
        .catch(() => {
          if (!active) return
          setRoute(null)
          persistStoredFlightPlanResult(null)
        })
    }, 350)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [appClient, draft, signature])

  const importFromSimBrief = useCallback(async () => {
    if (isImporting) return

    setIsImporting(true)
    try {
      const imported = await importSimBriefFlightPlan(appClient, {
        username: settings?.simbrief.username,
        userId: settings?.simbrief.userId
      })
      setSimBriefPlan(imported.source)
      setDraft(imported.draft)
      toast.success(t('feedback.imported'))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'SIMBRIEF_IMPORT_FAILED'
      toast.error(message)
    } finally {
      setIsImporting(false)
    }
  }, [
    appClient,
    isImporting,
    settings?.simbrief.userId,
    settings?.simbrief.username,
    t
  ])

  const clear = useCallback(() => {
    setDraft({ ...EMPTY_FLIGHT_PLAN_DRAFT })
    setRoute(null)
    setSimBriefPlan(null)
    persistStoredFlightPlanResult(null)
  }, [])

  return {
    draft,
    route,
    simBriefPlan,
    isImporting,
    navDataReady,
    setDraft,
    importFromSimBrief,
    clear
  }
}
