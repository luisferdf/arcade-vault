---
name: estelas
description: Duelo de motos de luz contra la CPU dejando una estela sólida; gana quien sobreviva sin chocar.
metadata:
  type: sugerencia
  estado: propuesto
  fecha: 2026-08-31
---

**Qué es:** Dos vehículos avanzan sin parar por una arena cerrada girando sólo en ángulo recto y dejando tras de sí un muro permanente. Pierde el primero que choque contra un muro, contra su propia estela o contra el borde. Rondas al mejor de N contra una CPU que sube de nivel; puntos por ronda ganada y por segundos sobrevividos.

**Categoría / color sugeridos:** VERSUS · cyan

**Por qué se propuso:** Ronda de investigación 2026-08-31 (bloque VERSUS). VERSUS es la única categoría del esquema sin ningún juego implementado. Es el candidato con mejor relación coste/impacto de todo el bloque: la estética de estelas de neón sobre fondo oscuro es literalmente la identidad visual del sitio, así que la portada y el motor salen casi gratis en dirección de arte.

**Coste y riesgos:** Coste bajo-medio. Rejilla de celdas ocupadas, dos entidades con dirección y avance por pasos, colisión = consulta a la rejilla; la única pieza no trivial es la IA rival, que se resuelve bien con lookahead corto (mirar N celdas por delante y preferir el giro con más espacio libre por flood-fill acotado). Sin assets. **Nota de solape: comparte con SNAKE la idea de "no chocar con tu rastro"**, pero aquí el rastro es permanente y hay oponente, lo que cambia la decisión por completo. Riesgo de marca bajo: Tron es IP de Disney — nada de nombres, tipografías ni diseño de moto reconocibles; arena abstracta y nombre propio.

**Veredicto y motivo:** Registrado como el mejor candidato VERSUS de la ronda: llena la categoría vacía con coste contenido y encaje estético perfecto.
