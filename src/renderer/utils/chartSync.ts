const CHART_CHANGED_EVENT = 'nextefb:chart-changed'

export function notifyChartChanged(): void {
  window.dispatchEvent(new CustomEvent(CHART_CHANGED_EVENT))
}

export function subscribeChartChanged(onChanged: () => void): () => void {
  const handler = () => onChanged()
  window.addEventListener(CHART_CHANGED_EVENT, handler)
  return () => {
    window.removeEventListener(CHART_CHANGED_EVENT, handler)
  }
}
