# SPEC 09 — Juego real: Snake

> **Estado:** implementado
> **Depende de:** 06-leaderboard-catalogo-supabase (tabla `games`/`scores`, `lib/games/engine.ts` + `registry.ts`)
> **Fecha:** 2026-08-18
> **Objetivo:** Reemplazar la entrada mock `serpentina` por "Snake" (id `snake`), un juego real y jugable donde la serpiente se mueve en continuo por una grilla de 30×30 celdas, come frutas de un spritesheet real para crecer y puntuar, y termina al chocar contra el borde o su propio cuerpo, con velocidad progresiva.

## Alcance

**Incluido:**

- Renombrar la fila mock existente en `games` de `id: "serpentina"` a `id: "snake"` (UPDATE de PK, sin scores que migrar), con `title: "SNAKE"`, `cat: "ARCADE"`, `color: "green"`, `cover: "cover-snake"` (sin cambios de CSS), y `available: true`.
- Motor nuevo en `lib/games/snake.ts`: serpiente que se desplaza en continuo (píxeles/frame) sobre una grilla lógica de celda 20px (30×30 celdas, canvas 600×600), giro alineado a grilla con buffer de 1 tecla pendiente, crecimiento por segmento al comer, colisión contra bordes y contra el propio cuerpo, velocidad progresiva por tramos.
- Frutas dibujadas con sprites reales tomados de `references/source-assets/snake-assets/fruits.png` (movidos a `public/games/snake/fruits.png`), elegidas al azar del atlas en cada aparición; fallback a un cuadrado `--magenta` si la imagen no cargó a tiempo.
- Registro del motor en `lib/games/registry.ts` (`snake: { width: 600, height: 600, usesLives: false, create: (ctx, callbacks) => new SnakeGame(ctx, callbacks) }`), sin stats extra en el HUD y sin tocar `GamePlayerClient.tsx`.
- HUD: solo el del Reproductor (Puntuación, Nivel); bloque de Vidas oculto (`usesLives: false`). Nivel = tramo de velocidad actual.
- Progresión de velocidad: intervalo inicial ~140ms/celda, se reduce 8% cada 5 frutas comidas, con tope mínimo de 60ms/celda; cada reducción incrementa el Nivel en 1.
- Controles: flechas de dirección; se ignora la tecla que intente una reversa de 180° sobre la dirección actual.
- Paleta neón: cabeza en `--cyan`, resto del cuerpo en `--green`, fondo del canvas `#0a0a0f`.
- Ciclo de vida estándar (`start`/`pause`/`resume`/`destroy`) implementando `ArcadeGame` de `lib/games/engine.ts`, con `pause()` congelando el loop y `resume()` descartando el `dt` acumulado.
- Guardado de puntuación al terminar sigue usando `saveScore()` de `lib/scores.ts` con `gameId: "snake"`, sin tablas ni claves nuevas.

**Fuera de alcance (para specs futuros):**

- Sonido/música.
- Controles táctiles/on-screen para móvil.
- Tests automatizados.
- Autenticación/login (sigue sin requerirse para guardar puntuación).
- Cualquier balance/dificultad distinto al definido arriba (ej. obstáculos, power-ups, modos de juego).
- Cambios a los otros 9 juegos del catálogo, que quedan exactamente como están.

## Modelo de datos

**Actualización de fila existente en `games`** (no es un `insert`, es un `update` de la fila mock `serpentina`):

```sql
update public.games
set id = 'snake',
    title = 'SNAKE',
    available = true
where id = 'serpentina';
```

`short`, `long`, `cat` (`ARCADE`), `color` (`green`) y `cover` (`cover-snake`) se conservan tal cual ya existen. Antes de aplicar, se confirma que `scores` no tiene filas con `game_id = 'serpentina'` (verificado: 0 filas), así que no hay `ON UPDATE CASCADE` que resolver más allá del que ya define la FK.

**Motor del juego (`lib/games/snake.ts`)**, implementando el contrato `ArcadeGame`/`GameEngineEntry` de `lib/games/engine.ts`:

```ts
export const W = 600;
export const H = 600;
const CELL = 20; // 30×30 celdas

export interface Point {
  x: number;
  y: number;
} // en píxeles

export class SnakeGame implements ArcadeGame {
  constructor(ctx: CanvasRenderingContext2D, callbacks: GameCallbacks);
  start(): void;
  pause(): void;
  resume(): void;
  destroy(): void;
}
```

Estado interno: lista de segmentos (cabeza primero), dirección actual, dirección en buffer (próximo giro pendiente), posición de la fruta activa (+ qué sprite del atlas le tocó), intervalo de tick actual, contador de frutas comidas, score, nivel.

