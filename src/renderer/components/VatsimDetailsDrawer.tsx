import { Plane, Radio, TowerControl, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { VatsimSelectableFeature } from '@shared/vatsim-types'
import { Button } from './ui/button'

export function VatsimDetailsDrawer({
  feature,
  onClose
}: {
  feature: VatsimSelectableFeature | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  if (!feature) return null

  const title = feature.callsign
  const subtitle = getSubtitle(feature, t)
  const Icon = feature.kind === 'pilot'
    ? Plane
    : feature.kind === 'controller'
      ? TowerControl
      : Radio

  return (
    <aside className="vatsim-details-drawer" aria-label={t('vatsim.details')}>
      <div className="vatsim-details-header">
        <span className={`vatsim-details-icon is-${feature.kind}`}><Icon /></span>
        <div>
          <span className="vatsim-details-kicker">{subtitle}</span>
          <h3>{title}</h3>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label={t('vatsim.close')}>
          <X />
        </Button>
      </div>
      <FeatureDetails feature={feature} />
    </aside>
  )
}

function FeatureDetails({ feature }: { feature: VatsimSelectableFeature }) {
  const { t } = useTranslation()
  if (feature.kind === 'pilot') {
    return (
      <>
        <dl className="vatsim-details-grid">
          <Detail label={t('vatsim.fields.altitude')} value={`${feature.altitudeFt.toLocaleString()} ft`} />
          <Detail label={t('vatsim.fields.groundSpeed')} value={`${feature.groundSpeedKts} kt`} />
          <Detail label={t('vatsim.fields.heading')} value={`${String(Math.round(feature.headingDeg)).padStart(3, '0')}°`} />
          <Detail label={t('vatsim.fields.squawk')} value={feature.transponder ?? '--'} />
          <Detail label={t('vatsim.fields.departure')} value={feature.flightPlan?.departure ?? '--'} />
          <Detail label={t('vatsim.fields.arrival')} value={feature.flightPlan?.arrival ?? '--'} />
          <Detail label={t('vatsim.fields.aircraft')} value={feature.flightPlan?.aircraft ?? '--'} />
          <Detail label={t('vatsim.fields.flightRules')} value={feature.flightPlan?.flightRules ?? '--'} />
        </dl>
        {feature.flightPlan?.route ? <TextBlock label={t('vatsim.fields.route')} value={feature.flightPlan.route} /> : null}
      </>
    )
  }

  if (feature.kind === 'controller') {
    return (
      <>
        <dl className="vatsim-details-grid">
          <Detail label={t('vatsim.fields.facility')} value={feature.facilityName} />
          <Detail label={t('vatsim.fields.frequency')} value={feature.frequencies.join(' / ') || '--'} />
          <Detail label={t('vatsim.fields.coverage')} value={`${Math.round(feature.coverageRadiusNm)} NM`} />
          <Detail label={t('vatsim.fields.onlineSince')} value={formatTime(feature.logonTime)} />
        </dl>
        {feature.textAtis.length > 0 ? <TextBlock label="ATIS" value={feature.textAtis.join('\n')} /> : null}
      </>
    )
  }

  if (feature.kind === 'atis') {
    return (
      <>
        <dl className="vatsim-details-grid">
          <Detail label={t('vatsim.fields.airport')} value={feature.airportIdent ?? '--'} />
          <Detail label={t('vatsim.fields.frequency')} value={feature.frequency ?? '--'} />
          <Detail label={t('vatsim.fields.atisCode')} value={feature.atisCode ?? '--'} />
          <Detail label={t('vatsim.fields.onlineSince')} value={formatTime(feature.logonTime)} />
        </dl>
        <TextBlock label="ATIS" value={feature.textAtis.join('\n') || '--'} />
      </>
    )
  }

  return null
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>
}

function TextBlock({ label, value }: { label: string; value: string }) {
  return <div className="vatsim-details-text"><span>{label}</span><p>{value}</p></div>
}

function getSubtitle(feature: VatsimSelectableFeature, t: (key: string) => string): string {
  switch (feature.kind) {
    case 'pilot': return t('vatsim.types.pilot')
    case 'controller': return t('vatsim.types.controller')
    case 'atis': return t('vatsim.types.atis')
  }
}

function formatTime(value: number | null): string {
  return value ? new Date(value).toLocaleString() : '--'
}
