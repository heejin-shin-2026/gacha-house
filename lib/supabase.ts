import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
let tried = false;

/** 브라우저용 anon 키 클라이언트. 환경변수가 없으면 null (로컬 저장만 사용) */
export function supabase(): SupabaseClient | null {
  if (tried) return client;
  tried = true;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  client = createClient(url, key);
  return client;
}

export interface SaveData {
  coins: number;
  inventory: Record<string, number>;
  totalDraws: number;
}

/** 이름+비밀코드로 클라우드에 저장. 성공하면 true */
export async function cloudSave(name: string, code: string, data: SaveData): Promise<boolean> {
  const sb = supabase();
  if (!sb) return false;
  const { error } = await sb.from("gacha_saves").upsert(
    {
      player_name: name,
      player_code: code,
      coins: data.coins,
      inventory: data.inventory,
      total_draws: data.totalDraws,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "player_name,player_code" }
  );
  return !error;
}

/** 이름+비밀코드로 불러오기. 없으면 null */
export async function cloudLoad(name: string, code: string): Promise<SaveData | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("gacha_saves")
    .select("coins, inventory, total_draws")
    .eq("player_name", name)
    .eq("player_code", code)
    .maybeSingle();
  if (error || !data) return null;
  return {
    coins: data.coins,
    inventory: (data.inventory ?? {}) as Record<string, number>,
    totalDraws: data.total_draws ?? 0,
  };
}
