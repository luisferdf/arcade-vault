# SPEC 07 — Juego real: Tetris

> **Estado:** implementado
> **Depende de:** 06-leaderboard-catalogo-supabase (tablas `games`/`scores`, `saveScore()`), 05-juego-asteroides (contrato `ArcadeGame`/`GameEngineEntry` en `lib/games/engine.ts` y su registro en `lib/games/registry.ts`)
> **Fecha:** 2026-08-17
> **Objetivo:** Agregar "Tetris" como juego nuevo y jugable en el catálogo (id `tetris`), con motor real adaptado de `references/started-games/03-tetris/game.js`, registrado en `lib/games/registry.ts` bajo el contrato `ArcadeGame` ya existente, sin tocar `GamePlayerClient.tsx` salvo el ajuste de ancho máximo para juegos verticales.

## Alcance

**Incluido:**

- Nueva fila en la tabla `games` de Supabase con `id: "tetris"`, `title: "TETRIS"`, categoría `PUZZLE`, `cover: "cover-tetro"` (clase ya existente en `app/globals.css`), `color: "cyan"`, `available: true`.
- Motor del juego portado a `lib/games/tetris.ts`, implementando la interfaz `ArcadeGame` de `lib/games/engine.ts`: tablero 10×20, las 8 piezas del original (7 estándar + la pieza "N"/tuerca), rotación con wall kicks, soft drop, hard drop, ghost piece, sistema de niveles/velocidad y puntuación — fiel al `game.js` original, sin recortes de mecánica.
- Preview de la siguiente pieza dibujada **dentro del mismo canvas** principal (no hay canvas secundario), en una zona reservada fuera del tablero de juego.
- HUD propio dibujado dentro del canvas (SCORE, LINES, LEVEL, NEXT), coexistiendo con el HUD superior del Reproductor — mismo patrón que Asteroides.
- Recoloreo del fondo del tablero y de la UI del canvas a los tokens neón del Vault (`--cyan`, fondo `#0a0a0f`); las piezas conservan sus 8 colores distintivos propios (versión neón-ificada de los del original) para mantener distinguibilidad entre tipos.
- Registro del motor en `lib/games/registry.ts` (una entrada nueva en `GAME_ENGINES`), con `usesLives: false` (Tetris no tiene vidas) y `extraStats: [{ key: "lines", label: "LÍNEAS" }]`, sin tocar `GamePlayerClient.tsx` en su lógica.
- Ajuste de CSS en `.crt`/`.crt-screen` (`app/globals.css`) para limitar el ancho máximo cuando `--arcade-aspect` es vertical (ej. `300 / 600`), evitando que el tablero quede desproporcionado en pantallas anchas.
- Controles solo de teclado, igual que el original: ←/→ mover, ↑ o X rotar, ↓ soft drop, Espacio hard drop, P pausa (además del botón PAUSA del Reproductor, que también controla `pause()`/`resume()` del motor).
- Sincronización del motor como fuente de verdad: expone callbacks (`onScoreChange`, `onLevelChange`, `onStatChange("lines", …)`, `onGameOver`) que actualizan el HUD superior del Reproductor y disparan el modal de fin de juego automáticamente cuando una pieza nueva colisiona al aparecer (game over clásico de Tetris).
- Pausa real vía `pause()`/`resume()` del motor (congela el loop por completo, sin salto de `dt` al reanudar), igual que Asteroides.
- Guardado de puntuación al finalizar usa el flujo existente (`saveScore({ gameId: "tetris", name, score })` de `lib/scores.ts`), reflejándose en el Detalle de `tetris` y el Salón de la Fama sin cambios en esas pantallas.

**Fuera de alcance (para specs futuros):**

- Cualquier cambio a otros juegos del catálogo (`asteroides`, o los que aún usan el `game-arena` simulado) — quedan exactamente como están.
- Controles táctiles/on-screen para móvil.
- Sonido/música.
- Tests automatizados.
- Ajustes de dificultad/balance distintos a los del `game.js` original.
- Autenticación/login — el guardado de puntuación sigue con `user_id: null`, como el resto del MVP.

## Modelo de datos

**Nueva fila en `games`** (Supabase, vía `apply_migration` o `execute_sql`, mismas columnas reales de la tabla — ver `specs/06-leaderboard-catalogo-supabase.md`):

```sql
insert into public.games (id, title, short, long, cat, cover, color, available)
values (
  'tetris',
  'TETRIS',
  'El clásico de las piezas que caen: encaja, completa líneas y sube de nivel.',
  'Rota y desplaza las 8 piezas del tablero de 10×20 para completar líneas horizontales antes de que se acumulen hasta el techo. Usa la pieza fantasma para planear la caída, acelera con soft drop o remata con hard drop, y sube de nivel cada 10 líneas mientras la velocidad de caída aumenta.',
  'PUZZLE',
  'cover-tetro',
  'cyan',
  true
);
```

