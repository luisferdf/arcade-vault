# SPEC — Juego real: CRUCE MAREA (variante C · río protagonista, plataformas que se hunden)

> **Estado:** Borrador
> **Depende de:** 06-leaderboard-catalogo-supabase, 07-juego-tetris (base genérica de motores en `lib/games/engine.ts` y `lib/games/registry.ts`)
> **Fecha:** 2026-09-08
> **Objetivo:** Agregar "Cruce Marea" como juego nuevo y jugable (id `cruce-marea`), una travesía por rejilla vertical en tablero ancho donde la carretera es el trámite corto y el río —con plataformas que se hunden por ciclos— es el verdadero desafío hasta ocupar las 5 casillas meta.

## Por qué existe esta spec

El ejemplo menciona "troncos y tortugas móviles" (`cruce.md:10`) sin decir en qué se diferencian. La variante A resuelve ese hueco tratándolos como un único tipo de plataforma sólida; esta variante toma la otra lectura razonable: hay dos tipos, y el segundo se hunde periódicamente. Esa decisión reordena el juego entero —el río pasa a ser la mitad protagonista— y justifica un tablero ancho, más carriles de agua y un modelo de puntuación por racha en vez de por tiempo sobrante.

Es la variante más exigente de las tres y también la de mayor riesgo técnico, porque concentra el punto delicado señalado por el propio ejemplo: el acarreo del jugador sobre plataformas móviles y la detección de caída al agua (`cruce.md:16`).

## Alcance

**Incluido:**

- Nueva fila en la tabla `games` de Supabase con `id: "cruce-marea"`, `cat: "ARCADE"`, `cover: "cover-cruce-marea"`, `color: "cyan"`, `available: true`.
- Nueva clase CSS `.cover-cruce-marea` en `app/globals.css` (bandas horizontales de neón cian sobre fondo profundo, con bloques desplazados que sugieren plataformas a la deriva), solo CSS, sin imágenes.
- Motor nuevo en `lib/games/cruce-marea.ts`: rejilla lógica de 20 columnas × 15 filas con celda de 40px (canvas 800×600), movimiento del jugador por celdas discretas, 6 carriles de vehículos, 6 carriles de río, orilla intermedia, 5 casillas meta, 5 vidas y temporizador de 45 segundos por intento.
- Dos tipos de plataforma en el río: **balsas** (sólidas siempre, largo 2 a 4 celdas) y **placas** (largo 2 celdas, con ciclo de inmersión: 4 s a flote, 1,2 s parpadeando y 1,6 s sumergidas, momento en el que dejan de sostener al jugador).
- Acarreo del jugador sobre la plataforma en la que va, con caída al agua si no hay plataforma bajo los pies, si la placa se sumerge estando encima, o si la plataforma lo arrastra fuera del canvas.
- Controles: solo teclado. `←` `→` `↑` `↓` mueven una celda por pulsación, ignorando el auto-repeat (`event.repeat`). No hay mouse ni táctil.
- HUD: el del Reproductor (Puntuación, Vidas, Nivel) más dos stats extra, `TIEMPO` y `RACHA`, vía `extraStats`/`onStatChange`.
- Puntuación entera: 10 puntos por cada fila nueva alcanzada en el intento, 60 por meta ocupada, multiplicador de racha ×1 / ×2 / ×3 sobre los puntos de meta según metas consecutivas ocupadas sin morir (se reinicia a ×1 al perder una vida), y 400 al completar las 5 metas de un nivel.
- Paleta neón del Vault: jugador `--green`, vehículos `--magenta` y `--yellow` según sentido, balsas `--cyan`, placas `--cyan` atenuado (parpadeando antes de sumergirse), casillas meta `--yellow` (vacías) / `--green` (ocupadas), sobre fondo `#0a0a0f`.
- Ciclo de vida estándar `ArcadeGame` (`start`/`pause`/`resume`/`destroy`) de `lib/games/engine.ts`, con `pause()` congelando loop, reloj y ciclos de inmersión, y `resume()` descartando el `dt` acumulado.
- Registro del motor en `lib/games/registry.ts` (una entrada `cruce-marea`), sin tocar `GamePlayerClient.tsx`.
- Guardado de puntuación con `saveScore()` de `lib/scores.ts` y `gameId: "cruce-marea"`.

