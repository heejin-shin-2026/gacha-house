"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ITEMS, RARITY_COLOR, RARITY_LABEL, RARITY_WEIGHT, ZONE_LABEL, Item, Rarity, Zone } from "@/lib/items";
import { cloudLoad, cloudSave } from "@/lib/supabase";

const COST_ONE = 20;
const COST_TEN = 180;
const MISS_RATE = 0.25; // 안 얻기(꽝) 확률 25%
const LS_KEY = "gacha-house-save-v1";
const LS_PROFILE = "gacha-house-profile-v1";

interface DrawResult {
  item: Item | null; // null = 꽝
  isNew: boolean;
  isDup: boolean;
  guaranteed?: boolean;
}

interface SaveState {
  coins: number;
  inventory: Record<string, number>;
  totalDraws: number;
  missStreak: number;
}

const INITIAL: SaveState = { coins: 100, inventory: {}, totalDraws: 0, missStreak: 0 };

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

/** 작은 효과음 (WebAudio) */
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
  } catch {
    /* 소리 실패는 무시 */
  }
}

export default function Home() {
  const [save, setSave] = useState<SaveState>(INITIAL);
  const [loaded, setLoaded] = useState(false);
  const [phase, setPhase] = useState<"idle" | "shaking" | "reveal">("idle");
  const [results, setResults] = useState<DrawResult[]>([]);
  const [toast, setToast] = useState("");
  const [chestReadyAt, setChestReadyAt] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [cloudMsg, setCloudMsg] = useState("");
  const busyRef = useRef(false);

  // ── 로컬 저장 불러오기/저장 ──
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

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const ownedCount = useMemo(() => Object.keys(save.inventory).filter((k) => save.inventory[k] > 0).length, [save.inventory]);
  const progress = Math.round((ownedCount / ITEMS.length) * 100);
  const chestLeft = Math.max(0, Math.ceil((chestReadyAt - nowTick) / 1000));

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  }

  function doDraws(count: number, state: SaveState): { results: DrawResult[]; next: SaveState } {
    const next: SaveState = { ...state, inventory: { ...state.inventory } };
    const out: DrawResult[] = [];
    for (let i = 0; i < count; i++) {
      const isLastOfTen = count === 10 && i === count - 1;
      const guaranteed = next.missStreak >= 2 || isLastOfTen; // 3연속 꽝 방지 + 10연차 마지막 보장
      const miss = !guaranteed && Math.random() < MISS_RATE;
      next.totalDraws += 1;
      if (miss) {
        next.missStreak += 1;
        next.coins += 5; // 위로 코인
        out.push({ item: null, isNew: false, isDup: false });
        continue;
      }
      next.missStreak = 0;
      const item = rollItem(isLastOfTen ? "rare" : undefined);
      const had = (next.inventory[item.id] ?? 0) > 0;
      if (had) {
        next.coins += 15; // 중복은 코인으로 교환
        out.push({ item, isNew: false, isDup: true, guaranteed });
      } else {
        next.inventory[item.id] = 1;
        out.push({ item, isNew: true, isDup: false, guaranteed });
      }
    }
    return { results: out, next };
  }

  function draw(count: 1 | 10) {
    if (busyRef.current || phase === "shaking") return;
    const cost = count === 1 ? COST_ONE : COST_TEN;
    if (save.coins < cost) {
      showToast(`코인이 부족해요! 아래 코인 상자를 열어보세요 🪙`);
      beep(180, 150);
      return;
    }
    busyRef.current = true;
    setPhase("shaking");
    beep(300, 80); beep(350, 80, 150); beep(300, 80, 300);
    const afterCost: SaveState = { ...save, coins: save.coins - cost };
    setTimeout(() => {
      const { results: r, next } = doDraws(count, afterCost);
      setSave(next);
      setResults(r);
      setPhase("reveal");
      busyRef.current = false;
      const best = r.filter((x) => x.item).sort((a, b) => {
        const order: Rarity[] = ["common", "rare", "epic", "legend"];
        return order.indexOf(b.item!.rarity) - order.indexOf(a.item!.rarity);
      })[0];
      if (best?.item?.rarity === "legend") { beep(523, 120); beep(659, 120, 130); beep(784, 200, 260); }
      else if (best?.item) beep(660, 150);
      else beep(220, 200);
    }, 1100);
  }

  function openChest() {
    if (chestLeft > 0) return;
    setSave((s) => ({ ...s, coins: s.coins + 50 }));
    setChestReadyAt(Date.now() + 20_000);
    showToast("코인 50개를 얻었어요! 🪙✨");
    beep(523, 100); beep(784, 150, 110);
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
    setSave({ coins: data.coins, inventory: data.inventory, totalDraws: data.totalDraws, missStreak: 0 });
    setCloudMsg("☁️ 불러오기 완료! 집이 돌아왔어요 🏠");
  }

  function resetAll() {
    if (!confirm("정말 처음부터 다시 시작할까요? 모은 아이템이 사라져요!")) return;
    setSave(INITIAL);
    setResults([]);
    setPhase("idle");
    showToast("새 게임이 시작됐어요!");
  }

  const zones: Zone[] = ["room", "shelf", "yard"];

  return (
    <main className="mx-auto max-w-3xl px-3 pb-10">
      {/* 헤더 */}
      <header className="pt-5 text-center">
        <h1 className="text-4xl font-black tracking-tight drop-shadow-[2px_2px_0_rgba(0,0,0,0.35)] text-white" style={{ WebkitTextStroke: "1px #3e2723" }}>
          🎁 뽑기 하우스
        </h1>
        <p className="mt-1 font-bold text-[#2e5b1e]">뽑기로 도구와 가구를 모아 블록 하우스를 꾸며보자!</p>
      </header>

      {/* 상태 바 */}
      <section className="pixel-border wood-bg mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 rounded-lg px-4 py-2 text-lg font-black text-white" style={{ textShadow: "1px 1px 0 #3e2723" }}>
        <span>🪙 코인 {save.coins}</span>
        <span>🎲 뽑은 횟수 {save.totalDraws}</span>
        <span>📦 모은 물건 {ownedCount}/{ITEMS.length}</span>
        <span>🏠 집 완성도 {progress}%</span>
      </section>
      <div className="mt-2 h-5 overflow-hidden rounded border-2 border-[#3e2723] bg-white/70">
        <div className="h-full transition-all duration-700" style={{ width: `${progress}%`, background: "repeating-linear-gradient(90deg,#66bb4a 0 16px,#57a83e 16px 32px)" }} />
      </div>
      {progress === 100 && <p className="pop-in mt-2 text-center text-xl font-black text-[#b8860b]">🎉 와! 집 완성! 최고의 집 꾸미기 대장! 🎉</p>}

      {/* 뽑기 기계 */}
      <section className="pixel-border mt-4 rounded-lg bg-[#ffecb3] px-4 py-5 text-center">
        <div className={`relative mx-auto h-44 w-64 ${phase === "shaking" ? "shaking" : ""}`}>
          {/* 유리 돔 */}
          <div className="absolute left-1/2 top-0 h-32 w-56 -translate-x-1/2 overflow-hidden rounded-t-full border-4 border-[#3e2723] bg-[#b3e5fc]/70">
            <div className="flex flex-wrap justify-center gap-1 p-3 text-3xl">
              {["🔴", "🟢", "🔵", "🟡", "🟣", "🟠", "🔴", "🟢", "🔵", "🟡", "🟣", "🟠"].map((c, i) => (
                <span key={i} className={phase === "shaking" ? "bounce-soft" : ""} style={{ animationDelay: `${i * 0.12}s` }}>{c}</span>
              ))}
            </div>
          </div>
          {/* 기계 몸통 */}
          <div className="absolute bottom-0 left-1/2 h-12 w-64 -translate-x-1/2 rounded bg-[#d84315] pixel-border flex items-center justify-center">
            <span className="font-black text-white" style={{ textShadow: "1px 1px 0 #000" }}>
              {phase === "shaking" ? "두근두근… 섞는 중!" : "✨ 행운의 뽑기 기계 ✨"}
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <button onClick={() => draw(1)} disabled={phase === "shaking"} className="pixel-btn rounded-lg bg-[#66bb4a] px-6 py-3 text-xl font-black text-white">
            🎁 1번 뽑기 (🪙{COST_ONE})
          </button>
          <button onClick={() => draw(10)} disabled={phase === "shaking"} className="pixel-btn rounded-lg bg-[#fb8c00] px-6 py-3 text-xl font-black text-white">
            🎁🎁 10번 뽑기 (🪙{COST_TEN})
          </button>
        </div>
        <p className="mt-2 text-sm font-bold text-[#6d4c41]">
          가끔은 빈 캡슐(꽝)도 나와요 😢 그래도 위로 코인 5개! 3번 연속 꽝은 절대 없어요. 10번 뽑기의 마지막은 무조건 희귀 이상 보장!
        </p>
        <button onClick={openChest} disabled={chestLeft > 0} className="pixel-btn mt-2 rounded-lg bg-[#5e35b1] px-5 py-2 font-black text-white">
          {chestLeft > 0 ? `🎁 코인 상자 준비 중… ${chestLeft}초` : "🎁 코인 상자 열기 (+🪙50)"}
        </button>
        {toast && <p className="pop-in mt-3 text-lg font-black text-[#c62828]">{toast}</p>}
      </section>

      {/* 결과 발표 */}
      {phase === "reveal" && results.length > 0 && (
        <section className="pixel-border mt-4 rounded-lg bg-white px-4 py-4">
          <h2 className="text-center text-2xl font-black">🎊 뽑기 결과 🎊</h2>
          <div className={`mt-3 grid gap-2 ${results.length > 1 ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-1 place-items-center"}`}>
            {results.map((r, i) =>
              r.item ? (
                <div key={i} className="pop-in w-full rounded-lg border-4 p-3 text-center" style={{ borderColor: RARITY_COLOR[r.item.rarity], animationDelay: `${i * 0.08}s` }}>
                  <div className="text-5xl">{r.item.emoji}</div>
                  <div className="mt-1 font-black">{r.item.name}</div>
                  <div className="text-sm font-bold" style={{ color: RARITY_COLOR[r.item.rarity] }}>
                    {RARITY_LABEL[r.item.rarity]} 등급
                  </div>
                  <div className="mt-1 text-xs font-bold">
                    {r.isNew ? "🆕 새 물건! 집에 놓았어요" : "중복! 🪙15개로 바꿨어요"}
                    {r.guaranteed && r.isNew ? " (행운 보장!)" : ""}
                  </div>
                  {results.length === 1 && <p className="mt-1 text-sm text-gray-600">{r.item.desc}</p>}
                </div>
              ) : (
                <div key={i} className="pop-in w-full rounded-lg border-4 border-gray-300 bg-gray-50 p-3 text-center" style={{ animationDelay: `${i * 0.08}s` }}>
                  <div className="text-5xl">🥚💨</div>
                  <div className="mt-1 font-black text-gray-500">빈 캡슐… 꽝!</div>
                  <div className="text-sm font-bold text-gray-500">위로 코인 🪙5개 받았어요</div>
                </div>
              )
            )}
          </div>
          <div className="mt-3 text-center">
            <button onClick={() => setPhase("idle")} className="pixel-btn rounded-lg bg-[#42a5f5] px-6 py-2 font-black text-white">확인 👍</button>
          </div>
        </section>
      )}

      {/* 내 집 */}
      <section className="mt-6">
        <h2 className="text-center text-3xl font-black text-white drop-shadow-[2px_2px_0_rgba(0,0,0,0.35)]" style={{ WebkitTextStroke: "1px #3e2723" }}>🏡 나의 블록 하우스</h2>
        {/* 지붕 */}
        <div className="mx-auto mt-3 max-w-xl">
          <div className="roof-block mx-auto h-5 w-2/5 border-x-4 border-t-4 border-[#3e2723]" />
          <div className="roof-block mx-auto h-5 w-3/5 border-x-4 border-[#3e2723]" />
          <div className="roof-block mx-auto h-5 w-4/5 border-x-4 border-[#3e2723]" />
        </div>
        <div className="pixel-border wood-bg mx-auto max-w-xl rounded-b-lg px-3 pb-3 pt-2">
          {zones.slice(0, 2).map((zone) => (
            <div key={zone} className="mt-2">
              <h3 className="font-black text-white" style={{ textShadow: "1px 1px 0 #3e2723" }}>{ZONE_LABEL[zone]}</h3>
              <div className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {ITEMS.filter((i) => i.zone === zone).map((item) => {
                  const owned = (save.inventory[item.id] ?? 0) > 0;
                  return (
                    <div key={item.id} className="rounded border-[3px] bg-[#fff8e1]/90 p-1 text-center" style={{ borderColor: owned ? RARITY_COLOR[item.rarity] : "#8d6e63" }} title={owned ? item.desc : "아직 못 모았어요"}>
                      <div className={`text-3xl ${owned ? "" : "slot-empty"}`}>{item.emoji}</div>
                      <div className="truncate text-[11px] font-black">{owned ? item.name : "???"}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {/* 마당 */}
        <div className="mx-auto max-w-xl">
          <div className="grass-strip px-3 pb-2 pt-2">
            <h3 className="font-black text-white" style={{ textShadow: "1px 1px 0 #2e5b1e" }}>{ZONE_LABEL.yard}</h3>
            <div className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {ITEMS.filter((i) => i.zone === "yard").map((item) => {
                const owned = (save.inventory[item.id] ?? 0) > 0;
                return (
                  <div key={item.id} className="rounded border-[3px] bg-[#f1f8e9]/90 p-1 text-center" style={{ borderColor: owned ? RARITY_COLOR[item.rarity] : "#558b2f" }} title={owned ? item.desc : "아직 못 모았어요"}>
                    <div className={`text-3xl ${owned ? "" : "slot-empty"}`}>{item.emoji}</div>
                    <div className="truncate text-[11px] font-black">{owned ? item.name : "???"}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="dirt-strip h-6 rounded-b-lg border-x-4 border-b-4 border-[#3e2723]" />
        </div>
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
        전설 등급 확률은 5%! 드래곤 알을 뽑으면 대단한 행운이에요 🐉
      </footer>
    </main>
  );
}
