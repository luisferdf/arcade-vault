---
name: add-game
description: Diseña la spec de un juego nuevo para Arcade Vault — motor jugable en canvas, integración con el Reproductor y leaderboard en Supabase. Sirve tanto para portar un juego de references/started-games como para escribir el motor desde cero. Genera specs/NN-juego-<slug>.md en estado Borrador y para; la implementación va por /spec-impl.
disable-model-invocation: true
argument-hint: "<nombre o slug del juego>  (ej: tetris)"
allowed-tools: Bash(ls:*), Bash(cat:*)
---

# /add-game — Diseñador de specs de juegos para Arcade Vault

Este skill produce **la spec de un juego nuevo**, no el código. Tu trabajo es entrevistar al usuario, inspeccionar el juego de origen (si existe) y escribir `specs/NN-juego-<slug>.md` siguiendo el molde ya establecido en el repo. La implementación la hace después `/spec-impl`.

Este skill **no reemplaza a `/spec`: lo especializa.** `/spec` define el método y la plantilla canónica de las specs de este proyecto; `/add-game` aporta el conocimiento concreto del dominio (motores de canvas, el Reproductor, las tablas de Supabase, la paleta neón) y las preguntas que hay que hacer para un juego. Ante cualquier duda sobre **estructura, formato o proceso** de la spec, manda `/spec`.

**Responde siempre en español.**

## Contexto de sesión

Specs existentes:
!`ls specs/ 2>/dev/null || echo "No existe la carpeta specs/"`

Juegos de referencia disponibles:
!`ls references/started-games/ 2>/dev/null || echo "No existe references/started-games/"`

Motores ya integrados:
!`ls lib/games/ 2>/dev/null || echo "No existe lib/games/"`

---

## Fase 0 — Cargar contexto obligatorio

Antes de preguntar nada, lee (con Read, no adivines):

**a) El método de specs — es obligatorio, no opcional:**

1. **El skill `/spec`**: `SKILL.md` y su `template.md`. Búscalos en este orden y para en el primero que exista:
   - `.claude/skills/spec/` (proyecto)
   - `~/.claude/skills/spec/` — en esta máquina es un symlink a `~/.agents/skills/spec/`
   - `~/.agents/skills/spec/`

   `template.md` es **la estructura canónica** de las specs de este repo: tu archivo final debe seguirla sección por sección. `SKILL.md` es **el método**: cómo se pregunta, cómo se desarrolla la spec por partes, cómo se guarda y cuándo hay que parar. Si algo de `/add-game` contradice a `/spec` en formato o proceso, **gana `/spec`**; lo que aporta este skill es el contenido específico de un juego.

   Si no encuentras el skill `/spec` en ninguna de las tres rutas, dilo explícitamente al usuario y guíate por `specs/05-juego-asteroides.md` como plantilla de repuesto.

2. `specs/05-juego-asteroides.md` — **la spec modelo ya escrita** con ese template, para un juego. Tu salida debe tener su mismo tono y nivel de detalle.

**b) El contexto técnico del proyecto:**

3. `CLAUDE.md` y `AGENTS.md` — **este Next.js no es el que conoces** (v16: `middleware.ts` → `proxy.ts`, caching bajo `cacheComponents`). Si la spec toca routing/config, consulta `node_modules/next/dist/docs/01-app/`.
4. `specs/06-leaderboard-catalogo-supabase.md` — esquema de las tablas `games` y `scores` en Supabase.
5. `lib/games/asteroids.ts` — el único motor real portado; es la referencia de estilo para el motor nuevo.
6. `app/_components/GamePlayerClient.tsx` — cómo el Reproductor monta el motor, conecta HUD, pausa, game over y guardado.

**Comprueba si existe la base genérica de motores** (`lib/games/engine.ts` con la interfaz `ArcadeGame` y `lib/games/registry.ts` con el mapa `id → motor`):

- **Si existe**: el motor nuevo debe implementar ese contrato y registrarse con una línea en el registro, **sin tocar `GamePlayerClient.tsx`** salvo que el juego necesite stats de HUD que hoy no existen.
- **Si no existe**: el Reproductor aún decide el motor con un `if` por id hardcodeado (`const isAsteroids = game?.id === "asteroides"`). Avísalo al usuario y ofrece dos caminos, dejando que él elija:
  1. Que la spec incluya como paso 1 la extracción de la interfaz común `ArcadeGame` + registro `lib/games/registry.ts`, y que el juego nuevo sea el primero en usarla (recomendado: evita que el player acumule ramas).
  2. Que la spec añada otra rama `if` por id, igual que hoy con `asteroides`.

