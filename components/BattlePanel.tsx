"use client";

import { useMemo, useRef, useState } from "react";

export interface BattleResult {
  win: boolean;
  coins: number;
  ticket: boolean;
  monsterName: string;
}

interface Monster {
  id: string;
  name: string;
  emoji: string;
  hp: number;
  atk: [number, number];
  reward: number;
  ticket?: boolean;
  desc: string;
}

const MONSTERS: Monster[] = [
  { id: "slime", name: "말랑 슬라임", emoji: "🟢", hp: 30, atk: [3, 6], reward: 50, desc: "약해요. 처음 배틀에 딱!" },
  { id: "zombie", name: "블록 좀비", emoji: "🧟", hp: 48, atk: [5, 9], reward: 80, desc: "느리지만 튼튼해요" },
  { id: "spider", name: "점프 거미", emoji: "🕷️", hp: 65, atk: [7, 11], reward: 115, desc: "빠르게 물어뜯어요" },
  { id: "creeper", name: "보스 크리퍼", emoji: "💥", hp: 95, atk: [9, 14], reward: 180, ticket: true, desc: "이기면 보너스 뽑기권까지!" },
];

/** 모은 도구가 배틀 공격력을 올려준다 */
const TOOL_POWER: Record<string, { name: string; power: number }> = {
  pickaxe: { name: "다이아 곡괭이", power: 6 },
  dragonegg: { name: "드래곤 알", power: 5 },
  diamond: { name: "다이아몬드 블록", power: 4 },
  enchant: { name: "마법 부여대", power: 4 },
  fishing: { name: "낚싯대", power: 2 },
  torch: { name: "횃불", power: 1 },
};

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

