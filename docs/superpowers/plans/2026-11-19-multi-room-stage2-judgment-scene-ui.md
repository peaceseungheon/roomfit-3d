# 다중 방 2단계(판정·활성 방·다중 렌더) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 방 여러 개를 같은 문서에서 판정(충돌·벽·문·천장고)·렌더하고, 활성 방을 골라 편집하며, 방 목록에서 추가·이름 변경·삭제할 수 있게 한다. 방 1개 문서의 화면·클릭 수는 지금과 같아야 한다.

**Architecture:** 활성 방은 Undo 비대상 `useUiStore.activeRoomId`로 두고 `activeRoom.ts`의 `useActiveRoom`/`getActiveRoom`이 `rooms`와 함께 해석한다. 방 CRUD와 좌표 불변식(모든 방 꼭짓점 min x·z ≥ 0)은 `useDocStore`·`store/rooms.ts`가 소유하고, 판정은 `computeWarnings(rooms, items)`로 일반화한다. 벽은 스펙의 "링 − 모든 방 내부"와 시각 결과가 같은 **변별 두께**(`t = clamp(g/2, WALL_MIN, WALL_THICKNESS)`)로 그려 링 중복·z-fight를 없앤다.

**Tech Stack:** TypeScript, React 19, Zustand + zundo, three.js/@react-three/fiber, Vitest(`npm test`), Vite(`npm run build`), oxlint(`npm run lint`).

**Spec:** `docs/superpowers/specs/2026-11-19-multi-room-design.md` (§5.2~5.4, §5.6, §7-2단계). 1단계 계획: `docs/superpowers/plans/2026-11-19-multi-room-stage1-model.md` (적용 완료).

## Global Constraints

- 단위 1unit=1cm, 좌표 `[x, z]`, 10cm 스냅(`SNAP_CM`). 불변 갱신(스프레드), 파일 800줄 이하.
- 방 하나의 가로·세로 상한 `ROOM_MAX`=3000, 꼭짓점 3~`POINTS_MAX`(100)개. 방 개수 1~`ROOMS_MAX`(20), id 중복 불가, 이름 1~`NAME_MAX`(100)자.
- 문서 전체 바운딩 박스 가로·세로 상한 `PLAN_EXTENT_MAX`=10000cm.
- **좌표 불변식:** 문서 전체에서 모든 방 꼭짓점의 min x·min z ≥ 0. 위반하는 변경(방 추가·모서리 편집)은 문서 전체(모든 방 + 모든 가구)를 같은 양만큼 옮겨 유지하고, 그 이동은 원래 변경과 **같은 Undo 1단계**다.
- 방 내부 면적이 겹치면 거부(`roomsOverlap`). 변이 맞닿거나 한 점이 닿는 것, 간격 0은 허용.
- 방 간격 렌더: 0이면 벽 없음(열린 구조), 0 초과 20cm 이하(`WALL_MERGE_MAX=2×WALL_THICKNESS`)면 하나의 벽, 20cm 초과면 가운데 빈 틈.
- 벽 두께 `WALL_THICKNESS`=10, 벽 렌더 최소 두께 `WALL_MIN`=0.1.
- 방 추가 간격 `ROOM_ADD_GAP`=10(=`WALL_THICKNESS`). 활성 방 오른쪽에 두면 두 벽 띠가 정확히 맞닿아 10cm 벽 하나로 보인다.
- 가구 소속 = 바닥 박스 **중심점**이 내부에 있는 방(배열 앞쪽 우선). 없으면 소속 없음.
- 천장고 clamp: 소속 방의 `height`; 소속 없으면 모든 방 `height`의 **최솟값**.
- 문·창 호스트 벽 = 모든 방의 모든 변 중 가장 가까운 변. 거리 차 1cm 이내면 배열 앞쪽 방.
- 벽 경고: 가구가 **어느 한 방에 온전히** 있으면 없음. 방 사이 걸침·모든 방 밖이면 `WALL`.
- 활성 방 선택(`activeRoomId`)은 Undo 대상이 아니다. Undo 대상은 `{rooms, items}`.
- 방 삭제는 가구를 삭제하지 않는다. 마지막 방은 삭제할 수 없다.
- "새 방 만들기"(교체)는 **문서 전체 교체**(`rooms: [새 방]`)이고, 방 목록의 "방 추가"는 기존 방·가구를 보존한다(스펙 §5.5 진입점 구분).
- 커밋 메시지는 `<type>: <설명>`(한국어 가능). 빌드가 깨진 채로 커밋하지 않는다.

## Review Focus

- 방 2개가 변을 맞대고(간격 0) 가구가 한 방에 온전히 있으면 공유 면에 벽이 없고 `WALL` 경고도 없다.
- 방 추가·모서리 편집이 좌표를 음수로 만들면 문서 전체(방+가구)가 이동하고, Undo 1회로 이전 좌표로 돌아간다.
- 방을 삭제하면 그 방의 가구는 남아 `WALL` 경고가 뜨고, 활성 방은 유효한 방으로 해소되며, 마지막 방 삭제는 거부된다.
- 문을 다른 방 벽으로 옮기면 호스트 방이 바뀌고, 열림 부채꼴·`NO_SPACE`가 **새 호스트 방** 기준으로 다시 계산된다.
- 방 1개 문서에서 기존 동작(화면 구성, 방 만들기 클릭 수, 기존 테스트)이 그대로다.

---

### Task 1: 공유 헬퍼와 활성 방 상태

