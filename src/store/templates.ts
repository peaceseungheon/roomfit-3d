// 평형별 샘플 템플릿(사업성 검토 §5-4). 단일 방, 경고 없는 배치. 가구 position은 중심, 고정 요소는 벽 중심선 위 점.
import { DEFAULT_ROOM_ID, defaultRoomName, type DocData, type Item } from './types'
import { spec } from './sample'

export interface Template {
  id: string
  name: string
  /** 목록·가이드 페이지에 쓰는 한 줄 설명 */
  desc: string
  doc: () => DocData
}

type Placed = Pick<Item, 'position' | 'rotation'>
const at = (x: number, z: number, rotY = 0): Placed => ({ position: [x, 0, z], rotation: [0, rotY, 0] })

const furniture = (id: string, modelType: string, p: Placed): Item => ({ id, type: 'FURNITURE', ...spec(modelType), ...p })
const fixture = (id: string, modelType: string, x: number, z: number, swing?: Item['doorSwing']): Item => ({
  id,
  type: 'FIXTURE',
  ...spec(modelType),
  ...at(x, z),
  ...(swing && { doorSwing: swing }),
})

const room = (w: number, d: number) => [
  {
    id: DEFAULT_ROOM_ID,
    name: defaultRoomName(1),
    height: 230,
    points: [[0, 0], [w, 0], [w, d], [0, d]] as [number, number][],
  },
]