**Fuera de alcance (para specs futuros):**

- Sonido/música.
- Controles táctiles/on-screen para móvil.
- Tests automatizados.
- Balance fino más allá de las constantes definidas aquí.
- Autenticación/login.
- Power-ups, recogibles, corrientes que empujen al jugador o enemigos perseguidores.
- Cualquier cambio a los juegos ya implementados o a las filas mock del catálogo, incluida `ranaria`, que queda intacta.

## Modelo de datos

**Nueva fila en `games`** (vía `apply_migration` / `execute_sql`):

```sql
insert into public.games (id, title, short, long, cat, cover, color, available)
values (
  'cruce-marea',
  'CRUCE MAREA',
  'Cruza el tráfico rápido y sobrevive a un río de plataformas que se hunden.',
  'La carretera es solo el principio: al otro lado te espera un río de seis carriles donde las balsas flotan siempre y las placas se hunden cada pocos segundos. Ocupa las cinco metas antes de que se agote el reloj, y encadena metas sin morir para triplicar lo que valen.',
  'ARCADE',
  'cover-cruce-marea',
  'cyan',
  true
);
```

**Motor (`lib/games/cruce-marea.ts`)**, implementando el contrato `ArcadeGame`/`GameCallbacks` de `lib/games/engine.ts`:

```ts
export const W = 800; // 20 columnas × 40px
export const H = 600; // 15 filas × 40px
const CELL = 40;
const COLS = 20;
const ROWS = 15;

export type LaneKind = "road" | "raft" | "plate";

export interface Lane {
  row: number;
  kind: LaneKind;
  dir: 1 | -1;
  speed: number; // celdas por segundo
  gap: number; // separación entre obstáculos, en celdas
  size: number; // largo del obstáculo, en celdas
  offset: number; // desplazamiento acumulado, en celdas
  phase: number; // segundos dentro del ciclo de inmersión (solo `plate`)
}

export class CruceMareaGame implements ArcadeGame {
  constructor(ctx: CanvasRenderingContext2D, callbacks: GameCallbacks);
  start(): void;
  pause(): void;
  resume(): void;
  destroy(): void;
}
```

Estado interno: celda del jugador (`col`, `row`) más `carryX` en píxeles cuando va sobre una plataforma, fila récord del intento, array de `Lane`, array de 5 metas (`{ col, filled }`), segundos restantes del intento, racha de metas consecutivas, vidas, nivel, score.

**Distribución de filas** (fila 0 arriba):

| Fila(s) | Contenido                                                                                 |
| ------- | ----------------------------------------------------------------------------------------- |
| 0       | Franja meta: 5 casillas de 2 celdas de ancho en las columnas 1, 5, 9, 13 y 17; resto muro |
| 1–6     | Río: 6 carriles (filas 1, 3 y 5 de tipo `plate`; filas 2, 4 y 6 de tipo `raft`)           |
| 7       | Orilla segura (mediana)                                                                   |
| 8–13    | Carretera: 6 carriles de vehículos                                                        |
| 14      | Franja de salida (spawn del jugador, columna 10)                                          |

**Constantes de carriles (nivel 1):** carretera con velocidades `1.6 / 2.2 / 2.8 / 1.9 / 3.2 / 2.5` celdas/s de la fila 13 a la 8, sentido alterno empezando por `-1`; río con velocidades `1.0 / 1.5 / 0.8 / 1.7 / 1.2 / 1.4` celdas/s de la fila 6 a la 1, sentido alterno empezando por `+1`. Cada nivel superado multiplica las velocidades por 1.10 (tope ×1.8) y acorta el ciclo de inmersión de las placas un 6 % (mínimo 4,0 s de ciclo total).

**Ciclo de inmersión (nivel 1):** 4,0 s a flote → 1,2 s parpadeando (aún sostiene) → 1,6 s sumergida (no sostiene y no se dibuja). Las placas de un mismo carril comparten `phase`; carriles distintos arrancan con fases desfasadas para que nunca se hundan todas a la vez.

**Temporizador:** 45 segundos por intento, reiniciados al ocupar una meta y al perder una vida. Llegar a 0 cuesta una vida.

