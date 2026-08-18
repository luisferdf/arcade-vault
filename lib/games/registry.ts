import type { GameEngineEntry } from "./engine";
import { AsteroidsGame, W as ASTEROIDS_W, H as ASTEROIDS_H } from "./asteroids";
import { TetrisGame, W as TETRIS_W, H as TETRIS_H } from "./tetris";
import { ArkanoidGame, W as ARKANOID_W, H as ARKANOID_H } from "./arkanoid";

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
  tetris: {
    width: TETRIS_W,
    height: TETRIS_H,
    usesLives: false,
    extraStats: [{ key: "lines", label: "LÍNEAS" }],
    create: (ctx, callbacks) => new TetrisGame(ctx, callbacks),
  },
  arkanoid: {
    width: ARKANOID_W,
    height: ARKANOID_H,
    usesLives: true,
    create: (ctx, callbacks) => new ArkanoidGame(ctx, callbacks),
  },
};

export function getEngine(id: string | undefined): GameEngineEntry | null {
  if (!id) return null;
  return GAME_ENGINES[id] ?? null;
}
