export interface StoredScoreEntry {
  game: string;
  score: number;
  name: string;
  at: number;
}

const STORAGE_KEY = "av_scores";

export function getStoredScores(): StoredScoreEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function addStoredScore(entry: Omit<StoredScoreEntry, "at">): void {
  if (typeof window === "undefined") return;
  const all = getStoredScores();
  all.push({ ...entry, at: Date.now() });
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}