export default function BattlePanel({
  inventory,
  onBattleEnd,
}: {
  inventory: Record<string, number>;
  onBattleEnd: (r: BattleResult) => void;
}) {
  const [monster, setMonster] = useState<Monster | null>(null);
  const [monsterHp, setMonsterHp] = useState(0);
  const [playerHp, setPlayerHp] = useState(100);
  const [potions, setPotions] = useState(2);
  const [log, setLog] = useState<string[]>([]);
  const [hitFx, setHitFx] = useState<"monster" | "player" | null>(null);
  const [over, setOver] = useState<"win" | "lose" | null>(null);
  const busyRef = useRef(false);

  const power = useMemo(
    () =>
      Object.entries(TOOL_POWER)
        .filter(([id]) => (inventory[id] ?? 0) > 0)
        .reduce((s, [, v]) => s + v.power, 0),
    [inventory]
  );
  const powerItems = useMemo(
    () => Object.entries(TOOL_POWER).filter(([id]) => (inventory[id] ?? 0) > 0),
    [inventory]
  );

  function start(m: Monster) {
    setMonster(m);
    setMonsterHp(m.hp);
    setPlayerHp(100);
    setPotions(2);
    setOver(null);
    setLog([`${m.emoji} ${m.name}이(가) 나타났다!`]);
  }

  function finish(win: boolean, m: Monster) {
    setOver(win ? "win" : "lose");
    onBattleEnd({
      win,
      coins: win ? m.reward : 10,
      ticket: win && !!m.ticket,
      monsterName: m.name,
    });
  }

  function act(kind: "normal" | "strong" | "potion") {
    if (!monster || over || busyRef.current) return;
    busyRef.current = true;
    const m = monster;
    let mHp = monsterHp;
    let pHp = playerHp;
    const lines: string[] = [];

    if (kind === "potion") {
      if (potions <= 0) { busyRef.current = false; return; }
      const heal = 30;
      pHp = Math.min(100, pHp + heal);
      setPotions((v) => v - 1);
      lines.push(`🧪 포션을 마셨어요! 체력 +${heal}`);
    } else {
      let dmg = 0;
      if (kind === "normal") {
        dmg = rand(8, 13) + power;
        if (Math.random() < 0.15) {
          dmg = Math.round(dmg * 1.8);
          lines.push(`✨ 크리티컬! ${dmg} 데미지!`);
        } else lines.push(`⚔️ 공격! ${m.name}에게 ${dmg} 데미지`);
      } else {
        if (Math.random() < 0.7) {
          dmg = rand(14, 22) + power;
          lines.push(`💥 강한 공격 성공! ${dmg} 데미지!`);
        } else lines.push(`💨 강한 공격이 빗나갔어요…`);
      }
      mHp = Math.max(0, mHp - dmg);
      if (dmg > 0) {
        setHitFx("monster");
        setTimeout(() => setHitFx(null), 350);
      }
    }

    setMonsterHp(mHp);
    if (mHp <= 0) {
      lines.push(`🎉 ${m.name}을(를) 물리쳤어요!`);
      setLog((prev) => [...lines, ...prev].slice(0, 5));
      setPlayerHp(pHp);
      finish(true, m);
      busyRef.current = false;
      return;
    }

    // 몬스터 반격
    setTimeout(() => {
      const mdmg = rand(m.atk[0], m.atk[1]);
      const npHp = Math.max(0, pHp - mdmg);
      setPlayerHp(npHp);
      setHitFx("player");
      setTimeout(() => setHitFx(null), 350);
      lines.push(`${m.emoji} ${m.name}의 공격! ${mdmg} 데미지를 받았어요`);
      setLog((prev) => [...lines, ...prev].slice(0, 5));
      if (npHp <= 0) {
        setLog((prev) => [`😵 쓰러졌어요… 위로 코인 10개`, ...prev].slice(0, 5));
        finish(false, m);
      }
      busyRef.current = false;
    }, 420);

    setPlayerHp(pHp);
    setLog((prev) => [...lines, ...prev].slice(0, 5));
  }

  return (
    <section className="pixel-border flex h-full flex-col rounded-lg bg-[#263238] px-4 py-4 text-white">
      <h2 className="text-center text-2xl font-black tracking-wide">⚔️ 배틀 ⚔️</h2>
      <p className="mt-1 text-center text-sm font-bold text-[#b0bec5]">몬스터를 이기면 코인을 듬뿍! 보스를 이기면 보너스 뽑기권까지!</p>

      {!monster ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {MONSTERS.map((m) => (
            <button key={m.id} onClick={() => start(m)} className="pixel-btn rounded-lg bg-[#37474f] px-2 py-3 text-left">
              <div className="text-4xl">{m.emoji}</div>
              <div className="mt-1 font-black">{m.name}</div>
              <div className="text-xs font-bold text-[#b0bec5]">체력 {m.hp} · 보상 🪙{m.reward}{m.ticket ? " + 🎫" : ""}</div>
              <div className="text-xs text-[#90a4ae]">{m.desc}</div>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3">
          <div className={`text-center ${hitFx === "monster" ? "shaking" : ""}`}>
            <span className="inline-block text-7xl">{monster.emoji}</span>
          </div>
          <div className="mt-1 text-center font-black">{monster.name}</div>
          {/* 몬스터 체력 */}
          <div className="mt-1 h-4 overflow-hidden rounded border-2 border-black bg-[#37474f]">
            <div className="h-full bg-[#e53935] transition-all duration-300" style={{ width: `${(monsterHp / monster.hp) * 100}%` }} />
          </div>
          <div className="text-right text-xs font-bold">몬스터 체력 {monsterHp}/{monster.hp}</div>

          {/* 내 체력 */}
          <div className={`mt-2 ${hitFx === "player" ? "shaking" : ""}`}>
            <div className="h-4 overflow-hidden rounded border-2 border-black bg-[#37474f]">
              <div className="h-full bg-[#66bb4a] transition-all duration-300" style={{ width: `${playerHp}%` }} />
            </div>
            <div className="flex justify-between text-xs font-bold">
              <span>내 체력 {playerHp}/100</span>
              <span>공격력 보너스 +{power}</span>
            </div>
          </div>

          {over ? (
            <div className="mt-3 text-center">
              <p className="pop-in text-xl font-black">{over === "win" ? `🎉 승리! 🪙${monster.reward} 획득${monster.ticket ? " + 🎫보너스 뽑기권!" : ""}` : "😵 패배… 위로 코인 🪙10"}</p>
              <button onClick={() => setMonster(null)} className="pixel-btn mt-2 rounded-lg bg-[#42a5f5] px-5 py-2 font-black text-white">다른 몬스터 고르기</button>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button onClick={() => act("normal")} className="pixel-btn rounded-lg bg-[#e53935] px-2 py-2 font-black text-white">⚔️ 공격</button>
              <button onClick={() => act("strong")} className="pixel-btn rounded-lg bg-[#fb8c00] px-2 py-2 font-black text-white">💥 강공격</button>
              <button onClick={() => act("potion")} disabled={potions <= 0} className="pixel-btn rounded-lg bg-[#66bb4a] px-2 py-2 font-black text-white">🧪 포션 ({potions})</button>
            </div>
          )}

          <div className="mt-3 min-h-20 rounded bg-black/30 p-2 text-sm font-bold leading-5">
            {log.map((l, i) => (
              <p key={i} className={i === 0 ? "text-white" : "text-[#b0bec5]"}>{l}</p>
            ))}
          </div>
          {!over && (
            <button onClick={() => setMonster(null)} className="mt-2 text-sm font-bold text-[#90a4ae] underline">도망가기</button>
          )}
        </div>
      )}

      <div className="mt-auto pt-3 text-sm font-bold text-[#b0bec5]">
        🛠️ 도구 보너스: {powerItems.length ? powerItems.map(([id, v]) => `${v.name} +${v.power}`).join(", ") : "아직 없어요 — 뽑기로 도구를 모으면 공격력이 올라가요!"}
      </div>
    </section>
  );
}