**Files:**
- Modify: `src/scene/geometry.ts` (`pointInPolygon` 이동·export)
- Create: `src/store/rooms.ts`
- Create: `src/store/activeRoom.ts`
- Modify: `src/store/useUiStore.ts` (`activeRoomId`, `setActiveRoomId`, 무효 id 해소)
- Modify: `src/store/useDocStore.ts` (`shiftItems` 정의를 `rooms.ts` import + re-export로 교체 — `roomForm.ts`가 이 경로로 import 중)
- Test: `src/store/rooms.test.ts` (신규), `src/store/store.test.ts` (activeRoomId 케이스 추가)

**Interfaces:**
- Produces(`src/scene/geometry.ts`):
  - `export function pointInPolygon(points: Point2[], x: number, z: number): boolean` — 기존 `collision.ts`의 `insidePolygon`을 그대로 옮긴다(경계 위 점의 판정 동작 불변). `collision.ts`는 이 함수를 import한다.
  - `export interface RoomWallHit { room: Room; roomIndex: number; wall: WallHit }`
  - `export function nearestWallIn(rooms: readonly Room[], x: number, z: number): RoomWallHit | null` — 배열 순으로 `nearestWall`을 계산하고 `h.wall.dist < best.wall.dist - 1`일 때만 교체(1cm 이내 동률은 앞 방). `ceilingForItem`과 이후 모든 판정이 이 함수를 공유한다.
- Produces(`src/store/rooms.ts`):
  - `export const nextRoomId = (rooms: readonly Room[]): string` — `/^r(\d+)$/` 최대값+1, `r{n}`.
  - `export const withRoom = (rooms: Room[], id: string, shape: RoomShape): Room[]` — 해당 id의 `height`·`points`만 바꾸고 나머지 참조 유지. 없는 id면 입력 배열 그대로.
  - `export const planShift = (rooms: readonly Room[]): [number, number]` — `min(minX, 0)`·`min(minZ, 0)`의 절댓값. 음수가 없으면 `[0, 0]`.
  - `export const shiftRooms = (rooms: Room[], s: [number, number]): Room[]` — 모든 점을 평행이동(이동 0이면 같은 배열).
  - `export const shiftItems = (items: Item[], s?: [number, number]): Item[]` — `useDocStore.ts`에서 여기로 이동(동작 동일: 이동 0이면 같은 배열).
  - `export const shiftDocument = (doc: DocData, s: [number, number]): DocData` — `shiftRooms` + `shiftItems`. `useDocStore`의 기존 `shiftItems` 정의는 Task 2에서 제거하고 import로 바꾼다.

  - `export const findRoomForItem = (rooms: readonly Room[], item: Pick<Item, 'position'>): Room | null` — 중심점 `pointInPolygon` 첫 일치 방.
  - `export const ceilingForItem = (rooms: readonly Room[], item: Item): number` — `FURNITURE`는 `findRoomForItem`, `FIXTURE`는 `nearestWallIn` 호스트 방; 둘 다 없으면 `Math.min(...rooms.map(r => r.height))`.
  - `export const clampElevations = (items: Item[], rooms: readonly Room[]): Item[]` — 가구마다 `ceilingForItem(rooms, item)`으로 clamp(바뀐 게 없으면 같은 배열). Task 2에서 `useDocStore`의 1인자 버전을 대체한다.
- Produces(`src/store/activeRoom.ts`):
  - `export const findRoom = (rooms: readonly Room[], id: string | null): Room` — 없으면 `rooms[0]`.
  - `export const getActiveRoom = (): Room`
  - `export const useActiveRoom = (): Room`
  - `export const useActiveRoomId = (): string`
- Produces(`src/store/useUiStore.ts`): `activeRoomId: string | null`(초기 `null`), `setActiveRoomId(id)`. 기존 `useDocStore.subscribe`에 "activeRoomId가 rooms에 없으면 `rooms[0].id`로 설정"을 추가.

- [ ] **Step 1: 실패하는 테스트를 쓴다** (`src/store/rooms.test.ts`, 사각형 헬퍼 사용).
  - `nextRoomId([r1])==='r2'`, `nextRoomId([r1,r5])==='r6'`, `nextRoomId([])==='r1'`
  - `withRoom([A,B],'r2',{...})` → `r2`만 바뀌고 `result[0]===A`
  - `planShift([{id:'r1',name:'방 1',height:240,points:[[-120,0],[0,0],[0,90],[-120,90]]}])` → `[120, 0]`; 음수 없으면 `[0,0]`
  - `shiftDocument`가 모든 방 점과 모든 가구 `position[0]`·`[2]`를 이동
  - `findRoomForItem` 중심 안/밖, 두 방 경계에 걸친 가구 → 앞 방
  - `ceilingForItem`: 소속 방 240/200 두 개에서 소속 가구는 그 방 높이, 소속 없으면 200
  - `nearestWallIn`: A `[0,0]-[300,300]`·B `[320,0]-[620,300]`, x=310 → A; x=305 → A; x=315.5 → B; 빈 배열 → null
  - `store.test.ts`: `setActiveRoomId('r2')` 뒤 `useDocStore.temporal.getState().pastStates.length`가 증가하지 않음; `loadDocument`로 rooms를 1개짜리 새 문서로 교체하면 `activeRoomId`가 `rooms[0].id`로 해소(Task 2의 `removeRoom` 의존 금지)
