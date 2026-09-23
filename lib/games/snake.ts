// Motor de "Snake": serpiente en movimiento continuo (píxeles/frame) sobre una
// grilla lógica de 30×30 celdas de 20px, con giro alineado a grilla (buffer de
// 1 tecla pendiente), crecimiento por fruta, colisión contra bordes/cuerpo y
// velocidad progresiva.

import type { ArcadeGame, GameCallbacks } from "./engine";
import { DEFAULT_SKIN, type SkinId } from "./skins";
import { FRUIT_ATLAS, FRUIT_NAMES, FRUIT_SPRITE_SRC } from "./snake-atlas";

export const W = 600;
export const H = 600;
const CELL = 20; // 30×30 celdas

export interface Point {
  x: number;
  y: number;
} // en píxeles

type Direction = "up" | "down" | "left" | "right";

const DIR_VECTOR: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

const KEY_TO_DIR: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

/**
 * Paleta de Snake por roles semánticos.
 *
 * La fruta **no** es recoloreable: se pinta desde el spritesheet PNG
 * (`public/games/snake/fruits.png`, ver `snake-atlas.ts`). `fruitFallback` es el
 * color del cuadro sólido que se dibuja solo mientras la imagen no ha cargado (o
 * si falla), y es lo único que la skin controla de la fruta.
 *
 * Añadir una skin nueva debe ser una entrada más en `SNAKE_PALETTES`, nunca un
 * caso especial en la lógica de dibujo.
 */
export interface SnakePalette {
  /** Fondo del tablero. */
  bg: string;
  /** Cabeza de la serpiente (elemento jugable principal). */
  head: string;
  /** Segmentos del cuerpo (elemento jugable). */
  body: string;
  /** Cuadro sólido de la fruta mientras el sprite no ha cargado. */
  fruitFallback: string;
  /** Borde del límite jugable (decorativo). */
  border: string;
  /** Opacidad del borde: el mínimo decorativo depende de la gama de la skin. */
  borderAlpha: number;
  /** Velo del game over sobre el tablero. */
  overlay: string;
  /** Texto "GAME OVER" sobre el velo. */
  overlayText: string;
}

export const SNAKE_PALETTES: Record<SkinId, SnakePalette> = {
  // Sobria: gama fría casi acromática con un único acento ámbar para la fruta.
  // Cabeza y cuerpo se separan por luminosidad (17.6:1 vs 5.3:1), no solo por tono.
  clasico: {
    bg: "#101014",
    head: "#f2f5f8",
    body: "#7c8799",
    fruitFallback: "#ffc857",
    border: "#8d97a8",
    borderAlpha: 0.45,
    overlay: "rgba(8, 8, 12, 0.66)",
    overlayText: "#f2f5f8",
  },
  // Réplica exacta de la paleta hardcodeada histórica del motor (regresión cero):
  // --cyan / --green / --magenta sobre el fondo #0a0a0f del Vault, borde = cuerpo
  // al 50 % de alpha, velo rgba(0,0,0,0.6) y texto #fff.
  neon: {
    bg: "#0a0a0f",
    head: "#00f5ff",
    body: "#00ff88",
    fruitFallback: "#ff006e",
    border: "#00ff88",
    borderAlpha: 0.5,
    overlay: "rgba(0, 0, 0, 0.6)",
    overlayText: "#ffffff",
  },
  // Consola de 8 bits: gama corta, tonos cálidos, sin glow ni sombras suaves.
  retro: {
    bg: "#14100a",
    head: "#f8f0d0",
    body: "#7a9c30",
    fruitFallback: "#f8dc78",
    border: "#a0783c",
    borderAlpha: 0.55,
    overlay: "rgba(12, 8, 4, 0.66)",
    overlayText: "#f8f0d0",
  },
};

const INITIAL_INTERVAL_MS = 140;
const MIN_INTERVAL_MS = 60;
const SPEEDUP_EVERY_FRUITS = 5;
const SPEEDUP_FACTOR = 0.92; // -8%

const INITIAL_LENGTH = 4;
const SCORE_PER_FRUIT = 10;

type InternalState = "playing" | "gameover";

export class SnakeGame implements ArcadeGame {
  private ctx: CanvasRenderingContext2D;
  private callbacks: GameCallbacks;
  private palette: SnakePalette;

  private segments: Point[] = [];
  private direction: Direction = "right";
  private pendingDirection: Direction | null = null;

  private fruit: Point = { x: 0, y: 0 };
  private fruitSprite: string = FRUIT_NAMES[0];

  private intervalMs = INITIAL_INTERVAL_MS;
  private fruitsEaten = 0;
  private score = 0;
  private level = 1;
  private state: InternalState = "playing";

  private msSinceLastTick = 0;
  private rafId: number | null = null;
  private lastTime: number | null = null;
  private gameOverFired = false;

  private prevScore = 0;
  private prevLevel = 1;

  private fruitImage: HTMLImageElement;
  private fruitImageLoaded = false;

  private handleKeyDown = (e: KeyboardEvent) => {
    const dir = KEY_TO_DIR[e.key];
    if (!dir) return;
    e.preventDefault();
    if (dir === OPPOSITE[this.direction]) return;
    this.pendingDirection = dir;
  };

  constructor(
    ctx: CanvasRenderingContext2D,
    callbacks: GameCallbacks,
    skin: SkinId = DEFAULT_SKIN,
  ) {
    this.ctx = ctx;
    this.callbacks = callbacks;
    this.palette = SNAKE_PALETTES[skin] ?? SNAKE_PALETTES[DEFAULT_SKIN];

    this.fruitImage = new Image();
    this.fruitImage.onload = () => {
      this.fruitImageLoaded = true;
    };
    this.fruitImage.src = FRUIT_SPRITE_SRC;

    this.initSnake();
    this.spawnFruit();

    window.addEventListener("keydown", this.handleKeyDown);
  }

