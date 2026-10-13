import { createClient } from "@/lib/supabase/client";

export interface SaveScoreInput {
  gameId: string;
  name: string;
  score: number;
}

export type SaveScoreError = "name_reserved" | "profile_required" | "unknown";

export interface SaveScoreResult {
  ok: boolean;
  error?: SaveScoreError;
}

// `user_id` y `name` con sesión los fija el trigger `scores_apply_identity`;
// el cliente no decide su identidad.
export async function saveScore({
  gameId,
  name,
  score,
}: SaveScoreInput): Promise<SaveScoreResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from("scores")
    .insert({ game_id: gameId, name, score });
  if (!error) return { ok: true };
  if (error.message.includes("name_reserved")) {
    return { ok: false, error: "name_reserved" };
  }
  if (error.message.includes("profile_required")) {
    return { ok: false, error: "profile_required" };
  }
  return { ok: false, error: "unknown" };
}
