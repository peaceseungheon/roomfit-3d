# 다중 방 1단계(모델·스키마) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 문서가 방 여러 개(`rooms`)를 담을 수 있게 모델·검증·저장·스토어를 바꾸되, 화면 동작은 방 1개일 때 지금과 완전히 같게 둔다.

**Architecture:** `DocData`를 `{ rooms: Room[]; items: Item[] }`로 바꾼다. 저장 JSON은 `1.1`(`rooms`)로 쓰고 `1.0`(`room`)·`1.1` 둘 다 읽는다. 이번 단계에서 모든 소비 코드는 `selectRoom`(= `rooms[0]`)을 통해 방 하나만 본다. 활성 방 선택·다중 방 판정·렌더는 2~3단계 몫이다.

**Tech Stack:** TypeScript, React, Zustand + zundo, Vitest(`npm test`), Vite(`npm run build`), ESLint(`npm run lint`).

**Spec:** `docs/superpowers/specs/2026-11-19-multi-room-design.md` (이 계획은 §5.1, §5.2의 검증 규칙, §7의 1단계)

## Global Constraints

- 단위 1unit=1cm, 좌표 [x, z]. 불변 갱신(스프레드), 파일 800줄 이하.
- 방 하나의 가로·세로 상한 `ROOM_MAX`=3000, 꼭짓점 3~`POINTS_MAX`(100)개는 방마다 그대로 적용한다.
- 저장 `version`은 쓰기 `"1.1"`, 읽기 `"1.0"`과 `"1.1"`. `1.0`은 `{ id: 'r1', name: '방 1', ...room }`으로 감싼다.
- 방 개수 1~20, 방 id 중복 불가, 방 이름 1~`NAME_MAX`(100)자.
- 문서 전체 바운딩 박스 가로·세로 상한 10000cm.
- 방 내부 면적이 겹치면 거부(경로 `rooms[i]`). 변이 맞닿거나 한 점이 닿는 것, 간격 0은 허용.
- 아이템 `elevation` 검증은 방 천장고 중 **가장 낮은 값**을 기준으로 한다.
- Undo 대상은 `{rooms, items}`.
- 커밋 메시지는 `<type>: <설명>` 형식(한국어 가능). 빌드가 깨진 채로 커밋하지 않는다.

## Review Focus

- `1.0` 파일(방 1개 + 가구)을 불러오면 가구는 한 글자도 바뀌지 않고 방 id `r1`로 열린다. → Task 2 `validate.test.ts`
- `rooms`가 비었거나 21개이면 경로 `rooms`로 거부, 방 id 중복·이름 빈 문자열/101자는 `rooms[i].id`·`rooms[i].name`으로 거부. → Task 2
- 완전히 같은 두 방, 한 방이 다른 방 안에 든 경우는 거부하고, 변을 맞댄 두 방(간격 0)은 통과. → Task 1·2
- 예전 버전으로 localStorage에 저장된 `1.0` 문자열이 복원되고, 다음 자동 저장은 `1.1`로 나간다. → Task 3
- `loadDocument` 뒤 Undo가 이전 `rooms`로 돌아간다(참조 비교 `partialize`·`equality` 갱신 누락 방지). → Task 2 `store.test.ts`

---

### Task 1: 방 내부 겹침 판정

**Files:**
- Create: `src/io/roomOverlap.ts`
- Test: `src/io/roomOverlap.test.ts`

**Interfaces:**
- Consumes: `Point2`(`src/store/types.ts`), `segmentsTouch`·`findIntersections`(`src/trace/trace.ts`)는 필요하면 재사용
- Produces: `export function roomsOverlap(a: Point2[], b: Point2[]): boolean` — 두 단순 다각형의 **내부 면적**이 겹치면 true. 변·꼭짓점 접촉만이면 false. 오목 다각형(ㄱ자) 지원.

