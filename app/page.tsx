"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ITEMS, RARITY_COLOR, RARITY_LABEL, RARITY_WEIGHT, Item, Rarity } from "@/lib/items";
import { cloudLoad, cloudSave } from "@/lib/supabase";
import BattlePanel, { BattleResult } from "@/components/BattlePanel";

const House3D = dynamic(() => import("@/components/House3D"), {
  ssr: false,
  loading: () => <div className="flex h-[440px] items-center justify-center rounded-lg border-4 border-[#3e2723] bg-[#87ceeb] font-black">🏠 집을 짓는 중…</div>,
});

const COST_ONE = 20;
const COST_TEN = 180;
const MISS_RATE = 0.25;
const SHARD_COST = 5;
const LS_KEY = "gacha-house-save-v2";
const LS_PROFILE = "gacha-house-profile-v1";

interface DrawResult {
  item: Item | null;
  isNew: boolean;
  isDup: boolean;
  guaranteed?: boolean;
  special?: string;
}

interface SaveState {
  coins: number;
  shards: number;
  tickets: number;
  inventory: Record<string, number>;
  totalDraws: number;
  missStreak: number;
  battleWins: number;
}

const INITIAL: SaveState = { coins: 100, shards: 0, tickets: 0, inventory: {}, totalDraws: 0, missStreak: 0, battleWins: 0 };

function rollRarity(minRarity?: Rarity): Rarity {
  const order: Rarity[] = ["common", "rare", "epic", "legend"];
  let pool = order.map((r) => ({ r, w: RARITY_WEIGHT[r] }));
  if (minRarity) pool = pool.filter((p) => order.indexOf(p.r) >= order.indexOf(minRarity));
  const total = pool.reduce((s, p) => s + p.w, 0);
  let roll = Math.random() * total;
  for (const p of pool) {
    roll -= p.w;
    if (roll <= 0) return p.r;
  }
  return pool[pool.length - 1].r;
}

function rollItem(minRarity?: Rarity): Item {
  const rarity = rollRarity(minRarity);
  const candidates = ITEMS.filter((i) => i.rarity === rarity);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function beep(freq: number, ms: number, delay = 0) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    gain.gain.value = 0.05;
    osc.connect(gain).connect(ctx.destination);
    const t = ctx.currentTime + delay / 1000;
    osc.start(t);
    osc.stop(t + ms / 1000);
  } catch { /* 무시 */ }
}

