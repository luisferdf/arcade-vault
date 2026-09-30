/**
 * Frogger — motor canvas puro (spec Game-jam/Frogger/01-frogger-core).
 * Cuadrícula lógica de 16 × 14 celdas de 40 px; la rana salta celda a celda.
 * El canvas añade una banda de HUD de 40 px arriba (decisión del usuario: la
 * spec pisaba las bocas destino de la fila 0 con el HUD interno).
 */

import type { ArcadeGame, GameCallbacks, TouchAction } from "./engine";
import { DEFAULT_SKIN, type SkinId } from "./skins";

export const COLS = 16;
export const ROWS = 14;
export const CELL = 40; // px
export const HUD_H = 40; // banda de HUD sobre la cuadrícula
export const W = COLS * CELL; // 640 — el canvas se escala por CSS
export const H = HUD_H + ROWS * CELL; // 600

// Zonas (índice de fila, 0 = arriba)
export const ROW_GOALS = 0;
export const ROW_RIVER_TOP = 1;
export const ROW_RIVER_BOT = 6;
export const ROW_SAFE_MID = 7;
export const ROW_ROAD_TOP = 8;
export const ROW_ROAD_BOT = 12;
export const ROW_START = 13;

/** Cada carril es un anillo de LOOP_CELLS celdas: 16 visibles + 4 de margen a cada lado. */
export const LOOP_CELLS = COLS + 8;
const LOOP_MARGIN = 4;
/** Cada nivel multiplica todas las velocidades por 1.15. */
const LEVEL_SPEED_FACTOR = 1.15;
/** Ciclo de las tortugas: 3 s visibles + 1.5 s bajo el agua. */
export const TURTLE_VISIBLE_MS = 3000;
export const TURTLE_SUBMERGED_MS = 1500;

type Direction = "up" | "down" | "left" | "right";

interface Entity {
  col: number;
  width: number;
  type: "car" | "truck" | "log" | "turtle";
  submerged?: boolean;
  /** Solo tortugas: desfase (ms) dentro del ciclo de inmersión del grupo. */
  phase?: number;
}

interface Lane {
  row: number;
  speed: number;
  dir: 1 | -1;
  entities: Entity[];
}

interface Frog {
  col: number;
  row: number;
  animating: boolean;
  animT: number;
  targetCol: number;
  targetRow: number;
}

export type { Direction, Entity, Lane, Frog };

interface LaneDef {
  row: number;
  /** px/frame a 60 fps, nivel 1. */
  speed: number;
  dir: 1 | -1;
  kind: "road" | "log" | "turtle";
  /** Anchos (en celdas) de las entidades, repartidas a huecos iguales por el anillo. */
  widths: number[];
}

const LANE_DEFS: LaneDef[] = [
  // Río (filas 1–6): troncos de 2–4 celdas, tortugas en grupos de 2–3.
  { row: 1, speed: 2.2, dir: 1, kind: "log", widths: [4, 3, 4, 3] },
  { row: 2, speed: 3, dir: -1, kind: "log", widths: [3, 3, 3, 3] },
  { row: 3, speed: 2.5, dir: 1, kind: "turtle", widths: [2, 2, 2, 2, 2] },
  { row: 4, speed: 1, dir: -1, kind: "log", widths: [4, 4, 4, 4] },
  { row: 5, speed: 2, dir: 1, kind: "log", widths: [3, 3, 3, 3] },
  { row: 6, speed: 1.5, dir: -1, kind: "turtle", widths: [3, 3, 3, 3] },
  // Carretera (filas 8–12): coches de 1 celda y camiones de 2–3.
  { row: 8, speed: 4, dir: 1, kind: "road", widths: [1, 1, 1, 1] },
  { row: 9, speed: 3.5, dir: -1, kind: "road", widths: [2, 1, 2, 1] },
  { row: 10, speed: 2, dir: 1, kind: "road", widths: [1, 1, 1, 1, 1] },
  { row: 11, speed: 2.5, dir: -1, kind: "road", widths: [3, 3, 3] },
  { row: 12, speed: 1.5, dir: 1, kind: "road", widths: [1, 1, 1, 1, 1, 1] },
];

