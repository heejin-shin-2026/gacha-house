"use client";

import { useMemo, useRef, useState } from "react";
import { ITEMS } from "@/lib/items";

export interface BattleResult {
  win: boolean;
  coins: number;
  tickets: number;
  monsterName: string;
}

type Trait = "double" | "heal" | undefined;

interface Monster {
  id: string;
  name: string;
  emoji: string;
  hp: number;
  atk: [number, number];
  reward: number;
  tickets?: number;
  level: "쉬움" | "보통" | "어려움" | "최종보스";
  trait?: Trait;
  desc: string;
}

const MONSTERS: Monster[] = [
  { id: "slime", name: "말랑 슬라임", emoji: "🟢", hp: 30, atk: [3, 6], reward: 50, level: "쉬움", desc: "약해요. 처음 배틀에 딱!" },
  { id: "zombie", name: "블록 좀비", emoji: "🧟", hp: 48, atk: [5, 9], reward: 80, level: "쉬움", desc: "느리지만 튼튼해요" },
  { id: "spider", name: "점프 거미", emoji: "🕷️", hp: 65, atk: [7, 11], reward: 115, level: "보통", trait: "double", desc: "가끔 두 번 물어요!" },
  { id: "skeleton", name: "스켈레톤 궁수", emoji: "🏹", hp: 80, atk: [9, 13], reward: 140, level: "보통", desc: "멀리서 화살을 쏴요" },
  { id: "witch", name: "숲속 마녀", emoji: "🧙", hp: 92, atk: [8, 12], reward: 165, level: "보통", trait: "heal", desc: "자기 체력을 회복해요" },
  { id: "creeper", name: "보스 크리퍼", emoji: "💥", hp: 110, atk: [10, 15], reward: 190, tickets: 1, level: "어려움", desc: "이기면 보너스 뽑기권!" },
  { id: "enderman", name: "엔더맨", emoji: "👾", hp: 135, atk: [12, 17], reward: 250, tickets: 1, level: "어려움", trait: "double", desc: "순간이동하며 두 번 공격!" },
  { id: "wither", name: "위더 스켈레톤", emoji: "💀", hp: 155, atk: [13, 18], reward: 290, tickets: 1, level: "어려움", desc: "검은 해골 기사. 아주 강해요" },
  { id: "dragon", name: "엔더 드래곤", emoji: "🐉", hp: 230, atk: [15, 21], reward: 500, tickets: 2, level: "최종보스", trait: "double", desc: "최종보스! 이기면 뽑기권 2장!" },
];

/** 모은 도구가 주는 작은 보너스 (무기 본공격과 별도) */
const TOOL_POWER: Record<string, { name: string; power: number }> = {
  pickaxe: { name: "다이아 곡괭이", power: 6 },
  dragonegg: { name: "드래곤 알", power: 5 },
  diamond: { name: "다이아몬드 블록", power: 4 },
  enchant: { name: "마법 부여대", power: 4 },
  fishing: { name: "낚싯대", power: 2 },
  torch: { name: "횃불", power: 1 },
};

