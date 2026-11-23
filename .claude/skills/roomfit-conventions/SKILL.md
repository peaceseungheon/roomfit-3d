---
name: roomfit-conventions
description: RoomFit 3D의 공통 규약(단위 1unit=1cm, 좌표축, 10cm 스냅, 폴더 구조, 저장 JSON 스키마, 충돌 규칙)을 담은 참조 스킬. 3D 씬·스토어·UI·저장 코드를 작성하거나 검토하기 전에 읽는다.
---

# RoomFit 3D 공통 규약

이 규약은 `docs/기획서.md`에서 추린 것이다. 서로 다른 모듈이 같은 가정을 공유해야 경계에서 버그가 생기지 않으므로 코드보다 먼저 확인한다. `docs/PRD.md`가 기획서보다 우선하며(기획서 상단에 명시), 둘과 충돌하면 바꾸기 전에 사용자에게 먼저 알린다. 방 크기 상한 3000cm, 가구 최대 1000(W,D)/500(H)cm 등 수치는 PRD가 기준이다.

## 스택
React + Vite + TypeScript, Three.js + R3F + drei, @use-gesture/react, Zustand + Zundo. 목록 밖 라이브러리는 추가 전에 이유를 보고한다.

## 단위와 좌표
- 모든 길이는 cm이고 Three.js 1unit = 1cm이다. m 단위나 스케일 변환을 쓰지 않는다.
- 바닥은 y=0, 높이는 +y다. 방 `points`는 [x, z] 쌍이다. 가구 `position`은 [x, y, z]이며 y는 0으로 고정한다.
- `rotation`은 도(degree)로 저장하고 렌더링할 때만 라디안으로 바꾼다.
- `size`는 [가로 x, 높이 y, 깊이 z] 순서다(기획서 예시: 침대 [150, 50, 200]). 사용자 UI 입력·표시는 W × D × H 순서이므로 변환 지점은 `src/ui/` 한 곳에 둔다.

## 상호작용
- 이동·배치 좌표는 10cm 단위로 스냅한다.
- 고정 요소는 벽 시작점 기준 10cm 거리로 스냅한다.
- 충돌과 문 열림 반경 침범은 `Box3.intersectsBox`로 판정하고, 침범한 가구는 붉은색으로 하이라이트한다.
- 카메라 뷰는 2D 직교, 3D 쿼터, 1인칭 눈높이 고정(약 160cm) 세 가지다. 자유 보행은 v2.0 범위다.

## 저장 JSON (version "1.1", 읽기는 "1.0"도 지원)
```
{ projectInfo:{version,lastModified}, rooms:[{id,name,height,points:[[x,z]...]},...],
  items:[{id,type:"FURNITURE"|"FIXTURE",modelType,name?,position:[x,y,z],
          rotation:[x,y,z],size:[x,y,z],color?, elevation?:number, doorSwing?:{direction,radius,angle}}] }
```
- `elevation`(선택, cm): 바닥 위 높이. 창·콘센트 전용이며 문(DOOR*)과 가구에서는 무시한다. 없으면 기본값(창 90, 콘센트 30). 있으면 유한수이고 0 이상이어야 한다. version은 "1.1".
- 1.0 저장본(`room`)도 읽을 수 있고 다음 저장은 1.1로 나간다.
- 고정 요소 `modelType`: `DOOR_ENTRANCE`(현관문), `DOOR_SINGLE`(방문), `WINDOW`, `OUTLET`. 씬은 DOOR/WINDOW/OUTLET 접두어로 종류를 구분한다. 고정 요소 방향은 저장 `rotation`이 아니라 가장 가까운 벽 방향에서 유도한다.
- 가구 15종과 고정 요소 4종의 `modelType`·한글명·기본 크기·기본 색은 `src/store/catalog.ts` 한 곳에서만 정의한다(PRD FR-08). 카탈로그 치수는 W×D×H, 저장 `size`는 [W,H,D]다.
- 치수 박스(PRD FR-09): `type:"FURNITURE"`, `modelType:"DIMENSION_BOX"`. 카탈로그 15종에는 포함하지 않으며 `src/store/catalog.ts`의 `DIMENSION_BOX` 상수 한 곳에서 정의한다. 스키마는 일반 가구와 같다(`size`=[W,H,D], W·D 1~1000, H 1~500, version "1.1"). `name`은 선택(없으면 표시명 '치수 박스'), `color`는 선택(기본 `#90caf9`). 제휴 링크는 표시하지 않는다(AC-17-1). 반투명 렌더링은 씬이 modelType으로 판별한다(AC-08-8).
- 불러오기 시 `version`, 필수 필드, 숫자 범위를 검증하고 실패하면 기존 상태를 유지한 채 오류를 표시한다.
- Undo/Redo 대상은 `rooms`와 `items`뿐이다.

