# 다중 방 3단계(트레이싱·그리기 다중 방, 이웃 스냅, 겹침 검증) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 한 장의 평면도(또는 빈 캔버스)에서 축척을 한 번만 잡고 방을 차례로 따서, 방끼리 위치가 어긋나지 않게 문서에 추가한다. 그리는 점은 이웃 방에 달라붙고, 다른 방과 내부가 겹치면 닫을 수 없다.

**Architecture:** 트레이싱 세션이 이미지·축척·기준선을 방 확정 뒤에도 메모리에 유지하고, 평면 cm → 문서 cm의 누적 `offset`(`doc = round(plane + offset)`)을 들고 있다. 닫기·확정·고스트(기존 방 옅은 윤곽)·스냅이 모두 이 한 좌표 변환을 거친다. 점 확정은 `placePoint` 한 곳으로 모아 미리보기와 실제 찍힌 점이 같게 한다. 방 확정은 2단계의 `addRoom`(replace 첫 방만 `createPolygonRoom`)을 그대로 쓴다.

**Tech Stack:** TypeScript, React, Zustand, three.js/@react-three/fiber, Vitest(`npm test`), Vite(`npm run build`), oxlint(`npm run lint`).

**Spec:** `docs/superpowers/specs/2026-11-19-multi-room-design.md` (§5.5, §7-4·5단계). 2단계 계획: `docs/superpowers/plans/2026-11-19-multi-room-stage2-judgment-scene-ui.md`(적용 완료). 스펙의 단계 번호로는 4·5단계에 해당한다(2단계에서 스펙의 2·3단계를 함께 끝냈다).

## Global Constraints

- 단위 1unit=1cm, 좌표 `[x, z]`, 10cm 스냅. 불변 갱신, 파일 800줄 이하. 빌드가 깨진 채 커밋하지 않는다.
- 2단계 제약 유지: 방 개수 ≤20, 방 `ROOM_MAX` 3000, 문서 바운딩 `PLAN_EXTENT_MAX` 10000, 방 내부 겹침 거부(변·점 접촉은 허용), 좌표 불변식(min x·z ≥ 0, 위반 시 문서 전체 이동은 같은 Undo 1단계), 방 확정 1회 = Undo 1단계. 트레이싱 중간 상태는 Undo 대상이 아니다.
- 트레이싱 이미지·축척·기준선·offset은 세션 메모리에만 두고 저장 JSON에 넣지 않는다(스펙 §5.5).
- `doc = round(plane + offset)`가 세션 내내 이미 확정한 모든 방(add 모드면 기존 방 포함)에 성립한다. 방별 원점 정규화(min→(0,0))는 replace 모드의 **첫 방에만** 쓴다.
- 이웃 스냅: 반경 `SNAP_RADIUS`=15cm, 우선순위 꼭짓점 > 변, 이웃 방 바깥으로 `NEIGHBOR_GAP`=10cm 떨어진 링(`offsetOutward(방, 10)`)에 붙인다. 간격 0(열린 구조) 스냅은 두지 않는다.
- 점 확정 순서: 직각 보정 → 격자 스냅(`drawPoint`) → 이웃 스냅(잡히면 그 결과가 격자 결과를 덮어쓰고, 직각 켜짐이면 고정 축은 직전 점 값 유지) → 빈 캔버스 영역 clamp. 길이 입력(`addTracePointByLength`)에는 이웃 스냅을 적용하지 않는다.
- 이웃 스냅 해제: 포인터 이벤트의 **Shift를 누른 동안** 임시 해제, 지속 해제는 체크박스 "이웃 방에 붙이기". 체크박스는 고스트(기존 방)가 있을 때만 보인다.
- 첫 방을 확정한 뒤에는 이미지·축척·기준선 변경(`loadImageFile`은 objectURL 생성 전에 거부)과 `start`를 잠근다(offset이 무의미해지므로).
- 방 1개 사용자(`confirmed === 0`)의 취소·Esc는 현행대로 확인 없이 즉시 `cancel()`한다.
- 빈 캔버스 그림 영역: 고스트가 없으면 `[0,3000]²`(현행). 있으면 고스트 바운딩 박스를 `ROOM_MAX`(3000)씩 사방으로 넓히고 10cm 배수로 바깥 반올림한 `Bounds`.
- 방 1개짜리 사용자의 기존 흐름("그려서 만들기" → "방 생성")은 클릭 수가 같고 화면·버튼이 그대로이며, 트레이싱 확정 화면에 [방 생성 후 다음 방 따기] 버튼 **하나만** 늘어난다.
- 이웃 스냅 마커의 Shift 반영은 포인터가 움직일 때 갱신된다(누른 채 정지하면 다음 이동 전까지 이전 상태). 알려진 한계로 둔다.
- 커밋 메시지는 `<type>: <설명>`(한국어 가능).

## Review Focus

- 기존 방 **왼쪽**(음수 좌표)에 방을 확정해 문서가 이동해도, 다음 방이 정확히 이어 붙는다(offset 누적). Undo 1회로 확정과 이동이 함께 되돌아간다.
- 이웃 방 변 15cm 안에서 점이 정확히 10cm 간격 평행선으로 붙고, 겹치게 닫으면 거부되며 변이 닿는 것만이면 통과한다. 닫은 뒤 점 추가·삭제로 겹치게 만들어도 막힌다.
- 방이 20개일 때 "방 생성 후 다음 방 따기"가 비활성이고 이유가 보인다. 확정 도중 취소/Esc는 이미 확정한 방을 건드리지 않는다.
- 첫 방 확정 뒤 이미지·축척·기준선을 바꿀 수 없다(버튼 숨김 + 스토어 무시). 
- 방 1개 사용자의 replace 흐름이 이전과 같다(기존 테스트 전부 통과).

## 판정 기록 (설계 두 건의 불일치를 해소한 결과)

