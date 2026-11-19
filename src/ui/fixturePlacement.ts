// 고정 요소 버튼 추가용 순수 로직(AC-06-1,3,5). 가장 긴 벽의 빈 구간 중앙에 놓는다.
import { fixtureKind, nearestWall } from '../scene/geometry'
import { snap } from '../scene/interaction'
import { catalogSize, findCatalog } from '../store/catalog'
import type { Item, Point2, Room } from '../store/types'
import { nextItemId } from './placement'

interface Gap {
  from: number
  to: number
}

/** 벽(0~len) 위 점유 구간을 뺀 빈 구간들. */
function freeGaps(len: number, occupied: [number, number][]): Gap[] {
  const gaps: Gap[] = []
  let cursor = 0
  for (const [a, b] of [...occupied].sort((x, y) => x[0] - y[0])) {
    if (a > cursor) gaps.push({ from: cursor, to: a })
    cursor = Math.max(cursor, b)
  }
  if (cursor < len) gaps.push({ from: cursor, to: len })
  return gaps
}

/** 고정 요소 신규 항목. 알 수 없는 modelType이거나 고정 요소가 아니면 null. */
export function makeFixture(modelType: string, room: Room, items: Item[]): Item | null {
  const entry = findCatalog(modelType)
  const kind = fixtureKind(modelType)
  if (!entry || !kind) return null
  const pts = room.points
  const walls = pts
    .map((a, i) => {
      const b = pts[(i + 1) % pts.length]
      const len = Math.hypot(b[0] - a[0], b[1] - a[1])
      return { a, len, dir: [(b[0] - a[0]) / (len || 1), (b[1] - a[1]) / (len || 1)] as Point2 }
    })
    .filter((w) => w.len > 0)
    .sort((x, y) => y.len - x.len)
  if (!walls.length) return null

  const fixtures = items.filter((it) => it.type === 'FIXTURE')
  const occupiedOn = (a: Point2): [number, number][] =>
    fixtures.flatMap((f) => {
      const hit = nearestWall(pts, f.position[0], f.position[2])
      return hit && hit.a === a ? [[hit.s - f.size[0] / 2, hit.s + f.size[0] / 2] as [number, number]] : []
    })

  const width = entry.w
  // 폭이 들어가는 가장 긴 벽의 가장 큰 빈 구간. 없으면 가장 긴 벽 중앙(겹침은 경고 시스템이 표시).
  let place: { wall: (typeof walls)[number]; s: number; w: number } | null = null
  for (const wall of walls) {
    const best = freeGaps(wall.len, occupiedOn(wall.a))
      .filter((g) => g.to - g.from >= width)
      .sort((g1, g2) => g2.to - g2.from - (g1.to - g1.from))[0]
    if (best) {
      const s = Math.min(Math.max(snap((best.from + best.to) / 2), best.from + width / 2), best.to - width / 2)
      place = { wall, s, w: width }
      break
    }
  }
  if (!place) place = { wall: walls[0], s: snap(walls[0].len / 2), w: Math.min(width, Math.floor(walls[0].len)) }

  const { wall, s, w } = place
  const [, h, d] = catalogSize(entry)
  return {
    id: nextItemId(items, kind.toLowerCase()),
    type: 'FIXTURE',
    modelType,
    name: entry.name,
    position: [wall.a[0] + wall.dir[0] * s, 0, wall.a[1] + wall.dir[1] * s],
    rotation: [0, 0, 0],
    size: [w, h, d],
    color: entry.color,
    ...(kind === 'DOOR' && { doorSwing: { direction: 'LEFT_IN', radius: w, angle: 90 } }),
  }
}