Registra la elección en la sección "Decisiones tomadas y descartadas".

---

## Fase 1 — Determinar el origen del juego

El argumento recibido es: `$ARGUMENTS`

Si viene vacío, pregunta qué juego se quiere añadir y espera respuesta. No continúes.

Busca una carpeta que coincida en `references/started-games/` (ignora `__MACOSX/`).

### Rama A — Portar un juego existente

Si hay carpeta, léela completa antes de preguntar nada:

- `README.md` y `CLAUDE.md` — mecánicas, controles, reglas de puntuación.
- `index.html` — **dimensiones del canvas**, canvas secundarios, y qué partes del HUD viven en el DOM en vez de dentro del canvas.
- `game.js` (y auxiliares como `levels.js`) — clases, constantes, loop, colisiones, manejo de teclado, assets.
- `assets/` — imágenes y sonidos.

Después resume al usuario, en pocas líneas: mecánica central, controles, condición de fin, cómo puntúa.

Y sobre todo, **enumera explícitamente las desviaciones** respecto de lo que el Reproductor soporta hoy. Las que ya se conocen:

| Desviación                                                   | Implicación para la spec                                                                                                 |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Canvas secundario (ej. la pieza siguiente de Tetris)         | O se dibuja dentro del canvas principal, o el Reproductor necesita soportar un segundo canvas. Hay que decidirlo.        |
| Stats de HUD que no existen (ej. LÍNEAS)                     | El HUD del Reproductor sólo tiene Jugador / Puntuación / Vidas / Nivel. Hay que ampliarlo o dibujarlo dentro del canvas. |
| El juego no tiene vidas                                      | Decidir si el HUD oculta el bloque de vidas o muestra otra cosa.                                                         |
| Resolución distinta a 4:3 (ej. 300×600 de Tetris)            | El `.crt-screen` es 4:3; hay que decidir letterbox, centrado o ajuste del contenedor.                                    |
| Assets binarios (spritesheets, mp3)                          | Mover a `public/games/<id>/` y cargarlos de forma asíncrona; decidir qué pasa mientras cargan.                           |
| Archivos auxiliares (`levels.js`)                            | Se portan como módulos aparte (`lib/games/<id>-levels.ts`).                                                              |
| Overlays propios de game over / reinicio dentro del original | Se eliminan: eso lo maneja el modal de React, como en `asteroides`.                                                      |

### Rama B — Juego desde cero

Si no hay carpeta de referencia, dilo claramente y pide:

1. Descripción del juego en **una sola frase**.
2. Mecánica central y controles.
3. Cómo se puntúa y cuándo termina la partida.
4. Si tiene vidas, niveles, o ambos.

Si la descripción no cabe en una frase, es señal de que el juego es demasiado grande: propón acotarlo antes de seguir.

---

## Fase 2 — Preguntas de definición

Pregunta en **bloques de 3 a 5**, numeradas, y **espera respuesta antes del siguiente bloque**. No asumas nada: todo lo que no confirme el usuario acaba siendo código improvisado.

Cuando ofrezcas opciones, da 2–4, marca tu recomendación y di por qué.

**Bloque 1 — Identidad y catálogo** (son columnas reales de la tabla `games` de Supabase):

- `id`: slug en minúsculas; es a la vez la ruta (`/juego/<id>`) y la PK, y `scores.game_id` lo referencia por FK.
- `title` en mayúsculas, `short` (una línea) y `long` (párrafo del detalle).
- `cat`: `ARCADE` | `PUZZLE` | `SHOOTER` | `VERSUS`.
- `color`: `cyan` | `magenta` | `yellow` | `green`.
- `available`: si el juego se publica al terminar la spec o queda oculto.

**Bloque 2 — Portada y presentación:**

- El proyecto **no usa imágenes de portada**: son clases CSS puras (`cover-bricks`, `cover-tetro`, `cover-snake`, …) en `app/globals.css`. Preguntar si se reutiliza una existente o se crea una nueva (y en ese caso, describirla).
- Si hay que retocar el `.crt-screen` por la relación de aspecto del juego.

**Bloque 3 — Motor:**

- Resolución lógica interna (el canvas se escala por CSS; el motor dibuja en coordenadas fijas).
- Controles exactos (sólo teclado, como el resto del Vault, salvo que se pida otra cosa).
- Si se conserva el HUD dibujado dentro del canvas. En `asteroides` **sí** se conserva y coexiste con el del Reproductor, ambos alimentados por el mismo estado.
- Stats extra a exponer al HUD del Reproductor, y si el juego usa vidas.