- [ ] **Step 2: 실패 확인.** `npx vitest run src/store/rooms.test.ts src/store/store.test.ts src/scene/geometry.test.ts` → 모듈/함수 없음으로 FAIL.
- [ ] **Step 3: 구현한다.** 위 시그니처대로. `pointInPolygon`은 `collision.ts`에서 제거하고 `geometry.ts`에서 export, `collision.ts`는 import로 교체. `shiftItems`는 `useDocStore.ts`에서 `rooms.ts`로 옮기고 `useDocStore`는 `import { shiftItems } from './rooms'` + `export { shiftItems }`로 기존 import 경로를 유지한다(roomForm.ts 회귀 방지). `activeRoomId` 무효 id 해소 구독은 `useUiStore.ts`의 기존 선택 해제 구독 옆에 둔다.
- [ ] **Step 4: 통과 확인.** 같은 명령 → PASS.
- [ ] **Step 5: 커밋.** `git add src/scene/geometry.ts src/scene/geometry.test.ts src/scene/collision.ts src/store/rooms.ts src/store/activeRoom.ts src/store/useUiStore.ts src/store/useDocStore.ts src/store/rooms.test.ts src/store/store.test.ts && git commit -m "feat: 활성 방 상태와 다중 방 공용 헬퍼 추가"`

---

### Task 2: 방 CRUD·좌표 불변식·소속 기준 clamp

**Files:**
- Modify: `src/store/useDocStore.ts`
- Modify: `src/io/validate.ts` (아이템 `elevation` 상한을 **소속 방** 천장고로; 소속 없으면 최저값)
- Test: `src/store/store.test.ts`, `src/io/validate.test.ts`

**Interfaces:**
- Produces(`useDocStore`):
  - `addRoom: (shape: RoomShape, name?: string) => string | null` — 이름 기본 `defaultRoomName(rooms.length + 1)`, id는 `nextRoomId`. `validateRoom`·`ROOMS_MAX`·기존 방과 `roomsOverlap`·문서 바운딩 `PLAN_EXTENT_MAX` 검사를 모두 통과할 때만 `set()` 1회로 `{rooms, items, pristine:false}`를 바꾸고 새 id를 돌려준다. `planShift`가 0이 아니면 `shiftDocument`를 같은 `set`에 적용한다. 실패면 `null`.
  - `removeRoom: (id: string) => boolean` — 마지막 방·없는 id면 false. 가구는 삭제하지 않고 유지하되, 소속 방 삭제로 fallback 천장고가 낮아질 수 있으므로 `elevation` clamp를 적용한다.
  - `renameRoom: (id: string, name: string) => boolean` — `trim`, 1~`NAME_MAX` 아니면 false.
  - `setRoomGeometry: (id: string, shape: RoomShape) => boolean` — 해당 방 `height`·`points` 교체, 소속 가구 `elevation` clamp, `planShift`면 `shiftDocument`. 다른 방과 `roomsOverlap`이면 false.
  - `setRoom` 삭제. `createRectRoom`·`createLRoom`·`createPolygonRoom`은 **문서 전체 교체**로 바꾼다: `rooms: [{ id: DEFAULT_ROOM_ID, name: defaultRoomName(1), ...shape }]`, `items`는 `keepItems ? clampElevations(shiftItems(s.items, shift), newRooms)` : `[]`(rect/L의 `shift`는 `[0,0]`) — `set()` 1회.
- **저장 유효성 보장(필수):** `addRoom`·`removeRoom`·`setRoomGeometry`·`create*`가 만든 결과 문서는 언제나 `parseDocument(serializeDocument(doc))`를 통과해야 한다. 공용 헬퍼 `finalizeDoc(rooms, items): DocData | null`을 `rooms.ts`에 두고
  1. `clampElevations(items, rooms)`,
  2. 방 전체 바운딩 박스 `PLAN_EXTENT_MAX`,
  3. 가구 `|x|`,`|z|` ≤ `PLAN_EXTENT_MAX`(validate와 동일 상한)
  를 한 번에 검사한 뒤, 실패면 `null`을 돌려주고 스토어 액션이 `false`/`null`로 거부한다. `removeRoom`은 `items`를 그대로 두되 이 clamp만 적용한다(소속 방 삭제로 fallback 천장고가 낮아질 수 있음).
- `partialize`·`equality`는 그대로 `{rooms, items}`. `rooms`가 빈 배열일 수 있는 외부 입력은 스토어가 가정하지 않는다 — `useUiStore` 구독은 `rooms.length` 가드를 둔다.

