"use client";

import { useEffect, useState } from "react";
import { seededScores, type ScoreEntry } from "@/lib/games";
import { getStoredScores } from "@/lib/scores";

const GLOBAL_SEED = 20260804;
const TABLE_LIMIT = 20;

interface HallEntry extends ScoreEntry {
  isYou: boolean;
}

function formatDate(at: number): string {
  const d = new Date(at);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}

export default function HallOfFamePage() {
  const [entries, setEntries] = useState<HallEntry[]>([]);

  useEffect(() => {
    const base: HallEntry[] = seededScores(GLOBAL_SEED, 30).map((s) => ({ ...s, isYou: false }));
    const local: HallEntry[] = getStoredScores().map((s) => ({
      rank: 0,
      name: s.name,
      score: s.score,
      date: formatDate(s.at),
      isYou: true,
    }));
    const merged = [...base, ...local]
      .sort((a, b) => b.score - a.score)
      .map((e, i) => ({ ...e, rank: i + 1 }));
    setEntries(merged);
  }, []);

  const podium = entries.slice(0, 3);
  const table = entries.slice(0, TABLE_LIMIT);
  const yourBest = entries.find((e) => e.isYou);
  const yourBestOutsideTable = yourBest && yourBest.rank > TABLE_LIMIT ? yourBest : null;

  const podiumSlot = (rank: 1 | 2 | 3, tone: "gold" | "silver" | "bronze") => {
    const e = podium[rank - 1];
    if (!e) return <div key={tone} className={`podium-slot ${tone}`} />;
    return (
      <div key={tone} className={`podium-slot ${tone}`}>
        <div className="rank-num">{rank}</div>
        <div className="name">{e.name}</div>
        <div className="score">{e.score.toLocaleString("es-ES")}</div>
        <div className="date">{e.date}</div>
      </div>
    );
  };

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p>LAS PUNTUACIONES MÁS ALTAS DEL VAULT</p>
      </div>

      <div className="podium">
        {podiumSlot(2, "silver")}
        {podiumSlot(1, "gold")}
        {podiumSlot(3, "bronze")}
      </div>

      <div className="hall-table">
        <div className="th">
          <div>RANGO</div>
          <div>JUGADOR</div>
          <div>PUNTUACIÓN</div>
          <div>FECHA</div>
        </div>
        {table.map((e) => (
          <div
            key={`${e.rank}-${e.name}`}
            className={"tr" + (e.isYou ? " you" : "") + (e.rank <= 3 ? ` top${e.rank}` : "")}
          >
            <div className="rk">#{e.rank}</div>
            <div className="pl">{e.name}</div>
            <div className="sc">{e.score.toLocaleString("es-ES")}</div>
            <div className="dt">{e.date}</div>
          </div>
        ))}

        {yourBestOutsideTable && (
          <>
            <div className="tr you-label">TU MEJOR PUNTUACIÓN</div>
            <div className="tr you">
              <div className="rk">#{yourBestOutsideTable.rank}</div>
              <div className="pl">{yourBestOutsideTable.name}</div>
              <div className="sc">{yourBestOutsideTable.score.toLocaleString("es-ES")}</div>
              <div className="dt">{yourBestOutsideTable.date}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