const LEVEL_COLOR: Record<Monster["level"], string> = {
  "쉬움": "#66bb4a",
  "보통": "#42a5f5",
  "어려움": "#fb8c00",
  "최종보스": "#e53935",
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

  const bestWeapon = useMemo(() => {
    const owned = ITEMS.filter((i) => i.power && (inventory[i.id] ?? 0) > 0);
    if (!owned.length) return null;
    return owned.sort((a, b) => (b.power ?? 0) - (a.power ?? 0))[0];
  }, [inventory]);

  const toolPower = useMemo(
    () =>
      Object.entries(TOOL_POWER)
        .filter(([id]) => (inventory[id] ?? 0) > 0)
        .reduce((s, [, v]) => s + v.power, 0),
    [inventory]
  );
  const power = (bestWeapon?.power ?? 0) + toolPower;

  function start(m: Monster) {
    setMonster(m);
    setMonsterHp(m.hp);
    setPlayerHp(100);
    setPotions(2);
    setOver(null);
    setLog([`${m.emoji} ${m.name}이(가) 나타났다! (체력 ${m.hp})`]);
  }

  function finish(win: boolean, m: Monster) {
    setOver(win ? "win" : "lose");
    onBattleEnd({
      win,
      coins: win ? m.reward : 10,
      tickets: win ? m.tickets ?? 0 : 0,
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
      pHp = Math.min(100, pHp + 30);
      setPotions((v) => v - 1);
      lines.push(`🧪 포션을 마셨어요! 체력 +30`);
    } else {
      let dmg = 0;
      if (kind === "normal") {
        dmg = rand(8, 13) + power;
        if (Math.random() < 0.15) {
          dmg = Math.round(dmg * 1.8);
          lines.push(`✨ 크리티컬! ${dmg} 데미지!`);
        } else lines.push(`⚔️ ${bestWeapon ? bestWeapon.name + "(으)로 " : ""}공격! ${dmg} 데미지`);
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

    setTimeout(() => {
      const counter: string[] = [];
      if (m.trait === "heal" && Math.random() < 0.2) {
        mHp = Math.min(m.hp, mHp + 10);
        setMonsterHp(mHp);
        counter.push(`🧙 ${m.name}이(가) 체력을 10 회복했어요!`);
      }
      const mdmg = rand(m.atk[0], m.atk[1]);
      let npHp = Math.max(0, pHp - mdmg);
      counter.push(`${m.emoji} ${m.name}의 공격! ${mdmg} 데미지`);
      if (m.trait === "double" && npHp > 0 && Math.random() < 0.25) {
        const extra = rand(m.atk[0], m.atk[1]);
        npHp = Math.max(0, npHp - extra);
        counter.push(`💨 연속 공격! ${extra} 데미지 추가`);
      }
      setPlayerHp(npHp);
      setHitFx("player");
      setTimeout(() => setHitFx(null), 350);
      setLog((prev) => [...counter, ...lines, ...prev].slice(0, 5));
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
      <p className="mt-1 text-center text-sm font-bold text-[#b0bec5]">강한 몬스터일수록 보상이 커요! 무기를 뽑으면 공격력이 쑥쑥 올라요.</p>

      {!monster ? (
        <div className="mt-3 grid grid-cols-2 gap-2 overflow-y-auto pr-1" style={{ maxHeight: 430 }}>
          {MONSTERS.map((m) => (
            <button key={m.id} onClick={() => start(m)} className="pixel-btn rounded-lg bg-[#37474f] px-2 py-3 text-left">
              <div className="flex items-start justify-between">
                <span className="text-4xl">{m.emoji}</span>
                <span className="rounded-full px-2 py-0.5 text-[11px] font-black text-white" style={{ background: LEVEL_COLOR[m.level] }}>{m.level}</span>
              </div>
              <div className="mt-1 font-black">{m.name}</div>
              <div className="text-xs font-bold text-[#b0bec5]">체력 {m.hp} · 보상 🪙{m.reward}{m.tickets ? ` + 🎫${m.tickets}` : ""}</div>
              <div className="text-xs text-[#90a4ae]">{m.desc}</div>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3">
          <div className={`text-center ${hitFx === "monster" ? "shaking" : ""}`}>
            <span className="inline-block text-7xl">{monster.emoji}</span>
          </div>
          <div className="mt-1 text-center font-black">
            {monster.name} <span className="rounded-full px-2 py-0.5 text-[11px] font-black text-white" style={{ background: LEVEL_COLOR[monster.level] }}>{monster.level}</span>
          </div>
          <div className="mt-1 h-4 overflow-hidden rounded border-2 border-black bg-[#37474f]">
            <div className="h-full bg-[#e53935] transition-all duration-300" style={{ width: `${(monsterHp / monster.hp) * 100}%` }} />
          </div>
          <div className="text-right text-xs font-bold">몬스터 체력 {monsterHp}/{monster.hp}</div>

          <div className={`mt-2 ${hitFx === "player" ? "shaking" : ""}`}>
            <div className="h-4 overflow-hidden rounded border-2 border-black bg-[#37474f]">
              <div className="h-full bg-[#66bb4a] transition-all duration-300" style={{ width: `${playerHp}%` }} />
            </div>
            <div className="flex justify-between text-xs font-bold">
              <span>내 체력 {playerHp}/100</span>
              <span>총 공격 보너스 +{power}</span>
            </div>
          </div>

          {over ? (
            <div className="mt-3 text-center">
              <p className="pop-in text-xl font-black">{over === "win" ? `🎉 승리! 🪙${monster.reward} 획득${monster.tickets ? ` + 🎫뽑기권 ${monster.tickets}장!` : ""}` : "😵 패배… 위로 코인 🪙10"}</p>
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
        🗡️ 장착 무기: {bestWeapon ? `${bestWeapon.emoji} ${bestWeapon.name} (+${bestWeapon.power})` : "맨손 — 무기 뽑기에서 무기를 뽑아보세요!"}
        {toolPower > 0 ? ` · 🛠️ 도구 보너스 +${toolPower}` : ""}
      </div>
    </section>
  );
}
