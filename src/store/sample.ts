import { DEFAULT_ROOM_ID, defaultRoomName, type DocData, type Item } from './types'
import { catalogSize, findCatalog } from './catalog'

const spec = (modelType: string): Pick<Item, 'modelType' | 'name' | 'size' | 'color'> => {
  const c = findCatalog(modelType)
  if (!c) throw new Error(`카탈로그에 없는 modelType: ${modelType}`)
  return { modelType, name: c.name, size: catalogSize(c), color: c.color }
}

// FR-02: 400x300cm, 천장 230cm, 문 1개, 가구 3개
export const createSample = (): DocData => ({
  rooms: [
    {
      id: DEFAULT_ROOM_ID,
      name: defaultRoomName(1),
      height: 230,
      points: [
        [0, 0],
        [400, 0],
        [400, 300],
        [0, 300],
      ],
    },
  ],
  items: [
    { id: 'door_001', type: 'FIXTURE', ...spec('DOOR_SINGLE'), position: [0, 0, 50], rotation: [0, 0, 0], doorSwing: { direction: 'LEFT_IN', radius: 90, angle: 90 } },
    { id: 'item_001', type: 'FURNITURE', ...spec('BED'), position: [150, 0, 190], rotation: [0, 90, 0] },
    { id: 'item_002', type: 'FURNITURE', ...spec('DESK'), position: [320, 0, 60], rotation: [0, 0, 0] },
    { id: 'item_003', type: 'FURNITURE', ...spec('WARDROBE'), position: [340, 0, 230], rotation: [0, 0, 0] },
  ],
})