/** Ajusta `col` al rango [-LOOP_MARGIN, LOOP_MARGIN + COLS + ...) del anillo. */
function wrapToRing(col: number): number {
  return (
    ((((col + LOOP_MARGIN) % LOOP_CELLS) + LOOP_CELLS) % LOOP_CELLS) -
    LOOP_MARGIN
  );
}

/**
 * Construye los 11 carriles (6 de río + 5 de carretera) del nivel dado.
 * Las entidades quedan repartidas con huecos iguales (≥ 1 celda) sobre un anillo
 * de LOOP_CELLS celdas; cada nivel sube las velocidades un 15 %.
 */
export function buildLanes(level: number): Lane[] {
  const factor = Math.pow(LEVEL_SPEED_FACTOR, Math.max(0, level - 1));
  return LANE_DEFS.map((def) => {
    const total = def.widths.reduce((a, b) => a + b, 0);
    const gap = (LOOP_CELLS - total) / def.widths.length;
    const stagger = (def.row * 7) % LOOP_CELLS;
    let cursor = 0;
    const entities: Entity[] = def.widths.map((width, i) => {
      const col = wrapToRing(cursor + stagger);
      cursor += width + gap;
      const type: Entity["type"] =
        def.kind === "road" ? (width >= 2 ? "truck" : "car") : def.kind;
      const entity: Entity = { col, width, type };
      if (type === "turtle") {
        entity.submerged = false;
        entity.phase =
          (i * 1100 + def.row * 700) %
          (TURTLE_VISIBLE_MS + TURTLE_SUBMERGED_MS);
      }
      return entity;
    });
    return { row: def.row, speed: def.speed * factor, dir: def.dir, entities };
  });
}
// ---------------------------------------------------------------------------
// Motor
// ---------------------------------------------------------------------------

const JUMP_MS = 120;
const START_COL = COLS / 2;
const START_LIVES = 3;
const GOAL_COUNT = 5;

/** Columna izquierda de la boca `i` (cada boca ocupa 2 columnas). */
const goalCol = (i: number) => 1 + 3 * i;

/** 15 s en el nivel 1, −1 s por nivel, mínimo 8 s. */
const roundTimeMs = (level: number) =>
  Math.max(8000, 15000 - (level - 1) * 1000);

/**
 * Paleta de Frogger por roles semánticos. Añadir una skin nueva debe ser una
 * entrada más en `FROGGER_PALETTES`, nunca un caso especial en el dibujo.
 */
export interface FroggerPalette {
  /** Banda de HUD superior. */
  hudBg: string;
  hudText: string;
  /** Fondos de zona: carretera, río, franjas seguras y fila de metas. */
  road: string;
  roadLine: string;
  river: string;
  riverWave: string;
  safe: string;
  goalBg: string;
  /** Boca destino (hueco) y su marco resaltado. */
  goalMouth: string;
  goalBorder: string;
  /** Rana (también los iconos de vida del HUD). */
  frog: string;
  frogEye: string;
  frogPupil: string;
  /** Contorno de la rana para separarla de troncos/tortugas; `null` = sin contorno. */
  frogOutline: string | null;
  /** Coches: se elige por fila (`row % cars.length`). */
  cars: string[];
  /** Parabrisas pintado sobre el coche (admite alpha). */
  windshield: string;
  truck: string;
  truckCab: string;
  wheel: string;
  log: string;
  logLine: string;
  turtle: string;
  turtleScale: string;
  /** Silueta de la tortuga sumergida (aviso, no plataforma). */
  turtleSubmerged: string;
  /** Barra de tiempo: > 50 %, > 25 %, resto. */
  timeOk: string;
  timeMid: string;
  timeLow: string;
}

