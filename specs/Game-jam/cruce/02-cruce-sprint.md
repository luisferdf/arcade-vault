# SPEC — Juego real: CRUCE SPRINT (variante B · solo tráfico, rondas encadenadas)

> **Estado:** Borrador
> **Depende de:** 06-leaderboard-catalogo-supabase, 07-juego-tetris (base genérica de motores en `lib/games/engine.ts` y `lib/games/registry.ts`)
> **Fecha:** 2026-09-08
> **Objetivo:** Agregar "Cruce Sprint" como juego nuevo y jugable (id `cruce-sprint`), un avance por rejilla vertical recortado al núcleo de esquiva —solo carriles de vehículos, una casilla meta— donde las rondas se encadenan sin fin sobre un único cronómetro global que solo la meta recarga.

## Por qué existe esta spec

Es el recorte al núcleo jugable del mismo ejemplo: el ejemplo describe carretera + río, y esta variante conserva únicamente la mitad de carretera para eliminar el punto más caro y delicado del motor (acarreo sobre plataformas móviles y detección de caída al agua, `cruce.md:16`). A cambio, resuelve de forma distinta los dos huecos que el ejemplo deja abiertos: aquí no hay vidas y el contrarreloj es un único cronómetro global que la meta recarga, en vez de un reloj por intento con 3 vidas. Es la variante de menor coste de implementación y la de partida más corta y agresiva del trío.

## Alcance

**Incluido:**

- Nueva fila en la tabla `games` de Supabase con `id: "cruce-sprint"`, `cat: "ARCADE"`, `cover: "cover-cruce-sprint"`, `color: "yellow"`, `available: true`.
- Nueva clase CSS `.cover-cruce-sprint` en `app/globals.css` (carriles horizontales de neón amarillo con estelas de velocidad), solo CSS, sin imágenes.
- Motor nuevo en `lib/games/cruce-sprint.ts`: rejilla lógica de 9 columnas × 10 filas con celda de 48px (canvas 432×480), movimiento del jugador por celdas discretas, 8 carriles de vehículos con velocidad y sentido alternos y envolvimiento lateral, una única casilla meta en la fila superior, y rondas encadenadas indefinidamente con velocidad creciente.
- Sin río y sin plataformas móviles: la mitad fluvial del ejemplo no se porta en esta variante.
- Sin vidas (`usesLives: false`): ser atropellado devuelve al jugador a la salida y **resta 5 segundos** al cronómetro; la partida solo termina cuando el cronómetro llega a 0.
- Cronómetro global único: arranca en 45 segundos, corre de forma continua y suma +12 segundos cada vez que se alcanza la meta, con tope de 60 segundos acumulados.
- Controles: solo teclado. `←` `→` `↑` `↓` mueven una celda por pulsación, ignorando el auto-repeat (`event.repeat`). No hay mouse ni táctil.
- HUD: el del Reproductor (Puntuación, Nivel) más dos stats extra, `TIEMPO` y `RONDA`, vía `extraStats`/`onStatChange`. Bloque de Vidas oculto. No se dibuja HUD dentro del canvas.
- Puntuación entera: 10 puntos por cada fila nueva alcanzada dentro de la ronda actual, 100 por meta alcanzada, y un bonus final de 3 puntos por cada ronda completada al terminar la partida. No hay bonus por tiempo restante, porque el tiempo se convierte en juego en vez de en puntos.
- Paleta neón del Vault: jugador `--green`, vehículos `--yellow` y `--magenta` según sentido del carril, casilla meta `--cyan`, asfalto en bandas atenuadas sobre fondo `#0a0a0f`.
- Ciclo de vida estándar `ArcadeGame` (`start`/`pause`/`resume`/`destroy`) de `lib/games/engine.ts`, con `pause()` congelando loop y cronómetro y `resume()` descartando el `dt` acumulado.
- Registro del motor en `lib/games/registry.ts` (una entrada `cruce-sprint`), sin tocar `GamePlayerClient.tsx`.
- Guardado de puntuación con `saveScore()` de `lib/scores.ts` y `gameId: "cruce-sprint"`.

**Fuera de alcance (para specs futuros):**