**Bloque 4 — Fidelidad y estética:**

- ¿Se porta la mecánica completa sin recortes, o se simplifica? (En `asteroides` se portó completa por decisión explícita.)
- Recoloreo a la paleta neón del Vault. Los tokens reales, hardcodeados en el motor como hace `lib/games/asteroids.ts`:
  `--cyan #00f5ff` · `--magenta #ff006e` · `--yellow #f5ff00` · `--green #00ff88` · fondo `#0a0a0f`.
  Confirmar qué color va a cada elemento (jugador, enemigos, proyectiles, partículas, power-ups, HUD).

**Bloque 5 — Fuera de alcance:** sonido, controles táctiles, tests automatizados, ajustes de dificultad, autenticación. Por defecto quedan fuera, igual que en la spec 05 — confirmarlo.

**Cuándo dejar de preguntar:** cuando puedas responder sin suponer: (1) qué archivos aparecen o cambian, (2) cuál es el primer paso ejecutable y cuál el último, (3) cómo se verifica que el juego está terminado.

---

## Fase 3 — Escribir la spec sección por sección

**No generes la spec entera de una vez.** Muestra cada sección en markdown, pregunta "¿esta sección queda así o la ajustamos?", aplica cambios y sólo entonces pasa a la siguiente. Es el ritmo que impone `/spec` y aquí se respeta igual.

Ten abierto el `template.md` de `/spec` mientras escribes: la estructura, los encabezados y el orden salen de ahí, no de tu memoria. Lo que sigue es ese mismo orden anotado con lo que aporta un juego en cada sección:

1. **Cabecera** — `**Estado:** Borrador`, `**Depende de:**` (como mínimo `06-leaderboard-catalogo-supabase`, y la spec de la base genérica si aplica), `**Fecha:**`, y el objetivo **en una sola frase**.
2. **Alcance** — lo incluido y, explícitamente, lo que queda **fuera**.
3. **Modelo de datos** — la fila de `games` con valores reales, la firma pública del motor (`lib/games/<id>.ts`), y una nota de que no se crean tablas ni claves nuevas: las puntuaciones siguen yendo a `scores` vía `saveScore()` de `lib/scores.ts`.
4. **Plan de implementación** — pasos numerados, cada uno dejando el sistema funcionando, **cada uno con su prueba manual**.
5. **Criterios de aceptación** — checklist booleano y verificable. Nada de "que se vea bien".
6. **Decisiones tomadas y descartadas** — con justificación breve. Es la sección de más valor a largo plazo.
7. **Riesgos identificados** — tabla riesgo / mitigación, sólo si aplican.

### Pasos que el plan de implementación debe cubrir siempre

Adáptalos al juego concreto, pero no omitas ninguno:

1. **Fila en Supabase.** Insertar el juego en la tabla `games` (`id`, `title`, `short`, `long`, `cat`, `cover`, `color`, `available`) con las herramientas MCP de Supabase (`apply_migration` o `execute_sql`). **El catálogo ya no está en `lib/games.ts`**: ese archivo sólo consulta (`getGames`, `getGameById`, `getTopScoresByGame`, `getGlobalTopScores`). Prueba manual: el juego aparece en `/biblioteca`, filtrable por categoría, y `/juego/<id>` carga con su leaderboard vacío.
2. **Portada CSS** en `app/globals.css`, si es nueva.
3. **Assets** a `public/games/<id>/`, si los hay, con carga asíncrona.
4. **Motor** en `lib/games/<id>.ts`: TypeScript puro, sin React y sin tocar el DOM más allá del `CanvasRenderingContext2D` que recibe por parámetro — nada de `document.getElementById` ni canvas global. Estado interno como fuente de verdad, emitiendo cambios por callbacks. Listeners de teclado registrados en el constructor/`start()` y **removidos en `destroy()`**. Ciclo de vida `start` / `pause` / `resume` / `destroy`, con `resume()` descartando el `dt` acumulado para que no haya salto de física.
5. **Registro en el Reproductor**: una línea en `lib/games/registry.ts` (o la rama `if` en `GamePlayerClient.tsx`, según lo decidido en la Fase 0). Conectar pausa, game over automático y, si aplica, los stats extra del HUD.
6. **Verificación end-to-end**: recorrido Biblioteca → Detalle → Reproductor → Fin del juego → Guardar → Detalle y Salón; `npm run build` sin errores; consola limpia; y comprobar que un juego simulado (ej. `bloque-buster`) sigue exactamente igual.

