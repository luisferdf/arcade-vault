---
name: columnas
description: Columnas de tres gemas que caen y rotan internamente; alinea 3+ iguales en cualquier dirección con cascadas.
metadata:
  type: sugerencia
  estado: propuesto
  fecha: 2026-08-31
---

**Qué es:** Caen columnas verticales de tres gemas de colores; se mueven en horizontal y se rota el orden interno de las tres. Al alinear 3 o más del mismo color en horizontal, vertical o diagonal, desaparecen, el resto cae y puede encadenar cascadas que multiplican los puntos. Fin al desbordar el pozo.

**Categoría / color sugeridos:** PUZZLE · yellow

**Por qué se propuso:** Ronda de investigación 2026-08-31 (bloque PUZZLE). Aporta el eje match-3 con cascadas, ausente en el catálogo, y es el candidato de PUZZLE de menor coste de toda la ronda.

**Coste y riesgos:** Coste bajo. Reutiliza casi el mismo esqueleto que el motor de TETRIS ya implementado (pozo, gravedad por pasos, bloqueo de pieza), sólo cambia la pieza (siempre 1x3, rotación = permutación) y añade detección de líneas en 8 direcciones más gravedad de relleno y cascadas. **Riesgo medio-alto de solape percibido: visualmente es "otro juego de piezas que caen en un pozo" junto a TETRIS** y el usuario puede sentirlo redundante; se mitiga con arte de gemas brillantes y con las cascadas como identidad propia. Riesgo de marca bajo (Columns es de Sega pero la mecánica está ampliamente replicada). Yellow ya lo ocupa asteroides.

**Veredicto y motivo:** Registrado con advertencia explícita de solape con TETRIS. Barato de hacer, pero es el que menos variedad real aporta al catálogo.