export default function Home() {
  const [save, setSave] = useState<SaveState>(INITIAL);
  const [loaded, setLoaded] = useState(false);
  const [phase, setPhase] = useState<"idle" | "rolling" | "reveal">("idle");
  const [results, setResults] = useState<DrawResult[]>([]);
  const [toast, setToast] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [cloudMsg, setCloudMsg] = useState("");
  const busyRef = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setSave({ ...INITIAL, ...JSON.parse(raw) });
      const prof = localStorage.getItem(LS_PROFILE);
      if (prof) {
        const p = JSON.parse(prof);
        setName(p.name ?? "");
        setCode(p.code ?? "");
      }
    } catch { /* 무시 */ }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(LS_KEY, JSON.stringify(save));
  }, [save, loaded]);

  const ownedCount = useMemo(() => Object.keys(save.inventory).filter((k) => save.inventory[k] > 0).length, [save.inventory]);
  const progress = Math.round((ownedCount / ITEMS.length) * 100);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  /** 일반 뽑기 묶음 실행 */
  function runDraws(count: number, state: SaveState): { results: DrawResult[]; next: SaveState } {
    const next: SaveState = { ...state, inventory: { ...state.inventory } };
    const out: DrawResult[] = [];
    for (let i = 0; i < count; i++) {
      const isLastOfTen = count === 10 && i === count - 1;
      const guaranteed = next.missStreak >= 2 || isLastOfTen;
      const miss = !guaranteed && Math.random() < MISS_RATE;
      next.totalDraws += 1;
      if (miss) {
        next.missStreak += 1;
        next.coins += 5;
        out.push({ item: null, isNew: false, isDup: false });
        continue;
      }
      next.missStreak = 0;
      const item = rollItem(isLastOfTen ? "rare" : undefined);
      const had = (next.inventory[item.id] ?? 0) > 0;
      if (had) {
        const shardGain = item.rarity === "legend" ? 3 : 1;
        next.shards += shardGain;
        out.push({ item, isNew: false, isDup: true, guaranteed, special: `⭐별조각 +${shardGain}` });
      } else {
        next.inventory[item.id] = 1;
        out.push({ item, isNew: true, isDup: false, guaranteed });
      }
    }
    return { results: out, next };
  }

  /** 무조건 얻는 뽑기 1회 (뽑기권/별조각 확정) */
  function runGuaranteed(state: SaveState, mode: "ticket" | "shard"): { results: DrawResult[]; next: SaveState } {
    const next: SaveState = { ...state, inventory: { ...state.inventory } };
    next.totalDraws += 1;
    next.missStreak = 0;
    if (mode === "shard") {
      const unowned = ITEMS.filter((i) => (next.inventory[i.id] ?? 0) <= 0);
      if (unowned.length > 0) {
        // 아직 없는 물건 중에서 등급 가중치로 추첨
        const weighted: Item[] = [];
        for (const it of unowned) for (let w = 0; w < RARITY_WEIGHT[it.rarity]; w++) weighted.push(it);
        const item = weighted[Math.floor(Math.random() * weighted.length)];
        next.inventory[item.id] = 1;
        return { results: [{ item, isNew: true, isDup: false, guaranteed: true, special: "⭐ 확정 뽑기!" }], next };
      }
      next.coins += 100;
      return { results: [{ item: null, isNew: false, isDup: false, special: "전부 모았어요! 대신 🪙100" }], next };
    }
    const item = rollItem("rare");
    const had = (next.inventory[item.id] ?? 0) > 0;
    if (had) {
      next.shards += 2;
      return { results: [{ item, isNew: false, isDup: true, guaranteed: true, special: "⭐별조각 +2" }], next };
    }
    next.inventory[item.id] = 1;
    return { results: [{ item, isNew: true, isDup: false, guaranteed: true, special: "🎫 보너스 뽑기!" }], next };
  }

  function animateAndReveal(compute: (s: SaveState) => { results: DrawResult[]; next: SaveState }, base: SaveState) {
    busyRef.current = true;
    setPhase("rolling");
    beep(300, 80); beep(392, 80, 160); beep(494, 80, 320); beep(587, 90, 480);
    setTimeout(() => {
      const { results: r, next } = compute(base);
      setSave(next);
      setResults(r);
      setPhase("reveal");
      busyRef.current = false;
      const best = r.filter((x) => x.item).sort((a, b) => {
        const order: Rarity[] = ["common", "rare", "epic", "legend"];
        return order.indexOf(b.item!.rarity) - order.indexOf(a.item!.rarity);
      })[0];
      if (best?.item?.rarity === "legend") { beep(523, 130); beep(659, 130, 140); beep(784, 130, 280); beep(1047, 260, 420); }
      else if (best?.item?.rarity === "epic") { beep(523, 120); beep(659, 120, 130); beep(784, 220, 260); }
      else if (best?.item) beep(660, 160);
      else beep(220, 200);
    }, 1500);
  }

  function draw(count: 1 | 10) {
    if (busyRef.current || phase !== "idle") return;
    const cost = count === 1 ? COST_ONE : COST_TEN;
    if (save.coins < cost) {
      showToast("코인이 부족해요! 옆의 ⚔️배틀에서 이기면 코인을 듬뿍 받아요!");
      beep(180, 150);
      return;
    }
    animateAndReveal((s) => runDraws(count, s), { ...save, coins: save.coins - cost });
  }

  function drawTicket() {
    if (busyRef.current || phase !== "idle" || save.tickets <= 0) return;
    animateAndReveal((s) => runGuaranteed(s, "ticket"), { ...save, tickets: save.tickets - 1 });
  }

  function drawShard() {
    if (busyRef.current || phase !== "idle" || save.shards < SHARD_COST) return;
    animateAndReveal((s) => runGuaranteed(s, "shard"), { ...save, shards: save.shards - SHARD_COST });
  }

  function handleBattleEnd(r: BattleResult) {
    setSave((s) => ({
      ...s,
      coins: s.coins + r.coins,
      tickets: s.tickets + (r.ticket ? 1 : 0),
      battleWins: s.battleWins + (r.win ? 1 : 0),
    }));
    showToast(
      r.win
        ? `⚔️ ${r.monsterName} 승리! 🪙${r.coins}${r.ticket ? " + 🎫보너스 뽑기권" : ""}`
        : `${r.monsterName}에게 졌어요… 위로 코인 🪙${r.coins}`
    );
  }

  async function handleCloudSave() {
    if (!name.trim() || code.length !== 4) { setCloudMsg("이름과 숫자 4자리 비밀코드를 넣어주세요"); return; }
    localStorage.setItem(LS_PROFILE, JSON.stringify({ name: name.trim(), code }));
    const ok = await cloudSave(name.trim(), code, save);
    setCloudMsg(ok ? "☁️ 클라우드에 저장했어요! 다른 기기에서도 불러올 수 있어요" : "지금은 이 기기에만 저장돼요 (클라우드 연결 대기 중)");
  }

  async function handleCloudLoad() {
    if (!name.trim() || code.length !== 4) { setCloudMsg("이름과 숫자 4자리 비밀코드를 넣어주세요"); return; }
    const data = await cloudLoad(name.trim(), code);
    if (!data) { setCloudMsg("저장된 기록을 못 찾았어요. 이름과 비밀코드를 확인해주세요"); return; }
    localStorage.setItem(LS_PROFILE, JSON.stringify({ name: name.trim(), code }));
    setSave({
      coins: data.coins,
      shards: data.shards,
      tickets: data.tickets,
      battleWins: data.battleWins,
      inventory: data.inventory,
      totalDraws: data.totalDraws,
      missStreak: 0,
    });
    setCloudMsg("☁️ 불러오기 완료! 집이 돌아왔어요 🏠");
  }

  function resetAll() {
    if (!confirm("정말 처음부터 다시 시작할까요? 모은 아이템이 사라져요!")) return;
    setSave(INITIAL);
    setResults([]);
    setPhase("idle");
    showToast("새 게임이 시작됐어요!");
  }

  const bestReveal = results.filter((x) => x.item).sort((a, b) => {
    const order: Rarity[] = ["common", "rare", "epic", "legend"];
    return order.indexOf(b.item!.rarity) - order.indexOf(a.item!.rarity);
  })[0];
  const revealColor = bestReveal?.item ? RARITY_COLOR[bestReveal.item.rarity] : "#78909c";

  return (
    <main className="mx-auto max-w-5xl px-3 pb-10">
      <header className="pt-5 text-center">
        <h1 className="text-4xl font-black tracking-tight text-white drop-shadow-[2px_2px_0_rgba(0,0,0,0.35)]" style={{ WebkitTextStroke: "1px #3e2723" }}>
          🎁 뽑기 하우스
        </h1>
        <p className="mt-1 font-bold text-[#2e5b1e]">쿠키런처럼 뽑고, 배틀로 코인을 모아, 3D 블록 하우스를 꾸며보자!</p>
      </header>

      {/* 상태 바 */}
      <section className="pixel-border wood-bg mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-lg px-4 py-2 text-base font-black text-white sm:text-lg" style={{ textShadow: "1px 1px 0 #3e2723" }}>
        <span>🪙 {save.coins}</span>
        <span>⭐별조각 {save.shards}</span>
        <span>🎫 뽑기권 {save.tickets}</span>
        <span>🎲 뽑기 {save.totalDraws}회</span>
        <span>⚔️ 승리 {save.battleWins}</span>
        <span>📦 {ownedCount}/{ITEMS.length}</span>
        <span>🏠 {progress}%</span>
      </section>
      <div className="mt-2 h-5 overflow-hidden rounded border-2 border-[#3e2723] bg-white/70">
        <div className="h-full transition-all duration-700" style={{ width: `${progress}%`, background: "repeating-linear-gradient(90deg,#66bb4a 0 16px,#57a83e 16px 32px)" }} />
      </div>
      {progress === 100 && <p className="pop-in mt-2 text-center text-xl font-black text-[#b8860b]">🎉 와! 집 완성! 최고의 집 꾸미기 대장! 🎉</p>}
      {toast && <p className="pop-in mt-2 text-center text-lg font-black text-[#c62828]">{toast}</p>}

      {/* 뽑기 + 배틀 */}
      <div className="mt-4 grid items-stretch gap-4 lg:grid-cols-[1fr_360px]">
        <section className="pixel-border rounded-lg bg-[#ffecb3] px-4 py-5 text-center">
          <h2 className="text-2xl font-black">🍪 행운의 뽑기 오븐</h2>
          <div className="relative mx-auto mt-2 h-44 w-64">
            <div className="absolute left-1/2 top-0 h-32 w-56 -translate-x-1/2 overflow-hidden rounded-t-full border-4 border-[#3e2723] bg-[#b3e5fc]/70">
              <div className="flex flex-wrap justify-center gap-1 p-3 text-3xl">
                {["🔴", "🟢", "🔵", "🟡", "🟣", "🟠", "🔴", "🟢", "🔵", "🟡", "🟣", "🟠"].map((c, i) => (
                  <span key={i}>{c}</span>
                ))}
              </div>
            </div>
            <div className="pixel-border absolute bottom-0 left-1/2 flex h-12 w-64 -translate-x-1/2 items-center justify-center rounded bg-[#d84315]">
              <span className="font-black text-white" style={{ textShadow: "1px 1px 0 #000" }}>✨ 무엇이 나올까? ✨</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <button onClick={() => draw(1)} disabled={phase !== "idle"} className="pixel-btn rounded-lg bg-[#66bb4a] px-6 py-3 text-xl font-black text-white">
              🎁 1회 뽑기 (🪙{COST_ONE})
            </button>
            <button onClick={() => draw(10)} disabled={phase !== "idle"} className="pixel-btn rounded-lg bg-[#fb8c00] px-6 py-3 text-xl font-black text-white">
              🎁 10회 뽑기 (🪙{COST_TEN})
            </button>
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <button onClick={drawTicket} disabled={phase !== "idle" || save.tickets <= 0} className="pixel-btn rounded-lg bg-[#ab47bc] px-4 py-2 font-black text-white">
              🎫 보너스 뽑기 (뽑기권 {save.tickets}장) — 무조건 희귀 이상!
            </button>
            <button onClick={drawShard} disabled={phase !== "idle" || save.shards < SHARD_COST} className="pixel-btn rounded-lg bg-[#5e35b1] px-4 py-2 font-black text-white">
              ⭐ 별조각 {SHARD_COST}개로 확정 뽑기 (보유 {save.shards})
            </button>
          </div>
          <p className="mt-3 text-sm font-bold leading-6 text-[#6d4c41]">
            쿠키런처럼 중복이 나오면 ⭐별조각으로 쌓여요. 별조각 5개면 아직 없는 물건을 확정으로 뽑아요!<br />
            가끔 빈 캡슐(꽝)도 나와요 — 위로 코인 5개, 3연속 꽝은 절대 없어요. 코인이 부족하면 옆의 ⚔️배틀에서 벌어오세요!
          </p>
        </section>

        <BattlePanel inventory={save.inventory} onBattleEnd={handleBattleEnd} />
      </div>

      {/* 3D 집 */}
      <section className="mt-6">
        <h2 className="text-center text-3xl font-black text-white drop-shadow-[2px_2px_0_rgba(0,0,0,0.35)]" style={{ WebkitTextStroke: "1px #3e2723" }}>🏡 나의 3D 블록 하우스</h2>
        <div className="mt-3">
          <House3D inventory={save.inventory} />
        </div>
        {ownedCount === 0 && <p className="text-center font-bold text-[#2e5b1e]">아직 빈 집이에요. 뽑기로 첫 가구를 뽑아보세요!</p>}
      </section>

      {/* 도감 */}
      <section className="pixel-border mt-6 rounded-lg bg-white/95 px-4 py-4">
        <h2 className="text-xl font-black">📖 물건 도감 ({ownedCount}/{ITEMS.length})</h2>
        <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {ITEMS.map((item) => {
            const owned = (save.inventory[item.id] ?? 0) > 0;
            return (
              <div key={item.id} className="rounded-lg border-2 p-2 text-center" style={{ borderColor: owned ? RARITY_COLOR[item.rarity] : "#ddd" }}>
                <div className={`text-3xl ${owned ? "" : "slot-empty"}`}>{owned ? item.emoji : "❓"}</div>
                <div className="mt-0.5 truncate text-[11px] font-black">{owned ? item.name : "???"}</div>
                <div className="text-[10px] font-bold" style={{ color: RARITY_COLOR[item.rarity] }}>{RARITY_LABEL[item.rarity]}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 클라우드 저장 */}
      <section className="pixel-border mt-6 rounded-lg bg-[#e3f2fd] px-4 py-4">
        <h2 className="text-xl font-black">☁️ 내 집 저장하기</h2>
        <p className="mt-1 text-sm font-bold text-gray-700">이름과 비밀코드(숫자 4자리)를 정하면, 다른 기기에서도 내 집을 불러올 수 있어요. 평소에는 이 기기에 자동 저장돼요.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="내 이름" maxLength={12} className="w-32 rounded border-2 border-[#3e2723] px-3 py-2 font-bold" />
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="비밀코드 4자리" inputMode="numeric" className="w-36 rounded border-2 border-[#3e2723] px-3 py-2 font-bold" />
          <button onClick={handleCloudSave} className="pixel-btn rounded-lg bg-[#66bb4a] px-4 py-2 font-black text-white">저장하기</button>
          <button onClick={handleCloudLoad} className="pixel-btn rounded-lg bg-[#42a5f5] px-4 py-2 font-black text-white">불러오기</button>
        </div>
        {cloudMsg && <p className="mt-2 font-bold">{cloudMsg}</p>}
        <button onClick={resetAll} className="mt-4 text-sm font-bold text-red-500 underline">처음부터 다시 하기</button>
      </section>

      <footer className="mt-6 text-center text-sm font-bold text-[#2e5b1e]">
        전설 등급 확률은 5%! 드래곤 알을 뽑으면 대단한 행운이에요 🐉 보스 크리퍼를 이기면 보너스 뽑기권!
      </footer>

      {/* ── 쿠키런식 뽑기 연출 오버레이 ── */}
      {phase !== "idle" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#1a1033]/95 p-4">
          {phase === "rolling" ? (
            <div className="relative text-center">
              <div className="rays absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full" />
              <div className="glow-pulse relative text-[120px] leading-none">🎁</div>
              <p className="relative mt-4 text-3xl font-black text-white">두근두근…</p>
              <p className="relative mt-1 text-lg font-bold text-[#ce93d8]">행운의 오븐이 구워지는 중!</p>
            </div>
          ) : (
            <div className="relative w-full max-w-2xl py-6 text-center">
              <div className="rays pointer-events-none absolute left-1/2 top-24 h-[420px] w-[420px] -translate-x-1/2 rounded-full opacity-70" style={{ background: `repeating-conic-gradient(from 0deg, ${revealColor}55 0deg 10deg, transparent 10deg 24deg)` }} />
              <h2 className="pop-in relative text-4xl font-black text-white drop-shadow-[3px_3px_0_rgba(0,0,0,0.6)]">
                {bestReveal?.item?.rarity === "legend" ? "🎉 전설이다!! 🎉" : bestReveal?.item?.rarity === "epic" ? "✨ 슈퍼희귀!! ✨" : bestReveal ? "🎊 뽑기 결과 🎊" : "🥚💨 앗, 빈 캡슐…"}
              </h2>
              <div className={`relative mt-5 grid gap-3 ${results.length > 1 ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-1 place-items-center"}`}>
                {results.map((r, i) =>
                  r.item ? (
                    <div key={i} className="pop-in w-full rounded-2xl border-4 bg-white p-3 text-center shadow-[0_0_35px_rgba(255,255,255,0.35)]" style={{ borderColor: RARITY_COLOR[r.item.rarity], animationDelay: `${i * 0.12}s` }}>
                      <div className={results.length === 1 ? "text-8xl" : "text-5xl"}>{r.item.emoji}</div>
                      <div className="mt-1 font-black">{r.item.name}</div>
                      <div className="inline-block rounded-full px-2 py-0.5 text-sm font-black text-white" style={{ background: RARITY_COLOR[r.item.rarity] }}>
                        {RARITY_LABEL[r.item.rarity]}
                      </div>
                      <div className="mt-1 text-xs font-black text-[#6d4c41]">
                        {r.special ? r.special : r.isNew ? "🆕 새 물건! 3D 집에 놓았어요" : "중복!"}
                      </div>
                      {results.length === 1 && <p className="mt-1 text-sm text-gray-600">{r.item.desc}</p>}
                    </div>
                  ) : (
                    <div key={i} className="pop-in w-full rounded-2xl border-4 border-gray-400 bg-[#eceff1] p-3 text-center" style={{ animationDelay: `${i * 0.12}s` }}>
                      <div className={results.length === 1 ? "text-8xl" : "text-5xl"}>🥚💨</div>
                      <div className="mt-1 font-black text-gray-500">{r.special ?? "빈 캡슐… 꽝!"}</div>
                      {!r.special && <div className="text-sm font-bold text-gray-500">위로 코인 🪙5</div>}
                    </div>
                  )
                )}
              </div>
              {results.length > 1 && (
                <p className="relative mt-4 font-black text-white">
                  🆕 새 물건 {results.filter((r) => r.isNew).length}개 · ⭐별조각 {results.reduce((s, r) => s + (r.isDup ? (r.item?.rarity === "legend" ? 3 : 1) : 0), 0)}개 · 꽝 {results.filter((r) => !r.item).length}개
                </p>
              )}
              <button onClick={() => setPhase("idle")} className="pixel-btn relative mt-5 rounded-lg bg-[#66bb4a] px-8 py-3 text-xl font-black text-white">확인 👍</button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
