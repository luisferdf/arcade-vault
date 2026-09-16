// Motor de "Tetris", portado de references/started-games/03-tetris/game.js.
// Sin document.getElementById ni canvas global: W/H son la resolución lógica fija
// (idéntica a la del original: COLS×BLOCK, ROWS×BLOCK) y el CanvasRenderingContext2D
// se recibe como parámetro. La preview de NEXT y el HUD (SCORE/LINES/LEVEL), que en
// el original vivían en el DOM (sidebar + <canvas> secundario), se dibujan aquí
// dentro del mismo canvas principal, en una franja translúcida superpuesta al tablero.

import type { ArcadeGame, GameCallbacks } from "./engine";
import { DEFAULT_SKIN, type SkinId } from "./skins";

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

export const W = COLS * BLOCK;
export const H = ROWS * BLOCK;

/**
 * Paleta de Tetris por roles semánticos. Mantiene la separación original entre
 * el "chrome" del motor (fondo, rejilla, franja de HUD) y la paleta de piezas:
 * `pieces` está indexada por el tipo de pieza (1..8), con `null` en el índice 0
 * porque 0 es "celda vacía" en el tablero.
 *
 * Añadir una skin nueva debe ser una entrada más en `TETRIS_PALETTES`, nunca un
 * caso especial en la lógica de dibujo.
 */
export interface TetrisPalette {
  /** Fondo del tablero. */
  bg: string;
  /** Líneas de la rejilla (decorativo). */
  grid: string;
  /** Fondo translúcido de la franja de HUD superpuesta. */
  hudBg: string;
  /** Borde de la franja de HUD y de la caja de NEXT (decorativo). */
  hudBorder: string;
  /** Texto SCORE/LEVEL/LINES. */
  hudText: string;
  /** Bisel superior de cada bloque (antes literal inline en drawBlock). */
  blockHighlight: string;
  /**
   * Opacidad de la pieza fantasma (guía de caída). Es un rol de paleta porque el
   * contraste mínimo de la guía depende de lo clara que sea la gama de la skin.
   */
  ghostAlpha: number;
  /** Índice 0 = celda vacía; 1..8 = I, O, T, S, Z, J, L, N. */
  pieces: (string | null)[];
}

export const TETRIS_PALETTES: Record<SkinId, TetrisPalette> = {
  // Réplica exacta de la paleta hardcodeada histórica del motor (regresión cero):
  // chrome con los tokens del Vault (--cyan, fondo #0a0a0f) y piezas saturadas.
  clasico: {
    bg: "#0a0a0f",
    grid: "rgba(0, 245, 255, 0.08)",
    hudBg: "rgba(10, 10, 15, 0.82)",
    hudBorder: "rgba(0, 245, 255, 0.35)",
    hudText: "#00f5ff",
    blockHighlight: "rgba(255,255,255,0.12)",
    // 0.22 es el valor histórico: se conserva por regresión cero aunque deje la
    // guía por debajo del umbral decorativo de 2:1 (ver game-with-theme.md).
    ghostAlpha: 0.22,
    pieces: [
      null,
      "#22e5ff", // I - cian
      "#ffe066", // O - amarillo
      "#d66bff", // T - púrpura
      "#39ff8f", // S - verde
      "#ff3d6e", // Z - rojo/magenta
      "#5ec8ff", // J - azul pálido
      "#ffa63d", // L - naranja
      "#aab4c4", // N - tuerca (gris metálico)
    ],
  },
  // Sobria: gama casi acromática con un único acento cian frío. Las 8 piezas se
  // separan por luminosidad (y por forma), no por tono, para jugar sin fatiga.
  // Contraste decorativo (grid/ghost) reforzado por encima del mínimo 2:1.
  neon: {
    bg: "#101014",
    grid: "#5a5f70",
    hudBg: "rgba(16, 16, 20, 0.85)",
    hudBorder: "rgba(230, 233, 255, 0.28)",
    hudText: "#e6e9ff",
    blockHighlight: "rgba(255,255,255,0.14)",
    ghostAlpha: 0.5,
    pieces: [
      null,
      "#d8e4ee", // I
      "#f0ead8", // O
      "#b9b3c6", // T
      "#a9c0b4", // S
      "#c6a8a8", // Z
      "#93a4bb", // J
      "#cdbfa6", // L
      "#8f949e", // N (tuerca)
    ],
  },
  // Consola de 8 bits: gama corta, tonos cálidos, bisel duro, sin glow.
  retro: {
    bg: "#12100c",
    grid: "#504838",
    hudBg: "rgba(18, 16, 12, 0.88)",
    hudBorder: "#a0783c",
    hudText: "#f0c040",
    blockHighlight: "rgba(255,255,255,0.22)",
    ghostAlpha: 0.42,
    pieces: [
      null,
      "#f8f0d8", // I - hueso
      "#f0c040", // O - oro
      "#d89ce8", // T - violeta
      "#98d868", // S - verde oliva
      "#f07858", // Z - ladrillo
      "#88b0f0", // J - azul
      "#e89848", // L - ámbar
      "#b0a898", // N - tuerca
    ],
  },
};

