# SPEC 10 — Controles táctiles para móvil

> **Estado:** implementado
> **Depende de:** 05-juego-asteroides, 07-juego-tetris, 08-juego-arkanoid, 09-juego-snake (motores registrados en `lib/games/engine.ts` + `lib/games/registry.ts`)
> **Fecha:** 2026-09-28
> **Objetivo:** Agregar un control táctil fijo (D-pad + botones A/B) que aparece solo en dispositivos con puntero táctil, reutilizando el mismo mapeo de teclas que ya escucha cada motor, para que los 4 juegos con motor real sean jugables en móvil sin teclado.

## Alcance

**Incluido:**

- Nuevo componente `app/_components/TouchControls.tsx`: D-pad (↑↓←→) + dos botones de acción (A, B), franja fija en la parte inferior de la pantalla del Reproductor. Visible únicamente cuando `matchMedia("(pointer: coarse)").matches` es `true` (detección reactiva vía listener, no por ancho de viewport). En desktop no se renderiza nada nuevo — el teclado/mouse siguen funcionando exactamente igual.
- Nuevo método opcional en el contrato `ArcadeGame` (`lib/games/engine.ts`):

  ```ts
  handleTouchInput?(action: TouchAction, pressed: boolean): void;
  ```

  con `TouchAction = "up" | "down" | "left" | "right" | "a" | "b"`. Se llama en el borde de `touchstart`/`touchend`/`touchcancel` de cada botón (`pressed: true`/`false`), nunca por polling desde el componente. Cada motor decide cómo interpretar `pressed` sostenido — el D-pad+A/B es el mismo componente para los 4 juegos, pero el significado de cada botón varía por motor, igual que ya varía el mapeo de teclado:

  | Juego      | ↑                                    | ↓                                                                                       | ←                                                                        | →                                      | A                                      | B       |
  | ---------- | ------------------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------- | -------------------------------------- | ------- |
  | Asteroides | empuje (mientras `pressed`)          | sin uso                                                                                 | rota izq. (mientras `pressed`)                                           | rota der. (mientras `pressed`)         | disparar (`Space`, mientras `pressed`) | sin uso |
  | Tetris     | rotar (flanco `pressed=true`)        | soft-drop (repite mientras `pressed`, mismo intervalo que ya usa el motor internamente) | mover izq. (repite mientras `pressed`, timer DAS nuevo dentro del motor) | mover der. (ídem)                      | hard-drop (flanco `pressed=true`)      | sin uso |
  | Arkanoid   | sin uso                              | sin uso                                                                                 | mover paleta izq. (mientras `pressed`)                                   | mover paleta der. (mientras `pressed`) | sin uso                                | sin uso |
  | Snake      | girar arriba (flanco `pressed=true`) | girar abajo (ídem)                                                                      | girar izq. (ídem)                                                        | girar der. (ídem)                      | sin uso                                | sin uso |

  Internamente cada motor traduce esto al mismo estado que ya alimenta su lógica de teclado (`this.keys[code] = pressed` para los continuos tipo Asteroides/Arkanoid; llamada directa a la función de turno/rotación para los de flanco tipo Snake/Tetris-rotar). Tetris es el único motor que gana lógica nueva: un temporizador de repetición (DAS) para ← / → / ↓ mientras `pressed` sea `true`, ya que hoy depende del auto-repeat del sistema operativo sobre `keydown`, que no existe en touch.
  Un botón "sin uso" en la tabla no se deshabilita visualmente ni se oculta — simplemente su `handleTouchInput` no produce efecto en ese motor (evita ramificar el componente `TouchControls` por juego).

- Layout móvil del Reproductor reordenado en una franja delgada encima del canvas (stats compactos: Puntuación/Vidas/Nivel + iconos de PAUSA/FIN/SALIR), canvas al centro, franja de `TouchControls` fija abajo — solo cuando aplica la detección táctil. El HUD de desktop actual no cambia.
- Estilo visual neón consistente con el resto del Vault (bordes/glow `--cyan`, `--magenta` según estado presionado).
- Soporte multi-touch básico: cada botón rastrea su propio `touchId`, de forma que sostener dirección + botón A simultáneamente (dos dedos) funciona de forma independiente.

