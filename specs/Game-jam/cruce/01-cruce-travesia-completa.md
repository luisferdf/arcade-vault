# SPEC — Juego real: CRUCE (variante A · travesía completa)

> **Estado:** Borrador
> **Depende de:** 06-leaderboard-catalogo-supabase, 07-juego-tetris (base genérica de motores en `lib/games/engine.ts` y `lib/games/registry.ts`)
> **Fecha:** 2026-09-08
> **Objetivo:** Agregar "Cruce" como juego nuevo y jugable (id `cruce`), un avance por rejilla vertical donde el jugador sube fila a fila esquivando vehículos en carriles alternos y después cruza un río sobre plataformas móviles hasta ocupar las 5 casillas meta, contrarreloj y con 3 vidas.

## Por qué existe esta spec

El catálogo no tiene ningún juego de evasión pura sin disparo: Arkanoid y Snake son de trayectoria continua y Asteroides es de disparo. Cruce aporta ritmo corto de reflejos con progresión clara, y magenta sigue sin usarse en portadas implementadas.

Esta variante es la **travesía completa**: porta las dos mitades del ejemplo (carretera y río) en un solo tablero, con la resolución más conservadora de los huecos que el ejemplo deja abiertos (vidas clásicas, reloj por intento, plataformas siempre sólidas). Las variantes B (`cruce-sprint`) y C (`cruce-marea`) resuelven esos mismos huecos de otra forma.

## Alcance

**Incluido:**

- Nueva fila en la tabla `games` de Supabase con `id: "cruce"`, `cat: "ARCADE"`, `cover: "cover-cruce"`, `color: "magenta"`, `available: true`.
- Nueva clase CSS `.cover-cruce` en `app/globals.css` (carriles horizontales de neón magenta con marcas discontinuas), dibujada solo con CSS, sin imágenes.
- Motor nuevo en `lib/games/cruce.ts`: rejilla lógica de 13 columnas × 14 filas con celda de 40px (canvas 520×560), movimiento del jugador por celdas discretas, carriles de vehículos con velocidad y sentido alternos y envolvimiento lateral, río con plataformas móviles que acarrean al jugador, 5 casillas meta, temporizador por intento, 3 vidas y niveles de velocidad creciente.
- Controles: solo teclado. `←` `→` `↑` `↓` mueven una celda por pulsación; se ignora el auto-repeat del sistema (una pulsación = un paso). No hay mouse ni táctil.
- HUD: únicamente el del Reproductor (Puntuación, Vidas, Nivel) más una stat extra `TIEMPO` vía `extraStats`/`onStatChange`. No se dibuja HUD dentro del canvas.
- Puntuación entera: 10 puntos por cada fila nueva alcanzada (récord de avance del intento), 50 por meta ocupada, 2 puntos por cada segundo restante del temporizador al ocupar una meta, 500 al completar las 5 metas de un nivel.
- Paleta neón del Vault: jugador `--green`, vehículos `--magenta` y `--yellow` según sentido del carril, plataformas del río `--cyan`, casillas meta `--yellow` (vacías) / `--green` (ocupadas), agua y asfalto como bandas atenuadas sobre fondo `#0a0a0f`.
- Ciclo de vida estándar `ArcadeGame` (`start`/`pause`/`resume`/`destroy`) de `lib/games/engine.ts`, con `pause()` congelando todo el loop y `resume()` descartando el `dt` acumulado.
- Registro del motor en `lib/games/registry.ts` (una entrada `cruce`), sin tocar `GamePlayerClient.tsx`.
- Guardado de puntuación con `saveScore()` de `lib/scores.ts` y `gameId: "cruce"`.

**Fuera de alcance (para specs futuros):**

- Sonido/música.
- Controles táctiles/on-screen para móvil.
- Tests automatizados.
- Balance fino más allá de las constantes definidas aquí.
- Autenticación/login (sigue sin requerirse para guardar puntuación).
- Enemigos que persigan al jugador, power-ups, objetos recogibles o cualquier sistema que el ejemplo no insinúa.
- Cualquier cambio a los juegos ya implementados (`asteroides`, `tetris`, `arkanoid`, `snake`) o a las filas mock del catálogo, incluida `ranaria`, que queda intacta.

## Modelo de datos

**Nueva fila en `games`** (vía `apply_migration` / `execute_sql`):

