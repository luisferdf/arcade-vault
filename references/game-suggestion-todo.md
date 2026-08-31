# To-do de sugerencias de juegos

_Mantenido por el subagente `game-planner`. Última actualización: 2026-08-31_

Estado del catálogo: 4 juegos implementados — ARCADE 2, PUZZLE 1, SHOOTER 1, **VERSUS 0**. Colores usados: cyan x2, green x1, yellow x1, **magenta x0** (pero muy pedido en el backlog: vigilar saturación al aceptar).

## Pendientes

### ARCADE

- [ ] **CRUCE** (`cruce`) — ARCADE · magenta — Cruzar carriles de tráfico y un río de troncos móviles hasta la meta, contrarreloj. Coste: bajo-medio. — [memoria](../.claude/agents/game-planner/memory/cruce.md)
- [ ] **ALUNIZAJE** (`alunizaje`) — ARCADE · yellow — Descender con gravedad e inercia y posarse en plataformas estrechas con combustible limitado. Coste: bajo. ⚠ controles muy parecidos a ASTEROIDES. — [memoria](../.claude/agents/game-planner/memory/alunizaje.md)
- [ ] **PIRÁMIDE** (`piramide`) — ARCADE · green — Saltar por una pirámide isométrica de cubos cambiando su color, esquivando enemigos. Coste: medio-alto. ⚠ control diagonal con teclado. — [memoria](../.claude/agents/game-planner/memory/piramide.md)
- [ ] **COMEPUNTOS** (`comepuntos`) — ARCADE · yellow — Laberinto con 4 perseguidores de IA distinta y píldoras de poder. Coste: alto. ⚠ IP viva (Pac-Man). — [memoria](../.claude/agents/game-planner/memory/comepuntos.md)
- [ ] **TORRE** (`torre`) — ARCADE · magenta — Escalar plataformas esquivando barriles, un piso por pantalla. Coste: alto. ⚠ IP viva (Donkey Kong) + física de plataformas. — [memoria](../.claude/agents/game-planner/memory/torre.md)

### PUZZLE

- [ ] **BURBUJAS NEÓN** (`burbujas-neon`) — PUZZLE · magenta — Disparador de burbujas: revienta grupos de 3+ antes de que baje el techo. Coste: medio. — [memoria](../.claude/agents/game-planner/memory/burbujas-neon.md)
- [ ] **TUBERÍAS** (`tuberias`) — PUZZLE · green — Colocar tramos de tubería en rejilla contrarreloj antes de que arranque el flujo. Coste: medio. — [memoria](../.claude/agents/game-planner/memory/tuberias.md)
- [ ] **SOKOBAN / ALMACÉN** (`sokoban`) — PUZZLE · magenta — Empuja cajas hasta sus marcas en niveles de rejilla. Coste: medio. — [memoria](../.claude/agents/game-planner/memory/sokoban.md)
- [ ] **FUSIÓN 2048** (`fusion-2048`) — PUZZLE · magenta — Deslizar rejilla 4x4 y fusionar fichas iguales. Coste: bajo. ⚠ puntuación poco discriminante para el top 10. — [memoria](../.claude/agents/game-planner/memory/fusion-2048.md)
- [ ] **COLUMNAS** (`columnas`) — PUZZLE · yellow — Columnas de 3 gemas que caen y rotan; match-3 con cascadas. Coste: bajo. ⚠ solape visual con TETRIS. — [memoria](../.claude/agents/game-planner/memory/columnas.md)
- [ ] **BUSCAMINAS** (`buscaminas`) — PUZZLE · cyan — Rejilla con minas ocultas, deducción por números. Coste: bajo-medio. ⚠ diseñado para ratón; cursor con flechas es tosco. — [memoria](../.claude/agents/game-planner/memory/buscaminas.md)

### SHOOTER