**Fuera de alcance (para specs futuros):**

- Vibración háptica.
- Personalización/reubicación del control por el usuario.
- Layout distinto para orientación horizontal (landscape) — se asume el mismo layout vertical, responsive.
- Rediseño del HUD de desktop.
- Gestos de swipe sobre el canvas como alternativa al D-pad.
- Tests automatizados.
- Cambios a los juegos mock sin motor real (siguen usando la arena simulada, sin controles táctiles).
- Cambios a `bloque-buster` o cualquier otro juego fuera de los 4 con motor real.

## Modelo de datos

Esta spec no introduce tablas ni columnas nuevas en Supabase — es puramente de UI/input en el cliente. Los únicos "datos" nuevos son tipos TypeScript:

**`lib/games/engine.ts`** — nuevo tipo y método opcional en el contrato existente:

```ts
export type TouchAction = "up" | "down" | "left" | "right" | "a" | "b";

export interface ArcadeGame {
  start(): void;
  pause(): void;
  resume(): void;
  destroy(): void;
  setSkin?(skin: SkinId): void;
  /**
   * Traduce un botón del D-pad/A-B táctil al mismo estado interno que ya
   * alimenta el control de teclado. Se llama en el flanco de touchstart
   * (pressed: true) y touchend/touchcancel (pressed: false), nunca por
   * polling. Un motor que no implemente esta acción simplemente la ignora.
   */
  handleTouchInput?(action: TouchAction, pressed: boolean): void;
}
```

**`app/_components/TouchControls.tsx`** — sin estado de servidor ni persistencia; estado local de React solo para el feedback visual de "presionado" por botón (`Set<TouchAction>` o similar), reconstruido en cada render. No se guarda nada en `localStorage` — a diferencia de la skin, la detección de táctil se recalcula en cada carga vía `matchMedia`, no hay preferencia que recordar.

```ts
interface TouchControlsProps {
  onInput: (action: TouchAction, pressed: boolean) => void;
}
```

`GamePlayerClient.tsx` es el único llamador: mantiene la detección táctil (`useSyncExternalStore` sobre un listener de `matchMedia("(pointer: coarse)")`, mismo patrón ya usado para el tema/skin) y, cuando aplica, monta `<TouchControls onInput={(a, p) => engineRef.current?.handleTouchInput?.(a, p)} />` debajo del `crt`.

## Plan de implementación

1. Agregar `TouchAction` y `handleTouchInput?` al contrato `ArcadeGame` en `lib/games/engine.ts`. Prueba manual: `tsc --noEmit` sin errores; ningún motor lo implementa todavía, nada cambia en runtime.

2. Crear el hook de detección táctil (`useIsTouchDevice` o similar, en `lib/games/` o `app/_components/`) sobre `matchMedia("(pointer: coarse)")` con `useSyncExternalStore`, mismo patrón que `lib/games/skins.ts` usa para el tema. Prueba manual: `tsc --noEmit` sin errores; aún no se usa en ninguna página.

3. Crear `app/_components/TouchControls.tsx`: D-pad (↑↓←→) + botones A/B, con `touchstart`/`touchend`/`touchcancel` por botón (rastreando `touchId` para multi-touch), llamando `onInput(action, pressed)` en cada flanco. Estilo neón fijo abajo de la pantalla. Prueba manual: `tsc --noEmit` sin errores; componente aún no importado en el Reproductor.

4. Integrar en `GamePlayerClient.tsx`: montar `TouchControls` solo cuando el hook de detección táctil devuelve `true`, conectado a `engineRef.current?.handleTouchInput?.(action, pressed)`; reordenar el layout móvil (franja de stats compacta arriba del canvas, D-pad fijo abajo) solo bajo esa misma condición, sin tocar el HUD de desktop. Prueba manual: con DevTools en modo dispositivo táctil (ej. Chrome "Toggle device toolbar" con un perfil móvil), el D-pad aparece en `/juego/<id>/jugar` para los 4 juegos con motor real; en una ventana desktop normal no aparece.