`lib/games/registry.ts` suma una entrada:

```ts
"cruce-marea": {
  width: W,
  height: H,
  usesLives: true,
  extraStats: [
    { key: "time", label: "TIEMPO" },
    { key: "streak", label: "RACHA" },
  ],
  create: (ctx, callbacks) => new CruceMareaGame(ctx, callbacks),
},
```

No se crean tablas ni columnas nuevas: el guardado sigue vía `saveScore({ gameId: "cruce-marea", name, score })` de `lib/scores.ts`.

## Plan de implementación

1. Insertar la fila `cruce-marea` en `games` (según el modelo de datos) vía `apply_migration` o `execute_sql`. Prueba manual: `select id, title, available from games where id = 'cruce-marea'` devuelve la fila; el juego aparece en `/biblioteca` filtrable por categoría ARCADE y `/juego/cruce-marea` carga con leaderboard vacío.

2. Crear la clase `.cover-cruce-marea` en `app/globals.css`: bandas horizontales de neón cian sobre fondo profundo con bloques desplazados que sugieren plataformas a la deriva, con gradientes y pseudo-elementos, sin imágenes. Prueba manual: la tarjeta de `/biblioteca` y la portada de `/juego/cruce-marea` muestran la portada nueva, distinguible de `.cover-cruce` y `.cover-cruce-sprint`.

3. Crear `lib/games/cruce-marea.ts` con el esqueleto: constantes `W`/`H`/`CELL`/`COLS`/`ROWS`, tipo `Lane` con los tres `LaneKind`, generación de carriles del nivel 1 y dibujo estático del tablero (asfalto, agua, orilla, salida y las 5 casillas meta). Prueba manual: `tsc --noEmit` sin errores; el archivo aún no se importa desde ninguna página.

4. Añadir el movimiento de carriles con envolvimiento lateral (`offset += dir * speed * dt`, dibujo en módulo sobre `W + size * CELL`) para los tres tipos. Prueba manual: `tsc --noEmit` sin errores.

5. Añadir el ciclo de inmersión de las placas: `phase` avanza con el `dt` del loop y determina el estado (a flote / parpadeando / sumergida), con desfase inicial distinto por carril y dibujo diferenciado en cada estado. Prueba manual: `tsc --noEmit` sin errores.

6. Añadir el jugador y su movimiento por celdas discretas con `keydown` (ignorando `event.repeat`), sin salir de la rejilla y sin poder entrar en el muro de la fila 0; alcanzar una fila nueva del intento suma 10 puntos vía `onScoreChange`. Prueba manual: `tsc --noEmit` sin errores.

7. Añadir la colisión de carretera: solapamiento AABB con un vehículo del carril actual resta una vida (`onLivesChange`), reinicia la racha a ×1 y devuelve al jugador a la fila 14 columna 10 con el reloj a 45 s. Prueba manual: `tsc --noEmit` sin errores.

8. Añadir el río: en una fila `raft` o `plate`, el jugador debe estar sobre una plataforma que lo sostenga (una placa sumergida no sostiene); si lo está, se desplaza con ella vía `carryX` y se realinea a la celda más cercana al pulsar una flecha; si no lo está o si la plataforma lo saca del canvas, pierde una vida por caída al agua. Prueba manual: `tsc --noEmit` sin errores.

9. Añadir metas, racha, temporizador y niveles: ocupar una meta vacía suma `60 × multiplicador de racha`, marca la meta, sube la racha (tope ×3), lo publica con `onStatChange("streak", ...)` y devuelve al jugador a la salida con el reloj reiniciado; entrar en una meta ocupada o en el muro es movimiento inválido y se ignora; completar las 5 metas suma 400, sube `onLevelChange`, vacía las metas, acelera los carriles un 10 % (tope ×1.8) y acorta el ciclo de inmersión un 6 % (mínimo 4,0 s); el reloj a 0 resta una vida y reinicia la racha; 0 vidas dispara `onGameOver(score)`. El tiempo se publica redondeado con `onStatChange("time", segundos)`. Prueba manual: `tsc --noEmit` sin errores.

