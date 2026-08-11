import { getGameById } from "@/lib/games";
import { GamePlayerClient } from "@/app/_components/GamePlayerClient";

export default async function GamePlayerPage(
  props: PageProps<"/juego/[id]/jugar">,
) {
  const { id } = await props.params;
  const game = await getGameById(id);
  return <GamePlayerClient game={game} />;
}
