import { describe, expect, it } from 'vitest'
import { ChecklistRepository } from '../../../src/main/services/storage/ChecklistRepository'
import { createChecklist } from '../../helpers/factories'

describe('ChecklistRepository', () => {
  it('creates, groups deterministically through list order, reads and deletes checklists', () => {
    const repository = new ChecklistRepository(':memory:')
    const boeing = createChecklist({
      id: 'b737-abnormal',
      title: 'Abnormal Procedures',
      aircraftModel: 'B737'
    })
    const airbusNormal = createChecklist({
      id: 'a320-normal',
      title: 'Normal Procedures',
      aircraftModel: 'A320'
    })
    const airbusEmergency = createChecklist({
      id: 'a320-emergency',
      title: 'Emergency Procedures',
      aircraftModel: 'A320'
    })

    repository.createChecklist(boeing)
    repository.createChecklist(airbusNormal)
    expect(repository.createChecklist(airbusEmergency)).toEqual(airbusEmergency)

    expect(
      repository.listChecklists().map(({ id, aircraftModel }) => ({ id, aircraftModel }))
    ).toEqual([
      { id: 'a320-emergency', aircraftModel: 'A320' },
      { id: 'a320-normal', aircraftModel: 'A320' },
      { id: 'b737-abnormal', aircraftModel: 'B737' }
    ])
    expect(repository.getChecklist('a320-normal')).toEqual(airbusNormal)
    expect(repository.getChecklist('missing')).toBeNull()

    expect(
      repository.updateChecklist({
        id: 'a320-normal',
        title: 'Normal and Supplementary',
        aircraftModel: 'A321'
      })
    ).toMatchObject({
      id: 'a320-normal',
      title: 'Normal and Supplementary',
      aircraftModel: 'A321'
    })

    repository.deleteChecklist('a320-normal')
    expect(repository.getChecklist('a320-normal')).toBeNull()
  })
})
