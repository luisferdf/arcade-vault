# SPEC 08 — Juego real: Arkanoid

> **Estado:** implementado
> **Depende de:** 06-leaderboard-catalogo-supabase (tablas `games`/`scores`, `getGames`/`getGameById`/`saveScore`), 07-juego-tetris (base genérica de motores `lib/games/engine.ts` + `lib/games/registry.ts`)
> **Fecha:** 2026-08-18
> **Objetivo:** Agregar "Arkanoid" como juego nuevo y jugable en el catálogo (id `arkanoid`), con motor real adaptado de `references/started-games/04-arkanoid/game.js`, registrado en `lib/games/registry.ts` e integrado al HUD y la pausa ya existentes del Reproductor. `bloque-buster` queda intacto y sin relación con esta spec.

## Alcance

**Incluido:**

- Nueva fila en la tabla `games` de Supabase con `id: "arkanoid"`, categoría `ARCADE`, textos propios, `cover: "cover-arkanoid"`, `color: "cyan"`, `available: true` desde el momento en que termine la implementación.
- Motor del juego portado a `lib/games/arkanoid.ts`: paleta, pelota, bloques con colisión AABB, animación de rotura procedural (sin spritesheet), vidas, 5 niveles con velocidad creciente, puntuación — fiel a `game.js`/`levels.js` originales, sin recortes de mecánica.
- Niveles portados a `lib/games/arkanoid-levels.ts` (equivalente tipado de `levels.js`).
- Controles duales: teclado (flechas ← →) **y** mouse (mover la paleta con el cursor sobre el canvas), igual que el original.
- HUD propio dibujado dentro del canvas (score, nivel, vidas) conservado, coexistiendo con el HUD del Reproductor — ambos alimentados por el mismo estado del motor, igual que en Asteroides.
- Overlay de pausa propio con selector de nivel por clic (1–5), conservado tal cual del original por decisión explícita, aunque puede desincronizarse del botón PAUSA del Reproductor (ver Riesgos). Su eliminación queda para un spec futuro.
- Estado de "victoria" (completar los 5 niveles) tratado exactamente igual que un game over por 0 vidas: dispara `onGameOver(scoreFinal)` y abre el mismo modal de fin del Reproductor, sin ningún mensaje ni estilo distinto — el modal ya es neutro ("FIN DEL JUEGO" / "PUNTUACIÓN FINAL").
- Recoloreo completo a la paleta neón: bloques usan los 4 tokens del tema (`--cyan`, `--magenta`, `--yellow`, `--green`) más 2 tonos neón nuevos definidos en el motor para cubrir los colores `red` y `hotpink` del original, y un tono neutro atenuado para `gray`. Paleta y pelota se dibujan a mano en `cyan` (mismo color para ambas). Todo dibujado proceduralmente con el `CanvasRenderingContext2D` — no se porta el spritesheet PNG.
- Registro en `lib/games/registry.ts`: una entrada `arkanoid` (`width: 800`, `height: 600`, `usesLives: true`, sin `extraStats`), sin tocar `GamePlayerClient.tsx`.
- Nueva clase CSS `.cover-arkanoid` en `app/globals.css` para la portada del catálogo, distinta de `.cover-bricks` (que sigue perteneciendo al mock `bloque-buster`).
- Guardado de puntuación al finalizar usa el flujo existente (`saveScore` de `lib/scores.ts`) con `gameId: "arkanoid"`, reflejándose en el Detalle y el Salón de la Fama sin cambios en esas pantallas.

**Fuera de alcance (para specs futuros):**

- Cualquier cambio a `bloque-buster` o a los demás juegos del catálogo — quedan exactamente como están.
- Sonido/música (`ball-bounce.mp3`, `break-sound.mp3` del original no se portan).
- Controles táctiles/on-screen para móvil.
- Tests automatizados.
- Ajustes de dificultad/balance distintos a los del original.
- Autenticación.
- Eliminar o rediseñar el selector de nivel del overlay de pausa (se conserva en esta spec; su remoción queda anotada como trabajo futuro).

## Modelo de datos

**Nueva fila en `games`** (vía `apply_migration` / `execute_sql`, mismas columnas que las demás filas ya sembradas):

```sql
insert into public.games (id, title, short, long, cat, cover, color, available)
values (
  'arkanoid',
  'ARKANOID',
  'Rompe bloques a golpe de pelota y paleta a través de 5 niveles crecientes.',
  'Controla una paleta y rebota la pelota contra hileras de bloques de colores. Limpia los 5 niveles —cada uno con un patrón distinto y la pelota más rápida que el anterior— sin dejar caer la pelota más de 3 veces.',
  'ARCADE',
  'cover-arkanoid',
  'cyan',
  true
);
```

**Niveles (`lib/games/arkanoid-levels.ts`)** — mismo contenido que `levels.js`, tipado:

```ts
export interface ArkanoidBlock {
  col: number;
  row: number;
  color: BlockColor;
}

export interface ArkanoidLevel {
  speed: number;
  blocks: ArkanoidBlock[];
}

export type BlockColor =
  "red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green" | "gray";

export const LEVELS: ArkanoidLevel[]; // 5 niveles, misma generación que el original
```

**Motor (`lib/games/arkanoid.ts`)** — implementa el contrato `ArcadeGame`/`GameCallbacks` de `lib/games/engine.ts` (sin interfaz propia nueva, a diferencia de `AsteroidsGame` que se escribió antes de existir la base genérica):

```ts
export const W = 800;
export const H = 600;

export class ArkanoidGame implements ArcadeGame {
  constructor(ctx: CanvasRenderingContext2D, callbacks: GameCallbacks);
  start(): void; // arranca requestAnimationFrame, listeners de teclado y mouse
  pause(): void; // congela el loop externo (botón PAUSA del Reproductor)
  resume(): void; // reanuda sin salto de dt
  destroy(): void; // cancela el rAF y remueve todos los listeners (keydown/keyup/mousemove/click)
}
```

**Tokens de color** usados por el motor (hardcodeados en `arkanoid.ts`, como hace `asteroids.ts`):

| Color original    | Token/valor en el motor                                  |
| ----------------- | -------------------------------------------------------- |
| `cyan`            | `var(--cyan)` `#00f5ff`                                  |
| `magenta`         | `var(--magenta)` `#ff006e`                               |
| `yellow`          | `var(--yellow)` `#f5ff00`                                |
| `green`           | `var(--green)` `#00ff88`                                 |
| `red`             | nuevo tono neón, ej. `#ff3b3b`                           |
| `hotpink`         | nuevo tono neón, ej. `#ff4fd8` (distinguible de magenta) |
| `gray`            | tono neutro atenuado, ej. `#8a8aa0`                      |
| Paleta y pelota   | `var(--cyan)` (mismo color para ambas)                   |
| Texto HUD interno | `var(--cyan)`                                            |
| Fondo             | `#0a0a0f` (tema, en vez del `#000` original)             |

No se introducen tablas ni columnas nuevas: la puntuación sigue insertándose en `scores` vía `saveScore()` de `lib/scores.ts` con `gameId: "arkanoid"`.

## Plan de implementación

1. Insertar la fila `arkanoid` en `games` (según el modelo de datos) vía `apply_migration` o `execute_sql`. Prueba manual: el juego aparece en `/biblioteca`, filtrable por categoría `ARCADE`, y `/juego/arkanoid` carga con su leaderboard vacío, sin errores en consola.
2. Crear la clase `.cover-arkanoid` en `app/globals.css` (grid de bloques de colores, distinta visualmente de `.cover-bricks`). Prueba manual: la tarjeta de Biblioteca y la portada del Detalle muestran la nueva portada.
3. Crear `lib/games/arkanoid-levels.ts` portando `LEVELS` desde `levels.js` con los tipos del modelo de datos. Prueba manual: `tsc --noEmit` compila sin errores; el archivo no se importa aún desde ninguna página.
4. Crear `lib/games/arkanoid.ts`: paleta, pelota, bloques, colisiones AABB, animación de rotura procedural (sustituye los 4 frames de sprite por un efecto simple, ej. partículas o destello que se desvanece en `EXPLOSION_DURATION` ms), niveles, vidas, score, HUD interno del canvas, controles de teclado (← →) y mouse (`mousemove` sobre el canvas), y el overlay de pausa con selector de nivel por clic — todo parametrizado por `ctx`/`W`/`H` (sin `document.getElementById` ni canvas global), implementando `ArcadeGame` (`start`/`pause`/`resume`/`destroy`) y disparando `onScoreChange`/`onLivesChange`/`onLevelChange`/`onGameOver` (tanto al perder la última vida como al completar el nivel 5). Prueba manual: `tsc --noEmit` compila sin errores; el archivo no se importa aún desde ninguna página.
5. Registrar el motor en `lib/games/registry.ts`: agregar la entrada `arkanoid` (`width: W`, `height: H`, `usesLives: true`, `create: (ctx, callbacks) => new ArkanoidGame(ctx, callbacks)`), sin tocar `GamePlayerClient.tsx`. Prueba manual: entrar a `/juego/arkanoid/jugar` muestra el canvas real corriendo (no el `game-arena` simulado), y el HUD superior del Reproductor refleja puntuación/vidas/nivel en tiempo real.
6. Verificar la interacción entre la pausa externa (botón PAUSA del Reproductor → `engine.pause()`/`resume()`) y la pausa interna del motor (tecla P/Escape + clic en el selector de nivel del overlay): confirmar manualmente que pausar desde el botón del Reproductor congela paleta/pelota/bloques por completo, que P/Escape dentro del canvas también pausa/reanuda, y que clicar un botón de nivel durante la pausa salta de nivel y reanuda el juego. Documentar en el propio código (comentario breve) si el botón PAUSA del HUD del Reproductor puede quedar visualmente desincronizado tras usar el selector de nivel (riesgo ya aceptado para esta spec).
7. Verificar el flujo de guardado de puntuación y Salón de la Fama con `gameId: "arkanoid"`: jugar, perder (o completar el nivel 5), guardar con iniciales, y confirmar que aparece en el Detalle de `arkanoid` y en `app/salon/page.tsx`. Prueba manual: recorrido completo Biblioteca → Detalle → Reproductor → Fin (derrota) → Guardar → Detalle/Salón, sin errores de consola; repetir completando los 5 niveles para confirmar que "victoria" también abre el modal de fin correctamente.
8. Verificación final: `npm run build` compila sin errores de TypeScript, y las pantallas existentes (incluyendo `bloque-buster` y los demás juegos mock, y los motores reales `asteroides`/`tetris`) siguen funcionando exactamente igual que antes de esta spec. Prueba manual: recorrer Biblioteca, Detalle y Reproductor de `bloque-buster` para confirmar que el `game-arena` simulado no fue afectado, y una partida rápida de `asteroides` o `tetris` para confirmar que el registro compartido sigue funcionando para ambos.

