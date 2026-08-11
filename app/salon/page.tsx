import Link from "next/link";
import { getGames, getGlobalTopScores, getTopScoresByGame } from "@/lib/games";
import type { ScoreEntry } from "@/lib/games";

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

export default async function HallOfFamePage(props: PageProps<"/salon">) {
  const searchParams = await props.searchParams;
  const rawJuego = searchParams.juego;
  const juegoParam = Array.isArray(rawJuego) ? rawJuego[0] : rawJuego;

  const games = await getGames();
  const selected = games.find((g) => g.id === juegoParam) ?? null;

  const entries = selected
    ? await getTopScoresByGame(selected.id, 30)
    : await getGlobalTopScores(30);
  const podium = entries.slice(0, 3);
  const table = entries.slice(0, TABLE_LIMIT);

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p>
          {selected
            ? `MEJORES PUNTUACIONES · ${selected.title}`
            : "LAS PUNTUACIONES MÁS ALTAS DEL VAULT"}
        </p>
      </div>

      <div className="hall-tabs">
        <Link href="/salon" className={"chip" + (selected ? "" : " active")}>
          GLOBAL
        </Link>
        {games.map((g) => (
          <Link
            key={g.id}
            href={`/salon?juego=${g.id}`}
            className={"chip" + (selected?.id === g.id ? " active" : "")}
          >
            {g.title}
          </Link>
        ))}
      </div>

      {entries.length === 0 ? (
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
            SIN PUNTUACIONES TODAVÍA
          </div>
          <div>Sé el primero en aparecer aquí.</div>
        </div>
      ) : (
        <>
          <div className="podium">
            {podiumSlot(podium, 2, "silver")}
            {podiumSlot(podium, 1, "gold")}
            {podiumSlot(podium, 3, "bronze")}
          </div>

          <div className={"hall-table" + (selected ? "" : " with-game")}>
            <div className="th">
              <div>RANGO</div>
              <div>JUGADOR</div>
              {!selected && <div>JUEGO</div>}
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
                {!selected && <div className="gm">{e.gameTitle}</div>}
                <div className="sc">{e.score.toLocaleString("es-ES")}</div>
                <div className="dt">{e.date}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