- [ ] **Step 1: 실패하는 테스트를 쓴다.** 케이스와 기대값:
  - 변을 맞댄 사각형 `[0,0,100,100]`·`[100,0,200,100]` → `false`
  - 꼭짓점 한 점만 닿는 사각형 → `false`
  - 간격 20cm 떨어진 사각형 → `false`
  - 완전히 같은 두 사각형 → `true`
  - 큰 사각형 안에 든 작은 사각형(꼭짓점 모두 안쪽) → `true`
  - 십자 배치(가로 긴 사각형과 세로 긴 사각형, 어느 쪽 꼭짓점도 상대 안에 없음) → `true`
  - ㄱ자 홈 안에 정확히 들어맞는 사각형(홈과 맞닿기만) → `false`, 홈을 1cm 침범 → `true`
  - 인자 순서를 바꿔도 결과가 같다
- [ ] **Step 2: 실행해 실패 확인.** `npx vitest run src/io/roomOverlap.test.ts` → 모듈 없음으로 FAIL.
- [ ] **Step 3: `roomsOverlap`을 구현한다.** 알고리즘은 빌더 재량. 접촉만 있는 경우와 꼭짓점이 상대 경계 위에 있는 경우(같은 사각형)를 놓치지 않도록 변 중점 등 경계 위 점은 "엄격히 안쪽" 검사로 따로 다룬다.
- [ ] **Step 4: 통과 확인.** 같은 명령 → PASS.
- [ ] **Step 5: 커밋.** `git add src/io/roomOverlap.ts src/io/roomOverlap.test.ts && git commit -m "feat: 방 내부 면적 겹침 판정 추가"`

---

### Task 2: 문서 모델을 rooms 배열로 전환 (타입·검증·스토어·소비 코드)

모델 타입 변경은 컴파일 단위로 한꺼번에 일어나므로 한 작업으로 묶는다. 끝날 때 `npm test`, `npm run build`, `npm run lint`가 모두 통과해야 한다.

**Files:**
- Modify: `src/store/types.ts`, `src/io/validate.ts`, `src/store/sample.ts`, `src/store/useDocStore.ts`
- Modify(소비 코드, `room` → `selectRoom`): `src/store/useEditStore.ts`, `src/store/useTraceStore.ts`, `src/scene/{Scene,CornerEditLayer,useSceneKeys,useWarnings}.ts*`, `src/ui/{RoomDialog,RoomPreview,roomForm,WallEditor,DimensionPanel,placement,fixturePlacement}.ts*`
- Test: `src/io/validate.test.ts`, `src/store/store.test.ts`, 그리고 기존 테스트 중 `room:`을 쓰는 9개 파일(`collision`, `traceDraw`, `trace`, `actions`, `placement`, `roomNotch`, `uiFlows` 포함)

**Interfaces:**
- Produces(`src/store/types.ts`):
  - `interface Room { id: string; name: string; height: number; points: Point2[] }`
  - `interface ProjectInfo { version: '1.1'; lastModified: string }`
  - `interface DocumentJson { projectInfo: ProjectInfo; rooms: Room[]; items: Item[] }`
  - `interface DocData { rooms: Room[]; items: Item[] }`
  - `export const DEFAULT_ROOM_ID = 'r1'`, `export const defaultRoomName = (n: number): string` (`n`번째 방 → `'방 n'`)
- Produces(`src/io/validate.ts`): `ROOMS_MAX = 20`, `PLAN_EXTENT_MAX = 10000`. `validateDocument`·`parseDocument`는 `Result<DocumentJson>`을 그대로 돌려주되, 입력이 `1.0`이면 `rooms: [{ id: 'r1', name: '방 1', ...room }]`로 정규화한 값을 돌려준다. 기존 `validateRoom(room)`(높이·점 검사)은 `{id,name}` 없이도 쓰이므로 입력 타입을 `Pick<Room, 'height' | 'points'>`로 느슨히 둔다.
- Produces(`src/store/useDocStore.ts`): `export const selectRoom = (s: DocData): Room => s.rooms[0]` — "3단계에서 활성 방으로 교체" 주석. `setRoom`·`createRectRoom`·`createLRoom`·`createPolygonRoom` 시그니처는 **그대로**, 동작은 `rooms[0]`의 `height`·`points`를 바꾸고 `id`·`name`은 유지한다. `loadDocument(doc: DocData)`는 `rooms`를 받는다.

