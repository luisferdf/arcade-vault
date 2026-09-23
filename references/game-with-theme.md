# Juegos con skins

Registro de qué motores de `lib/games/` ya pasaron por el subagente `skin-designer`. Lo
mantiene **exclusivamente** ese agente, al cerrar cada ejecución. ✅ solo cuando pasó la
validación de contraste (dark y light); ❌ solo por un bloqueo duro documentado en notas.

| juego        | clasico | retro | neon | skin extra | darkmode revisado | última actualización | notas                                                                                                                                                                          |
| ------------ | ------- | ----- | ---- | ---------- | ----------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `asteroides` | ✅      | ✅    | ✅   | —          | ✅                | 2026-09-16           | `neon` = réplica histórica exacta; `setSkin()` en caliente; nave/power-up separados por forma, no por luminosidad                                                              |
| `tetris`     | ❌      | ✅    | ✅   | —          | ✅                | 2026-09-16           | `clasico` = réplica histórica exacta; rejilla (1.14:1) y fantasma (<2:1) bajo umbral decorativo, regresión cero                                                                |
| `arkanoid`   | ✅      | ✅    | ✅   | —          | ✅                | 2026-09-16           | `neon` = réplica histórica exacta (bola cian = bloques cian, separadas solo por forma); bloques por nombre `BlockColor`, `arkanoid-levels.ts` intacto; `setSkin()` en caliente |
| `snake`      | ✅      | ✅    | ✅   | —          | ✅                | 2026-09-16           | `neon` = réplica histórica exacta (cabeza/cuerpo solo separados por tono, 1.01:1); fruta = sprite PNG, la skin solo controla su fallback; `setSkin()` en caliente              |

## Infraestructura compartida

- ✅ lista (bootstrap 2026-09-16, con `tetris`): `lib/games/skins.ts` (`SkinId`, `SKIN_IDS`,
  `SKIN_LABELS`, persistencia `av_skin` + evento `av:skin-changed`), contrato de skin en
  `lib/games/engine.ts` (`GameEngineEntry.skins?`, `create(ctx, callbacks, skin?)`,
  `ArcadeGame.setSkin?()`), selector de chips en `.hud-actions` de `GamePlayerClient.tsx`,
  modo claro del sitio (`[data-theme="light"]` en `globals.css`, `lib/theme.ts` con `av_theme`
  - `av:theme-changed`, script anti-FOUC en `app/layout.tsx`, toggle en `Nav.tsx`).
- ⚠️ pendiente: las portadas `cover-*` de la Biblioteca siguen con hex literales, no migradas a
  tokens de tema.