```sql
insert into public.games (id, title, short, long, cat, cover, color, available)
values (
  'cruce',
  'CRUCE',
  'Sube fila a fila entre el tráfico y el río hasta ocupar las cinco metas.',
  'Avanza por una rejilla vertical: primero seis carriles de vehículos que van en sentidos alternos, después un río donde solo sobreviven quienes saltan sobre las plataformas en movimiento. Ocupa las cinco casillas meta antes de que se agote el reloj de cada intento; cada nivel completo acelera todos los carriles.',
  'ARCADE',
  'cover-cruce',
  'magenta',
  true
);
```

**Motor (`lib/games/cruce.ts`)**, implementando el contrato `ArcadeGame`/`GameCallbacks` de `lib/games/engine.ts`:

```ts
export const W = 520; // 13 columnas × 40px
export const H = 560; // 14 filas × 40px
const CELL = 40;
const COLS = 13;
const ROWS = 14;

export type LaneKind = "road" | "river";

export interface Lane {
  row: number; // 0 = fila superior
  kind: LaneKind;
  dir: 1 | -1; // sentido de avance
  speed: number; // celdas por segundo
  gap: number; // separación entre obstáculos, en celdas
  size: number; // ancho del obstáculo, en celdas
  offset: number; // desplazamiento acumulado, en celdas (envolvimiento lateral)
}

export class CruceGame implements ArcadeGame {
  constructor(ctx: CanvasRenderingContext2D, callbacks: GameCallbacks);
  start(): void;
  pause(): void;
  resume(): void;
  destroy(): void;
}
```

Estado interno: celda actual del jugador (`col`, `row`) más un `carryX` en píxeles cuando va sobre una plataforma, fila récord del intento, array de `Lane`, array de 5 metas (`{ col, filled }`), tiempo restante del intento, vidas, nivel, score.

**Distribución de filas** (origen top-left, fila 0 arriba):

| Fila(s) | Contenido                                                                        |
| ------- | -------------------------------------------------------------------------------- |
| 0       | Franja meta: 5 casillas en las columnas 0, 3, 6, 9 y 12; el resto es muro sólido |
| 1–5     | Río: 5 carriles de plataformas                                                   |
| 6       | Orilla segura (mediana)                                                          |
| 7–12    | Carretera: 6 carriles de vehículos                                               |
| 13      | Franja de salida (spawn del jugador, columna 6)                                  |

**Constantes de carriles (nivel 1):** carretera con velocidades `1.2 / 1.8 / 2.4 / 1.5 / 3.0 / 2.1` celdas/s y sentido alterno empezando por `-1` en la fila 12; río con velocidades `0.9 / 1.4 / 1.1 / 1.8 / 1.3` celdas/s y sentido alterno empezando por `+1` en la fila 5. Cada nivel superado multiplica todas las velocidades por 1.12, con tope en ×2.0.

**Temporizador:** 30 segundos por intento (se reinicia al ocupar una meta y al perder una vida). Llegar a 0 cuesta una vida.

`lib/games/registry.ts` suma una entrada:

```ts
cruce: {
  width: W,
  height: H,
  usesLives: true,
  extraStats: [{ key: "time", label: "TIEMPO" }],
  create: (ctx, callbacks) => new CruceGame(ctx, callbacks),
},
```

No se crean tablas ni columnas nuevas: el guardado sigue vía `saveScore({ gameId: "cruce", name, score })` de `lib/scores.ts`.

## Plan de implementación

1. Insertar la fila `cruce` en `games` (según el modelo de datos) vía `apply_migration` o `execute_sql`. Prueba manual: `select id, title, available from games where id = 'cruce'` devuelve la fila; el juego aparece en `/biblioteca` filtrable por categoría ARCADE y `/juego/cruce` carga con leaderboard vacío, sin errores de consola.

2. Crear la clase `.cover-cruce` en `app/globals.css`: bandas horizontales alternas oscuras con líneas discontinuas en `--magenta` y una franja superior en `--yellow` que sugiere las metas, todo con gradientes y pseudo-elementos, sin imágenes. Prueba manual: la tarjeta de `/biblioteca` y la portada de `/juego/cruce` muestran la nueva portada, visualmente distinta de `.cover-arkanoid` y `.cover-snake`.

3. Crear `lib/games/cruce.ts` con el esqueleto: constantes `W`/`H`/`CELL`/`COLS`/`ROWS`, la tabla de filas, el tipo `Lane`, la generación de carriles del nivel 1 y el dibujo estático del tablero (bandas de asfalto, agua, orilla, salida y las 5 casillas meta). Prueba manual: `tsc --noEmit` sin errores; el archivo aún no se importa desde ninguna página.