| 쟁점 | 판정 | 이유 |
|---|---|---|
| 이웃 간격 | `NEIGHBOR_GAP`=10 (`ROOM_ADD_GAP`과 같은 값) | 2단계 벽 띠 모델에서 간격 g는 곧 공유 벽 두께다. 10이면 프리셋 "방 추가"와 같은 10cm 벽 하나. 스펙 문면 `WALL_THICKNESS×2`=20은 20cm 두꺼운 벽이 된다. **사용자 확인 필요** |
| 스냅 해제 키 | Shift(포인터 이벤트 `shiftKey`) + 체크박스 | Alt는 Windows keyup 메뉴 포커스·Linux 창 이동과 충돌. 전역 키 리스너 없이 이벤트의 modifier만 쓴다 |
| 방 추가 + 이미지 첫 방 | 정렬 없이 그리고, 확정 때 `placeRightOf(활성 방)`로 배치한 뒤 그 위치로 offset을 정한다 | 새 이미지는 기존 방과의 상대 위치를 알 수 없다. 원점 일치(offset [0,0])는 기존 방과 임의로 겹쳐 혼란. 첫 방 확정 전에는 고스트·이웃 스냅을 숨긴다 |
| 방 추가 + 빈 캔버스 | 평면 = 문서 좌표(offset [0,0]), 고스트·스냅 즉시 사용 | 정렬 문제가 없다 |
| 그림 영역 | app 안(`blankArea`, 고스트 ±3000) | 단일 규칙. PRD AC-04-7 문구 수정 필요(Task 8) |
| 확정 버튼 | [방 생성](끝냄, 현행) + [방 생성 후 다음 방 따기] | 별도 중간 단계는 1방 사용자의 클릭을 늘린다 |
| 스냅 상태 | 저장하지 않고 `previewPoint().hit`에서 파생 | 중복 상태 방지 |
| 홈/돌출(§5.5 마지막 항목) | 코드 불필요 | 홈/돌출은 방 대화상자 입력 모양에만 적용되고 기존 방을 제자리에서 바꾸는 경로가 없다(`grep notchWall|applyNotches`: `trace.ts`·`roomNotch.ts`·`roomForm.ts`뿐) |

---

### Task 1: 문서 좌표 닫기와 겹침 검증 (순수)

**Files:**
- Modify: `src/trace/trace.ts` (`toDocPoints`, `closePolygon(points, frame?)`, `OVERLAP_MESSAGE`, `CloseError.overlaps`)
- Modify: `src/scene/geometry.ts` (`ROOM_ADD_GAP`=`WALL_THICKNESS`를 여기로 이동)
- Modify: `src/store/rooms.ts` (`placeRightOf`를 `ui/roomForm.ts`에서 이동 — store가 ui를 import하지 않게 한다)
- Modify: `src/ui/roomForm.ts` (`ROOM_ADD_GAP`·`placeRightOf` re-export, 기존 import 경로 유지)
- Modify: `src/store/useEditStore.ts` (겹침 문구를 `OVERLAP_MESSAGE`로 통일)
- Test: `src/trace/trace.test.ts`

**Interfaces:**
- Produces:
  - `export function toDocPoints(points: Point2[], offset: Point2): Point2[]` — `round(p + offset)`, CCW 보정, **min 정규화 없음**. 기존 `toRoomPoints(points)`를 `toDocPoints(points, [-minX, -minZ])`로 재정의한다(동작 동일).
  - `export const OVERLAP_MESSAGE = '다른 방과 내부가 겹칩니다'`
  - `export interface DocFrame { offset: Point2; others: readonly Point2[][] }` (`others`는 문서 좌표 방들)
  - `closePolygon(points: Point2[], frame?: DocFrame)`: frame 없으면 현행과 동일. 있으면 `room = toDocPoints(points, frame.offset)`로 기존 검사(중복·교차·면적·`validateRoom`) 뒤 ① `others.some((o) => roomsOverlap(o, room))` → `OVERLAP_MESSAGE`와 겹친 `others` 인덱스 목록 `overlaps`, ② `others`+`room` 전체 범위 > `PLAN_EXTENT_MAX` → `집 전체 크기가 ${PLAN_EXTENT_MAX}cm를 넘습니다`.
  - `editError`는 바꾸지 않는다. `ROOM_ADD_GAP`은 `geometry.ts`에서 export(`= WALL_THICKNESS`).

- [ ] **Step 1: 실패하는 테스트를 쓴다** (`trace.test.ts`).
  - `toDocPoints([[100,100],[400,100],[400,300],[100,300]], [-100,-100])` → `[[0,0],[300,0],[300,200],[0,200]]`
  - 시계 방향 입력 `[[100,100],[100,300],[400,300],[400,100]]`, offset `[-100,-100]` → CCW로 뒤집힌 `[[300,0],[300,200],[0,200],[0,0]]`(**점 순서가 `points[0]`을 정하므로 `toEqual`로 이 순서 그대로 단언**; `docShiftDelta`·`placeRightOf` 번역량이 이 순서를 쓴다)
  - `toRoomPoints` 기존 테스트 전부 통과(재정의 회귀)
  - 겹친 방이 여러 개이면 `overlaps`가 `[0,2]`처럼 해당 인덱스 모두를 담는다
  - `placeRightOf`는 이동 뒤에도 기존 테스트(`roomList.test.ts`)가 `roomForm` 경로로 통과한다
  - frame `{offset:[0,0], others:[[[0,0],[300,0],[300,200],[0,200]]]}`: `[[200,0],[500,0],[500,200],[200,200]]` → `OVERLAP_MESSAGE`, `overlaps:[0]`; `[[300,0],[500,0],[500,200],[300,200]]`(변 접촉) → ok, 값 그대로; `[[-210,0],[-10,0],[-10,200],[-210,200]]` → ok, 음수 유지
  - others `[[[0,0],[3000,0],[3000,100],[0,100]]]` + 점 `[[7010,0],[10010,0],[10010,100],[7010,100]]` → 10000cm 문구