- [ ] **Step 1: 실패하는 테스트를 쓴다** (`store.test.ts`).
  - 초기 방 `r1`에 `addRoom({height:240, points:[[410,0],[710,0],[710,200],[410,200]]})` → 반환 `'r2'`, `rooms.length===2`, `rooms[1].name==='방 2'`
  - 음수 방 추가: 기존 `r1`=`[[0,0],[100,0],[100,100],[0,100]]`, 가구 `[10,0,10]`; `addRoom({height:240, points:[[-100,0],[-10,0],[-10,90],[-100,90]]})` → 성공, `r1` 모든 x +100, 가구 x=110, `pastStates` 증가 1, `undo()`로 rooms·items 참조 복원(`toBe`)
  - 겹치는 방 `[[0,0],[100,0],[100,90],[0,90]]` → `null`, 상태 불변
  - 21번째 방 → `null`; 바운딩 10001 → `null`
  - `removeRoom('r2')` → 가구 수 불변, `pastStates` 증가 1, `undo()`로 r2 복원; `removeRoom('r1')`(마지막) → false
  - 소속 방 삭제로 천장고 fallback이 낮아지면 가구 `elevation`이 clamp되고, 결과 문서가 validator 왕복을 통과한다
  - `addRoom`·`setRoomGeometry`가 바운딩 10000 초과 또는 가구 좌표 10000 초과를 만들면 거부되고 상태가 불변이다
  - 각 CRUD 뒤 `parseDocument(serializeDocument(...))` ok 단언
  - `isDragging()` 중 `addRoom`/`removeRoom`/`renameRoom`/`setRoomGeometry`가 false/null이고 상태 불변
  - `renameRoom('r1','거실')` → true; `''`·101자 → false; 이름 변경도 `pastStates` 증가 1
  - `setRoomGeometry('r2', {height:200, ...})` → r2 소속 가구만 clamp, r1 가구 불변; 소속 없는 가구는 최저 천장고. 구현은 `rooms.ts`의 `applyRoomGeometry`를 사용하고 Task 5 `commitPoints`도 같은 헬퍼를 쓴다(중복 방지)
  - `setRoomGeometry`로 점을 음수로 옮기면 문서 전체 이동 + Undo 1단계
  - `createRectRoom(500,400,240)` → `rooms.length===1`, `rooms[0].id==='r1'`; 다중 방 상태에서 호출하면 `rooms.length===1`(전체 교체)
  - `validate.test.ts`: 방 높이 240/180, 240 방에 `elevation:200` 창 → 저장 후 `parseDocument` 왕복 ok(최저값 180 기준이면 거부되므로 회귀 방지); 소속 없는 가구 `elevation:200` → 180 초과로 거부
- [ ] **Step 2-1: 방 CRUD 가드.** `addRoom`·`removeRoom`·`renameRoom`·`setRoomGeometry`는 `isDragging()`이면 즉시 실패(`false`/`null`)한다 — 코너 드래그 중 zundo pause 상태에서 이력 없는 변경을 막는다. `src/scene/dragSession.ts`의 `isDragging`을 사용한다.
- [ ] **Step 2: 실패 확인.** `npx vitest run src/store/store.test.ts` → FAIL.
- [ ] **Step 3: 구현한다.** 기존 `clampElevations(items, ceil)` 호출부를 `clampElevations(items, rooms)`로 바꾼다. `addItem`/`updateItem`의 clamp도 `ceilingForItem(rooms, item)` 기준.
- [ ] **Step 4: 통과 확인.** `npx vitest run src/store/store.test.ts` → PASS.
- [ ] **Step 5: 소비 코드 컴파일 정리.** `setRoom`은 `src/ui/actions.test.ts:39`만 사용한다 — `setRoomGeometry(getActiveRoom().id, shape)`로 바꾼다. `npm run build`로 컴파일 오류 0을 확인하고, `selectRoom`은 아직 유지한다.
- [ ] **Step 6: 커밋.** `git add src/store src/ui/actions.test.ts && git commit -m "feat: 방 추가·삭제·이름 변경과 좌표 불변식 적용"`

---

### Task 3: 다중 방 벽 두께와 고정 요소 변환

**Files:**
- Modify: `src/scene/geometry.ts`
- Test: `src/scene/geometry.test.ts`

**Interfaces:**
- Produces(`src/scene/geometry.ts`):
  - `export const WALL_MERGE_MAX = 2 * WALL_THICKNESS` (20), `export const WALL_MIN = 0.1`
  - `export const roomsBounds = (rooms: readonly RoomShape[]): Bounds` — 모든 방 점의 합집합 경계.
  - `export const edgeThickness = (points: Point2[], others: readonly Point2[][]): number[]` — 변마다 중점에서 바깥 법선 레이를 쏴 다른 방 경계까지 거리 `g`를 재고 `clamp(g/2, WALL_MIN, WALL_THICKNESS)`. 적중 없으면 `WALL_THICKNESS`.
  - `export const offsetPerEdge = (points: Point2[], t: number[]): Point2[]` — 변별 오프셋 두께로 마이터 오프셋. `t`가 전부 10이면 `offsetOutward(points, 10)`과 좌표가 같아야 한다.
  - `export const wallBand = (points: Point2[], others: readonly Point2[][]): Point2[]` — `offsetPerEdge(points, edgeThickness(points, others))`.
  - `export const fixtureTransformIn = (rooms: readonly Room[], item: Item): { position: Vec3; rotationY: number }` — Task 1의 `nearestWallIn` 호스트 방 `points`로 `fixtureTransform`을 적용. 방이 없으면 기존과 같이 원위치.
- 기존 `nearestWall(points, x, z)`, `fixtureTransform(item, points)`는 유지(단일 방 호출부·테스트 회귀).

- [ ] **Step 1: 실패하는 테스트를 쓴다** (`geometry.test.ts`).
  - `roomsBounds`: `[0,0]-[400,300]`·`[410,0]-[710,200]` → `{minX:0,maxX:710,minZ:0,maxZ:300}`
  - `edgeThickness`: 맞닿은 방(간격 0) → `WALL_MIN`; 간격 10 → 5; 18 → 9; 20 이상 → 10; 다른 방 없음 → 10
  - `offsetPerEdge(pts, Array(n).fill(10))` → `offsetOutward(pts, 10)`과 각 점 1e-9 이내; ㄱ자 오목 코너 유지
  - `offsetPerEdge` 혼합 두께(`[5, 10, 5, 10]`) 마이터 결과: 각 변이 자기 두께만큼 오프셋되고 코너가 교차하는지 확인(단순 기대 좌표), ㄱ자+이웃 방에서 `wallBand`가 자기 내부를 포함하지 않고(self-intersection 없음) 변마다 두께가 다른지
  - `fixtureTransformIn`: 방 1개일 때 `fixtureTransform(item, room.points)`와 deep equal; 이웃 방 벽이 더 가까우면 그 방 기준
