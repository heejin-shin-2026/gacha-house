# 🎁 뽑기 하우스 (Gacha House)

뽑기로 도구·가구·보물을 모아 마인크래프트 느낌의 블록 하우스를 꾸미는 초등학생용 게임입니다.

## 놀이 방법
- 🪙 코인으로 뽑기 (1번 20코인 / 10번 180코인)
- 가끔 빈 캡슐(꽝)이 나와요 — 위로 코인 5개, 3연속 꽝 방지 보장 시스템
- 중복 아이템은 코인 15개로 자동 교환
- 물건 24종을 모두 모으면 집 완성! (일반/희귀/슈퍼희귀/전설 등급)
- 코인이 부족하면 코인 상자(+50, 20초마다)로 충전

## 저장
- 기본: 브라우저 localStorage 자동 저장
- 클라우드: 이름 + 숫자 4자리 비밀코드로 Supabase에 저장/불러오기 (`gacha_saves` 테이블)

## 기술 스택
Next.js 15 · React 19 · Tailwind CSS · Supabase · Vercel

## 실행
```bash
npm install
npm run dev
```
환경변수: `.env.example` 참고 (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
DB 스키마: `supabase/migration.sql`을 Supabase SQL Editor에서 실행