- [ ] **Step 2: 실패 확인.** `npx vitest run src/trace/trace.test.ts` → FAIL.
- [ ] **Step 3: 구현한다.** 순환 import를 만들지 않는다(`trace/`가 `ui/`를 import하지 않도록 `ROOM_ADD_GAP`을 `geometry.ts`로 옮긴다).
- [ ] **Step 4: 통과 확인.** 같은 명령 + `npm run build` → PASS.
- [ ] **Step 5: 커밋.** `git add src && git commit -m "feat: 트레이싱 닫기에 문서 좌표 변환과 방 겹침 검증 추가"`

---

### Task 2: 이웃 스냅 순수 모듈

**Files:**
- Create: `src/trace/neighborSnap.ts`
- Test: `src/trace/neighborSnap.test.ts`

**Interfaces:**
- Consumes: `drawPoint`, `orthoProject`(`src/trace/draw.ts`), `offsetOutward`·`ROOM_ADD_GAP`(`src/scene/geometry.ts`)
- Produces:
  - `export const SNAP_RADIUS = 15`, `export const NEIGHBOR_GAP = ROOM_ADD_GAP`
  - `export type NeighborHit = { kind: 'vertex'; point: Point2; room: number; vertex: number } | { kind: 'edge'; point: Point2; room: number; edge: [Point2, Point2] }`
  - `export const snapRings = (ghosts: Point2[][], gap = NEIGHBOR_GAP): Point2[][]`
  - `export function placeDrawPoint(prev: Point2 | null, cursor: Point2, o: { ortho: boolean; step: number; rings: Point2[][]; neighbor: boolean }): { point: Point2; hit: NeighborHit | null }`

알고리즘(`c = ortho && prev ? orthoProject(prev, cursor) : cursor`, 반올림·격자 전): ① `neighbor` false이거나 rings가 비면 `drawPoint` 결과·hit null. ② 링 꼭짓점 중 `c`에서 15cm 이내 가장 가까운 v → 직각 꺼짐/첫 점이면 `point = v`, 직각 켜짐이면 고정 축은 `prev` 값, 자유 축만 `v` 값. ③ 없으면 링 변 중 15cm 이내 가장 가까운 e → 직각 꺼짐/첫 점이면 `drawPoint` 결과를 e에 투영(선분 범위 clamp), 직각 켜짐이면 직각선과 e의 교점(e가 평행하거나 교점이 선분 밖이거나 `c`에서 15cm 밖이면 스냅 안 함). ④ 아무것도 안 잡히면 `drawPoint` 결과·hit null.

- [ ] **Step 1: 실패하는 테스트를 쓴다.** 고스트 `[[0,0],[300,0],[300,200],[0,200]]`, 링 `[[-10,-10],[310,-10],[310,210],[-10,210]]`, step 10:
  - prev null, cursor (305,-3) → vertex (310,-10)
  - prev null, cursor (322,104) → edge (310,100)
  - prev null, cursor (330,100) → hit null, (330,100)
  - ortho, prev (500,100), cursor (318,104) → edge (310,100)
  - ortho, prev (500,205), cursor (320,207) → vertex 정렬 (310,205)
  - ortho, prev (400,-5), cursor (350,-8) → 평행 변 거부, (350,-5), hit null
  - `neighbor:false` → `drawPoint`와 같은 결과
  - 꼭짓점과 변이 모두 반경 안이면 꼭짓점이 이긴다; 거리가 정확히 15cm면 스냅한다(`<=`), 15.1cm면 안 한다
  - ortho에서 직각선과 변의 교점이 선분 밖이면 스냅 안 하고 `drawPoint` 결과
  - 빈 `rings`·길이 0인 링 변은 0 나눗셈 없이 건너뛴다; 방이 여러 개이면 `hit.room`이 해당 인덱스
- [ ] **Step 2: 실패 확인.** `npx vitest run src/trace/neighborSnap.test.ts` → FAIL.
- [ ] **Step 3: 구현한다.** 위 알고리즘 그대로.
- [ ] **Step 4: 통과 확인.** 같은 명령 → PASS.
- [ ] **Step 5: 커밋.** `git add src/trace/neighborSnap.ts src/trace/neighborSnap.test.ts && git commit -m "feat: 이웃 방 꼭짓점·변 스냅 순수 로직 추가"`

---

### Task 3: 트레이싱 세션 상태·offset·그림 영역

**Files:**
- Modify: `src/store/useTraceStore.ts`
- Create: `src/store/traceSession.ts` (순수: `ghostRooms`, `blankArea`, `clampArea`)
- Modify: `src/store/rooms.ts` (`docShiftDelta`)
- Test: `src/store/traceSession.test.ts` (신규), 기존 `src/store/traceDraw.test.ts` 전부 통과

**Interfaces:**
- Produces(`useTraceStore`): `mode: 'replace' | 'add'`, `offset: Point2 | null`(replace 첫 확정 전에는 null), `confirmed: number`, `lastHeight: number`(초기 `TRACE_DEFAULT_HEIGHT`), `neighborSnap: boolean`(기본 true), `free: boolean`(Shift 누른 채 움직이는 중)
  - `start(mode: 'replace' | 'add' = 'replace')`: 빈 캔버스. `offset = mode === 'add' ? [0,0] : null`, `confirmed = 0`.
  - `setImage`는 `mode`·`offset`·`confirmed`·`ortho`·`neighborSnap`·`lastHeight`를 유지한 채 리셋한다. 단 **add + 이미지**로 전환하면 `offset = null`(이미지 원점과 문서 원점이 무관하므로 Task 4의 배치 규칙으로 정한다).
  - `setNeighborSnap(on: boolean)`, `setCursor(x, z, free = false)`
  - **잠금:** `confirmed > 0`이면 `setImage`·`loadImageFile`·`setBaselinePoint`·`redoBaseline`·`start`는 상태를 바꾸지 않는다(false/no-op).
