---
name: piramide
description: Saltar por una pirámide isométrica de cubos cambiando su color mientras esquivas enemigos.
metadata:
  type: sugerencia
  estado: propuesto
  fecha: 2026-08-31
---

**Qué es:** Pirámide isométrica de cubos; cada salto diagonal cambia el color del cubo de destino y hay que pintar todos para pasar de nivel, esquivando enemigos que descienden y caídas al vacío. Puntos por cubo pintado, nivel completado y enemigos evitados.

**Categoría / color sugeridos:** ARCADE · green

**Por qué se propuso:** Ronda de investigación 2026-08-31 (bloque ARCADE). Es visualmente el candidato más distintivo del backlog: la perspectiva isométrica de cubos de neón encaja perfectamente con la estética CRT del sitio y no se parece a nada del catálogo.

**Coste y riesgos:** Coste medio-alto. La lógica es simple (rejilla triangular de estados de color), pero la proyección isométrica, el orden de dibujado y las animaciones de salto arco requieren cuidado. **Riesgo de encaje medio-alto en controles: el movimiento diagonal con flechas es notoriamente confuso** y el proyecto es sólo teclado, lo que agrava el problema; habría que mapear a teclas diagonales explícitas y explicarlo bien. Riesgo de marca medio (Q*bert es IP de Columbia/Sony pero poco explotada hoy); nombre propio obligatorio. Green ya lo ocupa snake.

**Veredicto y motivo:** Registrado. Muy atractivo visualmente, penalizado por el control diagonal y el coste de la proyección.