type Shape = number[][];

const PIECES: (Shape | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // N (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const CONTROL_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Space",
]);

interface Piece {
  type: number;
  shape: Shape;
  x: number;
  y: number;
}

type Board = number[][];

function createBoard(): Board {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece(): Piece {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type]!.map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}

function collide(board: Board, shape: Shape, ox: number, oy: number): boolean {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape: Shape): Shape {
  const rows = shape.length;
  const cols = shape[0].length;
  const result: Shape = Array.from({ length: cols }, () =>
    new Array(rows).fill(0),
  );
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate(board: Board, current: Piece) {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(board, rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge(board: Board, current: Piece) {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function ghostY(board: Board, current: Piece): number {
  let gy = current.y;
  while (!collide(board, current.shape, current.x, gy + 1)) gy++;
  return gy;
}

// ── Estado del juego ──────────────────────────────────────────────────────────
interface GameState {
  board: Board;
  current: Piece;
  next: Piece;
  score: number;
  lines: number;
  level: number;
  gameOver: boolean;
  dropAccum: number;
  dropInterval: number;
}

function createGameState(): GameState {
  const board = createBoard();
  const first = randomPiece();
  const next = randomPiece();
  return {
    board,
    current: first,
    next,
    score: 0,
    lines: 0,
    level: 1,
    gameOver: false,
    dropAccum: 0,
    dropInterval: 1000,
  };
}

function clearLines(state: GameState) {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (state.board[r].every((v) => v !== 0)) {
      state.board.splice(r, 1);
      state.board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    state.lines += cleared;
    state.score += (LINE_SCORES[cleared] || 0) * state.level;
    state.level = Math.floor(state.lines / 10) + 1;
    state.dropInterval = Math.max(100, 1000 - (state.level - 1) * 90);
  }
}

function spawn(state: GameState) {
  state.current = state.next;
  state.next = randomPiece();
  if (
    collide(state.board, state.current.shape, state.current.x, state.current.y)
  ) {
    state.gameOver = true;
  }
}

function lockPiece(state: GameState) {
  merge(state.board, state.current);
  clearLines(state);
  spawn(state);
}

function hardDrop(state: GameState) {
  const gy = ghostY(state.board, state.current);
  state.score += (gy - state.current.y) * 2;
  state.current.y = gy;
  lockPiece(state);
}

function softDrop(state: GameState) {
  if (
    !collide(
      state.board,
      state.current.shape,
      state.current.x,
      state.current.y + 1,
    )
  ) {
    state.current.y++;
    state.score += 1;
  } else {
    lockPiece(state);
  }
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawBlock(
  ctx: CanvasRenderingContext2D,
  palette: TetrisPalette,
  x: number,
  y: number,
  colorIndex: number,
  size: number,
  alpha?: number,
) {
  if (!colorIndex) return;
  const color = palette.pieces[colorIndex];
  ctx.globalAlpha = alpha ?? 1;
  ctx.fillStyle = color!;
  ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  ctx.fillStyle = palette.blockHighlight;
  ctx.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  ctx.globalAlpha = 1;
}

function drawGrid(ctx: CanvasRenderingContext2D, palette: TetrisPalette) {
  ctx.strokeStyle = palette.grid;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function drawBoard(
  ctx: CanvasRenderingContext2D,
  palette: TetrisPalette,
  state: GameState,
) {
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, W, H);
  drawGrid(ctx, palette);

  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, palette, c, r, state.board[r][c], BLOCK);

  const gy = ghostY(state.board, state.current);
  const { shape } = state.current;
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      if (shape[r][c])
        drawBlock(
          ctx,
          palette,
          state.current.x + c,
          gy + r,
          shape[r][c],
          BLOCK,
          palette.ghostAlpha,
        );

  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(
        ctx,
        palette,
        state.current.x + c,
        state.current.y + r,
        shape[r][c],
        BLOCK,
      );
}

// Franja HUD translúcida superpuesta al tablero: SCORE/LEVEL/LINES + preview de NEXT.
const HUD_H = 40;
const NEXT_BOX = { x: W - 42, y: 4, w: 38, h: 32 };

function drawHUD(
  ctx: CanvasRenderingContext2D,
  palette: TetrisPalette,
  state: GameState,
) {
  ctx.fillStyle = palette.hudBg;
  ctx.fillRect(0, 0, W, HUD_H);
  ctx.strokeStyle = palette.hudBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, HUD_H);
  ctx.lineTo(W, HUD_H);
  ctx.stroke();

  ctx.fillStyle = palette.hudText;
  ctx.font = "11px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`SCORE ${state.score.toLocaleString("es-ES")}`, 8, 16);
  ctx.fillText(`LEVEL ${state.level}   LINES ${state.lines}`, 8, 32);

  // Caja de NEXT
  ctx.strokeStyle = palette.hudBorder;
  ctx.strokeRect(NEXT_BOX.x, NEXT_BOX.y, NEXT_BOX.w, NEXT_BOX.h);
  const nb = 7; // tamaño de bloque dentro de la preview
  const shape = state.next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  ctx.save();
  ctx.translate(NEXT_BOX.x + 2, NEXT_BOX.y + 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      if (shape[r][c])
        drawBlock(ctx, palette, offX + c, offY + r, shape[r][c], nb);
  ctx.restore();
}

// ── API pública ───────────────────────────────────────────────────────────────
export type TetrisCallbacks = GameCallbacks;

export class TetrisGame implements ArcadeGame {
  private ctx: CanvasRenderingContext2D;
  private callbacks: TetrisCallbacks;
  private state: GameState;
  private palette: TetrisPalette;
  private rafId: number | null = null;
  private lastTime: number | null = null;
  private gameOverFired = false;

  private prevScore: number;
  private prevLevel: number;
  private prevLines: number;

  private handleKeyDown = (e: KeyboardEvent) => {
    if (CONTROL_KEYS.has(e.code)) e.preventDefault();
    if (e.code === "KeyP") {
      if (this.state.gameOver) return;
      if (this.rafId !== null) this.pause();
      else this.resume();
      return;
    }
    if (this.state.gameOver || this.rafId === null) return;
    const { board, current } = this.state;
    switch (e.code) {
      case "ArrowLeft":
        if (!collide(board, current.shape, current.x - 1, current.y))
          current.x--;
        break;
      case "ArrowRight":
        if (!collide(board, current.shape, current.x + 1, current.y))
          current.x++;
        break;
      case "ArrowDown":
        softDrop(this.state);
        break;
      case "ArrowUp":
      case "KeyX":
        tryRotate(board, current);
        break;
      case "Space":
        hardDrop(this.state);
        break;
      default:
        return;
    }
    this.emitChanges();
    this.draw();
  };

  private draw() {
    drawBoard(this.ctx, this.palette, this.state);
    drawHUD(this.ctx, this.palette, this.state);
  }

  private emitChanges() {
    if (this.state.score !== this.prevScore) {
      this.prevScore = this.state.score;
      this.callbacks.onScoreChange(this.state.score);
    }
    if (this.state.level !== this.prevLevel) {
      this.prevLevel = this.state.level;
      this.callbacks.onLevelChange(this.state.level);
    }
    if (this.state.lines !== this.prevLines) {
      this.prevLines = this.state.lines;
      this.callbacks.onStatChange?.("lines", this.state.lines);
    }
  }

  private loop = (ts: number) => {
    const dt = this.lastTime === null ? 0 : ts - this.lastTime;
    this.lastTime = ts;

    this.state.dropAccum += dt;
    if (this.state.dropAccum >= this.state.dropInterval) {
      this.state.dropAccum = 0;
      const { board, current } = this.state;
      if (!collide(board, current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece(this.state);
      }
    }

    this.emitChanges();

    if (this.state.gameOver) {
      this.draw();
      if (!this.gameOverFired) {
        this.gameOverFired = true;
        this.callbacks.onGameOver(this.state.score);
      }
      this.rafId = null;
      return;
    }

    this.draw();
    this.rafId = requestAnimationFrame(this.loop);
  };

  constructor(
    ctx: CanvasRenderingContext2D,
    callbacks: TetrisCallbacks,
    skin: SkinId = DEFAULT_SKIN,
  ) {
    this.ctx = ctx;
    this.callbacks = callbacks;
    this.palette = TETRIS_PALETTES[skin] ?? TETRIS_PALETTES[DEFAULT_SKIN];
    this.state = createGameState();
    this.prevScore = this.state.score;
    this.prevLevel = this.state.level;
    this.prevLines = this.state.lines;
  }

  start(): void {
    window.addEventListener("keydown", this.handleKeyDown);
    this.callbacks.onScoreChange(this.state.score);
    this.callbacks.onLevelChange(this.state.level);
    this.callbacks.onStatChange?.("lines", this.state.lines);
    this.draw();
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
   * Cambia la paleta en caliente: no toca el estado del juego, ni el loop, ni los
   * listeners (siguen siendo los registrados en `start()`). Repinta al momento para
   * que el cambio también se vea con la partida en pausa o terminada.
   */
  setSkin(skin: SkinId): void {
    this.palette = TETRIS_PALETTES[skin] ?? TETRIS_PALETTES[DEFAULT_SKIN];
    this.draw();
  }

  destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    window.removeEventListener("keydown", this.handleKeyDown);
  }
}
