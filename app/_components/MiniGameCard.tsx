import Link from "next/link";
import type { Game } from "@/lib/games";

export function MiniGameCard({ game }: { game: Game }) {
  return (
    <Link href={`/juego/${game.id}`} className="mini-card">
      <div className="mini-cover">
        <div className={"cover-bg " + game.cover} />
      </div>
      <div className="mini-meta">
        <div className="mini-title">{game.title}</div>
        <div className="mini-cat">{game.cat}</div>
      </div>
    </Link>
  );
}