- [ ] **Step 2: 실패 확인.** `npx vitest run src/scene/geometry.test.ts` → FAIL.
- [ ] **Step 3: 구현한다.** `edgeThickness`의 교차는 다른 방의 모든 변과 반직선 교차로 계산한다. 레이는 변 중점 + 바깥 법선, 길이 상한 `WALL_MERGE_MAX`.
  - `ponytail:` 변 중점 광선 하나로 변 전체 두께를 정한다. 이웃과 일부만 마주한 변(T자)은 비인접 구간까지 `g/2`로 얇아질 수 있고, 간격 0은 양쪽 0.1cm 띠(합 0.2cm)가 남는다. 4단계에서 필요하면 이웃 코너 투영점으로 변을 분할한다.
- [ ] **Step 4: 통과 확인.** 같은 명령 → PASS.
- [ ] **Step 5: 커밋.** `git add src/scene/geometry.ts src/scene/geometry.test.ts && git commit -m "feat: 다중 방 벽 두께와 고정 요소 변환 추가"`

---

### Task 4: 판정·고정 요소 일반화

**Files:**
- Modify: `src/scene/collision.ts`, `src/scene/useWarnings.ts`, `src/trace/trace.ts`(`relocateFixtures`)
- Modify: `src/store/useEditStore.ts`(`relocateFixtures` 호출부), `src/ui/roomForm.ts`(`computeWarnings` 호출부)
- Modify: `src/ui/{fixturePlacement,placement,actions,DimensionPanel}.ts(x)` (액션 호출부 포함)
- Test: `src/scene/collision.test.ts`, `src/ui/placement.test.ts`, `src/ui/uiFlows.test.ts`, `src/trace/trace.test.ts`

**Interfaces:**
- `computeWarnings(rooms: Room[], items: Item[]): Warning[]` — 판정 순서:
  - `WALL`: `rooms.some((r) => insideRoom(r.points, box))`가 거짓일 때만 1건.
  - `ITEM`: 전역 가구 쌍 그대로.
  - `NO_SPACE`: `nearestWallIn`의 호스트 벽 `len < fx.size[0] - FIT_EPS`.
  - `DOOR_SWING`: `doorSwing(door, host.room.points)`. 실외 부채꼴은 기존처럼 제외.
  - `FIXTURE_OVERLAP`: 벽 키를 `${roomIndex}|${a[0]},${a[1]},${dir[0]},${dir[1]}`로.
- `selectWarnings(rooms: Room[], items: Item[])`, 캐시 키 `rooms`·`items` 참조.
- `relocateFixtures(rooms: Room[], items: Item[]): { items: Item[]; unfit: string[] }` — 모서리 편집 후 모든 방 벽 기준. `unfit`은 기존 계약대로 id 문자열 배열(`src/trace/trace.ts`·테스트 유지).
- `makeFixture(modelType: string, rooms: Room[], active: Room, items: Item[]): Item | null` — 활성 방 변에서 빈 구간, 점유 계산은 host가 모든 방 기준.
- `findFreeSpot(rooms, active, items, candidate)`, `makeFromCatalog(entry, rooms, active, items)`, `makeDimensionBox(spec, rooms, active, items)`.
- `DimensionPanel` 고정 요소 필드: 폭 상한 `nearestWallIn(rooms, …).wall.len`, 높이 상한 host 방 `height`.

- [ ] **Step 1: 실패하는 테스트를 쓴다.**
  - `collision.test.ts`: 간격 0 두 방에 걸친 가구 → `WALL`; B 안 가구 → 경고 없음; A 벽 400·B 벽 200인데 폭 250 문을 B에 두면 `NO_SPACE`; 문 x=310(동률) → A 벽 기준 부채꼴; 한 방 같은 벽의 겹치는 두 문 → `FIXTURE_OVERLAP` 유지(회귀); 서로 다른 방 host의 문은 `roomIndex` 키로 분리됨(같은 a·dir 좌표여도 host가 다르면 경고 없음)
  - `placement.test.ts`: `findFreeSpot`가 활성 방 안, 다른 방 가구와 겹치는 후보 회피; `makeFixture`가 활성 방 가장 긴 벽 사용, 다른 방 고정 요소 점유 반영
  - `trace.test.ts`(기존): `relocateFixtures(rooms, items)` 회귀 — 방 1개일 때 기존 결과 동일
- [ ] **Step 2: 실패 확인.** `npx vitest run src/scene/collision.test.ts src/ui/placement.test.ts src/trace/trace.test.ts` → FAIL.
- [ ] **Step 3: 구현한다.** `insidePolygon` 참조를 `pointInPolygon`으로 바꾸고 중복 정의를 남기지 않는다. `useWarnings`는 `rooms`·`items`를 구독한다.
- [ ] **Step 4: 통과 확인.** 같은 명령 → PASS. 이어서 `npm run build`로 `computeWarnings`·`relocateFixtures` 시그니처 변경의 컴파일 오류가 0인지 확인한다(모든 호출부를 이 작업에서 함께 고친다).
- [ ] **Step 5: 커밋.** `git add src/scene src/trace src/ui && git commit -m "feat: 다중 방 기준 충돌·문·고정 요소 판정으로 일반화"`

---

### Task 5: 활성 방 소비자 전환과 편집 경계

