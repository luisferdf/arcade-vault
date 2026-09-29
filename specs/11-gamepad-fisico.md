# SPEC 11 — Apariencia de gamepad físico para controles táctiles

> **Estado:** aprobado
> **Depende de:** 10-controles-tactiles (componente `TouchControls`, contrato `handleTouchInput`, registro `GAME_ENGINES`)
> **Fecha:** 2026-09-29
> **Objetivo:** Rediseñar visualmente `TouchControls` como un gamepad físico (panel 3D, D-pad con hub central, botones A/B circulares con glow, A=magenta/B=cian) siguiendo el mockup de `references/gamepad-assets/`, atenuando y bloqueando al toque los botones que el juego activo no usa.

## Alcance

**Incluido:**

- Rediseño visual completo de `.touch-controls` en `app/globals.css`, reemplazando la franja plana actual por el look del mockup `references/gamepad-assets/README.md` (el HTML/CSS de referencia real, pese al nombre del archivo):
  - Panel contenedor con fondo degradado oscuro, borde sutil, radio grande y sombra/glow externo (equivalente a `.gp` del mockup) — envuelve D-pad + botones A/B, independiente del tema del sitio.
  - D-pad de 4 direcciones con bisel 3D (sombra inferior tipo "tecla física", se hunde al presionar/`pressed`) y un hub central con una gema romboidal pulsante (equivalente a `.dp-hub`/`.dp-hub-gem`).
  - Botones A/B circulares con anillo de glow, halo de color al presionar, y letra con `text-shadow` de neón — **A en magenta, B en cian** (cambio respecto al estilo actual, donde ambos comparten magenta).
  - Mismo layout general ya existente (D-pad a un lado, A/B al otro, franja fija abajo del Reproductor) — esta spec no reordena la posición relativa de los bloques, solo su apariencia.
- Nueva propiedad opcional `unusedTouchActions?: TouchAction[]` en `GameEngineEntry` (`lib/games/registry.ts`), poblada según la tabla ya definida en spec 10:
  | Juego        | Acciones sin uso       |
  | ------------ | ---------------------- |
  | `asteroides` | `down`, `b`            |
  | `tetris`     | `b`                    |
  | `arkanoid`   | `up`, `down`, `a`, `b` |
  | `snake`      | `a`, `b`               |
- `TouchControls` recibe esta lista (vía `GamePlayerClient.tsx`, que ya conoce el `GameEngineEntry` activo) y, para cada botón cuya `action` esté en `unusedTouchActions`:
  - Aplica un estilo atenuado (`opacity`/color apagado, sin glow, sin bisel activo) — clase `locked` o equivalente.
  - **Bloquea el toque**: no registra `touchstart`/`touchend`/`touchcancel` como interacción válida (no llama `onInput`, no muestra estado `pressed`), evaluado por botón individual (incluidas las 4 direcciones del D-pad una por una, no el D-pad como bloque).
- El resto de la interacción (contrato `handleTouchInput`, multi-touch, red de seguridad `blur`/`visibilitychange`, detección `pointer: coarse`) no cambia — es puramente una capa de estilo + bloqueo de botones ya definidos como "sin uso" en spec 10.
- El panel del gamepad se mantiene siempre oscuro (paleta fija tipo hardware), sin variante para `data-theme="light"` del sitio.

**Fuera de alcance (para specs futuros):**

- Cambios al contrato `handleTouchInput`, a `TouchAction`, o a la lógica de cada motor (`asteroids.ts`, `tetris.ts`, `arkanoid.ts`, `snake.ts`) — siguen recibiendo exactamente las mismas llamadas que hoy.
- Reordenar el layout del Reproductor, el HUD compacto (`player-hud.touch-hud`) o el `crt`/`crt-screen` — esta spec no toca `GamePlayerClient.tsx` más allá de pasar `unusedTouchActions` a `TouchControls`.
- Variante de tema claro para el panel del gamepad.
- Sonidos, vibración háptica, o animaciones adicionales no presentes en el mockup.
- Corregir el contenido cruzado de `references/gamepad-assets/README.md` / `gamepad-neon.png` (se usa el contenido tal como está, sin renombrar archivos).
- Cambios a juegos mock sin motor real (arena simulada) — siguen sin `TouchControls`.

## Modelo de datos

Esta spec no introduce tablas ni columnas en Supabase. Solo agrega un campo opcional a un tipo TypeScript ya existente y una prop nueva a un componente ya existente.

