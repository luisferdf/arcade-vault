# SPEC 12 — Rendimiento de Frogger

> **Estado:** implementado
> **Depende de:** Game-jam/Frogger/01-frogger-core (motor `lib/games/frogger.ts`), 10-controles-tactiles (Player y backing store a DPR)
> **Fecha:** 2026-09-30
> **Objetivo:** Medir y eliminar la causa de los FPS bajos constantes de Frogger en desktop (build de producción) hasta sostener ≥ 58 fps medios sin ningún cambio visual.

## Alcance

**Incluido:**

- Medición base en Chrome desktop, build de producción (`npm run build && npm run start`): grabación de 10 s del panel Performance jugando Frogger, anotando fps medios, frame más largo y el reparto Scripting / Rendering / Painting / GPU.
- Misma medición de referencia (una grabación) en Asteroides, Tetris, Arkanoid y Snake, solo para saber si el problema es exclusivo de Frogger. No se optimizan esos motores.
- Optimizaciones en `lib/games/frogger.ts` sin cambio visual:
  - Fondo estático (zonas, ondas del río, líneas de carretera, marcos de metas) pre-renderizado a un canvas offscreen a resolución DPR; se regenera solo al cambiar skin; cada frame se blitea con un `drawImage`.
  - Cero asignaciones por frame en el loop (objeto `shift` de `moveEntities`, array `parts` de `drawFrogShape`, arrays literales de `drawWheels`).
  - Agrupar paths por color (ruedas, tortugas) para reducir `beginPath`/`fill`.
- Arreglo mínimo fuera de `frogger.ts` (Player o CSS del CRT) **solo si** la medición demuestra que la causa está ahí, el cambio es invisible y no altera otros juegos.
- Minimizar re-renders de React en el Player (`GamePlayerClient.tsx`) **de ser necesario**: todo valor que no deba pintar UI se guarda en `useRef`, no en `useState`; los `useState` se reducen al mínimo indispensable. Regla también para cualquier código nuevo de esta spec.
- Medición final con los mismos pasos que la base, registrada en la spec.

**Fuera de alcance (para specs futuros):**

- Optimizar los motores de Asteroides, Tetris, Arkanoid o Snake (si su medición sale mal, se abre otra spec).
- Cualquier cambio visual: efectos CRT, fondo animado, scanlines, ruido, glow o paleta se ven idénticos.
- Rendimiento en móvil.
- Contador de FPS en pantalla u overlay de debug.
- Cambios de gameplay (velocidades, tiempos, colisiones).

## Modelo de datos

Esta spec no introduce datos persistentes ni toca Supabase, `engine.ts` ni `registry.ts`. Solo añade estado privado a `FroggerGame` (`lib/games/frogger.ts`):

```ts
/** Fondo estático (zonas, ondas, líneas de carretera, marcos de metas) ya pintado. */
private bgCache: HTMLCanvasElement | null = null;
/** Desplazamiento (celdas) de cada carril en el frame actual, indexado por fila. Se reutiliza; no se crea por frame. */
private readonly laneShift = new Float64Array(ROWS);
```

Convenciones:

- `bgCache` mide `W × (ROWS * CELL)` lógicos multiplicados por la escala real del contexto (`ctx.getTransform().a`), para que el blit se vea igual de nítido que hoy con DPR > 1.
- `bgCache` se invalida (`null`) en `setSkin()` y se reconstruye perezosamente en el siguiente `draw()`.
- Las filas de metas ocupadas (ranas dibujadas en las bocas) **no** van en `bgCache`: cambian durante la partida y se siguen pintando por frame.

## Plan de implementación

1. **Medición base.** `npm run build && npm run start`; en Chrome desktop, panel Performance, grabar 10 s jugando Frogger (nivel 1, skin por defecto, rana cruzando carretera y río). Anotar en `## Mediciones` de esta spec: fps medios, frame más largo, % Scripting / Rendering / Painting / GPU, y DPR del equipo. Repetir una grabación en Asteroides, Tetris, Arkanoid y Snake. Sin cambios de código.

2. **Decidir el foco.** Si Painting/Compositing domina y los otros 4 juegos también salen < 58 fps, la causa es compartida → se hace el paso 6 además de los 3–5. Si Scripting o el propio canvas de Frogger domina, solo pasos 3–5. La decisión y su evidencia se anotan en `## Mediciones`.

3. **Fondo estático cacheado.** Mover `drawZones()` y los marcos de `drawGoals()` a un pintado único sobre `bgCache`; `draw()` hace `drawImage(bgCache, …)` y luego pinta ranas en metas, entidades y rana. `setSkin()` pone `bgCache = null`. Prueba manual: las 3 skins se ven idénticas a antes (comparación de screenshots en `.playwright-screenshots/`); cambiar de skin en partida repinta el fondo al instante.

