// 저장 JSON 스키마(version "1.3", 읽기는 "1.0"·"1.1"·"1.2"도 지원). 길이 cm, rotation 도, size=[x(W),y(H),z(D)].
export type Vec3 = [number, number, number]
export type Point2 = [number, number] // [x, z]

export interface DoorSwing {
  direction: string // 예: "LEFT_IN"
  radius: number
  angle: number
}

export interface Item {
  id: string
  type: 'FURNITURE' | 'FIXTURE'
  modelType: string
  name?: string
  position: Vec3 // y는 항상 0
  rotation: Vec3 // 도
  size: Vec3
  color?: string
  category?: string // 치수 박스 전용 종류(FURNITURE_CATALOG modelType 중 하나). 없으면 '기타'(링크 없음)
  elevation?: number // cm, 바닥 위 높이. 창·콘센트 전용, 없으면 카탈로그 기본값
  doorSwing?: DoorSwing
  purchased?: boolean // 구매 리스트 체크(FURNITURE 전용 의미). 없으면 false
}

export interface Room {
  id: string
  name: string
  height: number
  points: Point2[]
  kind?: string // 방 종류(최대 20자). 없으면 비움
}

/** id·name 없이 모양만 필요한 곳(검증·미리보기·판정)에 쓴다. */
export type RoomShape = Pick<Room, 'height' | 'points'>

export interface ProjectInfo {
  version: '1.3'
  lastModified: string
}

export interface DocumentJson {
  projectInfo: ProjectInfo
  rooms: Room[]
  items: Item[]
}

/** Undo/Redo 및 저장 대상 문서 데이터 */
export interface DocData {
  rooms: Room[]
  items: Item[]
}

export const DEFAULT_ROOM_ID = 'r1'
/** 문서 전체 바운딩 박스 가로·세로 상한(cm). */
export const PLAN_EXTENT_MAX = 10000
/** n번째 방의 기본 이름 */
export const defaultRoomName = (n: number): string => `방 ${n}`