4. Añadir el movimiento de los carriles: cada `Lane` acumula `offset += dir * speed * dt` y los obstáculos se dibujan en `(col * CELL + offset * CELL) mod (W + size * CELL)` para lograr el envolvimiento lateral. Prueba manual: `tsc --noEmit` sin errores.

5. Añadir el jugador y su movimiento por celdas: `keydown` mueve una celda en la dirección pulsada, sin salir de la rejilla; el auto-repeat se ignora comprobando `event.repeat`. Al alcanzar una fila superior a la récord del intento se suman 10 puntos vía `onScoreChange`. Prueba manual: `tsc --noEmit` sin errores.

6. Añadir colisiones de carretera: si el rectángulo del jugador se solapa con el rectángulo de un vehículo del carril donde está, se pierde una vida (`onLivesChange`) y el jugador vuelve a la fila 13, columna 6, con el temporizador reiniciado. Prueba manual: `tsc --noEmit` sin errores.

7. Añadir el río: estando en una fila `river`, el jugador debe estar sobre una plataforma; si lo está, su posición en píxeles se desplaza con la plataforma (`carryX`) y al moverse de celda se realinea a la celda más cercana; si no lo está, o si la plataforma lo arrastra fuera del canvas, se pierde una vida por caída al agua. Prueba manual: `tsc --noEmit` sin errores.

8. Añadir metas, temporizador y niveles: entrar en una casilla meta vacía la marca como ocupada, suma 50 + 2 por segundo restante y devuelve al jugador a la salida con el reloj reiniciado; entrar en una meta ya ocupada o en el muro de la fila 0 no hace nada (movimiento inválido, se ignora); completar las 5 metas suma 500, sube `onLevelChange`, vacía las metas y multiplica las velocidades por 1.12 (tope ×2.0); el reloj a 0 cuesta una vida; 0 vidas dispara `onGameOver(score)`. El tiempo restante se publica redondeado a segundos con `onStatChange("time", segundos)`. Prueba manual: `tsc --noEmit` sin errores.

9. Cerrar el ciclo de vida: `start()` arranca el `requestAnimationFrame` y registra el listener de teclado, `pause()` cancela el frame, `resume()` descarta el `dt` acumulado y `destroy()` cancela el frame y remueve el listener. Prueba manual: `tsc --noEmit` sin errores.

10. Registrar `cruce` en `lib/games/registry.ts` (`width: W`, `height: H`, `usesLives: true`, `extraStats: [{ key: "time", label: "TIEMPO" }]`). Prueba manual: `/juego/cruce/jugar` muestra el canvas real corriendo en vez del `game-arena` simulado, con Puntuación, Vidas, Nivel y TIEMPO actualizándose en el HUD del Reproductor.

11. Verificar pausa/reanudación y fin de partida: PAUSA congela vehículos, plataformas y reloj en su posición exacta; REANUDAR sigue sin salto de física ni pérdida de segundos; perder las 3 vidas (por atropello, por agua y por reloj a 0, los tres casos) abre el modal de fin automáticamente; el botón FIN sigue funcionando manualmente. Prueba manual: recorrido completo en el navegador provocando las tres causas de muerte.

12. Verificar guardado y Salón de la Fama con `game_id: "cruce"`: jugar, perder, guardar con iniciales y confirmar que la puntuación aparece en `/juego/cruce` y en `/salon`. Prueba manual: recorrido Biblioteca → Detalle → Reproductor → Game Over → Guardar → Detalle/Salón, sin errores de consola.

13. Verificación final: `npm run build` compila sin errores y el resto del catálogo sigue igual. Prueba manual: partida rápida de `snake` o `tetris` para confirmar que el registro compartido no se vio afectado, y revisión de `/biblioteca` completa.

## Criterios de aceptación