5. Implementar `handleTouchInput` en `lib/games/asteroids.ts`: ↑ → `this.keys["ArrowUp"]`, ← → `this.keys["ArrowLeft"]`, → → `this.keys["ArrowRight"]`, A → `this.keys["Space"]` (mismos códigos que ya lee `updateGame`); ↓ y B sin efecto. Prueba manual: en modo dispositivo táctil, jugar una partida completa de Asteroides solo con el D-pad+A (rotar, empujar, disparar, game over, guardar puntaje).

6. Implementar `handleTouchInput` en `lib/games/arkanoid.ts`: ← → `this.keys["ArrowLeft"]`, → → `this.keys["ArrowRight"]`; resto sin efecto. Prueba manual: en modo táctil, jugar Arkanoid moviendo la paleta solo con ←/→ del D-pad, sin usar mouse ni teclado.

7. Implementar `handleTouchInput` en `lib/games/snake.ts`: cada dirección dispara el mismo flanco que ya usa `handleKeyDown` (giro con buffer de 1, ignora reversa de 180°), solo en `pressed=true`; `pressed=false` no hace nada. Prueba manual: en modo táctil, jugar Snake completo solo con el D-pad, confirmando que la reversa de 180° sigue bloqueada también desde el botón táctil.

8. Implementar `handleTouchInput` en `lib/games/tetris.ts`: agregar un temporizador DAS interno (arranca en el flanco `pressed=true` de ←/→/↓, se detiene en `pressed=false`) que repite el mismo movimiento que hoy dispara `handleKeyDown` en cada tick del loop mientras el botón siga presionado; ↑ y A siguen siendo de flanco único (rotar / hard-drop). Prueba manual: en modo táctil, jugar Tetris completo con el D-pad+A, confirmando que sostener ←/→/↓ mueve la pieza en continuo igual que mantener la flecha del teclado.

9. Verificación final: `npm run build` sin errores; recorrido en modo dispositivo táctil de los 4 juegos (Biblioteca → Detalle → Reproductor → Game Over → Guardar → Detalle/Salón) sin errores de consola; recorrido en desktop normal confirmando que el D-pad no aparece y que teclado/mouse siguen funcionando exactamente igual que antes.

## Criterios de aceptación

- [x] `ArcadeGame` en `lib/games/engine.ts` expone `handleTouchInput?(action: TouchAction, pressed: boolean): void` y compila sin errores de TypeScript.
- [x] En un dispositivo/emulación con puntero táctil (`pointer: coarse`), al entrar a `/juego/<id>/jugar` para `asteroides`, `tetris`, `arkanoid` o `snake` aparece una franja fija de D-pad + botones A/B en la parte inferior de la pantalla.
- [x] En una ventana/dispositivo desktop normal (puntero fino), el D-pad no aparece y el layout del Reproductor es idéntico al actual (sin regresión visual).
- [x] Asteroides es jugable de punta a punta solo con el D-pad+A: rotar con ←/→, empuje con ↑, disparo con A; ↓ y B no producen efecto.
- [x] Arkanoid es jugable de punta a punta solo con el D-pad: la paleta se mueve con ←/→; ↑, ↓, A y B no producen efecto.
- [x] Snake es jugable de punta a punta solo con el D-pad: gira en las 4 direcciones con buffer de 1 tecla pendiente, y la reversa de 180° sigue bloqueada igual que con teclado.
- [x] Tetris es jugable de punta a punta solo con el D-pad+A: sostener ←/→/↓ mueve/baja la pieza en continuo (DAS), ↑ rota, A hace hard-drop.
- [x] Sostener un botón de dirección (touchstart sin soltar) mantiene el efecto continuo esperado por juego (empuje/rotación en Asteroides, movimiento de paleta en Arkanoid, DAS en Tetris) hasta soltar (touchend/touchcancel).
- [x] Es posible sostener una dirección y presionar A al mismo tiempo con dos dedos (multi-touch) sin que uno cancele al otro.
- [x] El teclado y, en Arkanoid, el mouse, siguen funcionando exactamente igual que antes en cualquier dispositivo — esta spec no le quita ni cambia control alguno existente.
- [x] Los juegos mock sin motor real (arena simulada) no muestran el D-pad.
- [x] `npm run build` compila sin errores de TypeScript.
- [x] No hay errores en la consola del navegador durante el recorrido completo en modo táctil: Biblioteca → Detalle → Reproductor → Game Over → Guardar → Detalle/Salón, para los 4 juegos.

