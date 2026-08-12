# 물류관리 시스템 — 웹 서비스

`물류관리시스템 (2).html` 단일 파일 프로토타입을 로그인 기반 웹 서비스로 이식한 버전입니다.
프로토타입의 업무 로직(패킹 알고리즘, 발주번호별 박스 분리, 팔레트 자동 구성, 오더패킹 히스토리, 발주·입고)을
그대로 옮기되, 브라우저 메모리 대신 실제 DB(Supabase/PostgreSQL)에 저장합니다.

## 스택

- Next.js 15 (App Router) + TypeScript
- Prisma + PostgreSQL (Supabase 호스팅)
- Auth.js(NextAuth v5) — 이메일/비밀번호(Credentials) 로그인
- xlsx(SheetJS) — 주문 엑셀 파싱(브라우저) / 결과 엑셀 생성(서버)

## 로컬 실행

`.env`에 Supabase 프로젝트의 `DATABASE_URL`(transaction pooler, 6543포트)과 `DIRECT_URL`(session pooler, 5432포트)이 이미 설정되어 있어야 합니다.

```bash
npm install
npx prisma migrate dev   # 스키마 변경 시
npx prisma db seed       # 관리자 계정 + 마스터 데이터 시드 (최초 1회)
npm run dev              # http://localhost:3000
```

기본 관리자 계정: `admin@example.com` / `changeme123` (`.env`의 `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`로 변경 가능)

테스트하다가 데이터가 꼬였을 때 초기 상태로 되돌리는 스크립트:

```bash
npx tsx prisma/reset-test-state.ts   # 진행 중이던 오더패킹 배치를 전부 지우고 재고를 시드값으로 복원
```

## 현재 상태 — 전체 화면 이식 완료

- ✅ 로그인/로그아웃, 미인증 접근 시 `/login`으로 리다이렉트
- ✅ 상품(Product) / 박스(BoxSpec) / 배송지(Warehouse) 마스터: 목록·추가·수정·삭제
- ✅ **Order·패킹**: 엑셀 업로드(또는 샘플 주문) → 패킹 리스트 생성(파일당 1회) → 출고 확정(재고·박스재고 차감, 되돌리기 가능) → 히스토리 반영(화면 초기화)
  - 발주번호 1건 = 박스 1개 이상(한 박스엔 한 발주번호만), 배송지 박스 10개 초과 시 10개 단위로 팔레트 자동 구성, 마지막 잔량 박스 다운사이징까지 프로토타입 로직 그대로 이식
- ✅ **오더패킹 히스토리**: 반영된 배치 목록 + 상세 페이지(배송지·박스·팔레트·반송 전부 조회 가능)
- ✅ **발주·입고**: 재고 부족분을 Order·패킹 파일(배치)별 카드로 그룹핑, 입고 반영/취소, 배치 단위 반영(마감)
- ✅ 엑셀 내보내기: PackingList(배송지요약·박스요약·상세·재고부족·반송), 팔레트 명세서, 반송 리스트, 구매발주목록 — 전부 서버에서 생성

## 다음 단계 / 배포 전 해야 할 것

1. `.env`의 `AUTH_SECRET`을 랜덤 값으로 교체 (`npx auth secret` 또는 `openssl rand -base64 32`)
2. Supabase DB 비밀번호는 개발 중 채팅으로 공유되었으므로, 실제 서비스 오픈 전에 Supabase 대시보드에서 한 번 재발급(rotate)하는 것을 권장
3. Vercel 등에 배포, 환경변수(`DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`) 설정
4. 여러 명이 동시에 쓸 경우를 대비해 사용자별 데이터 격리(멀티테넌트)는 아직 없음 — 지금은 로그인한 모든 사용자가 같은 데이터를 봄
5. `xlsx`(SheetJS) npm 패키지는 알려진 취약점이 있는 오래된 빌드입니다(프로토타입도 동일 버전 사용). 업로드 파일을 신뢰할 수 있는 사용자만 쓰는 내부 도구라 당장은 괜찮지만, 외부에 노출한다면 SheetJS 공식 CDN 빌드로 교체 검토
