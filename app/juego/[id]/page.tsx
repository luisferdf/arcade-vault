import Link from "next/link";
import { notFound } from "next/navigation";
import { getGameById, getTopScoresByGame } from "@/lib/games";

export default async function GameDetailPage(props: PageProps<"/juego/[id]">) {
  const { id } = await props.params;
  const game = await getGameById(id);
  if (!game) notFound();

  const scores = await getTopScoresByGame(game.id, 10);

  return (
    <div className="av-detail fade-in">
      <div className="detail-cover">
        <div className={"cover-bg " + game.cover} />
      </div>

      <div className="detail-info">
        <div className="detail-tags">
          <span>{game.cat}</span>
        </div>
        <h2 className="neon-cyan">{game.title}</h2>
        <p>{game.long}</p>
        <div className="stat-strip">
          <div>
            <div className="l">Mejor Puntuación</div>
            <div className="v">{game.best.toLocaleString("es-ES")}</div>
          </div>
          <div>
            <div className="l">Partidas Jugadas</div>
            <div className="v">{game.plays}</div>
          </div>
          <div>
            <div className="l">Categoría</div>
            <div className="v">{game.cat}</div>
          </div>
        </div>
        <div className="detail-actions">
          <Link href={`/juego/${game.id}/jugar`} className="btn xl pulse">
            JUGAR AHORA
          </Link>
          <Link href="/" className="btn ghost lg">
            VOLVER
          </Link>
        </div>
      </div>

      <div className="leaderboard" style={{ gridColumn: "1 / -1" }}>
        <h3>LEADERBOARD</h3>
        {scores.map((s) => (
          <div
            key={s.rank}
            className={"lb-row" + (s.rank <= 3 ? ` top${s.rank}` : "")}
          >
            <div className="rk">#{s.rank}</div>
            <div className="pl">{s.name}</div>
            <div className="sc">{s.score.toLocaleString("es-ES")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