`lib/games/registry.ts` suma una entrada:

```ts
snake: {
  width: W,
  height: H,
  usesLives: false,
  create: (ctx, callbacks) => new SnakeGame(ctx, callbacks),
},
```

No se introducen columnas ni tablas nuevas: el guardado sigue vía `saveScore({ gameId: "snake", name, score })` de `lib/scores.ts`.

## Plan de implementación

1. Actualizar la fila `serpentina` → `snake` en `games` vía `execute_sql` (`update ... where id = 'serpentina'`), verificando antes que `scores` no tiene filas con ese `game_id`. Prueba manual: `select id, title, available from games where id = 'snake'` devuelve la fila con `available: true`; el juego aparece en `/biblioteca` filtrable por categoría ARCADE, y `/juego/snake` carga con leaderboard vacío.

2. Copiar `references/source-assets/snake-assets/fruits.png` a `public/games/snake/fruits.png`, y portar el atlas de `sprites.js` a un objeto TS de constantes (`lib/games/snake.ts` o un archivo auxiliar) con las coordenadas `{x, y, w, h}` de cada fruta. Prueba manual: `tsc --noEmit` sin errores; el archivo aún no se importa desde ninguna página.

3. Crear `lib/games/snake.ts`: clase `SnakeGame` con el loop de movimiento en píxeles/frame, buffer de dirección con giro alineado a celda, crecimiento de segmentos al comer, colisión contra bordes y contra el propio cuerpo, spawn de fruta en una celda libre aleatoria con sprite aleatorio del atlas, progresión de velocidad (−8% cada 5 frutas, tope 60ms), y colores de paleta (cabeza `--cyan`, cuerpo `--green`, fallback de fruta `--magenta`). Prueba manual: `tsc --noEmit` sin errores; el archivo aún no se importa desde ninguna página.

4. Envolver el ciclo de vida (`start`/`pause`/`resume`/`destroy`) con los callbacks `onScoreChange`/`onLevelChange`/`onGameOver`, registrando los listeners de teclado en el constructor y removiéndolos en `destroy()`; `resume()` descarta el `dt` acumulado. Prueba manual: `tsc --noEmit` sin errores.

5. Registrar `snake` en `lib/games/registry.ts` (`width: 600, height: 600, usesLives: false`). Prueba manual: entrar a `/juego/snake/jugar` muestra el canvas real corriendo, controlable con flechas, sin bloque de Vidas en el HUD.

6. Verificar carga asíncrona del sprite de frutas: mientras `fruits.png` no ha cargado, la fruta se dibuja con el fallback `--magenta`; al cargar, cambia al sprite real sin reiniciar el juego. Prueba manual: throttlear la red en DevTools y confirmar el fallback visual antes de la carga completa.

7. Verificar pausa/reanudación y game over: PAUSA congela la serpiente y la fruta en su posición exacta; REANUDAR continúa sin salto; chocar contra un borde o contra el propio cuerpo dispara `onGameOver` y abre el modal de fin automáticamente; el botón FIN sigue funcionando manualmente. Prueba manual: recorrido completo en el navegador para ambos casos de colisión (borde y cuerpo propio).

8. Verificar guardado de puntuación y Salón de la Fama con `game_id: "snake"`: jugar, perder, guardar con iniciales, confirmar que aparece en el Detalle de `/juego/snake` y en `/salon`. Prueba manual: recorrido Biblioteca → Detalle → Reproductor → Game Over → Guardar → Detalle/Salón, sin errores de consola.

9. Verificación final: `npm run build` compila sin errores de TypeScript; los demás 9 juegos del catálogo (incluyendo Tetris y Arkanoid) siguen funcionando exactamente igual. Prueba manual: recorrer Biblioteca, Detalle y Reproductor de otro juego con motor real (ej. `tetris`) para confirmar que no se vio afectado.

## Criterios de aceptación