export const TEMPLATES: readonly Template[] = [
  {
    id: 'studio',
    name: '원룸 약 5평',
    desc: '330×500cm. 침대·책상·옷장을 한 방에 두고 현관 쪽에 신발장·냉장고·세탁기를 모은 배치',
    doc: () => ({
      rooms: room(330, 500),
      items: [
        fixture('door_001', 'DOOR_ENTRANCE', 60, 500, { direction: 'LEFT_IN', radius: 90, angle: 90 }),
        fixture('window_001', 'WINDOW', 165, 0),
        furniture('item_001', 'BED', at(70, 100)),
        furniture('item_002', 'DESK', at(300, 80, 90)),
        furniture('item_003', 'CHAIR', at(243, 80)),
        furniture('item_004', 'WARDROBE', at(300, 220, 90)),
        furniture('item_005', 'DRAWER', at(20, 300, 90)),
        furniture('item_006', 'SHOE_RACK', at(150, 482)),
        furniture('item_007', 'WASHER', at(240, 467)),
        furniture('item_008', 'FRIDGE', at(300, 455)),
      ],
    }),
  },
  {
    id: 'bedroom',
    name: '침실 약 4평',
    desc: '300×420cm. 침대 양옆 협탁, 옷장과 책상을 양쪽 벽에 붙이고 문 열림 자리를 비운 배치',
    doc: () => ({
      rooms: room(300, 420),
      items: [
        fixture('door_001', 'DOOR_SINGLE', 240, 420, { direction: 'LEFT_IN', radius: 90, angle: 90 }),
        fixture('window_001', 'WINDOW', 150, 0),
        furniture('item_001', 'BED', at(150, 100)),
        furniture('item_002', 'SIDE_TABLE', at(50, 20)),
        furniture('item_003', 'SIDE_TABLE', at(250, 20)),
        furniture('item_004', 'WARDROBE', at(30, 300, 90)),
        furniture('item_005', 'DESK', at(270, 260, 90)),
        furniture('item_006', 'CHAIR', at(215, 260)),
      ],
    }),
  },
  {
    id: 'living',
    name: '거실 약 7평',
    desc: '450×520cm. TV 맞은편에 소파, 한쪽에 식탁을 두고 현관문 열림과 통로를 확보한 배치',
    doc: () => ({
      rooms: room(450, 520),
      items: [
        fixture('door_001', 'DOOR_ENTRANCE', 0, 350, { direction: 'LEFT_IN', radius: 90, angle: 90 }),
        fixture('window_001', 'WINDOW', 450, 150),
        furniture('item_001', 'TV_STAND', at(225, 20)),
        furniture('item_002', 'SOFA', at(225, 330, 180)),
        furniture('item_003', 'BOOKSHELF', at(15, 100, 90)),
        furniture('item_004', 'DINING_TABLE', at(370, 440)),
        furniture('item_005', 'CHAIR', at(340, 375)),
        furniture('item_006', 'CHAIR', at(400, 375)),
      ],
    }),
  },
  {
    id: '59-master',
    name: '전용 59㎡ 안방',
    desc: '340×400cm. 침대·협탁, 양쪽 벽의 옷장·서랍장·책상을 두고 방문 열림 자리를 비운 배치',
    doc: () => ({
      rooms: room(340, 400),
      items: [
        fixture('door_001', 'DOOR_SINGLE', 280, 400, { direction: 'LEFT_IN', radius: 90, angle: 90 }),
        fixture('window_001', 'WINDOW', 170, 0),
        fixture('outlet_001', 'OUTLET', 0, 40),
        furniture('item_001', 'BED', at(170, 100)),
        furniture('item_002', 'SIDE_TABLE', at(80, 20)),
        furniture('item_003', 'SIDE_TABLE', at(260, 20)),
        furniture('item_004', 'DRAWER', at(20, 190, 90)),
        furniture('item_005', 'WARDROBE', at(30, 300, 90)),
        furniture('item_006', 'DESK', at(310, 250, 270)),
        furniture('item_007', 'CHAIR', at(255, 250, 90)),
      ],
    }),
  },
  {
    id: '59-small',
    name: '전용 59㎡ 작은방',
    desc: '270×330cm. 침대를 벽에 붙이고 책상·책장·옷장을 세로로 세워 한가운데 통로를 남긴 배치',
    doc: () => ({
      rooms: room(270, 330),
      items: [
        fixture('door_001', 'DOOR_SINGLE', 60, 330, { direction: 'LEFT_IN', radius: 90, angle: 90 }),
        fixture('window_001', 'WINDOW', 135, 0),
        fixture('outlet_001', 'OUTLET', 0, 90),
        furniture('item_001', 'BED', at(200, 100)),
        furniture('item_002', 'DESK', at(30, 90, 90)),
        furniture('item_003', 'CHAIR', at(95, 90, 270)),
        furniture('item_004', 'BOOKSHELF', at(15, 200, 90)),
        furniture('item_005', 'WARDROBE', at(240, 270, 270)),
      ],
    }),
  },
  {
    id: '84-master',
    name: '전용 84㎡ 안방',
    desc: '360×440cm. 침대 맞은편에 TV장, 한쪽 벽에 옷장 두 개와 책상을 두고 통로를 넓게 잡은 배치',
    doc: () => ({
      rooms: room(360, 440),
      items: [
        fixture('door_001', 'DOOR_SINGLE', 300, 440, { direction: 'LEFT_IN', radius: 90, angle: 90 }),
        fixture('window_001', 'WINDOW', 180, 0),
        fixture('outlet_001', 'OUTLET', 360, 40),
        furniture('item_001', 'BED', at(180, 100)),
        furniture('item_002', 'SIDE_TABLE', at(90, 20)),
        furniture('item_003', 'SIDE_TABLE', at(270, 20)),
        furniture('item_004', 'WARDROBE', at(30, 250, 90)),
        furniture('item_005', 'WARDROBE', at(30, 360, 90)),
        furniture('item_006', 'TV_STAND', at(150, 420, 180)),
        furniture('item_007', 'DRAWER', at(340, 150, 270)),
        furniture('item_008', 'DESK', at(330, 290, 270)),
        furniture('item_009', 'CHAIR', at(265, 290, 90)),
      ],
    }),
  },
  {
    id: '84-living',
    name: '전용 84㎡ 거실',
    desc: '400×500cm. TV장과 소파를 마주 보게 두고 아래쪽에 식탁, 위쪽에 책장을 둔 배치',
    doc: () => ({
      rooms: room(400, 500),
      items: [
        fixture('door_001', 'DOOR_ENTRANCE', 0, 430, { direction: 'LEFT_IN', radius: 90, angle: 90 }),
        fixture('window_001', 'WINDOW', 200, 0),
        fixture('outlet_001', 'OUTLET', 0, 230),
        furniture('item_001', 'TV_STAND', at(20, 230, 90)),
        furniture('item_002', 'SOFA', at(290, 230, 270)),
        furniture('item_003', 'BOOKSHELF', at(60, 15)),
        furniture('item_004', 'DINING_TABLE', at(280, 445)),
        furniture('item_005', 'CHAIR', at(250, 380)),
        furniture('item_006', 'CHAIR', at(310, 380)),
      ],
    }),
  },
]

export const findTemplate = (id: string): Template | undefined => TEMPLATES.find((t) => t.id === id)
