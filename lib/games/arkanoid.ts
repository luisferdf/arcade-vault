// Motor de "Arkanoid", portado de references/started-games/04-arkanoid/game.js.
// Sin document.getElementById ni canvas global: W/H son la resolución lógica fija
// y el CanvasRenderingContext2D se recibe como parámetro. El elemento <canvas>
// real se obtiene de ctx.canvas para escuchar mousemove/click sin tocar el DOM
// fuera de lo que el motor recibe.

import type { ArcadeGame, GameCallbacks } from "./engine";
import { LEVELS, type BlockColor } from "./arkanoid-levels";

export const W = 800;
export const H = 600;

// Colores neón del Vault (mismos valores que app/globals.css) + 3 tonos nuevos
// para cubrir red/hotpink/gray del original, que no tienen token oficial.
const BLOCK_COLORS: Record<BlockColor, string> = {
  cyan: "#00f5ff",
  magenta: "#ff006e",
  yellow: "#f5ff00",
  green: "#00ff88",
  red: "#ff3b3b",
  hotpink: "#ff4fd8",
  gray: "#8a8aa0",
};
const COLOR_PADDLE_BALL = "#00f5ff";
const COLOR_HUD = "#00f5ff";
const COLOR_BG = "#0a0a0f";

const PADDLE_SPEED = 400;
const BLOCK_COLS = 10;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2;
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;
// Duración del destello de rotura procedural que sustituye a los 4 frames de
// sprite del original (que usaban EXPLOSION_DURATION = 150ms).
const EXPLOSION_DURATION = 220;

const PAUSE_BTN_W = 60;
const PAUSE_BTN_H = 40;
const PAUSE_BTN_GAP = 12;
const PAUSE_BTN_Y = 340;
const PAUSE_BTN_ROW_X = (W - (5 * PAUSE_BTN_W + 4 * PAUSE_BTN_GAP)) / 2;

const CONTROL_KEYS = new Set(["ArrowLeft", "ArrowRight"]);

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Ball extends Rect {
  vx: number;
  vy: number;
}

interface BlockRuntime extends Rect {
  color: BlockColor;
  alive: boolean;
}

interface Explosion extends Rect {
  color: BlockColor;
  elapsed: number;
}

type InternalState = "playing" | "gameover" | "win";

function collideAABB(ball: Ball, block: Rect): boolean {
  return (
    ball.x < block.x + block.w &&
    ball.x + ball.w > block.x &&
    ball.y < block.y + block.h &&
    ball.y + ball.h > block.y
  );
}

export class ArkanoidGame implements ArcadeGame {
  private ctx: CanvasRenderingContext2D;
  private callbacks: GameCallbacks;

  private paddle: Rect = { x: 0, y: 560, w: 81, h: 14 };
  private ball: Ball = { x: 0, y: 0, w: 16, h: 16, vx: 200, vy: -300 };
  private blocks: BlockRuntime[] = [];
  private explosions: Explosion[] = [];

  private lives = 3;
  private score = 0;
  private currentLevel = 1;
  private state: InternalState = "playing";
  // Pausa interna (tecla P/Escape o overlay), independiente de pause()/resume()
  // externos que llama el botón PAUSA del Reproductor.
  private isPaused = false;

  private keys: Record<string, boolean> = {};
  private rafId: number | null = null;
  private lastTime: number | null = null;
  private gameOverFired = false;

  private prevScore = 0;
  private prevLives = 3;
  private prevLevel = 1;