- El río, los troncos y las tortugas del ejemplo (los porta la variante A y, ampliados, la variante C).
- Sonido/música.
- Controles táctiles/on-screen para móvil.
- Tests automatizados.
- Balance fino más allá de las constantes definidas aquí.
- Autenticación/login.
- Power-ups, recogibles o enemigos perseguidores.
- Cualquier cambio a los juegos ya implementados o a las filas mock del catálogo, incluida `ranaria`, que queda intacta.

## Modelo de datos

**Nueva fila en `games`** (vía `apply_migration` / `execute_sql`):

```sql
insert into public.games (id, title, short, long, cat, cover, color, available)
values (
  'cruce-sprint',
  'CRUCE SPRINT',
  'Ocho carriles de tráfico, una meta y un reloj que solo la meta recarga.',
  'Sube fila a fila entre ocho carriles de vehículos que van en sentidos alternos hasta la casilla meta. No hay vidas: cada atropello te devuelve a la salida y te cuesta cinco segundos. Cada meta recarga el reloj y acelera todos los carriles, y la partida termina cuando el reloj se agota.',
  'ARCADE',
  'cover-cruce-sprint',
  'yellow',
  true
);
```

**Motor (`lib/games/cruce-sprint.ts`)**, implementando el contrato `ArcadeGame`/`GameCallbacks` de `lib/games/engine.ts`:

```ts
export const W = 432; // 9 columnas × 48px
export const H = 480; // 10 filas × 48px
const CELL = 48;
const COLS = 9;
const ROWS = 10;

export interface Lane {
  row: number; // filas 1..8
  dir: 1 | -1;
  speed: number; // celdas por segundo
  gap: number; // separación entre vehículos, en celdas
  size: number; // largo del vehículo, en celdas
  offset: number; // desplazamiento acumulado, en celdas
}

export class CruceSprintGame implements ArcadeGame {
  constructor(ctx: CanvasRenderingContext2D, callbacks: GameCallbacks);
  start(): void;
  pause(): void;
  resume(): void;
  destroy(): void;
}
```

Estado interno: celda actual del jugador (`col`, `row`), fila récord de la ronda, array de 8 `Lane`, segundos restantes del cronómetro, ronda actual, score.

**Distribución de filas** (fila 0 arriba):

| Fila(s) | Contenido                                                        |
| ------- | ---------------------------------------------------------------- |
| 0       | Franja meta: una única casilla en la columna 4; el resto es muro |
| 1–8     | Carretera: 8 carriles de vehículos                               |
| 9       | Franja de salida (spawn del jugador, columna 4)                  |

**Constantes de carriles (ronda 1):** velocidades `1.4 / 2.0 / 1.7 / 2.6 / 1.9 / 3.0 / 2.2 / 3.4` celdas/s de la fila 8 a la 1, con sentido alterno empezando por `-1` en la fila 8, `gap` mínimo de 3 celdas y `size` de 1 o 2 celdas según carril. Cada ronda superada multiplica todas las velocidades por 1.08, con tope en ×2.2.

`lib/games/registry.ts` suma una entrada:

```ts
"cruce-sprint": {
  width: W,
  height: H,
  usesLives: false,
  extraStats: [
    { key: "time", label: "TIEMPO" },
    { key: "round", label: "RONDA" },
  ],
  create: (ctx, callbacks) => new CruceSprintGame(ctx, callbacks),
},
```

No se crean tablas ni columnas nuevas: el guardado sigue vía `saveScore({ gameId: "cruce-sprint", name, score })` de `lib/scores.ts`.

## Plan de implementación

1. Insertar la fila `cruce-sprint` en `games` (según el modelo de datos) vía `apply_migration` o `execute_sql`. Prueba manual: `select id, title, available from games where id = 'cruce-sprint'` devuelve la fila; el juego aparece en `/biblioteca` filtrable por categoría ARCADE y `/juego/cruce-sprint` carga con leaderboard vacío.

2. Crear la clase `.cover-cruce-sprint` en `app/globals.css`: bandas horizontales oscuras con líneas discontinuas en `--yellow` y estelas alargadas que sugieren velocidad, con gradientes y pseudo-elementos, sin imágenes. Prueba manual: la tarjeta de `/biblioteca` y la portada de `/juego/cruce-sprint` muestran la portada nueva, distinguible de `.cover-cruce` y del resto.