### Criterios de aceptación que no pueden faltar

- Existe la fila en `games` y el juego aparece en `/biblioteca`, filtrable por búsqueda y categoría.
- `/juego/<id>` muestra info real y leaderboard (top 10) de ese juego.
- `/juego/<id>/jugar` corre el motor real en un `<canvas>` en vez del `game-arena` simulado.
- Los controles descritos funcionan tal como se especificaron.
- El HUD del Reproductor refleja en tiempo real el estado real del motor.
- PAUSA congela el loop por completo (las posiciones no cambian) y REANUDAR continúa sin salto.
- Al terminar la partida, el modal de fin se abre automáticamente; el botón FIN sigue funcionando manualmente.
- Guardar la puntuación inserta una fila en `scores` con el `game_id` correcto y aparece en el Detalle y en el Salón.
- Salir del Reproductor detiene el loop: no queda `requestAnimationFrame` corriendo en background.
- El canvas se adapta a móvil y desktop sin distorsionar el dibujo.
- Los colores usan la paleta neón del Vault.
- Los demás juegos del catálogo no cambian su comportamiento.
- `npm run build` compila sin errores de TypeScript y la consola del navegador queda limpia en el recorrido completo.

---

## Fase 4 — Guardar y parar

Sigue el procedimiento de guardado de `/spec` (su Fase 4), con estas concreciones:

1. Determina el número siguiente mirando `specs/` (si la última es `06-…`, esta es `07-`).
2. Nombre propuesto: `NN-juego-<slug>.md`.
3. **Confirma el nombre con el usuario antes de escribir.**
4. Crea el archivo con todas las secciones aprobadas y `**Estado:** Borrador`. **Nunca lo marques como `Aprobado` automáticamente** — eso lo hace el humano tras releerlo.
5. Confirma:

```
✅ Spec creada: specs/NN-juego-<slug>.md

Estado: Borrador. Reléela y cámbialo a "Aprobado" cuando estés conforme
(ese cambio lo haces tú, no el agente).

Siguiente paso: /spec-impl NN-juego-<slug>
```

6. **Para aquí.** No propongas implementar, no escribas código, no toques Supabase.

---

## Reglas duras

- **`/spec` manda en formato y proceso.** Este skill aporta el contenido de dominio; si hay conflicto entre ambos sobre cómo debe verse o construirse la spec, sigue `/spec` y su `template.md`.
- **Nunca escribas la spec sin haber leído antes el `template.md` de `/spec`** en esta misma sesión.
- **Nunca escribas código en este comando.** Lo único que creas es el `.md` de la spec.
- **Nunca ejecutes migraciones ni toques Supabase aquí.** Eso es trabajo de `/spec-impl`.
- **Nunca propongas implementar la spec después de guardarla.** Tu trabajo termina con el mensaje de confirmación.
- **Nunca asumas decisiones que el usuario no confirmó.** Si falta información, pregunta.
- **Nunca generes la spec completa en una sola respuesta.** Sección por sección, con confirmación.
- **Si el usuario quiere saltarse la Fase 2**, recuérdale que las preguntas ahora ahorran horas después. Si insiste, respétalo y déjalo anotado en la sección de decisiones.
- **Si el juego es demasiado grande** (mecánicas que se cruzan, multijugador, editor de niveles), propón partirlo en dos specs antes de seguir.
- Sé directo al preguntar. No te disculpes por preguntar: el usuario invocó este skill precisamente para eso.

---

## Comportamiento esperado

```
/add-game tetris

  Fase 0  →  Lee el skill /spec (SKILL.md + template.md) ← método y plantilla
             Lee CLAUDE.md, spec 05, spec 06, asteroids.ts, GamePlayerClient.tsx
             Comprueba si existe lib/games/registry.ts
  Fase 1  →  Encuentra references/started-games/03-tetris
             Detecta: canvas 300×600 (no 4:3), #next-canvas secundario,
             stat LÍNEAS inexistente en el HUD, sin vidas
  Fase 2  →  Preguntas en bloques (identidad, portada, motor, fidelidad, fuera de alcance)
  Fase 3  →  Escribe la spec sección por sección, confirmando cada una
  Fase 4  →  specs/07-juego-tetris.md  (Estado: Borrador)  →  STOP

/add-game buscaminas   (no está en references/)

  Fase 1  →  Rama B: pide descripción en una frase, mecánica, fin y puntuación
  Fases 2-4 igual
```