  private handleKeyDown = (e: KeyboardEvent) => {
    if (CONTROL_KEYS.has(e.key)) e.preventDefault();
    if (e.key === "ArrowLeft" || e.key === "ArrowRight")
      this.keys[e.key] = true;
    if (
      (e.key === "p" || e.key === "P" || e.key === "Escape") &&
      this.state === "playing"
    ) {
      this.isPaused = !this.isPaused;
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight")
      this.keys[e.key] = false;
  };

  // Salta de nivel desde el selector del overlay de pausa. Reanuda la pausa
  // interna directamente (sin pasar por resume()), por lo que si la pausa
  // externa del Reproductor está activa el estado `paused` de React puede
  // quedar desincronizado del motor: riesgo aceptado en la spec 08.
  private handleClick = (e: MouseEvent) => {
    if (!this.isPaused) return;
    const canvas = this.ctx.canvas;
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    for (let i = 0; i < 5; i++) {
      const bx = PAUSE_BTN_ROW_X + i * (PAUSE_BTN_W + PAUSE_BTN_GAP);
      if (
        mx >= bx &&
        mx <= bx + PAUSE_BTN_W &&
        my >= PAUSE_BTN_Y &&
        my <= PAUSE_BTN_Y + PAUSE_BTN_H
      ) {
        this.loadLevel(i + 1);
        this.isPaused = false;
        return;
      }
    }
  };

  private handleMouseMove = (e: MouseEvent) => {
    const canvas = this.ctx.canvas;
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    this.paddle.x = Math.max(
      0,
      Math.min(W - this.paddle.w, mouseX - this.paddle.w / 2),
    );
  };

  constructor(ctx: CanvasRenderingContext2D, callbacks: GameCallbacks) {
    this.ctx = ctx;
    this.callbacks = callbacks;
    this.initPaddle();
    this.loadLevel(1);
  }

  private initPaddle() {
    this.paddle.x = (W - this.paddle.w) / 2;
  }

  private initBall() {
    const speed = LEVELS[this.currentLevel - 1].speed;
    this.ball.x = this.paddle.x + (this.paddle.w - this.ball.w) / 2;
    this.ball.y = this.paddle.y - this.ball.h;
    this.ball.vx = BASE_BALL_VX * speed;
    this.ball.vy = BASE_BALL_VY * speed;
  }

  private loadLevel(n: number) {
    this.currentLevel = n;
    const level = LEVELS[n - 1];
    this.blocks = level.blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    this.explosions = [];
    this.ball.x = this.paddle.x + (this.paddle.w - this.ball.w) / 2;
    this.ball.y = this.paddle.y - this.ball.h;
    this.ball.vx = BASE_BALL_VX * level.speed;
    this.ball.vy = BASE_BALL_VY * level.speed;
  }

  private update(dt: number) {
    const { paddle, ball } = this;

    if (this.keys.ArrowLeft)
      paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    if (this.keys.ArrowRight)
      paddle.x = Math.min(W - paddle.w, paddle.x + PADDLE_SPEED * dt);

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
    }
    if (ball.x + ball.w >= W) {
      ball.x = W - ball.w;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
    }

    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + 8
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
    }

    for (const block of this.blocks) {
      if (!block.alive) continue;
      if (collideAABB(ball, block)) {
        block.alive = false;
        this.explosions.push({
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
          color: block.color,
          elapsed: 0,
        });
        this.score += 10;
        ball.vy = -ball.vy;
        if (this.blocks.every((b) => !b.alive)) {
          if (this.currentLevel < 5) this.loadLevel(this.currentLevel + 1);
          else this.state = "win";
        }
        break; // un bloque por frame, igual que el original
      }
    }

    for (const exp of this.explosions) exp.elapsed += dt * 1000;
    this.explosions = this.explosions.filter(
      (exp) => exp.elapsed < EXPLOSION_DURATION,
    );

