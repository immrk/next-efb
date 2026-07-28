import { getAppClient } from '../client'

const CHECKLIST_CHANGED_EVENT = 'nextefb:checklist-changed'

export function notifyChecklistChanged(): void {
  window.dispatchEvent(new CustomEvent(CHECKLIST_CHANGED_EVENT))
}

export function subscribeChecklistChanged(onChanged: () => void): () => void {
  const appClient = getAppClient()
  const handler = () => onChanged()
  window.addEventListener(CHECKLIST_CHANGED_EVENT, handler)
  const offRemote = appClient.onChecklistsChanged(onChanged)

  return () => {
    window.removeEventListener(CHECKLIST_CHANGED_EVENT, handler)
    offRemote()
  }
}
