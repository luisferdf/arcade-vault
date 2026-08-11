// Motor de "Asteroides", portado de references/started-games/02-asteroids/game.js.
// Sin document.getElementById ni canvas global: W/H son la resolución lógica fija
// y el CanvasRenderingContext2D se recibe como parámetro en cada draw().

export const W = 800;
export const H = 600;

// Colores neón del Vault (mismos valores que --cyan/--magenta/--yellow/--green en app/globals.css).
const COLOR_SHIP = "#00f5ff";
const COLOR_BULLET = "#f5ff00";
const COLOR_ASTEROID = "#ff006e";
const COLOR_PARTICLE = "255, 255, 0"; // rgb de --yellow, para interpolar alpha
const COLOR_POWERUP = "#00ff88";
const COLOR_HUD = "#00f5ff";
const COLOR_THRUST = "rgba(255, 130, 0, 0.85)";

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap = (v: number, max: number) => ((v % max) + max) % max;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));

// Teclas del juego cuyo comportamiento por defecto del navegador (scroll de la
// página) debe bloquearse mientras el motor está activo.
const CONTROL_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Space",
]);

// ── Constants ─────────────────────────────────────────────────────────────────
const POWERUP_DROP_CHANCE = 0.15;
const POWERUP_DURATION = 5;
const POWERUP_TTL = 12;
const TRIPLE_SPREAD = 0.18;

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl = 1.1;
  radius = 2;
  dead = false;

  constructor(x: number, y: number, angle: number) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = COLOR_BULLET;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII = [0, 16, 30, 50]; // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32]; // velocidad base por tamaño
const POINTS = [0, 100, 50, 20]; // puntos por tamaño

class Asteroid {
  x: number;
  y: number;
  size: number;
  radius: number;
  dead = false;
  vx: number;
  vy: number;
  rotSpeed: number;
  rot: number;
  verts: [number, number][] = [];