**Files:**
- Modify: `src/store/useEditStore.ts`, `src/ui/{actions,WallEditor,DimensionPanel,RoomDialog}.tsx?`
- Modify(최소 전환): `src/scene/{Scene,useSceneKeys}.tsx?`
- Test: `src/store/store.test.ts`, `src/ui/actions.test.ts`, `src/ui/uiFlows.test.ts`, `src/trace/trace.test.ts`, `src/store/traceDraw.test.ts`, `src/ui/roomNotch.test.ts`

**Interfaces:**
- `selectRoom` **삭제**. 모든 소비자는 `useActiveRoom()`(React) 또는 `getActiveRoom()`(비React).
- `useEditStore`: 모든 편집이 활성 방 대상. `commitPoints(points)` 순서:
  1. `editError(points)`로 방 자체 규칙 검사,
  2. 다른 방과 `roomsOverlap`이면 `'다른 방과 겹칩니다'` 오류,
  3. `relocateFixtures(rooms, items)`로 고정 요소 재배치(AC-05-4 유지),
  4. 새 rooms에 `planShift`가 0이 아니면 `shiftDocument`로 문서 전체 이동,
  5. `loadDocument` **1회**로 커밋(방 편집 + 재배치 + 이동이 Undo 1단계), `unfit`은 기존 토스트.