10. Cerrar el ciclo de vida: `start()` arranca el `requestAnimationFrame` y registra el listener de teclado, `pause()` cancela el frame (congelando también reloj y `phase` de las placas), `resume()` descarta el `dt` acumulado y `destroy()` cancela el frame y remueve el listener. Prueba manual: `tsc --noEmit` sin errores.

11. Registrar `cruce-marea` en `lib/games/registry.ts` (`width: W`, `height: H`, `usesLives: true`, `extraStats` TIEMPO y RACHA). Prueba manual: `/juego/cruce-marea/jugar` muestra el canvas real corriendo en vez del `game-arena` simulado, con Puntuación, Vidas, Nivel, TIEMPO y RACHA actualizándose en el HUD.

12. Verificar pausa/reanudación y fin de partida: PAUSA congela vehículos, plataformas, reloj y ciclo de inmersión (una placa a punto de hundirse sigue igual al reanudar); REANUDAR sigue sin salto; perder las 5 vidas por las cuatro causas (atropello, agua sin plataforma, placa hundida bajo los pies, arrastre fuera del canvas y reloj a 0) abre el modal de fin automáticamente; el botón FIN sigue funcionando manualmente. Prueba manual: recorrido completo en el navegador provocando cada causa al menos una vez.

13. Verificar guardado y Salón de la Fama con `game_id: "cruce-marea"`: jugar, perder, guardar con iniciales y confirmar que aparece en `/juego/cruce-marea` y en `/salon`. Prueba manual: recorrido Biblioteca → Detalle → Reproductor → Game Over → Guardar → Detalle/Salón, sin errores de consola.

14. Verificación final: `npm run build` compila sin errores y el resto del catálogo sigue igual. Prueba manual: partida rápida de otro juego con motor real (`snake` o `arkanoid`) y revisión de `/biblioteca` completa.

## Criterios de aceptación

- [ ] `games` incluye una fila con `id: "cruce-marea"`, `cat: "ARCADE"`, `color: "cyan"`, `cover: "cover-cruce-marea"` y `available: true`, y el juego aparece en `/biblioteca` filtrable por búsqueda y por categoría.
- [ ] `/juego/cruce-marea` muestra la info real del juego y un leaderboard (top 10) filtrado por `game_id = 'cruce-marea'`, inicialmente vacío.
- [ ] La portada usa la clase CSS `.cover-cruce-marea` definida en `app/globals.css`, sin ninguna imagen.
- [ ] En `/juego/cruce-marea/jugar`, el `game-arena` simulado es reemplazado por un `<canvas>` que corre `lib/games/cruce-marea.ts`, con resolución lógica 800×600.
- [ ] Cada pulsación de `←` `→` `↑` `↓` mueve al jugador exactamente una celda de 40px; mantener la tecla pulsada no encadena pasos automáticos.
- [ ] El tablero tiene 6 carriles de carretera, 6 de río (3 de balsas y 3 de placas), una orilla intermedia y 5 casillas meta.
- [ ] Todos los carriles se mueven a velocidad constante con sentidos alternos y los obstáculos reaparecen por el lado opuesto sin saltos visibles.
- [ ] Las placas siguen su ciclo 4,0 s a flote → 1,2 s parpadeando → 1,6 s sumergidas, con carriles desfasados entre sí, y no todas las placas del río están sumergidas al mismo tiempo.
- [ ] Estar sobre una placa que se sumerge resta una vida; estar sobre una placa parpadeando todavía no.
- [ ] Estar en una fila de río sin plataforma bajo los pies resta una vida.
- [ ] Estando sobre una balsa o placa a flote, el jugador se desplaza con ella; si la plataforma lo saca del canvas, pierde una vida.
- [ ] Ser alcanzado por un vehículo resta una vida y devuelve al jugador a la fila de salida.
- [ ] Alcanzar por primera vez cada fila superior del intento suma exactamente 10 puntos.
- [ ] Ocupar una meta vacía suma 60 puntos multiplicados por la racha vigente (×1, ×2 o ×3), la marca como ocupada y devuelve al jugador a la salida con el reloj a 45 s.
- [ ] La racha sube una posición por meta consecutiva (tope ×3) y vuelve a ×1 al perder una vida por cualquier causa.
- [ ] Completar las 5 metas suma 400 puntos, incrementa el Nivel, vacía las metas, acelera los carriles un 10 % (tope ×1.8) y acorta el ciclo de inmersión un 6 % (mínimo 4,0 s de ciclo).
- [ ] El reloj llegando a 0 resta una vida y se reinicia a 45 s.
- [ ] El HUD del Reproductor muestra Puntuación, Vidas, Nivel, TIEMPO y RACHA en tiempo real.
- [ ] Perder la última de las 5 vidas dispara `onGameOver` y abre el modal de fin automáticamente; el botón FIN sigue abriendo el modal manualmente en cualquier momento.
- [ ] PAUSA congela por completo el loop (vehículos, plataformas, reloj y ciclo de inmersión no avanzan) y REANUDAR continúa sin salto de física.
- [ ] Guardar la puntuación inserta una fila real en `scores` con `game_id: "cruce-marea"` y aparece en el Detalle de `/juego/cruce-marea` y en `/salon`.
- [ ] Salir del Reproductor detiene el loop: no queda `requestAnimationFrame` corriendo en background ni listeners de teclado registrados.
- [ ] El canvas se adapta a móvil y desktop sin distorsionar el dibujo, manteniendo la resolución lógica 800×600.
- [ ] Los colores usan solo la paleta neón del Vault sobre fondo `#0a0a0f`.
- [ ] El resto del catálogo (incluida la fila mock `ranaria`) no cambia su comportamiento ni apariencia.
- [ ] `npm run build` compila sin errores de TypeScript.
- [ ] No hay errores en la consola durante el recorrido completo Biblioteca → Detalle → Reproductor → Game Over → Guardar → Detalle/Salón.

