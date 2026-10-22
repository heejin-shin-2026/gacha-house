import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "뽑기 하우스 — 마인 하우스 꾸미기",
  description: "뽑기로 도구와 가구를 모아 블록 하우스를 꾸미는 초등학생용 뽑기 게임",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
