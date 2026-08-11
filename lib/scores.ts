import { createClient } from "@/lib/supabase/client";

export interface SaveScoreInput {
  gameId: string;
  name: string;
  score: number;
}

export async function saveScore({
  gameId,
  name,
  score,
}: SaveScoreInput): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("scores")
    .insert({ game_id: gameId, user_id: null, name, score });
}
