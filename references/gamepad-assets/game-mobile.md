# Juegos portados a móvil

Registro de qué motores de `lib/games/` ya pasaron por el subagente `mobile-porter`. Lo
mantiene **exclusivamente** ese agente, al cerrar cada ejecución. ✅ solo cuando pasó la
verificación de la Fase 3 (Playwright en emulación táctil + desktop sin regresión).

| juego        | handleTouchInput | layout táctil | desktop sin regresión | última actualización | notas                                                        |
| ------------ | ---------------- | ------------- | --------------------- | -------------------- | ------------------------------------------------------------ |
| `asteroides` | ✅               | ✅            | ✅                    | 2026-09-28           | portado en spec 10 (mismo commit que la infraestructura)     |
| `tetris`     | ✅               | ✅            | ✅                    | 2026-09-28           | portado en spec 10; DAS táctil calibrado (~350ms/40ms)       |
| `arkanoid`   | ✅               | ✅            | ✅                    | 2026-09-28           | portado en spec 10; mouse sigue funcionando sin cambios      |
| `snake`      | ✅               | ✅            | ✅                    | 2026-09-28           | portado en spec 10; buffer de giro de 1 tecla también táctil |