**Motor del juego (`lib/games/tetris.ts`)** — implementa el contrato `ArcadeGame`/`GameEngineEntry` de `lib/games/engine.ts` (sin dependencias de React ni del DOM más allá del `CanvasRenderingContext2D` que recibe):

```ts
export const W = 300;
export const H = 600;

export class TetrisGame implements ArcadeGame {
  constructor(ctx: CanvasRenderingContext2D, callbacks: GameCallbacks);
  start(): void; // arranca requestAnimationFrame y el estado inicial (tablero vacío, primera pieza)
  pause(): void; // detiene el loop, congela el estado tal cual está
  resume(): void; // reanuda el loop sin salto de dt
  destroy(): void; // cancela el rAF y remueve listeners de teclado
}
```

**Entrada en `lib/games/registry.ts`** (`GAME_ENGINES`):

```ts
tetris: {
  width: TETRIS_W,
  height: TETRIS_H,
  usesLives: false,
  extraStats: [{ key: "lines", label: "LÍNEAS" }],
  create: (ctx, callbacks) => new TetrisGame(ctx, callbacks),
},
```

Internamente el motor conserva las estructuras del original (`COLS`/`ROWS`/`BLOCK`, matriz `board`, las 8 formas de `PIECES`, `COLORS` indexado 1–8, `LINE_SCORES`), con los colores del fondo/tablero/UI tomados de tokens del tema neón del Vault y los 8 colores de pieza conservados como paleta propia del juego (ver sección de Decisiones).

No se introducen columnas ni tablas nuevas: el guardado de puntuación sigue usando `saveScore()` (`lib/scores.ts`) contra la tabla `scores` ya existente, con `game_id: "tetris"`.

## Plan de implementación

1. Insertar la fila `tetris` en `games` (según el modelo de datos) vía `apply_migration`. Prueba manual: `select id, title, cat, cover, color, available from games where id = 'tetris'` devuelve la fila esperada; el juego aparece en `/biblioteca`, filtrable por categoría PUZZLE, y `/juego/tetris` carga con leaderboard vacío.

2. Ajustar `.crt`/`.crt-screen` en `app/globals.css` para limitar el ancho máximo cuando `--arcade-aspect` es vertical, sin afectar el layout de juegos con aspecto 4:3 u horizontal (ej. `asteroides`). Prueba manual: sin motor todavía conectado, verificar visualmente que el ajuste no rompe el Reproductor de `asteroides`.

3. Crear `lib/games/tetris.ts` portando `createBoard`, `randomPiece`, `collide`, `rotateCW`, `tryRotate`, `merge`, `clearLines`, `ghostY`, `hardDrop`, `softDrop`, `lockPiece`, `spawn` del `game.js` original, parametrizando el `ctx` recibido (sin `document.getElementById` ni canvas global) y recoloreando fondo/grid/UI con tokens del Vault, conservando los 8 colores propios de `COLORS`. Prueba manual: `tsc --noEmit` compila sin errores; el archivo no se importa desde ninguna página todavía.

4. Añadir el dibujo de la preview de NEXT dentro del mismo canvas (zona reservada fuera del tablero de 10×20) y el HUD interno (SCORE, LINES, LEVEL) dibujado dentro del canvas, reemplazando el panel HTML lateral del original. Prueba manual: `tsc --noEmit` sin errores.

5. Envolver el motor en la clase `TetrisGame` (constructor, `start`, `pause`, `resume`, `destroy`) implementando `ArcadeGame`, reemplazando las globales `score`/`lines`/`level`/`gameOver` por campos de instancia que disparan `onScoreChange`/`onLevelChange`/`onStatChange("lines", …)`/`onGameOver` cuando cambian, y registrando/removiendo los listeners de teclado (←/→/↑/X/↓/Espacio/P) en `start()`/`destroy()`. Prueba manual: `tsc --noEmit` sigue sin errores.

6. Registrar `tetris` en `GAME_ENGINES` (`lib/games/registry.ts`) con `usesLives: false` y `extraStats: [{ key: "lines", label: "LÍNEAS" }]`. Prueba manual: entrar a `/juego/tetris/jugar` muestra el juego real corriendo en el `<canvas>`, el HUD superior del Reproductor no muestra el bloque de vidas y sí muestra LÍNEAS junto a Puntuación/Nivel, actualizándose en tiempo real.

