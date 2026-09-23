---
name: fusion-2048
description: Deslizar una rejilla 4x4 en cuatro direcciones fusionando fichas iguales hasta quedarse sin movimientos.
metadata:
  type: sugerencia
  estado: propuesto
  fecha: 2026-08-31
---

**Qué es:** Rejilla 4x4; cada flecha desliza todas las fichas en esa dirección y las iguales adyacentes se fusionan duplicando su valor, apareciendo una ficha nueva tras cada movimiento. La puntuación es la suma de las fusiones; termina cuando no queda ningún movimiento legal.

**Categoría / color sugeridos:** PUZZLE · magenta

**Por qué se propuso:** Ronda de investigación 2026-08-31 (bloque PUZZLE). Es el candidato de implementación más limpia de todo el backlog: cuatro teclas, cero física, cero assets, y encaja en el contrato `ArcadeGame` sin ninguna fricción. Refuerza PUZZLE con un juego 100% de decisión, sin componente de reflejos, cubriendo el extremo "partida larga y pensada" del ritmo.

**Coste y riesgos:** Coste bajo. Un array 4x4, la operación de colapso por fila/columna, animación de deslizamiento opcional. Sin IA, sin assets, portada CSS trivial. Riesgo de marca bajo (2048 nació como clon libre y su mecánica es de dominio abierto). **Riesgo medio de encaje: la puntuación es poco discriminante para un top 10** — los jugadores habituales convergen en rangos parecidos y el techo lo marca la suerte de las fichas nuevas; además una partida buena puede durar mucho, lo que choca con el ritmo arcade del sitio.

**Veredicto y motivo:** Registrado. Coste mínimo y encaje técnico perfecto, pero es el que peor casa con el enfoque competitivo del Salón de la Fama.