- [ ] `games` incluye una fila con `id: "cruce"`, `cat: "ARCADE"`, `color: "magenta"`, `cover: "cover-cruce"` y `available: true`, y el juego aparece en `/biblioteca` filtrable por búsqueda y por categoría.
- [ ] `/juego/cruce` muestra la info real del juego y un leaderboard (top 10) filtrado por `game_id = 'cruce'`, inicialmente vacío.
- [ ] La portada usa la clase CSS `.cover-cruce` definida en `app/globals.css`, sin ninguna imagen.
- [ ] En `/juego/cruce/jugar`, el `game-arena` simulado es reemplazado por un `<canvas>` que corre `lib/games/cruce.ts`, con resolución lógica 520×560.
- [ ] Cada pulsación de `←` `→` `↑` `↓` mueve al jugador exactamente una celda de 40px; mantener la tecla pulsada no encadena pasos automáticos.
- [ ] Los movimientos que sacarían al jugador de la rejilla, o que apuntan al muro de la fila 0, se ignoran sin coste de vida.
- [ ] Los 6 carriles de carretera y los 5 del río se mueven a velocidad constante con sentidos alternos, y los obstáculos reaparecen por el lado opuesto (envolvimiento lateral) sin saltos visibles.
- [ ] Ser alcanzado por un vehículo resta una vida y devuelve al jugador a la fila de salida.
- [ ] Estar en una fila de río sin plataforma bajo los pies resta una vida (caída al agua).
- [ ] Estando sobre una plataforma, el jugador se desplaza con ella; si la plataforma lo saca del canvas, pierde una vida.
- [ ] Alcanzar por primera vez cada fila superior del intento suma exactamente 10 puntos; volver a bajar y subir no vuelve a puntuar esa fila.
- [ ] Ocupar una casilla meta vacía suma 50 puntos más 2 por segundo restante, la marca como ocupada y devuelve al jugador a la salida con el reloj a 30 s.
- [ ] Completar las 5 metas suma 500 puntos, incrementa el Nivel del HUD, vacía las metas y acelera todos los carriles un 12 % (sin superar el doble de la velocidad inicial).
- [ ] El reloj llegando a 0 resta una vida y se reinicia a 30 s.
- [ ] El HUD del Reproductor muestra Puntuación, Vidas, Nivel y la stat extra TIEMPO, todos en tiempo real.
- [ ] Perder la última vida dispara `onGameOver` y abre el modal de fin automáticamente; el botón FIN sigue abriendo el modal manualmente en cualquier momento.
- [ ] PAUSA congela por completo el loop (vehículos, plataformas y reloj no cambian) y REANUDAR continúa sin salto de física.
- [ ] Guardar la puntuación inserta una fila real en `scores` con `game_id: "cruce"` y aparece en el Detalle de `/juego/cruce` y en `/salon`.
- [ ] Salir del Reproductor detiene el loop: no queda `requestAnimationFrame` corriendo en background ni listeners de teclado registrados.
- [ ] El canvas se adapta a móvil y desktop sin distorsionar el dibujo, manteniendo la resolución lógica 520×560.
- [ ] Los colores usan solo la paleta neón del Vault sobre fondo `#0a0a0f`.
- [ ] El resto del catálogo (`asteroides`, `tetris`, `arkanoid`, `snake` y las filas mock, incluida `ranaria`) no cambia su comportamiento ni apariencia.
- [ ] `npm run build` compila sin errores de TypeScript.
- [ ] No hay errores en la consola durante el recorrido completo Biblioteca → Detalle → Reproductor → Game Over → Guardar → Detalle/Salón.

## Decisiones tomadas y descartadas

**Derivado del ejemplo (memoria `cruce.md`)**

- **Sí:** Avance por rejilla vertical, fila a fila, esquivando vehículos y después cruzando un río sobre plataformas móviles hasta las casillas meta. Origen: `cruce.md:10`.
- **Sí:** `cat: "ARCADE"` y `color: "magenta"`. Origen: `cruce.md:12`; magenta no está usado en ninguna portada implementada.
- **Sí:** Movimiento por celdas discretas, obstáculos rectangulares a velocidad constante y envolvimiento lateral de carriles. Origen: `cruce.md:16`.
- **Sí:** Acarreo del jugador sobre las plataformas y detección de caída al agua como núcleo delicado del motor, tratado en su propio paso del plan. Origen: `cruce.md:16`.
- **Sí:** Contrarreloj por intento y puntuación por fila avanzada, meta completada y tiempo restante. Origen: `cruce.md:10`.
- **Sí:** Sin assets binarios; portada como clase CSS de carriles horizontales de neón. Origen: `cruce.md:16`.
- **Sí:** Nombre "CRUCE" y estética propia del Vault; nada de rana ni de la paleta del clásico. Origen: `cruce.md:16`.
- **No:** Reutilizar la fila mock `ranaria` (y su `cover-rana`) como base del juego. Razón: el ejemplo exige explícitamente nombre y estética propios sin rana (`cruce.md:16`); se crea fila nueva y la mock queda intacta, como se hizo con `arkanoid` frente a `bloque-buster`.

**Asunción del agente game-jam (huecos del ejemplo)**

