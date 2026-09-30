---
name: spec-impl-game
description: Implementa una spec de juego aprobada siguiendo exactamente el flujo de /spec-impl (fases 1-4) y, al cerrar con criterios de aceptación en verde y `npm run build` OK, lanza en serie (nunca en paralelo) al agente skin-designer y luego al agente mobile-porter sobre el juego recién implementado.
disable-model-invocation: true
argument-hint: <NN-juego-slug>
allowed-tools: Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(cat:*), Bash(ls:*)
---

# /spec-impl-game — Implementador de specs de juego + skins + móvil en cadena

Este skill es una **extensión de `/spec-impl`** para specs de juego. No reemplaza a `/spec-impl`: reutiliza su mismo proceso al pie de la letra para las Fases 1–4, y añade dos fases propias al final (verificación y disparo en serie de `skin-designer` → `mobile-porter`).

**Responde siempre en español.**

## Contexto de sesión

Estado del repo:
!`git status --short`

Rama actual:
!`git branch --show-current`

Specs disponibles:
!`ls specs/ 2>/dev/null || echo "No existe la carpeta specs/"`

Config de creación de rama:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (default, sin archivo de config)"`

Motores ya integrados (para resolver el game-id al final):
!`ls lib/games/ 2>/dev/null || echo "No existe lib/games/"`

---

## Fases 1–4 — delegadas a /spec-impl

El argumento recibido es: `$ARGUMENTS`

Antes de nada, lee con la herramienta Read el archivo `~/.agents/skills/spec-impl/SKILL.md` (ruta absoluta: `C:\Users\luisf\.agents\skills\spec-impl\SKILL.md`).

- Si el archivo **no existe o no se puede leer**: detente y avisa al usuario que `/spec-impl` no está instalado en este entorno (`npx skills@latest add Klerith/fernando-skills`); no improvises un flujo alternativo.
- Si existe: sigue sus **Fases 1 a 4 tal cual están escritas ahí**, usando `$ARGUMENTS` como el argumento de esa spec y el contexto de sesión de arriba (ya trae `git status`, rama, `ls specs/` y la config de rama — no los vuelvas a pedir). Esto incluye:
  1. Identificar el archivo de spec en `specs/` (tolerando número, slug o nombre completo).
  2. Validar que el estado significa "Aprobado" en cualquier idioma; si no, mostrar el mensaje de error estándar de `/spec-impl` y **parar sin tocar git ni código**.
  3. Crear/cambiar a la rama `spec-NN-slug` según `AutoCreateBranch`.
  4. Mostrar objetivo, alcance, plan de implementación y criterios de aceptación.
  5. Implementar paso a paso, pausando tras cada paso para que el usuario revise el diff, respetando ambigüedades (parar y preguntar, nunca improvisar) y fuera-de-alcance (avisar y no implementar).

No continúes a la Fase 5 hasta que el último paso del plan de implementación esté completado y confirmado por el usuario.

### Guardia: solo specs de juego

Si al leer la spec resulta que **no es una spec de juego** (no menciona añadir una entrada nueva a `lib/games/registry.ts` / no sigue el molde de `specs/07-09` y `specs/NN-juego-*`), avisa al usuario:

```
Esta spec no parece ser de un juego (no toca lib/games/registry.ts).
Voy a completar la implementación como /spec-impl normal, pero no voy a
encadenar skin-designer ni mobile-porter al final, porque son agentes
específicos de motores de juego.
```

Y al terminar la Fase 4, cierra ahí — no ejecutes las Fases 5 y 6 de este skill.

---

## Fase 5 — Verificación

Solo si la spec es de juego. Tras completar el último paso del plan:

1. Repasa uno a uno los **criterios de aceptación** de la spec y confirma cada uno (manual o con lo ya verificado durante la implementación).
2. Corre `npm run build` y revisa que termine sin errores.
3. Si **algo falla** (criterio no cumplido o build roto): repórtalo con el detalle exacto, no avances a la Fase 6, y pregunta al usuario cómo seguir. No lances los agentes con una implementación rota.
4. Si todo pasa: informa al usuario que puede promover el estado de la spec a `implementado` (recuérdale que ese cambio de estado lo hace él/ella, no el agente, igual que Borrador→Aprobado), y continúa directo a la Fase 6 sin pedir confirmación adicional (ya se confirmó el disparo en serie al planificar este comando).

---

## Fase 6 — Encadenar skin-designer y luego mobile-porter (en serie, nunca en paralelo)

1. Resuelve el `<game-id>`: la clave nueva que el paso de implementación añadió a `GAME_ENGINES` en `lib/games/registry.ts` (coincide con el `id` de la spec y con el segmento de `/juego/[id]`).

2. Informa al usuario:

   ```
   Criterios de aceptación OK y build limpio.
   Lanzando skin-designer para <game-id>...
   ```

3. Invoca el agente `skin-designer` (Agent tool, `subagent_type: "skin-designer"`) con `<game-id>` como juego objetivo, pasándole en el prompt el contexto útil: id del juego, spec (`specs/NN-juego-<slug>.md`), rama activa (`spec-NN-slug`). **Espera a que termine** (no lo mandes a background, no sigas hasta tener su resultado).

4. Resume al usuario el resultado de `skin-designer` (skins añadidas, entrada actualizada en `references/game-with-theme.md`).

   - Si `skin-designer` falla o queda bloqueado (p. ej. te pregunta algo y no puedes responder por él): repórtalo y **detente aquí — no lances mobile-porter**.

5. Solo si el paso anterior terminó bien, informa:

   ```
   skin-designer terminado. Lanzando mobile-porter para <game-id>...
   ```

6. Invoca el agente `mobile-porter` (`subagent_type: "mobile-porter"`) con el mismo `<game-id>` y contexto (id del juego, spec, rama). Espera a que termine.

7. Resume el resultado de `mobile-porter` (estado en `references/game-mobile.md`, cualquier regresión encontrada/corregida).

---

## Cierre

Al terminar (o al detenerte antes de tiempo por un fallo), da un resumen final en español con:

- Spec implementada y su estado.
- Rama activa.
- Resultado de `skin-designer` (o "no ejecutado" y por qué).
- Resultado de `mobile-porter` (o "no ejecutado" y por qué).
- Recordatorio de que el commit/PR lo decide el usuario — no commitees ni abras PR sin que lo pida explícitamente.