- Produces(`src/store/traceSession.ts`):
  - `export function ghostRooms(s: { offset: Point2 | null }, rooms: readonly Room[]): Point2[][]` — `doc − offset`. offset이 null이면 `[]`.
  - `export function blankArea(ghosts: Point2[][]): Bounds` — 고스트 없음: `{minX:0, minZ:0, maxX:3000, maxZ:3000}`; 있으면 고스트 바운딩 박스를 3000씩 넓히고 10 배수로 바깥 반올림. (`Bounds`는 `src/scene/geometry.ts` 재사용)
  - `export function clampArea(p: Point2, a: Bounds): Point2`
  - 기존 `clampBlank`·`BLANK_EXTENT` 직접 사용을 `blankArea`/`clampArea`로 바꾼다(`BLANK_EXTENT`는 기본 영역 상수로 유지). 이에 영향받는 `addTracePointByLength`는 같은 `blankArea` 기준으로 영역 밖을 검사한다(문구 `그림 영역을 벗어납니다…` 유지). 길이 입력에는 이웃 스냅을 적용하지 않는다.
  - **`previewPoint` 호환:** 시그니처는 `Pick<TraceState, 'image'|'corners'|'scale'|'cursor'|'ortho'|'closed'>`에 선택 필드 `offset?: Point2 | null`·`neighborSnap?: boolean`·`free?: boolean`만 **옵션으로** 더한다(고스트는 함수 안에서 `useDocStore.getState().rooms`를 읽는다 — 이미 `useUiStore.getState().snapEnabled`를 읽는 것과 같은 방식). 그래서 `TraceCanvas.tsx`의 기존 호출 리터럴이 그대로 컴파일된다.
  - **잠금과 objectURL:** `loadImageFile`은 진입부에서 `confirmed > 0`이면 `URL.createObjectURL` 전에 false를 돌려준다(URL 누수 방지). `setImage` 등은 위 잠금대로 무시.
- Produces(`src/store/rooms.ts`): `export function docShiftDelta(before: readonly Room[], after: readonly Room[]): Point2` — 확정 전후 `rooms[0].points[0]` 차이(기존 방은 이동량만큼만 바뀐다).

- [ ] **Step 1: 실패하는 테스트를 쓴다** (`traceSession.test.ts`).
  - `start()` → mode replace, offset null; `blankArea([])` = `{0,0,3000,3000}`; 기존 `traceDraw.test.ts` 전부 통과
  - `start('add')` + 문서 r1 `0..300×0..200` → offset [0,0]; `addTracePoint(-500,50)`이 영역 안(`corners[0]`이 평면 [-500,50]); `blankArea(ghostRooms)` = `{minX:-3000,minZ:-3000,maxX:3300,maxZ:3200}`
  - `setImage` 후 mode·confirmed 유지; add + 이미지 → offset null; `confirmed > 0`이면 `setImage`·`redoBaseline`·`start`·`setBaselinePoint` 무시
  - `docShiftDelta`: 확정으로 문서가 +210 이동하면 `[210, 0]`, 이동 없으면 `[0,0]`
- [ ] **Step 2: 실패 확인.** `npx vitest run src/store/traceSession.test.ts src/store/traceDraw.test.ts` → FAIL.
- [ ] **Step 3: 구현한다.** 새 필드 때문에 `initial`/`blankState`를 갱신하고 `cancel`은 기존대로 모든 세션 필드를 초기화한다.
- [ ] **Step 4: 통과 확인.** 같은 명령 + `npm run build` → PASS.
- [ ] **Step 5: 커밋.** `git add src && git commit -m "feat: 트레이싱 세션에 모드·offset·그림 영역 추가"`

---

### Task 4: 방 확정 경로 (replace·add, 세션 유지)

**Files:**
- Modify: `src/store/useTraceStore.ts` (`closeTrace`, `commitTrace`)
- Test: `src/store/traceSession.test.ts`

**Interfaces:**
- Consumes: Task 1 `toDocPoints`/`closePolygon(…, frame)`·`placeRightOf`(`src/store/rooms.ts` — `ui/`를 import하지 않는다), Task 3 세션 필드, `addRoom`·`createPolygonRoom`·`setActiveRoomId`, `docShiftDelta`
- Produces:
  - `closeTrace`: `offset !== null`이면 `frame = { offset, others: doc.rooms.map((r) => r.points) }`를 `closePolygon`에 넘기고 실패 시 `error.message`와 `error.overlapWith: number[]`를 설정한다. **`error.overlapWith`는 `closePolygon`이 돌려준 `overlaps`와 같은 인덱스 배열이다(같은 개념의 다른 이름이 아니라 이 대입 한 줄).** `offset === null`(replace 첫 방, add+이미지 첫 방)이면 frame 없음. 닫힌 상태 편집(`insertTracePoint`·`deleteTracePoint`→`reclose`)은 이 한 곳 수정으로 같은 검사를 받는다.
  - `commitTrace(height?: number, keepItems?: boolean, next = false): boolean`:
    - **replace && confirmed === 0:** `createPolygonRoom(pendingRoom, height, keepItems)`(현행). 성공하면 `offset = [-minX, -minZ]`(`cornersCm`의 최솟값, 반올림 전), `mode = 'add'`.
    - **add + offset 있음:** `before = rooms`; `addRoom({ height, points: pendingRoom })`; 성공하면 `setActiveRoomId(id)`, `offset = offset + docShiftDelta(before, 새 rooms)`.
    - **add + offset null(이미지 첫 방):** `closePolygon`은 `toRoomPoints`로 정규화한 방을 돌려주고(`minX`·`minZ`는 반환값에 없으므로 `cornersCm(s)`의 최솟값에서 직접 구한다) `offset0 = [-minX, -minZ]`; `placed = placeRightOf(getActiveRoom(), pendingRoom)`; 번역량 `t = placed[0] − pendingRoom[0]`; `addRoom({height, points: placed})`; 성공하면 `offset = offset0 + t + docShiftDelta(before, 새 rooms)`.
    - 공통 성공: `confirmed += 1`, `lastHeight = height`. `next = false`이면 `cancel()`(현행의 1클릭 종료), `next = true`이면 `corners·closed·pendingRoom·error·selected·candidate·lengthError`만 비우고 이미지·축척·기준선·ortho는 유지한다.
    - 실패(`addRoom`이 null): `notice('⚠ 방을 추가하지 못했습니다. 방 개수(20)·다른 방과의 겹침·집 전체 크기(10000cm)를 확인하세요')`, false, 세션 유지(`confirmed`·offset 불변).
    - `cancel`(Esc 포함)은 진행 중 점·이미지만 폐기하고 **이미 확정한 방은 문서에 남는다**.

