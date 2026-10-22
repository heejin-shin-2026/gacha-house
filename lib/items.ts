export type Rarity = "common" | "rare" | "epic" | "mythic" | "legend";
export type Zone = "room" | "shelf" | "yard" | "rack";

export interface Item {
  id: string;
  name: string;
  emoji: string;
  rarity: Rarity;
  zone: Zone;
  desc: string;
  /** 무기 공격력 (배틀에서 자동 장착) */
  power?: number;
}

export const RARITY_ORDER: Rarity[] = ["common", "rare", "epic", "mythic", "legend"];

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "일반",
  rare: "희귀",
  epic: "에픽",
  mythic: "신화",
  legend: "전설",
};

export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#9e9e9e",
  rare: "#42a5f5",
  epic: "#ab47bc",
  mythic: "#e53935",
  legend: "#ffb300",
};

/** 뽑기 성공 시 등급 확률 가중치 */
export const RARITY_WEIGHT: Record<Rarity, number> = {
  common: 52,
  rare: 28,
  epic: 12,
  mythic: 5.5,
  legend: 2.5,
};

/** 전체 36종 — 가구·도구·보물 24종 + 무기 12종 */
export const ITEMS: Item[] = [
  // ── 방 안 가구 (room) 12종 ──
  { id: "chair", name: "나무 의자", emoji: "🪑", rarity: "common", zone: "room", desc: "앉으면 삐걱삐걱 소리가 나요" },
  { id: "desk", name: "공부 책상", emoji: "📚", rarity: "common", zone: "room", desc: "숙제할 때 쓰는 책상 (책 포함!)" },
  { id: "clock", name: "벽시계", emoji: "🕰️", rarity: "common", zone: "room", desc: "똑딱똑딱 시간을 알려줘요" },
  { id: "carpet", name: "빨간 양탄자", emoji: "🟥", rarity: "common", zone: "room", desc: "폭신폭신한 바닥 친구" },
  { id: "plant", name: "화분", emoji: "🪴", rarity: "common", zone: "room", desc: "물을 주면 쑥쑥 자라요" },
  { id: "sofa", name: "푹신 소파", emoji: "🛋️", rarity: "rare", zone: "room", desc: "앉으면 푹 꺼지는 마법 소파" },
  { id: "bed", name: "아늑한 침대", emoji: "🛏️", rarity: "rare", zone: "room", desc: "자고 일어나면 체력이 꽉 차요" },
  { id: "tv", name: "큰 TV", emoji: "📺", rarity: "rare", zone: "room", desc: "만화 채널이 나와요" },
  { id: "fridge", name: "냉장고", emoji: "🧊", rarity: "rare", zone: "room", desc: "안에 케이크가 들어 있을지도?" },
  { id: "lamp", name: "반짝 램프", emoji: "💡", rarity: "rare", zone: "room", desc: "밤에도 환하게 밝혀줘요" },
  { id: "piano", name: "피아노", emoji: "🎹", rarity: "epic", zone: "room", desc: "딩동댕 멋진 소리가 나요" },
  { id: "aquarium", name: "수족관", emoji: "🐠", rarity: "epic", zone: "room", desc: "물고기들이 헤엄쳐요" },
  // ── 진열장 도구·보물 (shelf) 6종 ──
  { id: "torch", name: "횃불", emoji: "🔥", rarity: "common", zone: "shelf", desc: "어두운 동굴도 무섭지 않아요" },
  { id: "woodblock", name: "참나무 블록", emoji: "🟫", rarity: "common", zone: "shelf", desc: "집 짓기의 기본 재료" },
  { id: "fishing", name: "낚싯대", emoji: "🎣", rarity: "rare", zone: "shelf", desc: "보물 낚시에 도전!" },
  { id: "pickaxe", name: "다이아 곡괭이", emoji: "⛏️", rarity: "epic", zone: "shelf", desc: "어떤 돌도 캘 수 있어요" },
  { id: "diamond", name: "다이아몬드 블록", emoji: "💎", rarity: "legend", zone: "shelf", desc: "반짝반짝 최고의 보물!" },
  { id: "dragonegg", name: "드래곤 알", emoji: "🥚", rarity: "legend", zone: "shelf", desc: "언젠가 드래곤이 태어날 거예요" },
  // ── 마당 (yard) 6종 ──
  { id: "flower", name: "꽃밭", emoji: "🌷", rarity: "common", zone: "yard", desc: "나비가 놀러 와요" },
  { id: "mailbox", name: "우체통", emoji: "📬", rarity: "common", zone: "yard", desc: "편지가 도착했어요" },
  { id: "stoneblock", name: "돌 블록", emoji: "🪨", rarity: "common", zone: "yard", desc: "단단해서 계단으로 딱!" },
  { id: "tree", name: "큰 나무", emoji: "🌳", rarity: "rare", zone: "yard", desc: "그늘에서 낮잠 자기 좋아요" },
  { id: "tent", name: "캠핑 텐트", emoji: "⛺", rarity: "rare", zone: "yard", desc: "마당에서 캠핑 놀이!" },
  { id: "enchant", name: "마법 부여대", emoji: "📖", rarity: "mythic", zone: "yard", desc: "책이 혼자 펄럭여요. 마법이다!" },
  // ── 무기 (rack) 12종 — 배틀에서 가장 강한 무기가 자동 장착돼요 ──
  { id: "woodsword", name: "나무 검", emoji: "🗡️", rarity: "common", zone: "rack", desc: "첫 모험의 친구", power: 3 },
  { id: "stonesword", name: "돌 검", emoji: "🔪", rarity: "common", zone: "rack", desc: "나무보다 단단해요", power: 4 },
  { id: "woodbow", name: "나무 활", emoji: "🏹", rarity: "common", zone: "rack", desc: "멀리서도 맞힐 수 있어요", power: 3 },
  { id: "ironsword", name: "철 검", emoji: "⚔️", rarity: "rare", zone: "rack", desc: "번쩍번쩍 날이 섰어요", power: 7 },
  { id: "ironaxe", name: "철 도끼", emoji: "🪓", rarity: "rare", zone: "rack", desc: "한 방이 묵직해요", power: 8 },
  { id: "goldbow", name: "황금 활", emoji: "🎯", rarity: "rare", zone: "rack", desc: "황금 화살이 슝슝", power: 8 },
  { id: "diasword", name: "다이아 검", emoji: "💠", rarity: "epic", zone: "rack", desc: "다이아몬드로 만든 검!", power: 13 },
  { id: "trident", name: "삼지창", emoji: "🔱", rarity: "epic", zone: "rack", desc: "바다 왕의 무기", power: 14 },
  { id: "netherite", name: "네더라이트 검", emoji: "🌋", rarity: "mythic", zone: "rack", desc: "용암에서도 안 타는 최강 금속", power: 20 },
  { id: "magicwand", name: "마법 지팡이", emoji: "🪄", rarity: "mythic", zone: "rack", desc: "별빛 마법을 쏴요", power: 22 },
  { id: "dragonslayer", name: "드래곤 슬레이어", emoji: "🐲", rarity: "legend", zone: "rack", desc: "드래곤을 잡던 전설의 검", power: 32 },
  { id: "excalibur", name: "엑스칼리버", emoji: "✨", rarity: "legend", zone: "rack", desc: "왕만 뽑을 수 있다는 빛의 검", power: 35 },
];

export const WEAPONS = ITEMS.filter((i) => i.zone === "rack");
export const FURNITURE = ITEMS.filter((i) => i.zone !== "rack");

export const ZONE_LABEL: Record<Zone, string> = {
  room: "🏠 집 안",
  shelf: "🧰 진열장",
  yard: "🌳 마당",
  rack: "⚔️ 무기 벽",
};