export const FROGGER_PALETTES: Record<SkinId, FroggerPalette> = {
  // Sobria: grises fríos, rana casi blanca con contorno oscuro y un único acento
  // ámbar (marco de las metas y tramo medio del reloj).
  clasico: {
    hudBg: "#101014",
    hudText: "#f2f5f8",
    road: "#121216",
    roadLine: "#5c606a",
    river: "#0f1a28",
    riverWave: "#44587a",
    safe: "#4d525e",
    goalBg: "#181a20",
    goalMouth: "#454c5c",
    goalBorder: "#ffc857",
    frog: "#eef6e8",
    frogEye: "#1a1c22",
    frogPupil: "#f2f5f8",
    frogOutline: "#101014",
    cars: ["#c8ccd4", "#9aa3b0", "#a4acb8"],
    windshield: "rgba(16,16,20,0.5)",
    truck: "#7c8594",
    truckCab: "#dcdfe4",
    wheel: "#050505",
    log: "#a08c74",
    logLine: "#5e4f3e",
    turtle: "#8494a0",
    turtleScale: "#4a5660",
    turtleSubmerged: "#6a7a88",
    timeOk: "#c8ccd4",
    timeMid: "#ffc857",
    timeLow: "#ff8a7a",
  },
  // Réplica exacta del objeto COLOR hardcodeado original (regresión cero),
  // incluidos los dos literales sueltos (parabrisas y tortuga sumergida).
  neon: {
    hudBg: "#0a0a0f",
    hudText: "#ffffff",
    road: "#111116",
    roadLine: "rgba(255,255,255,0.12)",
    river: "#06204a",
    riverWave: "rgba(80,140,255,0.15)",
    safe: "#0f3d1e",
    goalBg: "#0b2612",
    goalMouth: "#1f7a3a",
    goalBorder: "#f5c518",
    frog: "#39ff6a",
    frogEye: "#ffffff",
    frogPupil: "#000000",
    frogOutline: null,
    cars: ["#e63946", "#f5ff00", "#3a86ff"],
    windshield: "rgba(255,255,255,0.35)",
    truck: "#8d99ae",
    truckCab: "#edf2f4",
    wheel: "#050505",
    log: "#7a4a21",
    logLine: "#4d2c12",
    turtle: "#2ecc71",
    turtleScale: "#1a8f4c",
    turtleSubmerged: "rgba(46,204,113,0.35)",
    timeOk: "#00ff88",
    timeMid: "#f5ff00",
    timeLow: "#ff006e",
  },
  // Consola de 8 bits: gama corta tipo NES, tonos cálidos, mediana morada y
  // tortugas rojas como el arcade original; sin glow ni alpha.
  retro: {
    hudBg: "#14100a",
    hudText: "#f8f0d0",
    road: "#141010",
    roadLine: "#806040",
    river: "#10204a",
    riverWave: "#4868b0",
    safe: "#644494",
    goalBg: "#2a1a0e",
    goalMouth: "#3c5a1c",
    goalBorder: "#f8b800",
    frog: "#b8f818",
    frogEye: "#14100a",
    frogPupil: "#f8f0d0",
    frogOutline: "#14100a",
    cars: ["#f83800", "#f8b800", "#f878f8"],
    windshield: "rgba(20,16,10,0.55)",
    truck: "#a4a4a4",
    truckCab: "#fcfcfc",
    wheel: "#050505",
    log: "#c87c30",
    logLine: "#6c3c10",
    turtle: "#f85838",
    turtleScale: "#901800",
    turtleSubmerged: "#c85040",
    timeOk: "#b8f818",
    timeMid: "#f8b800",
    timeLow: "#f83800",
  },
};

const KEY_TO_DIR: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

const DIR_DELTA: Record<Direction, { dc: number; dr: number }> = {
  up: { dc: 0, dr: -1 },
  down: { dc: 0, dr: 1 },
  left: { dc: -1, dr: 0 },
  right: { dc: 1, dr: 0 },
};

const DIR_ANGLE: Record<Direction, number> = {
  up: 0,
  right: Math.PI / 2,
  down: Math.PI,
  left: -Math.PI / 2,
};

const isRiverRow = (row: number) =>
  row >= ROW_RIVER_TOP && row <= ROW_RIVER_BOT;