- [ ] **Step 1: 실패하는 테스트를 쓴다.**
  - replace 빈 캔버스: `[[100,100],[400,100],[400,300],[100,300]]`을 닫고 `commitTrace(240,true,true)` → rooms 1개 `[[0,0],[300,0],[300,200],[0,200]]`, offset `[-100,-100]`, mode add, active true, corners `[]`. 이어 `[[410,100],[610,100],[610,300],[410,300]]` 닫고 `commitTrace(240,true,false)` → `rooms[1]` = `[[310,0],[510,0],[510,200],[310,200]]`, `activeRoomId === rooms[1].id`, active false. `pastStates` +2, `undo()` 1회 → rooms 1개
  - add 음수: r1 `0..300×0..200`, `start('add')`, `[[-210,0],[-10,0],[-10,200],[-210,200]]` 확정(next) → r1 x `210..510`, 새 방 `0..200`, 가구 x +210, offset `[210,0]`, `ghostRooms`의 r1 = `0..300`(불변). 다음 `[[310,0],[510,0],[510,200],[310,200]]` → 문서 `[[520,0],[720,0],[720,200],[520,200]]`. Undo 1회 → 마지막 방만 되돌아가고 직전 방·가구 좌표는 확정 상태 그대로
  - add + 이미지 첫 방: 활성 방 r1 `0..300×0..200`, 평면에서 `[[50,50],[250,50],[250,150],[50,150]]`을 닫고 확정 → 새 방 = `[[310,0],[510,0],[510,100],[310,100]]`(`placeRightOf`), offset은 이후 두 번째 방을 평면 `[[260,50],[460,50],[460,150],[260,150]]`에 닫았을 때 문서에서 첫 방 오른쪽 10cm 간격(`[[520,0]…]` 계열)으로 정확히 이어지는 값
  - 겹치게 닫기 → `error.message === OVERLAP_MESSAGE`, `error.overlapWith`에 해당 인덱스, closed false; 닫힌 뒤 `insertTracePoint`로 겹침 생성 → false·점 복원
  - 1개 확정 후 점 2개 찍고 `cancel()` → rooms 2개 유지, 이미지 해제
  - 문서에 방 20개 + add 확정 → false + notice, `confirmed` 불변
  - `commitTrace(…)` 성공 뒤 `parseDocument(serializeDocument(...))` ok
  - 시계 방향으로 그린 add+이미지 첫 방에서도 `t = placed[0] − pendingRoom[0]` 계산이 맞아 다음 방이 10cm 간격으로 이어진다
  - `placeRightOf` 결과가 다른 방과 겹쳐 `addRoom`이 거부되면 세션·`confirmed`·offset이 그대로이고 notice가 뜬다
  - `next=true` 뒤에도 이미지·축척·기준선·offset·ortho가 유지된다
  - `confirmed > 0`에서 `loadImageFile`은 `URL.createObjectURL`을 만들지 않고 false
  - 스냅을 끈 상태의 소수 평면 좌표(offset이 소수)에서도 확정한 방끼리 간격이 정확히 이어진다(1cm 반올림 오차 누적 없음)
- [ ] **Step 2: 실패 확인.** `npx vitest run src/store/traceSession.test.ts` → FAIL.
- [ ] **Step 3: 구현한다.**
- [ ] **Step 4: 통과 확인.** `npm test` → 전체 PASS, `npm run build`·`npm run lint` → 통과.
- [ ] **Step 5: 커밋.** `git add src && git commit -m "feat: 트레이싱 방 확정을 다중 방 모드로 확장"`

---

### Task 5: 이웃 스냅 연결 (`placePoint`)

**Files:**
- Modify: `src/store/useTraceStore.ts` (`placePoint`, `addTracePoint`, `moveTracePoint`, `previewPoint`)
- Modify: `src/scene/TraceCanvas.tsx` (`Preview`가 새 `previewPoint` 반환형을 쓰도록 최소 수정: `length`가 null이면 길이 라벨 생략, `useMemo` 의존성에 `offset`·`neighborSnap`·`free`·문서 `rooms` 추가 — 이 커밋에서 빌드가 깨지지 않게 한다. 나머지 캔버스 변경은 Task 7)
- Test: `src/store/traceSession.test.ts`

