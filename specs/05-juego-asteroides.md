# SPEC 05 — Juego real: Asteroides

> **Estado:** aprobado
> **Depende de:** 01-mvp-visual (pantallas del MVP, especialmente Biblioteca y el Reproductor en `app/juego/[id]/jugar/page.tsx`)
> **Fecha:** 2026-08-10
> **Objetivo:** Agregar "Asteroides" como juego nuevo y jugable en el catálogo (id `asteroides`), con motor real adaptado de `references/started-games/02-asteroids/game.js`, integrado al HUD y la pausa ya existentes del Reproductor. `rocas` queda intacta y sin relación con esta spec.

## Alcance

**Incluido:**

- Nueva entrada en `GAMES` (`lib/games.ts`) con `id: "asteroides"`, título "ASTEROIDES", categoría `SHOOTER`, descripciones corta/larga basadas en el README del juego original, color/cover propios (a definir en el modelo de datos), y `best`/`plays` placeholder coherentes con el resto del catálogo mock.
- Motor del juego portado a `lib/games/asteroids.ts`: nave, disparo, asteroides con fragmentación, colisiones, vidas, niveles, puntaje, invencibilidad al reaparecer, power-up de triple disparo, partículas de explosión — fiel al `game.js` original, sin recortes de mecánica.
- Adaptación visual del motor a la paleta neón del Vault (colores del tema `@theme`, ej. acento amarillo/cian) en vez del blanco/negro puro del original.
- Componente cliente que monta el motor en un `<canvas>` dentro de `app/juego/[id]/jugar/page.tsx`, activo únicamente cuando `id === 'asteroides'`; el resto de juegos siguen usando el `game-arena` simulado sin cambios.
- Resolución lógica interna fija (800×600) con el `<canvas>` escalado por CSS para adaptarse al CRT responsive del Reproductor.
- Controles solo de teclado (flechas + espacio), igual que el original — sin controles táctiles en esta spec.
- Sincronización del motor como fuente de verdad: el motor expone callbacks (`onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver`) que actualizan el estado React del HUD superior del Reproductor (puntuación/vidas/nivel) y disparan el modal de fin de juego automáticamente al perder la última vida. El HUD interno del canvas (`drawHUD`, dibujado dentro del juego original) se conserva tal cual — coexisten ambos HUD, el del canvas y el del Reproductor, ambos alimentados por el mismo estado del motor.
- Pausa real: el botón PAUSA existente del Reproductor congela por completo el loop del motor (`requestAnimationFrame` detenido, sin actualizar física ni redibujar); al reanudar, continúa sin saltos (se descarta el `dt` acumulado durante la pausa).
- El botón FIN sigue abriendo el modal de fin de juego manualmente en cualquier momento, además del disparo automático por 0 vidas.
- Guardado de puntuación al finalizar sigue usando el flujo existente (`addStoredScore` con `game: "asteroides"`), reflejándose en el Salón de la Fama sin cambios en esa pantalla.

**Fuera de alcance (para specs futuros):**

- Cualquier cambio a la entrada `rocas` o a los otros 7 juegos mock — quedan exactamente como están.
- Controles táctiles/on-screen para móvil.
- Sonido/música.
- Persistencia de puntuaciones en Supabase (sigue usando `localStorage`, como el resto del MVP).
- Tests automatizados.
- Ajustes de dificultad/balance distintos a los del `game.js` original.

## Modelo de datos

**Nueva entrada en `lib/games.ts` (`GAMES: Game[]`)**, usando la interfaz `Game` ya existente (sin cambios de forma):

```ts
{
  id: "asteroides",
  title: "ASTEROIDES",
  short: "Nave espacial en un campo de asteroides con envolvimiento toroidal.",
  long: "Pilota una nave triangular en un espacio sin bordes: lo que sale por un lado reaparece por el opuesto. Destruye asteroides grandes para partirlos en medianos y luego en pequeños, recoge el power-up de disparo triple y sobrevive con tus 3 vidas.",
  cat: "SHOOTER",
  cover: "cover-asteroides",
  color: "yellow",
  best: 41200,
  plays: "15.6K",
}
```