## 다중 방
- 방 개수 1~20(`ROOMS_MAX`), 방마다 `ROOM_MAX` 3000cm·꼭짓점 3~100개, 문서 전체 바운딩 박스 10000cm(`PLAN_EXTENT_MAX`). 가구 `position`의 x·z도 ±10000cm 이내여야 한다.
- **좌표 불변식:** 모든 방 꼭짓점의 min x·min z ≥ 0. 방 추가·모서리 편집이 음수를 만들면 모든 방+가구를 같은 양만큼 옮기고, 그 이동은 원래 변경과 같은 Undo 1단계다.
- 방 내부 면적이 겹치면 거부한다. 변·점 접촉과 간격 0은 허용한다. `roomsOverlap`을 쓴다.
- 벽은 방마다 그린다. 두 방의 벽 띠는 간격 0이면 서로 상쇄되어 벽이 사실상 비가시(양쪽 0.1cm 띠의 합 0.2cm), 0 초과 20cm 이하면 하나의 벽, 20cm 초과면 가운데 틈이 남는다. 새 방 추가 간격은 `ROOM_ADD_GAP`=10cm(=벽 두께)로 두 벽 띠가 하나가 된다.
- 활성 방은 `useUiStore.activeRoomId`(Undo 비대상). 없거나 사라지면 `rooms[0]`으로 해소한다. 모서리 편집·벽 길이·방 대화상자는 활성 방에만 적용한다.
- 가구 소속은 바닥 박스 **중심점**이 든 방(배열 앞쪽). `elevation` clamp는 소속 방 천장고, 소속이 없으면 모든 방의 최저 천장고다.
- 문·창의 호스트 벽은 모든 방의 모든 변 중 가장 가까운 변이고, 1cm 이내 동률이면 배열 앞쪽 방이다. 열림 부채꼴·`NO_SPACE`는 호스트 방 기준으로 계산한다.
- 방 삭제는 가구를 남긴다(방 밖이 되어 `WALL` 경고). 마지막 방은 삭제할 수 없다.
- **트레이싱 세션 offset 불변식:** 세션은 이미지·축척·기준선·`offset`을 메모리에만 두고(저장 JSON 제외) `doc = round(plane + offset)`가 세션에서 확정한 모든 방(add면 기존 방 포함)에 성립하게 유지한다. 원점 정규화(min→(0,0))는 replace 모드의 **첫 방에만** 쓴다. 문서 전체 이동이 생기면 offset에 같은 양을 누적한다. add + 이미지의 첫 방은 정렬 정보가 없어 `placeRightOf(활성 방)`으로 놓고 그 이동량까지 offset에 반영한 뒤 고정한다(그 전에는 고스트·이웃 스냅 숨김). add + 빈 캔버스는 offset [0,0].
- **이웃 스냅:** 반경 `SNAP_RADIUS`=15cm, 꼭짓점 > 변, 이웃 방 바깥 `NEIGHBOR_GAP`=10cm 링(`offsetOutward`)에 붙인다. 점 확정 순서는 직각 보정 → 격자 스냅 → 이웃 스냅 → 영역 clamp. 길이 입력 점은 제외. 해제는 포인터 이벤트의 Shift(누른 동안)와 체크박스 `neighborSnap`(고스트가 있을 때만 표시).
- **잠금:** 첫 방 확정 뒤(`confirmed > 0`)에는 이미지 변경·축척·기준선 다시 찍기·`start`를 거부한다.
- 우측 패널의 "새 방 만들기"는 **문서 전체 교체**(2개 이상이면 확인 대화상자), "방 추가"는 기존 방·가구를 보존한다. 방이 1개면 목록은 이름+추가 한 줄로 접는다.

## 폴더 구조
`src/scene/`(3D), `src/store/`(상태), `src/ui/`(패널·메뉴), `src/io/`(JSON·LocalStorage). 가구는 GLB 없이 색상 직육면체 + 이름 라벨로 그린다(PRD AC-08-7).

## MVP 밖 (구현하지 않는다)
곡선 벽, 복층, 그림자·조명, 물리 엔진, 클라우드 계정, 실시간 공동 편집, WASD 보행, 가구 조립, 생성형 AI 평면도 분석(v1.1 후보), 자체 서버·로그인.
