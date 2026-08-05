"use client";

import { useEffect } from "react";
import Link from "next/link";
import { GAMES } from "@/lib/games";
import { FeatureCard } from "./_components/FeatureCard";
import { MiniGameCard } from "./_components/MiniGameCard";
import { ActivityTicker, type ActivityRow } from "./_components/ActivityTicker";
import { TopPlayersList, type TopPlayerRow } from "./_components/TopPlayersList";

const STATS = [
  { n: "12+", u: "JUEGOS", s: "Y CONTANDO" },
  { n: "MILES", u: "DE PARTIDAS", s: "JUGADAS CADA DÍA" },
  { n: "GLOBAL", u: "RANKING", s: "COMPITE CON EL MUNDO" },
] as const;

const ACTIVITY_ROWS: ActivityRow[] = [
  { player: "NEONFOX", game: "Caída", score: 184220, time: "hace 2 min", color: "magenta" },
  { player: "PX_KAI", game: "Glotón", score: 96400, time: "hace 5 min", color: "yellow" },
  { player: "Z3R0COOL", game: "Invasores", score: 54190, time: "hace 8 min", color: "green" },
  { player: "VAULT_07", game: "Rocas", score: 41200, time: "hace 12 min", color: "cyan" },
  { player: "GLITCHA", game: "Bloque Buster", score: 28450, time: "hace 18 min", color: "cyan" },
  { player: "ARKADYA", game: "Serpentina", score: 7820, time: "hace 24 min", color: "green" },
  { player: "CYBER_LU", game: "Ranaria", score: 18900, time: "hace 31 min", color: "yellow" },
];

const TOP_PLAYERS: TopPlayerRow[] = [
  { rank: 1, player: "NEONFOX", score: 312840 },
  { rank: 2, player: "PX_KAI", score: 248110 },
  { rank: 3, player: "M00NRYU", score: 196720 },
  { rank: 4, player: "VAULT_07", score: 154300 },
  { rank: 5, player: "GLITCHA", score: 138900 },
];

const FEATURES = [
  {
    icon: "GAMEPAD",
    title: "JUEGOS CLÁSICOS",
    description: "Arkanoid, Tetris, Snake y muchos más. Los mejores arcades de todos los tiempos en un solo lugar.",
    color: "cyan",
  },
  {
    icon: "FREE",
    title: "100% GRATIS",
    description: "Sin suscripciones, sin pagos ocultos. Todos los juegos disponibles de forma gratuita.",
    color: "yellow",
  },
  {
    icon: "TROPHY",
    title: "LADDER BOARDS",
    description: "Compite con jugadores de todo el mundo. Escala el ranking y demuestra quién es el mejor.",
    color: "magenta",
  },
  {
    icon: "ROCKET",
    title: "SIEMPRE CRECIENDO",
    description: "Agregamos nuevos juegos constantemente. Vuelve seguido, siempre habrá algo nuevo que jugar.",
    color: "green",
  },
] as const;

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function FloatingSilhouettes() {
  return (
    <div className="home-silos" aria-hidden="true">
      <svg className="silo s1" viewBox="0 0 40 32">
        <g fill="#00f5ff">
          <rect x="6" y="4" width="4" height="4" />
          <rect x="30" y="4" width="4" height="4" />
          <rect x="2" y="8" width="36" height="4" />
          <rect x="2" y="12" width="4" height="4" />
          <rect x="14" y="12" width="4" height="4" />
          <rect x="22" y="12" width="4" height="4" />
          <rect x="34" y="12" width="4" height="4" />
          <rect x="2" y="16" width="36" height="4" />
          <rect x="6" y="20" width="4" height="4" />
          <rect x="30" y="20" width="4" height="4" />
        </g>
      </svg>
      <svg className="silo s2" viewBox="0 0 32 32">
        <g fill="#ff006e">
          <rect x="8" y="0" width="16" height="4" />
          <rect x="4" y="4" width="24" height="4" />
          <rect x="0" y="8" width="32" height="12" />
          <rect x="0" y="20" width="6" height="6" />
          <rect x="10" y="20" width="4" height="6" />
          <rect x="18" y="20" width="4" height="6" />
          <rect x="26" y="20" width="6" height="6" />
        </g>
      </svg>
      <svg className="silo s3" viewBox="0 0 32 32">
        <g fill="#f5ff00">
          <rect x="10" y="0" width="12" height="4" />
          <rect x="6" y="4" width="20" height="4" />
          <rect x="4" y="8" width="6" height="6" />
          <rect x="22" y="8" width="6" height="6" />
          <rect x="2" y="14" width="28" height="10" />
          <rect x="6" y="24" width="4" height="4" />
          <rect x="14" y="24" width="4" height="4" />
          <rect x="22" y="24" width="4" height="4" />
        </g>
      </svg>
      <svg className="silo s4" viewBox="0 0 24 24">
        <g fill="#00ff88">
          <rect x="10" y="0" width="4" height="24" />
          <rect x="0" y="10" width="24" height="4" />
          <rect x="6" y="6" width="12" height="12" fill="none" stroke="#00ff88" strokeWidth="2" />
        </g>
      </svg>
      <svg className="silo s5" viewBox="0 0 36 24">
        <g fill="#aa00ff">
          <rect x="14" y="2" width="8" height="4" />
          <rect x="10" y="6" width="16" height="4" />
          <rect x="4" y="10" width="28" height="4" />
          <rect x="0" y="14" width="36" height="4" />
          <rect x="6" y="18" width="4" height="2" />
          <rect x="16" y="18" width="4" height="2" />
          <rect x="26" y="18" width="4" height="2" />
        </g>
      </svg>
      <svg className="silo s6" viewBox="0 0 20 20">
        <g fill="#ffcf3a">
          <rect x="6" y="0" width="8" height="2" />
          <rect x="2" y="2" width="16" height="2" />
          <rect x="0" y="4" width="20" height="12" />
          <rect x="2" y="16" width="16" height="2" />
          <rect x="6" y="18" width="8" height="2" />
          <rect x="8" y="4" width="4" height="12" fill="#0a0a0f" />
        </g>
      </svg>
      <svg className="silo s7" viewBox="0 0 24 22">
        <g fill="#ff3060">
          <rect x="2" y="2" width="6" height="2" />
          <rect x="16" y="2" width="6" height="2" />
          <rect x="0" y="4" width="10" height="4" />
          <rect x="14" y="4" width="10" height="4" />
          <rect x="0" y="8" width="24" height="4" />
          <rect x="2" y="12" width="20" height="2" />
          <rect x="4" y="14" width="16" height="2" />
          <rect x="6" y="16" width="12" height="2" />
          <rect x="8" y="18" width="8" height="2" />
          <rect x="10" y="20" width="4" height="2" />
        </g>
      </svg>
      <svg className="silo s8" viewBox="0 0 24 24">
        <g fill="#00d4ff">
          <rect x="8" y="2" width="8" height="6" />
          <rect x="2" y="8" width="20" height="8" />
          <rect x="8" y="16" width="8" height="6" />
          <rect x="11" y="6" width="2" height="2" fill="#0a0a0f" />
          <rect x="11" y="16" width="2" height="2" fill="#0a0a0f" />
          <rect x="4" y="11" width="2" height="2" fill="#0a0a0f" />
          <rect x="18" y="11" width="2" height="2" fill="#0a0a0f" />
        </g>
      </svg>
    </div>
  );
}