**Motor del juego (`lib/games/asteroids.ts`)** — sin dependencias de React ni del DOM más allá del `CanvasRenderingContext2D` que recibe; expone una API de construcción/ciclo de vida en vez de las globales del `game.js` original:

```ts
export interface AsteroidsCallbacks {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export class AsteroidsGame {
  constructor(ctx: CanvasRenderingContext2D, callbacks: AsteroidsCallbacks);
  start(): void; // arranca requestAnimationFrame y el estado inicial
  pause(): void; // detiene el loop, congela el estado tal cual está
  resume(): void; // reanuda el loop sin salto de dt
  destroy(): void; // cancela el rAF y remueve listeners de teclado
}
```

Internamente conserva las clases `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp` del original (mismas constantes `RADII`, `SPEEDS`, `POINTS`, `POWERUP_*`, `TRIPLE_SPREAD`), pero con los colores de trazo tomados de tokens del tema neón del Vault en vez de literales `#fff`/`#0ff`.

No se introducen nuevas claves de `localStorage`: el guardado de puntuación sigue usando `StoredScoreEntry` (`av_scores`) ya definido en la spec 01, con `game: "asteroides"`.

## Plan de implementación

1. Agregar la entrada `asteroides` a `GAMES` en `lib/games.ts` (según el modelo de datos). Prueba manual: el juego aparece en la Biblioteca (`/`), filtrable por categoría SHOOTER, y navega a `app/juego/asteroides/page.tsx` (Detalle) mostrando su info y leaderboard mock vía `seededScores`, sin errores en consola.

2. Definir los tokens de color neón a usar por el motor (ej. `--yellow`, `--cyan` ya existentes en `@theme` de `app/globals.css`) y confirmar cuáles aplican a nave/asteroides/balas/partículas/power-up. Prueba manual: no hay cambio funcional aún, solo se documenta la paleta a usar en el paso siguiente.

3. Crear `lib/games/asteroids.ts` portando las clases `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp` y toda la lógica de `update`/colisiones/niveles del `game.js` original, parametrizando `W`/`H`/`ctx` (sin `document.getElementById` ni canvas global), recoloreando los `draw()` con los tokens del paso 2, y conservando `drawHUD` (HUD propio del canvas) pero quitando `drawOverlay` de game-over (ese mensaje pasa a manejarlo el modal de React). Prueba manual: `tsc --noEmit` compila sin errores; el archivo no se importa desde ninguna página todavía.

4. Envolver el motor en la clase `AsteroidsGame` (constructor, `start`, `pause`, `resume`, `destroy`) con los callbacks `onScoreChange`/`onLivesChange`/`onLevelChange`/`onGameOver`, reemplazando las globales `score`/`lives`/`level`/`state` por campos de instancia que disparan los callbacks cuando cambian. Prueba manual: `tsc --noEmit` sigue sin errores.

5. En `app/juego/[id]/jugar/page.tsx`, cuando `game.id === "asteroides"`: renderizar un `<canvas>` en vez del `game-arena` simulado, instanciar `AsteroidsGame` en un `useEffect` (montaje) con `ctx` del canvas y los callbacks conectados a los `useState` existentes de `score`/`lives`/`level`, y llamar `destroy()` en el cleanup. Prueba manual: entrar a `/juego/asteroides/jugar` muestra el juego real corriendo, el HUD superior refleja puntuación/vidas/nivel en tiempo real, y salir de la página no deja el loop corriendo en background (verificar en consola/DevTools Performance).

6. Conectar el botón PAUSA existente a `game.pause()`/`game.resume()` de la instancia activa (en vez de solo alternar el estado `paused` como hace hoy para los juegos simulados), y conectar `onGameOver` para que dispare automáticamente el mismo modal de fin que hoy abre el botón FIN. Prueba manual: pausar congela la nave/asteroides/balas en su posición exacta; reanudar continúa sin salto brusco; perder las 3 vidas dentro del juego abre el modal de fin solo, sin tocar FIN; el botón FIN sigue funcionando manualmente en cualquier momento.