## Criterios de aceptación

- [x] `games` incluye una fila con `id: "arkanoid"`, categoría `ARCADE`, `available: true`, y el juego aparece en `/biblioteca` filtrable por búsqueda y por categoría.
- [x] `/juego/arkanoid` (Detalle) muestra la info real del juego y un leaderboard (top 10) vía `getTopScoresByGame`, inicialmente vacío.
- [x] En `/juego/arkanoid/jugar`, el `game-arena` simulado es reemplazado por un `<canvas>` que corre el motor real de `lib/games/arkanoid.ts`, registrado en `lib/games/registry.ts`.
- [x] La paleta se mueve tanto con el mouse como con las flechas ← →.
- [x] La pelota rebota correctamente contra paredes, paleta y bloques, y rompe un bloque por colisión (10 puntos cada uno).
- [x] Los 5 niveles cargan con sus patrones de bloques y velocidades correspondientes, en el mismo orden que el original.
- [x] Perder las 3 vidas dispara `onGameOver` con el score final y abre el modal de fin automáticamente.
- [x] Completar el nivel 5 (limpiar todos los bloques) también dispara `onGameOver` con el score final y abre el mismo modal de fin, sin mensaje ni estilo distinto al de la derrota.
- [x] El HUD superior del Reproductor (puntuación, vidas, nivel) se actualiza en tiempo real, coexistiendo con el HUD propio dibujado dentro del canvas, ambos mostrando los mismos valores.
- [x] El botón PAUSA del Reproductor congela por completo el loop del motor (posiciones exactas de paleta/pelota/bloques no cambian) y REANUDAR continúa sin salto brusco.
- [x] La tecla P/Escape dentro del canvas también pausa/reanuda, y el overlay de pausa muestra el selector de nivel (1–5); clicar un nivel salta a ese nivel y reanuda el juego.
- [x] El botón FIN del Reproductor sigue abriendo el modal de fin manualmente en cualquier momento.
- [x] Guardar la puntuación en el modal inserta una fila real en `scores` con `game_id: "arkanoid"` y aparece reflejada en el Detalle de `arkanoid` y en el Salón de la Fama.
- [x] Salir del Reproductor detiene el loop del motor y no deja `requestAnimationFrame` corriendo en background.
- [x] El `<canvas>` se adapta a móvil y desktop sin distorsionar el dibujo, manteniendo la resolución lógica interna 800×600.
- [x] Los bloques, paleta, pelota y HUD interno usan los tokens de color definidos en el modelo de datos (paleta neón del Vault + los 2 tonos nuevos para `red`/`hotpink` + el tono neutro para `gray`), no los sprites ni el blanco/negro original.
- [x] `bloque-buster` y los demás juegos del catálogo (incluyendo `asteroides` y `tetris`) no cambian su comportamiento ni apariencia.
- [x] `npm run build` compila sin errores de TypeScript.
- [x] No hay errores en la consola del navegador durante el recorrido completo Biblioteca → Detalle → Reproductor → Fin (derrota y victoria) → Guardar → Detalle/Salón.

## Decisiones tomadas y descartadas