3. Crear `lib/games/cruce-sprint.ts` con el esqueleto: constantes `W`/`H`/`CELL`/`COLS`/`ROWS`, tipo `Lane`, generación de los 8 carriles de la ronda 1 y dibujo estático del tablero (asfalto, salida, muro y casilla meta). Prueba manual: `tsc --noEmit` sin errores; el archivo aún no se importa desde ninguna página.

4. Añadir el movimiento de carriles con envolvimiento lateral: `offset += dir * speed * dt`, dibujo en módulo sobre `W + size * CELL`. Prueba manual: `tsc --noEmit` sin errores.

5. Añadir el jugador y su movimiento por celdas discretas con `keydown` (ignorando `event.repeat`), sin salir de la rejilla y sin poder entrar en el muro de la fila 0. Alcanzar una fila nueva de la ronda suma 10 puntos vía `onScoreChange`. Prueba manual: `tsc --noEmit` sin errores.

6. Añadir la colisión con vehículos: solapamiento AABB entre jugador y vehículo del carril actual devuelve al jugador a la fila 9 columna 4, resetea la fila récord de la ronda y descuenta 5 segundos del cronómetro. Prueba manual: `tsc --noEmit` sin errores.

7. Añadir el cronómetro global y las rondas: el cronómetro descuenta con el `dt` del loop y se publica redondeado con `onStatChange("time", segundos)`; entrar en la casilla meta suma 100 puntos, incrementa la ronda (`onStatChange("round", ronda)` y `onLevelChange(ronda)`), suma +12 s con tope de 60 s acumulados, multiplica las velocidades por 1.08 (tope ×2.2) y devuelve al jugador a la salida; el cronómetro en 0 suma el bonus de 3 puntos por ronda completada y dispara `onGameOver(score)`. Prueba manual: `tsc --noEmit` sin errores.

8. Cerrar el ciclo de vida: `start()` arranca el `requestAnimationFrame` y registra el listener de teclado, `pause()` cancela el frame (y con él el cronómetro), `resume()` descarta el `dt` acumulado y `destroy()` cancela el frame y remueve el listener. Prueba manual: `tsc --noEmit` sin errores.

9. Registrar `cruce-sprint` en `lib/games/registry.ts` (`width: W`, `height: H`, `usesLives: false`, `extraStats` TIEMPO y RONDA). Prueba manual: `/juego/cruce-sprint/jugar` muestra el canvas real corriendo en vez del `game-arena` simulado, sin bloque de Vidas en el HUD y con TIEMPO y RONDA actualizándose.

10. Verificar pausa/reanudación y fin de partida: PAUSA congela vehículos y cronómetro; REANUDAR sigue sin salto ni pérdida de segundos; agotar el cronómetro abre el modal de fin automáticamente con el score incluyendo el bonus por rondas; el botón FIN sigue funcionando manualmente. Prueba manual: recorrido completo en el navegador, comprobando también que un atropello a menos de 5 segundos del final termina la partida en el momento.

11. Verificar guardado y Salón de la Fama con `game_id: "cruce-sprint"`: jugar, terminar, guardar con iniciales y confirmar que aparece en `/juego/cruce-sprint` y en `/salon`. Prueba manual: recorrido Biblioteca → Detalle → Reproductor → Game Over → Guardar → Detalle/Salón, sin errores de consola.

12. Verificación final: `npm run build` compila sin errores y el resto del catálogo sigue igual. Prueba manual: partida rápida de otro juego con motor real (`snake` o `tetris`) y revisión de `/biblioteca` completa.

## Criterios de aceptación

