/**
 * Contrato común de los motores de juego del Vault.
 *
 * Un motor es un módulo TypeScript puro: no conoce React ni toca el DOM más allá
 * del CanvasRenderingContext2D que recibe por parámetro. El estado del juego
 * (puntuación, vidas, nivel) vive dentro del motor y se comunica hacia la UI por
 * callbacks — el motor es la fuente de verdad, el HUD del Reproductor es una vista.
 */

export interface GameCallbacks {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
  /** Stats propias del juego que no existen en el HUD base (ej. LÍNEAS en Tetris). */
  onStatChange?: (key: string, value: number) => void;
}

export interface ArcadeGame {
  /** Arranca el loop y registra los listeners de teclado. */
  start(): void;
  /** Congela el loop dejando el estado exactamente como está. */
  pause(): void;
  /** Reanuda sin salto de física (descarta el dt acumulado durante la pausa). */
  resume(): void;
  /** Cancela el loop y remueve los listeners. Obligatorio en el cleanup del efecto. */
  destroy(): void;
}

/** Stat extra que el Reproductor pinta en su HUD, alimentada por `onStatChange`. */
export interface ExtraStat {
  key: string;
  label: string;
}

export interface GameEngineEntry {
  /** Resolución lógica interna; el canvas se escala por CSS. */
  width: number;
  height: number;
  create(ctx: CanvasRenderingContext2D, callbacks: GameCallbacks): ArcadeGame;
  /** Stats extra a mostrar en el HUD del Reproductor. */
  extraStats?: ExtraStat[];
  /** `false` oculta el bloque de vidas del HUD (juegos sin vidas, ej. Tetris). */
  usesLives?: boolean;
}