7. Verificar pausa y game over: el botón PAUSA del Reproductor congela el loop (piezas/tablero no cambian), REANUDAR continúa sin salto; la tecla P también pausa/reanuda; cuando una pieza nueva colisiona al aparecer se dispara `onGameOver` y el modal de fin se abre solo, sin tocar FIN; el botón FIN sigue funcionando manualmente en cualquier momento.

8. Verificar el flujo de guardado de puntuación y Salón de la Fama con `game_id: "tetris"`: jugar, completar líneas, perder, guardar con iniciales, y confirmar que aparece en el Detalle de `tetris` y en `app/salon/page.tsx`. Prueba manual: recorrido completo Biblioteca → Detalle → Reproductor → Game Over → Guardar → Detalle/Salón, sin errores de consola.

9. Verificación final: `npm run build` compila sin errores de TypeScript, y el resto del catálogo (incluyendo `asteroides` y los juegos simulados) sigue funcionando exactamente igual que antes de esta spec. Prueba manual: recorrer Biblioteca, Detalle y Reproductor de `asteroides` y de al menos un juego simulado (ej. `bloque-buster`) para confirmar que no fueron afectados por el ajuste de `.crt-screen` ni por el registro nuevo.

## Criterios de aceptación

- [x] `games` en Supabase incluye una fila con `id: "tetris"`, categoría `PUZZLE`, `available: true`, y aparece en la Biblioteca filtrable por búsqueda y por categoría.
- [x] `/juego/tetris` (Detalle) muestra la info del juego y un leaderboard real (top 10) filtrado por `game_id: "tetris"`, permitiendo entrar al Reproductor.
- [x] En `/juego/tetris/jugar`, se renderiza un `<canvas>` que corre el motor real de `lib/games/tetris.ts`, registrado en `lib/games/registry.ts`.
- [x] Las piezas se mueven con ←/→, rotan con ↑ o X (con wall kicks), bajan más rápido con ↓ (soft drop, +1 punto/fila) y caen instantáneamente con Espacio (hard drop, +2 puntos/celda).
- [x] La pieza fantasma (ghost piece) se dibuja en la posición final proyectada de la pieza actual, con transparencia.
- [x] La preview de la siguiente pieza se dibuja dentro del mismo canvas principal.
- [x] Al completar una o más líneas horizontales, se eliminan, el tablero superior baja, y la puntuación aumenta según `LINE_SCORES` (`[0,100,300,500,800]`) multiplicado por el nivel actual.
- [x] El nivel sube cada 10 líneas acumuladas y la velocidad de caída aumenta en consecuencia (`max(100, 1000 − (nivel−1)×90)` ms).
- [x] El HUD superior del Reproductor muestra Puntuación, Nivel y LÍNEAS (sin bloque de Vidas), actualizándose en tiempo real y coincidiendo con el HUD dibujado dentro del canvas (SCORE/LINES/LEVEL).
- [x] Cuando una pieza nueva colisiona al generarse (game over), el modal de "FIN DEL JUEGO" se abre automáticamente sin necesidad de pulsar FIN.
- [x] El botón FIN sigue abriendo el modal de fin de juego manualmente en cualquier momento durante la partida.
- [x] El botón PAUSA del Reproductor y la tecla `P` congelan por completo el loop del motor (el tablero y la pieza actual no cambian mientras está en pausa) y REANUDAR/`P` continúan sin salto brusco.
- [x] Guardar la puntuación en el modal inserta una fila real en `scores` con `game_id: "tetris"` y aparece reflejada en el Detalle de `tetris` y en el Salón de la Fama.
- [x] Salir del Reproductor (botón SALIR o navegación) detiene el loop del motor y no deja `requestAnimationFrame` corriendo en background.
- [x] El `<canvas>` se adapta a móvil y desktop sin distorsionar el dibujo, manteniendo la resolución lógica interna 300×600, y el ajuste de `.crt`/`.crt-screen` evita que se vea desproporcionadamente angosto en pantallas anchas.
- [x] Los colores de fondo/UI del canvas usan tokens neón del Vault; las 8 piezas conservan colores distintivos entre sí.
- [x] `asteroides` y los demás juegos del catálogo no cambian su comportamiento ni apariencia.
- [x] `npm run build` compila sin errores de TypeScript.
- [x] No hay errores en la consola del navegador durante el recorrido completo Biblioteca → Detalle → Reproductor → Game Over → Guardar → Detalle/Salón.

## Decisiones tomadas y descartadas

