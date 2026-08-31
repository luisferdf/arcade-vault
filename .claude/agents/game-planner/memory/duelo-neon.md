---
name: duelo-neon
description: Pong a un jugador contra una CPU con dificultad creciente; puntúas por cada tanto marcado.
metadata:
  type: sugerencia
  estado: propuesto
  fecha: 2026-08-31
---

**Qué es:** Duelo de paleta y bola (mecánica Pong) contra una IA rival. Cada tanto marcado suma puntos y acelera la bola; la partida acaba cuando la CPU llega a 11.

**Categoría / color sugeridos:** VERSUS · magenta

**Por qué se propuso:** Diagnóstico 2026-08-31 con 4 juegos en catálogo. VERSUS era la única categoría del esquema sin ningún juego (filtro vacío en `/biblioteca`), magenta el único color de la paleta sin usar en portadas, y ninguno de los 4 juegos existentes tiene oponente: todos son jugador-contra-sistema. Es la única propuesta que cierra los tres huecos a la vez.

**Coste y riesgos:** Coste bajo. Física de una bola con rebote + dos paletas; IA rival = seguidor con error y velocidad máxima acotada. Sin assets binarios, sin segundo canvas, encaja directo en el contrato `ArcadeGame`; portada `cover-duelo` en CSS puro (dos barras + línea central). Riesgo de marca: "Pong" es marca viva de Atari, de ahí el título propio DUELO NEÓN sobre mecánica de dominio genérico. Riesgo de diseño: puntuación sin techo si la IA es débil; se acota acelerando la bola por tanto y con derrota a 11.

**Veredicto y motivo:** Recomendación principal de la sesión 2026-08-31. Pendiente de confirmación del usuario para pasar a `/add-game duelo-neon`.