- **Sí:** Rejilla de 13 × 14 celdas de 40px (canvas 520×560), con 6 carriles de carretera, 5 de río, una orilla intermedia y 5 metas. Razón: el ejemplo pide las dos mitades más metas en plural pero no da medidas; es la rejilla mínima que aloja ambas zonas con la relación vertical típica del género y se acerca en tamaño a los canvas ya usados (600×600 en Snake).
- **Sí:** 3 vidas (`usesLives: true`). Razón: el ejemplo habla de "intento" en singular pero no define qué ocurre al morir; 3 vidas es el mismo valor que ya usan `asteroides` y `arkanoid` en este repo, así que mantiene coherencia interna.
- **Sí:** 30 segundos por intento, reiniciados al ocupar una meta o perder una vida. Razón: el ejemplo exige contrarreloj por intento sin dar duración; 30 s deja margen para una travesía completa de 13 filas sin volverla trivial.
- **Sí:** Valores concretos de puntuación (10 por fila nueva, 50 por meta, 2 por segundo restante, 500 por nivel completo). Razón: el ejemplo fija las tres fuentes de puntos pero ningún número; estos mantienen el orden de magnitud del resto del catálogo y hacen que la meta pese más que el avance.
- **Sí:** Las plataformas del río son siempre sólidas: se mueven, pero no se hunden. Razón: el ejemplo menciona "troncos y tortugas" sin describir comportamiento distinto entre ambos; la extrapolación mínima es tratarlos como un solo tipo de plataforma. La variante C explora la lectura alternativa.
- **Sí:** Progresión: completar las 5 metas sube de nivel y multiplica todas las velocidades por 1.12, con tope ×2.0. Razón: el ejemplo habla de progresión por niveles sin definirla; escalar la velocidad es la única palanca que ya existe en el modelo de carriles.
- **Sí:** Solo teclado, una celda por pulsación, ignorando `event.repeat`. Razón: regla dura del proyecto (solo teclado) y consecuencia directa del movimiento por celdas discretas del ejemplo; sin ignorar el auto-repeat, mantener una flecha cruzaría el tablero solo.
- **Sí:** `TIEMPO` como única stat extra del HUD del Reproductor, sin HUD dentro del canvas. Razón: el contrarreloj es información imprescindible y el patrón vigente (Tetris, Snake) es no dibujar HUD en el canvas.
- **No:** Enemigos que persigan al jugador, power-ups o casillas bonus. Razón: el ejemplo no los insinúa y añadirlos sería diseñar un juego distinto.

**Por qué esta variante existe frente a las otras**

Es la única que porta el ejemplo completo —carretera y río— en un mismo tablero, con la lectura más conservadora de cada hueco. `cruce-sprint` recorta el río para quedarse con el núcleo de esquiva y cambia el modelo de tiempo y de muerte; `cruce-marea` amplía el río y hace de las plataformas que se hunden su mecánica central. Esta es la referencia fiel; las otras dos son especializaciones.

## Riesgos identificados

| Riesgo                                                                                                                                  | Mitigación                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| El acarreo sobre plataformas mezcla posición en píxeles con rejilla discreta y puede dejar al jugador desalineado o "pegado" a un borde | El jugador guarda `col` lógico más un `carryX` en píxeles; al pulsar una flecha se realinea a la celda más cercana antes de aplicar el paso. Verificado en el paso 7.    |
| El envolvimiento lateral puede generar un hueco visible o un solapamiento de obstáculos al reaparecer                                   | El módulo se calcula sobre `W + size * CELL` y la separación `gap` se define en celdas enteras; se revisa visualmente en el paso 4 con cada velocidad de carril.         |
| El reloj puede seguir corriendo durante la pausa si se calcula con `Date.now()` en vez del `dt` del loop                                | El temporizador se descuenta únicamente con el `dt` del `requestAnimationFrame`, que `pause()` cancela; `resume()` descarta el `dt` acumulado. Verificado en el paso 11. |
| Con velocidades escaladas al máximo (×2.0), algún carril podría volverse imposible de cruzar                                            | Tope explícito de ×2.0 y `gap` mínimo de 3 celdas por carril; se juega el nivel 6 en el paso 11 para confirmar que sigue siendo superable.                               |

## Qué **no** incluye este spec

- Sonido/música.
- Controles táctiles/on-screen para móvil.
- Tests automatizados.
- Balance fino distinto a las constantes definidas aquí.
- Autenticación.
- Power-ups, recogibles o enemigos perseguidores.
- Cualquier cambio a los juegos ya implementados o a las filas mock del catálogo.

Cada uno de estos, si se necesita, va en su propio spec.