- [ ] **Step 1: 검증 실패 테스트를 쓴다** (`validate.test.ts`에 추가). 기대값:
  - `1.0` 문서(방 1개+가구) → ok, `value.rooms`는 길이 1, `rooms[0].id==='r1'`, `name==='방 1'`, `items`는 입력과 deep equal
  - `1.1` 문서 방 2개(변 맞댐) → ok
  - `rooms: []` → 오류 path `rooms`; 방 21개 → path `rooms`
  - id 중복 → path `rooms[1].id`; 이름 `''` 또는 101자 → path `rooms[i].name`
  - 완전히 같은 두 방, 포함 관계 두 방 → path `rooms[1]` 오류
  - 두 방의 합친 가로가 10000 초과 → path `rooms` 오류
  - 가구 `elevation`이 낮은 쪽 방 천장고보다 크면 오류
  - `1.1`에서 `room` 키는 무시, `1.0`에서 `room`이 없으면 path `room` 오류, 모르는 version은 path `projectInfo.version` 오류
- [ ] **Step 2: 실패 확인.** `npx vitest run src/io/validate.test.ts` → FAIL.
- [ ] **Step 3: `types.ts`·`validate.ts`를 구현한다.** `checkRoom`은 방마다 `rooms[i]` 경로 접두로 재사용하고, 겹침은 Task 1의 `roomsOverlap`, 바운딩 박스는 전체 점의 최대−최소로 계산한다. 첫 오류만이 아니라 기존처럼 오류 목록을 모은다.
- [ ] **Step 4: 검증 테스트 통과 확인.** 같은 명령 → PASS.
- [ ] **Step 5: 스토어 실패 테스트를 쓴다** (`store.test.ts`에 추가). 기대값:
  - 초기 상태 `rooms.length===1`, `rooms[0].id==='r1'`
  - `createRectRoom(500, 400, 240)` 뒤 `rooms[0]`의 `id`·`name`은 그대로, `points`·`height`만 바뀜
  - `loadDocument({rooms:[A,B], items:[]})` 뒤 `undo()` 하면 이전 `rooms` 참조로 복귀(`toBe`)
  - `addItem`의 천장고 clamp 기준이 `rooms[0].height`
- [ ] **Step 6: 스토어·샘플을 구현한다.** `createSample()`은 `rooms: [{ id: DEFAULT_ROOM_ID, name: defaultRoomName(1), height: 230, points: <기존 400x300> }]`. `partialize`는 `{ rooms, items }`, `equality`는 `a.rooms === b.rooms && a.items === b.items`.
- [ ] **Step 7: 소비 코드를 전환한다.** 파일 목록의 `s.room`·`.room.points`·`getState().room`을 `selectRoom(...)`으로 바꾼다. `useEditStore`의 `useDocStore.setState({ room: ... })`·세션 `start.room`·`lastRoom`은 `rooms: [newRoom, ...rest]`로 바꾸고 참조 비교를 `rooms` 기준으로 유지한다(`untouched`의 `d.room === s.lastRoom` 포함). 방 편집 외 동작은 바꾸지 않는다.
- [ ] **Step 8: 기존 테스트를 `rooms` 구조로 맞춘다.** `room: {height, points}` 리터럴은 `rooms: [{ id: 'r1', name: '방 1', height, points }]`로. 단언은 바꾸지 말고 데이터 모양만 바꾼다.
- [ ] **Step 9: 전체 검증.** `npm test` → 모두 PASS(이전 321개 이상), `npm run build` → 오류 0, `npm run lint` → 종료 코드 0.
- [ ] **Step 10: 커밋.** `git add -A src && git commit -m "refactor: 문서 모델을 rooms 배열로 전환하고 1.0/1.1 검증 추가"` (이전 작업의 미커밋 변경이 섞이지 않도록 `git status`로 이 작업 파일만 stage한다)

