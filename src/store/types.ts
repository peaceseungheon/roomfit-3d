// 저장 JSON 스키마(version "1.0"). 길이 cm, rotation 도, size=[x(W),y(H),z(D)].
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
  elevation?: number // cm, 바닥 위 높이. 창·콘센트 전용, 없으면 카탈로그 기본값
  doorSwing?: DoorSwing
}

export interface Room {
  height: number
  points: Point2[]
}

export interface ProjectInfo {
  version: '1.0'
  lastModified: string
}

export interface DocumentJson {
  projectInfo: ProjectInfo
  room: Room
  items: Item[]
}

/** Undo/Redo 및 저장 대상 문서 데이터 */
export interface DocData {
  room: Room
  items: Item[]
}
