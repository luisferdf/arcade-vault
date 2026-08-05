export interface ActivityRow {
  player: string;
  game: string;
  score: number;
  time: string;
  color: "cyan" | "magenta" | "yellow" | "green";
}

export function ActivityTicker({ rows }: { rows: ActivityRow[] }) {
  return (
    <div className="ticker">
      {rows.map((r, i) => (
        <div key={i} className="tick-row" style={{ animationDelay: `${i * 60}ms` }}>
          <span className={"tk-p neon-" + r.color}>{r.player}</span>
          <span className="tk-mid">▸ {r.game}</span>
          <span className="tk-s">+{r.score.toLocaleString("es-ES")}</span>
          <span className="tk-t">{r.time}</span>
        </div>
      ))}
    </div>
  );
}