**Interfaces:**
- Consumes: Task 2 `placeDrawPoint`·`snapRings`, Task 3 `ghostRooms`·`blankArea`·`clampArea`
- Produces:
  - 내부 `placePoint(s, x, z, free: boolean): { point: Point2; hit: NeighborHit | null }` — `ghostRooms` → `snapRings` → `placeDrawPoint({ neighbor: s.neighborSnap && !free })` → (빈 캔버스면) `clampArea`. `addTracePoint(x, z, free = false)`·`previewPoint`·`moveTracePoint(i, x, z, free = false)`가 **이것만** 쓴다.
  - `previewPoint(s)` 반환을 `{ point: Point2; length: number | null; hit: NeighborHit | null }`로 바꾼다. **첫 점(corners 0개)에서도 `cursor`가 있으면 반환**하고 이때 `length`는 null — 이웃 스냅이 가장 필요한 첫 점에서 마커·미리보기가 보여야 한다. 닫혔거나 `scale`·`cursor`가 없으면 null(현행).
  - `moveTracePoint`는 `placePoint`에 `prev = null`을 넘긴다(직각 보정 없이 이웃·격자 스냅만, 현행에도 직각 보정이 없다).
  - 수정키 전달 위치: `PlaneHandlers`의 콜백은 **마지막 인자**로 `mods: { shift: boolean }`를 받는다 — `hover(p, mods)`, `click(p, mods)`, `drag(p, first, mods)`. 이 시그니처 확장은 Task 7이 구현하고, 이 작업의 스토어 API는 `free` 불리언만 받는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다.** add, 고스트 r1 `0..300×0..200` 위에서:
  - 첫 점 `addTracePoint(322,104)` → 평면 `(310,100)`; `addTracePoint(322,104,true)`(free) → `(320,100)`; `setNeighborSnap(false)` 후 동일
  - `previewPoint`의 `hit.kind === 'edge'`; 스냅이 잡혀도 미리보기 점과 `addTracePoint`로 찍힌 점이 같다 — **첫 점(corners 0개)과 이후 점 모두**, 첫 점의 `length`는 null
  - `moveTracePoint`는 직각 보정 없이 이웃·격자 스냅만 적용한다
  - replace 첫 방(고스트 없음)은 기존 결과와 같다(기존 `traceDraw.test.ts` 회귀)
  - add 빈 캔버스에서 영역 밖 좌표는 `blankArea` 안으로 clamp
- [ ] **Step 2: 실패 확인.** `npx vitest run src/store/traceSession.test.ts src/store/traceDraw.test.ts` → FAIL.
- [ ] **Step 3: 구현한다.** 기존 `drawPoint`+`clampBlank` 이중 호출을 `placePoint` 한 곳으로 통합한다.
- [ ] **Step 4: 통과 확인.** 같은 명령 + `npm test` → PASS.
- [ ] **Step 5: 커밋.** `git add src && git commit -m "feat: 트레이싱 점 확정에 이웃 방 스냅 연결"`

---

### Task 6: 방 추가 진입점과 트레이싱 화면 흐름 (UI)

**Files:**
- Modify: `src/ui/RoomDialog.tsx`, `src/ui/TraceScreen.tsx`, `src/ui/roomForm.ts`(필요 시)
- Test: `src/ui/roomList.test.ts`(add 모드 보강), `src/ui/traceScreen.test.ts`(신규, `renderToStaticMarkup` 패턴), `src/ui/uiFlows.test.ts`

**Interfaces:**
- Consumes: Task 3~4 세션 필드·`commitTrace(h, keep, next)`
- Produces:
  - `RoomDialog mode="add"`: "다중 방 그리기는 다음 단계에서 지원합니다" 문구를 지우고, replace와 같은 "그려서 만들기(평면도 배경 선택 가능)" 버튼을 둔다 — add에서는 `start('add')`. 버튼 블록은 모드와 무관하게 공통.
  - `TraceScreen`의 `Confirm`:
    - 천장고 입력 기본값 `lastHeight`(검증은 현행 180~400 정수)
    - "기존 가구 유지/삭제" 라디오는 `mode === 'replace' && confirmed === 0 && 가구 있음`일 때만
    - 버튼: **[방 생성]**(`commitTrace(h, keep, false)`, 현행 문구·동작 유지)와 **[방 생성 후 다음 방 따기]**(`commitTrace(h, keep, true)`). 둘 다 `disabled={bad}`이고, 방이 `ROOMS_MAX`이면 `addRoomBlockedReason(rooms)` 문구와 함께 비활성(replace 첫 방은 제외)
    - 겹침 오류는 `role="alert"`로 `error.message`를 그대로 표시
  - 하단 취소 버튼: `confirmed === 0`이면 "취소", 이상이면 "끝내기"(동작은 `cancel()`). **`confirmed >= 1`이고 진행 중 점이 3개 이상일 때만** `ConfirmDialog`("진행 중인 방은 버려집니다") 후 끝낸다. `confirmed === 0`(방 1개 사용자 흐름)의 취소·Esc는 현행대로 확인 없이 즉시 `cancel()`. Esc도 같은 경로.
  - `confirmed >= 1`이면 단계 목록 옆에 `<span aria-live="polite">방 {N}개 확정</span>`, 안내 문구를 "방 N개 확정. 다음 방의 모서리를 찍거나 [끝내기]를 누르세요."로 바꾼다. 첫 방 확정 뒤에는 업로드·기준선·"배경 없이 그리기" 버튼을 숨긴다.
  - 고스트가 있을 때만 `DrawTools`에 체크박스 "이웃 방에 붙이기"(`setNeighborSnap`)와 힌트 "Shift를 누르고 있으면 이웃 방 스냅이 꺼집니다".

- [ ] **Step 1: 실패하는 테스트를 쓴다.**
  - add 모드에 "그려서 만들기"가 있고 "다음 단계에서" 문구가 없다; replace 모드는 불변
  - add 대화상자에서 시작하면 `useTraceStore.mode === 'add'`, `active === true`
  - `confirmed` 0/1에서 취소/끝내기 라벨, "방 N개 확정" 표시, `lastHeight`가 천장고 기본값, 가구 유지 라디오는 replace 첫 방에만
  - 방 1개 replace 흐름은 기존 버튼이 모두 그대로이고 **[방 생성 후 다음 방 따기] 1개만 추가**된다
  - 트레이싱이 활성인 동안 Ctrl+Z·Ctrl+Y(`useEditorKeys`)가 문서 Undo/Redo에 닿지 않는다 — 닿으면 확정한 방이 되돌아가 offset이 어긋나므로, 닿는 경로가 있으면 `trace.active`일 때 무시하는 가드를 추가하고 테스트한다
  - 방 20개 문서에서 add 확정 버튼 비활성 + 사유 문구; 체크박스는 고스트가 없으면 렌더되지 않는다
