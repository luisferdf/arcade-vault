"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { GAMES } from "@/lib/games";
import { getStoredUser } from "@/lib/auth";
import { addStoredScore } from "@/lib/scores";
import { AsteroidsGame } from "@/lib/games/asteroids";

export default function GamePlayerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const game = GAMES.find((g) => g.id === id);
  const isAsteroids = game?.id === "asteroides";

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [name, setName] = useState("INVITADO");
  const [saved, setSaved] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const asteroidsRef = useRef<AsteroidsGame | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    if (user) setName(user.name);
  }, []);

  useEffect(() => {
    if (over || paused || isAsteroids) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      220,
    );
    return () => clearInterval(t);
  }, [over, paused, isAsteroids]);

  useEffect(() => {
    if (isAsteroids) return;
    if (score > 0 && score % 2500 < 100) setLevel((l) => l + 1);
  }, [score, isAsteroids]);

  useEffect(() => {
    if (!isAsteroids) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const instance = new AsteroidsGame(ctx, {
      onScoreChange: setScore,
      onLivesChange: setLives,
      onLevelChange: setLevel,
      onGameOver: () => setOver(true),
    });
    asteroidsRef.current = instance;
    instance.start();

    return () => {
      instance.destroy();
      asteroidsRef.current = null;
    };
  }, [isAsteroids]);

  useEffect(() => {
    if (!isAsteroids || !over) return;
    asteroidsRef.current?.pause();
  }, [over, isAsteroids]);

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
      if (isAsteroids) {
        if (next) asteroidsRef.current?.pause();
        else asteroidsRef.current?.resume();
      }
      return next;
    });
  };
  const restart = () => {
    setScore(0);
    setLevel(1);
    setPaused(false);
    setOver(false);
    setSaved(false);
  };
  const saveScore = () => {
    addStoredScore({ game: game.id, score, name });
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
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
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
        <div className="crt-screen">
          {isAsteroids ? (
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              className="asteroids-canvas"
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
                <button className="btn yellow" onClick={saveScore}>
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