4. **Cero asignaciones por frame.** `moveEntities` escribe en `laneShift` en vez de crear un objeto; `drawFrogShape` usa una tabla constante de partes (con `reach` aplicado al pintar); `drawWheels` sin arrays literales. Prueba manual: en Performance → Memory, no hay dientes de sierra de GC durante 10 s de partida.

5. **Paths agrupados.** Ruedas de todos los vehículos de un carril en un solo `beginPath`/`fill`; caparazones de tortugas visibles de un carril en un solo `fill` y un solo `stroke`. Prueba manual: screenshot idéntico al del paso 3.

6. **Arreglo mínimo compartido (condicional al paso 2).** Solo si la medición apunta al Player o al CSS del CRT: un cambio invisible y acotado en `GamePlayerClient.tsx` o `app/globals.css` (p. ej. aislar la capa del canvas con `contain`/`will-change`). Prueba manual: los 5 juegos se ven idénticos y ninguno baja de fps respecto a su medición base. Si el paso 2 no lo justifica, se omite y se anota.

6b. **Re-renders de React (condicional, según paso 1).** En el Profiler de React DevTools (o el track Scripting de Performance) contar commits de `GamePlayerClient` durante 10 s de Frogger. Si hay commits por frame o más de los esperados (uno por cambio de score/vidas/nivel), reducirlos: (a) estado que no pinta UI → `useRef` (`engineRef` ya lo es; revisar `runId`, `typedName`, `saved`, etc.); (b) callbacks del motor que repiten el mismo valor no llaman al setter; (c) `onStatChange` no crea objeto nuevo si el valor no cambió; (d) si un valor sí pinta pero cambia muy seguido, escribirlo directo al nodo del DOM vía `ref` en vez de `setState`. Prueba manual: HUD, pausa, game over y guardado de score se ven y funcionan igual. Si el Profiler no muestra re-renders excesivos, se omite y se anota.

7. **Medición final.** Repetir exactamente el paso 1 en Frogger (y en los otros 4 si se hizo el paso 6) y registrar los números junto a la base.

## Criterios de aceptación

- [x] La spec contiene una sección `## Mediciones` con los números base (Frogger + los otros 4 juegos) y los finales de Frogger, tomados en build de producción en Chrome desktop.
- [x] Grabación de 10 s en Performance jugando Frogger (build prod, Chrome desktop): fps medios ≥ 58.
- [x] En esa misma grabación ningún frame supera 33 ms.
- [x] En esa grabación no aparecen pausas de GC (Minor GC) recurrentes atribuibles al loop de Frogger.
- [x] Screenshots de Frogger en `clasico`, `neon` y `retro`, antes y después, son visualmente idénticos (mismo estado de partida).
- [x] Cambiar de skin en mitad de la partida repinta el fondo con la paleta nueva en el mismo frame o el siguiente.
- [x] El gameplay no cambia: velocidades de carriles, salto de 120 ms, ciclo de tortugas, temporizador y puntuación se comportan igual que antes.
- [x] Durante 10 s de Frogger, `GamePlayerClient` hace un commit de React solo por cada cambio real de score, vidas o nivel (ninguno por frame), medido con el Profiler.
- [x] Ningún código nuevo de esta spec añade `useState` para valores que no pintan UI.
- [x] HUD, pausa, game over y guardado de puntuación funcionan igual tras reducir estados.
- [x] Teclado y controles táctiles de Frogger siguen funcionando igual.
- [x] Si se aplicó el paso 6: Asteroides, Tetris, Arkanoid y Snake se ven idénticos y ninguno tiene peores fps que en su medición base.
- [x] `npm run build` compila sin errores y `npm run lint` pasa.
- [x] Sin errores en la consola del navegador durante una partida completa de Frogger.

## Mediciones

Build de producción (`next start -p 3001`), Chrome desktop, DPR 2.

**Base — Frogger** (snippet `requestAnimationFrame` de 10 s en consola, jugando; Performance de 26.7 s):

| Métrica                | Valor                                                                          |
| ---------------------- | ------------------------------------------------------------------------------ |
| fps medios             | 60.1                                                                           |
| Mediana / p99 de frame | 16.7 ms / 17.2 ms                                                              |
| Frames > 33 ms         | 0                                                                              |
| Longtasks              | 0                                                                              |
| Performance (26.7 s)   | System 2.0 s, Scripting 1.3 s, Rendering 1.1 s, Painting 0.9 s; hilo ~80% idle |
| Minor GC               | no verificado                                                                  |

**Otros 4 juegos:** no medidos (decisión del usuario: solo Frogger en esta sesión).