- [ ] **Step 2: 실패 확인.** `npx vitest run src/ui` → FAIL.
- [ ] **Step 3: 구현한다.** `TraceScreen.tsx`가 800줄을 넘지 않게 `Confirm`·`DrawTools`가 커지면 같은 폴더의 작은 파일로 분리한다.
- [ ] **Step 4: 통과 확인.** `npx vitest run src/ui` + `npm run build` → PASS.
- [ ] **Step 5: 커밋.** `git add src && git commit -m "feat: 방 추가에서 평면도 트레이싱을 이어서 따는 흐름 추가"`

---

### Task 7: 트레이싱 캔버스 (고스트·스냅 마커·그림 영역·카메라)

**Files:**
- Modify: `src/scene/TraceCanvas.tsx`, `src/scene/planeInput.tsx`
- Create: `src/scene/traceView.ts` (순수)
- Test: `src/scene/traceView.test.ts`

**Interfaces:**
- Consumes: Task 3 `ghostRooms`·`blankArea`, Task 5 `previewPoint().hit`, Task 4 `error.overlapWith`
- Produces:
  - `export function traceBounds(base: Bounds, ghosts: Point2[][]): Bounds` — 이미지(또는 빈 캔버스) 사각형 ∪ 고스트 합집합(`src/scene/traceView.ts`).
  - `PlaneHandlers`의 콜백에 **마지막 인자**로 수정키 `mods: { shift: boolean }`를 추가한다(포인터 이벤트의 `shiftKey`): `hover(p, mods)`, `click(p, mods)`, `drag(p, first, mods)`(`planeInput.tsx`의 기존 호출부·다른 핸들러 사용처를 모두 갱신). `TraceCanvas`는 이를 `setCursor(x,z,shift)`·`addTracePoint(x,z,shift)`·`moveTracePoint(i,x,z,shift)`에 넘긴다(**클릭 시점의 Shift도 반드시 `addTracePoint`에 전달** — `previewPoint`는 스토어의 `s.free`, `addTracePoint`는 인자 `free`를 쓰므로 하나라도 빠지면 미리보기와 찍힌 점이 어긋난다. 이 연결을 잡는 테스트를 추가한다). 전역 키 리스너는 쓰지 않는다. 터치는 체크박스를 쓴다.
  - `export function cameraKey(image: {url:string;width:number;height:number} | null, mode: 'replace'|'add', hasOffset: boolean): string` — 방 개수에 의존하지 않는 카메라 재맞춤 키(`traceView.ts`).
  - 렌더: 고스트 방은 옅은 윤곽 `Polyline closed`(색 `#90a4ae`, 얇게, 채움·라벨 없음), `error.overlapWith`에 든 방은 붉게 굵게. 이웃 스냅 마커는 `hit.kind==='vertex'`면 분홍 점, `'edge'`면 이웃 변 점선 + 투영점. `Preview` 끝점도 `hit.point`로 그린다. 첫 점 닫기 클릭·점 선택 히트테스트는 원시 점으로 하므로 스냅이 닫기를 방해하지 않는다.
  - 빈 캔버스 바탕·격자·테두리는 `blankArea(ghosts)`를 쓴다(`BlankArea`가 `Bounds`를 받게 일반화하고, 격자 시작점을 영역 min에 맞춘다).
  - `CameraRig`의 `bounds` = `traceBounds(이미지 또는 빈 캔버스 영역, 고스트)`. `key`는 `image.url:폭:깊이:mode:offset 유무`로 하고 **방 개수는 넣지 않는다**(확정할 때마다 카메라가 튀지 않게).

- [ ] **Step 1: 실패하는 테스트를 쓴다** (`traceView.test.ts`).
  - `traceBounds`: 이미지만 / 방이 이미지 안 / 방이 이미지 밖(합집합 확장); 고스트 없음이면 `base` 그대로
  - `cameraKey`: 같은 이미지·mode·offset 유무면 방이 늘어도 같은 키; `offset` null→값으로 바뀌면 키가 바뀐다
  - `error.overlapWith` 인덱스가 `ghostRooms` 배열 인덱스와 1:1이다(`closeTrace`의 `others = doc.rooms` 순서와 같은 순서)
  - `blankArea`가 만든 영역 min에 격자 시작점이 맞는다(격자 셀 수·시작 좌표를 계산하는 순수 헬퍼가 있으면 그것을 단언)
- [ ] **Step 2: 실패 확인.** `npx vitest run src/scene/traceView.test.ts` → FAIL.
- [ ] **Step 3: 구현한다.** 렌더링은 단위 테스트가 어려우므로 Task 8의 브라우저 점검 항목으로 고정한다.
- [ ] **Step 4: 통과 확인.** `npx vitest run src/scene/traceView.test.ts` + `npm test` + `npm run build` + `npm run lint` → PASS.
- [ ] **Step 5: 커밋.** `git add src && git commit -m "feat: 트레이싱 캔버스에 기존 방 윤곽과 이웃 스냅 표시 추가"`

---

### Task 8: 문서 동기화 (스펙 §7-5)

**Files:**
- Modify: `docs/PRD.md`, `docs/wireframes.md`, `.claude/skills/roomfit-conventions/SKILL.md`, `docs/browser-checklist.md`, `docs/superpowers/specs/2026-11-19-multi-room-design.md`

