---
name: buscaminas
description: Rejilla con minas ocultas: deducir dónde están a partir de los números de casillas adyacentes.
metadata:
  type: sugerencia
  estado: propuesto
  fecha: 2026-08-31
---

**Qué es:** Tablero con minas repartidas al azar; al descubrir una casilla se revela cuántas minas la rodean y las zonas vacías se abren en cascada. Se marcan las sospechosas con bandera. Puntuación por casillas despejadas y tiempo restante, con tableros de tamaño creciente.

**Categoría / color sugeridos:** PUZZLE · cyan

**Por qué se propuso:** Ronda de investigación 2026-08-31 (bloque PUZZLE). Refuerza PUZZLE con deducción lógica pura, un eje inexistente en el catálogo, y es un clásico universalmente conocido sin ninguna IP viva detrás.

**Coste y riesgos:** Coste bajo-medio. Generación del tablero con primera jugada segura, conteo de vecinos y flood-fill de zonas vacías; todo trivial en canvas. **Riesgo medio-alto de encaje: el juego está diseñado para ratón**, y moverse casilla a casilla con las flechas más dos teclas (revelar / bandera) es tosco y lento en tableros grandes, lo que perjudica mucho la sensación en un sitio de reflejos. Riesgo secundario: el azar de la primera jugada y las situaciones de adivinanza forzada hacen la puntuación menos justa. Cyan ya está usado dos veces (tetris, arkanoid), el color más saturado del catálogo.

**Veredicto y motivo:** Registrado con reserva. La restricción de "sólo teclado" del proyecto es el principal argumento en contra.