  private initSnake() {
    const startCol = 10;
    const startRow = 15;
    this.segments = [];
    for (let i = 0; i < INITIAL_LENGTH; i++) {
      this.segments.push({
        x: (startCol - i) * CELL,
        y: startRow * CELL,
      });
    }
    this.direction = "right";
    this.pendingDirection = null;
  }

  private isCellFree(col: number, row: number): boolean {
    return !this.segments.some((s) => s.x / CELL === col && s.y / CELL === row);
  }

  private spawnFruit() {
    const cols = W / CELL;
    const rows = H / CELL;
    let col = 0;
    let row = 0;
    let attempts = 0;
    do {
      col = Math.floor(Math.random() * cols);
      row = Math.floor(Math.random() * rows);
      attempts++;
    } while (!this.isCellFree(col, row) && attempts < 1000);

    this.fruit = { x: col * CELL, y: row * CELL };
    this.fruitSprite =
      FRUIT_NAMES[Math.floor(Math.random() * FRUIT_NAMES.length)];
  }

  private update(dtMs: number) {
    this.msSinceLastTick += dtMs;
    if (this.msSinceLastTick < this.intervalMs) return;
    this.msSinceLastTick -= this.intervalMs;

    if (this.pendingDirection) {
      this.direction = this.pendingDirection;
      this.pendingDirection = null;
    }

    const vec = DIR_VECTOR[this.direction];
    const head = this.segments[0];
    const newHead: Point = {
      x: head.x + vec.x * CELL,
      y: head.y + vec.y * CELL,
    };

    if (newHead.x < 0 || newHead.x >= W || newHead.y < 0 || newHead.y >= H) {
      this.state = "gameover";
      return;
    }

    if (this.segments.some((s) => s.x === newHead.x && s.y === newHead.y)) {
      this.state = "gameover";
      return;
    }

    this.segments.unshift(newHead);

    const ateFruit = newHead.x === this.fruit.x && newHead.y === this.fruit.y;
    if (ateFruit) {
      this.score += SCORE_PER_FRUIT;
      this.fruitsEaten++;
      if (this.fruitsEaten % SPEEDUP_EVERY_FRUITS === 0) {
        this.intervalMs = Math.max(
          MIN_INTERVAL_MS,
          Math.round(this.intervalMs * SPEEDUP_FACTOR),
        );
        this.level++;
      }
      this.spawnFruit();
    } else {
      this.segments.pop();
    }
  }

  private drawFruit() {
    const { ctx } = this;
    if (this.fruitImageLoaded) {
      const rect = FRUIT_ATLAS[this.fruitSprite];
      ctx.drawImage(
        this.fruitImage,
        rect.x,
        rect.y,
        rect.w,
        rect.h,
        this.fruit.x,
        this.fruit.y,
        CELL,
        CELL,
      );
    } else {
      ctx.fillStyle = this.palette.fruitFallback;
      ctx.fillRect(this.fruit.x, this.fruit.y, CELL, CELL);
    }
  }

  private draw() {
    const { ctx, palette } = this;
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, W, H);

    // Borde del mapa: sin esto, el fondo del canvas se confunde con el fondo
    // negro del CRT y el límite jugable no se distingue.
    ctx.strokeStyle = palette.border;
    ctx.globalAlpha = palette.borderAlpha;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);
    ctx.globalAlpha = 1;

    this.drawFruit();

    for (let i = this.segments.length - 1; i >= 0; i--) {
      const s = this.segments[i];
      ctx.fillStyle = i === 0 ? palette.head : palette.body;
      ctx.fillRect(s.x, s.y, CELL, CELL);
    }

    if (this.state === "gameover") {
      ctx.fillStyle = palette.overlay;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = palette.overlayText;
      ctx.font = "bold 48px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("GAME OVER", W / 2, H / 2);
    }
  }

  private emitChanges() {
    if (this.score !== this.prevScore) {
      this.prevScore = this.score;
      this.callbacks.onScoreChange(this.score);
    }
    if (this.level !== this.prevLevel) {
      this.prevLevel = this.level;
      this.callbacks.onLevelChange(this.level);
    }
  }

  private loop = (ts: number) => {
    const dtMs = this.lastTime === null ? 0 : Math.min(ts - this.lastTime, 50);
    this.lastTime = ts;

    if (this.state === "playing") this.update(dtMs);
    this.draw();
    this.emitChanges();

    if (this.state === "gameover") {
      if (!this.gameOverFired) {
        this.gameOverFired = true;
        this.callbacks.onGameOver(this.score);
      }
      return;
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  start(): void {
    this.callbacks.onScoreChange(this.score);
    this.callbacks.onLivesChange(0);
    this.callbacks.onLevelChange(this.level);
    this.lastTime = null;
    this.rafId = requestAnimationFrame(this.loop);
  }

  pause(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  resume(): void {
    if (this.rafId !== null || this.gameOverFired) return;
    this.lastTime = null;
    this.rafId = requestAnimationFrame(this.loop);
  }

  /**
   * Cambia la paleta en caliente: no toca segmentos, dirección, velocidad ni
   * listeners, así que la partida en curso sigue igual. Si el loop no está vivo
   * (pausa o game over), repinta una vez para que el cambio se vea al instante.
   */
  setSkin(skin: SkinId): void {
    this.palette = SNAKE_PALETTES[skin] ?? SNAKE_PALETTES[DEFAULT_SKIN];
    if (this.rafId === null) this.draw();
  }

  destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    window.removeEventListener("keydown", this.handleKeyDown);
  }
}