---

### Task 3: 저장·불러오기·자동 저장 호환

**Files:**
- Modify: `src/io/persist.ts`(`serializeDocument`, `restoreSaved`), `src/io/importFile.ts`(`processImportText`의 `doc` 조립)
- Modify: `.claude/skills/roomfit-conventions/` 안의 저장 JSON 스키마 설명(현재 `version "1.0"`·`room` 기술 부분을 `1.1`·`rooms`로 갱신, 1.0 읽기 호환 한 줄 추가)
- Test: `src/io/persist.test.ts`(없으면 새로 만든다), `src/io/importFile.test.ts`(없으면 새로 만든다)

**Interfaces:**
- Consumes: Task 2의 `DocData`, `DocumentJson`, `parseDocument`
- Produces: `serializeDocument(doc: DocData, now?: Date): string`는 `projectInfo.version: '1.1'`과 `rooms`를 쓴다. `restoreSaved`·`processImportText`는 `1.0`·`1.1` 모두 `DocData`(`rooms`)로 돌려준다.

- [ ] **Step 1: 실패하는 테스트를 쓴다.** 기대값:
  - `serializeDocument(sample)` → JSON 파싱 결과 `projectInfo.version==='1.1'`, `rooms` 길이 1, `room` 키 없음
  - serialize → `parseDocument` 왕복 시 `rooms`·`items` deep equal
  - localStorage에 `1.0` 문자열을 넣고 `restoreSaved(fakeStorage)` → `true`, 스토어 `rooms[0].id==='r1'`, 가구 동일
  - 위 복원 뒤 자동 저장이 쓴 문자열의 version은 `1.1`
  - `processImportText(<1.0 텍스트>)` → `ok`, `doc.rooms` 길이 1; 깨진 `rooms`(방 id 중복) → `ok:false`, `lines`에 경로가 포함됨
- [ ] **Step 2: 실패 확인.** `npx vitest run src/io` → FAIL.
- [ ] **Step 3: 구현한다.** `serializeDocument`는 `DocumentJson` 모양(`rooms`)으로 쓰고, `restoreSaved`·`processImportText`는 `r.value.rooms`를 `loadDocument`·반환 `doc`에 넘긴다.
- [ ] **Step 4: 통과 확인.** `npm test` → 전체 PASS, `npm run build`·`npm run lint` → 통과.
- [ ] **Step 5: 브라우저 점검표에 항목 추가.** `docs/browser-checklist.md`에 "예전 1.0 파일 불러오기 → 정상 표시, 저장하면 1.1" 한 줄을 넣는다(실제 브라우저 확인은 사용자 몫으로 표시).
- [ ] **Step 6: 커밋.** `git add src/io .claude/skills/roomfit-conventions docs/browser-checklist.md && git commit -m "feat: 저장 JSON 1.1(rooms) 쓰기와 1.0 읽기 호환"`

---

## 자체 점검

- **스펙 범위:** §5.1(데이터 모델)·§5.2의 검증 규칙(겹침, 개수·박스 상한)·§7-1단계는 Task 1~3이 덮는다. §5.2의 벽 렌더·좌표 불변식 이동, §5.3~5.6, §7의 2~5단계는 의도적으로 이 계획 밖이며 단계별로 따로 계획을 쓴다.
- **타입 일관성:** `selectRoom`, `DEFAULT_ROOM_ID`, `defaultRoomName`, `ROOMS_MAX`, `PLAN_EXTENT_MAX`, `roomsOverlap`은 정의한 작업에서만 쓰인다.
- **알려진 한계:** `validate.ts` 본문은 이 계획 작성 때 요약 형태로만 읽었다. Task 2 구현자가 `checkRoom`·`validateDocument` 본문을 직접 읽고 시작해야 한다.