- `moveCorner`도 같은 `roomsOverlap` 검사를 해 드래그 미리보기가 겹친 채 진행되지 않게 한다. `endCornerDrag`는 `commitPoints`의 오류를 버리지 말고 `notice`로 표시한다.
- `withFirstRoom` 삭제, `withRoom(rooms, activeId, shape)` 사용.
- 활성 방이 바뀌면 편집 선택을 정리한다: **`useEditStore.ts`의 기존 `useDocStore.subscribe` 옆에** `useUiStore.subscribe`를 두고 `activeRoomId` 변화 시 `useEditStore.getState().selectCorner(null)`(드래그 중이면 `cancelCornerDrag()` 먼저). `useEditStore → useUiStore` 방향만 생겨 순환 import가 없다.
- `commitPoints`의 방·가구 갱신은 `rooms.ts`의 순수 헬퍼 `applyRoomGeometry(doc, id, shape) → DocData | null`를 `setRoomGeometry`와 공유한다(검증·clamp·`finalizeDoc` 중복 방지, 재배치·이동은 호출부에서 먼저 적용).`
- `WallEditor`·`DimensionPanel`·`RoomDialog`의 방 편집은 활성 방의 `height`·`points`.

- [ ] **Step 1: 실패하는 테스트를 쓴다.**
  - `setActiveRoomId('r2')` 뒤 `setWallLength`가 r2만 바꾸고, `undo()`로 r2가 복원
  - r2를 삭제한 뒤 `getActiveRoom()`이 `rooms[0]`
  - 활성 방 모서리를 다른 방과 겹치게 옮기면 false + 상태 불변
  - 활성 방 점을 음수로 옮기면 문서 전체 이동 + Undo 1회
  - 기존 6개 테스트 파일에서 `selectRoom` import를 `getActiveRoom`/`useActiveRoom`로 바꾸고 단언은 유지
- [ ] **Step 2: 실패 확인.** `npx vitest run src/store src/ui` → FAIL.
- [ ] **Step 3: 구현한다.** `useEditStore`의 `rooms[0]` 직접 접근을 모두 활성 방 기준으로 바꾼다. `stores/`와 `ui/`를 먼저 옮기고, `scene/`의 `selectRoom` 사용은 import만 `useActiveRoom`으로 바꾼다(렌더 구조는 Task 7).
- [ ] **Step 4: 통과 확인.** `npx vitest run src/store src/ui` → PASS. `grep -rn "selectRoom" src` → 0건.
- [ ] **Step 5: 커밋.** `git add src && git commit -m "refactor: 방 소비 코드를 활성 방 기준으로 전환"`

---

### Task 6: 방 목록과 방 추가 UI

**Files:**
- Create: `src/ui/RoomList.tsx`
- Modify: `src/ui/PanelSections.tsx`, `src/ui/RoomDialog.tsx`, `src/ui/roomForm.ts`
- Test: `src/ui/uiFlows.test.ts` (또는 새 `src/ui/roomList.test.ts`)

**Interfaces:**
- `RoomDialog` prop `mode?: 'replace' | 'add'`(기본 `'replace'`). add 모드: 제목 "방 추가", `keepItems`·방 밖 개수 UI 숨김, 제출은 `submitAddRoomForm`. 2단계의 add 모드는 **사각형·ㄱ자만** 제공하고, "그려서 만들기"·이미지 트레이싱 진입점은 숨긴 채 "다중 방 그리기는 다음 단계에서 지원합니다" 한 줄을 둔다(§5.5는 4단계).
- `roomForm.ts`:
  - `export const ROOM_ADD_GAP = 10`
  - `export const placeRightOf = (active: Room, points: Point2[]): Point2[]` — `dx = active.maxX + ROOM_ADD_GAP - minX(points)`, `dz = active.minZ - minZ(points)`
  - `export const submitAddRoomForm = (f: RoomForm): string | null`
- `RoomList`:
  - `role="list"`, `aria-label="방 목록"`; 행마다 이름 버튼(`aria-current`), "이름 변경", "삭제".
  - 이름 변경은 인라인 `<input maxLength={NAME_MAX}>`, Enter/blur에 `renameRoom`.
  - 삭제는 기존 `ConfirmDialog` 재사용, 문구 "「{name}」 방을 삭제할까요? 가구는 남습니다". `rooms.length === 1`이면 비활성.
  - "방 추가" 버튼 → `RoomDialog mode="add"`, 성공 시 `setActiveRoomId(newId)`. `rooms.length >= ROOMS_MAX(20)`이면 비활성 + `title`/안내 "방은 최대 20개까지 추가할 수 있습니다".
  - 방 1개면 목록을 이름 + 추가 버튼의 한 줄로 접는다.
- `PanelSections`의 기존 "새 방 만들기"는 `mode="replace"`로 유지(단일 방 화면 불변). 방이 2개 이상일 때는 이 버튼을 누르면 `ConfirmDialog`로 "현재 문서의 모든 방이 새 방으로 교체됩니다. 계속할까요?"를 먼저 확인한다(가구 유지 선택은 그대로).

- [ ] **Step 1: 실패하는 테스트를 쓴다.**
  - `placeRightOf`: 활성 `[[0,0],[400,0],[400,300],[0,300]]` + 새 300×200 → `[[410,0],[710,0],[710,200],[410,200]]`; ㄱ자도 동일 이동
  - add 모드 제출 → `rooms.length===2`, 새 방 id가 활성
  - 삭제 → 가구 유지, 활성 방 해소, 방 1개면 삭제 버튼 비활성
  - 이름 변경 → 목록과 저장 문서 반영
  - 방 1개일 때 기존 "새 방 만들기" 흐름의 입력/버튼 수가 이전과 같다
  - 20개 상태에서 "방 추가"가 비활성이고 이유가 노출된다
  - 방 2개 상태에서 "새 방 만들기"는 확인 대화상자를 거치고, 취소하면 문서가 바뀌지 않는다
- [ ] **Step 2: 실패 확인.** `npx vitest run src/ui` → FAIL.
- [ ] **Step 3: 구현한다.** `ConfirmDialog`는 `MenuButton`처럼 로컬 상태로 연다. `RoomList`는 `useDocStore`의 `rooms`와 `useActiveRoomId`를 구독한다.
- [ ] **Step 4: 통과 확인.** `npx vitest run src/ui` → PASS.
- [ ] **Step 5: 커밋.** `git add src/ui && git commit -m "feat: 방 목록과 방 추가 UI 추가"`

---

### Task 7: 방별 렌더와 활성 방 선택

**Files:**
- Modify: `src/scene/Scene.tsx`, `src/index.css`
- Test: 로직은 Task 3이 덮는다. 렌더는 `docs/browser-checklist.md` 항목으로 고정.

**Interfaces:**
- `Scene`: `const rooms = useDocStore(s => s.rooms)`, `const active = useActiveRoom()`, 경계 `roomsBounds(rooms)`.
- `Walls({ room, rooms })` — `const band = wallBand(room.points, rooms.filter(r => r.id !== room.id).map(r => r.points))`; `Shape(band)`에 자기 내부 `room.points`를 hole로 넣어 `ExtrudeGeometry`(기존 재질 유지).
- `Floor({ room, active, onActivate })` — 클릭 시 `setActiveRoomId(room.id)` + `select(null)`; 1인칭 텔레포트 동작 유지.
- `WallDims({ room, active, labelRoot })` — 활성 방은 `scene-label`, 비활성은 `scene-label muted`.
- `Furniture`·`Fixture`는 모든 방에서 렌더하고, 고정 요소 변환은 `fixtureTransformIn(rooms, item)`, 문 부채꼴은 `nearestWallIn`의 호스트 방 `points`로 `doorSwing`.
- **고정 요소 깊이 보정:** `fixtureTransformIn`은 호스트 방의 가장 가까운 변의 실제 띠 두께(`edgeThickness`)의 절반만큼만 바깥에 놓는다. 간격 10cm 이웃 벽(띠 5cm)에서 문이 벽 밖으로 5cm 떠 보이는 것을 막는다. `nearestWall`에 변 인덱스가 없으므로 `WallHit`에 `index: number`를 추가하거나 호스트 방 변을 다시 훑어 일치하는 변을 찾는다. 단위 테스트: 외톨이 방 → 중심 5cm, 10cm 간격 이웃 벽 → 중심 2.5cm.
- 활성 방 표시: 바닥 색을 살짝 밝게(예: `#d7ccc8` → `#e8ded9`) + `Edges`/outline. `CornerEditLayer`는 활성 방만, `key={active.id}`.
- `.scene-label.muted { opacity: .4 }`를 `src/index.css`에 추가.

- [ ] **Step 1: 브라우저 점검표에 항목을 추가한다** (`docs/browser-checklist.md`).
  - 맞닿은 두 방: 공유 면에 벽이 없다
  - 10cm 간격: 하나의 벽으로 보인다(이중 블렌딩 없음)
  - 30cm 간격: 가운데 빈 틈이 보인다
  - 활성 방 바닥이 구분되고, 비활성 방 치수 라벨이 옅다
  - 다른 방 바닥 클릭으로 활성 방이 바뀐다(1인칭 클릭 텔레포트 유지)
  - 비활성 방에는 모서리 핸들·벽 길이 편집이 나타나지 않는다
- [ ] **Step 2: 렌더를 구현한다.** 컴포넌트는 `rooms.map(...)`. `Walls` geometry는 `useMemo([room, rooms])`.
- [ ] **Step 3: 타입·빌드 확인.** `npm run build` → 오류 0.
- [ ] **Step 4: 기존 테스트 회귀 확인.** `npm test` → PASS(방 1개 문서).
- [ ] **Step 5: 커밋.** `git add src/scene/Scene.tsx src/index.css docs/browser-checklist.md && git commit -m "feat: 방별 바닥·벽 렌더와 활성 방 선택"`