- [ ] **CIEMPIÉS** (`ciempies`) — SHOOTER · magenta — Ciempiés que baja por un campo de hongos y se parte en segmentos al dispararle. Coste: medio. — [memoria](../.claude/agents/game-planner/memory/ciempies.md)
- [ ] **INVASORES** (`invasores`) — SHOOTER · magenta — Oleadas de enemigos en formación con barricadas destructibles. Coste: medio. — [memoria](../.claude/agents/game-planner/memory/invasores.md)
- [ ] **DEFENSA ORBITAL** (`defensa-orbital`) — SHOOTER · magenta — Interceptar misiles con explosiones de radio. Coste: medio. ⚠ precisión de mira con teclado. — [memoria](../.claude/agents/game-planner/memory/defensa-orbital.md)
- [ ] **BLINDADO** (`blindado`) — SHOOTER · yellow — Tanque en laberinto destructible defendiendo su base. Coste: medio. ⚠ IA rival + IP (Battle City). — [memoria](../.claude/agents/game-planner/memory/blindado.md)
- [ ] **TÚNEL** (`tunel`) — SHOOTER · green — Scroll lateral en caverna procedural, disparo y bombardeo, combustible. Coste: medio-alto. ⚠ colisión contra terreno. — [memoria](../.claude/agents/game-planner/memory/tunel.md)
- [ ] **TORRETA 360** (`torreta`) — SHOOTER · magenta — Torreta fija que rota y dispara a hordas convergentes. Coste: bajo. ⚠ se solapa mucho con ASTEROIDES. — [memoria](../.claude/agents/game-planner/memory/torreta.md)

### VERSUS _(categoría vacía en el catálogo — máxima prioridad de producto)_

- [ ] **ESTELAS** (`estelas`) — VERSUS · cyan — Duelo de motos de luz con estela sólida contra la CPU. Coste: bajo-medio. — [memoria](../.claude/agents/game-planner/memory/estelas.md)
- [ ] **DUELO NEÓN** (`duelo-neon`) — VERSUS · magenta — Pong a un jugador contra una CPU con dificultad creciente. Coste: bajo. — [memoria](../.claude/agents/game-planner/memory/duelo-neon.md)
- [ ] **TANQUES DE ARENA** (`tanques-arena`) — VERSUS · yellow — Combate cenital de tanques con proyectiles que rebotan. Coste: medio. ⚠ IA de apuntado. — [memoria](../.claude/agents/game-planner/memory/tanques-arena.md)
- [ ] **DUELO AL AMANECER** (`duelo-pistolas`) — VERSUS · magenta — Duelo de pistoleros con coberturas móviles y timing. Coste: medio. ⚠ choque temático con la estética neón. — [memoria](../.claude/agents/game-planner/memory/duelo-pistolas.md)
- [ ] **CONECTA NEÓN** (`conecta-neon`) — VERSUS · green — Cuatro en raya contra CPU con minimax. Coste: bajo. ⚠ por turnos, rompe el ritmo arcade. — [memoria](../.claude/agents/game-planner/memory/conecta-neon.md)
- [ ] **MURALLAS** (`murallas`) — VERSUS · magenta — Cuatro esquinas con murallas, paletas curvas y eliminación progresiva. Coste: medio-alto. ⚠ solapa con ARKANOID y con DUELO NEÓN: elegir uno de los dos. — [memoria](../.claude/agents/game-planner/memory/murallas.md)

## Aceptados / en curso

_(ninguno — ninguna propuesta ha sido confirmada todavía por el usuario)_

## Hechos

- [x] **ASTEROIDES** (`asteroides`) — SHOOTER · yellow — implementado — [memoria](../.claude/agents/game-planner/memory/asteroides.md)
- [x] **TETRIS** (`tetris`) — PUZZLE · cyan — implementado — [memoria](../.claude/agents/game-planner/memory/tetris.md)
- [x] **ARKANOID** (`arkanoid`) — ARCADE · cyan — implementado — [memoria](../.claude/agents/game-planner/memory/arkanoid.md)
- [x] **SNAKE** (`snake`) — ARCADE · green — implementado — [memoria](../.claude/agents/game-planner/memory/snake.md)

## Descartados

_(ninguno)_