- [ ] `games` incluye una fila con `id: "cruce-sprint"`, `cat: "ARCADE"`, `color: "yellow"`, `cover: "cover-cruce-sprint"` y `available: true`, y el juego aparece en `/biblioteca` filtrable por búsqueda y por categoría.
- [ ] `/juego/cruce-sprint` muestra la info real del juego y un leaderboard (top 10) filtrado por `game_id = 'cruce-sprint'`, inicialmente vacío.
- [ ] La portada usa la clase CSS `.cover-cruce-sprint` definida en `app/globals.css`, sin ninguna imagen.
- [ ] En `/juego/cruce-sprint/jugar`, el `game-arena` simulado es reemplazado por un `<canvas>` que corre `lib/games/cruce-sprint.ts`, con resolución lógica 432×480.
- [ ] Cada pulsación de `←` `→` `↑` `↓` mueve al jugador exactamente una celda de 48px; mantener la tecla pulsada no encadena pasos automáticos.
- [ ] El tablero tiene 8 carriles de vehículos y ninguna zona de río ni plataforma móvil.
- [ ] Los carriles se mueven a velocidad constante con sentidos alternos y los vehículos reaparecen por el lado opuesto sin saltos visibles.
- [ ] Ser atropellado devuelve al jugador a la fila de salida y descuenta exactamente 5 segundos del cronómetro, sin restar vidas.
- [ ] El HUD del Reproductor no muestra el bloque de Vidas (`usesLives: false`).
- [ ] Alcanzar por primera vez cada fila superior de la ronda suma exactamente 10 puntos; tras un atropello, las filas vuelven a puntuar en la ronda reiniciada.
- [ ] Alcanzar la casilla meta suma 100 puntos, incrementa RONDA y Nivel, añade 12 segundos al cronómetro y devuelve al jugador a la salida.
- [ ] El cronómetro nunca supera los 60 segundos acumulados por más metas que se alcancen.
- [ ] Cada ronda superada acelera todos los carriles un 8 %, sin superar 2,2 veces la velocidad inicial.
- [ ] El cronómetro llegando a 0 termina la partida y el score final incluye 3 puntos por cada ronda completada.
- [ ] El HUD del Reproductor muestra Puntuación, Nivel, TIEMPO y RONDA en tiempo real.
- [ ] Al terminar la partida, el modal de fin se abre automáticamente; el botón FIN sigue abriendo el modal manualmente en cualquier momento.
- [ ] PAUSA congela por completo el loop (vehículos y cronómetro no cambian) y REANUDAR continúa sin salto de física ni pérdida de segundos.
- [ ] Guardar la puntuación inserta una fila real en `scores` con `game_id: "cruce-sprint"` y aparece en el Detalle de `/juego/cruce-sprint` y en `/salon`.
- [ ] Salir del Reproductor detiene el loop: no queda `requestAnimationFrame` corriendo en background ni listeners de teclado registrados.
- [ ] El canvas se adapta a móvil y desktop sin distorsionar el dibujo, manteniendo la resolución lógica 432×480.
- [ ] Los colores usan solo la paleta neón del Vault sobre fondo `#0a0a0f`.
- [ ] El resto del catálogo (incluida la fila mock `ranaria`) no cambia su comportamiento ni apariencia.
- [ ] `npm run build` compila sin errores de TypeScript.
- [ ] No hay errores en la consola durante el recorrido completo Biblioteca → Detalle → Reproductor → Game Over → Guardar → Detalle/Salón.

## Decisiones tomadas y descartadas

**Derivado del ejemplo (memoria `cruce.md`)**

- **Sí:** Avance por rejilla vertical, fila a fila, esquivando vehículos en carriles de velocidad y sentido alternos hasta una casilla meta. Origen: `cruce.md:10`.
- **Sí:** Movimiento por celdas discretas, obstáculos rectangulares a velocidad constante y envolvimiento lateral de carriles. Origen: `cruce.md:16`.
- **Sí:** Contrarreloj y puntuación por fila avanzada y meta completada. Origen: `cruce.md:10`.
- **Sí:** `cat: "ARCADE"`. Origen: `cruce.md:12`.
- **Sí:** Sin assets binarios; portada como clase CSS de carriles horizontales de neón. Origen: `cruce.md:16`.
- **Sí:** Nombre y estética propios, sin rana ni paleta del clásico. Origen: `cruce.md:16`.
- **No:** Portar el río, los troncos y las tortugas. Razón: el ejemplo los incluye, pero esta variante es explícitamente el recorte al núcleo de esquiva; el río es el punto más caro y delicado del motor (`cruce.md:16`) y se porta íntegro en las variantes A y C.
- **No:** Reutilizar la fila mock `ranaria` ni su `cover-rana`. Razón: el ejemplo exige nombre y estética propios sin rana (`cruce.md:16`).

**Asunción del agente game-jam (huecos del ejemplo)**