---

### Task 8: 드래그·카메라·경고 연결

**Files:**
- Modify: `src/scene/{interaction.ts,useItemDrag.ts,useSceneKeys.ts,CameraRig.tsx,Scene.tsx}`
- Test: `src/scene/interaction.test.ts`, `src/scene/useWarnings.test.ts`(신규 가능)

**Interfaces:**
- `projectOntoWall(rooms: Room[], x, z, width, step?)`, `moveTarget(item, x, z, rooms, step?)` — 고정 요소는 `nearestWallIn`, 가구는 스냅만.
- `useItemDrag(id)` — `points` 인자 제거, 드래그 중 store의 `rooms` 사용.
- `CameraRig({ mode, bounds, eye })` — `bounds`는 `roomsBounds(rooms)` 합집합, `eye`는 활성 방 경계 중앙(1인칭 시작점).
- `useWarnings`는 Task 4에서 완료. `selectWarnings(rooms, items)` 캐시가 `rooms` 참조 교체 시 재계산.

- [ ] **Step 1: 실패하는 테스트를 쓴다.**
  - `interaction.test.ts`: 문이 커서가 있는 방의 벽으로 투영, 벽 폭 clamp 유지; 두 방 벽 거리 동률이면 앞 방; 가구는 방 밖 좌표도 스냅 허용, y=0
  - `useWarnings.test.ts`: 같은 `rooms`·`items` 참조면 같은 배열, `rooms` 교체 시 새 배열
  - 방 1개 문서: 기존 `interaction.test.ts` 결과와 동일
- [ ] **Step 2: 실패 확인.** `npx vitest run src/scene/interaction.test.ts src/scene/useWarnings.test.ts` → FAIL.
- [ ] **Step 3: 구현한다.** `useItemDrag` 호출부(`Furniture`·`Fixture`)에서 `points` 인자를 제거한다. `CameraRig`의 기존 동작(2D 맞춤, 쿼터, 1인칭)은 유지하고 bounds/eye만 바꾼다.
- [ ] **Step 4: 통과 확인.** `npm test` → PASS, `npm run build` → 오류 0, `npm run lint` → 0.
- [ ] **Step 5: 커밋.** `git add src/scene && git commit -m "feat: 다중 방 드래그·카메라·경고 연결"`

---

### Task 9: 규약·점검표 문서 동기화

**Files:**
- Modify: `.claude/skills/roomfit-conventions/SKILL.md`
- Test: 없음(문서). `npm test` 회귀만 확인.

- [ ] **Step 1: 규약에 반영한다.** 활성 방(`useUiStore.activeRoomId`, Undo 비대상), 좌표 불변식과 같은 Undo 단계, 소속 방 중심점 규칙, 천장고 clamp 기준, 호스트 벽 동률 1cm 규칙, 방 추가 간격 10cm, 방 삭제 시 가구 유지, "새 방 만들기"=문서 교체 / "방 추가"=보존.
- [ ] **Step 2: 브라우저 점검표를 정리한다.** Task 7의 항목을 해당 섹션으로 옮기고 중복을 제거한다.
- [ ] **Step 3: 커밋.** `git add .claude/skills/roomfit-conventions docs/browser-checklist.md && git commit -m "docs: 다중 방 2단계 규약과 브라우저 점검표 갱신"`

---

## 자체 점검

- **스펙 범위:** §5.2(배치 규칙·좌표 불변식·벽 간격 렌더) = Task 2·3·7, §5.3(판정) = Task 4·5·8, §5.4(활성 방·목록·추가/삭제) = Task 1·2·5·6·7, §5.6(장면·카메라) = Task 7·8. §5.5(트레이싱·다중 방 그리기)는 4단계, 문서 전체 동기화(PRD·와이어프레임)는 5단계로 의도적으로 제외.
- **타입 일관성:** `RoomShape`, `RoomWallHit`, `nearestWallIn`, `fixtureTransformIn`, `shiftDocument`, `findRoomForItem`, `ceilingForItem`, `placeRightOf`, `submitAddRoomForm`은 정의한 작업에서만 쓰인다.
- **알려진 편차:**
  1. 벽 렌더는 스펙 문면(링 − 모든 내부) 대신 변별 두께 `g/2` 근사다. **변이 완전히 마주한 경우** 0은 사실상 비가시(합 0.2cm 띠), 0<g≤20은 하나의 벽(g), >20은 가운데 g−20 틈으로 스펙과 같은 시각 결과다. 변이 일부만 마주치는 T자와 0<g<0.2에서는 근사 오차가 있다(`ponytail:` 주석, 4단계에서 필요 시 변 분할).
  2. 문 거리 동률 1cm 규칙상, 간격 0으로 공유된 변에서는 배열 앞 방이 호스트가 되어 "방 추가로 만든 활성 방"과 다를 수 있다(스펙 결정적 규칙).
  3. 1인칭 시작점은 활성 방 경계 중앙이며, ㄱ자에서 방 밖일 수 있다(기존 동작 유지).
- **테스트 비중:** 순수 로직(기하·판정·CRUD·폼)은 Vitest로 고정하고, 렌더 결과·시각 항목은 브라우저 점검표로 넘긴다.

## 실행 순서

Task 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 (직렬). Task 1~5는 서로 인터페이스로 묶여 있어 병렬 금지, 6~8은 5 이후 순차.