- **Sí:** "Arkanoid" es un juego nuevo e independiente (`id: "arkanoid"`), no una reactivación de la entrada mock `bloque-buster`. Razón: decisión explícita del usuario, misma lógica que Asteroides vs Rocas — evita acoplar el juego real a un mock que podría no coincidir en mecánica exacta; `bloque-buster` no se toca.
- **Sí:** El motor implementa directamente el contrato `ArcadeGame`/`GameCallbacks` de `lib/games/engine.ts` y se registra en `lib/games/registry.ts`, sin definir una interfaz de callbacks propia (a diferencia de `AsteroidsGame`, escrito antes de que existiera la base genérica). Razón: la base genérica ya existe (spec 07); usarla evita divergencia y mantiene `GamePlayerClient.tsx` sin cambios.
- **Sí:** Se conservan ambos controles, mouse y teclado, en vez de recortar a solo teclado como el resto del Vault. Razón: decisión explícita del usuario.
- **Sí:** El HUD propio dibujado dentro del canvas se conserva coexistiendo con el HUD del Reproductor. Razón: decisión explícita del usuario, mismo patrón que Asteroides.
- **Sí:** El selector de nivel por clic en el overlay de pausa se conserva tal cual del original en esta spec. Razón: decisión explícita del usuario ("lo conservamos, más adelante lo quitamos"); su eliminación queda anotada como trabajo de un spec futuro, con el riesgo de desincronización documentado abajo.
- **Sí:** El estado de "victoria" (completar el nivel 5) se trata exactamente igual que un game over por 0 vidas, sin mensaje ni estilo distinto. Razón: decisión explícita del usuario — el modal del Reproductor ya es neutro, no hace falta un camino visual separado.
- **Sí:** Los bloques se recolorean con los 4 tokens del tema más 2 tonos neón nuevos (para `red`/`hotpink`) y un tono neutro atenuado (para `gray`), en vez de limitarse solo a los 4 tokens oficiales. Razón: decisión explícita del usuario, para conservar la variedad visual de colores del original.
- **Sí:** Paleta y pelota se dibujan a mano en `cyan` (mismo color para ambas) en vez de usar sprites. Razón: decisión explícita del usuario, consistente con el color asignado al juego en el catálogo.
- **Sí:** No se porta el spritesheet PNG ni los efectos de sonido del original; todo el dibujo es procedural con `CanvasRenderingContext2D`. Razón: al decidir recolorear a mano con la paleta del Vault, el spritesheet deja de ser necesario para bloques/paleta/pelota; portar solo la animación de rotura desde sprites sin el resto del spritesheet añadiría complejidad de carga de assets sin beneficio — se reemplaza por un efecto procedural simple. El sonido queda fuera de alcance por defecto, igual que en Asteroides y Tetris.
- **No:** Controles táctiles en esta spec. Razón: el original es mouse/teclado y agregar táctil ahora ampliaría el alcance; queda para un spec futuro si se necesita soporte móvil real.

## Riesgos identificados

| Riesgo                                                                                                                                                                                                                                                                 | Mitigación                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El selector de nivel del overlay de pausa reanuda el juego internamente (clic → `loadLevel` + quitar pausa interna) sin pasar por el `resume()` que llama el botón PAUSA del Reproductor, dejando el estado `paused` de React desincronizado del estado real del motor | Aceptado como riesgo conocido para esta spec (decisión explícita del usuario de conservarlo por ahora); documentar el comportamiento en un comentario breve en `arkanoid.ts` y resolverlo en el spec futuro que elimine o rediseñe el selector. |
| Los listeners de mouse (`mousemove`, `click`) son adicionales a los de teclado del resto del catálogo; si no se remueven correctamente en `destroy()`, pueden mover la paleta de una instancia fantasma tras desmontar la página                                       | `destroy()` remueve explícitamente los cuatro listeners (`keydown`, `keyup`, `mousemove`, `click`) antes de que `start()` pueda volver a registrarlos, igual que en `asteroids.ts`.                                                             |
| Sustituir la animación de rotura por sprites por un efecto procedural puede verse visualmente pobre comparado con el original                                                                                                                                          | Revisar visualmente el efecto elegido durante el paso 8 del plan; ajustar duración/estilo si no se ve satisfactorio, sin necesidad de reintroducir el spritesheet.                                                                              |
| El tono neutro elegido para `gray` puede tener bajo contraste contra el fondo `#0a0a0f`                                                                                                                                                                                | Revisar visualmente el bloque `gray` (aparece en la fila superior del nivel 2) durante el paso 8 del plan, ajustando el valor hex si hace falta.                                                                                                |

## Qué **no** incluye este spec

- Sonido/música del juego original.
- Controles táctiles/on-screen para móvil.
- Tests automatizados.
- Ajustes de dificultad/balance distintos a los del original.
- Autenticación.
- Eliminación o rediseño del selector de nivel del overlay de pausa.
- Cualquier cambio a `bloque-buster` o a los demás juegos del catálogo.

Cada uno de estos, si se necesita, va en su propio spec.