/**
 * Elipses de la rana [x, y, rx, ry, dirReach]: patas delanteras y traseras por
 * lado, y cuerpo 28×24. `dirReach` (±1/0) escala la extensión de las patas al saltar.
 */
const FROG_PARTS: readonly (readonly [
  number,
  number,
  number,
  number,
  number,
])[] = [
  [-13, -6, 4, 5, -1],
  [-13, 8, 5, 6, 1],
  [13, -6, 4, 5, -1],
  [13, 8, 5, 6, 1],
  [0, 0, 14, 12, 0],
];

export class FroggerGame implements ArcadeGame {
  private ctx: CanvasRenderingContext2D;
  private callbacks: GameCallbacks;
  private palette: FroggerPalette;

  private lanes: Lane[] = [];
  private frog: Frog = this.newFrog();
  private facing: Direction = "up";
  private pendingDir: Direction | null = null;

  private score = 0;
  private lives = START_LIVES;
  private level = 1;
  private goals: boolean[] = Array(GOAL_COUNT).fill(false);
  /** Fila más alta alcanzada en esta vida/ronda (para los +10 por avance). */
  private maxRow = ROW_START;
  private timeLeft = roundTimeMs(1);
  /** Reloj global (ms) que gobierna el ciclo de inmersión de las tortugas. */
  private elapsed = 0;
  private state: "playing" | "gameover" = "playing";

  /** Fondo estático (zonas, ondas, líneas, marcos de metas) ya pintado. */
  private bgCache: HTMLCanvasElement | null = null;
  /** Desplazamiento (celdas) de cada carril en el frame actual, por fila. Se reutiliza. */
  private readonly laneShift = new Float64Array(ROWS);

  private rafId: number | null = null;
  private lastTime: number | null = null;
  private gameOverFired = false;

  private prevScore = 0;
  private prevLives = START_LIVES;
  private prevLevel = 1;

  private handleKeyDown = (e: KeyboardEvent) => {
    const dir = KEY_TO_DIR[e.key];
    if (!dir) return;
    e.preventDefault();
    if (e.repeat) return; // una pulsación = un salto
    this.pendingDir = dir;
  };

  constructor(
    ctx: CanvasRenderingContext2D,
    callbacks: GameCallbacks,
    skin: SkinId = DEFAULT_SKIN,
  ) {
    this.ctx = ctx;
    this.callbacks = callbacks;
    this.palette = FROGGER_PALETTES[skin] ?? FROGGER_PALETTES[DEFAULT_SKIN];
    this.lanes = buildLanes(this.level);
    window.addEventListener("keydown", this.handleKeyDown);
  }

  private newFrog(): Frog {
    return {
      col: START_COL,
      row: ROW_START,
      animating: false,
      animT: 0,
      targetCol: START_COL,
      targetRow: ROW_START,
    };
  }

  // --- Update -------------------------------------------------------------

  private update(dtMs: number) {
    this.elapsed += dtMs;
    this.moveEntities(dtMs);

    // La rana en el río viaja con lo que la sostiene.
    if (!this.frog.animating && isRiverRow(this.frog.row)) {
      if (this.getSupport()) {
        this.frog.col += this.laneShift[this.frog.row];
      }
    }

    if (!this.frog.animating && this.pendingDir) {
      this.startJump(this.pendingDir);
    } else if (this.frog.animating) {
      this.frog.animT += dtMs;
      if (this.frog.animT >= JUMP_MS) this.finishJump();
    }
    if (this.state !== "playing") return;

    if (!this.frog.animating) this.checkHazards();
    if (this.state !== "playing") return;

    this.timeLeft -= dtMs;
    if (this.timeLeft <= 0) this.killFrog();
  }

