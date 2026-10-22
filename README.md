# 🎁 뽑기 하우스 (Gacha House)

뽑기로 도구·가구·보물을 모아 마인크래프트 느낌의 블록 하우스를 꾸미는 초등학생용 게임입니다.

## 놀이 방법 (v2)
- 🍪 쿠키런식 뽑기 연출 (1번 20코인 / 10번 180코인), 가끔 빈 캡슐(꽝) — 위로 코인 5개, 3연속 꽝 방지
- 중복 아이템은 ⭐별조각으로 적립 (쿠키런 마일리지 방식) — 별조각 5개로 아직 없는 물건 확정 뽑기
- ⚔️ 배틀: 몬스터 4종(슬라임/좀비/거미/보스 크리퍼)과 턴제 배틀, 승리 시 코인 보상 + 보스는 보너스 뽑기권(무조건 희귀 이상). 모은 도구가 공격력 보너스
- 🏡 집은 Three.js 3D 복셀 하우스 — 드래그로 회전, 뽑은 물건이 3D로 배치됨

## 저장
- 기본: 브라우저 localStorage 자동 저장
- 클라우드: 이름 + 숫자 4자리 비밀코드로 Supabase에 저장/불러오기 (`gacha_saves` 테이블)

## 기술 스택
Next.js 15 · React 19 · Tailwind CSS · Three.js · Supabase · Vercel

## 실행
```bash
npm install
npm run dev
```
환경변수: `.env.example` 참고 (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
DB 스키마: `supabase/migration.sql`을 Supabase SQL Editor에서 실행