- **Sí:** Rejilla de 9 × 10 celdas de 48px (canvas 432×480). Razón: al no haber río, el tablero puede ser más corto y la celda más grande; 48px hace legible el tráfico rápido en un canvas pequeño, y el ejemplo no fija medidas.
- **Sí:** Sin vidas; el atropello cuesta 5 segundos. Razón: el ejemplo no define qué ocurre al morir, solo que hay contrarreloj (`cruce.md:10`); convertir la muerte en coste de tiempo es la extrapolación más directa de ese mismo contrarreloj y evita añadir un sistema (vidas) que el ejemplo no menciona.
- **Sí:** Un único cronómetro global de 45 s, recargado +12 s por meta con tope de 60 s. Razón: el ejemplo dice "contrarreloj por intento" sin definir su duración ni si se reinicia; esta es la otra lectura razonable del mismo enunciado —el intento es la partida entera— y es la que sostiene el encadenado de rondas.
- **Sí:** Una sola casilla meta en vez de varias. Razón: consecuencia directa del recorte; con rondas encadenadas infinitas, varias metas simultáneas no aportan y alargan el tablero.
- **Sí:** Valores concretos de puntuación (10 por fila, 100 por meta, 3 por ronda al final). Razón: el ejemplo fija las fuentes de puntos pero ningún número; el bonus por tiempo restante del ejemplo se sustituye por el bonus por rondas porque aquí el tiempo se gasta en jugar, no sobra al final.
- **Sí:** Progresión: +8 % de velocidad por ronda con tope ×2.2. Razón: el ejemplo pide progresión por niveles sin definirla; el incremento es menor que en la variante A porque aquí las rondas se suceden mucho más rápido.
- **Sí:** `color: "yellow"` en vez del magenta sugerido. Razón: el ejemplo sugiere magenta (`cruce.md:12`), reservado aquí para la variante A; el amarillo distingue esta portada en la Biblioteca si conviven dos juegos de la misma familia.
- **Sí:** Solo teclado, una celda por pulsación, ignorando `event.repeat`. Razón: regla dura del proyecto y consecuencia del movimiento por celdas discretas del ejemplo.
- **No:** Generación procedural infinita de carriles con cámara que sube. Razón: el ejemplo describe un tablero fijo con meta arriba; el scroll infinito sería un juego distinto.

**Por qué esta variante existe frente a las otras**

Es la más barata de implementar y la de partida más corta: elimina el acarreo sobre plataformas, el sistema de vidas y el reloj por intento, y a cambio prueba la lectura alternativa del contrarreloj (un reloj global que la meta recarga). Si el objetivo es tener un Cruce jugable en el catálogo con el mínimo riesgo técnico, esta es la variante; si el objetivo es portar el ejemplo entero, es la variante A.

## Riesgos identificados

| Riesgo                                                                                                        | Mitigación                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sin río y sin vidas, la partida puede resultar demasiado plana o repetitiva                                   | La aceleración por ronda (+8 %, tope ×2.2) y el tope de 60 s del cronómetro garantizan que la dificultad crezca y la partida tenga final. Se revisa en el paso 10. |
| El castigo de −5 s puede terminar la partida en mitad de un movimiento y confundir al jugador                 | El fin de partida se dispara en el mismo frame en que el cronómetro cruza 0 y el modal es inmediato; caso comprobado explícitamente en el paso 10.                 |
| El cronómetro puede seguir corriendo durante la pausa si se calcula con `Date.now()` en vez del `dt` del loop | El cronómetro se descuenta solo con el `dt` del `requestAnimationFrame`, que `pause()` cancela; `resume()` descarta el `dt` acumulado. Verificado en el paso 10.   |
| Ocho carriles rápidos en 432px de ancho pueden dejar huecos imposibles                                        | `gap` mínimo de 3 celdas por carril y tope de velocidad ×2.2; se juega hasta la ronda 10 en el paso 10 para confirmar que sigue siendo superable.                  |

## Qué **no** incluye este spec

- El río, los troncos y las tortugas del ejemplo.
- Sonido/música.
- Controles táctiles/on-screen para móvil.
- Tests automatizados.
- Balance fino distinto a las constantes definidas aquí.
- Autenticación.
- Power-ups, recogibles o enemigos perseguidores.
- Cualquier cambio a los juegos ya implementados o a las filas mock del catálogo.

Cada uno de estos, si se necesita, va en su propio spec.
