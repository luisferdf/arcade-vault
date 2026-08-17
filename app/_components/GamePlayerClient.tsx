"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { Game } from "@/lib/games";
import { getStoredUser } from "@/lib/auth";
import { saveScore } from "@/lib/scores";
import type { ArcadeGame } from "@/lib/games/engine";
import { getEngine } from "@/lib/games/registry";

export function GamePlayerClient({ game }: { game: Game | null }) {
  const router = useRouter();
  // Motor real si el juego está registrado en lib/games/registry.ts; si no, arena simulada.
  const engine = getEngine(game?.id);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [name, setName] = useState("INVITADO");
  const [saved, setSaved] = useState(false);
  // Cambia en cada partida nueva: fuerza a recrear la instancia del motor.
  const [runId, setRunId] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ArcadeGame | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    if (user) setName(user.name);
  }, []);

  useEffect(() => {
    if (!engine) return;
    document.body.classList.add("av-fullscreen-game");
    return () => document.body.classList.remove("av-fullscreen-game");
  }, [engine]);

  useEffect(() => {
    if (over || paused || engine) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      220,
    );
    return () => clearInterval(t);
  }, [over, paused, engine]);

  useEffect(() => {
    if (engine) return;
    if (score > 0 && score % 2500 < 100) setLevel((l) => l + 1);
  }, [score, engine]);

  useEffect(() => {
    if (!engine) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // Backing store a resolución nativa (nitidez en pantallas DPR > 1);
    // el motor sigue dibujando en las coordenadas lógicas que declara.
    const dpr = window.devicePixelRatio || 1;
    canvas.width = engine.width * dpr;
    canvas.height = engine.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const instance = engine.create(ctx, {
      onScoreChange: setScore,
      onLivesChange: setLives,
      onLevelChange: setLevel,
      onGameOver: () => setOver(true),
      onStatChange: (key, value) =>
        setStats((prev) => ({ ...prev, [key]: value })),
    });
    engineRef.current = instance;
    instance.start();

    return () => {
      instance.destroy();
      engineRef.current = null;
    };
    // runId fuerza una instancia nueva al pulsar "JUGAR DE NUEVO".
  }, [engine, runId]);

  useEffect(() => {
    if (!engine || !over) return;
    engineRef.current?.pause();
  }, [over, engine]);

  if (!game) {
    return (
      <div className="av-player fade-in">
        <div
          style={{
            textAlign: "center",
            padding: 80,
            color: "var(--ink-faint)",
          }}
        >
          <div
            className="pixel"
            style={{ fontSize: 14, color: "var(--magenta)", marginBottom: 12 }}
          >
            JUEGO NO ENCONTRADO
          </div>
        </div>
      </div>
    );
  }

  const endGame = () => setOver(true);
  const togglePause = () => {
    setPaused((p) => {
      const next = !p;
      if (next) engineRef.current?.pause();
      else engineRef.current?.resume();
      return next;
    });
  };
  const restart = () => {
    setScore(0);
    setLives(3);
    setLevel(1);
    setStats({});
    setPaused(false);
    setOver(false);
    setSaved(false);
    // Destruye la instancia actual y monta una nueva (ver efecto con [engine, runId]).
    setRunId((r) => r + 1);
  };
  const handleSaveScore = async () => {
    await saveScore({ gameId: game.id, name, score });
    setSaved(true);
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          {engine?.usesLives !== false && (
            <div className="hud-stat lives">
              <div className="l">Vidas</div>
              <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
            </div>
          )}
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
          {engine?.extraStats?.map((stat) => (
            <div className="hud-stat" key={stat.key}>
              <div className="l">{stat.label}</div>
              <div className="v">
                {(stats[stat.key] ?? 0).toLocaleString("es-ES")}
              </div>
            </div>
          ))}
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={togglePause}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={endGame}>
            FIN
          </button>
          <button
            className="btn ghost"
            onClick={() => router.push(`/juego/${game.id}`)}
          >
            SALIR
          </button>
        </div>
      </div>

      <div className="crt">
        <div
          className="crt-screen"
          style={
            engine
              ? ({
                  "--arcade-aspect": `${engine.width} / ${engine.height}`,
                } as CSSProperties)
              : undefined
          }
        >
          {engine ? (
            <canvas
              ref={canvasRef}
              width={engine.width}
              height={engine.height}
              className="arcade-canvas"
            />
          ) : (
            <div className="game-arena">
              <div className="grid-floor" />
              <div className="enemy e1" />
              <div className="enemy e2" />
              <div className="enemy e3" />
              <div className="player-ship" />
            </div>
          )}
          {paused && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                />
                <button className="btn yellow" onClick={handleSaveScore}>
                  GUARDAR PUNTUACIÓN
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <button className="btn magenta" onClick={() => router.push("/")}>
                VOLVER AL VAULT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
