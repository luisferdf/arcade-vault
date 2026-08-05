export interface TopPlayerRow {
  rank: number;
  player: string;
  score: number;
}

export function TopPlayersList({ players }: { players: TopPlayerRow[] }) {
  return (
    <div className="top-list">
      {players.map((r, i) => (
        <div key={r.rank} className={"top-row" + (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")}>
          <span className="tp-rk">#{String(r.rank).padStart(2, "0")}</span>
          <span className="tp-bar">
            <span className="tp-fill" style={{ width: `${100 - i * 16}%` }} />
          </span>
          <span className="tp-p">{r.player}</span>
          <span className="tp-s">{r.score.toLocaleString("es-ES")}</span>
        </div>
      ))}
    </div>
  );
}