  /** Avanza cada entidad en su carril y deja el desplazamiento (celdas) por fila en `laneShift`. */
  private moveEntities(dtMs: number): void {
    for (const lane of this.lanes) {
      const delta = (lane.speed * lane.dir * (dtMs / 16)) / CELL;
      this.laneShift[lane.row] = delta;
      for (const e of lane.entities) {
        e.col += delta;
        // Anillo de LOOP_CELLS: al salir por un lado reentra por el opuesto sin
        // alterar los huecos entre entidades.
        if (e.col >= COLS + LOOP_MARGIN) e.col -= LOOP_CELLS;
        else if (e.col < -LOOP_MARGIN) e.col += LOOP_CELLS;
        if (e.type === "turtle") {
          const cycle = TURTLE_VISIBLE_MS + TURTLE_SUBMERGED_MS;
          e.submerged =
            (this.elapsed + (e.phase ?? 0)) % cycle >= TURTLE_VISIBLE_MS;
        }
      }
    }
  }

  private startJump(dir: Direction) {
    this.pendingDir = null;
    this.facing = dir;
    const { dc, dr } = DIR_DELTA[dir];
    const targetCol = this.frog.col + dc;
    const targetRow = this.frog.row + dr;
    // No se sale de los bordes laterales ni de la cuadrícula.
    if (targetCol < 0 || targetCol > COLS - 1) return;
    if (targetRow < 0 || targetRow > ROW_START) return;
    this.frog.animating = true;
    this.frog.animT = 0;
    this.frog.targetCol = targetCol;
    this.frog.targetRow = targetRow;
  }

  private finishJump() {
    const f = this.frog;
    f.col = f.targetCol;
    f.row = f.targetRow;
    f.animating = false;
    f.animT = 0;
    // Fuera del río la rana vuelve a la cuadrícula entera (venía de un tronco).
    if (!isRiverRow(f.row)) f.col = Math.round(f.col);
    this.resolveLanding();
  }

  // --- Reglas (Pasos 5–7 del plan) ------------------------------------------

  /** La rana ocupa la celda [col, col+1); se compara su centro con el rango de la entidad. */
  private static covers(e: Entity, frog: Frog): boolean {
    const center = frog.col + 0.5;
    return center >= e.col && center < e.col + e.width;
  }

  private laneAt(row: number): Lane | undefined {
    return this.lanes.find((l) => l.row === row);
  }

  /** ¿Hay un vehículo sobre la rana en su carril de carretera? */
  private checkRoadCollision(): boolean {
    const { frog } = this;
    if (frog.row < ROW_ROAD_TOP || frog.row > ROW_ROAD_BOT) return false;
    const lane = this.laneAt(frog.row);
    return !!lane?.entities.some((e) => FroggerGame.covers(e, frog));
  }

  /** Entidad de río que sostiene a la rana, o null (agua o tortuga sumergida). */
  private getSupport(): Entity | null {
    const { frog } = this;
    if (!isRiverRow(frog.row)) return null;
    const lane = this.laneAt(frog.row);
    const hit = lane?.entities.find((e) => FroggerGame.covers(e, frog));
    if (!hit || (hit.type === "turtle" && hit.submerged)) return null;
    return hit;
  }

  /** Índice de la boca bajo la rana en la fila de metas, o -1 si cae en el muro. */
  private goalIndexAt(): number {
    const col = Math.round(this.frog.col);
    for (let i = 0; i < GOAL_COUNT; i++) {
      if (col >= goalCol(i) && col <= goalCol(i) + 1) return i;
    }
    return -1;
  }

  /** Cada frame con la rana quieta: vehículo, agua, tortuga sumergida o borde del río. */
  private checkHazards() {
    const { frog } = this;
    if (this.checkRoadCollision()) {
      this.killFrog();
    } else if (isRiverRow(frog.row)) {
      const center = frog.col + 0.5;
      if (center < 0 || center > COLS || !this.getSupport()) this.killFrog();
    }
  }

  /** Al terminar un salto: +10 por fila nueva en la ronda y resolución de la fila de metas. */
  private resolveLanding() {
    const { frog } = this;
    if (frog.row < this.maxRow) {
      this.score += 10 * (this.maxRow - frog.row);
      this.maxRow = frog.row;
    }
    if (frog.row !== ROW_GOALS) return;

    const i = this.goalIndexAt();
    if (i === -1 || this.goals[i]) {
      this.killFrog();
      return;
    }
    this.goals[i] = true;
    this.score += 50 + Math.floor(this.timeLeft / 1000) * 10;
    if (this.goals.every(Boolean)) this.completeRound();
    else this.respawn();
  }