- [ ] **Step 1: PRD.** FR-04 끝(AC-04-12 뒤)에 추가하고, 위치는 `grep`으로 확인한다.
  - AC-04-13: 방 추가 대화상자의 [그려서 추가하기]는 기존 방·가구를 보존한 채 S-04를 연다. 이미 있는 방은 옅은 윤곽으로 보인다.
  - AC-04-14: [방 생성 후 다음 방 따기]는 방을 확정(Undo 1단계)하고 같은 이미지·축척으로 새 다각형을 시작한다. 확정한 방끼리 이미지상 상대 위치가 유지된다. [방 생성]은 확정 후 화면을 닫는다.
  - AC-04-15: 그리는 점이 이웃 방 바깥 10cm 선의 꼭짓점·변에서 15cm 이내면 달라붙는다(꼭짓점 우선). 체크박스나 Shift로 해제한다.
  - AC-04-16: 다른 방과 내부가 겹치거나 집 전체가 10000cm를 넘는 다각형은 닫을 수 없고 오류 문구를 보여 준다. 닫은 뒤 점 추가·삭제에도 같다.
  - AC-04-7: "그림 영역 3000cm 정사각형" 뒤에 "방 추가 세션은 기존 방 경계에서 3000cm씩 넓힌 영역"을 붙인다. §9 기본값 표에 스냅 반경 15cm·이웃 간격 10cm를 추가한다.
- [ ] **Step 2: 와이어프레임.** S-03 add 모드의 [그려서 추가하기]·안내 문구 삭제, S-04의 [방 생성 후 다음 방 따기]·확정 후 [취소]→[끝내기]·옅은 윤곽·스냅 마커·"이웃 방에 붙이기" 체크박스를 반영한다.
- [ ] **Step 3: 규약·스펙.** conventions의 `## 다중 방`에 offset 불변식(`doc = round(plane + offset)`, 첫 방만 원점 정규화), 스냅 반경·간격·해제 키를 추가한다. 스펙 §5.5에는 "이웃 간격=10cm(2단계 벽 띠 모델 기준)"과 "홈/돌출은 기존 방을 제자리에서 바꾸는 경로가 없어 이번 범위에서 해당 없음"을 한 줄씩 남긴다.
- [ ] **Step 4: 브라우저 점검표** `## 12. 다중 방 트레이싱·그리기 (스펙 §5.5)`:
  - 같은 평면도에서 방 2개를 따면 3D에서 10cm 벽 하나로 맞닿는다
  - 빈 캔버스로 기존 방 왼쪽에 그려 문서가 이동해도 화면이 튀지 않고 다음 방이 맞게 붙는다
  - 이웃 꼭짓점·변 근처에서 스냅 마커가 보이고 Shift를 누르면 해제된다, 체크박스 해제도 동작한다
  - 겹치게 닫으면 오류 문구와 겹친 방의 붉은 윤곽이 보이고, 변이 닿기만 하면 통과한다
  - [방 생성 후 다음 방 따기] 뒤 카메라가 튀지 않고 "방 N개 확정"이 보이며, [끝내기] 뒤 메인 에디터 2D 줌이 모든 방을 담고 활성 방이 마지막 방이다
  - 1방 사용자의 [그려서 만들기]→[방 생성] 흐름이 이전과 같다
  - 방 추가 + 이미지 첫 방이 활성 방 오른쪽 10cm에 붙고 이후 윤곽·스냅이 나타난다
- [ ] **Step 5: 검증·커밋.** `npm test`·`npm run build`·`npm run lint` → 통과. `git add docs .claude/skills/roomfit-conventions && git commit -m "docs: 다중 방 트레이싱 규약과 PRD·와이어프레임 갱신"`

---

## 자체 점검

- **스펙 범위(§5.5·§7-4·5):** 세션 이미지 유지·다음 방 따기(Task 3·4·6), 좌표 연속성 offset(Task 1·3·4), 진입점 구분(Task 6), 확정 방 옅은 윤곽(Task 7), 이웃 스냅·해제(Task 2·5·6·7), 확정 전 겹침 검증(Task 1·4), 모서리 편집 겹침 검증(2단계 `commitPoints`에서 완료, 문구만 Task 1에서 통일), 홈/돌출(코드 불필요, 판정 기록), 문서 동기화(Task 8).
- **타입 일관성:** `toDocPoints`, `DocFrame`, `OVERLAP_MESSAGE`, `NeighborHit`, `placeDrawPoint`, `snapRings`, `ghostRooms`, `blankArea`, `clampArea`, `docShiftDelta`, `placePoint`, `traceBounds`는 정의한 작업에서만 쓰이고 순서(1→8)대로 의존한다.
- **알려진 한계:**
  1. 이웃 방 스냅 링은 방 전체의 바깥 오프셋이라 오목 코너에서는 링 변이 안쪽으로 접힐 수 있다 — `offsetOutward`의 기존 동작이며 ㄱ자 방에서 브라우저로 확인한다.
  2. 방 추가 + 이미지 첫 방의 `placeRightOf`는 활성 방만 기준이라, 활성 방 오른쪽에 이미 방이 있으면 `addRoom`이 겹침으로 거부하고 안내한다(2단계 `submitAddRoomForm`과 같은 한계).
  3. 방 추가 + 이미지는 이전 세션에서 딴 방과 이미지가 자동으로 정렬되지 않는다(이미지 이동 정렬 도구는 범위 밖).
  4. 트레이싱 렌더(고스트·마커·카메라)는 브라우저 점검표로 확인한다.
- **비율:** 계획이 스펙 §5.5보다 길지만 좌표 변환·확정 경로 같은 결정 사항과 테스트 수치를 담고 있어 구현 본문은 서명·알고리즘 요약만 둔다.

## 실행 순서

Task 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 (직렬). Task 1·2는 서로 독립이라 순서를 바꿔도 되지만 구현자를 병렬로 돌리지 않는다. Task 1~5와 8은 app-engineer, Task 7은 scene-engineer, Task 6은 app-engineer(`src/ui`)가 맡고, 각 작업 뒤에 qa-reviewer로 검증한다.