**`lib/games/engine.ts`** (o donde viva `GameEngineEntry`, según spec 10 — confirmar ubicación exacta al implementar, pero es el registro central, no el contrato `ArcadeGame`):

```ts
export interface GameEngineEntry {
  // ...campos existentes (width, height, create, extraStats, usesLives)
  /**
   * Acciones táctiles sin efecto en este motor. TouchControls las muestra
   * atenuadas y no dispara handleTouchInput para ellas.
   */
  unusedTouchActions?: TouchAction[];
}
```

**`lib/games/registry.ts`** — cada entrada de `GAME_ENGINES` declara su lista según la tabla de Alcance:

```ts
asteroides: { ..., unusedTouchActions: ["down", "b"] },
tetris:     { ..., unusedTouchActions: ["b"] },
arkanoid:   { ..., unusedTouchActions: ["up", "down", "a", "b"] },
snake:      { ..., unusedTouchActions: ["a", "b"] },
```

**`app/_components/TouchControls.tsx`** — nueva prop, sin estado adicional (el bloqueo es una comprobación `Set.has(action)` por botón, no estado de React):

```ts
interface TouchControlsProps {
  onInput: (action: TouchAction, pressed: boolean) => void;
  unusedActions?: TouchAction[];
}
```

`GamePlayerClient.tsx` pasa `unusedActions={activeEngine.unusedTouchActions}` (el `GameEngineEntry` que ya resuelve desde `GAME_ENGINES` para montar el motor actual).

## Plan de implementación

1. Agregar `unusedTouchActions?: TouchAction[]` a `GameEngineEntry` en `lib/games/engine.ts` y poblarlo en `lib/games/registry.ts` para `asteroides`, `tetris`, `arkanoid` y `snake` según la tabla de Alcance. Prueba manual: `tsc --noEmit` sin errores; sin efecto en runtime todavía (nadie lee el campo aún).

2. Propagar la prop a `TouchControls`: `GamePlayerClient.tsx` pasa `unusedActions={activeEngine.unusedTouchActions}` al montar `<TouchControls />`. En `TouchButton` (dentro de `TouchControls.tsx`), si `unusedActions?.includes(action)`, no registrar los listeners `touchstart`/`touchend`/`touchcancel` (o registrarlos como no-op) y aplicar una clase `locked`. Prueba manual: en modo dispositivo táctil, tocar un botón "sin uso" (ej. B en Snake) no produce ningún efecto en el juego ni feedback visual de presionado; los botones usados siguen funcionando igual.

3. Reescribir el CSS de `.touch-controls` y sus descendientes en `app/globals.css` para adoptar el look del mockup: panel contenedor con degradado/bisel, D-pad con sombra 3D + hub central con gema pulsante (`@keyframes`), botones A/B circulares con anillo de glow — A en magenta, B en cian. Añadir estilo `.touch-btn.locked` (tono apagado, sin bisel activo, sin transición de `pressed`). Prueba manual: comparar visualmente contra el mockup en `references/gamepad-assets/README.md` en modo dispositivo táctil, para los 4 juegos; confirmar que ningún botón bloqueado muestra glow al intentar tocarlo.

4. Verificación final: `npm run build` sin errores; recorrido en modo dispositivo táctil de los 4 juegos confirmando (a) apariencia de gamepad físico consistente con el mockup, (b) botones sin uso atenuados y sin efecto/feedback al tocarlos, (c) botones con uso funcionando exactamente igual que en spec 10 (rotar, disparar, mover paleta, DAS de Tetris, giros de Snake); recorrido en desktop normal confirmando que no hay regresión (el D-pad sigue sin aparecer).

## Criterios de aceptación