export default function Home() {
  useReveal();

  return (
    <div className="home fade-in">
      <section className="home-hero">
        <FloatingSilhouettes />
        <div className="home-hero-inner">
          <div className="hero-eyebrow pixel neon-yellow">
            ▸ INSERTA UNA MONEDA<span className="blink">_</span>
          </div>
          <h1 className="home-title">
            <span className="line-1">EL ARCADE</span>
            <span className="line-2">CLÁSICO ESTÁ</span>
            <span className="line-3">DE VUELTA</span>
          </h1>
          <p className="home-sub">
            Juega los mejores clásicos directamente en tu navegador.
            <br />
            Sin descargas. Sin costo. Solo diversión.
          </p>
          <div className="home-ctas">
            <Link href="/biblioteca" className="btn xl pulse">
              ▶ EXPLORAR JUEGOS
            </Link>
            <Link href="/auth" className="btn xl magenta">
              ✦ CREAR CUENTA
            </Link>
          </div>
          <div className="hero-scroll" aria-hidden="true">
            <span>DESLIZA</span>
            <span className="arrow">▼</span>
          </div>
        </div>
      </section>

      <section className="home-section reveal">
        <div className="section-head">
          <div className="kicker pixel neon-magenta">// 01</div>
          <h2 className="section-title">¿POR QUÉ ARCADE VAULT?</h2>
          <div className="section-rule" />
        </div>
        <div className="feature-grid">
          {FEATURES.map((f, i) => (
            <FeatureCard
              key={f.title}
              icon={f.icon}
              title={f.title}
              description={f.description}
              color={f.color}
              delayMs={i * 80}
            />
          ))}
        </div>
      </section>

      <section className="home-section reveal">
        <div className="section-head">
          <div className="kicker pixel neon-cyan">// 02</div>
          <h2 className="section-title">JUEGOS DISPONIBLES AHORA</h2>
          <div className="section-rule" />
        </div>
        <div className="mini-rail">
          {GAMES.slice(0, 6).map((g) => (
            <MiniGameCard key={g.id} game={g} />
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <Link href="/biblioteca" className="btn lg">
            VER TODOS LOS JUEGOS →
          </Link>
        </div>
      </section>

      <section className="home-stats reveal">
        <div className="stats-inner">
          {STATS.map((st, i) => (
            <div key={st.u} className="stat-block" style={{ transitionDelay: `${i * 90}ms` }}>
              <div className="stat-n neon-yellow">{st.n}</div>
              <div className="stat-u pixel">{st.u}</div>
              <div className="stat-s">{st.s}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="home-section reveal">
        <div className="section-head">
          <div className="kicker pixel neon-yellow">// 03</div>
          <h2 className="section-title">ACTIVIDAD EN VIVO</h2>
          <div className="section-rule" />
        </div>
        <div className="activity-grid">
          <div className="activity-card">
            <div className="ac-head">
              <div className="ac-title pixel">▸ ÚLTIMAS PUNTUACIONES</div>
            </div>
            <ActivityTicker rows={ACTIVITY_ROWS} />
          </div>

          <div className="activity-card">
            <div className="ac-head">
              <div className="ac-title pixel neon-magenta">▸ TOP JUGADORES · HOY</div>
              <Link href="/salon" className="lb-link">
                VER SALÓN →
              </Link>
            </div>
            <TopPlayersList players={TOP_PLAYERS} />
          </div>
        </div>
      </section>
    </div>
  );
}