  /** Devuelve la rana a la fila de inicio y reinicia el temporizador. */
  private respawn() {
    this.frog = this.newFrog();
    this.facing = "up";
    this.pendingDir = null;
    this.timeLeft = roundTimeMs(this.level);
  }

  /** Las 5 bocas llenas: +200, siguiente nivel, carriles más rápidos y bocas vacías. */
  private completeRound() {
    this.score += 200;
    this.level += 1;
    this.goals = Array(GOAL_COUNT).fill(false);
    this.maxRow = ROW_START;
    this.lanes = buildLanes(this.level);
    this.respawn(); // rana al inicio y temporizador del nuevo nivel
  }

  /**
   * Muerte de la rana: −1 vida y de vuelta al inicio. Con 0 vidas pasa a game over;
   * el loop emite `onLivesChange(0)` y justo después `onGameOver(score)`.
   */
  private killFrog() {
    if (this.state !== "playing") return;
    this.lives -= 1;
    if (this.lives <= 0) {
      this.lives = 0;
      this.state = "gameover";
      return;
    }
    this.respawn();
  }

  // --- Draw ---------------------------------------------------------------

  private draw() {
    const { ctx } = this;
    ctx.clearRect(0, 0, W, H);
    this.drawHud();

    ctx.save();
    ctx.translate(0, HUD_H);
    if (this.bgCache === null) this.bgCache = this.buildBackground();
    ctx.drawImage(this.bgCache, 0, 0, W, ROWS * CELL);
    this.drawGoalFrogs();
    for (const lane of this.lanes) {
      for (const e of lane.entities) this.drawEntity(lane, e);
    }
    this.drawFrog();
    ctx.restore();
  }

  /**
   * Pinta una vez el fondo estático (zonas, ondas, líneas, marcos de metas) en
   * un canvas offscreen a la escala real del contexto, para que el blit por
   * frame sea igual de nítido que dibujarlo directo.
   */
  private buildBackground(): HTMLCanvasElement {
    const scale = this.ctx.getTransform().a;
    const cache = document.createElement("canvas");
    cache.width = Math.round(W * scale);
    cache.height = Math.round(ROWS * CELL * scale);
    const bg = cache.getContext("2d")!;
    bg.setTransform(scale, 0, 0, scale, 0, 0);
    this.drawZones(bg);
    this.drawGoalFrames(bg);
    return cache;
  }