- [ ] La fila `games` con id `snake` existe (renombrada desde `serpentina`), con `available: true`, y aparece en `/biblioteca` filtrable por búsqueda y por categoría ARCADE.
- [ ] `app/juego/snake/page.tsx` (Detalle) muestra la info real del juego y un leaderboard (top 10) filtrado por `game_id = 'snake'`, inicialmente vacío.
- [ ] En `/juego/snake/jugar`, el `game-arena` simulado es reemplazado por un `<canvas>` que corre `lib/games/snake.ts`.
- [ ] La serpiente se mueve en continuo (píxeles/frame) en las 4 direcciones con las flechas, y el giro solo se aplica cuando la cabeza está alineada al centro de una celda de 20px.
- [ ] Presionar la tecla de reversa de 180° respecto a la dirección actual no tiene efecto (no causa colisión contra el propio segundo segmento).
- [ ] Al comer una fruta, la serpiente crece un segmento, se suma puntuación, y aparece una nueva fruta en una celda libre con un sprite aleatorio del atlas de `fruits.png`.
- [ ] Si el sprite de la fruta activa no cargó a tiempo, se dibuja el fallback `--magenta` en su lugar, sin bloquear el juego.
- [ ] Cada 5 frutas comidas, el intervalo de movimiento se reduce un 8% (sin bajar de 60ms por celda) y el HUD de Nivel se incrementa en 1.
- [ ] Chocar contra cualquier borde del canvas, o contra cualquier segmento del propio cuerpo, termina la partida.
- [ ] El HUD del Reproductor no muestra el bloque de Vidas para este juego (`usesLives: false`) y refleja Puntuación/Nivel en tiempo real.
- [ ] Al terminar la partida (colisión), el modal de "FIN DEL JUEGO" se abre automáticamente sin pulsar FIN; el botón FIN sigue abriendo el modal manualmente en cualquier momento.
- [ ] PAUSA congela por completo el loop (posición exacta de serpiente y fruta no cambian) y REANUDAR continúa sin salto brusco.
- [ ] Guardar la puntuación inserta una fila real en `scores` con `game_id: "snake"` y aparece reflejada en el Detalle de `/juego/snake` y en `/salon`.
- [ ] Salir del Reproductor detiene el loop: no queda `requestAnimationFrame` corriendo en background.
- [ ] El canvas se adapta a móvil y desktop sin distorsionar el dibujo, manteniendo la resolución lógica 600×600.
- [ ] Los colores usan la paleta neón del Vault (cabeza `--cyan`, cuerpo `--green`, fallback de fruta `--magenta`).
- [ ] Los demás 9 juegos del catálogo no cambian su comportamiento ni apariencia.
- [ ] `npm run build` compila sin errores de TypeScript.
- [ ] No hay errores en la consola del navegador durante el recorrido completo Biblioteca → Detalle → Reproductor → Game Over → Guardar → Detalle/Salón.

## Decisiones tomadas y descartadas

- **Sí:** Se reutiliza y renombra la fila mock `serpentina` → `snake` (id, título y `available`) en vez de crear una entrada nueva. Razón: decisión explícita del usuario; la fila no tiene scores asociados (verificado: 0 filas), así que el cambio de PK es seguro.
- **Sí:** Movimiento continuo en píxeles/frame, con giro alineado a grilla (buffer de 1 tecla pendiente) en vez de saltos discretos de celda o giro libre inmediato. Razón: decisión explícita del usuario — conserva el look clásico de esquinas rectas sin la brusquedad de saltar celda a celda.
- **Sí:** Se usa la base genérica de motores (`lib/games/engine.ts`/`registry.ts`), ya existente desde Tetris/Arkanoid, en vez de una rama `if` nueva en `GamePlayerClient.tsx`. Razón: es el patrón ya establecido en el repo para juegos con motor real; Snake es el cuarto en usarlo.
- **Sí:** `usesLives: false`, sin bloque de Vidas en el HUD y sin stats extra (ej. LONGITUD descartada). Razón: decisión explícita del usuario — Snake clásico no tiene vidas, y no quiso agregar un stat adicional al HUD del Reproductor.
- **Sí:** El HUD vive únicamente en la barra del Reproductor; no se dibuja HUD propio dentro del canvas. Razón: decisión explícita del usuario, siguiendo el patrón de Tetris/Arkanoid en vez del de Asteroides.
- **Sí:** Nivel = tramo de velocidad actual (se incrementa junto con cada reducción de intervalo). Razón: decisión explícita del usuario, mantiene el HUD coherente con el de Tetris.
- **Sí:** Progresión de velocidad concreta: −8% de intervalo cada 5 frutas, tope mínimo 60ms/celda, inicio ~140ms/celda. Razón: parámetros propuestos y aceptados por el usuario como curva jugable de principio a fin.
- **Sí:** Frutas dibujadas con sprites reales de `fruits.png` elegidas al azar, con fallback a un cuadrado `--magenta` si el sprite no cargó. Razón: decisión explícita del usuario de aprovechar el asset real en vez de una forma geométrica fija.
- **No:** Reversa de 180° como game over instantáneo. Razón: el usuario prefirió ignorar la tecla de reversa para evitar un game over accidental por doble tecla.
- **No:** Sonido, controles táctiles, tests automatizados y autenticación en esta spec. Razón: confirmado por el usuario, igual que en las specs 05/07/08 — quedan para specs futuros si se necesitan.