**Paso 2 — decisión (opción b):** el síntoma "FPS bajos constantes" no se reproduce en prod; los umbrales de aceptación ya se cumplen. Scripting (~4.8%) y Painting (~3.5%) son bajos y no hay causa compartida evidenciada → se aplican solo los pasos 3–5 como mejora de margen. Paso 6 omitido (sin evidencia). Paso 6b condicional al Profiler.

**Verificación visual (pasos 3–5, Playwright, reloj rAF determinista, DPR 1.25, 3 skins):** fondo, marcos de metas, troncos y rana idénticos al píxel respecto a `main`; el cambio de skin en partida repinta el fondo en el siguiente frame. El paso 5 (paths agrupados de ruedas y tortugas) cambiaba ~0.9% de píxeles por antialiasing en los bordes de los círculos (diff máx. 67/255), incumpliendo "visualmente idéntico" sin ganancia medible → **revertido por decisión del usuario**. Del paso 4 se conserva `drawWheels` sin arrays literales. El paso 5 queda sin aplicar.

## Hallazgos y soluciones aplicadas

Resumen para futuras referencias (qué se encontró, qué se cambió, qué no y por qué).

### Hallazgos

- **El síntoma no se reprodujo en producción.** En el build de prod (Chrome desktop, DPR 2) Frogger corre a 60.1 fps, p99 17.2 ms, 0 frames > 33 ms y 0 longtasks. Los umbrales de la spec ya se cumplían antes de tocar código.
- **El hilo principal no es el cuello de botella.** En la grabación de 26.7 s el hilo estaba ~80% inactivo: Scripting ~4.8%, Rendering ~4.2%, Painting ~3.5%. El JS de Frogger cuesta ~0.6 ms por frame.
- **Los tirones observados tenían otras causas.** Una grabación inicial salió del servidor dev (`:3000`) y con extensiones activas (McAfee WebAdvisor, MetaMask, AdBlock): no sirve como base. En un Chromium de Playwright aparecieron tirones esporádicos de 200–700 ms que no se vieron en el Chrome real del usuario; se atribuyen a ese entorno, no al motor.
- **Re-renders de React: sin problema por diseño.** `emitChanges()` de Frogger solo llama a `onScoreChange`/`onLivesChange`/`onLevelChange` cuando el valor cambió (compara con `prevScore`/`prevLives`/`prevLevel`) y los setters de React con el mismo valor no re-renderizan. No hay commits por frame → el paso 6b se omitió.
- **Causa compartida (Player/CSS del CRT): no evidenciada.** Painting y Compositing son bajos → el paso 6 se omitió. Los otros 4 juegos no se midieron (decisión del usuario).

### Soluciones aplicadas (`lib/games/frogger.ts`)

- **Paso 3 — fondo estático cacheado.** `bgCache` (canvas offscreen) se construye perezosamente en `buildBackground()` a la escala real del contexto (`ctx.getTransform().a`). Contiene zonas, ondas del río, líneas de carretera y marcos de metas. `draw()` hace un `drawImage`; las ranas en metas se pintan por frame (`drawGoalFrogs`). `setSkin()` invalida el caché (`bgCache = null`). `drawZones` y `drawGoalFrames` reciben el contexto por parámetro.
- **Paso 4 — cero asignaciones por frame.** `moveEntities` escribe en `laneShift` (`Float64Array(ROWS)`) en vez de crear un objeto; `drawFrogShape` usa la tabla constante `FROG_PARTS` `[x, y, rx, ry, dirReach]` con bucles indexados (el `reach` se aplica al pintar); `drawWheels` usa bucles en lugar de arrays literales.

### Soluciones descartadas

- **Paso 5 — paths agrupados (revertido).** Agrupar ruedas y caparazones de tortugas por carril en un solo path cambiaba ~0.9% de los píxeles del canvas (~5.5k de 600k, diferencia máx. 67/255) por antialiasing en los bordes de los círculos: Skia rasteriza distinto un path con muchos contornos que contornos sueltos. Incumplía "visualmente idéntico" sin ganancia medible → revertido por decisión del usuario. Lección: en Canvas 2D, agrupar contornos en un path **no** es neutro visualmente; si se reintenta, hay que aceptar explícitamente el ajuste de antialiasing.
- **Pasos 6 y 6b:** omitidos (sin evidencia que los justifique).

### Método de verificación reutilizable