  private drawZones(ctx: CanvasRenderingContext2D) {
    for (let row = 0; row < ROWS; row++) {
      let color = this.palette.safe;
      if (row === ROW_GOALS) color = this.palette.goalBg;
      else if (isRiverRow(row)) color = this.palette.river;
      else if (row >= ROW_ROAD_TOP && row <= ROW_ROAD_BOT)
        color = this.palette.road;
      ctx.fillStyle = color;
      ctx.fillRect(0, row * CELL, W, CELL);
    }
    // Ondas del río y líneas discontinuas de la carretera.
    ctx.fillStyle = this.palette.riverWave;
    for (let row = ROW_RIVER_TOP; row <= ROW_RIVER_BOT; row++) {
      for (let c = 0; c < COLS; c += 2) {
        ctx.fillRect(c * CELL + ((row % 2) * CELL) / 2, row * CELL + 18, 20, 3);
      }
    }
    ctx.strokeStyle = this.palette.roadLine;
    ctx.lineWidth = 2;
    ctx.setLineDash([16, 16]);
    for (let row = ROW_ROAD_TOP + 1; row <= ROW_ROAD_BOT; row++) {
      ctx.beginPath();
      ctx.moveTo(0, row * CELL);
      ctx.lineTo(W, row * CELL);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  private drawGoalFrames(ctx: CanvasRenderingContext2D) {
    for (let i = 0; i < GOAL_COUNT; i++) {
      const x = goalCol(i) * CELL;
      ctx.fillStyle = this.palette.goalMouth;
      ctx.fillRect(x + 2, 4, CELL * 2 - 4, CELL - 8);
      ctx.strokeStyle = this.palette.goalBorder;
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 2, 4, CELL * 2 - 4, CELL - 8);
    }
  }

  /** Las ranas en las bocas cambian durante la partida: no van en el caché. */
  private drawGoalFrogs() {
    for (let i = 0; i < GOAL_COUNT; i++) {
      if (this.goals[i]) {
        this.drawFrogShape(goalCol(i) * CELL + CELL, CELL / 2, 0, false, 0.9);
      }
    }
  }

  private drawEntity(lane: Lane, e: Entity) {
    const { ctx } = this;
    const x = e.col * CELL;
    const y = lane.row * CELL;
    const w = e.width * CELL;
    switch (e.type) {
      case "car": {
        ctx.fillStyle = this.palette.cars[lane.row % this.palette.cars.length];
        ctx.fillRect(x + 4, y + 8, w - 8, CELL - 16);
        ctx.fillStyle = this.palette.windshield;
        const wx = lane.dir === 1 ? x + w - 16 : x + 8;
        ctx.fillRect(wx, y + 12, 8, CELL - 24);
        this.drawWheels(x + 4, y, w - 8);
        break;
      }
      case "truck": {
        ctx.fillStyle = this.palette.truck;
        ctx.fillRect(x + 2, y + 6, w - 4, CELL - 12);
        ctx.fillStyle = this.palette.truckCab; // cabina en el frente
        const cabX = lane.dir === 1 ? x + w - 22 : x + 2;
        ctx.fillRect(cabX, y + 6, 20, CELL - 12);
        this.drawWheels(x + 4, y, w - 8);
        break;
      }
      case "log": {
        ctx.fillStyle = this.palette.log;
        ctx.fillRect(x + 1, y + 6, w - 2, CELL - 12);
        ctx.strokeStyle = this.palette.logLine;
        ctx.lineWidth = 2;
        for (let lx = x + 12; lx < x + w - 6; lx += 18) {
          ctx.beginPath();
          ctx.moveTo(lx, y + 9);
          ctx.lineTo(lx + 6, y + CELL - 9);
          ctx.stroke();
        }
        break;
      }
      case "turtle": {
        for (let i = 0; i < e.width; i++) {
          const cx = x + i * CELL + CELL / 2;
          const cy = y + CELL / 2;
          ctx.beginPath();
          ctx.arc(cx, cy, 15, 0, Math.PI * 2);
          if (e.submerged) {
            ctx.strokeStyle = this.palette.turtleSubmerged;
            ctx.lineWidth = 2;
            ctx.stroke();
          } else {
            ctx.fillStyle = this.palette.turtle;
            ctx.fill();
            ctx.strokeStyle = this.palette.turtleScale;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy, 8, 0, Math.PI * 2);
            ctx.moveTo(cx - 15, cy);
            ctx.lineTo(cx + 15, cy);
            ctx.moveTo(cx, cy - 15);
            ctx.lineTo(cx, cy + 15);
            ctx.stroke();
          }
        }
        break;
      }
    }
  }