7. Verificar el flujo de guardado de puntuación y Salón de la Fama con `game: "asteroides"`: jugar, perder, guardar con iniciales, y confirmar que aparece en `app/salon/page.tsx` filtrado/mezclado igual que los demás juegos. Prueba manual: recorrido completo Biblioteca → Detalle → Reproductor → Game Over → Guardar → Salón, sin errores de consola.

8. Escalado responsive del `<canvas>`: aplicar CSS (`width/height: 100%`, `aspect-ratio` o el contenedor `crt-screen` existente) manteniendo la resolución lógica 800×600 vía `canvas.width`/`canvas.height`, sin distorsionar el dibujo. Prueba manual: redimensionar la ventana / probar en viewport móvil y desktop, el juego se ve completo y sin recortes ni estiramientos.

9. Verificación final: `npm run build` compila sin errores de TypeScript, y las 8 pantallas existentes (incluyendo `rocas` y los demás juegos simulados) siguen funcionando exactamente igual que antes de esta spec. Prueba manual: recorrer Biblioteca, Detalle y Reproductor de al menos otro juego (ej. `bloque-buster`) para confirmar que el `game-arena` simulado no fue afectado.

## Criterios de aceptación

- [ ] `GAMES` en `lib/games.ts` incluye una entrada con `id: "asteroides"`, categoría `SHOOTER`, y aparece en la Biblioteca filtrable por búsqueda y por categoría.
- [ ] `app/juego/asteroides/page.tsx` (Detalle) muestra la info del juego y un leaderboard generado con `seededScores`, y permite entrar al Reproductor.
- [ ] En `/juego/asteroides/jugar`, el `game-arena` simulado es reemplazado por un `<canvas>` que corre el motor real de `lib/games/asteroids.ts`.
- [ ] La nave rota con flechas izquierda/derecha, propulsa con flecha arriba y dispara con espacio, igual que el original.
- [ ] Los asteroides grandes se fragmentan en medianos y estos en pequeños al ser destruidos por una bala; los pequeños no se fragmentan más.
- [ ] El envolvimiento toroidal (wrap) funciona para nave, balas y asteroides en los 4 bordes del canvas.
- [ ] El power-up de disparo triple aparece, se puede recoger, y activa temporalmente el disparo triple con feedback visual.
- [ ] El HUD superior del Reproductor (puntuación, vidas, nivel) se actualiza en tiempo real reflejando el estado real del motor, coexistiendo con el HUD propio dibujado dentro del canvas (`drawHUD`), ambos mostrando los mismos valores.
- [ ] Al perder la última vida dentro del juego, el modal de "FIN DEL JUEGO" se abre automáticamente sin necesidad de pulsar FIN.
- [ ] El botón FIN sigue abriendo el modal de fin de juego manualmente en cualquier momento durante la partida.
- [ ] El botón PAUSA congela por completo el loop del motor (posiciones exactas de nave/asteroides/balas no cambian mientras está en pausa) y REANUDAR continúa sin salto brusco.
- [ ] Guardar la puntuación en el modal persiste en `localStorage` (`av_scores`) con `game: "asteroides"` y aparece reflejada en `app/salon/page.tsx`.
- [ ] Salir del Reproductor (botón SALIR o navegación) detiene el loop del motor y no deja `requestAnimationFrame` corriendo en background.
- [ ] El `<canvas>` se adapta al viewport (móvil y desktop) sin distorsionar el dibujo, manteniendo la resolución lógica interna 800×600.
- [ ] Los colores del motor (nave, asteroides, balas, partículas, power-up) usan tokens del tema neón del Vault en vez del blanco/negro original.
- [ ] La entrada `rocas` y los otros 7 juegos mock no cambian su comportamiento ni apariencia.
- [ ] `npm run build` compila sin errores de TypeScript.
- [ ] No hay errores en la consola del navegador durante el recorrido completo Biblioteca → Detalle → Reproductor → Game Over → Guardar → Salón.