## Decisiones tomadas y descartadas

**Derivado del ejemplo (memoria `cruce.md`)**

- **Sí:** Avance por rejilla vertical, carretera con carriles de velocidad y sentido alternos, río con plataformas móviles y casillas meta arriba. Origen: `cruce.md:10`.
- **Sí:** Existen dos clases de plataforma en el río ("troncos y tortugas"). Origen: `cruce.md:10`; aquí se portan como balsas y placas.
- **Sí:** Movimiento por celdas discretas, obstáculos rectangulares a velocidad constante y envolvimiento lateral. Origen: `cruce.md:16`.
- **Sí:** El acarreo sobre plataformas y la detección de caída al agua son el núcleo delicado y se tratan en pasos propios del plan. Origen: `cruce.md:16`.
- **Sí:** Contrarreloj por intento y puntuación por fila avanzada y meta completada. Origen: `cruce.md:10`.
- **Sí:** `cat: "ARCADE"`. Origen: `cruce.md:12`.
- **Sí:** Sin assets binarios; portada como clase CSS de carriles horizontales de neón. Origen: `cruce.md:16`.
- **Sí:** Nombre y estética propios, sin rana ni paleta del clásico. Origen: `cruce.md:16`.
- **No:** Reutilizar la fila mock `ranaria` ni su `cover-rana`. Razón: el ejemplo exige nombre y estética propios sin rana (`cruce.md:16`).

**Asunción del agente game-jam (huecos del ejemplo)**