  private drawWheels(x: number, y: number, w: number) {
    const { ctx } = this;
    ctx.fillStyle = this.palette.wheel;
    for (let i = 0; i < 2; i++) {
      const wx = i === 0 ? x + 8 : x + w - 8;
      for (let j = 0; j < 2; j++) {
        const wy = j === 0 ? y + 8 : y + CELL - 8;
        ctx.beginPath();
        ctx.arc(wx, wy, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawFrog() {
    const f = this.frog;
    const t = f.animating ? Math.min(f.animT / JUMP_MS, 1) : 0;
    const col = f.col + (f.targetCol - f.col) * t;
    const row = f.row + (f.targetRow - f.row) * t;
    this.drawFrogShape(
      (col + 0.5) * CELL,
      (row + 0.5) * CELL,
      DIR_ANGLE[this.facing],
      f.animating,
      1 + 0.15 * Math.sin(Math.PI * t),
    );
  }

  /** Rana apuntando hacia arriba en coordenadas locales; `jumping` extiende las patas. */
  private drawFrogShape(
    cx: number,
    cy: number,
    angle: number,
    jumping: boolean,
    scale: number,
  ) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    const reach = jumping ? 8 : 0;
    const { frogOutline } = this.palette;
    if (frogOutline) {
      // Contorno bajo el relleno: separa la rana de troncos y tortugas claros.
      ctx.strokeStyle = frogOutline;
      ctx.lineWidth = 3;
      for (let i = 0; i < FROG_PARTS.length; i++) {
        const p = FROG_PARTS[i];
        ctx.beginPath();
        ctx.ellipse(p[0], p[1] + p[4] * reach, p[2], p[3], 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.fillStyle = this.palette.frog;
    for (let i = 0; i < FROG_PARTS.length; i++) {
      const p = FROG_PARTS[i];
      ctx.beginPath();
      ctx.ellipse(p[0], p[1] + p[4] * reach, p[2], p[3], 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const sx of [-1, 1]) {
      ctx.fillStyle = this.palette.frogEye;
      ctx.beginPath();
      ctx.arc(sx * 6, -9, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = this.palette.frogPupil;
      ctx.beginPath();
      ctx.arc(sx * 6, -10, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawHud() {
    const { ctx } = this;
    ctx.fillStyle = this.palette.hudBg;
    ctx.fillRect(0, 0, W, HUD_H);
    ctx.fillStyle = this.palette.hudText;
    ctx.font = "bold 16px monospace";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(`SCORE ${String(this.score).padStart(6, "0")}`, 12, 14);
    ctx.textAlign = "center";
    ctx.fillText(`NIVEL ${this.level}`, W / 2, 14);
    for (let i = 0; i < this.lives; i++) {
      ctx.fillStyle = this.palette.frog;
      ctx.beginPath();
      ctx.arc(W - 20 - i * 24, 14, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    // Barra de tiempo: verde → amarillo → rojo.
    const ratio = Math.max(
      0,
      Math.min(1, this.timeLeft / roundTimeMs(this.level)),
    );
    ctx.fillStyle =
      ratio > 0.5
        ? this.palette.timeOk
        : ratio > 0.25
          ? this.palette.timeMid
          : this.palette.timeLow;
    ctx.fillRect(0, HUD_H - 12, W * ratio, 8);
  }

  // --- Ciclo de vida --------------------------------------------------------

  private emitChanges() {
    if (this.score !== this.prevScore) {
      this.prevScore = this.score;
      this.callbacks.onScoreChange(this.score);
    }
    if (this.lives !== this.prevLives) {
      this.prevLives = this.lives;
      this.callbacks.onLivesChange(this.lives);
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
    this.callbacks.onLivesChange(this.lives);
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
    this.lastTime = null; // descarta el dt acumulado durante la pausa
    this.rafId = requestAnimationFrame(this.loop);
  }

  /**
   * Cambia la paleta en caliente sin tocar estado, reloj ni listeners. Si el
   * loop no está vivo (pausa o game over), repinta una vez para verlo al instante.
   */
  setSkin(skin: SkinId): void {
    this.palette = FROGGER_PALETTES[skin] ?? FROGGER_PALETTES[DEFAULT_SKIN];
    this.bgCache = null;
    if (this.rafId === null) this.draw();
  }

  destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    window.removeEventListener("keydown", this.handleKeyDown);
  }

  /** Mismo flanco que el teclado: solo `pressed=true` encola un salto; A/B sin uso. */
  handleTouchInput(action: TouchAction, pressed: boolean): void {
    if (!pressed) return;
    if (
      action === "up" ||
      action === "down" ||
      action === "left" ||
      action === "right"
    ) {
      this.pendingDir = action;
    }
  }
}