## Decisiones tomadas y descartadas

- **Sí:** "Asteroides" es un juego nuevo e independiente (`id: "asteroides"`), no una reutilización de la entrada mock `rocas`. Razón: decisión explícita del usuario — `rocas` no se toca en absoluto en esta spec.
- **Sí:** Motor portado a `lib/games/asteroids.ts` como módulo TS puro (sin JSX), en vez de un componente React monolítico. Razón: mantiene la lógica de juego desacoplada de React, siguiendo la convención existente de `lib/` para lógica no-UI, y facilita portar fielmente las clases del `game.js` original.
- **Sí:** El motor es la fuente de verdad del estado (score/vidas/nivel) vía callbacks hacia React, y se conserva también el HUD dibujado dentro del canvas original. Razón: decisión explícita del usuario — el juego ya tiene su propio HUD y controles y debe mantenerse; el HUD superior del Reproductor se suma como una segunda vista del mismo estado, no lo reemplaza.
- **Sí:** La pausa la controla el HUD del Reproductor invocando `pause()`/`resume()` del motor, congelando el loop por completo. Razón: indicación explícita del usuario — el contenedor existente debe ser quien controla la pausa real, no una capa visual superpuesta.
- **Sí:** El modal de fin de juego se dispara tanto manualmente (botón FIN) como automáticamente vía `onGameOver` al perder la última vida. Razón: confirmado por el usuario — ambos caminos deben coexistir.
- **Sí:** Se porta la mecánica completa del original (power-up de triple disparo, partículas, invencibilidad al reaparecer) sin recortes. Razón: decisión explícita del usuario de no simplificar el gameplay.
- **Sí:** Se recolorea el motor a la paleta neón del Vault en vez de mantener el blanco/negro original. Razón: decisión explícita del usuario para integrar visualmente el juego con el resto de la plataforma.
- **Sí:** Resolución lógica fija 800×600 con escalado por CSS, en vez de recalcular la física a la resolución real del viewport. Razón: evita reescribir todas las constantes de velocidad/posición del original; es el enfoque más simple para un canvas responsive sin tocar el balance del juego.
- **No:** Controles táctiles en esta spec. Razón: el original es solo teclado y agregarlos ahora ampliaría el alcance; queda para un spec futuro si se necesita soporte móvil real.

## Riesgos identificados

| Riesgo                                                                                                                                                                                           | Mitigación                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El loop del motor (`requestAnimationFrame`) sigue corriendo tras desmontar la página del Reproductor (memory leak / juego fantasma en background)                                                | `destroy()` cancela el rAF y remueve los listeners de teclado en el cleanup del `useEffect`; verificar explícitamente en el paso 5 del plan con DevTools                              |
| Los listeners de teclado (`keydown`/`keyup`) del original son globales (`window`); si dos instancias del motor coexisten brevemente (ej. re-render en modo estricto de React) podrían duplicarse | El constructor de `AsteroidsGame` registra sus propios listeners y `destroy()` los remueve explícitamente antes de que `start()` pueda volver a registrarlos                          |
| Recolorear el motor a la paleta neón puede reducir el contraste/legibilidad de asteroides y balas contra el fondo negro del canvas                                                               | Revisar visualmente cada elemento (nave, asteroides, balas, partículas, power-up) contra el fondo antes de dar la spec por terminada, ajustando tokens si hace falta                  |
| Escalar un canvas de resolución lógica fija (800×600) por CSS puede verse borroso o pixelado en pantallas de alta densidad (DPR > 1)                                                             | Aplicar `devicePixelRatio` al backing store del canvas (`canvas.width = 800 * dpr`, escalado del contexto) si se detecta pérdida de nitidez durante la verificación visual del paso 8 |
| Congelar el loop en pausa pero dejar el `dt` del siguiente frame sin resetear podría producir un salto grande de física al reanudar                                                              | `resume()` descarta el timestamp anterior (`lastTime = null` o equivalente) para que el primer `dt` post-pausa sea 0, igual que al iniciar el juego                                   |
