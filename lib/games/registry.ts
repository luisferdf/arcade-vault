import type { GameEngineEntry } from "./engine";
import { AsteroidsGame, W as ASTEROIDS_W, H as ASTEROIDS_H } from "./asteroids";

/**
 * Juegos con motor real, indexados por el `id` de la tabla `games` de Supabase.
 * Los que no aparecen aquí usan el `game-arena` simulado del Reproductor.
 *
 * Añadir un juego nuevo es añadir una entrada a este mapa: el Reproductor no
 * necesita saber de qué juego se trata.
 */
export const GAME_ENGINES: Record<string, GameEngineEntry> = {
  asteroides: {
    width: ASTEROIDS_W,
    height: ASTEROIDS_H,
    usesLives: true,
    create: (ctx, callbacks) => new AsteroidsGame(ctx, callbacks),
  },
};

export function getEngine(id: string | undefined): GameEngineEntry | null {
  if (!id) return null;
  return GAME_ENGINES[id] ?? null;
}