    if (ball.y > H) {
      this.lives--;
      if (this.lives <= 0) {
        this.lives = 0;
        this.state = "gameover";
      } else {
        this.initBall();
      }
    }
  }

  private drawOverlay(message: string) {
    const { ctx } = this;
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 64px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(message, W / 2, H / 2);
  }

  private drawPauseOverlay() {
    const { ctx } = this;
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 56px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PAUSA", W / 2, 260);

    ctx.font = "bold 16px monospace";
    ctx.fillText("Saltar al nivel:", W / 2, 310);

    for (let i = 0; i < 5; i++) {
      const bx = PAUSE_BTN_ROW_X + i * (PAUSE_BTN_W + PAUSE_BTN_GAP);
      const isActive = i + 1 === this.currentLevel;
      ctx.fillStyle = isActive ? "#f0c040" : "#444";
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(bx, PAUSE_BTN_Y, PAUSE_BTN_W, PAUSE_BTN_H, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = isActive ? "#000" : "#fff";
      ctx.font = "bold 20px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        String(i + 1),
        bx + PAUSE_BTN_W / 2,
        PAUSE_BTN_Y + PAUSE_BTN_H / 2,
      );
    }
  }

  private draw() {
    const { ctx } = this;
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, W, H);

    for (const block of this.blocks) {
      if (!block.alive) continue;
      ctx.fillStyle = BLOCK_COLORS[block.color];
      ctx.fillRect(block.x, block.y, block.w, block.h);
    }

    // Destello de rotura procedural: rectángulo del color del bloque que se
    // desvanece y encoge durante EXPLOSION_DURATION ms.
    for (const exp of this.explosions) {
      const t = exp.elapsed / EXPLOSION_DURATION;
      const alpha = Math.max(0, 1 - t);
      const grow = t * 10;
      ctx.fillStyle = BLOCK_COLORS[exp.color];
      ctx.globalAlpha = alpha;
      ctx.fillRect(
        exp.x - grow / 2,
        exp.y - grow / 2,
        exp.w + grow,
        exp.h + grow,
      );
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = COLOR_PADDLE_BALL;
    ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h);
    ctx.beginPath();
    ctx.arc(
      this.ball.x + this.ball.w / 2,
      this.ball.y + this.ball.h / 2,
      this.ball.w / 2,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    if (this.state === "playing") {
      ctx.fillStyle = COLOR_HUD;
      ctx.font = "bold 18px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`Score: ${this.score}`, 10, 10);
      ctx.textAlign = "center";
      ctx.fillText(`Nivel: ${this.currentLevel}`, W / 2, 10);
      const ballSize = 16;
      const ballSpacing = 4;
      for (let i = 0; i < this.lives; i++) {
        const bx = W - 10 - (this.lives - i) * (ballSize + ballSpacing);
        ctx.beginPath();
        ctx.arc(
          bx + ballSize / 2,
          10 + ballSize / 2,
          ballSize / 2,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }

    if (this.state === "gameover") this.drawOverlay("GAME OVER");
    if (this.state === "win") this.drawOverlay("¡Completaste el juego!");
    if (this.isPaused) this.drawPauseOverlay();
  }

  private emitChanges() {
    if (this.score !== this.prevScore) {
      this.prevScore = this.score;
      this.callbacks.onScoreChange(this.score);
    }
    if (this.lives !== this.prevLives) {
      this.prevLives = this.lives;
      this.callbacks.onLivesChange(this.lives);
    }
    if (this.currentLevel !== this.prevLevel) {
      this.prevLevel = this.currentLevel;
      this.callbacks.onLevelChange(this.currentLevel);
    }
  }

  private loop = (ts: number) => {
    const dt =
      this.lastTime === null ? 0 : Math.min((ts - this.lastTime) / 1000, 0.05);
    this.lastTime = ts;

    if (!this.isPaused && this.state === "playing") this.update(dt);
    this.draw();
    this.emitChanges();

    if (this.state === "gameover" || this.state === "win") {
      if (!this.gameOverFired) {
        this.gameOverFired = true;
        this.callbacks.onGameOver(this.score);
      }
      return;
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  start(): void {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    this.ctx.canvas.addEventListener("mousemove", this.handleMouseMove);
    this.ctx.canvas.addEventListener("click", this.handleClick);
    this.callbacks.onScoreChange(this.score);
    this.callbacks.onLivesChange(this.lives);
    this.callbacks.onLevelChange(this.currentLevel);
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

  destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    this.ctx.canvas.removeEventListener("mousemove", this.handleMouseMove);
    this.ctx.canvas.removeEventListener("click", this.handleClick);
  }
}
