---
name: conecta-neon
description: Cuatro en raya por turnos contra una CPU con minimax y dificultad ajustable.
metadata:
  type: sugerencia
  estado: propuesto
  fecha: 2026-08-31
---

**Qué es:** Tablero vertical de 7x6; se sueltan fichas por columnas y gana quien alinee cuatro en horizontal, vertical o diagonal. La CPU juega con minimax y poda alfa-beta a profundidad variable. Puntuación por partidas ganadas seguidas y por nivel de dificultad superado.

**Categoría / color sugeridos:** VERSUS · green

**Por qué se propuso:** Ronda de investigación 2026-08-31 (bloque VERSUS). Llena la categoría vacía con el coste más bajo posible y sin ninguna duda de licencia (Connect Four es marca de Hasbro, pero el "cuatro en raya" es un juego abstracto de dominio público bajo nombre propio).

**Coste y riesgos:** Coste bajo. Tablero como matriz, comprobación de líneas, minimax con heurística de ventanas de cuatro; todo cabe en un archivo, sin física, sin assets, sin bucle de animación exigente. **Riesgo de encaje medio-alto: es un juego por turnos y rompe el ritmo arcade del sitio** — no hay reflejos, no hay tensión de tiempo real, y la puntuación ("partidas ganadas") es poco natural para un Salón de la Fama de marcadores altos; se mitiga a medias con racha + reloj por jugada. Green ya lo ocupa snake.

**Veredicto y motivo:** Registrado. Baratísimo y llena VERSUS, pero es el candidato con peor encaje tonal de los 20.
