# RoomFit 3D

3D 가구 배치 시뮬레이터. 기획: `docs/기획서.md`, 요구사항(우선): `docs/PRD.md`, 화면: `docs/wireframes.md`

## 하네스: RoomFit 3D 개발

**목표:** 기획서의 MVP(v1.0) 기능을 구현 → 검증 순서로 작게 나눠 개발한다.

**호출 조건:** 방 생성, 가구 배치, 충돌 경고, 카메라 뷰, 저장/불러오기, UI 패널 등 기능 구현·수정 요청이 오면 `roomfit-dev` 스킬을 사용한다. 단순 질문에는 직접 답해도 된다.

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
| --- | --- | --- | --- |
| 2026-11-16 | Harness v2로 처음 구성 (에이전트 3, 스킬 2) | 전체 | - |
| 2026-11-24 | business-reviewer 에이전트 추가(사업성·경쟁 벤치마크·차별화 분석 전용, 읽기+웹 조회만), roomfit-dev에 호출 경로 추가 | agents/business-reviewer, skills/roomfit-dev, 이 파일 | 사업성 검토 역할이 구현·QA 어느 에이전트에도 없었음 |
| 2026-11-24 | business-reviewer 모델 opus → sonnet | agents/business-reviewer | 토큰 부족 |
| 2026-11-18 | PRD·와이어프레임 반영: 가구 GLB→색상 블록, 방 상한 3000cm, 타겟 확대, 수익화(제휴·광고), 자동 모서리 제안 | conventions 스킬, app-engineer, 이 파일 | PRD가 기획서보다 우선 |