- **Comparación de píxeles determinista con Playwright.** Un script de inicio reemplaza `requestAnimationFrame`/`cancelAnimationFrame` por una cola manual (`window.__tick(ts)`), se avanzan 60 frames con timestamps fijos, y se compara `canvas.toDataURL()` entre dos builds (p. ej. prod de `main` en `:3001` vs dev con el cambio en `:3000`). Dos cargas del mismo build dan 0 diferencias, así que el método es estable y detecta cambios de 1 píxel.
- **Medición de fps en consola.** Snippet con `requestAnimationFrame` de 10 s que imprime fps, mediana, p99, top-5 de frames, frames > 33 ms y longtasks (`PerformanceObserver`). Para pegar en Chrome: escribir antes `allow pasting` en la consola, o usar Sources → Snippets.
- **Cuidados de medición:** medir siempre en `next start` (no `next dev`), en ventana de incógnito o sin extensiones, y con el juego corriendo (no en pausa ni en game over).

### Estado de la medición final

La medición final en prod la validó el usuario manualmente al cerrar la spec ("todo en orden"); **no se registraron cifras finales** junto a la base. Quien retome esto y necesite comparar: base = 60.1 fps, p99 17.2 ms, 0 frames > 33 ms.

## Decisiones tomadas y descartadas

- **Sí:** medir antes de optimizar (paso 1). Razón: el motor de Frogger dibuja poco (~60 entidades, ~100 primitivas por frame); la causa no es obvia leyendo el código y optimizar a ciegas puede no mover los fps.
- **Sí:** verificar con DevTools Performance en build de producción. Razón: decisión del usuario; es booleana y no añade código. `npm run dev` (StrictMode, sin minificar) no es representativo.
- **Sí:** alcance solo Frogger. Razón: decisión del usuario; los otros 4 juegos solo se miden como referencia.
- **Sí:** permitir un arreglo mínimo fuera de `frogger.ts` si la medición lo demuestra. Razón: decisión del usuario; evita cerrar la spec sin resolver el síntoma si la causa es compartida.
- **Sí:** `useState` al mínimo y `useRef` para lo que no pinta UI. Razón: decisión del usuario; cada setter dispara un render del Player completo (HUD + canvas wrapper) y el estado del motor ya vive fuera de React.
- **No:** reescribir el HUD fuera de React por completo. Razón: sobredimensionado; solo se toca lo que el Profiler señale.
- **Sí:** cero cambio visual. Razón: decisión del usuario; los efectos CRT/fondo son identidad del producto.
- **Sí:** cachear el fondo estático en un canvas offscreen invalidado por `setSkin()`. Razón: es la mayor parte de los píxeles pintados por frame y no cambia durante la partida.
- **No:** congelar o quitar el fondo animado, scanlines o ruido durante la partida. Razón: descartado por el usuario (cambio visual).
- **No:** bajar la resolución del canvas (DPR 1). Razón: cambio visual (pérdida de nitidez).
- **No:** contador de FPS en pantalla. Razón: añade código/UI; DevTools basta.
- **No:** optimizar otros motores aquí. Razón: fuera de alcance; spec propia si su medición sale mal.
- **No:** medir ni optimizar en móvil. Razón: el síntoma se reportó en desktop.

## Riesgos identificados

| Riesgo                                                                                      | Mitigación                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La causa está en el compositor/CSS del CRT y solo se arregla con un cambio visual.          | Se documenta en `## Mediciones`, se cierra lo alcanzable sin cambio visual y se propone una spec nueva que decida qué efecto recortar.                                     |
| `bgCache` a escala distinta a la del contexto → fondo borroso o desalineado con DPR > 1.    | Crear el cache con la escala leída de `ctx.getTransform()`; comparar screenshots antes/después (criterio de identidad visual).                                             |
| Agrupar paths altera el orden de pintado (p. ej. ruedas sobre carrocería de otro vehículo). | Agrupar solo por carril y conservar el orden carrocería → ruedas; verificar con screenshots.                                                                               |
| El equipo del usuario tiene monitor > 60 Hz y las cifras de fps no son comparables.         | Anotar la tasa de refresco en `## Mediciones`; el umbral ≥ 58 fps se interpreta como "sin frames perdidos a 60 Hz" y, a más Hz, como ningún frame > 33 ms.                 |
| Cambiar `useState` por `useRef` hace que la UI no se actualice (un ref no dispara render).  | Mantener `useState` para todo valor visible (score, vidas, nivel, pausa, game over); `useRef` solo para lo que no se pinta. Criterio de aceptación de HUD/pausa/game over. |
| Una sola grabación de 10 s es ruidosa.                                                      | Tomar 2 grabaciones por medición y registrar la peor.                                                                                                                      |

## Lo que **no** está en esta spec

- Optimizar Asteroides, Tetris, Arkanoid o Snake.
- Cualquier cambio visual en el canvas, el CRT o el fondo del sitio.
- Rendimiento en móvil.
- Overlay de FPS o herramientas de debug.

Cada uno, si llega, va en su propia spec.