  constructor(x: number, y: number, size = 3) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.radius = RADII[size];

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split(): Asteroid[] {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = COLOR_ASTEROID;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── PowerUp ───────────────────────────────────────────────────────────────────
class PowerUp {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius = 12;
  ttl = POWERUP_TTL;
  dead = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(20, 40);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;
    const pulse = 0.85 + Math.sin(performance.now() / 150) * 0.15;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = COLOR_POWERUP;
    ctx.lineWidth = 2;
    const r = this.radius * pulse;
    ctx.strokeRect(-r, -r, r * 2, r * 2);
    ctx.restore();
    ctx.fillStyle = COLOR_POWERUP;
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("3x", this.x, this.y);
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
interface KeyState {
  [code: string]: boolean;
}

class Ship {
  x = W / 2;
  y = H / 2;
  angle = -Math.PI / 2;
  vx = 0;
  vy = 0;
  radius = 12;
  thrusting = false;
  invincible = 3;
  shootCooldown = 0;
  dead = false;
  tripleShot = 0;

  reset() {
    this.x = W / 2;
    this.y = H / 2;
    this.angle = -Math.PI / 2;
    this.vx = 0;
    this.vy = 0;
    this.thrusting = false;
    this.invincible = 3;
    this.shootCooldown = 0;
    this.dead = false;
  }

  update(dt: number, keys: KeyState) {
    if (this.dead) return;
    if (this.invincible > 0) this.invincible -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.tripleShot > 0) this.tripleShot -= dt;

    const ROT = 3.5; // rad/s
    const THRUST = 260; // px/s²
    const DRAG = 0.987;

    if (keys["ArrowLeft"]) this.angle -= ROT * dt;
    if (keys["ArrowRight"]) this.angle += ROT * dt;

    this.thrusting = !!keys["ArrowUp"];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot(): Bullet[] {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (this.tripleShot > 0) {
      return [
        new Bullet(ox, oy, this.angle - TRIPLE_SPREAD),
        new Bullet(ox, oy, this.angle),
        new Bullet(ox, oy, this.angle + TRIPLE_SPREAD),
      ];
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0)
      return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = COLOR_SHIP;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";

    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo(20, 0); // nariz
    ctx.lineTo(-12, -9); // ala izquierda
    ctx.lineTo(-7, 0); // muesca trasera
    ctx.lineTo(-12, 9); // ala derecha
    ctx.closePath();
    ctx.stroke();

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8, 4);
      ctx.strokeStyle = COLOR_THRUST;
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  dead = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl = this.life;
  }

  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(${COLOR_PARTICLE}, ${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
type GameStateName = "playing" | "dead" | "gameover";

interface GameState {
  ship: Ship;
  bullets: Bullet[];
  asteroids: Asteroid[];
  particles: Particle[];
  powerUps: PowerUp[];
  score: number;
  lives: number;
  level: number;
  state: GameStateName;
  deadTimer: number;
  powerUpSpawned: boolean;
  killsSinceSpawn: number;
}

function spawnAsteroids(state: GameState, count: number) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    state.asteroids.push(new Asteroid(x, y, 3));
  }
}

function createGameState(): GameState {
  const state: GameState = {
    ship: new Ship(),
    bullets: [],
    asteroids: [],
    particles: [],
    powerUps: [],
    score: 0,
    lives: 3,
    level: 1,
    state: "playing",
    deadTimer: 0,
    powerUpSpawned: false,
    killsSinceSpawn: 0,
  };
  spawnAsteroids(state, 4);
  return state;
}

function nextLevel(state: GameState) {
  state.level++;
  state.bullets = [];
  state.particles = [];
  state.powerUps = [];
  state.powerUpSpawned = false;
  state.killsSinceSpawn = 0;
  state.ship.reset();
  spawnAsteroids(state, 3 + state.level);
}

function explode(state: GameState, x: number, y: number, count = 8) {
  for (let i = 0; i < count; i++) state.particles.push(new Particle(x, y));
}

function killShip(state: GameState) {
  explode(state, state.ship.x, state.ship.y, 14);
  state.ship.dead = true;
  state.lives--;
  if (state.lives <= 0) {
    state.state = "gameover";
  } else {
    state.state = "dead";
    state.deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function updateGame(
  state: GameState,
  dt: number,
  keys: KeyState,
  shootPressed: boolean,
) {
  if (state.state === "gameover") {
    state.particles.forEach((p) => p.update(dt));
    state.particles = state.particles.filter((p) => !p.dead);
    return;
  }

  if (state.state === "dead") {
    state.deadTimer -= dt;
    state.particles.forEach((p) => p.update(dt));
    state.particles = state.particles.filter((p) => !p.dead);
    state.asteroids.forEach((a) => a.update(dt));
    if (state.deadTimer <= 0) {
      state.state = "playing";
      state.ship.reset();
    }
    return;
  }

  // Disparar
  if (shootPressed) {
    state.bullets.push(...state.ship.tryShoot());
  }

  state.ship.update(dt, keys);
  state.bullets.forEach((b) => b.update(dt));
  state.asteroids.forEach((a) => a.update(dt));
  state.particles.forEach((p) => p.update(dt));
  state.powerUps.forEach((p) => p.update(dt));

  state.bullets = state.bullets.filter((b) => !b.dead);
  state.particles = state.particles.filter((p) => !p.dead);
  state.powerUps = state.powerUps.filter((p) => !p.dead);

  for (const p of state.powerUps) {
    if (!p.dead && dist(state.ship, p) < state.ship.radius + p.radius) {
      p.dead = true;
      state.ship.tripleShot = POWERUP_DURATION;
    }
  }

  // Bala vs asteroide
  const newAsteroids: Asteroid[] = [];
  for (const b of state.bullets) {
    for (const a of state.asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        state.score += POINTS[a.size];
        explode(state, a.x, a.y, a.size * 5);
        newAsteroids.push(...a.split());
        if (!state.powerUpSpawned) {
          state.killsSinceSpawn++;
          const guaranteed = state.killsSinceSpawn >= 5;
          if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
            state.powerUps.push(new PowerUp(a.x, a.y));
            state.powerUpSpawned = true;
          }
        }
      }
    }
  }
  state.asteroids = state.asteroids.filter((a) => !a.dead).concat(newAsteroids);
  state.bullets = state.bullets.filter((b) => !b.dead);

  // Nave vs asteroide
  if (state.ship.invincible <= 0) {
    for (const a of state.asteroids) {
      if (dist(state.ship, a) < state.ship.radius + a.radius * 0.82) {
        killShip(state);
        break;
      }
    }
  }

  // Nivel completado
  if (state.asteroids.length === 0) nextLevel(state);
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = COLOR_HUD;
  ctx.lineWidth = 1.2;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(9, 0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-6, 5);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawHUD(state: GameState, ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = COLOR_HUD;
  ctx.font = "15px monospace";

  ctx.textAlign = "left";
  ctx.fillText(`SCORE  ${state.score}`, 14, 26);

  ctx.textAlign = "center";
  ctx.fillText(`NIVEL ${state.level}`, W / 2, 26);

  for (let i = 0; i < state.lives; i++) drawLifeIcon(ctx, W - 16 - i * 22, 18);

  if (state.ship.tripleShot > 0) {
    ctx.textAlign = "left";
    ctx.fillStyle = COLOR_POWERUP;
    ctx.fillText(`3x  ${state.ship.tripleShot.toFixed(1)}s`, 14, 46);
  }
}

function drawGame(state: GameState, ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  state.particles.forEach((p) => p.draw(ctx));
  state.asteroids.forEach((a) => a.draw(ctx));
  state.powerUps.forEach((p) => p.draw(ctx));
  state.bullets.forEach((b) => b.draw(ctx));
  state.ship.draw(ctx);

  drawHUD(state, ctx);
}

// ── API pública ───────────────────────────────────────────────────────────────
export interface AsteroidsCallbacks {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export class AsteroidsGame {
  private ctx: CanvasRenderingContext2D;
  private callbacks: AsteroidsCallbacks;
  private state: GameState;
  private keys: KeyState = {};
  private justPressed: KeyState = {};
  private rafId: number | null = null;
  private lastTime: number | null = null;
  private gameOverFired = false;

  private prevScore: number;
  private prevLives: number;
  private prevLevel: number;

  private handleKeyDown = (e: KeyboardEvent) => {
    if (CONTROL_KEYS.has(e.code)) e.preventDefault();
    if (!this.keys[e.code]) this.justPressed[e.code] = true;
    this.keys[e.code] = true;
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };

  private loop = (ts: number) => {
    const dt =
      this.lastTime === null ? 0 : Math.min((ts - this.lastTime) / 1000, 0.05);
    this.lastTime = ts;

    const shootPressed = this.pressed("Space");
    updateGame(this.state, dt, this.keys, shootPressed);
    drawGame(this.state, this.ctx);
    this.emitChanges();

    if (this.state.state === "gameover") {
      if (!this.gameOverFired) {
        this.gameOverFired = true;
        this.callbacks.onGameOver(this.state.score);
      }
      return;
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  constructor(ctx: CanvasRenderingContext2D, callbacks: AsteroidsCallbacks) {
    this.ctx = ctx;
    this.callbacks = callbacks;
    this.state = createGameState();
    this.prevScore = this.state.score;
    this.prevLives = this.state.lives;
    this.prevLevel = this.state.level;
  }

  private pressed(code: string): boolean {
    const val = !!this.justPressed[code];
    this.justPressed[code] = false;
    return val;
  }

  private emitChanges() {
    if (this.state.score !== this.prevScore) {
      this.prevScore = this.state.score;
      this.callbacks.onScoreChange(this.state.score);
    }
    if (this.state.lives !== this.prevLives) {
      this.prevLives = this.state.lives;
      this.callbacks.onLivesChange(this.state.lives);
    }
    if (this.state.level !== this.prevLevel) {
      this.prevLevel = this.state.level;
      this.callbacks.onLevelChange(this.state.level);
    }
  }

  start(): void {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    this.callbacks.onScoreChange(this.state.score);
    this.callbacks.onLivesChange(this.state.lives);
    this.callbacks.onLevelChange(this.state.level);
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
  }
}
