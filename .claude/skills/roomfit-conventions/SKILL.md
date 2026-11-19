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

## 저장 JSON (version "1.0")
```
{ projectInfo:{version,lastModified}, room:{height,points:[[x,z]...]},
  items:[{id,type:"FURNITURE"|"FIXTURE",modelType,name?,position:[x,y,z],
          rotation:[x,y,z],size:[x,y,z],color?, elevation?:number, doorSwing?:{direction,radius,angle}}] }
```
- `elevation`(선택, cm): 바닥 위 높이. 창·콘센트 전용이며 문(DOOR*)과 가구에서는 무시한다. 없으면 기본값(창 90, 콘센트 30). 있으면 유한수이고 0 이상이어야 한다. version은 "1.0" 유지.
- 고정 요소 `modelType`: `DOOR_ENTRANCE`(현관문), `DOOR_SINGLE`(방문), `WINDOW`, `OUTLET`. 씬은 DOOR/WINDOW/OUTLET 접두어로 종류를 구분한다. 고정 요소 방향은 저장 `rotation`이 아니라 가장 가까운 벽 방향에서 유도한다.
- 가구 15종과 고정 요소 4종의 `modelType`·한글명·기본 크기·기본 색은 `src/store/catalog.ts` 한 곳에서만 정의한다(PRD FR-08). 카탈로그 치수는 W×D×H, 저장 `size`는 [W,H,D]다.
- 치수 박스(PRD FR-09): `type:"FURNITURE"`, `modelType:"DIMENSION_BOX"`. 카탈로그 15종에는 포함하지 않으며 `src/store/catalog.ts`의 `DIMENSION_BOX` 상수 한 곳에서 정의한다. 스키마는 일반 가구와 같다(`size`=[W,H,D], W·D 1~1000, H 1~500, version "1.0" 유지). `name`은 선택(없으면 표시명 '치수 박스'), `color`는 선택(기본 `#90caf9`). 제휴 링크는 표시하지 않는다(AC-17-1). 반투명 렌더링은 씬이 modelType으로 판별한다(AC-08-8).
- 불러오기 시 `version`, 필수 필드, 숫자 범위를 검증하고 실패하면 기존 상태를 유지한 채 오류를 표시한다.
- Undo/Redo 대상은 `room`과 `items`뿐이다.

## 폴더 구조
`src/scene/`(3D), `src/store/`(상태), `src/ui/`(패널·메뉴), `src/io/`(JSON·LocalStorage). 가구는 GLB 없이 색상 직육면체 + 이름 라벨로 그린다(PRD AC-08-7).

## MVP 밖 (구현하지 않는다)
곡선 벽, 복층, 그림자·조명, 물리 엔진, 클라우드 계정, 실시간 공동 편집, WASD 보행, 가구 조립, 생성형 AI 평면도 분석(v1.1 후보), 자체 서버·로그인.