## Decisiones tomadas y descartadas

- **Sí:** Un único componente `TouchControls` (D-pad + A/B) reutilizado igual en los 4 juegos, en vez de un control distinto por juego (ej. joystick analógico en Asteroides, drag en Arkanoid). Razón: decisión explícita del usuario — mismo control visual y físico para todos, aunque el significado de cada botón varíe por motor.
- **Sí:** Arkanoid se controla con ←/→ del D-pad en vez de arrastre táctil sobre el canvas (que sería el equivalente más directo de su `mousemove`). Razón: decisión explícita del usuario de mantener el mismo tipo de control en los 4 juegos en vez de un gesto especial solo para este.
- **Sí:** El método `handleTouchInput` recibe `pressed: boolean` en los flancos de `touchstart`/`touchend`, no un evento continuo por polling. Razón: es el patrón más simple de implementar en el componente y deja que cada motor decida cómo interpretar "sostenido" (estado continuo vs. temporizador DAS), consistente con que "el motor es la fuente de verdad" (`engine.ts`).
- **Sí:** Tetris gana un temporizador DAS interno nuevo, exclusivo para touch, en vez de exigir taps repetidos. Razón: decisión explícita del usuario — sostener un botón debe sentirse igual que sostener una tecla, y el auto-repeat de `keydown` del sistema operativo no existe en eventos táctiles.
- **Sí:** Layout de franja de stats compacta + canvas + D-pad fijo abajo, solo bajo detección táctil real (`pointer: coarse`), sin tocar el HUD de desktop. Razón: decisión explícita del usuario de mantener el canvas arriba y el control abajo, evitando falsos positivos en laptops táctiles usados con teclado (a diferencia de detectar por ancho de pantalla).
- **No:** Gestos de swipe sobre el canvas como alternativa o complemento al D-pad. Razón: el usuario prefirió el patrón de botones fijos, más predecible y consistente entre los 4 juegos.
- **No:** Vibración háptica, personalización del layout, soporte landscape distinto, y tests automatizados en esta spec. Razón: confirmado por el usuario, quedan para specs futuros si se necesitan.

## Riesgos identificados

- **Tetris DAS mal calibrado:** un intervalo de repetición demasiado rápido/lento en el temporizador táctil puede sentirse distinto al auto-repeat nativo del teclado, generando una experiencia inconsistente entre input táctil y teclado en el mismo juego. Mitigación: calibrar el intervalo contra el auto-repeat típico del sistema operativo (~ tras 300-500ms de delay inicial, luego cada 30-50ms) durante el paso 8 del plan, ajustable si se siente mal en pruebas manuales.
- **Falsos negativos de `pointer: coarse`:** algunos híbridos (tablets con teclado/mouse conectado, laptops 2-en-1) pueden no exponer un `pointer: coarse` claro y dejar al usuario sin D-pad ni forma cómoda de jugar. Mitigación: aceptado como riesgo conocido en esta spec (fuera de alcance un selector manual "mostrar controles táctiles"); se revisa si aparecen reportes reales.
- **`touchend`/`touchcancel` perdidos:** si el navegador no dispara `touchend` (ej. el dedo sale del viewport o llega una notificación del sistema), un botón puede quedar "trabado" en `pressed: true` indefinidamente (nave empujando sola, paleta moviéndose sola). Mitigación: escuchar también `touchcancel` en cada botón y, como red de seguridad, soltar todos los botones activos en el `blur`/`visibilitychange` de la ventana.
- **Overlay del D-pad tapando el canvas en pantallas muy bajas:** en viewports móviles muy cortos (apaisado real, o teléfonos pequeños), la franja fija de controles puede dejar muy poco alto para el canvas. Fuera de alcance el layout landscape dedicado (ver Alcance), pero se debe verificar en el paso 4/9 que el canvas conserva una relación de aspecto legible en los tamaños de prueba usados.