- [ ] `GameEngineEntry` expone `unusedTouchActions?: TouchAction[]` y compila sin errores de TypeScript.
- [ ] `lib/games/registry.ts` declara `unusedTouchActions` para `asteroides` (`down`, `b`), `tetris` (`b`), `arkanoid` (`up`, `down`, `a`, `b`) y `snake` (`a`, `b`).
- [ ] En modo dispositivo táctil, el panel de `TouchControls` tiene apariencia de gamepad físico: cuerpo con bisel/degradado, D-pad con hub central iluminado, botones A/B circulares con glow — A en magenta, B en cian.
- [ ] Un botón cuya acción está en `unusedTouchActions` del juego activo se muestra visualmente atenuado (sin el estilo "activo" del resto) y tocarlo no produce ningún efecto en el motor ni feedback visual de `pressed`.
- [ ] Un botón cuya acción NO está en `unusedTouchActions` funciona exactamente igual que en spec 10 (sin regresión): Asteroides (↑←→A), Arkanoid (←→), Snake (↑↓←→), Tetris (↑←→↓A).
- [ ] El bloqueo se evalúa por botón individual, incluidas las 4 direcciones del D-pad por separado (ej. en Arkanoid, ← y → responden normal mientras ↑ y ↓ están bloqueados dentro del mismo D-pad).
- [ ] El panel del gamepad se ve igual bajo `data-theme="light"` y `data-theme="dark"` del sitio (no tiene variante clara — permanece con la paleta oscura del mockup).
- [ ] El teclado y, en Arkanoid, el mouse, siguen funcionando exactamente igual que antes (esta spec no toca esas rutas de input).
- [ ] `npm run build` compila sin errores de TypeScript.
- [ ] No hay errores en la consola del navegador durante un recorrido en modo táctil de los 4 juegos.

## Decisiones tomadas y descartadas

- **Sí:** Reemplazar el estilo plano actual de `.touch-controls` por el look de gamepad físico en los 4 juegos de una sola vez, no como piloto en un solo juego. Razón: decisión explícita del usuario — es un componente único y compartido, no tiene sentido tener dos estilos convivendo.
- **Sí:** `unusedTouchActions` vive centralizado en `GameEngineEntry` (`lib/games/registry.ts`), no en cada motor. Razón: decisión explícita del usuario — mantiene la regla "un motor no sabe de touch más que lo estrictamente necesario" y evita ramificar `TouchControls` por juego, consistente con el patrón que ya usa el registro para otros metadatos (`usesLives`, `extraStats`).
- **Sí:** A los botones "sin uso" se les bloquea también el toque (no solo el estilo) — cambia la decisión original de spec 10 ("no se deshabilita visualmente ni se oculta"). Razón: decisión explícita del usuario en esta spec; el pedido original fue justamente que aparezcan "bloqueadas", no solo inertes.
- **Sí:** El bloqueo se evalúa por botón individual, incluidas las 4 direcciones del D-pad, no el D-pad como bloque. Razón: decisión explícita del usuario — consistencia: todo botón se trata igual frente a `unusedTouchActions`, sin caso especial para el D-pad.
- **Sí:** Adoptar la paleta del mockup para A/B (A magenta, B cian) en vez de mantener ambos en magenta como hoy. Razón: decisión explícita del usuario — prioriza fidelidad visual al mockup sobre la paleta actual del componente.
- **Sí:** El panel del gamepad permanece siempre oscuro, sin variante para el tema claro del sitio. Razón: decisión explícita del usuario — se trata como "hardware físico", conceptualmente independiente del theming del sitio (igual que un control físico no cambia de color con la luz ambiente).
- **No:** Corregir los nombres/contenido cruzado de `references/gamepad-assets/README.md` y `gamepad-neon.png`. Razón: fuera del alcance de esta spec; se usa el contenido tal cual está, sin tocar esos archivos.
- **No:** Cambiar el contrato `handleTouchInput`, `TouchAction`, o el layout del Reproductor. Razón: confirmado por el usuario — esta spec es puramente de apariencia + bloqueo, reutilizando toda la infraestructura de spec 10 sin modificarla.

## Riesgos identificados

- **Contraste insuficiente en botones bloqueados:** un tono demasiado apagado puede volver el botón invisible o confundible con el fondo del panel, especialmente en pantallas de brillo bajo al sol. Mitigación: verificar visualmente en el paso 3 que el botón bloqueado se distingue claramente del fondo aunque no tenga glow.
- **Confusión del jugador ante un botón que no responde:** al bloquear también el toque (no solo el estilo), un jugador que presiona un botón atenuado no recibe ningún feedback (ni siquiera visual de "presionado"), lo que podría leerse como que el control no funciona en vez de "este botón no aplica aquí". Mitigación: aceptado como riesgo conocido — la atenuación visual ya comunica la intención; se revisa si hay reportes reales de confusión.
- **Fidelidad visual al mockup no exacta:** el mockup es HTML/CSS standalone con sus propias variables de color y fuentes; portarlo a las variables ya existentes del proyecto (`--cyan`, `--magenta`, `--pixel`, `--mono`) puede producir ligeras diferencias de tono/proporciones respecto a la referencia. Mitigación: priorizar consistencia con la paleta neón ya establecida en `globals.css` sobre una réplica pixel-perfect del mockup.
