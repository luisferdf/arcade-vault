import { getGlobalTopScores, type ScoreEntry } from "@/lib/games";

const TABLE_LIMIT = 20;

function podiumSlot(
  entries: ScoreEntry[],
  rank: 1 | 2 | 3,
  tone: "gold" | "silver" | "bronze",
) {
  const e = entries[rank - 1];
  if (!e) return <div key={tone} className={`podium-slot ${tone}`} />;
  return (
    <div key={tone} className={`podium-slot ${tone}`}>
      <div className="rank-num">{rank}</div>
      <div className="name">{e.name}</div>
      <div className="score">{e.score.toLocaleString("es-ES")}</div>
      <div className="date">{e.date}</div>
    </div>
  );
}

export default async function HallOfFamePage() {
  const entries = await getGlobalTopScores(30);
  const podium = entries.slice(0, 3);
  const table = entries.slice(0, TABLE_LIMIT);

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p>LAS PUNTUACIONES MÁS ALTAS DEL VAULT</p>
      </div>

      <div className="podium">
        {podiumSlot(podium, 2, "silver")}
        {podiumSlot(podium, 1, "gold")}
        {podiumSlot(podium, 3, "bronze")}
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
            className={"tr" + (e.rank <= 3 ? ` top${e.rank}` : "")}
          >
            <div className="rk">#{e.rank}</div>
            <div className="pl">{e.name}</div>
            <div className="sc">{e.score.toLocaleString("es-ES")}</div>
            <div className="dt">{e.date}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
