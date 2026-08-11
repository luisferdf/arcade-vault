import { createClient } from "@/lib/supabase/server";
import type { Game, ScoreEntry } from "@/lib/games-types";

export type { Game, ScoreEntry } from "@/lib/games-types";
export { CATS } from "@/lib/games-types";

function formatPlays(count: number): string {
  if (count >= 1000) return (count / 1000).toFixed(1) + "K";
  return String(count);
}

function formatDate(createdAt: string): string {
  const d = new Date(createdAt);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}

export async function getGames(): Promise<Game[]> {
  const supabase = await createClient();
  const [{ data: games }, { data: scores }] = await Promise.all([
    supabase.from("games").select("*").eq("available", true).order("id"),
    supabase.from("scores").select("game_id, score"),
  ]);

  const stats = new Map<string, { best: number; plays: number }>();
  for (const s of scores ?? []) {
    const cur = stats.get(s.game_id) ?? { best: 0, plays: 0 };
    cur.plays += 1;
    if (s.score > cur.best) cur.best = s.score;
    stats.set(s.game_id, cur);
  }

  return (games ?? []).map((g) => {
    const s = stats.get(g.id) ?? { best: 0, plays: 0 };
    return { ...g, best: s.best, plays: formatPlays(s.plays) };
  });
}

export async function getGameById(id: string): Promise<Game | null> {
  const supabase = await createClient();
  const { data: game } = await supabase
    .from("games")
    .select("*")
    .eq("id", id)
    .eq("available", true)
    .maybeSingle();
  if (!game) return null;

  const { data: scores } = await supabase
    .from("scores")
    .select("score")
    .eq("game_id", id);
  const values = (scores ?? []).map((s) => s.score);
  const best = values.length ? Math.max(...values) : 0;

  return { ...game, best, plays: formatPlays(values.length) };
}

export async function getTopScoresByGame(
  gameId: string,
  limit = 10,
): Promise<ScoreEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("scores")
    .select("name, score, created_at, game_id, games!inner(title, available)")
    .eq("game_id", gameId)
    .eq("games.available", true)
    .order("score", { ascending: false })
    .limit(limit);

  return (data ?? []).map((s, i) => ({
    rank: i + 1,
    name: s.name,
    score: s.score,
    date: formatDate(s.created_at),
    gameId: s.game_id,
    gameTitle: (s.games as unknown as { title: string }).title,
  }));
}

export async function getGlobalTopScores(limit = 30): Promise<ScoreEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("scores")
    .select("name, score, created_at, game_id, games!inner(title, available)")
    .eq("games.available", true)
    .order("score", { ascending: false })
    .limit(limit);

  return (data ?? []).map((s, i) => ({
    rank: i + 1,
    name: s.name,
    score: s.score,
    date: formatDate(s.created_at),
    gameId: s.game_id,
    gameTitle: (s.games as unknown as { title: string }).title,
  }));
}