- **Sí:** `id: "tetris"` (no `tetro`, pese a que la clase CSS de portada ya se llame `cover-tetro`). Razón: decisión explícita del usuario — el slug debe ser el nombre real del juego, la clase CSS es un detalle interno reutilizable sin importar el nombre.
- **Sí:** El motor implementa el contrato genérico `ArcadeGame`/`GameEngineEntry` de `lib/games/engine.ts` y se registra en `lib/games/registry.ts`, sin tocar la lógica de `GamePlayerClient.tsx`. Razón: la base genérica ya existe (introducida junto con Asteroides) y está pensada explícitamente para este caso — el comentario de `engine.ts` ya menciona LÍNEAS de Tetris como ejemplo de `extraStats`.
- **Sí:** Se reutiliza `.cover-tetro` tal cual, ya existente en `app/globals.css`. Razón: decisión explícita del usuario — encaja temáticamente y evita trabajo de diseño redundante.
- **Sí:** La preview de la pieza siguiente (NEXT) se dibuja dentro del mismo canvas principal, en vez de añadir soporte a un segundo `<canvas>` en el Reproductor. Razón: decisión explícita del usuario — mantiene el contrato `ArcadeGame` simple (un solo canvas por juego) sin ampliar la interfaz genérica para un caso que se resuelve dibujando en una zona reservada del mismo lienzo.
- **Sí:** Se limita el ancho máximo de `.crt`/`.crt-screen` para relaciones de aspecto verticales, en vez de dejar que `--arcade-aspect` sin más controle el tamaño. Razón: decisión explícita del usuario — evita un tablero de 300×600 desproporcionadamente angosto y gigante en pantallas de escritorio anchas.
- **Sí:** Se portan los 8 tipos de pieza del original (7 estándar + la "N"/tuerca), sin recortar a los 7 clásicos. Razón: decisión explícita del usuario, consistente con la decisión de Asteroides de no recortar mecánica del original.
- **Sí:** Las piezas conservan sus 8 colores propios (versión neón-ificada de los del original) en vez de limitarse a los 4 tokens del tema del Vault. Razón: decisión explícita del usuario — 4 colores no alcanzan para distinguir 8 tipos de pieza sin ambigüedad; solo el fondo/UI del tablero usa los tokens neón (`--cyan`, fondo `#0a0a0f`).
- **Sí:** SCORE/LINES/LEVEL se dibujan también dentro del canvas (HUD interno), además del HUD superior del Reproductor. Razón: decisión explícita del usuario — mismo patrón que Asteroides (`drawHUD`), y coherente con haber metido la preview de NEXT dentro del canvas.
- **Sí:** Controles idénticos al original, incluyendo la tecla `P` para pausa además del botón PAUSA del Reproductor. Razón: decisión explícita del usuario — fidelidad al original por encima de evitar el doble camino para la misma acción.
- **No:** `usesLives: true`. Razón: Tetris no tiene vidas en el original; se usa `usesLives: false` (ya soportado por el contrato genérico) para ocultar el bloque de Vidas del HUD.
- **No:** Controles táctiles, sonido, tests automatizados, ajustes de dificultad o autenticación en esta spec. Razón: decisión explícita del usuario, igual que en Asteroides — fuera de alcance por defecto.

## Riesgos identificados

| Riesgo                                                                                                                                                                                                                           | Mitigación                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dibujar NEXT y el HUD (SCORE/LINES/LEVEL) dentro del canvas de 300×600 puede dejar poco espacio para el tablero de 10×20 (300×600 ya es exactamente `COLS×BLOCK` × `ROWS×BLOCK`)                                                 | Reservar la zona de NEXT/HUD como una franja fija superpuesta con fondo semitransparente sobre el tablero, o ampliar ligeramente la resolución lógica del canvas si la superposición perjudica la legibilidad; se decide durante el paso 4 del plan con verificación visual. |
| Limitar el ancho máximo de `.crt`/`.crt-screen` para aspectos verticales podría afectar sin querer el layout de `asteroides` (aspecto 4:3) si la regla CSS no queda suficientemente específica                                   | El paso 2 del plan exige probar visualmente el Reproductor de `asteroides` antes de conectar el motor de Tetris, y el paso 9 lo revalida al final.                                                                                                                           |
| Los 8 colores propios de las piezas, al no ser tokens del tema, podrían quedar inconsistentes con la paleta neón si se portan literalmente los hex del original (morado, rojo, azul pálido, gris)                                | Se ajustan visualmente a variantes más saturadas/neón de esos mismos tonos durante el paso 3 del plan, conservando distinguibilidad entre las 8 piezas.                                                                                                                      |
| El loop del motor (`requestAnimationFrame`) sigue corriendo tras desmontar la página del Reproductor, o los listeners de teclado (`P`, flechas, X, Espacio) quedan duplicados si el motor se reinstancia sin limpiar el anterior | `destroy()` cancela el rAF y remueve todos los listeners de teclado antes de que `start()` pueda volver a registrarlos, igual que en `AsteroidsGame`; verificar explícitamente en el paso 6/9 del plan con DevTools.                                                         |