- **Sí:** Las "tortugas" del ejemplo se portan como placas con ciclo de inmersión (4,0 / 1,2 / 1,6 s), distintas de las balsas siempre sólidas. Razón: el ejemplo nombra dos tipos de plataforma sin diferenciarlos; si no se hundieran serían el mismo objeto que el tronco, así que la inmersión es la extrapolación natural de que sean dos. La variante A toma la lectura opuesta.
- **Sí:** Rejilla de 20 × 15 celdas de 40px (canvas 800×600). Razón: el ejemplo no fija medidas; el tablero ancho da recorrido lateral a las plataformas, que es lo que hace interesante el acarreo, y 800×600 es una resolución ya usada en el repo (`arkanoid`).
- **Sí:** 5 vidas en vez de 3 (`usesLives: true`). Razón: el ejemplo no define qué ocurre al morir; con placas que se hunden las muertes son más frecuentes, así que el margen se amplía para que el nivel 1 siga siendo terminable.
- **Sí:** 45 segundos por intento, reiniciados al ocupar meta o perder vida. Razón: el ejemplo exige contrarreloj por intento sin dar duración; el tablero es más largo y el río más lento que en la variante A, así que necesita más margen.
- **Sí:** Multiplicador de racha (×1/×2/×3) sobre los puntos de meta en lugar del bonus por tiempo restante. Razón: el ejemplo puntúa por tiempo restante, pero aquí el reloj es holgado por diseño y el bonus sería casi constante; la racha premia lo mismo que el ejemplo quiere premiar —cruzar rápido y sin morir— con una señal más viva en el HUD. Se documenta como desviación consciente del ejemplo, no como parte de él.
- **Sí:** Valores concretos de puntuación (10 por fila, 60 por meta, 400 por nivel completo). Razón: el ejemplo fija las fuentes de puntos pero ningún número.
- **Sí:** Progresión: +10 % de velocidad por nivel (tope ×1.8) y ciclo de inmersión un 6 % más corto (mínimo 4,0 s). Razón: el ejemplo pide progresión sin definirla; escalar las dos palancas del río es lo coherente con que el río sea el protagonista.
- **Sí:** Solo teclado, una celda por pulsación, ignorando `event.repeat`. Razón: regla dura del proyecto y consecuencia del movimiento por celdas discretas del ejemplo.
- **Sí:** `color: "cyan"` en vez del magenta sugerido. Razón: el ejemplo sugiere magenta (`cruce.md:12`), reservado para la variante A; el cian encaja con el río protagonista de esta variante y la diferencia en la Biblioteca.
- **No:** Corrientes que arrastren al jugador al entrar al agua, o plataformas que se hundan al pisarlas por peso. Razón: el ejemplo no las insinúa; añadirlas sería un sistema nuevo, no una lectura de lo que ya dice.

**Por qué esta variante existe frente a las otras**

Es la única que da al río un comportamiento propio en vez de tratarlo como una carretera lenta. Frente a la variante A, cambia la resolución del hueco "troncos y tortugas", el tamaño del tablero, el número de vidas y el modelo de puntuación (racha en vez de tiempo sobrante); frente a `cruce-sprint`, va exactamente en la dirección opuesta —amplía la mitad que aquella elimina—. Es la más cara y la de mayor riesgo de las tres.

## Riesgos identificados

| Riesgo                                                                                                                         | Mitigación                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El acarreo sobre plataformas mezcla posición en píxeles con rejilla discreta y puede dejar al jugador desalineado              | El jugador guarda `col` lógico más un `carryX` en píxeles y se realinea a la celda más cercana antes de aplicar cada paso. Verificado en el paso 8.                                      |
| Los ciclos de inmersión pueden alinearse y dejar un instante sin ninguna plataforma utilizable, volviendo el río imposible     | Cada carril de placas arranca con `phase` desfasado y los carriles de balsas (siempre sólidos) se intercalan entre ellos; se verifica en el paso 12 observando el río durante un minuto. |
| Los ciclos de inmersión pueden desincronizarse si se calculan con `Date.now()` en vez del `dt` del loop, avanzando en la pausa | `phase` y el reloj se actualizan solo con el `dt` del `requestAnimationFrame`, que `pause()` cancela; `resume()` descarta el `dt` acumulado. Verificado en el paso 12.                   |
| Con 5 vidas y placas que se hunden, la partida puede resultar frustrante o injustamente corta para un jugador nuevo            | La ventana de parpadeo (1,2 s) avisa antes de hundirse y las velocidades del nivel 1 son bajas en el río; se ajustan tras la prueba manual del paso 12 si el nivel 1 no es superable.    |
| El tablero de 800×600 con 20 columnas puede hacer que la celda de 40px se vea pequeña en móvil                                 | El canvas se escala por CSS manteniendo la resolución lógica, igual que `arkanoid`; se revisa en móvil durante el paso 12.                                                               |

## Qué **no** incluye este spec

- Sonido/música.
- Controles táctiles/on-screen para móvil.
- Tests automatizados.
- Balance fino distinto a las constantes definidas aquí.
- Autenticación.
- Power-ups, recogibles, corrientes o enemigos perseguidores.
- Cualquier cambio a los juegos ya implementados o a las filas mock del catálogo.

Cada uno de estos, si se necesita, va en su propio spec.
